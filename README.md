# RAMS

Reliance Automobiles Management System is a web-based ERP for automobile spare parts shops, workshops, service centers, dealers, and distributors.

## Current Stack

- React + Vite frontend
- Express API backend
- Prisma + PostgreSQL database
- Workspace-managed monorepo

## Common Commands

```powershell
npm install
npm run dev:server
npm run dev:client
npm run verify
```

## Production Operations

Use [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md) for release verification, migrations, backup/restore, rollback, monitoring, and production readiness checks.

- Build a deployable container with `npm run docker:build`.
- Run the local production-style stack with `npm run docker:up`.
- Change every secret in `docker-compose.yml` before using it outside local validation.

## Development Notes

- `.env.example` documents required local and production variables.
- Run `npm run prisma:generate` after schema changes.
- Run `npm run verify` before committing release-ready work.

Developed by Umaiza IT Solutions.
