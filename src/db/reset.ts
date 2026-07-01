import { db } from './sqlite.ts'
import { loadTasks, saveTasks, tasksExist } from '../tasks/loader.ts'

export interface ResetSummary {
  runsDeleted: number
  instinctsDeleted: number
  tasksReset: number
}

/**
 * Wipes test-session data so a fresh dogfooding run starts clean.
 * Does NOT touch memory_entries/memory_fts (real accumulated knowledge),
 * project config, skills, or CONSTITUTION.md/CONTEXT.md.
 */
export function resetTestData(root: string): ResetSummary {
  const runsDeleted = db.query('DELETE FROM runs').run().changes
  const instinctsDeleted = db.query('DELETE FROM instincts WHERE verified = 0').run().changes

  let tasksReset = 0
  if (tasksExist(root)) {
    const file = loadTasks(root)
    for (const t of file.tasks) {
      if (t.status !== 'pending') tasksReset++
      t.status = 'pending'
      t.retry_count = 0
      delete t.retry_reason
      delete t.qa_verdict
      delete t.run_id
    }
    saveTasks(root, file)
  }

  return { runsDeleted, instinctsDeleted, tasksReset }
}
