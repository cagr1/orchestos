// Public API — importable programmatically
export { loadContext } from './context/load.ts'
export { upsertProject, getProject, listProjects } from './db/projects.ts'
export { runMigrations } from './db/migrate.ts'
export type { StackProfile } from './generators/agents-md.ts'
