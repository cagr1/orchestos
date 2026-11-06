import { describe, expect, it } from 'bun:test'
import { isGeneralScopeRequest, resolveDashboardProject } from '../project-context.ts'

// CI.32.b — el chat sin proyecto manda `?project=none`; resolverlo como id registrado daba 404
// "Project not found" en `POST /api/chat` cuando el hilo activo era una sesión general.
describe('alcance general de /api/chat', () => {
  it('?project=none sin cabecera es alcance general', () => {
    expect(isGeneralScopeRequest(new Request('http://x/api/chat?project=none'))).toBe(true)
  })

  it('con cabecera de proyecto no es alcance general', () => {
    const req = new Request('http://x/api/chat?project=none', {
      headers: { 'x-orchestos-project-id': 'abc' },
    })
    expect(isGeneralScopeRequest(req)).toBe(false)
  })

  it('sin query no es alcance general', () => {
    expect(isGeneralScopeRequest(new Request('http://x/api/chat'))).toBe(false)
  })

  it('"none" sigue sin ser un id registrado para el resto de handlers', () => {
    expect(() => resolveDashboardProject(new Request('http://x/api/x?project=none'))).toThrow(
      'Project not found',
    )
  })
})
