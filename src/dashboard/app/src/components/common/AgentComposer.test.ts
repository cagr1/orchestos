import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { type CliCommand, getCliCommands, runCliCommand, stopChatTurn } from '../../api/chat'
import { findExplorerFiles } from '../../api/explorer'
import { StoppedResponse } from '../thread/StoppedResponse'
import {
  ComposerCommandStatus,
  ComposerSubmitButton,
  cliDisplayName,
  codexSkillPrompt,
  commandSourceLabel,
  fileReferenceToken,
  LOCAL_UNAVAILABLE,
  localCliConfig,
  persistApprovalMode,
  readApprovalMode,
  selectionFromDefaults,
  sendComposerCliCommand,
  sendComposerDraft,
  slashCommandGroups,
} from './AgentComposer'

test('composer renders Send → Stop → Stopping, then Send after completion', () => {
  const onStop = async () => {}
  const render = (busy: boolean, stopping = false) =>
    renderToStaticMarkup(
      createElement(ComposerSubmitButton, {
        onSend: () => {},
        onStop,
        busy,
        stopping,
        hasDraft: false,
        sendDisabled: true,
      }),
    )
  expect(render(false)).toContain('aria-label="Send message"')
  const stop = render(true)
  expect(stop).toContain('aria-label="Stop response"')
  expect(stop.match(/<button[^>]*aria-label="Stop response"[^>]*>/)?.[0]).not.toContain('disabled')
  expect(stop).toContain('lucide-square')
  const stopping = render(true, true)
  expect(stopping.match(/<button[^>]*aria-label="Stopping response"[^>]*>/)?.[0]).toContain(
    'disabled',
  )
  expect(stopping).toContain('aria-label="Stopping response"')
  expect(render(false, true)).toContain('aria-label="Send message"')
})

test('stopped response is a muted text mark without an error alert', () => {
  expect(renderToStaticMarkup(createElement(StoppedResponse, { stopped: false }))).toBe('')
  const mark = renderToStaticMarkup(createElement(StoppedResponse, { stopped: true }))
  expect(mark).toContain('Respuesta detenida')
  expect(mark).toContain('text-xs text-app-muted')
  expect(mark).not.toContain('alert')
  expect(mark).not.toContain('<svg')
})

test('Stop click calls the endpoint with the current turn rather than sending a draft', async () => {
  const originalFetch = globalThis.fetch
  let received: unknown
  let sends = 0
  globalThis.fetch = (async (_path, init) => {
    received = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ status: 'stopping' }), { status: 202 })
  }) as typeof fetch
  try {
    const props = {
      busy: true,
      stopping: false,
      hasDraft: false,
      sendDisabled: true,
      onStop: () => stopChatTurn('session-1', 'current-turn'),
      onSend: () => {
        sends++
      },
    }
    const button = ComposerSubmitButton(props).props.children
    await button.props.onClick()
    expect(received).toEqual({ turnId: 'current-turn' })
    expect(sends).toBe(0)
    expect(ComposerSubmitButton({ ...props, stopping: true }).props.children.props.disabled).toBe(
      true,
    )
    expect(
      ComposerSubmitButton({ ...props, onStop: undefined }).props.children.props.disabled,
    ).toBe(true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

describe('AgentComposer defaults', () => {
  test('leaves effort to the CLI when no default is known', () => {
    expect(selectionFromDefaults('claude', undefined)).toEqual({
      cli: 'claude',
      model: '',
      effort: '',
    })
  })

  test('syncs a mounted API composer to its Codex orchestrator defaults', () => {
    expect(selectionFromDefaults('codex', 'gpt-6-luna', 'medium')).toEqual({
      cli: 'codex',
      model: 'gpt-6-luna',
      effort: 'medium',
    })
  })

  test('uses the locked CLI and clears a model removed from session defaults', () => {
    expect(selectionFromDefaults('api', undefined, 'high', 'codex')).toEqual({
      cli: 'codex',
      model: '',
      effort: 'high',
    })
  })

  test('keeps the draft when the send callback rejects the message', async () => {
    expect(await sendComposerDraft(async () => false)).toBe(false)
    expect(
      await sendComposerDraft(async () => {
        throw new Error('send failed')
      }),
    ).toBe(false)
    expect(await sendComposerDraft(async () => true)).toBe(true)
  })
})

test('approval mode defaults safely and persists each supported selection', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  expect(readApprovalMode(storage)).toBe('auto-edit')
  for (const mode of ['supervised', 'auto-edit', 'full'] as const) {
    persistApprovalMode(mode, storage)
    expect(values.get('orchestos.approvalMode')).toBe(mode)
    expect(readApprovalMode(storage)).toBe(mode)
  }
  values.set('orchestos.approvalMode', 'invalid')
  expect(readApprovalMode(storage)).toBe('auto-edit')
  expect(
    readApprovalMode({
      getItem() {
        throw new Error('blocked')
      },
    }),
  ).toBe('auto-edit')
  expect(() =>
    persistApprovalMode('full', {
      setItem() {
        throw new Error('blocked')
      },
    }),
  ).not.toThrow()
})

test('file reference token starts at @ or after whitespace, never inside an email', () => {
  expect(fileReferenceToken('@', 1)).toEqual({ start: 0, end: 1, query: '' })
  expect(fileReferenceToken('Read @README then', 12)).toEqual({
    start: 5,
    end: 12,
    query: 'README',
  })
  expect(fileReferenceToken('a@b', 3)).toBeNull()
  expect(fileReferenceToken('@README ', 8)).toBeNull()
  expect(fileReferenceToken('line\n@file', 10)).toEqual({ start: 5, end: 10, query: 'file' })
})

test('file search traverses nested folders with the session project and caps at 20 matches', async () => {
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  const controller = new AbortController()
  globalThis.fetch = (async (path, init) => {
    expect(new Headers(init?.headers).get('x-orchestos-project-id')).toBe('session-project')
    expect(init?.signal).toBe(controller.signal)
    const folder = new URL(String(path), 'http://localhost').searchParams.get('path')
    requested.push(folder ?? '')
    const entries =
      folder === ''
        ? [
            { name: 'src', path: 'src', type: 'dir' },
            { name: 'other.md', path: 'other.md', type: 'file' },
          ]
        : Array.from({ length: 25 }, (_, index) => ({
            name: `file-${index}.ts`,
            path: `src/file-${index}.ts`,
            type: 'file',
          }))
    return Response.json({ entries })
  }) as typeof fetch
  try {
    const files = await findExplorerFiles('FILE-', 'session-project', controller.signal)
    expect(requested).toEqual(['', 'src'])
    expect(files).toHaveLength(20)
    expect(files[0].path).toBe('src/file-0.ts')
    controller.abort()
    await expect(findExplorerFiles('', 'session-project', controller.signal)).rejects.toThrow()
    expect(requested).toHaveLength(2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('API engine is labeled OpenRouter', () => {
  expect(cliDisplayName('api')).toBe('OpenRouter')
})

test('composer without a thread takes the backend default and honors an explicit CLI', () => {
  const backendDefault = { agent: 'codex' }
  expect(selectionFromDefaults(backendDefault.agent, undefined, 'medium').cli).toBe('codex')
  expect(selectionFromDefaults(backendDefault.agent, undefined, 'medium', 'claude').cli).toBe(
    'claude',
  )
})

test('WIN.13 — Local (Ollama) lists the detected ollama/* models; no models, no entry', () => {
  expect(localCliConfig([])).toBeNull()
  const local = localCliConfig([{ id: 'ollama/qwen2.5-coder:7b' }, { id: 'ollama/llama3:8b' }])
  expect(local?.id).toBe('local')
  expect(local?.defaultModel).toBe('ollama/qwen2.5-coder:7b')
  expect(local?.models.map((model) => [model.id, model.short])).toEqual([
    ['ollama/qwen2.5-coder:7b', 'qwen2.5-coder:7b'],
    ['ollama/llama3:8b', 'llama3:8b'],
  ])
  expect(cliDisplayName('local')).toBe('Local (Ollama)')
})

test('WIN.13 — a local chat without Ollama models says why instead of a silent, disabled composer', () => {
  expect(localCliConfig([], 'local')).toMatchObject({
    id: 'local',
    models: [],
    error: LOCAL_UNAVAILABLE,
  })
  expect(localCliConfig([], 'claude')).toBeNull()
})

test('CMD.1 slash menu filters prefixes and groups active CLI commands; OrchestOS wins collisions', () => {
  const commands = [
    {
      name: 'compact',
      description: 'Compact this conversation',
      cli: 'codex' as const,
      kind: 'rpc' as const,
      source: 'builtin' as const,
    },
    {
      name: 'rename',
      description: 'Collision',
      cli: 'codex' as const,
      kind: 'rpc' as const,
      source: 'builtin' as const,
    },
    {
      name: 'context',
      description: '',
      cli: 'claude' as const,
      kind: 'prompt' as const,
      source: 'builtin' as const,
    },
  ]
  expect(
    slashCommandGroups('/', 'codex', commands).map((group) => [
      group.label,
      group.commands.map((c) => c.cmd),
    ]),
  ).toEqual([
    ['OrchestOS', ['/cut', '/rename', '/usage', '/model', '/archive']],
    ['Codex', ['/compact']],
  ])
  expect(
    slashCommandGroups('/co', 'codex', commands).map((g) => g.commands.map((c) => c.cmd)),
  ).toEqual([['/compact']])
  expect(slashCommandGroups('/compact ', 'codex', commands)).toEqual([])
  expect(slashCommandGroups('text /', 'codex', commands)).toEqual([])
  expect(slashCommandGroups('/missing', 'codex', commands)).toEqual([])
})

test('CMD.1 RPC submit calls the scoped endpoint, preserves failures and leaves prompt commands as messages', async () => {
  const commands = [
    {
      name: 'compact',
      description: '',
      cli: 'codex' as const,
      kind: 'rpc' as const,
      source: 'builtin' as const,
    },
  ]
  const calls: unknown[] = []
  const execute = async (...args: unknown[]) => {
    calls.push(args)
    return { ok: true }
  }
  expect(await sendComposerCliCommand('/compact', commands, 'session', 'project', execute)).toBe(
    true,
  )
  expect(calls).toEqual([['session', 'compact', 'project']])
  expect(
    await sendComposerCliCommand(
      '/probe args',
      [{ name: 'probe', description: '', cli: 'claude', kind: 'prompt', source: 'builtin' }],
      'session',
      undefined,
      execute,
    ),
  ).toBe(false)
  await expect(
    sendComposerCliCommand('/compact', commands, undefined, undefined, execute),
  ).rejects.toThrow('Start a conversation')
  await expect(
    sendComposerCliCommand('/compact', commands, 'session', undefined, async () => {
      throw new Error('RPC failed')
    }),
  ).rejects.toThrow('RPC failed')
  expect(calls.length).toBe(1)
})

test('CMD.2 composer offers Codex skills in Dev and converts only catalog matches', async () => {
  const skill: CliCommand = {
    name: 'Catalog-Probe',
    description: 'Project skill',
    cli: 'codex',
    kind: 'prompt',
    source: 'skill',
  }
  const compact: CliCommand = { ...skill, name: 'compact', kind: 'rpc', source: 'builtin' }
  const claude: CliCommand = { ...skill, name: 'claude-skill', cli: 'claude' }
  const commands = [skill, compact, claude]
  expect(slashCommandGroups('/catalog', 'codex', commands)).toMatchObject([
    { label: 'Codex', commands: [{ cmd: '/Catalog-Probe', label: 'Project skill' }] },
  ])
  expect(slashCommandGroups('/catalog', 'codex', commands, false, 'chat')).toEqual([])
  expect(codexSkillPrompt('/catalog-probe  one\ttwo\nthree', commands)).toBe(
    '$Catalog-Probe  one\ttwo\nthree',
  )
  expect(codexSkillPrompt('/Catalog-Probe', commands)).toBe('$Catalog-Probe')
  for (const text of [
    '/catalog',
    '/Catalog-Probe-extra',
    '/claude-skill args',
    '/compact',
    '/model',
  ])
    expect(codexSkillPrompt(text, commands)).toBeUndefined()
  expect(await sendComposerCliCommand('/Catalog-Probe args', commands, undefined)).toBe(false)
  expect(
    await sendComposerCliCommand(
      '/Catalog-Probe args',
      commands,
      undefined,
      undefined,
      undefined,
      undefined,
      'chat',
    ),
  ).toBe(false)
})

test('CMD.1 loading keeps the CLI group visible while filtering a prefix', () => {
  expect(slashCommandGroups('/co', 'claude', [], true)).toEqual([
    { label: 'Claude', commands: [], loading: true },
  ])
  expect(slashCommandGroups('/co', 'claude', [], false)).toEqual([])
  expect(slashCommandGroups('/co ', 'claude', [], true)).toEqual([])
})

test('CMD.1 compact reports visible success only after RPC succeeds; server errors remain literal', async () => {
  const originalFetch = globalThis.fetch
  const statuses: string[] = []
  const commands = [
    {
      name: 'compact',
      description: '',
      cli: 'codex' as const,
      kind: 'rpc' as const,
      source: 'builtin' as const,
    },
  ]
  globalThis.fetch = (async () => Response.json({ ok: true })) as unknown as typeof fetch
  try {
    expect(
      await sendComposerCliCommand(
        '/compact',
        commands,
        'session',
        undefined,
        runCliCommand,
        (message) => statuses.push(message),
      ),
    ).toBe(true)
    expect(statuses).toEqual(['Conversation compacted'])
    const markup = renderToStaticMarkup(
      createElement(ComposerCommandStatus, { message: statuses[0] }),
    )
    expect(markup).toContain('role="status"')
    expect(markup).toContain('Conversation compacted')
    globalThis.fetch = (async () =>
      Response.json(
        { error: 'No Codex thread. Start a conversation first.' },
        { status: 409 },
      )) as unknown as typeof fetch
    await expect(
      sendComposerCliCommand('/compact', commands, 'session', undefined, runCliCommand, (message) =>
        statuses.push(message),
      ),
    ).rejects.toThrow('No Codex thread. Start a conversation first.')
    expect(statuses).toHaveLength(1)
    expect(renderToStaticMarkup(createElement(ComposerCommandStatus, { message: null }))).toBe('')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('CMD.1 API client discovers by CLI/project and sends RPC with the session scope', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ path: string; init?: RequestInit }> = []
  globalThis.fetch = (async (path, init) => {
    calls.push({ path: String(path), init })
    return Response.json(init?.method === 'POST' ? { ok: true } : [])
  }) as typeof fetch
  try {
    await getCliCommands('claude', 'project-a')
    expect(calls[0]?.path).toBe('/api/chat/cli-commands?cli=claude&projectId=project-a')
    await runCliCommand('session', 'compact', 'project-a')
    expect(calls[1]?.path).toBe('/api/chat/sessions/session/cli-command')
    expect(new Headers(calls[1]?.init?.headers).get('x-orchestos-project-id')).toBe('project-a')
    expect(calls[1]?.init?.body).toBe(JSON.stringify({ name: 'compact' }))
    await runCliCommand('session', 'compact')
    expect(calls[2]?.path).toBe('/api/chat/sessions/session/cli-command?project=none')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('CMD.1 Chat hides CLI groups even while loading and blocks prompt and RPC commands without execution', async () => {
  const commands = [
    {
      name: 'compact',
      description: 'Compact',
      cli: 'codex' as const,
      kind: 'rpc' as const,
      source: 'builtin' as const,
    },
    {
      name: 'probe',
      description: 'Probe',
      cli: 'claude' as const,
      kind: 'prompt' as const,
      source: 'builtin' as const,
    },
  ]
  expect(slashCommandGroups('/', 'codex', commands, true, 'chat').map((g) => g.label)).toEqual([
    'OrchestOS',
  ])
  expect(slashCommandGroups('/co', 'codex', commands, false, 'chat')).toEqual([])
  const statuses: string[] = []
  let executions = 0
  for (const content of ['/compact', '/probe args']) {
    expect(
      await sendComposerCliCommand(
        content,
        commands,
        undefined,
        undefined,
        async () => {
          executions++
          return { ok: true }
        },
        (message) => statuses.push(message),
        'chat',
      ),
    ).toBe(true)
  }
  expect(executions).toBe(0)
  expect(statuses).toEqual([
    'CLI commands are available in Dev',
    'CLI commands are available in Dev',
  ])
  expect(
    await sendComposerCliCommand(
      '/ordinary',
      commands,
      undefined,
      undefined,
      undefined,
      undefined,
      'chat',
    ),
  ).toBe(false)
})

test('CMD.1 command statuses follow the selected Spanish language', async () => {
  const commands = [
    {
      name: 'compact',
      description: '',
      cli: 'codex' as const,
      kind: 'rpc' as const,
      source: 'builtin' as const,
    },
  ]
  const statuses: string[] = []
  const execute = async () => ({ ok: true })
  for (const mode of ['chat', 'dev'] as const) {
    await sendComposerCliCommand(
      '/compact',
      commands,
      'session',
      undefined,
      execute,
      (message) => statuses.push(message),
      mode,
      'es',
    )
  }
  expect(statuses).toEqual(['Los comandos del CLI se usan en Dev', 'Conversación compactada'])
})

test('CMD.1 source labels omit builtins and describe custom, skill and plugin origins', () => {
  expect(commandSourceLabel({ source: 'builtin' })).toBe('')
  expect(commandSourceLabel({ source: 'custom' })).toBe('Custom command')
  expect(commandSourceLabel({ source: 'skill' })).toBe('Skill')
  expect(commandSourceLabel({ source: 'plugin', plugin: 'tools' })).toBe('tools')
  expect(commandSourceLabel({ source: 'plugin' })).toBe('')
  const groups = slashCommandGroups('/', 'claude', [
    {
      name: 'audit',
      description: 'Full audit description',
      cli: 'claude',
      kind: 'prompt',
      source: 'plugin',
      plugin: 'tools',
    },
  ])
  expect(groups[0]?.commands.every((command) => command.source === 'builtin')).toBe(true)
  expect(groups[1]?.commands[0]).toMatchObject({
    label: 'Full audit description',
    source: 'plugin',
    plugin: 'tools',
  })
})

test('/cut belongs to OrchestOS in Dev and is absent in Chat', () => {
  expect(slashCommandGroups('/cut', 'claude', [])[0]?.commands.map((c) => c.cmd)).toEqual(['/cut'])
  expect(slashCommandGroups('/cut', 'codex', [])[0]?.commands.map((c) => c.cmd)).toEqual(['/cut'])
  expect(slashCommandGroups('/cut', 'claude', [], false, 'chat')).toEqual([])
  expect(
    codexSkillPrompt('/cut', [
      { name: 'cut', cli: 'codex', source: 'skill', description: 'CLI cut', kind: 'prompt' },
    ]),
  ).toBeUndefined()
})
