import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiRunsRevert, runRecordToRow } from '../dashboard/handlers/runs.ts'
import { getRun, insertRun } from '../db/runs.ts'
import { db } from '../db/sqlite.ts'
import { createWorktree, git, mergeWorktreeBack } from '../run/sandbox.ts'

const roots: string[] = []
const runIds: string[] = []
const projectIds = [`revert-p-${randomUUID()}`, `revert-other-${randomUUID()}`]
const [P, OTHER] = projectIds as [string, string]

beforeAll(async () => {
  await (await import('../db/migrate.ts')).runMigrations()
  for (const id of projectIds)
    db.run(
      "INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, '{}', '', ?)",
      [id, `/tmp/${id}`, new Date().toISOString()],
    )
})
afterAll(() => {
  for (const id of runIds) db.run('DELETE FROM runs WHERE id = ?', [id])
  for (const id of projectIds) db.run('DELETE FROM projects WHERE id = ?', [id])
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function makeRepo(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-revert-')))
  roots.push(root)
  git(['init', '-b', 'master'], root)
  git(['config', 'user.name', 'fixture'], root)
  git(['config', 'user.email', 'fixture@invalid'], root)
  git(['config', 'commit.gpgsign', 'false'], root)
  writeFileSync(join(root, 'a.txt'), 'uno\ndos\ntres\n')
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  git(['add', '-A'], root)
  git(['commit', '-m', 'base'], root)
  return root
}

/** Aplica una tarea como lo hace el harness: worktree → merge-back. Devuelve el SHA. */
function applyTask(root: string, taskId: string, file: string, content: string): string | null {
  const wt = createWorktree(taskId, 'master', root)
  writeFileSync(join(wt.path, file), content)
  return mergeWorktreeBack(wt, 'commit', `orchestos(${taskId}): cambio`)
}

function addRun(projectId: string | null, taskId: string, sha: string | null, status = 'done') {
  const id = insertRun({
    project_id: projectId,
    prompt: 'test',
    task_class: 'test',
    model: 'm',
    provider: P,
    skill_id: null,
    task_id: taskId,
    allowed_outputs: null,
    files_attempted: null,
    files_authorized: null,
    files_blocked: null,
    snapshot_before: null,
    snapshot_after: null,
    qa_verdict: null,
    qa_reason: null,
    status: status as 'done',
    input_tokens: 0,
    output_tokens: 0,
    usd_cost: 0,
    elapsed_ms: 0,
    result: null,
    commit_sha: sha,
  })
  runIds.push(id)
  return id
}

function revert(id: string, projectId: string | null, root: string) {
  return handleApiRunsRevert(new URL(`http://x/api/runs/${id}/revert`), { id: projectId, root })
}

const head = (root: string) => git(['rev-parse', 'HEAD'], root).stdout

describe('commit_sha al aplicar una tarea (ERP.7.2a)', () => {
  test('mergeWorktreeBack devuelve HEAD y el run lo guarda', () => {
    const root = makeRepo()
    const sha = applyTask(root, 't-sha', 'b.txt', 'nuevo\n')
    expect(sha).toBe(head(root))
    const id = addRun(P, 't-sha', sha)
    expect(runRecordToRow(getRun(id)!).commitSha).toBe(sha)
  })

  test('con rebase devuelve el SHA reescrito, no el original', () => {
    const root = makeRepo()
    const wt = createWorktree('t-rebase', 'master', root)
    writeFileSync(join(wt.path, 'b.txt'), 'tarea\n')
    writeFileSync(join(root, 'c.txt'), 'otro\n')
    git(['add', 'c.txt'], root)
    git(['commit', '-m', 'avance de la rama'], root)
    const sha = mergeWorktreeBack(wt, 'commit', 'orchestos(t-rebase): cambio')
    expect(sha).toBe(head(root))
    expect(git(['log', '-1', '--format=%s'], root).stdout).toBe('orchestos(t-rebase): cambio')
    expect(git(['log', '-2', '--format=%s'], root).stdout).toContain('avance de la rama')
  })

  test('sin cambios devuelve null', () => {
    const root = makeRepo()
    const wt = createWorktree('t-null', 'master', root)
    expect(mergeWorktreeBack(wt, 'commit', 'orchestos(t-null): nada')).toBeNull()
  })
})

describe('POST /api/runs/:id/revert (ERP.7.2a)', () => {
  test('revert limpio: restaura el archivo, crea el commit y guarda reverted_sha', async () => {
    const root = makeRepo()
    const sha = applyTask(root, 't-ok', 'a.txt', 'uno\nDOS\ntres\n')
    const id = addRun(P, 't-ok', sha)
    const res = revert(id, P, root)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; revertedSha: string }
    expect(body.ok).toBe(true)
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('uno\ndos\ntres\n')
    expect(git(['log', '-1', '--format=%s'], root).stdout).toBe('orchestos(t-ok): deshacer')
    expect(body.revertedSha).toBe(head(root))
    const saved = getRun(id)!
    expect(saved.reverted_sha).toBe(body.revertedSha)
    expect(saved.reverted_at).toBeTruthy()
    expect(runRecordToRow(saved).revertedSha).toBe(body.revertedSha)
  })

  test('segundo revert del mismo run → 409', () => {
    const root = makeRepo()
    const id = addRun(P, 't-twice', applyTask(root, 't-twice', 'b.txt', 'x\n'))
    expect(revert(id, P, root).status).toBe(200)
    const before = head(root)
    expect(revert(id, P, root).status).toBe(409)
    expect(head(root)).toBe(before)
  })

  test('árbol sucio → 409 con dirtyFiles y sin commit nuevo', async () => {
    const root = makeRepo()
    const id = addRun(P, 't-dirty', applyTask(root, 't-dirty', 'b.txt', 'x\n'))
    writeFileSync(join(root, 'sucio.txt'), 'x')
    const before = head(root)
    const res = revert(id, P, root)
    expect(res.status).toBe(409)
    expect(((await res.json()) as { dirtyFiles: string[] }).dirtyFiles).toEqual(['sucio.txt'])
    expect(head(root)).toBe(before)
  })

  test('conflicto → 409 con conflictFiles, HEAD intacto y sin REVERT_HEAD', async () => {
    const root = makeRepo()
    const id = addRun(P, 't-conf', applyTask(root, 't-conf', 'a.txt', 'uno\nDOS\ntres\n'))
    writeFileSync(join(root, 'a.txt'), 'uno\nOTRO\ntres\n')
    git(['commit', '-am', 'toca la misma línea'], root)
    const before = head(root)
    const res = revert(id, P, root)
    expect(res.status).toBe(409)
    expect(((await res.json()) as { conflictFiles: string[] }).conflictFiles).toEqual(['a.txt'])
    expect(head(root)).toBe(before)
    expect(existsSync(join(root, '.git', 'REVERT_HEAD'))).toBe(false)
    expect(git(['status', '--porcelain'], root).stdout).toBe('')
    expect(getRun(id)!.reverted_sha).toBeNull()
  })

  test('run de otro proyecto → 404; sin commit_sha → 409; no exitoso → 409', () => {
    const root = makeRepo()
    const other = addRun(OTHER, 't-other', applyTask(root, 't-other', 'b.txt', 'x\n'))
    expect(revert(other, P, root).status).toBe(404)
    expect(revert(randomUUID(), P, root).status).toBe(404)
    expect(revert(addRun(P, 't-nosha', null), P, root).status).toBe(409)
    expect(revert(addRun(P, 't-failed', head(root), 'failed'), P, root).status).toBe(409)
  })

  test('commit_sha que no es ancestro de HEAD → 409', () => {
    const root = makeRepo()
    const id = addRun(P, 't-anc', '0123456789abcdef0123456789abcdef01234567')
    expect(revert(id, P, root).status).toBe(409)
  })
})
