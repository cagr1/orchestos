import { describe, it, expect, afterAll } from 'bun:test'
import { db } from '../db/sqlite.ts'
import { handleApiChatTaskBarClick } from '../dashboard/handlers/chat.ts'

// B.1 (Mes 18): gate de evidencia antes del clasificador semántico — registra,
// por click en "Create task", un evento en chat_task_bar_events. Ver
// docs/chat-task-detection-design.md.
describe('chat_task_bar_events instrumentation', () => {
  afterAll(() => {
    db.run(`DELETE FROM chat_task_bar_events WHERE kind = 'click'`, [])
  })

  it('handleApiChatTaskBarClick records a click event', async () => {
    const before = db.query<{ n: number }, []>(
      `SELECT COUNT(*) as n FROM chat_task_bar_events WHERE kind = 'click'`
    ).get()?.n ?? 0

    const res = await handleApiChatTaskBarClick()
    expect(res.status).toBe(200)

    const after = db.query<{ n: number }, []>(
      `SELECT COUNT(*) as n FROM chat_task_bar_events WHERE kind = 'click'`
    ).get()?.n ?? 0
    expect(after).toBe(before + 1)
  })
})
