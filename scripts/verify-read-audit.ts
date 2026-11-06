// Independent gate: compare persisted audit with the captured CLI outcomes.
import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ClaudeReadAudit } from '../src/run/read-audit.ts'

const [evidence, output] = process.argv.slice(2)
if (!evidence || !output) throw new Error('Usage: verify-read-audit <capture-dir> <report.json>')
const fixture = JSON.parse(readFileSync(join(evidence, 'fixture.json'), 'utf8'))
const home = realpathSync(fixture.home)
const events = readFileSync(join(evidence, 'stream-1.ndjson'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
const blocks = events.flatMap((event) => event.message?.content ?? [])
const uses = blocks.filter((block) => block.type === 'tool_use')
const db = new Database(join(home, '.orchestos/db.sqlite'), { readonly: true })
const rows = db
  .query(
    "SELECT id, files_read, read_audit_json FROM runs WHERE task_class='chat' AND provider='claude'",
  )
  .all() as { id: string; files_read: string | null; read_audit_json: string }[]
assert.equal(rows.length, 1)
const row = rows[0]!
const audit = JSON.parse(row.read_audit_json)
const currentParser = new ClaudeReadAudit()
for (const event of events) currentParser.event(event)
assert.deepEqual(
  currentParser.finish(),
  audit,
  'Current parser must reproduce the persisted live audit',
)
assert.equal(audit.version, 1)
assert.equal(audit.source, 'claude-stream')
assert.equal(audit.completeness, 'complete')
assert.equal(audit.coverage, 'explicit-tools-only')
assert.deepEqual(audit.issues, [])
assert.equal(audit.operations.length, 8)
assert.equal(uses.length, 8)
const directReads: string[] = []
for (const use of uses) {
  const results = blocks.filter(
    (block) => block.type === 'tool_result' && block.tool_use_id === use.id,
  )
  assert.equal(results.length, 1)
  const matched = audit.operations.filter((op: { callId: string }) => op.callId === use.id)
  assert.equal(matched.length, 1)
  const operation = matched[0]
  assert.equal(operation.tool, use.name)
  assert.equal(operation.requestedPath, use.input.file_path ?? use.input.path ?? '.')
  assert.equal(operation.resultObserved, true)
  assert.equal(operation.outcome, results[0].is_error === true ? 'rejected' : 'succeeded')
  assert.equal(
    operation.kind,
    use.name === 'Read' ? 'read' : use.name === 'Grep' ? 'search' : 'list',
  )
  if (use.name === 'Read' && results[0].is_error !== true) directReads.push(use.input.file_path)
}
assert.deepEqual(JSON.parse(row.files_read!), [...new Set(directReads)])
assert.equal(directReads.length, 1)
assert(!/INSIDE_REVIEW_74219|OUTSIDE_REVIEW_85321|PREFIX_REVIEW_96432/.test(row.read_audit_json))
const portable = JSON.parse(JSON.stringify(audit).split(home).join('<fixture>'))
const report = {
  verifiedAt: new Date().toISOString(),
  runId: row.id,
  verdict: 'pass',
  transport: 'browser -> dashboard chat -> Claude -> SQLite -> Runs API',
  persistedAudit: portable,
  directReads: directReads.map((path) => path.split(home).join('<fixture>')),
  limits: 'Eight synthetic operations; implicit reads and crash durability not verified',
}
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
db.close()
console.log(`PASS: 8 persisted outcomes correlated; 1 successful direct read; report ${output}`)
