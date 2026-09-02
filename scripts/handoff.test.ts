import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import type { CommandResult, RunCommand } from './agent-governance.ts'
import { gitBranch, readRecentUserMessages, renderHandoff, uncommittedPaths } from './handoff.ts'
import type { FeatureStatusItem } from './plan-status.ts'

function fakeRun(stdout: string, exitCode = 0): RunCommand {
  return (): CommandResult => ({ exitCode, stdout, stderr: '' })
}

describe('gitBranch', () => {
  test('devuelve la rama recortada', () => {
    expect(gitBranch(fakeRun('master\n'), '.')).toBe('master')
  })

  test('devuelve un placeholder si git falla', () => {
    expect(gitBranch(fakeRun('', 1), '.')).toBe('(desconocida)')
  })
})

describe('uncommittedPaths', () => {
  test('parsea líneas de git status --porcelain', () => {
    expect(uncommittedPaths(fakeRun(' M PLAN.md\n?? scripts/x.ts\n'), '.')).toEqual([
      'M PLAN.md',
      '?? scripts/x.ts',
    ])
  })

  test('working tree limpio da lista vacía', () => {
    expect(uncommittedPaths(fakeRun(''), '.')).toEqual([])
  })

  test('si git falla, lista vacía en vez de reventar', () => {
    expect(uncommittedPaths(fakeRun('', 1), '.')).toEqual([])
  })
})

describe('renderHandoff', () => {
  const transcriptFixture = resolve(import.meta.dir, 'fixtures/handoff/transcript.jsonl')
  const openItems: FeatureStatusItem[] = [
    {
      id: 'H.5',
      month: 'BLOQUE H',
      block: 'H.5',
      delegation: '🧠',
      title: 'Evals propios',
      status: 'open',
      closedDate: null,
    },
  ]

  test('sin ítem activo ni cambios sin commitear, lo dice explícito', () => {
    const out = renderHandoff({
      branch: 'master',
      uncommitted: [],
      activeItem: null,
      openItems: [],
      now: new Date('2026-09-01T00:00:00.000Z'),
    })
    expect(out).toContain('(ninguno — no hay scope declarado activo)')
    expect(out).toContain('(working tree limpio)')
    expect(out).toContain('(no hay ítems abiertos)')
  })

  test('con ítem activo, lo señala como punto de retomada', () => {
    const out = renderHandoff({
      branch: 'master',
      uncommitted: ['M src/x.ts'],
      activeItem: { item: 'H.4.2', scope: ['scripts/**'], declaredAt: '2026-09-01T00:00:00.000Z' },
      openItems,
      now: new Date('2026-09-01T00:00:00.000Z'),
    })
    expect(out).toContain('**H.4.2**')
    expect(out).toContain('scripts/**')
    expect(out).toContain('M src/x.ts')
    expect(out).toContain('**H.5** 🧠 — Evals propios')
  })

  test('trunca la lista de ítems abiertos a 5 y avisa el resto', () => {
    const many: FeatureStatusItem[] = Array.from({ length: 7 }, (_, i) => ({
      id: `X.${i}`,
      month: null,
      block: null,
      delegation: '⚡' as const,
      title: `item ${i}`,
      status: 'open' as const,
      closedDate: null,
    }))
    const out = renderHandoff({
      branch: 'master',
      uncommitted: [],
      activeItem: null,
      openItems: many,
      now: new Date('2026-09-01T00:00:00.000Z'),
    })
    expect(out).toContain('(+2 más — ver PLAN.md)')
  })

  test('incluye los últimos cinco prompts de usuario del transcript, no respuestas del asistente', () => {
    const recentUserMessages = readRecentUserMessages(transcriptFixture)
    const out = renderHandoff({
      branch: 'master',
      uncommitted: [],
      activeItem: null,
      openItems: [],
      recentUserMessages,
      now: new Date('2026-09-01T00:00:00.000Z'),
    })

    expect(recentUserMessages).toHaveLength(5)
    expect(recentUserMessages[0]).toBe('Segundo prompt que debe conservarse.')
    expect(recentUserMessages[4]).toHaveLength(400)
    expect(out).toContain('## De qué veníamos hablando')
    expect(out).toContain('Segundo prompt que debe conservarse.')
    expect(out).not.toContain('Respuesta del asistente que no debe entrar')
    expect(out).not.toContain('Primer prompt que ya quedó fuera de los últimos cinco.')
  })
})
