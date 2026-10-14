import { describe, expect, test } from 'bun:test'
import type { TimelineStep, TimelineTurn } from '../../api/chat'
import { formatElapsed, livePhase, parseDbTime, thoughtMs } from './thinking'

function step(seq: number, over: Partial<TimelineStep> = {}): TimelineStep {
  return {
    seq,
    type: 'reasoning',
    tool: null,
    target: null,
    added: null,
    removed: null,
    exitCode: null,
    ok: null,
    output: null,
    detail: 'x',
    durationMs: null,
    createdAt: '2026-10-13 10:00:05',
    ...over,
  }
}

function turn(steps: TimelineStep[], over: Partial<TimelineTurn> = {}): TimelineTurn {
  return {
    id: 't1',
    status: 'pending',
    createdAt: '2026-10-13 10:00:00',
    updatedAt: '2026-10-13 10:00:12',
    error: null,
    steps,
    ...over,
  }
}

describe('parseDbTime', () => {
  test('fecha sin zona se lee como UTC', () => {
    expect(parseDbTime('2026-10-13 10:00:00')).toBe(Date.parse('2026-10-13T10:00:00Z'))
  })
  test('ISO pasa tal cual', () => {
    expect(parseDbTime('2026-10-13T10:00:00Z')).toBe(Date.parse('2026-10-13T10:00:00Z'))
  })
  test('inválida es NaN', () => {
    expect(Number.isNaN(parseDbTime('nope'))).toBe(true)
  })
})

describe('formatElapsed', () => {
  test('menos de un minuto', () => {
    expect(formatElapsed(12_900)).toBe('12 s')
  })
  test('minuto con cero a la izquierda', () => {
    expect(formatElapsed(65_000)).toBe('1 m 05 s')
  })
  test('mínimo 0 s', () => {
    expect(formatElapsed(-5)).toBe('0 s')
  })
})

describe('livePhase', () => {
  test('herramienta en curso', () => {
    const t = turn([step(1, { type: 'tool_use', tool: 'Bash', ok: null })])
    expect(livePhase(t, false)).toBe('Running Bash')
  })
  test('herramienta sin nombre', () => {
    const t = turn([step(1, { type: 'tool_use', tool: null, ok: null })])
    expect(livePhase(t, false)).toBe('Running tool')
  })
  test('herramienta terminada vuelve a Thinking', () => {
    const t = turn([step(1, { type: 'tool_use', tool: 'Bash', ok: true })])
    expect(livePhase(t, false)).toBe('Thinking')
  })
  test('texto en vivo', () => {
    expect(livePhase(turn([step(1)]), true)).toBe('Writing')
  })
  test('sin turno', () => {
    expect(livePhase(undefined, false)).toBe('Thinking')
  })
  test('ordena por seq', () => {
    const t = turn([step(2, { type: 'tool_use', tool: 'Read', ok: null }), step(1)])
    expect(livePhase(t, false)).toBe('Running Read')
  })
})

describe('thoughtMs', () => {
  test('hasta el primer paso posterior al último razonamiento', () => {
    const t = turn([step(1), step(2, { type: 'tool_use', createdAt: '2026-10-13 10:00:08' })])
    expect(thoughtMs(t)).toBe(8000)
  })
  test('sin paso posterior usa updatedAt', () => {
    expect(thoughtMs(turn([step(1)]))).toBe(12_000)
  })
  test('sin razonamiento es undefined', () => {
    expect(thoughtMs(turn([step(1, { type: 'text' })]))).toBeUndefined()
  })
  test('tiempo inválido es undefined', () => {
    expect(thoughtMs(turn([step(1)], { createdAt: 'nope' }))).toBeUndefined()
  })
  test('resultado negativo es undefined', () => {
    expect(thoughtMs(turn([step(1)], { updatedAt: '2026-10-13 09:00:00' }))).toBeUndefined()
  })
})
