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

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function assertPassword(password: string) {
  if (password.length < 8) {
    throw new ApiError(400, "WEAK_PASSWORD", "Password must be at least 8 characters.");
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

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    await writeAuditLog({
      companyId: user.companyId,
      module: "auth",
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      description: "Failed login attempt.",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid username or password.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
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
