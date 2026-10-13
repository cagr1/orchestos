import { describe, expect, it } from 'bun:test'
import {
  buildAutoTaskInstruction,
  hasTaskMarker,
  stripTaskMarker,
  TASK_MARKER,
} from '../handlers/chat.ts'

describe('Orchestrator task marker', () => {
  it('explains why project execution requests use the task marker', () => {
    const instruction = buildAutoTaskInstruction({ hasProjectContext: true, mode: 'code' })

    expect(instruction).toContain(TASK_MARKER)
    expect(instruction).toContain('read-only on purpose')
    expect(instruction).toContain('Never refuse')
  })

  it('does not add the task marker when there is no project or the session is in Chat mode', () => {
    expect(buildAutoTaskInstruction({ hasProjectContext: false, mode: 'code' })).not.toContain(
      TASK_MARKER,
    )
    expect(buildAutoTaskInstruction({ hasProjectContext: true, mode: 'chat' })).not.toContain(
      TASK_MARKER,
    )
  })

  it('recognizes a marker line with surrounding whitespace', () => {
    expect(hasTaskMarker(`Reply\n  ${TASK_MARKER}  `)).toBe(true)
    expect(stripTaskMarker(`Reply\n  ${TASK_MARKER}  `)).toBe('Reply')
  })

  it('removes marker lines from the middle and all occurrences', () => {
    expect(stripTaskMarker(`Before\n${TASK_MARKER}\nAfter\n${TASK_MARKER}`)).toBe('Before\nAfter')
    expect(hasTaskMarker(`Before ${TASK_MARKER} after`)).toBe(false)
  })

  it('leaves ordinary text unchanged when the marker is absent', () => {
    expect(hasTaskMarker('Just a reply')).toBe(false)
    expect(stripTaskMarker('Just a reply  ')).toBe('Just a reply')
  })

  it('recognizes and removes a task marker at the end of the response line', () => {
    const response =
      'OrchestOS creará una tarea para crear claude-nota.md con una sola línea: nota de claude. [[orchestos:task]]'
    expect(hasTaskMarker(response)).toBe(true)
    expect(stripTaskMarker(response)).toBe(
      'OrchestOS creará una tarea para crear claude-nota.md con una sola línea: nota de claude.',
    )
    expect(hasTaskMarker(`${response}  \n\t`)).toBe(true)
    expect(stripTaskMarker(`${response}  \n\t`)).toBe(
      'OrchestOS creará una tarea para crear claude-nota.md con una sola línea: nota de claude.',
    )
    expect(hasTaskMarker('Antes [[orchestos:task]] después')).toBe(false)
    expect(stripTaskMarker('Antes [[orchestos:task]] después')).toBe(
      'Antes [[orchestos:task]] después',
    )
  })
})
