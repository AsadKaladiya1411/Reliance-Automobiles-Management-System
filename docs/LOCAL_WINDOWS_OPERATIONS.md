# RAMS Local Windows Operations

RAMS can run as a local production-style application on one Windows laptop. The browser and API use one address: `http://localhost:5000`.

## First-time setup or application update

Right-click `installer/Setup RAMS.cmd` and choose **Run as administrator**. Setup:

1. Loads the project `.env` into the current process without printing secrets.
2. Builds the frontend and backend for production.
3. Copies the frontend build into the local API server.
4. Applies pending Prisma database migrations.

Setup does not delete business records.

## Daily use

- Double-click `installer/Start RAMS.cmd` to start the hidden local server and open RAMS in the default browser.
- Double-click `installer/Stop RAMS.cmd` to stop only the process recorded by the RAMS launcher.
- Double-click `installer/RAMS Status.cmd` to check application and scheduled-backup status.
- Double-click `installer/Backup RAMS Now.cmd` to create an immediate database backup.

The launcher deliberately loads `DATABASE_URL` from the RAMS `.env`, so an unrelated system-level variable cannot redirect the local application to another database.

## Install the automatic daily backup

Open PowerShell in the RAMS folder and run:

```powershell
npm run backup:schedule
```

The default schedule runs every day at 8:00 PM and writes to `D:\RAMS\backups`. To use an external drive:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-backup-schedule.ps1 -BackupDirectory "E:\RAMS-Backups" -DailyTime "20:00"
```

The installer creates and validates a real test backup before registering the Windows task. The task uses **Start when available**, so Windows can run a missed backup after the laptop becomes available.

For disk-failure protection, use an external drive rather than storing every backup on the RAMS laptop.
