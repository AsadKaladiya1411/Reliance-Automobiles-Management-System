# RAMS Production Runbook

This runbook defines the current production operating process for RAMS. It should be followed before every production release until a managed CI/CD pipeline replaces the manual steps.

## Production Shape

- Frontend: React/Vite static build from `client/dist`.
- Backend: Express API compiled from `server/src` to `server/dist`.
- Database: PostgreSQL managed outside the application process.
- ORM: Prisma with generated client in `server/src/generated/prisma`.
- Runtime: Node.js with environment variables loaded by the host.

## Required Environment Variables

Use `.env.example` as the baseline and provide production values through the host secret manager.

- `NODE_ENV=production`
- `PORT`
- `CLIENT_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `AUTH_COOKIE_NAME`
- `PASSWORD_SALT_ROUNDS`
- `VITE_API_BASE_URL`

Production requirements:

- `JWT_SECRET` must be a long random secret and must not reuse development values.
- `DATABASE_URL` must point to the production PostgreSQL database.
- `CLIENT_URL` must be the exact deployed frontend origin.
- `VITE_API_BASE_URL` must be the public API base URL used by the frontend.

## Release Verification

Run this from the repository root before packaging or deployment:

```powershell
npm run verify
```

This runs:

- Prisma generate
- TypeScript checks
- Automated tests
- Lint
- Production build

Do not deploy if any step fails.

## Database Migration Process

Development migration command:

```powershell
npm run prisma:migrate
```

Production migration command:

```powershell
npm run prisma:deploy
```

Production rules:

- Take a database backup before migration.
- Run migrations before starting the new API build.
- Never edit an already-applied migration file.
- If a migration fails, stop deployment and restore from backup if partial database changes affect business data.
- Keep Prisma schema, generated client, and migrations in the same commit.

## Backup And Restore

Minimum backup policy for commercial use:

- Automated full PostgreSQL backup daily.
- Point-in-time recovery enabled if the database provider supports it.
- Backup retention of at least 30 days.
- Manual backup before every production migration.
- Quarterly restore drills into a non-production database.

Manual backup example:

```powershell
npm run backup
```

For a local Windows installation, this uses `scripts/backup-database.ps1`, discovers the installed PostgreSQL tools, reads the project `.env`, and creates a timestamped custom-format dump in `backups`.

Manual restore example (replace the filename with the verified backup):

```powershell
npm run restore -- -BackupFile "D:\RAMS\backups\rams-YYYYMMDD-HHMMSS.dump" -ConfirmRestore
```

The restore utility creates a pre-restore safety backup and uses a single database transaction. See [LOCAL_BACKUP_GUIDE.md](LOCAL_BACKUP_GUIDE.md) for local operator instructions.

Use provider-native backup tooling when available.

## Deployment Steps

1. Pull the intended release commit.
2. Install dependencies with a clean install.
3. Run `npm run verify`.
4. Take a production database backup.
5. Run `npm run prisma:deploy`.
6. Build the frontend and backend using `npm run build`.
7. Deploy `client/dist` to the static host.
8. Deploy `server/dist`, `server/package.json`, lockfile, Prisma files, and required runtime dependencies to the API host.
9. Start the API with production environment variables.
10. Validate `/api/health`, `/api/status`, and `/api/metrics`.
11. Perform a smoke test: login, dashboard load, master list load, and one read-only report load.

## Rollback

Application rollback:

- Redeploy the previous known-good frontend and backend build.
- Keep the database at the migrated version unless the failed release changed data incorrectly.

Database rollback:

- Prefer forward-fix migrations where possible.
- Restore the pre-release backup only when the release corrupts or blocks critical business data.
- After restoring, redeploy the application version that matches the restored schema.

## Monitoring Checklist

RAMS currently exposes:

- `x-request-id` response header for correlation.
- `requestId` in API JSON responses.
- request-id-aware HTTP logs.
- structured warning/error logs.
- `/api/health` for database connectivity.
- `/api/status` for application readiness metadata.
- `/api/metrics` for runtime process metrics.

Production monitoring should track:

- API process uptime.
- HTTP 5xx rate.
- HTTP 4xx spike rate.
- Response latency.
- Database connectivity failures.
- PostgreSQL CPU, memory, storage, and connection count.
- Backup success/failure.
- Disk usage on hosts that store logs or backups.

## Security Checklist

Before production:

- Use HTTPS only.
- Restrict database network access.
- Store secrets outside Git.
- Rotate `JWT_SECRET` through a controlled maintenance window if compromised.
- Keep production `.env` files off developer machines where possible.
- Review Super Admin users after setup.
- Confirm `CLIENT_URL` matches the deployed origin so CORS stays narrow.

## Release Notes Template

For every production release, record:

- Commit hash:
- Release date:
- Deployed by:
- Migrations included:
- Verification command result:
- Backup identifier:
- Smoke test result:
- Known risks:
- Rollback build:
