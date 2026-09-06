// Verifies captured real tool outcomes; never uses the assistant's claims as a gate.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const [evidence, output] = process.argv.slice(2)
if (!evidence || !output) throw new Error('Usage: verify-read-boundary <capture-dir> <report.json>')
const fixture = JSON.parse(readFileSync(join(evidence, 'fixture.json'), 'utf8'))
const home = realpathSync(fixture.home)
const events = readFileSync(join(evidence, 'stream-1.ndjson'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
const init = events.find((event) => event.type === 'system' && event.subtype === 'init')
assert.deepEqual([...init.tools].sort(), ['Glob', 'Grep', 'Read'])
assert.deepEqual(init.mcp_servers, [])
const blocks = events.flatMap((event) => event.message?.content ?? [])
const uses = blocks.filter((block) => block.type === 'tool_use')
assert.equal(uses.length, 8, 'All eight fixture operations must execute')
const expected = new Map([
  ['Read:project/inside.txt', false],
  ['Read:outside.txt', true],
  ['Read:project/link.txt', true],
  ['Read:project-evil/secret.txt', true],
  ['Grep:', true],
  ['Glob:', true],
  ['Grep:project', false],
  ['Glob:project', false],
])
const results = uses.map((use) => {
  const path = relative(home, use.input.file_path ?? use.input.path)
  const key = `${use.name}:${path}`
  assert(expected.has(key), `Unexpected or duplicate operation: ${key}`)
  const matches = blocks.filter((b) => b.type === 'tool_result' && b.tool_use_id === use.id)
  assert.equal(matches.length, 1, `Missing or ambiguous result: ${use.id}`)
  const result = matches[0]
  assert.equal(result.is_error === true, expected.get(key), key)
  const content =
    typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
  assert(!/OUTSIDE_REVIEW_85321|PREFIX_REVIEW_96432/.test(content), 'External content leaked')
  if (key === 'Read:project/inside.txt') assert(content.includes('INSIDE_REVIEW_74219'))
  expected.delete(key)
  return {
    toolUseId: use.id,
    tool: use.name,
    path,
    rejected: result.is_error === true,
    content: content.split(home).join('<fixture>'),
  }
})
assert.equal(expected.size, 0)
const report = {
  verifiedAt: new Date().toISOString(),
  transport: 'dashboard browser -> /api/chat -> Claude Code',
  cliVersion: init.claude_code_version,
  tools: init.tools,
  mcpServers: init.mcp_servers,
  results,
  verdict: 'pass',
  scope: 'Eight synthetic tool operations; not a full filesystem sandbox audit',
}
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(`PASS: ${results.length} correlated tool results; report ${output}`)
