import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import prisma from "../../lib/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import type { AuthUser } from "../../types/auth";
import type { RequestContext } from "../../types/request-context";
import { writeAuditLog } from "../audit/audit.service";

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

type RegisterInput = {
  username: string;
  email?: string;
  password: string;
};

type AuthContext = RequestContext & {
  companyId: string;
  userId: string;
  roles: string[];
};

const maxFailedLoginAttempts = 5;
const lockoutMinutes = 15;

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function assertPassword(password: string) {
  if (password.length < 8) {
    throw new ApiError(400, "WEAK_PASSWORD", "Password must be at least 8 characters.");
  }
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
    { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] },
  );
}

export function verifyAuthToken(token: string) {
  try {
    const payload = jwt.verify(token, env.jwtSecret);

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

  const authUser = toAuthUser(user);

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

export async function registerUser(input: RegisterInput, context: RequestContext) {
  if (!input.username.trim()) {
    throw new ApiError(400, "INVALID_REGISTER_REQUEST", "Username is required.");
  }

  assertPassword(input.password);

  const company = await prisma.company.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (!company) {
    throw new ApiError(400, "SETUP_REQUIRED", "Initial system setup must be completed before user registration.");
  }

  const username = normalizeUsername(input.username);
  const email = input.email?.trim().toLowerCase() || null;
  const passwordHash = await bcrypt.hash(input.password, env.passwordSaltRounds);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: {
        companyId: company.id,
        OR: [
          { username },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existing) {
      throw new ApiError(409, "USER_ALREADY_EXISTS", "Username or email is already registered.");
    }

    const role = await tx.role.upsert({
      where: { companyId_code: { companyId: company.id, code: "STAFF" } },
      create: {
        companyId: company.id,
        code: "STAFF",
        name: "Staff",
        description: "Default registered user role",
        isSystem: true,
      },
      update: { status: "ACTIVE", isSystem: true },
    });
    const permissionModules = [
      "dashboard",
      "masters",
      "inventory",
      "purchase",
      "sales",
      "workshop",
      "accounting",
      "gst",
      "reports",
    ];

    for (const module of permissionModules) {
      const permission = await tx.permission.upsert({
        where: {
          companyId_module_action: {
            companyId: company.id,
            module,
            action: "read",
          },
        },
        create: {
          companyId: company.id,
          module,
          action: "read",
          description: `read ${module}`,
        },
        update: {},
      });

      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }

    const user = await tx.user.create({
      data: {
        companyId: company.id,
        username,
        email,
        fullName: username,
        passwordHash,
        passwordChangedAt: new Date(),
        userRoles: { create: { roleId: role.id } },
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
        module: "auth",
        action: "CREATE",
        entityType: "User",
        entityId: user.id,
        description: "User registered.",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });

    return toAuthUser(user);
  });

  return result;
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
  });
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
