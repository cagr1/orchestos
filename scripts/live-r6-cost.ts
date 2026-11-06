// R.6 live gate: isolated fixture, real dashboard route, fake local Claude stream.
// Its caller places scripts/fixtures/claude first in PATH; it never
// calls a provider nor touches Carlos's project/DB. Use through gate:evidence.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { route } from '../src/dashboard/server.ts'
import { createChatSession } from '../src/db/chat-sessions.ts'
import { runMigrations } from '../src/db/migrate.ts'
import { db } from '../src/db/sqlite.ts'

const home = process.env.ORCHESTOS_HOME
if (!home) throw new Error('Use gate:evidence to isolate ORCHESTOS_HOME')

const root = join(home, 'r6-cost-fixture')
const port = 50924
mkdirSync(root, { recursive: true })
writeFileSync(join(root, 'orchestos.config.yaml'), 'agent: claude\n')

runMigrations()
process.chdir(root)

const session = createChatSession({
  projectId: null,
  agent: 'claude',
  mode: 'chat',
  title: 'R.6 reported cost fixture',
})

const server = Bun.serve({ hostname: '127.0.0.1', port, fetch: (req) => route(req, port) })
const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}` },
  body: JSON.stringify({
    sessionId: session.id,
    message: 'R6 fixture message',
    requestKey: 'r6-reported-cost',
    model: 'anthropic/claude-sonnet-5',
    effort: 'max',
  }),
})
if (!response.ok)
  throw new Error(`fixture chat failed: ${response.status} ${await response.text()}`)

// R.6: no sessionId exercises the legacy persistence path. The fixture omits
// total_cost_usd and reports an unpriced canonical model; this must remain
// unknown through SQLite, the API and the browser instead of becoming "$0".
const unknownResponse = await fetch(`http://127.0.0.1:${port}/api/chat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}` },
  body: JSON.stringify({
    message: 'R6 unknown model fixture',
    model: 'anthropic/claude-sonnet-5',
    effort: 'low',
  }),
})
if (!unknownResponse.ok)
  throw new Error(
    `unknown-cost fixture chat failed: ${unknownResponse.status} ${await unknownResponse.text()}`,
  )

const zeroResponse = await fetch(`http://127.0.0.1:${port}/api/chat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}` },
  body: JSON.stringify({
    message: 'R6 zero cost fixture',
    model: 'anthropic/claude-sonnet-5',
    effort: 'low',
  }),
})
if (!zeroResponse.ok)
  throw new Error(
    `zero-cost fixture chat failed: ${zeroResponse.status} ${await zeroResponse.text()}`,
  )

const estimatedResponse = await fetch(`http://127.0.0.1:${port}/api/chat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}` },
  body: JSON.stringify({
    message: 'R6 estimated cost fixture',
    model: 'anthropic/claude-sonnet-5',
    effort: 'medium',
  }),
})
if (!estimatedResponse.ok)
  throw new Error(
    `estimated-cost fixture chat failed: ${estimatedResponse.status} ${await estimatedResponse.text()}`,
  )

const rows = db
  .query<{ model: string; usd_cost: number; cost_breakdown_json: string }, []>(
    "SELECT model, usd_cost, cost_breakdown_json FROM runs WHERE task_class = 'chat' ORDER BY created_at",
  )
  .all()
const apiRows = await (await fetch(`http://127.0.0.1:${port}/api/runs?limit=10`)).json()
console.log(JSON.stringify({ port, sessionId: session.id, rows, apiRows }, null, 2))

process.on('SIGTERM', () => {
  server.stop(true)
  db.close()
  process.exit(0)
})
