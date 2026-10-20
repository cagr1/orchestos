import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiRunApproval } from '../dashboard/handlers/runs.ts'
import { route } from '../dashboard/server.ts'
import { runMigrations } from '../db/migrate.ts'
import { db } from '../db/sqlite.ts'
import {
  type ApprovalMode,
  type ApprovalRequest,
  approvalEvents,
  approvalPathWithin,
  createApprovalRun,
  decideApproval,
  finishApprovalRun,
  getApprovalRun,
  pendingApprovals,
  resolveApproval,
} from '../run/approvals.ts'
import { codexApprovalRequest, codexCommandKey } from '../run/executors/codex-approval.ts'
import { validateTask } from '../tasks/schema.ts'

const ids: string[] = []
beforeAll(() => runMigrations())
afterAll(() => {
  for (const id of ids) db.run('DELETE FROM approval_runs WHERE id = ?', [id])
})
function session(mode: ApprovalMode = 'supervised', projectId: string | null = null) {
  const id = randomUUID()
  ids.push(id)
  return { id, adapter: createApprovalRun(id, `task-${id}`, projectId, mode) }
}
const command: ApprovalRequest = {
  kind: 'command',
  detail: { command: 'bun test' },
  commandKey: 'bun test',
}
const edit = (withinProject: boolean): ApprovalRequest => ({
  kind: 'edit',
  detail: { files: ['a'] },
  withinProject,
})
const wait = () => new Promise((resolve) => setTimeout(resolve, 110))

for (const mode of ['full', 'auto-edit', 'supervised'] as const) {
  for (const kind of ['command', 'edit'] as const) {
    for (const withinProject of [true, false]) {
      for (const always of [true, false]) {
        test(`policy ${mode} ${kind} inside=${withinProject} always=${always}`, () => {
          const request = kind === 'edit' ? edit(withinProject) : command
          const grants = new Set(always ? ['edit', 'command:bun test'] : [])
          const allowed =
            mode === 'full' ||
            (kind === 'edit' ? withinProject && (mode === 'auto-edit' || always) : always)
          expect(decideApproval(mode, request, grants)).toBe(allowed ? 'auto-approve' : 'ask')
          if (kind === 'command')
            expect(decideApproval(mode, { ...request, readOnly: true }, new Set())).toBe(
              'auto-approve',
            )
        })
      }
    }
  }
}

describe('durable approval adapter', () => {
  test('pending survives a read/reload; approve, reject, duplicate and foreign IDs', async () => {
    const { id, adapter } = session()
    const first = adapter.requestApproval(command)
    const pending = pendingApprovals(id)
    expect(pending).toHaveLength(1)
    expect(pendingApprovals(id)).toEqual(pending)
    expect(resolveApproval(id, 'foreign', 'approve')).toBeNull()
    expect(resolveApproval(id, pending[0]!.approvalId, 'approve')).toEqual({ scope: 'once' })
    expect(resolveApproval(id, pending[0]!.approvalId, 'approve')).toBeNull()
    expect(await first).toBe('approve')
    const second = adapter.requestApproval(command)
    resolveApproval(id, pendingApprovals(id)[0]!.approvalId, 'reject')
    expect(await second).toBe('reject')
    expect(approvalEvents(id).map((e: any) => e.type)).toEqual([
      'approval_requested',
      'approval_resolved',
      'approval_requested',
      'approval_resolved',
    ])
    finishApprovalRun(id)
  })
  test('approve-always exact match; watch asks; grants never cross runs', async () => {
    const { id, adapter } = session()
    const first = adapter.requestApproval(command)
    expect(resolveApproval(id, pendingApprovals(id)[0]!.approvalId, 'approve-always')).toEqual({
      scope: 'task',
    })
    expect(await first).toBe('approve')
    expect(await adapter.requestApproval(command)).toBe('approve')
    expect(pendingApprovals(id)).toHaveLength(0)
    const watch = adapter.requestApproval({ ...command, commandKey: 'bun test --watch' })
    expect(pendingApprovals(id)).toHaveLength(1)
    finishApprovalRun(id)
    expect(await watch).toBe('reject')
    expect(await adapter.requestApproval(command)).toBe('reject')
    const other = session()
    const ungranted = other.adapter.requestApproval(command)
    expect(pendingApprovals(other.id)).toHaveLength(1)
    finishApprovalRun(other.id)
    expect(await ungranted).toBe('reject')
  })
  test('unidentifiable wrapper gets once; edit grants never cover external paths', async () => {
    const { id, adapter } = session()
    const first = adapter.requestApproval({ ...command, commandKey: undefined })
    expect(resolveApproval(id, pendingApprovals(id)[0]!.approvalId, 'approve-always')).toEqual({
      scope: 'once',
    })
    expect(await first).toBe('approve')
    const inside = adapter.requestApproval(edit(true))
    resolveApproval(id, pendingApprovals(id)[0]!.approvalId, 'approve-always')
    expect(await inside).toBe('approve')
    expect(await adapter.requestApproval(edit(true))).toBe('approve')
    const outside = adapter.requestApproval(edit(false))
    expect(resolveApproval(id, pendingApprovals(id)[0]!.approvalId, 'approve-always')).toEqual({
      scope: 'once',
    })
    expect(await outside).toBe('approve')
    const outsideAgain = adapter.requestApproval(edit(false))
    finishApprovalRun(id)
    expect(await outsideAgain).toBe('reject')
  })
  test('automatic decisions are persisted without requested events', async () => {
    const { id, adapter } = session('auto-edit')
    expect(await adapter.requestApproval(edit(true))).toBe('approve')
    expect(approvalEvents(id)).toEqual([
      expect.objectContaining({ type: 'approval_resolved', decision: 'auto' }),
    ])
    finishApprovalRun(id)
  })
  test('dead owner rejects pending; finish is idempotent', async () => {
    const { id, adapter } = session()
    const pending = adapter.requestApproval(command)
    db.run('UPDATE approval_runs SET owner_pid = ? WHERE id = ?', [2147483647, id])
    expect(getApprovalRun(id)?.active).toBe(0)
    expect(await pending).toBe('reject')
    finishApprovalRun(id)
    expect(approvalEvents(id)).toHaveLength(2)
  })
})

test('endpoint: project isolation, unknown run, invalid JSON/body, foreign/resolved IDs and persisted GET', async () => {
  const { id, adapter } = session()
  async function api(runId: string, body?: unknown, project: string | null = null) {
    const url = new URL(`http://localhost/api/runs/${runId}/approval`)
    return handleApiRunApproval(
      new Request(url, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      url,
      project,
    )
  }
  expect((await api('missing')).status).toBe(404)
  expect((await api(id, undefined, 'other')).status).toBe(404)
  expect((await api(id, null)).status).toBe(400)
  expect((await api(id, { approvalId: 'x', decision: 'yes' })).status).toBe(400)
  const response = adapter.requestApproval(command)
  const { pending } = (await (await api(id)).json()) as any
  const other = session()
  expect(
    (await api(other.id, { approvalId: pending[0].approvalId, decision: 'approve' })).status,
  ).toBe(409)
  expect((await api(id, { approvalId: pending[0].approvalId, decision: 'approve' })).status).toBe(
    200,
  )
  expect(await response).toBe('approve')
  expect((await api(id, { approvalId: pending[0].approvalId, decision: 'reject' })).status).toBe(
    409,
  )
  finishApprovalRun(id)
  finishApprovalRun(other.id)
})

test('classification and patch paths use verified Codex event shapes, including renames', () => {
  for (const type of ['read', 'search', 'listFiles']) {
    expect(
      codexApprovalRequest(
        'item/commandExecution/requestApproval',
        { command: "/bin/zsh -lc 'cat a'", commandActions: [{ type }] },
        null,
        '/tmp',
      ).readOnly,
    ).toBe(true)
  }
  for (const commandActions of [
    null,
    [],
    [{ type: 'unknown' }],
    [{ type: 'read' }, { type: 'unknown' }],
  ]) {
    expect(
      codexApprovalRequest(
        'item/commandExecution/requestApproval',
        { commandActions },
        null,
        '/tmp',
      ).readOnly,
    ).toBe(false)
  }
  const root = mkdtempSync(join(tmpdir(), 'approval-path-'))
  try {
    mkdirSync(join(root, 'inside'))
    symlinkSync(tmpdir(), join(root, 'escape'))
    expect(approvalPathWithin(root, 'inside/new.txt')).toBe(true)
    expect(approvalPathWithin(root, 'escape/new.txt')).toBe(false)
    expect(approvalPathWithin(root, '../outside')).toBe(false)
    const request = codexApprovalRequest(
      'item/fileChange/requestApproval',
      {},
      {
        changes: [
          {
            path: join(root, 'a'),
            kind: { type: 'update', move_path: '/outside' },
            diff: '-a\n+b',
          },
        ],
      },
      root,
    )
    expect(request.withinProject).toBe(false)
    expect(request.detail.diff).toContain('-a\n+b')
    expect(
      codexApprovalRequest('item/fileChange/requestApproval', {}, null, root).withinProject,
    ).toBe(false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('shell wrapper decodes exact verified single-quote escaping and fails closed', () => {
  expect(codexCommandKey("/bin/zsh -lc 'bun test'")).toBe('bun test')
  expect(codexCommandKey("/bin/sh -c '  bun test  '")).toBe('bun test')
  expect(codexCommandKey("/bin/zsh -lc 'echo '\\''hello'\\'''")).toBe("echo 'hello'")
  expect(codexCommandKey('/bin/zsh -lc "bun test"')).toBe('/bin/zsh -lc "bun test"')
})

test('command grants and read-only auto-approval use the complete shell command', () => {
  const grant = new Set(['command:bun test'])
  const request = (command: string, commandActions: unknown) =>
    codexApprovalRequest(
      'item/commandExecution/requestApproval',
      { command, commandActions },
      null,
      '/tmp',
    )
  const decision = (command: string, actions: unknown) =>
    decideApproval('supervised', request(command, actions), grant)
  const read = [{ type: 'read', command: 'bun test' }]

  expect(
    decision("/bin/zsh -lc 'bun test; rm -rf x'", [{ type: 'unknown', command: 'bun test' }]),
  ).toBe('ask')
  expect(decision("/bin/zsh -lc 'bun test && curl example.invalid'", read)).toBe('ask')
  expect(request("/bin/zsh -lc 'cat a; rm b'", [{ type: 'read' }]).readOnly).toBe(false)
  expect(decision("/bin/zsh -lc 'cat a'", [{ type: 'read' }])).toBe('auto-approve')
  expect(decision("/bin/zsh -lc 'rg foo | head'", [{ type: 'read' }])).toBe('ask')
})

test('task approvalMode stays optional and rejects invalid modes', async () => {
  const task = { id: 'fixture', description: 'fixture', output: ['a'] }
  expect(validateTask(task, 0).approvalMode).toBeUndefined()
  expect(validateTask({ ...task, approvalMode: 'auto-edit' }, 0).approvalMode).toBe('auto-edit')
  expect(() => validateTask({ ...task, approvalMode: 'accept-all' }, 0)).toThrow('approvalMode')
  await wait()
})

test('approval POST retains the shared CSRF rejection before routing', async () => {
  const response = await route(
    new Request('http://localhost:4242/api/runs/missing/approval', {
      method: 'POST',
      headers: { origin: 'https://foreign.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({ approvalId: 'x', decision: 'approve' }),
    }),
    4242,
  )
  expect(response.status).toBe(403)
})
