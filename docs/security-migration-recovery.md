# SQLite Migration and Recovery Procedure

This is an operator procedure for `~/.orchestos/db.sqlite`. It is intentionally
manual: migration never replaces the live database with a backup automatically.
Use an isolated `ORCHESTOS_HOME` when rehearsing the procedure.

## Normal Migration

1. Create a consistent backup while OrchestOS is still available. `VACUUM INTO`
   avoids copying an active WAL by hand:

   ```sh
   bun -e 'import { createDatabaseBackup } from "./src/db/backup.ts"; console.log(createDatabaseBackup("/tmp/orchestos-db-pre-migration.sqlite"))'
   ```

2. Validate the backup before stopping the application:

   ```sh
   bun -e 'import { verifyDatabaseBackup } from "./src/db/backup.ts"; const result = verifyDatabaseBackup("/tmp/orchestos-db-pre-migration.sqlite"); console.log(result); if (!result.ok) process.exit(1)'
   ```

3. Stop OrchestOS, including dashboard and CLI processes that use the same
   `~/.orchestos` directory. Do not migrate while another process can write the
   live database.

4. Run the idempotent migration:

   ```sh
   bun run db:migrate
   ```

5. Run an integrity check before reopening the application:

   ```sh
   bun -e 'import { Database } from "bun:sqlite"; const database = new Database(process.env.HOME + "/.orchestos/db.sqlite", { readonly: true }); const result = database.query("PRAGMA integrity_check").get(); console.log(result); database.close(); if (Object.values(result ?? {})[0] !== "ok") process.exit(1)'
   ```

6. Reopen OrchestOS and inspect the startup/health output. Keep the validated
   backup until the migration has been exercised successfully.

## Failure Recovery

- Preserve the original live database. Do not delete it and do not restore over
  it automatically.
- Keep the failed database and migration output for diagnosis. Stop all
  OrchestOS processes before any further database operation.
- Revalidate the pre-migration backup. Restoration refuses corrupt backups and
  refuses an existing destination:

  ```sh
  bun -e 'import { restoreDatabaseBackup } from "./src/db/backup.ts"; console.log(restoreDatabaseBackup("/tmp/orchestos-db-pre-migration.sqlite", "/tmp/orchestos-db-recovered.sqlite"))'
  ```

- Run `PRAGMA integrity_check` on the new recovery destination. Only after an
  operator has compared and approved both files may the live database be
  replaced through a separately reviewed maintenance action. That replacement
  is outside the migration code and must not be automated by `runMigrations()`.

Backups contain the complete sensitive SQLite database. Keep them outside Git,
restrict access to the current user (`0600`), and remove them according to the
project retention policy after the recovery window closes.
