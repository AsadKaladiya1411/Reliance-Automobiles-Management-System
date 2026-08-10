import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { Prisma } from "../../generated/prisma/client";
import prisma from "../../lib/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import type { AuthUser } from "../../types/auth";
import type { RequestContext } from "../../types/request-context";
import { writeAuditLog } from "../audit/audit.service";
import { removesLastSuperAdmin } from "./user-access-policy";

type BootstrapInput = {
  companyName: string;
  adminFullName: string;
  adminUsername: string;
  adminEmail?: string;
  adminPassword: string;
};

type LoginInput = {
  username: string;
  password: string;
};

type CreateManagedUserInput = {
  username: string;
  email?: string;
  fullName: string;
  password: string;
  roleId: string;
};

type AuthContext = RequestContext & {
  companyId: string;
  userId: string;
  roles: string[];
};

const maxFailedLoginAttempts = 5;
const lockoutMinutes = 15;
const jwtIssuer = "rams-erp";
const jwtAudience = "rams-users";

const defaultStaffPermissionMatrix: Record<string, string[]> = {
  dashboard: ["read"],
  masters: ["create", "read", "update"],
  "commercial-masters": ["create", "read", "update"],
  inventory: ["create", "read", "update"],
  purchase: ["create", "read", "update"],
  sales: ["create", "read", "update"],
  workshop: ["create", "read", "update"],
  accounting: ["create", "read", "update"],
  gst: ["read"],
  reports: ["read"],
};

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

async function syncDefaultStaffPermissions(tx: Prisma.TransactionClient, companyId: string) {
  const role = await tx.role.upsert({
    where: { companyId_code: { companyId, code: "STAFF" } },
    create: {
      companyId,
      code: "STAFF",
      name: "Staff",
      description: "Default registered user role",
      isSystem: true,
    },
    update: { status: "ACTIVE", isSystem: true },
  });

  for (const [module, actions] of Object.entries(defaultStaffPermissionMatrix)) {
    for (const action of actions) {
      const permission = await tx.permission.upsert({
        where: {
          companyId_module_action: {
            companyId,
            module,
            action,
          },
        },
        create: {
          companyId,
          module,
          action,
          description: `${action} ${module}`,
        },
        update: {},
      });

      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  return role;
}

function assertPassword(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < 8) {
    throw new ApiError(400, "WEAK_PASSWORD", "Password must be at least 8 characters.");
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new ApiError(400, "INVALID_PASSWORD", "Password must be 72 bytes or fewer.");
  }
}

function normalizeManagedEmail(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }

  return email;
}

function assertSuperAdmin(context: AuthContext) {
  if (!context.roles.includes("SUPER_ADMIN")) {
    throw new ApiError(403, "FORBIDDEN", "Only Super Admin users can manage users and roles.");
  }
}

function toAuthUser(user: {
  id: string;
  companyId: string;
  username: string;
  fullName: string;
  userRoles: Array<{
    role: {
      code: string;
      rolePermissions: Array<{
        permission: {
          module: string;
          action: string;
        };
      }>;
    };
  }>;
}): AuthUser {
  const roles = user.userRoles.map((userRole) => userRole.role.code);
  const permissions = user.userRoles.flatMap((userRole) =>
    userRole.role.rolePermissions.map(
      (rolePermission) =>
        `${rolePermission.permission.module}:${rolePermission.permission.action}`,
    ),
  );

  return {
    id: user.id,
    companyId: user.companyId,
    username: user.username,
    fullName: user.fullName,
    roles,
    permissions: Array.from(new Set(permissions)),
  };
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign(
    {
      sub: user.id,
      companyId: user.companyId,
      username: user.username,
    },
    env.jwtSecret,
    {
      algorithm: "HS256",
      issuer: jwtIssuer,
      audience: jwtAudience,
      expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    },
  );
}

export function verifyAuthToken(token: string) {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: jwtIssuer,
      audience: jwtAudience,
    });

    if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
      throw new ApiError(401, "INVALID_TOKEN", "Invalid authentication token.");
    }

    return payload as { sub: string; companyId?: string; username?: string };
  } catch {
    throw new ApiError(401, "INVALID_TOKEN", "Invalid authentication token.");
  }
}

export async function getSetupStatus() {
  const companyCount = await prisma.company.count();

  return {
    requiresBootstrap: companyCount === 0,
  };
}

export async function bootstrapSystem(input: BootstrapInput, context: RequestContext) {
  const setup = await getSetupStatus();

  if (!setup.requiresBootstrap) {
    throw new ApiError(409, "SYSTEM_ALREADY_BOOTSTRAPPED", "System setup is already complete.");
  }

  assertPassword(input.adminPassword);

  const passwordHash = await bcrypt.hash(input.adminPassword, env.passwordSaltRounds);
  const username = normalizeUsername(input.adminUsername);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        code: "MAIN",
        name: input.companyName.trim(),
      },
    });

    const role = await tx.role.create({
      data: {
        companyId: company.id,
        code: "SUPER_ADMIN",
        name: "Super Admin",
        description: "Full system access",
        isSystem: true,
      },
    });

    const permissionModules = [
      "dashboard",
      "company",
      "masters",
      "inventory",
      "purchase",
      "sales",
      "workshop",
      "accounting",
      "gst",
      "billing",
      "crm",
      "expense",
      "reports",
      "settings",
      "audit",
    ];

    const permissions = await Promise.all(
      permissionModules.flatMap((module) =>
        ["create", "read", "update", "delete", "approve", "post"].map((action) =>
          tx.permission.create({
            data: {
              companyId: company.id,
              module,
              action,
              description: `${action} ${module}`,
            },
          }),
        ),
      ),
    );

    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
    });

    await syncDefaultStaffPermissions(tx, company.id);

    const user = await tx.user.create({
      data: {
        companyId: company.id,
        username,
        email: input.adminEmail?.trim().toLowerCase() || null,
        fullName: input.adminFullName.trim(),
        passwordHash,
        passwordChangedAt: new Date(),
        userRoles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        actorUserId: user.id,
        module: "setup",
        action: "CREATE",
        entityType: "Company",
        entityId: company.id,
        description: "Initial company and super admin created.",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return {
      company,
      user: toAuthUser(user),
    };
  });

  return result;
}

export async function login(input: LoginInput, context: RequestContext) {
  const username = normalizeUsername(input.username);

  const user = await prisma.user.findFirst({
    where: {
      username,
      status: "ACTIVE",
    },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(423, "ACCOUNT_LOCKED", "Account is temporarily locked. Please try again later.");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const lockedUntil = failedLoginAttempts >= maxFailedLoginAttempts
      ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
      : null;

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts, lockedUntil },
    });

    await writeAuditLog({
      companyId: user.companyId,
      module: "auth",
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      description: lockedUntil ? "Failed login attempt locked the account." : "Failed login attempt.",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const refreshedUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const authUser = toAuthUser(refreshedUser);

  await writeAuditLog({
    companyId: user.companyId,
    userId: user.id,
    module: "auth",
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    description: "User logged in.",
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return authUser;
}

export async function createManagedUser(
  context: AuthContext,
  input: unknown,
) {
  assertSuperAdmin(context);
  const data = input && typeof input === "object"
    ? input as Partial<CreateManagedUserInput>
    : {};

  if (typeof data.username !== "string" || !data.username.trim()) {
    throw new ApiError(400, "INVALID_USER", "Username is required.");
  }

  if (typeof data.fullName !== "string" || !data.fullName.trim()) {
    throw new ApiError(400, "INVALID_USER", "Full name is required.");
  }

  if (typeof data.roleId !== "string" || !data.roleId.trim()) {
    throw new ApiError(400, "INVALID_ROLE", "Select a role for the user.");
  }

  const username = normalizeUsername(data.username);
  const fullName = data.fullName.trim();
  const roleId = data.roleId.trim();

  if (username.length > 80 || fullName.length > 160) {
    throw new ApiError(400, "INVALID_USER", "Username or full name is too long.");
  }

  const email = normalizeManagedEmail(data.email);
  assertPassword(data.password);
  const passwordHash = await bcrypt.hash(data.password, env.passwordSaltRounds);

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findFirst({
      where: {
        id: roleId,
        companyId: context.companyId,
        status: "ACTIVE",
      },
    });

    if (!role) {
      throw new ApiError(400, "INVALID_ROLE", "Selected role is not active for this company.");
    }

    const existing = await tx.user.findFirst({
      where: {
        companyId: context.companyId,
        OR: [
          { username },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existing) {
      throw new ApiError(409, "USER_ALREADY_EXISTS", "Username or email is already registered.");
    }

    const user = await tx.user.create({
      data: {
        companyId: context.companyId,
        username,
        email,
        fullName,
        passwordHash,
        passwordChangedAt: new Date(),
        userRoles: { create: { roleId: role.id } },
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "settings",
        action: "CREATE",
        entityType: "User",
        entityId: user.id,
        description: "User account created by Super Admin.",
        afterData: {
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: role.code,
          status: user.status,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return user;
  });
}

export async function listUsers(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      userRoles: {
        select: {
          role: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { role: { name: "asc" } },
      },
    },
    orderBy: { username: "asc" },
  });
}

export async function listRoles(companyId: string) {
  return prisma.role.findMany({
    where: { companyId, status: "ACTIVE" },
    include: {
      rolePermissions: {
        include: { permission: true },
        orderBy: [{ permission: { module: "asc" } }, { permission: { action: "asc" } }],
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function updateUserRoles(context: AuthContext, userId: string, body: unknown) {
  assertSuperAdmin(context);

  const data = body as Record<string, unknown>;
  const roleIds = Array.isArray(data.roleIds)
    ? Array.from(new Set(data.roleIds.filter((roleId): roleId is string => typeof roleId === "string" && roleId.trim() !== "")))
    : [];

  if (roleIds.length === 0) {
    throw new ApiError(400, "ROLES_REQUIRED", "Select at least one role.");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, companyId: context.companyId, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found.");
    }

    const roles = await tx.role.findMany({
      where: { companyId: context.companyId, id: { in: roleIds }, status: "ACTIVE" },
    });

    if (roles.length !== roleIds.length) {
      throw new ApiError(400, "INVALID_ROLE", "One or more selected roles are invalid.");
    }

    const currentlySuperAdmin = user.userRoles.some((userRole) => userRole.role.code === "SUPER_ADMIN");
    const otherActiveSuperAdminCount = currentlySuperAdmin
      ? await tx.user.count({
          where: {
            companyId: context.companyId,
            id: { not: user.id },
            status: "ACTIVE",
            deletedAt: null,
            userRoles: {
              some: {
                role: { code: "SUPER_ADMIN", status: "ACTIVE" },
              },
            },
          },
        })
      : 0;

    if (removesLastSuperAdmin({
      currentlySuperAdmin,
      nextRoleCodes: roles.map((role) => role.code),
      otherActiveSuperAdminCount,
    })) {
      throw new ApiError(
        400,
        "LAST_SUPER_ADMIN_REQUIRED",
        "Assign another active Super Admin before changing this user's role.",
      );
    }

    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({ data: roles.map((role) => ({ userId, roleId: role.id })) });

    const updated = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { id: true, code: true, name: true } },
          },
          orderBy: { role: { name: "asc" } },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        module: "settings",
        action: "UPDATE",
        entityType: "UserRoles",
        entityId: user.id,
        description: "User roles updated.",
        beforeData: user.userRoles.map((userRole) => userRole.role.code),
        afterData: updated.userRoles.map((userRole) => userRole.role.code),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
  }

  return toAuthUser(user);
}
