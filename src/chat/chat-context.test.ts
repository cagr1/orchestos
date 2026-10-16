import { describe, expect, it } from 'bun:test'
import { buildChatSystemPrompt, chatProjectContext, displayRunModel } from './chat-context.ts'

describe('chat system context', () => {
  const base = {
    autoTaskInstruction: 'no tasks',
    now: new Date('2026-09-27T12:00:00Z'),
    timeZone: 'America/Guayaquil',
  }
  const profile = {
    manifest: { name: 'fixture', runtime: 'Bun', framework: 'React', deps: [] },
    languages: [
      { lang: 'TypeScript', count: 4, pct: 60 },
      { lang: 'JavaScript', count: 2, pct: 30 },
      { lang: 'CSS', count: 1, pct: 10 },
      { lang: 'HTML', count: 0, pct: 0 },
    ],
    conventions: {
      editorconfig: 'root = true',
      prettier: '{}',
      eslint: '{}',
      tsconfig: { strict: true, target: 'ES2022' },
    },
    commands: ['bun run test'],
  }

  it('renders only known project facts without agent notes', () => {
    const context = chatProjectContext(profile)
    expect(context).toBe(
      'Stack: Bun · React · TypeScript 60%, JavaScript 30%, CSS 10%\n' +
        'Commands: bun run test\n' +
        'Conventions: Prettier configured — match existing formatting; ESLint configured — no new lint errors; EditorConfig present — respect indent and charset; TypeScript strict mode enabled; TS target: ES2022',
    )
    expect(context).not.toContain('Notes for AI agents')
    expect(context).not.toContain('# AGENTS.md')
  })

  it('omits an unknown project profile from the prompt', () => {
    const prompt = buildChatSystemPrompt({
      ...base,
      projectProfile: {
        manifest: { name: 'unknown', runtime: 'unknown', framework: 'unknown', deps: [] },
        languages: [{ lang: 'unknown', count: 0, pct: 100 }],
        conventions: { editorconfig: null, prettier: null, eslint: null, tsconfig: null },
        commands: [],
      },
    })
    expect(prompt).not.toContain('Project context:')
    expect(prompt).not.toContain('unknown')
    expect(prompt).not.toContain('Notes for AI agents')
  })
  it('describes tools enabled by each agent and omits empty memory/specs', () => {
    for (const [agent, phrase] of [
      ['claude', 'Read, Glob, Grep'],
      ['codex', 'read-only shell commands'],
      ['api', 'cannot modify files'],
    ] as const) {
      const prompt = buildChatSystemPrompt({ ...base, agent })
      expect(prompt).toContain(phrase)
      expect(prompt).toContain(
        'Answer in this chat whatever can be answered with text (writing text, code or lists in your reply is not a file change); only requests to change files in the project go through the task line below.',
      )
      expect(prompt).not.toContain('memory, specs')
      expect(prompt).not.toContain('search_memory')
    }
  })
  it('prints missing prices, partial totals, one-line tasks, and QA reason', () => {
    const prompt = buildChatSystemPrompt({
      ...base,
      agent: 'codex',
      tasks: [{ id: 'T-1', status: 'failed', description: 'Long '.repeat(50), qa_verdict: 'fail' }],
      qaReasons: { 'T-1': 'Expected output was absent' },
      runs: [
        {
          id: 'R1',
          status: 'done',
          model: 'codex (cli default model)',
          usd_cost: 0,
          cost_breakdown_json: '[{"source":"unknown"}]',
          created_at: '2026-09-27T10:00:00Z',
        },
      ],
    })
    expect(prompt).toContain('partial: 1 runs without price')
    expect(prompt).toContain('| n/a | 2026-09-27 05:00 (America/Guayaquil)')
    expect(prompt).toContain('codex · codex default')
    expect(prompt).toContain('— qa: Expected output was absent')
    const task = prompt.split('\n').find((line) => line.includes('T-1 [failed]'))!
    expect(task.split(': ').slice(1).join(': ').split(' — qa:')[0]!.length).toBeLessThanOrEqual(80)
    expect(prompt).toContain('Now: 2026-09-27 07:00:00 (America/Guayaquil, UTC-05:00)')
  })
  it('normalizes the observed CLI and API model labels', () => {
    expect(displayRunModel('gpt-5.6-luna via Codex CLI (effort: medium)', 'codex')).toBe(
      'codex · gpt-5.6-luna',
    )
    expect(displayRunModel('codex (cli default model)', 'codex')).toBe('codex · codex default')
    expect(displayRunModel('claude (cli default model)', 'claude')).toBe('claude · claude default')
    expect(displayRunModel('gpt-6-luna', 'codex')).toBe('codex · gpt-6-luna')
    expect(displayRunModel('unknown', 'codex')).toBe('codex · codex default')
    expect(displayRunModel('openai/gpt-5.4', 'openrouter')).toBe('openrouter · openai/gpt-5.4')
  })
})
