import { describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type ApprovalAdapter, decideApproval } from '../run/approvals.ts'
import {
  type OpencodePermission,
  opencodeApprovalRequest,
} from '../run/executors/opencode-approval.ts'
import {
  type OpencodeServerProbe,
  opencodeMessagesToStream,
  runOpencodeServer,
} from '../run/executors/opencode-server.ts'
import { opencodeEventToStep } from '../run/executors/step-event.ts'

const cwd = tmpdir()
function permission(
  permission = 'bash',
  metadata: Record<string, unknown> = { command: 'mkdir one' },
): OpencodePermission {
  return { id: 'per_1', sessionID: 'ses_1', permission, patterns: ['mkdir *'], metadata }
}
const messages = [
  {
    info: { role: 'assistant', time: { completed: 1 } },
    parts: [
      { type: 'text', text: 'done' },
      {
        type: 'tool',
        tool: 'bash',
        state: { status: 'completed', title: 'mkdir one', input: { command: 'mkdir one' } },
      },
      { type: 'step-finish', cost: 0.03, tokens: { input: 20, output: 3 } },
    ],
  },
]

function fixture(
  options: {
    permissions?: OpencodePermission[]
    fail?: boolean
    hang?: boolean
    ignoreTerm?: boolean
    idleFirst?: boolean
    rejectAuth?: boolean
  } = {},
) {
  let exit!: (code: number) => void
  const exited = new Promise<number>((resolve) => {
    exit = resolve
  })
  const calls: Array<{ path: string; body?: any }> = []
  const kills: string[] = []
  let round = 0
  let polls = 0
  let authorization = ''
  const probe: OpencodeServerProbe = {
    spawn(binary, directory, env) {
      expect(binary).toBe('fake-opencode')
      expect(directory).toBe(cwd)
      expect(env.OPENCODE_SERVER_PASSWORD).toMatch(/^[a-f0-9]{64}$/)
      authorization = `Basic ${Buffer.from(`opencode:${env.OPENCODE_SERVER_PASSWORD}`).toString('base64')}`
      return {
        stdout: new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode('opencode server listening on http://127.0.0.1:1234\n'),
            )
            c.close()
          },
        }),
        stderr: new ReadableStream({
          start(c) {
            c.close()
          },
        }),
        exited,
        kill(signal) {
          kills.push(signal)
          if (!options.ignoreTerm || signal === 'SIGKILL') exit(0)
        },
      }
    },
    fetch: (async (url: string, init: RequestInit) => {
      const parsed = new URL(url)
      expect(parsed.searchParams.get('directory')).toBe(cwd)
      const path = parsed.pathname
      const body = init.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ path, body })
      if (new Headers(init.headers).get('Authorization') !== authorization || options.rejectAuth)
        return new Response('Unauthorized', { status: 401 })
      if (options.fail) return new Response('error', { status: 500 })
      if (options.hang) return new Promise(() => {})
      let value: unknown = true
      if (path === '/session') value = { id: 'ses_1' }
      if (path.endsWith('/prompt_async')) return new Response(null, { status: 204 })
      if (path === '/permission') value = round++ === 0 ? (options.permissions ?? []) : []
      if (path.endsWith('/message')) value = options.idleFirst && polls === 1 ? [] : messages
      if (path === '/session/status') {
        polls++
        value = { ses_1: { type: 'idle' } }
      }
      return Response.json(value)
    }) as typeof fetch,
  }
  const input = {
    binary: 'fake-opencode',
    cwd,
    prompt: 'contract',
    model: 'openrouter/provider/model',
    variant: 'high',
    timeoutMs: 3000,
    approvals: {
      runId: 'run_1',
      mode: 'auto-edit',
      requestApproval: async () => 'approve',
    } as ApprovalAdapter,
  }
  return { probe, input, calls, kills }
}

describe('OpenCode permission mapping', () => {
  it('maps edits within/outside the project and fails closed for missing paths', () => {
    for (const tool of ['edit', 'write', 'patch']) {
      expect(
        opencodeApprovalRequest(
          permission(tool, { filepath: join(cwd, 'note.txt'), diff: '-hi\n+bye' }),
          cwd,
        ),
      ).toEqual({
        kind: 'edit',
        detail: { files: [join(cwd, 'note.txt')], diff: '-hi\n+bye' },
        withinProject: true,
      })
      expect(
        opencodeApprovalRequest(permission(tool, { filepath: '/outside.txt' }), cwd).withinProject,
      ).toBe(false)
      expect(opencodeApprovalRequest(permission(tool, {}), cwd).withinProject).toBe(false)
    }
  })
  it('uses the complete bash command, including compound commands, as identity', () => {
    const command = 'git status && mkdir one'
    expect(opencodeApprovalRequest(permission('bash', { command }), cwd)).toEqual({
      kind: 'command',
      detail: { command, cwd },
      commandKey: command,
      readOnly: false,
    })
  })
  it('unknown permissions have no reusable identity', () => {
    expect(opencodeApprovalRequest(permission('network', {}), cwd)).toEqual({
      kind: 'command',
      detail: { command: 'network mkdir *', cwd },
      readOnly: false,
    })
  })
})

it('converts assistant stored parts into the existing text/tool/tokens/cost parser format', () => {
  const stream = opencodeMessagesToStream([
    { info: { role: 'user' }, parts: [{ type: 'text', text: 'secret prompt' }] },
    ...messages,
  ])
  expect(stream).not.toContain('secret prompt')
  const steps = stream.split('\n').flatMap((line) => opencodeEventToStep(JSON.parse(line)))
  expect(steps.map((step) => step.type)).toEqual(['text', 'tool_use', 'step_finish'])
  expect(steps[0]?.detail).toBe('done')
  expect(steps[1]?.ok).toBe(true)
  expect(steps[2]).toMatchObject({ costUsd: 0.03, tokens: { input: 20, output: 3 } })
})

it('keeps exact approve-always grants local, never sends always, ignores other sessions', async () => {
  const first = permission()
  const same = { ...first, id: 'per_2' }
  const other = { ...permission('bash', { command: 'mkdir two' }), id: 'per_3' }
  const f = fixture({
    permissions: [first, same, other, { ...first, id: 'foreign', sessionID: 'ses_other' }],
  })
  const grants = new Set<string>()
  let asked = 0
  f.input.approvals.requestApproval = async (request) => {
    if (decideApproval('supervised', request, grants) === 'auto-approve') return 'approve'
    asked++
    if (asked === 1) {
      grants.add(`command:${request.commandKey}`)
      return 'approve'
    }
    return 'reject'
  }
  await runOpencodeServer(f.input, f.probe)
  expect(asked).toBe(2)
  expect(
    f.calls.filter((call) => call.path.endsWith('/reply')).map((call) => call.body.reply),
  ).toEqual(['once', 'once', 'reject'])
  expect(f.calls.find((call) => call.path === '/session')?.body.permission).toEqual([
    { permission: '*', pattern: '*', action: 'ask' },
    ...['read', 'glob', 'grep', 'list'].map((permission) => ({
      permission,
      pattern: '*',
      action: 'allow',
    })),
  ])
  expect(f.calls.find((call) => call.path.endsWith('/prompt_async'))?.body).toEqual({
    model: { providerID: 'openrouter', modelID: 'provider/model' },
    variant: 'high',
    parts: [{ type: 'text', text: 'contract' }],
  })
  expect(f.kills).toEqual(['SIGTERM'])
})

it('does not finish at initial idle before a completed assistant message', async () => {
  const f = fixture({ idleFirst: true })
  await runOpencodeServer(f.input, f.probe)
  expect(f.calls.filter((call) => call.path === '/session/status')).toHaveLength(2)
})

it('authenticates every request with a fresh password for each server', async () => {
  const passwords: string[] = []
  for (let i = 0; i < 2; i++) {
    const f = fixture({ permissions: [permission()] })
    const spawn = f.probe.spawn
    f.probe.spawn = (binary, directory, env) => {
      passwords.push(env.OPENCODE_SERVER_PASSWORD!)
      return spawn(binary, directory, env)
    }
    const fetch = f.probe.fetch
    f.probe.fetch = async (url, init) => {
      const unauthenticated = await fetch(url, { ...init, headers: {} })
      expect(unauthenticated.status).toBe(401)
      const authenticated = await fetch(url, init)
      expect(authenticated.ok).toBe(true)
      return authenticated
    }
    await runOpencodeServer(f.input, f.probe)
  }
  expect(passwords[0]).not.toBe(passwords[1])
})

it('reports authentication failure clearly and stops the server', async () => {
  const f = fixture({ rejectAuth: true })
  await expect(runOpencodeServer(f.input, f.probe)).rejects.toThrow('OpenCode /session: HTTP 401')
  expect(f.kills).toEqual(['SIGTERM'])
})

it('reads final history after idle and includes the final text and both costs', async () => {
  const f = fixture()
  const fetch = f.probe.fetch
  let statusPolls = 0
  f.probe.fetch = async (url, init) => {
    const response = await fetch(url, init)
    const path = new URL(String(url)).pathname
    if (path === '/session/status') {
      statusPolls++
      return Response.json({ ses_1: { type: statusPolls < 2 ? 'busy' : 'idle' } })
    }
    if (path.endsWith('/message')) {
      const early = {
        info: { role: 'assistant', time: { completed: 1 } },
        parts: [{ id: 'cost_1', type: 'step-finish', cost: 0.1 }],
      }
      return Response.json(
        statusPolls < 2
          ? [early]
          : [
              early,
              {
                info: { role: 'assistant', time: { completed: statusPolls >= 3 ? 2 : 0 } },
                parts: [
                  { id: 'final_text', type: 'text', text: 'final answer' },
                  { id: 'cost_2', type: 'step-finish', cost: 0.2 },
                ],
              },
            ],
      )
    }
    return response
  }
  const steps: Array<{ type: string; costUsd?: number }> = []
  const result = await runOpencodeServer(
    { ...f.input, onStep: (step) => steps.push(step) },
    f.probe,
  )
  expect(statusPolls).toBe(3)
  expect(
    result.stdout
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((event) => event.type === 'text')
      .map((event) => event.part.text)
      .join(''),
  ).toBe('final answer')
  const costs = result.stdout
    .split('\n')
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === 'step_finish')
    .reduce((total, event) => total + event.part.cost, 0)
  expect(costs).toBeCloseTo(0.3)
  expect(steps.filter((step) => step.type === 'step_finish')).toHaveLength(2)
})

it('emits a completed step while busy before the next approval without duplicate part ids', async () => {
  const f = fixture()
  const fetch = f.probe.fetch
  const steps: string[] = []
  let statusPolls = 0
  f.input.approvals.requestApproval = async () => {
    expect(statusPolls).toBe(1)
    expect(steps).toEqual(['tool_use'])
    return 'approve'
  }
  f.probe.fetch = async (url, init) => {
    const response = await fetch(url, init)
    const path = new URL(String(url)).pathname
    if (path === '/permission') return Response.json(statusPolls === 1 ? [permission()] : [])
    if (path === '/session/status') {
      statusPolls++
      return Response.json({ ses_1: { type: statusPolls < 3 ? 'busy' : 'idle' } })
    }
    if (path.endsWith('/message')) {
      return Response.json([
        {
          info: { role: 'assistant', time: { completed: statusPolls >= 3 ? 1 : 0 } },
          parts: [{ ...messages[0]!.parts[1], id: 'tool_1' }],
        },
      ])
    }
    return response
  }
  await runOpencodeServer({ ...f.input, onStep: (step) => steps.push(step.type) }, f.probe)
  expect(steps).toEqual(['tool_use'])
  expect(f.calls.filter((call) => call.path.endsWith('/reply'))).toHaveLength(1)
})

for (const scenario of [
  'http error',
  'timeout',
  'cancel',
  'approval timeout',
  'kill escalation',
] as const) {
  it(`cleans up server on ${scenario}`, async () => {
    const f = fixture({
      fail: scenario === 'http error' || scenario === 'kill escalation',
      hang: scenario === 'timeout',
      permissions: scenario === 'approval timeout' ? [permission()] : [],
      ignoreTerm: scenario === 'kill escalation',
    })
    if (scenario.includes('timeout')) f.input.timeoutMs = 20
    if (scenario === 'approval timeout')
      f.input.approvals.requestApproval = () => new Promise(() => {})
    const controller = new AbortController()
    const promise = runOpencodeServer({ ...f.input, signal: controller.signal }, f.probe)
    if (scenario === 'cancel') controller.abort()
    await expect(promise).rejects.toThrow(
      scenario.includes('timeout') ? 'timed out' : scenario === 'cancel' ? 'cancelled' : 'HTTP 500',
    )
    expect(f.kills).toEqual(scenario === 'kill escalation' ? ['SIGTERM', 'SIGKILL'] : ['SIGTERM'])
  })
}
