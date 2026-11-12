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
  action = 'bash',
  resources: string[] = ['mkdir one'],
  metadata?: Record<string, unknown>,
): OpencodePermission {
  return { id: 'per_1', sessionID: 'ses_1', action, resources, metadata }
}
const messages = [
  {
    id: 'msg_1',
    type: 'assistant',
    time: { completed: 1 },
    content: [
      { type: 'text', text: 'done' },
      {
        type: 'tool',
        name: 'bash',
        state: {
          status: 'completed',
          input: { command: 'mkdir one' },
          content: [{ type: 'text', text: 'created' }],
        },
      },
    ],
    finish: 'stop',
    cost: 0.03,
    tokens: { input: 20, output: 3 },
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
    banner?: string
    rejected?: boolean
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
              new TextEncoder().encode(
                options.banner ?? 'Server listening on http://127.0.0.1:1234\n',
              ),
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
      if (path === '/api/session') value = { id: 'ses_1' }
      if (path.endsWith('/prompt')) value = { id: 'msg_user', type: 'user' }
      if (path.endsWith('/reply')) return new Response(null, { status: 204 })
      if (path === '/api/permission/request')
        value = round++ === 0 ? (options.permissions ?? []) : []
      if (path.endsWith('/message'))
        value =
          options.idleFirst && polls === 1
            ? []
            : options.rejected
              ? [
                  {
                    ...messages[0],
                    finish: 'error',
                    error: { type: 'aborted', message: 'Step interrupted' },
                  },
                ]
              : messages
      if (path === '/api/session/active') {
        polls++
        value = {}
      }
      return Response.json({ data: value })
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
          permission(tool, [], { files: [{ file: join(cwd, 'note.txt'), patch: '-hi\n+bye' }] }),
          cwd,
        ),
      ).toEqual({
        kind: 'edit',
        detail: { files: [join(cwd, 'note.txt')], diff: '-hi\n+bye' },
        withinProject: true,
      })
      expect(opencodeApprovalRequest(permission(tool, ['/outside.txt']), cwd).withinProject).toBe(
        false,
      )
      expect(opencodeApprovalRequest(permission(tool, []), cwd).withinProject).toBe(false)
    }
  })
  it('uses the complete bash command, including compound commands, as identity', () => {
    const command = 'git status && mkdir one'
    expect(opencodeApprovalRequest(permission('bash', [command]), cwd)).toEqual({
      kind: 'command',
      detail: { command, cwd },
      commandKey: command,
      readOnly: false,
      withinProject: true,
    })
  })
  it('unknown permissions have no reusable identity', () => {
    expect(opencodeApprovalRequest(permission('network', ['mkdir *']), cwd)).toEqual({
      kind: 'command',
      detail: { command: 'network mkdir *', cwd },
      readOnly: false,
      withinProject: true,
    })
  })
})

it('converts assistant stored parts into the existing text/tool/tokens/cost parser format', () => {
  const stored = [
    {
      id: 'msg_1a37844be001J6UVhbKl7o7B8B',
      time: { created: 1793743930564 },
      text: 'Crea el archivo hola.txt con el texto hola usando tu herramienta de escritura. No hagas nada más.',
      type: 'user',
    },
    {
      id: 'msg_1a37844c8001U2VWAVww87sKH8',
      time: { created: 1793743930570, streamed: 1793743932120, completed: 1793743937859 },
      type: 'assistant',
      agent: 'build',
      model: { id: 'pulse-alpha-free', providerID: 'opencode', variant: 'low' },
      content: [
        {
          type: 'reasoning',
          text: 'The user wants me to create a file hola.txt with the text "hola" using the write tool. That\'s it.',
          native: { reasoningField: 'reasoning_content' },
          time: { created: 1793743931223, completed: 1793743932110 },
        },
        {
          type: 'tool',
          id: 'functions.write:0',
          name: 'write',
          executed: false,
          state: {
            status: 'completed',
            input: { content: 'hola', path: 'hola.txt' },
            content: [{ type: 'text', text: 'Created file successfully: hola.txt' }],
            metadata: { truncated: false },
          },
          time: { created: 1793743931540, ran: 1793743932117, completed: 1793743937804 },
        },
      ],
      finish: 'tool-calls',
      rawFinish: 'tool_calls',
      cost: 0,
      tokens: { input: 10119, output: 38, reasoning: 31, cache: { read: 0, write: 0 } },
    },
    {
      id: 'msg_1a3786149001QfFphFTLT3ddTl',
      time: { created: 1793743937867, streamed: 1793743939064, completed: 1793743939083 },
      type: 'assistant',
      agent: 'build',
      model: { id: 'pulse-alpha-free', providerID: 'opencode', variant: 'low' },
      content: [
        {
          type: 'reasoning',
          text: 'The file was created. The user said "No hagas nada más" (don\'t do anything else). So just confirm briefly in Spanish.',
          native: { reasoningField: 'reasoning_content' },
          time: { created: 1793743938523, completed: 1793743939058 },
        },
        { type: 'text', text: 'Hecho. Se creó `hola.txt` con el texto "hola".' },
      ],
      finish: 'stop',
      rawFinish: 'stop',
      cost: 0,
      tokens: { input: 87, output: 22, reasoning: 34, cache: { read: 10112, write: 0 } },
    },
    {
      id: 'msg_1a378660f001rPQqjs3ePgMSuQ',
      time: { created: 1793743939087 },
      type: 'idle',
      outcome: 'succeeded',
    },
  ]
  const stream = opencodeMessagesToStream(stored)
  expect(stream).not.toContain('Crea el archivo')
  const steps = stream.split('\n').flatMap((line) => opencodeEventToStep(JSON.parse(line)))
  expect(steps.map((step) => step.type)).toEqual([
    'reasoning',
    'tool_use',
    'step_finish',
    'reasoning',
    'text',
    'step_finish',
  ])
  expect(steps[1]).toMatchObject({ ok: true, output: 'Created file successfully: hola.txt' })
  expect(steps[4]?.detail).toBe('Hecho. Se creó `hola.txt` con el texto "hola".')
  const finishes = steps.filter((step) => step.type === 'step_finish')
  expect(finishes).toHaveLength(2)
  expect(finishes.reduce((sum, step) => sum + (step.costUsd ?? 0), 0)).toBe(0)
  expect(finishes.reduce((sum, step) => sum + (step.tokens?.input ?? 0), 0)).toBe(10206)
  expect(finishes.reduce((sum, step) => sum + (step.tokens?.output ?? 0), 0)).toBe(60)
})

it('keeps exact approve-always grants local, never sends always, ignores other sessions', async () => {
  const first = permission()
  const same = { ...first, id: 'per_2' }
  const other = { ...permission('bash', ['mkdir two']), id: 'per_3' }
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
    f.calls.filter((call) => call.path.endsWith('/reply')).map((call) => call.body.decision),
  ).toEqual(['once', 'once', 'reject'])
  expect(f.calls.find((call) => call.path === '/api/session')?.body.permissions).toEqual([
    { action: '*', resource: '*', effect: 'ask' },
    ...['read', 'glob', 'grep', 'list'].map((action) => ({
      action,
      resource: '*',
      effect: 'allow',
    })),
  ])
  expect(f.calls.find((call) => call.path.endsWith('/prompt'))?.body).toEqual({
    text: 'contract',
  })
  expect(f.calls.find((call) => call.path === '/api/session')?.body.model).toEqual({
    providerID: 'openrouter',
    id: 'provider/model',
    variant: 'high',
  })
  expect(
    f.calls
      .filter((call) => call.path.endsWith('/reply'))
      .every((call) => call.body.decision !== 'always'),
  ).toBe(true)
  expect(f.kills).toEqual(['SIGTERM'])
})

it('does not finish at initial idle before a completed assistant message', async () => {
  const f = fixture({ idleFirst: true })
  await runOpencodeServer(f.input, f.probe)
  expect(f.calls.filter((call) => call.path === '/api/session/active')).toHaveLength(2)
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
  await expect(runOpencodeServer(f.input, f.probe)).rejects.toThrow(
    'OpenCode /api/session: HTTP 401',
  )
  expect(f.kills).toEqual(['SIGTERM'])
})

it('reads final history after idle and includes the final text and both costs', async () => {
  const f = fixture()
  const fetch = f.probe.fetch
  let statusPolls = 0
  f.probe.fetch = async (url, init) => {
    const response = await fetch(url, init)
    const path = new URL(String(url)).pathname
    if (path === '/api/session/active') {
      statusPolls++
      return Response.json({ data: statusPolls < 2 ? { ses_1: { type: 'running' } } : {} })
    }
    if (path.endsWith('/message')) {
      const early = {
        id: 'early',
        type: 'assistant',
        time: { completed: 1 },
        content: [],
        cost: 0.1,
      }
      return Response.json({
        data:
          statusPolls < 2
            ? [early]
            : [
                early,
                {
                  id: 'final',
                  type: 'assistant',
                  time: { completed: statusPolls >= 3 ? 2 : 0 },
                  content: [{ type: 'text', text: 'final answer' }],
                  cost: 0.2,
                },
              ],
      })
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
    if (path === '/api/permission/request')
      return Response.json({ data: statusPolls === 1 ? [permission()] : [] })
    if (path === '/api/session/active') {
      statusPolls++
      return Response.json({ data: statusPolls < 3 ? { ses_1: { type: 'running' } } : {} })
    }
    if (path.endsWith('/message')) {
      return Response.json({
        data: [
          {
            id: 'msg_tool',
            type: 'assistant',
            time: { completed: statusPolls >= 3 ? 1 : 0 },
            content: [messages[0]!.content[1]],
          },
        ],
      })
    }
    return response
  }
  await runOpencodeServer({ ...f.input, onStep: (step) => steps.push(step.type) }, f.probe)
  expect(steps).toEqual(['tool_use', 'step_finish'])
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

it('OpenCode edits warn when the CLI omits or sends an empty diff', () => {
  for (const tool of ['edit', 'write', 'patch']) {
    for (const diff of [undefined, null, '', '  \n']) {
      const request = opencodeApprovalRequest(
        permission(tool, [], { files: [{ file: 'a', patch: diff }] }),
        cwd,
      )
      expect(request.detail.diff).toBe('OpenCode did not provide the content of this change.')
      expect(request.detail.files).toEqual(['a'])
      expect(request.withinProject).toBe(true)
    }
  }
})

for (const banner of [
  'opencode server listening on http://127.0.0.1:1234\n',
  'Server listening on http://127.0.0.1:1234\r\n',
]) {
  it(`accepts server banner ${JSON.stringify(banner)}`, async () => {
    const f = fixture({ banner })
    const result = await runOpencodeServer(f.input, f.probe)
    expect(
      result.stdout
        .split('\n')
        .map((line) => JSON.parse(line))
        .filter((event) => event.type === 'step_finish'),
    ).toHaveLength(1)
  })
}

it('fails the task after a rejected permission', async () => {
  const f = fixture({ permissions: [permission()], rejected: true })
  f.input.approvals.requestApproval = async () => 'reject'
  await expect(runOpencodeServer(f.input, f.probe)).rejects.toThrow('OpenCode task failed')
  expect(f.calls.find((call) => call.path.endsWith('/reply'))).toEqual({
    path: '/api/session/ses_1/permission/per_1/reply',
    body: { decision: 'reject' },
  })
  expect(f.kills).toEqual(['SIGTERM'])
})

it('reads 200-message pages in order using the next cursor without order', async () => {
  const f = fixture()
  const fetch = f.probe.fetch
  const pages: string[] = []
  const firstPage = Array.from({ length: 200 }, (_, index) => ({
    id: `msg_${index}`,
    type: 'assistant',
    time: { completed: index + 1 },
    content: [{ type: 'text', text: `part ${index}` }],
    cost: 0.01,
  }))
  f.probe.fetch = async (url, init) => {
    const response = await fetch(url, init)
    const parsed = new URL(String(url))
    if (!parsed.pathname.endsWith('/message')) return response
    expect(parsed.searchParams.get('limit')).toBe('200')
    pages.push(parsed.search)
    if (!parsed.searchParams.has('cursor')) {
      expect(parsed.searchParams.get('order')).toBe('asc')
      return Response.json({ data: firstPage, cursor: { next: 'next/+?&' } })
    }
    expect(parsed.searchParams.has('order')).toBe(false)
    expect(parsed.searchParams.get('cursor')).toBe('next/+?&')
    return Response.json({ data: [{ ...messages[0], id: 'final' }] })
  }
  const steps: string[] = []
  const result = await runOpencodeServer(
    {
      ...f.input,
      onStep: (step) => {
        if (step.type === 'text') steps.push(step.detail ?? '')
      },
    },
    f.probe,
  )
  expect(pages).toHaveLength(2)
  expect(steps).toEqual([...firstPage.map((message) => message.content[0]!.text), 'done'])
  const finishes = result.stdout
    .split('\n')
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === 'step_finish')
  expect(finishes).toHaveLength(201)
  expect(finishes.reduce((sum, event) => sum + event.part.cost, 0)).toBeCloseTo(2.03)
})

it('omits model and variant without a provider/model and nests optional variant in model', async () => {
  for (const model of [undefined, 'plain-model', '/model', 'provider/model']) {
    const f = fixture()
    await runOpencodeServer({ ...f.input, model, variant: undefined }, f.probe)
    const body = f.calls.find((call) => call.path === '/api/session')?.body
    expect(body).not.toHaveProperty('variant')
    if (model === 'provider/model')
      expect(body.model).toEqual({ providerID: 'provider', id: 'model' })
    else expect(body).not.toHaveProperty('model')
  }
})

it('maps multiple file patches and only reuses a single shell resource', () => {
  const request = opencodeApprovalRequest(
    permission('edit', ['fallback'], {
      files: [
        { file: 'a', patch: '+a' },
        { file: '', patch: '' },
        { file: 'b', patch: '+b' },
      ],
    }),
    cwd,
  )
  expect(request.detail).toEqual({ files: ['a', 'b'], diff: '+a\n+b' })
  expect(request.withinProject).toBe(false)
  expect(
    opencodeApprovalRequest(permission('edit', ['fallback'], { files: [{ file: '' }] }), cwd).detail
      .files,
  ).toEqual(['fallback'])
  expect(
    opencodeApprovalRequest(permission('shell', ['git status && mkdir one']), cwd).commandKey,
  ).toBe('git status && mkdir one')
  expect(
    opencodeApprovalRequest(permission('shell', ['one', 'two']), cwd).commandKey,
  ).toBeUndefined()
})

it('converts failed tool output and completed part timing without duplicate emissions', async () => {
  const f = fixture()
  const fetch = f.probe.fetch
  let polls = 0
  f.probe.fetch = async (url, init) => {
    const response = await fetch(url, init)
    const path = new URL(String(url)).pathname
    if (path === '/api/session/active') {
      polls++
      return Response.json({ data: polls < 3 ? { ses_1: { type: 'running' } } : {} })
    }
    if (!path.endsWith('/message')) return response
    return Response.json({
      data: [
        {
          id: 'msg_parts',
          type: 'assistant',
          time: { completed: polls >= 3 ? 1 : undefined },
          content: [
            { type: 'text', text: 'ready', time: { completed: 1 } },
            { type: 'reasoning', text: 'thinking' },
            {
              type: 'tool',
              name: 'write',
              state: { status: polls >= 2 ? 'error' : 'running', error: { message: 'denied' } },
            },
          ],
        },
      ],
    })
  }
  const steps: Array<{ type: string; output?: string; ok?: boolean }> = []
  const result = await runOpencodeServer(
    { ...f.input, onStep: (step) => steps.push(step) },
    f.probe,
  )
  expect(steps.map((step) => step.type)).toEqual(['text', 'tool_use', 'reasoning', 'step_finish'])
  expect(steps[1]).toMatchObject({ output: 'denied', ok: false })
  expect(result.stdout).toContain('denied')
})
