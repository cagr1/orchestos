import { afterAll, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { db } from '../db/sqlite.ts'
import { handleMcpMessage, parseServerArgs } from '../mcp/server.ts'
import {
  approvalAdapterFor,
  createApprovalRun,
  finishApprovalRun,
  getApprovalRun,
  pendingApprovals,
  resolveApproval,
} from '../run/approvals.ts'
import { claudeApprovalRequest } from '../run/executors/claude-approval.ts'
import { KNOWN_CLIS } from '../run/executors/cli-registry.ts'
import { buildClaudeArgs, buildClaudeArgsDisplay } from '../run/executors/external.ts'

const root = mkdtempSync(join(tmpdir(), 'claude-approval-'))
const ids: string[] = []
afterAll(() => {
  for (const id of ids) {
    finishApprovalRun(id)
    db.run('DELETE FROM approval_runs WHERE id = ?', [id])
  }
  rmSync(root, { recursive: true, force: true })
})
function session(mode: 'auto-edit' | 'supervised' = 'supervised') {
  const id = randomUUID()
  ids.push(id)
  return createApprovalRun(id, `task-${id}`, null, mode)
}
async function waitForPendingApproval(runId: string) {
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    const pending = pendingApprovals(runId)
    if (pending.length === 1) return pending
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return pendingApprovals(runId)
}

test('Claude Edit/Write/MultiEdit/NotebookEdit map files and readable diffs; external/symlink/missing paths fail closed', () => {
  const edit = (file_path: string) =>
    claudeApprovalRequest(
      {
        tool_name: 'Edit',
        input: { file_path, old_string: 'before', new_string: 'after' },
      },
      root,
    )
  expect(edit(join(root, 'new.txt'))).toEqual({
    kind: 'edit',
    detail: { files: [join(root, 'new.txt')], diff: '-before\n+after' },
    withinProject: true,
  })
  expect(edit('../outside').withinProject).toBe(false)
  symlinkSync(tmpdir(), join(root, 'escape'))
  expect(edit('escape/outside').withinProject).toBe(false)
  expect(
    claudeApprovalRequest({ tool_name: 'Write', input: { content: 'hi' } }, root).withinProject,
  ).toBe(false)
  expect(
    claudeApprovalRequest({ tool_name: 'Write', input: { file_path: 'a', content: 'hi\n' } }, root),
  ).toMatchObject({ kind: 'edit', withinProject: true, detail: { diff: '+hi\n+' } })
  expect(
    claudeApprovalRequest(
      {
        tool_name: 'MultiEdit',
        input: { file_path: 'a', edits: [{ old_string: 'a', new_string: 'b' }] },
      },
      root,
    ).detail.diff,
  ).toBe('-a\n+b')
  expect(
    claudeApprovalRequest({ tool_name: 'NotebookEdit', input: { notebook_path: 'a.ipynb' } }, root),
  ).toMatchObject({ kind: 'edit', withinProject: true, detail: { files: ['a.ipynb'] } })
})

test('Bash identity is exact including whitespace and shell operators; unknown tools require approval', () => {
  const command = '  mkdir -p marker && echo hi; pwd  '
  expect(
    claudeApprovalRequest({ tool_name: 'Bash', input: { command, description: 'ignored' } }, root),
  ).toEqual({
    kind: 'command',
    commandKey: command,
    readOnly: false,
    detail: { command, cwd: root },
  })
  expect(claudeApprovalRequest({ tool_name: 'Unknown', input: { x: 1 } }, root)).toEqual({
    kind: 'command',
    readOnly: false,
    detail: { command: 'Unknown {"x":1}', cwd: root },
  })
})

test('reconnect an existing run without changing owner; external resolver unblocks it; missing/inactive run rejects without insertion', async () => {
  const run = session()
  const adapter = approvalAdapterFor(run.runId, run.mode)
  expect(adapter.runId).toBe(run.runId)
  expect(adapter.mode).toBe('supervised')
  expect(getApprovalRun(run.runId)?.owner_pid).toBe(process.pid)
  const response = adapter.requestApproval(
    claudeApprovalRequest({ tool_name: 'Bash', input: { command: 'mkdir marker' } }, root),
  )
  const pending = pendingApprovals(run.runId)
  expect(pending).toHaveLength(1)
  resolveApproval(run.runId, pending[0]!.approvalId, 'approve')
  expect(await response).toBe('approve')
  finishApprovalRun(run.runId)
  const request = { kind: 'command' as const, detail: { command: 'x' } }
  expect(await adapter.requestApproval(request)).toBe('reject')
  expect(await approvalAdapterFor('missing-run', 'auto-edit').requestApproval(request)).toBe(
    'reject',
  )
  expect(db.query('SELECT * FROM action_approvals WHERE run_id = ?').all('missing-run')).toEqual([])
})

for (const decision of ['approve', 'reject'] as const) {
  test(`MCP approve_action creates a durable request and ${decision} returns Claude's contract`, async () => {
    const run = session()
    const options = parseServerArgs([
      '--tools',
      'approve_action',
      '--root',
      root,
      '--approval-run',
      run.runId,
      '--approval-mode',
      run.mode,
    ])
    const input = { command: 'mkdir -p marker', description: 'fixture' }
    const response = handleMcpMessage(
      {
        id: 1,
        method: 'tools/call',
        params: {
          name: 'approve_action',
          arguments: { tool_name: 'Bash', input, tool_use_id: 'toolu_fixture' },
        },
      },
      options,
    )
    const pending = await waitForPendingApproval(run.runId)
    expect(pending).toHaveLength(1)
    resolveApproval(run.runId, pending[0]!.approvalId, decision)
    const reply = (await response) as any
    expect(reply.result.isError).toBe(false)
    expect(JSON.parse(reply.result.content[0].text)).toEqual(
      decision === 'approve'
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: 'Rejected in OrchestOS' },
    )
    finishApprovalRun(run.runId)
  })
}

test('MCP auto-edit approves inside the project without a pending request; malformed or unconfigured calls deny', async () => {
  const run = session('auto-edit')
  const options = {
    tools: ['approve_action'],
    root,
    approvalRun: run.runId,
    approvalMode: run.mode,
  }
  const message = {
    id: 2,
    method: 'tools/call',
    params: {
      name: 'approve_action',
      arguments: { tool_name: 'Write', input: { file_path: 'a', content: 'hi' } },
    },
  }
  const reply = (await handleMcpMessage(message, options)) as any
  expect(JSON.parse(reply.result.content[0].text).behavior).toBe('allow')
  expect(pendingApprovals(run.runId)).toEqual([])
  expect(db.query('SELECT decision FROM action_approvals WHERE run_id = ?').all(run.runId)).toEqual(
    [{ decision: 'auto' }],
  )
  const list = (await handleMcpMessage({ id: 3, method: 'tools/list' }, options)) as any
  expect(list.result.tools.map((tool: any) => tool.name)).toEqual(['approve_action'])
  for (const opts of [{ tools: ['approve_action'], root }, options]) {
    const denied = (await handleMcpMessage(
      { ...message, params: { ...message.params, arguments: null } },
      opts,
    )) as any
    expect(JSON.parse(denied.result.content[0].text).behavior).toBe('deny')
  }
  finishApprovalRun(run.runId)
})

test('full arguments are unchanged exactly; manual modes offer only approval MCP and preapprove only reads', () => {
  const full = [
    '-p',
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--append-system-prompt',
    'prompt',
    '--allowedTools',
    'Edit,Write,Read,Glob,Grep',
  ]
  expect(buildClaudeArgs('prompt')).toEqual(full)
  expect(
    buildClaudeArgs('prompt', undefined, undefined, false, undefined, { runId: 'r', mode: 'full' }),
  ).toEqual(full)
  for (const mode of ['auto-edit', 'supervised'] as const) {
    const adapter = { runId: 'r', mode }
    const args = buildClaudeArgs(
      'prompt',
      undefined,
      undefined,
      true,
      '/settings.json',
      adapter,
      root,
    )
    const flag = (name: string) => args[args.indexOf(name) + 1]
    expect(flag('--allowedTools')).toBe('Read,Glob,Grep')
    expect(args.filter((value) => value === '--allowedTools')).toHaveLength(1)
    expect(flag('--permission-mode')).toBe('manual')
    expect(flag('--tools')).toBe('Bash,Read,Glob,Grep,Edit,Write,MultiEdit')
    expect(flag('--settings')).toBe('/settings.json')
    expect(args).toContain('--restricted')
    expect(args).toContain('--strict-mcp-config')
    expect(flag('--permission-prompt-tool')).toBe('mcp__orchestos__approve_action')
    expect(JSON.parse(flag('--mcp-config')!).mcpServers).toEqual({
      orchestos: {
        command: process.execPath,
        args: [
          join(import.meta.dir, '../mcp/server.ts'),
          '--tools',
          'approve_action',
          '--approval-run',
          'r',
          '--approval-mode',
          mode,
          '--root',
          root,
        ],
      },
    })
    expect(
      buildClaudeArgsDisplay(undefined, undefined, true, '/settings.json', adapter, root),
    ).toEqual(args.map((value) => (value === 'prompt' ? '<contract>' : value)))
  }
  expect(KNOWN_CLIS.find((cli) => cli.id === 'claude')?.supportsActionApproval).toBe(true)
  expect(KNOWN_CLIS.find((cli) => cli.id === 'opencode')?.supportsActionApproval).toBe(true)
})

test('MCP stdio child uses the existing harness run and shared DB; resolution from the parent releases the call', async () => {
  const run = session()
  const proc = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, '../mcp/server.ts'),
      '--tools',
      'approve_action',
      '--root',
      root,
      '--approval-run',
      run.runId,
      '--approval-mode',
      run.mode,
    ],
    {
      env: { ...process.env },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const output = new Response(proc.stdout).text()
  const stderr = new Response(proc.stderr).text()
  try {
    proc.stdin.write(
      `${JSON.stringify({
        id: 7,
        method: 'tools/call',
        params: {
          name: 'approve_action',
          arguments: { tool_name: 'Bash', input: { command: 'mkdir marker' } },
        },
      })}\n`,
    )
    proc.stdin.end()
    const deadline = Date.now() + 3000
    while (!pendingApprovals(run.runId).length && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 20))
    expect(pendingApprovals(run.runId)).toHaveLength(1)
    expect(getApprovalRun(run.runId)?.owner_pid).toBe(process.pid)
    resolveApproval(run.runId, pendingApprovals(run.runId)[0]!.approvalId, 'approve')
    expect(await proc.exited).toBe(0)
    expect(JSON.parse(JSON.parse((await output).trim()).result.content[0].text)).toEqual({
      behavior: 'allow',
      updatedInput: { command: 'mkdir marker' },
    })
    expect(await stderr).toBe('')
  } finally {
    proc.kill()
    finishApprovalRun(run.runId)
  }
})
