import { describe, expect, test } from 'bun:test'
import type { TimelineStep } from '../../api/chat'
import {
  answerText,
  buildTurnActivity,
  summarizeTools,
  toolCategory,
  toolLabel,
  turnOffersOpenDev,
} from './activity'

function step(
  seq: number,
  type: TimelineStep['type'],
  extra: Partial<TimelineStep> = {},
): TimelineStep {
  return {
    seq,
    type,
    tool: null,
    target: null,
    detail: null,
    output: null,
    ok: null,
    exitCode: null,
    added: null,
    removed: null,
    durationMs: null,
    createdAt: '2026-11-13T12:00:00Z',
    ...extra,
  }
}

describe('turn activity', () => {
  test('classifies run_readonly as a command', () => {
    expect(toolCategory('mcp__orchestos__run_readonly')).toBe('commands')
    const [segment] = buildTurnActivity(
      [step(1, 'tool_use', { tool: 'mcp__orchestos__run_readonly' })],
      { pending: false },
    )
    expect(segment?.kind === 'tools' && summarizeTools(segment.summary)).toBe('Ran 1 command')
  })
  test('labels commands from shell wrappers, argv JSON and plain details instead of cwd', () => {
    for (const shell of ['sh', 'zsh', 'bash']) {
      for (const quote of ["'", '"']) {
        expect(
          toolLabel(
            step(1, 'tool_use', {
              tool: 'command',
              target: '/repo',
              detail: `/bin/${shell} -lc ${quote}cat package.json${quote}`,
            }),
          ),
        ).toBe('cat package.json')
      }
    }
    expect(
      toolLabel(
        step(1, 'tool_use', {
          tool: 'mcp__orchestos__run_readonly',
          target: '/repo',
          detail: JSON.stringify({ argv: ['ls', '-1p', 'scripts/'] }),
        }),
      ),
    ).toBe('ls -1p scripts/')
    for (const detail of ['bun test', '{invalid', '{"argv":[1]}']) {
      expect(toolLabel(step(1, 'tool_use', { tool: 'bash', target: '/repo', detail }))).toBe(detail)
    }
  })
  test('labels other tools and commands without details using the fallback order', () => {
    expect(
      toolLabel(step(1, 'tool_use', { tool: 'read', target: 'src/x.ts', detail: 'detail' })),
    ).toBe('src/x.ts')
    expect(toolLabel(step(1, 'tool_use', { tool: 'read', detail: 'detail' }))).toBe('detail')
    expect(toolLabel(step(1, 'tool_use', { tool: 'command', target: '/repo' }))).toBe('/repo')
    expect(toolLabel(step(1, 'tool_use', { tool: 'read' }))).toBe('read')
    expect(toolLabel(step(1, 'tool_use'))).toBe('tool')
  })
  test('removes intermediate texts once in seq order and preserves final text', () => {
    const steps = [
      step(5, 'text', { detail: 'Final answer' }),
      step(3, 'text', { detail: ' Checking… ' }),
      step(1, 'text', { detail: ' Reading… ' }),
      step(4, 'tool_use'),
      step(2, 'tool_use'),
    ]
    expect(answerText('Reading…\nChecking…\nFinal answer\nReading…', steps)).toBe(
      'Final answer\nReading…',
    )
    expect(steps[0]?.seq).toBe(5)
    expect(answerText(' Final answer ', [step(1, 'text'), step(2, 'tool_use')])).toBe(
      'Final answer',
    )
    expect(answerText('Absent intermediate text', steps)).toBe('Absent intermediate text')
  })
  test('only strips an intermediate text that leads the content (qa ACT.1)', () => {
    const steps = [
      step(1, 'text', { detail: 'OK' }),
      step(2, 'tool_use'),
      step(3, 'text', { detail: 'OK: verificado' }),
    ]
    expect(answerText('OK: verificado', steps)).toBe('OK: verificado')
    expect(
      answerText('Voy a leer…\nResultado final', [
        step(1, 'text', { detail: 'Voy a leer…' }),
        step(2, 'tool_use'),
        step(3, 'text', { detail: 'Resultado final' }),
      ]),
    ).toBe('Resultado final')
  })
  test('preserves content intact when there are no tools', () => {
    expect(answerText(' Answer \n', [step(1, 'text', { detail: 'Answer' })])).toBe(' Answer \n')
    expect(answerText(' Answer \n', [])).toBe(' Answer \n')
  })
  test('sorts without mutating, groups consecutive reasoning and tools, interleaves text', () => {
    const steps = [
      step(7, 'text', { detail: 'final' }),
      step(1, 'reasoning', { detail: '**First**', durationMs: 1000 }),
      step(2, 'reasoning', { detail: 'Second', durationMs: 2000 }),
      step(3, 'tool_use', { tool: 'Read' }),
      step(4, 'tool_use', { tool: 'Edit' }),
      step(5, 'text', { detail: 'Checking now' }),
      step(6, 'tool_use', { tool: 'Bash' }),
    ]
    const segments = buildTurnActivity(steps, { pending: false })
    expect(steps[0]?.seq).toBe(7)
    expect(segments.map((segment) => segment.kind)).toEqual(['reasoning', 'tools', 'text', 'tools'])
    expect(segments[0]).toEqual({ kind: 'reasoning', text: 'First\n\nSecond', durationMs: 3000 })
    expect(segments[2]).toEqual({ kind: 'text', text: 'Checking now' })
    expect(segments[1]?.kind === 'tools' && segments[1].items.map((item) => item.seq)).toEqual([
      3, 4,
    ])
  })
  test('omits every text after the last tool, and all text without tools', () => {
    expect(
      buildTurnActivity([step(1, 'text', { detail: 'response' })], { pending: false }),
    ).toEqual([])
    expect(
      buildTurnActivity([step(1, 'tool_use'), step(2, 'text'), step(3, 'text')], {
        pending: false,
      }),
    ).toHaveLength(1)
  })
  test('notice and step_finish produce no segment and do not split groups', () => {
    const segments = buildTurnActivity(
      [
        step(1, 'reasoning'),
        step(2, 'notice'),
        step(3, 'reasoning'),
        step(4, 'tool_use'),
        step(5, 'step_finish'),
        step(6, 'tool_use'),
      ],
      { pending: false },
    )
    expect(segments.map((segment) => segment.kind)).toEqual(['reasoning', 'tools'])
  })
  test('classifies tools ignoring case, sums changes, failures and pending tools', () => {
    const names = [
      'BASH',
      'shell',
      'exec_command',
      'command_run',
      'Edit',
      'WRITE',
      'apply_patch',
      'MultiEdit',
      'Read',
      'FileSearch',
      'grep',
      'glob',
      'web_search',
      'web',
      'fetch',
      'custom',
    ]
    expect(names.map(toolCategory)).toEqual([
      'commands',
      'commands',
      'commands',
      'commands',
      'edits',
      'edits',
      'edits',
      'edits',
      'reads',
      'searches',
      'searches',
      'searches',
      'searches',
      'web',
      'web',
      'other',
    ])
    const steps = names.map((tool, index) =>
      step(index, 'tool_use', {
        tool,
        ok: index === 0 ? false : index === 2 ? null : true,
        exitCode: index === 1 ? 2 : null,
        added: index === 4 ? 9 : null,
        removed: index === 5 ? 2 : null,
      }),
    )
    const [segment] = buildTurnActivity(steps, { pending: true })
    expect(segment?.kind === 'tools' && segment.summary).toEqual({
      commands: 4,
      edits: 4,
      reads: 1,
      searches: 4,
      web: 2,
      other: 1,
      added: 9,
      removed: 2,
      failed: 2,
      running: 1,
    })
    const [finished] = buildTurnActivity(steps, { pending: false })
    expect(finished?.kind === 'tools' && finished.summary.running).toBe(0)
  })
  test('summarizes singulars, plurals and only nonempty categories in order', () => {
    const [segment] = buildTurnActivity([step(1, 'tool_use')], { pending: false })
    if (segment?.kind !== 'tools') throw new Error('Missing tools')
    expect(summarizeTools(segment.summary)).toBe('Used 1 tool')
    expect(
      summarizeTools({ ...segment.summary, commands: 3, edits: 2, reads: 4, searches: 2, web: 1 }),
    ).toBe(
      'Ran 3 commands, edited 2 files, read 4 files, searched 2 times, fetched 1 page, used 1 tool',
    )
    expect(
      summarizeTools({
        ...segment.summary,
        commands: 1,
        edits: 1,
        reads: 1,
        searches: 1,
        web: 2,
        other: 2,
      }),
    ).toBe(
      'Ran 1 command, edited 1 file, read 1 file, searched 1 time, fetched 2 pages, used 2 tools',
    )
  })
})

test('Open in Dev button is offered only by a tool step, for CLI and API turns', () => {
  expect(turnOffersOpenDev()).toBe(false)
  expect(turnOffersOpenDev([step(1, 'text', { detail: 'open_in_dev' })])).toBe(false)
  expect(turnOffersOpenDev([step(1, 'tool_use', { tool: 'create_task' })])).toBe(false)
  for (const tool of ['open_in_dev', 'mcp__orchestos__open_in_dev'])
    expect(turnOffersOpenDev([step(1, 'tool_use', { tool })])).toBe(true)
})
