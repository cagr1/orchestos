/**
 * src/router/engine-cascade.ts — E.16 (Mes 22, 2026-07-17)
 *
 * Decisión explícita de Carlos: orden de selección de motor para tareas de
 * build creadas automáticamente desde el chat (D.7) — local primero (no
 * cuesta nada), después el CLI ya pagado del usuario (Claude Code), recién
 * al final la API de OpenRouter (gasta saldo, pero su catálogo de costo y
 * contexto se mantiene actualizado, así que sigue siendo la base para ese
 * último escalón). Esta cascada decide QUÉ TIER usar cuando el chat no fijó
 * nada explícito — no decide el modelo dentro de cada tier, eso lo sigue
 * fijando `orchestos.config.yaml` (tier api) o el default razonable del CLI
 * (tier cli). No es "un LLM decidiendo el modelo" (lo que
 * [[feedback-modelo-decision-final-carlos]] prohíbe) — es la implementación
 * de una regla que Carlos fijó él mismo, igual que orchestos.config.yaml.
 *
 * Solo cubre Claude Code como tier 'cli' por ahora. `opencode` (el otro CLI
 * que Carlos mencionó tener) queda explícitamente sin implementar — no hay
 * detección de binario ni contrato de invocación verificado para ese CLI en
 * este repo todavía (ver IDEAS.md #39, generalizar engine 'external' a más
 * binarios). Agregarlo a ciegas sin poder probar el contrato real de
 * opencode sería el mismo tipo de "silent behavior" que este Mes ya
 * encontró y arregló varias veces — mejor dejarlo pendiente y documentado
 * que fingir soporte.
 */

import type { AgentChoice } from '../config/schema.ts'
import { findClaudeBinary } from '../run/executors/external.ts'

export type CascadeTier = 'local' | 'cli' | 'api'

export interface CascadeResolution {
  tier: CascadeTier
  /** Solo presente cuando tier='cli' — task.engine a usar. */
  engine?: 'external'
  /** Modelo por defecto sugerido para ese tier. undefined en tier='api' —
   * ahí gana orchestos.config.yaml, ya es la fuente de verdad existente. */
  executorModel?: string
}

const OLLAMA_TIMEOUT_MS = 800

/** Mismo endpoint que ya usa handlers/setup.ts para el indicador de estado —
 * duplicado acá (no refactor) porque setup.ts no lo exporta y esta función
 * necesita un timeout corto propio (la cascada corre en el camino caliente
 * del chat, no puede colgar la respuesta esperando un Ollama que no está). */
async function hasLocalOllamaModels(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return false
    const data = (await res.json()) as { models?: unknown[] }
    return Array.isArray(data.models) && data.models.length > 0
  } catch {
    return false
  }
}

export async function resolveCascadeTier(): Promise<CascadeResolution> {
  if (await hasLocalOllamaModels()) return { tier: 'local' }
  if (findClaudeBinary())
    return { tier: 'cli', engine: 'external', executorModel: 'anthropic/claude-sonnet-5' }
  return { tier: 'api' }
}

/**
 * G.2 — mapea una `CascadeResolution` a los campos de `CreateTaskParams` que
 * el auto-flow del chat (`handlers/chat.ts`) le pasa a `createTaskRecord()`.
 * Solo el tier 'cli' fija algo; 'local' (sin executor de tareas todavía) y
 * 'api' (gana `orchestos.config.yaml`) devuelven `{}` a propósito — mismo
 * comportamiento que el ternario inline que reemplaza, ahora extraído como
 * función pura y sin I/O para poder testearla directo. `handleApiChat` tiene
 * un preámbulo async largo que hace racy mockear `globalThis.fetch` contra
 * él en la suite completa (ver nota en chat-effort.test.ts, BACK.3/BACK.4) —
 * la lógica que sí importa verificar vive acá, fuera de esa ventana.
 */
export function cascadeTaskFields(cascade: CascadeResolution): {
  executor_model?: string
  engine?: string
} {
  if (cascade.tier !== 'cli') return {}
  return { executor_model: cascade.executorModel, engine: cascade.engine }
}

/**
 * G.4.1/G.4.2b — [[feedback-deteccion-no-decision-automatica]]: `preferredAgent`
 * es la preferencia PERSISTENTE del usuario (`orchestos.config.yaml` `agent`,
 * ver schema.ts). Cuando está fijada, gana sobre la sugerencia de bootstrap de
 * `cascade` — la cascada solo decide cuando el usuario no configuró nada
 * todavía (`preferredAgent` undefined). `codex` fija
 * `executor_model: 'openai/gpt-5.4'` (default real del binario, ver
 * `~/.codex/config.toml`, confirmado en vivo 2026-07-27) desde que
 * `codex.ts` (G.4.2b) existe como `ExecutorEngine` real.
 *
 * CC.D1 (2026-08-17) — renombrada desde `resolveExecutorSelection()`: mismo
 * comportamiento para la creación de TAREAS (sigue anotando un
 * `executor_model` explícito en `tasks.yaml`, necesario para el registro de
 * costo del harness). Esto es DISTINTO del chat (`runClaudeChat` en
 * `executors/external.ts`), donde el modelo es opcional a propósito — ahí
 * aplica [[wiki/concepts/agent-client-protocol]] sin reservas: si no se fija
 * modelo, el CLI usa el suyo. Acá se sigue fijando uno porque una tarea
 * persistida necesita un valor concreto para su registro histórico.
 */
export function resolveAgentSelection(
  preferredAgent: AgentChoice | undefined,
  cascade: CascadeResolution,
): { executor_model?: string; engine?: string } {
  switch (preferredAgent) {
    case 'claude':
      return { executor_model: 'anthropic/claude-sonnet-5', engine: 'external' }
    case 'opencode':
      return { engine: 'opencode' }
    case 'codex':
      return { executor_model: 'openai/gpt-5.4', engine: 'codex' }
    case 'local':
    case 'api':
      return {}
    case undefined:
      return cascadeTaskFields(cascade)
  }
}
