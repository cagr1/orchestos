import { describe, expect, test } from 'bun:test'
import { projectChatReadBoundaryError } from '../handlers/chat.ts'

describe('H.9.2 — frontera de lectura del chat', () => {
  test('permite Claude porque declara project-root', () => {
    expect(projectChatReadBoundaryError('claude')).toBeNull()
  })

  test('bloquea Codex con un error explícito de frontera no verificada', () => {
    expect(projectChatReadBoundaryError('codex')).toContain('no tiene una frontera de lectura verificada')
  })

  test('bloquea cualquier CLI registrado sin contrato verificado', () => {
    expect(projectChatReadBoundaryError('opencode')).toContain('chat de proyecto')
  })
})
