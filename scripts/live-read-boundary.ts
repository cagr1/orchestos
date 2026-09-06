// Run through gate:evidence. Uses only synthetic project/privacy fixtures.
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { route } from '../src/dashboard/server.ts'
import { runMigrations } from '../src/db/migrate.ts'
import { db } from '../src/db/sqlite.ts'

const home = process.env.ORCHESTOS_HOME
const evidence = process.env.REVIEW_EVIDENCE_DIR
if (!home || !evidence) throw new Error('Use gate:evidence and REVIEW_EVIDENCE_DIR')
mkdirSync(evidence, { recursive: true })
const root = join(home, 'project')
mkdirSync(root, { recursive: true })
mkdirSync(join(home, 'project-evil'))
writeFileSync(join(root, 'inside.txt'), 'INSIDE_REVIEW_74219')
writeFileSync(join(home, 'outside.txt'), 'OUTSIDE_REVIEW_85321')
writeFileSync(join(home, 'project-evil', 'secret.txt'), 'PREFIX_REVIEW_96432')
symlinkSync(join(home, 'outside.txt'), join(root, 'link.txt'))
writeFileSync(join(root, 'orchestos.config.yaml'), 'agent: claude\n')
runMigrations()
db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', [
  'review-boundary',
  realpathSync(root),
  '{}',
  '',
  new Date().toISOString(),
])
const spawn = Bun.spawn
let invocation = 0
Bun.spawn = ((...args: Parameters<typeof Bun.spawn>) => {
  const child = spawn(...args)
  const command = args[0] as unknown
  if (!Array.isArray(command) || !command.includes('--restricted')) return child
  const id = ++invocation
  writeFileSync(join(evidence, `command-${id}.json`), JSON.stringify(command))
  let raw = ''
  const decoder = new TextDecoder()
  const stdout = (child.stdout as ReadableStream<Uint8Array>).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        raw += decoder.decode(chunk, { stream: true })
        controller.enqueue(chunk)
      },
      flush() {
        raw += decoder.decode()
        writeFileSync(join(evidence, `stream-${id}.ndjson`), raw)
      },
    }),
  )
  return new Proxy(child, {
    get(target, prop) {
      if (prop === 'stdout') return stdout
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}) as typeof Bun.spawn
process.chdir(root)
const port = 50919
Bun.serve({ hostname: '127.0.0.1', port, fetch: (req) => route(req, port) })
writeFileSync(join(evidence, 'fixture.json'), JSON.stringify({ root, home, port }))
console.log(`Review dashboard http://localhost:${port}; evidence ${resolve(evidence)}`)
process.on('SIGTERM', () => {
  db.close()
  process.exit(0)
})
