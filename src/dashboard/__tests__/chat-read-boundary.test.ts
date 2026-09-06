/**
 * H.9.2 — frontera de lectura del chat de proyecto.
 *
 * REESCRITO 2026-09-06 (ítem reabierto). La versión anterior llamaba
 * `projectChatReadBoundaryError('claude')` sin sonda: con la frontera ahora
 * verificada contra el binario, eso spawnearía el `claude` real del host y el
 * resultado dependería de qué versión tenga instalada cada máquina — el mismo
 * defecto que dejó CI en rojo el 2026-08-01 ([[reference-ci-host-environment-drift]]).
 * La sonda se inyecta, igual que `ToolchainProbe`.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { _resetCliCapabilityCache } from '../../run/executors/cli-registry.ts'
import { projectChatReadBoundaryError } from '../handlers/chat.ts'

// Fragmentos textuales del `--help` real (2.1.263 lo trae, 2.1.234 no).
const helpConRestricted = '  --restricted     Restricted mode: removes the built-in tools\n'
const helpSinRestricted = '  --settings <file-or-json>   Path to a settings JSON file\n'

beforeEach(() => _resetCliCapabilityCache())

describe('H.9.2 — frontera de lectura del chat', () => {
  test('permite Claude cuando el binario instalado sostiene la frontera', () => {
    expect(projectChatReadBoundaryError('claude', () => helpConRestricted)).toBeNull()
  })

  test('bloquea Claude si el binario NO soporta --restricted (fail-closed)', () => {
    // El caso que motivó reabrir el ítem: con 2.1.234 el chat corría SIN
    // frontera y sin decirlo. Ahora se rechaza y el motivo dice qué hacer.
    const err = projectChatReadBoundaryError('claude', () => helpSinRestricted)
    expect(err).toContain('2.1.248')
    expect(err).toContain('chat de proyecto')
  })

  test('bloquea Codex citando su motivo real, no un texto genérico', () => {
    const err = projectChatReadBoundaryError('codex', () => helpConRestricted)
    expect(err).toContain('chat de proyecto')
    expect(err).toContain('sandbox')
  })

  test('bloquea cualquier CLI registrado sin contrato verificado', () => {
    expect(projectChatReadBoundaryError('opencode', () => helpConRestricted)).toContain(
      'chat de proyecto',
    )
  })
})
