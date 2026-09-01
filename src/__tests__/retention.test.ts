import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { runMigrations } from '../db/migrate.ts'
import { previewEphemeralData, purgeEphemeralData } from '../db/retention.ts'
import { db } from '../db/sqlite.ts'

const NOW = new Date('2026-07-29T12:00:00.000Z')

beforeAll(() => runMigrations())
afterAll(() => {
  db.run("DELETE FROM run_steps WHERE task_id LIKE 'retention-test-%'")
  db.run("DELETE FROM chat_task_bar_events WHERE message LIKE 'retention-test-%'")
})

describe('ephemeral data retention', () => {
  it('previews and purges only expired ephemeral rows', () => {
    db.run(
      `INSERT INTO run_steps (task_id, seq, type, label, created_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        'retention-test-old',
        1,
        'text',
        'old',
        '2026-06-01T00:00:00.000Z',
        'retention-test-new',
        1,
        'text',
        'new',
        '2026-07-29T11:00:00.000Z',
      ],
    )
    db.run(
      `INSERT INTO chat_task_bar_events (kind, message, created_at) VALUES (?, ?, ?), (?, ?, ?)`,
      [
        'message',
        'retention-test-old',
        '2026-06-01T00:00:00.000Z',
        'message',
        'retention-test-new',
        '2026-07-29T11:00:00.000Z',
      ],
    )

    const preview = previewEphemeralData(NOW, { runStepsDays: 30, chatTaskBarEventsDays: 30 })
    expect(preview.runSteps).toBe(1)
    expect(preview.chatTaskBarEvents).toBe(1)

    const result = purgeEphemeralData(NOW, { runStepsDays: 30, chatTaskBarEventsDays: 30 })
    expect(result.runSteps).toBe(1)
    expect(result.chatTaskBarEvents).toBe(1)
    expect(
      db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM run_steps WHERE task_id LIKE 'retention-test-%'",
        )
        .get()?.count,
    ).toBe(1)
    expect(
      db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM chat_task_bar_events WHERE message LIKE 'retention-test-%'",
        )
        .get()?.count,
    ).toBe(1)
  })

  it('rejects invalid retention periods before deleting anything', () => {
    expect(() =>
      previewEphemeralData(NOW, { runStepsDays: -1, chatTaskBarEventsDays: 30 }),
    ).toThrow()
    expect(() =>
      purgeEphemeralData(NOW, { runStepsDays: 30.5, chatTaskBarEventsDays: 30 }),
    ).toThrow()
  })
})
