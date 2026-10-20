import { afterAll, beforeAll, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { runMigrations } from '../db/migrate.ts'
import { db } from '../db/sqlite.ts'
import {
  createApprovalRun,
  finishApprovalRun,
  pendingApprovals,
  resolveApproval,
} from '../run/approvals.ts'
import { CodexAppServer } from '../run/executors/codex-app-server.ts'

const ids: string[] = []
beforeAll(() => runMigrations())
afterAll(() => {
  for (const id of ids) db.run('DELETE FROM approval_runs WHERE id = ?', [id])
})
function fixture(die = false) {
  const id = randomUUID()
  ids.push(id)
  const adapter = createApprovalRun(id, 'task', null, 'auto-edit')
  const child = new EventEmitter() as any
  child.stdin = new PassThrough()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = () => {
    child.emit('exit', 0, null)
    return true
  }
  const calls: any[] = []
  const responses: any[] = []
  const emit = (msg: unknown) => child.stdout.write(`${JSON.stringify(msg)}\n`)
  let buffer = ''
  child.stdin.on('data', (data: Buffer) => {
    buffer += String(data)
    for (;;) {
      const nl = buffer.indexOf('\n')
      if (nl < 0) break
      const req = JSON.parse(buffer.slice(0, nl))
      buffer = buffer.slice(nl + 1)
      calls.push(req)
      const reply = (result: unknown) => emit({ id: req.id, result })
      if (req.method === 'initialize') reply({})
      if (req.method === 'thread/start') reply({ thread: { id: 'thread' }, model: 'gpt-6-sol' })
      if (req.method === 'turn/start') {
        reply({ turn: { id: 'turn' } })
        queueMicrotask(() => {
          emit({
            method: 'item/started',
            params: {
              threadId: 'thread',
              turnId: 'turn',
              item: {
                id: 'patch',
                type: 'fileChange',
                changes: [
                  {
                    path: '/tmp/edit.txt',
                    kind: { type: 'update', move_path: null },
                    diff: '-before\n+after',
                  },
                ],
              },
            },
          })
          emit({
            method: 'item/fileChange/requestApproval',
            id: 900,
            params: {
              threadId: 'thread',
              turnId: 'turn',
              itemId: 'patch',
              startedAtMs: 1,
              reason: null,
              grantRoot: null,
            },
          })
        })
      }
      if (req.id === 900 && req.result) {
        responses.push(req)
        emit({
          method: 'item/commandExecution/requestApproval',
          id: 901,
          params: {
            threadId: 'thread',
            turnId: 'turn',
            itemId: 'cmd',
            startedAtMs: 2,
            command: "/bin/zsh -lc 'mkdir command-marker'",
            cwd: '/tmp',
            commandActions: [{ type: 'unknown', command: 'mkdir command-marker' }],
          },
        })
        if (die) queueMicrotask(() => child.emit('exit', 1, null))
      }
      if (req.id === 901 && req.result) {
        responses.push(req)
        emit({
          method: 'thread/tokenUsage/updated',
          params: {
            threadId: 'thread',
            turnId: 'turn',
            tokenUsage: { last: { inputTokens: 10, outputTokens: 3, cachedInputTokens: 2 } },
          },
        })
        emit({
          method: 'turn/completed',
          params: { threadId: 'thread', turn: { id: 'turn', status: 'completed' } },
        })
      }
    }
  })
  const server = new CodexAppServer({
    binary: 'fake',
    env: {},
    store: { get: () => ({ threadId: null, contextHash: null }), set: () => {} },
    spawnProcess: () => child,
  })
  const run = server
    .taskTurn({
      cwd: '/tmp',
      prompt: 'edit and mkdir',
      model: 'gpt-6-sol',
      timeoutMs: 2000,
      approvals: adapter,
    })
    .finally(() => finishApprovalRun(id))
  return { id, run, calls, responses }
}
for (const decision of ['approve', 'reject'] as const)
  test(`task app-server: automatic patch, command ${decision}, verified JSON-RPC reply`, async () => {
    const f = fixture()
    for (let i = 0; i < 100 && !pendingApprovals(f.id).length; i++)
      await new Promise((r) => setTimeout(r, 5))
    const pending = pendingApprovals(f.id)
    expect(pending).toHaveLength(1)
    expect(pending[0]!.kind).toBe('command')
    expect(pending[0]!.detail.command).toContain('mkdir command-marker')
    resolveApproval(f.id, pending[0]!.approvalId, decision)
    const outcome = await f.run
    expect(outcome.inputTokens).toBe(8)
    expect(f.responses.map((r) => r.result.decision)).toEqual([
      'accept',
      decision === 'approve' ? 'accept' : 'decline',
    ])
    expect(f.calls.find((r) => r.method === 'thread/start').params).toMatchObject({
      approvalPolicy: 'untrusted',
      sandbox: 'workspace-write',
    })
    expect(f.calls.find((r) => r.method === 'turn/start').params.approvalPolicy).toBe('untrusted')
    expect(pendingApprovals(f.id)).toEqual([])
  })
test('CLI exits with a pending action: turn rejects and pending resolves reject', async () => {
  const f = fixture(true)
  await expect(f.run).rejects.toThrow('app-server exited')
  expect(pendingApprovals(f.id)).toEqual([])
  expect(
    db
      .query<{ decision: string }, [string]>(
        "SELECT decision FROM action_approvals WHERE run_id = ? AND decision = 'reject'",
      )
      .all(f.id),
  ).toHaveLength(1)
})
