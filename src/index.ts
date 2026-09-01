// Public API — importable programmatically
export { loadContext } from './context/load.ts'
export { runMigrations } from './db/migrate.ts'
export { getProject, listProjects, upsertProject } from './db/projects.ts'
export type { StackProfile } from './generators/agents-md.ts'
