// This runs in a child process because sqlite.ts resolves its global DB on import.
import { expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function isolated(): Promise<{ statuses: number[]; blockedBy: string[]; readyC: boolean }> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-plan-api-'))
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        `
          const { execFileSync } = await import('node:child_process')
          const { mkdirSync, readFileSync, writeFileSync } = await import('node:fs')
          const { join } = await import('node:path')
          const { db } = await import('./src/db/sqlite.ts')
          const { runMigrations } = await import('./src/db/migrate.ts')
          const { importPlan } = await import('./scripts/plan-import.ts')
          const { route } = await import('./src/dashboard/server.ts')
          const home = process.env.ORCHESTOS_HOME
          const root = join(home, 'project')
          const plan = '# Fixture\\n\\n## Sprint One\\n### Block One\\n- [ ] **A — ⚡ First.**\\n  A body.\\n\\n- [ ] **B — ⚡ Blocked.**\\n  B body.\\n\\n## Sprint Two\\n### Block Two\\n- [ ] **C — 🔍 Ready.**\\n  C body.\\n'
          const assert = (condition, message) => { if (!condition) throw new Error(message) }
          mkdirSync(root)
          writeFileSync(join(root, 'PLAN.md'), plan, 'utf8')
          execFileSync('git', ['init'], { cwd: root, stdio: 'pipe' })
          execFileSync('git', ['add', 'PLAN.md'], { cwd: root, stdio: 'pipe' })
          execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture'], {
            cwd: root,
            stdio: 'pipe',
            env: { ...process.env, GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' },
          })
          runMigrations()
          importPlan(root, true)
          db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', ['fixture', root, '{}', '', new Date().toISOString()])
          const request = (path, init = {}) => route(new Request('http://localhost:3001' + path, { headers: { 'x-orchestos-project-id': 'fixture' }, ...init }), 3001)
          const status = async (path, init) => (await request(path, init)).status
          const put = (id, body) => status('/api/plan/items/' + id + '/dependencies', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-orchestos-project-id': 'fixture' }, body })
          const first = await request('/api/plan')
          const initial = await first.json()
          const a = initial.items.find((item) => item.id === 'A')
          const b = initial.items.find((item) => item.id === 'B')
          const c = initial.items.find((item) => item.id === 'C')
          assert(first.status === 200 && a.ready && b.ready && c.ready, 'initial GET did not return ready items')
          assert(await status('/api/plan') === 200, 'GET must be stable')
          writeFileSync(join(root, 'PLAN.md'), plan + '\\nchanged', 'utf8')
          assert(await status('/api/plan') === 409, 'desynchronized PLAN.md must be rejected')
          writeFileSync(join(root, 'PLAN.md'), plan, 'utf8')
          assert(await put('B', '{') === 400, 'invalid JSON must be 400')
          assert(await put('B', JSON.stringify({})) === 400, 'missing dependsOn must be 400')
          assert(await put('B', JSON.stringify({ dependsOn: 'A' })) === 400, 'non-array dependsOn must be 400')
          assert(await put('B', JSON.stringify({ dependsOn: ['A', 'A'] })) === 400, 'duplicate dependency must be 400')
          assert(await put('A%2FB', JSON.stringify({ dependsOn: [] })) === 400, 'invalid URL id must be 400')
          assert(await put('A'.repeat(100), JSON.stringify({ dependsOn: [] })) === 400, 'long URL id must be 400')
          assert(await put('Z', JSON.stringify({ dependsOn: [] })) === 404, 'missing item must be 404')
          assert(await put('B', JSON.stringify({ dependsOn: ['Z'] })) === 404, 'missing dependency must be 404')
          assert(await put('B', JSON.stringify({ dependsOn: ['B'] })) === 409, 'self dependency must be 409')
          assert(await put('B', JSON.stringify({ dependsOn: ['A'] })) === 200, 'valid dependency must succeed')
          const afterDependency = await (await request('/api/plan')).json()
          const blockedB = afterDependency.items.find((item) => item.id === 'B')
          assert(blockedB.dependsOn.join() === 'A' && blockedB.blockedBy.join() === 'A' && !blockedB.ready, 'GET must enrich blocked B')
          assert(await put('A', JSON.stringify({ dependsOn: ['B'] })) === 409, 'transitive cycle must be 409')
          assert(await status('/api/plan/items/B/prepare-close', { method: 'POST', headers: { 'x-orchestos-project-id': 'fixture' } }) === 409, 'blocked close must be 409')
          const beforeClose = readFileSync(join(root, 'PLAN.md'), 'utf8')
          const close = await request('/api/plan/items/A/prepare-close', { method: 'POST', headers: { 'x-orchestos-project-id': 'fixture' } })
          const closed = await close.json()
          const afterClose = readFileSync(join(root, 'PLAN.md'), 'utf8')
          const changed = beforeClose.split('\\n').filter((line, index) => line !== afterClose.split('\\n')[index])
          assert(close.status === 200 && closed.commitPending === true, 'ready close must be pending')
          assert(changed.length === 1 && changed[0].startsWith('- [ ] **A —') && afterClose.includes('- [x] **A —'), 'only A segment must change')
          const row = db.query('SELECT status, commit_sha FROM plan_items WHERE id = ?').get('A')
          assert(row.status === 'done' && row.commit_sha, 'closed row must have provisional SHA')
          assert(await status('/api/plan/items/A/prepare-close', { method: 'POST', headers: { 'x-orchestos-project-id': 'fixture' } }) === 409, 'done close must be 409')
          assert(await put('A', JSON.stringify({ dependsOn: [] })) === 409, 'done dependency mutation must be 409')
          console.log(JSON.stringify({ statuses: [first.status, close.status], blockedBy: blockedB.blockedBy, readyC: c.ready }))
          db.close()
        `,
      ],
      { env: { ...process.env, ORCHESTOS_HOME: home }, stdout: 'pipe', stderr: 'pipe' },
    )
    const [code, out, err] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(code, err).toBe(0)
    return JSON.parse(out)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

it('exercises plan API routes in an isolated database fixture', async () => {
  const result = await isolated()
  expect(result.statuses).toEqual([200, 200])
  expect(result.blockedBy).toEqual(['A'])
  expect(result.readyC).toBe(true)
})
