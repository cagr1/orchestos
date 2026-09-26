import { describe, expect, it } from 'bun:test'
import { hasTaskMarker, stripTaskMarker, TASK_MARKER } from '../handlers/chat.ts'

describe('Orchestrator task marker', () => {
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
})
