# RAMS Local Backup Guide

RAMS stores business data in PostgreSQL. Copying the project folder alone is not a complete database backup.

## Create a backup

From the RAMS project folder, run:

```powershell
npm run backup
```

The backup is written to the `backups` folder with a timestamped `.dump` filename. To save directly to an external drive:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup-database.ps1 -OutputDirectory "E:\RAMS-Backups"
```

Keep at least one recent backup on a different physical drive. A backup stored only on the same laptop will not protect against disk failure or theft.

## Restore a backup

Restoring replaces the current RAMS database contents. Stop normal data entry first and verify the selected file.

```powershell
npm run restore -- -BackupFile "D:\RAMS\backups\rams-YYYYMMDD-HHMMSS.dump" -ConfirmRestore
```

The restore utility always creates a fresh `pre-restore-*.dump` safety backup before changing the database. The restore itself uses one database transaction so a failed restore is rolled back.

After a successful restore, restart the RAMS server and sign in again.
