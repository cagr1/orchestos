import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createChatSession, deleteChatSession, setCodexChatThread } from '../db/chat-sessions.ts'
import { createCliCommandReader, parseClaudeCommands } from './chat-cli-commands.ts'
import { handleApiChatCliCommands } from './handlers/chat.ts'
import { handleApiChatSessionCliCommand } from './handlers/chat-sessions.ts'

const init = {
  type: 'system',
  subtype: 'init',
  slash_commands: [
    'userprobe',
    'projectprobe',
    'probe',
    'doctor',
    'compact',
    'config',
    'context',
    'model',
    'rename',
    'usage',
    'archive',
    '__remote-workflow',
    '_internal',
  ],
  terminal_slash_commands: ['doctor'],
  skills: ['userprobe', 'projectprobe', 'design', 'doctor', { name: '/__hidden-skill' }],
}

test('Claude system/init merges skills, removes terminal and OrchestOS commands and deduplicates', () => {
  const commands = parseClaudeCommands(`noise\n${JSON.stringify(init)}\n{"type":"result"}`)
  expect(commands.map((c) => c.name)).toEqual([
    'userprobe',
    'projectprobe',
    'probe',
    'compact',
    'config',
    'context',
    'design',
  ])
  expect(
    commands.every((c) => c.cli === 'claude' && c.kind === 'prompt' && c.description === ''),
  ).toBe(true)
  expect(parseClaudeCommands('{broken}')).toEqual([])
  expect(parseClaudeCommands(JSON.stringify({ ...init, subtype: 'other' }))).toEqual([])
  expect(
    parseClaudeCommands(
      JSON.stringify({
        ...init,
        slash_commands: [{ name: 'probe', description: 'Project command' }],
        skills: [],
      }),
    )[0]?.description,
  ).toBe('Project command')
})

test('discovery uses project cwd, coalesces requests, caches for five minutes per cwd and tolerates failure', async () => {
  let now = 0
  const calls: unknown[] = []
  const read = createCliCommandReader({
    home: '/nonexistent-command-test-home',
    listCodexSkills: async () => [],
    now: () => now,
    probe: {
      findBinary: () => '/fake/claude',
      run: async (...args) => {
        calls.push(args)
        return JSON.stringify(init)
      },
    },
  })
  const [first, second] = await Promise.all([
    read('claude', '/project-a'),
    read('claude', '/project-a'),
  ])
  expect(first).toEqual(second)
  expect(calls).toEqual([
    [
      '/fake/claude',
      ['-p', '/context', '--output-format', 'stream-json', '--verbose', '--no-session-persistence'],
      '/project-a',
      10000,
    ],
  ])
  await read('claude', '/project-b')
  now = 299999
  await read('claude', '/project-a')
  expect(calls.length).toBe(2)
  now = 300000
  await read('claude', '/project-a')
  expect(calls.length).toBe(3)
  expect(await read('opencode', '/project-a')).toEqual([])
  expect(await read('codex', '/project-a')).toEqual([
    {
      name: 'compact',
      description: 'Compact this conversation',
      cli: 'codex',
      kind: 'rpc',
      source: 'builtin',
    },
  ])
  const logs: unknown[] = []
  const failed = createCliCommandReader({
    probe: {
      findBinary: () => 'fake',
      run: async () => {
        throw new Error('timeout')
      },
    },
    log: (message) => logs.push(message),
  })
  expect(await failed('claude', '/project-a')).toEqual([])
  expect(logs.length).toBe(1)
})

test('commands endpoint uses home for general chat and does not discover unsupported CLIs', async () => {
  const calls: unknown[] = []
  const response = await handleApiChatCliCommands(
    new Request('http://localhost/api/chat/cli-commands?cli=claude'),
    {
      read: async (...args) => {
        calls.push(args)
        return []
      },
      home: '/home/test',
    },
  )
  expect(response.status).toBe(200)
  expect(calls).toEqual([['claude', '/home/test']])
  const generalCodex = await handleApiChatCliCommands(
    new Request('http://localhost/api/chat/cli-commands?cli=codex'),
    {
      read: async () => {
        throw new Error('must not discover Codex skills without a project')
      },
    },
  )
  expect(await generalCodex.json()).toMatchObject([{ name: 'compact', kind: 'rpc' }])
  const unsupported = await handleApiChatCliCommands(
    new Request('http://localhost/api/chat/cli-commands?cli=opencode'),
    {
      read: async () => {
        throw new Error('must not discover')
      },
    },
  )
  expect(await unsupported.json()).toEqual([])
})

test('CMD.2 Codex lists only enabled skills with valid names and keeps compact on failure', async () => {
  const calls: string[] = []
  const logs: string[] = []
  const read = createCliCommandReader({
    log: (message) => logs.push(message),
    listCodexSkills: async (cwd) => {
      calls.push(cwd)
      if (cwd === '/unavailable') throw new Error('skills/list failed')
      return [
        { name: 'Catalog-Probe', description: 'Project skill', enabled: true },
        ...[
          'catalog-probe',
          'model',
          'Rename',
          'usage',
          'archive',
          'Compact',
          'review',
          '',
          '/nested',
          'two words',
          '_private',
        ].map((name) => ({ name, description: 'Excluded', enabled: true })),
        { name: 'disabled', description: 'Disabled', enabled: false },
        { name: 'second', description: 'Second skill', enabled: true },
      ]
    },
  })
  const commands = await read('codex', '/project')
  expect(commands).toMatchObject([
    { name: 'compact', kind: 'rpc' },
    {
      name: 'Catalog-Probe',
      description: 'Project skill',
      cli: 'codex',
      kind: 'prompt',
      source: 'skill',
    },
    { name: 'second', description: 'Second skill' },
  ])
  expect(commands).toHaveLength(3)
  expect(await read('codex', '/unavailable')).toEqual(commands.slice(0, 1))
  expect(calls).toEqual(['/project', '/unavailable'])
  expect(logs).toEqual(['[cli-commands] skills/list failed'])
})

test('Codex command endpoint returns 409 without persisted threadId; dispatches only supported commands', async () => {
  const session = createChatSession({
    agent: 'codex',
    mode: 'chat',
    projectId: null,
    title: 'CMD.1 test',
  })
  const url = new URL(`http://localhost/api/chat/sessions/${session.id}/cli-command?project=none`)
  const req = (name: unknown) =>
    new Request(url, { method: 'POST', body: JSON.stringify({ name }) })
  const calls: unknown[] = []
  const deps = {
    execute: async (...args: unknown[]) => {
      calls.push(args)
    },
  }
  try {
    const missing = await handleApiChatSessionCliCommand(req('compact'), url, deps)
    expect(missing.status).toBe(409)
    expect((await missing.json()).error).toContain('Start a conversation')
    expect(calls).toEqual([])
    const wrongScope = new URL(url)
    wrongScope.searchParams.set('project', 'other')
    expect((await handleApiChatSessionCliCommand(req('compact'), wrongScope, deps)).status).toBe(
      403,
    )
    setCodexChatThread(session.id, 'persisted-thread', 'hash')
    expect((await handleApiChatSessionCliCommand(req('compact'), url, deps)).status).toBe(200)
    expect(calls[0]).toEqual([session.id, 'compact'])
    for (const name of ['review', 'rename', 'other', null])
      expect((await handleApiChatSessionCliCommand(req(name), url, deps)).status).toBe(400)
  } finally {
    deleteChatSession(session.id)
  }
})

test('CMD.1 discovery enriches names with project, user, plugin frontmatter, builtins and fallback descriptions', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cmd-descriptions-'))
  const cwd = join(root, 'project')
  const home = join(root, 'home')
  const fixture = (path: string, text: string) => {
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, text)
  }
  try {
    fixture(
      join(cwd, '.claude/commands/probe.md'),
      '---\ndescription: "Project: command"\n---\nBody',
    )
    fixture(join(home, '.claude/commands/probe.md'), '---\ndescription: User shadowed\n---')
    fixture(join(home, '.claude/commands/userprobe.md'), '---\ndescription: User command\n---')
    fixture(
      join(cwd, '.claude/skills/design/SKILL.md'),
      '---\ndescription: >-\n  Design a page\n  with care\n---',
    )
    fixture(join(home, '.claude/skills/personal/SKILL.md'), '---\ndescription: Personal skill\n---')
    fixture(
      join(home, '.claude/plugins/cache/vendor/tools/1.0/commands/audit.md'),
      '---\ndescription: Plugin audit\n---',
    )
    fixture(
      join(home, '.claude/plugins/cache/vendor/tools/1.0/skills/check/SKILL.md'),
      '---\ndescription: Plugin check\n---',
    )
    fixture(join(cwd, '.claude/commands/plain.md'), 'No frontmatter')
    fixture(join(cwd, '.claude/commands/broken.md'), '---\ndescription: [broken\n---')
    const read = createCliCommandReader({
      home,
      probe: {
        findBinary: () => 'fake',
        run: async () =>
          JSON.stringify({
            ...init,
            slash_commands: [
              'probe',
              'userprobe',
              'personal',
              'tools:audit',
              'tools:check',
              'compact',
              'context',
              'unknown',
              'broken',
              'plain',
              'remote:task',
              'audit',
            ],
            skills: ['design'],
          }),
      },
    })
    const commands = await read('claude', cwd)
    expect(Object.fromEntries(commands.map((c) => [c.name, c.description]))).toEqual({
      probe: 'Project: command',
      userprobe: 'User command',
      personal: 'Personal skill',
      'tools:audit': 'Plugin audit',
      'tools:check': 'Plugin check',
      compact: 'Compact this conversation',
      context: 'Show context usage',
      unknown: 'Claude command',
      broken: 'Claude command',
      plain: 'Claude command',
      'remote:task': 'Claude command',
      audit: 'Plugin audit',
      design: 'Design a page with care',
    })
    expect(Object.fromEntries(commands.map((c) => [c.name, [c.source, c.plugin]]))).toEqual({
      probe: ['custom', undefined],
      userprobe: ['custom', undefined],
      personal: ['skill', undefined],
      design: ['skill', undefined],
      'tools:audit': ['plugin', 'tools'],
      'tools:check': ['plugin', 'tools'],
      'remote:task': ['plugin', 'remote'],
      audit: ['plugin', 'tools'],
      compact: ['builtin', undefined],
      context: ['builtin', undefined],
      unknown: ['builtin', undefined],
      broken: ['custom', undefined],
      plain: ['custom', undefined],
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('CMD.1 discovery reads descriptions through symlinked Claude command directories', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cmd-symlink-'))
  const cwd = join(root, 'project')
  const home = join(root, 'home')
  const linkedCommands = join(root, 'shared-commands')
  mkdirSync(linkedCommands, { recursive: true })
  mkdirSync(join(home, '.claude'), { recursive: true })
  symlinkSync(linkedCommands, join(home, '.claude/commands'))
  writeFileSync(join(linkedCommands, 'release.md'), '---\ndescription: Cut a release\n---\nBody')
  try {
    const read = createCliCommandReader({
      home,
      probe: {
        findBinary: () => 'fake',
        run: async () => JSON.stringify({ ...init, slash_commands: ['release'], skills: [] }),
      },
    })
    expect(await read('claude', cwd)).toEqual([
      {
        name: 'release',
        description: 'Cut a release',
        cli: 'claude',
        kind: 'prompt',
        source: 'custom',
      },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('cut is reserved for OrchestOS and excluded from CLI discovery', async () => {
  const { ORCHESTOS_COMMAND_NAMES } = await import('./chat-cli-commands')
  expect(ORCHESTOS_COMMAND_NAMES.has('cut')).toBe(true)
  expect(
    parseClaudeCommands(
      JSON.stringify({ type: 'system', subtype: 'init', slash_commands: ['cut'] }),
    ),
  ).toEqual([])
})
