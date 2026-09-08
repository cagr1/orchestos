// Synthetic fixtures and real dashboard. Run with gate:evidence; no personal project.
import { createHash } from 'node:crypto'
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { route } from '../src/dashboard/server.ts'
import { appendChatExchange, createChatSession } from '../src/db/chat-sessions.ts'
import { beginTurn, reserveTurnTask } from '../src/db/chat-turns.ts'
import { runMigrations } from '../src/db/migrate.ts'
import { db } from '../src/db/sqlite.ts'

const home = process.env.ORCHESTOS_HOME
const evidence = process.env.REVIEW_EVIDENCE_DIR
if (!home || !evidence) throw new Error('Use gate:evidence and REVIEW_EVIDENCE_DIR')
mkdirSync(evidence, { recursive: true })
const root = join(home, 'project')
mkdirSync(root, { recursive: true })
runMigrations()
const fixtureId = 'r5-review'
const exists = db.query('SELECT id FROM projects WHERE id = ?').get(fixtureId)
if (!exists) {
  writeFileSync(join(root, 'orchestos.config.yaml'), 'agent: claude\n')
  writeFileSync(join(root, 'existing.txt'), 'fixture unchanged')
  writeFileSync(
    join(root, 'tasks.yaml'),
    'version: 1\nproject: r5-review\ntasks:\n  - id: held-fixture\n    description: Edit existing fixture\n    output: [existing.txt]\n    executor: openrouter\n    status: pending\n    retry_count: 0\n',
  )
  db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', [
    fixtureId,
    realpathSync(root),
    '{}',
    '',
    new Date().toISOString(),
  ])
  const held = createChatSession({
    projectId: fixtureId,
    agent: 'claude',
    mode: 'chat',
    title: 'R4 held fixture',
  })
  appendChatExchange({
    sessionId: held.id,
    userContent: 'Fixture edit request',
    assistantContent: 'Fixture awaiting confirmation',
    taskId: 'held-fixture',
    taskHeld: true,
    existingFiles: ['existing.txt'],
    ocrUsed: ['fixture.png'],
  })
  const live = createChatSession({
    projectId: fixtureId,
    agent: 'claude',
    mode: 'chat',
    title: 'R5 live conversation',
  })
  const interrupted = createChatSession({
    projectId: fixtureId,
    agent: 'claude',
    mode: 'chat',
    title: 'R5 interrupted reservation',
  })
  const turn = beginTurn({
    sessionId: interrupted.id,
    projectId: fixtureId,
    requestKey: 'crash-key',
    inputFingerprint: createHash('sha256')
      .update(JSON.stringify({ message: 'fixture', fileIds: [], model: null, effort: null }))
      .digest('hex'),
    owner: 'fixture-owner',
  })
  if (turn.kind !== 'claimed') throw new Error('fixture claim failed')
  reserveTurnTask(turn.turn.id, 'fixture-owner')
  db.run('UPDATE chat_turns SET owner_expires_at = ? WHERE id = ?', ['2000-01-01', turn.turn.id])
  writeFileSync(
    join(evidence, 'fixture.json'),
    JSON.stringify({
      root,
      home,
      held: held.id,
      live: live.id,
      interrupted: interrupted.id,
      turn: turn.turn.id,
    }),
  )
}
process.chdir(root)
const port = 50923
const server = Bun.serve({ hostname: '127.0.0.1', port, fetch: (req) => route(req, port) })
console.log(`R5 review http://localhost:${port}; evidence ${evidence}`)
process.on('SIGTERM', () => {
  writeFileSync(
    join(evidence, 'db-report.json'),
    JSON.stringify(
      {
        turns: db.query('SELECT * FROM chat_turns').all(),
        messages: db.query('SELECT * FROM chat_messages').all(),
        runs: db.query('SELECT id, status, task_class FROM runs').all(),
      },
      null,
      2,
    ),
  )
  server.stop(true)
  db.close()
  process.exit(0)
})
