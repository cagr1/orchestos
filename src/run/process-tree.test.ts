import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnTree, terminateTree } from './process-tree.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function root() {
  const dir = mkdtempSync(join(tmpdir(), 'aud22-tree-'))
  roots.push(dir)
  return dir
}
function gone(pid: number) {
  expect(() => process.kill(pid, 0)).toThrow('No such process')
}
test('terminateTree kills the child and grandchild', async () => {
  const dir = root()
  const script = join(dir, 'cli')
  writeFileSync(script, '#!/bin/sh\n/bin/sleep 300 &\necho $! > grandchild\nwait\n', {
    mode: 0o755,
  })
  const proc = spawnTree([script], { cwd: dir, stdout: 'ignore', stderr: 'ignore' })
  try {
    for (let i = 0; i < 100 && !Bun.file(join(dir, 'grandchild')).size; i++) await Bun.sleep(10)
    const pid = Number(readFileSync(join(dir, 'grandchild'), 'utf8'))
    await terminateTree(proc, 100)
    await Bun.sleep(100)
    gone(proc.pid)
    gone(pid)
  } finally {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {}
  }
})
test('exiting before graceMs still kills a grandchild that ignores SIGTERM', async () => {
  const dir = root()
  const script = join(dir, 'cli')
  writeFileSync(
    script,
    "#!/bin/sh\n(trap '' TERM; exec /bin/sleep 30) >/dev/null 2>&1 &\necho $!\nwait\n",
    {
      mode: 0o755,
    },
  )
  const tree = join(import.meta.dir, 'process-tree.ts')
  const code = `import { spawnTree, terminateTree } from ${JSON.stringify(tree)}
const p = spawnTree([${JSON.stringify(script)}], { stdout: 'pipe', stderr: 'ignore' })
const r = p.stdout.getReader(); const { value } = await r.read(); console.log(new TextDecoder().decode(value).trim())
await Bun.sleep(100); await terminateTree(p, 5000)`
  const out = Bun.spawnSync([process.execPath, '-e', code], { cwd: dir, timeout: 4000 })
  const pid = Number(out.stdout.toString().trim())
  expect(pid).toBeGreaterThan(0)
  await Bun.sleep(200)
  gone(pid)
})
test('terminateTree escalates when SIGTERM is ignored', async () => {
  const dir = root()
  const script = join(dir, 'cli')
  writeFileSync(
    script,
    "#!/bin/sh\ntrap '' TERM\necho ready > ready\nwhile :; do /bin/sleep 1; done\n",
    { mode: 0o755 },
  )
  const proc = spawnTree([script], { cwd: dir, stdout: 'ignore', stderr: 'ignore' })
  try {
    for (let i = 0; i < 100 && !Bun.file(join(dir, 'ready')).size; i++) await Bun.sleep(10)
    const start = Date.now()
    await terminateTree(proc, 100)
    expect(Date.now() - start).toBeLessThan(1100)
    gone(proc.pid)
  } finally {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {}
  }
})

test('terminateTree kills a grandchild that ignores SIGTERM after the leader exits', async () => {
  const dir = root()
  const script = join(dir, 'cli')
  writeFileSync(
    script,
    "#!/bin/sh\n(trap '' TERM; exec /bin/sleep 300) &\necho $! > grandchild\nwait\n",
    { mode: 0o755 },
  )
  const proc = spawnTree([script], { cwd: dir, stdout: 'ignore', stderr: 'ignore' })
  try {
    for (let i = 0; i < 100 && !Bun.file(join(dir, 'grandchild')).size; i++) await Bun.sleep(10)
    const pid = Number(readFileSync(join(dir, 'grandchild'), 'utf8'))
    await terminateTree(proc, 100)
    await Bun.sleep(300)
    gone(proc.pid)
    gone(pid)
  } finally {
    try {
      process.kill(-proc.pid, 'SIGKILL')
    } catch {}
  }
})
