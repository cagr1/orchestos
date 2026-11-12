import { mutateTasks, tasksExist } from '../tasks/loader.ts'
import { db } from './sqlite.ts'

interface ResetSummary {
  runsDeleted: number
  instinctsDeleted: number
  tasksReset: number
}

/**
 * Wipes test-session data so a fresh dogfooding run starts clean.
 * Does NOT touch memory_entries/memory_fts (real accumulated knowledge),
 * project config, skills, or CONTEXT.md.
 */
export function resetTestData(root: string, projectId: string | null | undefined): ResetSummary {
  if (!projectId) throw new Error('project required')
  const { runsDeleted, instinctsDeleted } = db.transaction(() => {
    db.run('DELETE FROM eval_trials WHERE run_id IN (SELECT id FROM runs WHERE project_id = ?)', [
      projectId,
    ])
    db.run(
      'UPDATE chat_turns SET run_id = NULL WHERE run_id IN (SELECT id FROM runs WHERE project_id = ?)',
      [projectId],
    )
    const runsDeleted = db.run('DELETE FROM runs WHERE project_id = ?', [projectId]).changes
    const instinctsDeleted = db.run('DELETE FROM instincts WHERE verified = 0 AND project_id = ?', [
      projectId,
    ]).changes
    return { runsDeleted, instinctsDeleted }
  })()

  let tasksReset = 0
  if (tasksExist(root)) {
    mutateTasks(root, (file) => {
      for (const t of file.tasks) {
        if (t.status !== 'pending') tasksReset++
        t.status = 'pending'
        t.retry_count = 0
        delete t.retry_reason
        delete t.qa_verdict
        delete t.run_id
      }
    })
  }

  return { runsDeleted, instinctsDeleted, tasksReset }
}
