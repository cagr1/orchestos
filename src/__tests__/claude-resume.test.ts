import { describe, expect, it } from 'bun:test'
import { decideClaudeResume } from '../chat/claude-resume.ts'

const stored = { sessionId: 'sid', contextHash: 'h1', messageCount: 4 }
const base = {
  hasSession: true,
  hasProjectContext: true,
  stored,
  historyLength: 4,
  contextHash: 'h1',
}

describe('decideClaudeResume (AT.19.1)', () => {
  it('retoma sin transcript ni actualización si nada cambió', () => {
    expect(decideClaudeResume(base)).toEqual({
      resume: 'sid',
      includeTranscript: false,
      contextUpdate: false,
    })
  })
  it('retoma con context-update si el hash cambió', () => {
    expect(decideClaudeResume({ ...base, contextHash: 'h2' }).contextUpdate).toBe(true)
  })
  it('no retoma si el conteo no coincide', () => {
    expect(decideClaudeResume({ ...base, historyLength: 6 })).toEqual({
      resume: null,
      includeTranscript: true,
      contextUpdate: false,
    })
  })
  it('no retoma sin sesión guardada, sin proyecto o sin sesión de chat', () => {
    expect(
      decideClaudeResume({ ...base, stored: { ...stored, sessionId: null } }).resume,
    ).toBeNull()
    expect(decideClaudeResume({ ...base, hasProjectContext: false }).resume).toBeNull()
    expect(decideClaudeResume({ ...base, hasSession: false }).resume).toBeNull()
  })
})
