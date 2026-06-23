import { runMigrations } from '../src/db/migrate.ts'

runMigrations()
console.log('DB migrated.')
