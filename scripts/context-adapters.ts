/**
 * scripts/context-adapters.ts — H.7.2b
 *
 * Registro extensible de adaptadores de presupuesto de contexto, uno por CLI
 * agente. Reemplaza el camino único de H.7.1, que estaba atado al formato de
 * transcript de Claude Code.
 *
 * Regla que obliga esta forma (Carlos, 2026-09-03): *"las soluciones no las
 * hacemos una por modelo sino para los LLMs que vengan"*. Agregar un CLI nuevo
 * debe ser **una entrada de datos** en `DEFAULT_ADAPTERS`, no código nuevo
 * regado por el repo — mismo patrón que el registro de detección de binarios
 * (G.4.2) y que `CLI_EFFORT_LEVELS` (H.8.1).
 *
 * La detección es por **contenido** del transcript, no por su ruta: `read()`
 * devuelve `null` cuando el archivo no tiene la forma que ese CLI escribe, y
 * `readContextBudget()` se queda con el primer adaptador que responde. Elegir
 * por ruta sería frágil — las rutas cambian entre versiones y sistemas.
 *
 * Los dos adaptadores calculan de forma **distinta** y devuelven lo **mismo**;
 * ahí está el valor del registro:
 *   - `claude`: suma `input + cache_creation + cache_read` del último evento con
 *     `message.usage`, y resuelve la ventana contra el catálogo de modelos,
 *     porque su transcript no la trae.
 *   - `codex`:  lee `payload.info.last_token_usage.total_tokens` y la ventana
 *     publicada en `payload.info.model_context_window`, del propio transcript.
 */
import { readFileSync } from 'node:fs'
import {
  type BudgetThresholds,
  budgetStatus,
  contextWindowFor,
  DEFAULT_BUDGET_THRESHOLDS,
  readTranscriptUsage,
} from './context-budget.ts'

export interface ContextReading {
  /** Tokens que ocupan la ventana ahora mismo. */
  used: number
  /** Tamaño de la ventana del modelo en curso. */
  window: number
  /** Identificador del modelo tal como lo escribe el CLI; `null` si no lo publica. */
  model: string | null
}

/** Una ventana de cupo publicada por el CLI. `usedPct` nunca significa contexto. */
export interface RateLimitWindow {
  /** Identificador estable dentro del adaptador (`primary`, `secondary`, etc.). */
  id: string
  /** Porcentaje consumido de esta ventana, entre 0 y 100. */
  usedPct: number
  /** Duración publicada por el CLI; `null` cuando no la informa. */
  windowMinutes: number | null
  /** Epoch Unix en segundos; `null` cuando el CLI no publica el reset. */
  resetsAt: number | null
}

export interface ContextAdapter {
  /** Identificador del CLI; viaja al resultado como `source`. */
  id: string
  /**
   * Umbrales como **dato del adaptador**, no constantes globales: un CLI con
   * otra ventana o distinto comportamiento de compactación trae los suyos.
   */
  thresholds: BudgetThresholds
  /** `null` cuando el transcript no tiene la forma que escribe este CLI. */
  read(transcriptPath: string): Promise<ContextReading | null>
  /**
   * Ventanas de cupo de la cuenta. Es opcional porque algunos CLIs solo publican
   * contexto. Ausencia no equivale a 0%: los consumidores deben mostrar "no disponible".
   */
  readRateLimits?(transcriptPath: string): Promise<RateLimitWindow[]>
}

export interface ContextBudget extends ContextReading {
  pct: number
  level: 'ok' | 'warn' | 'critical'
  /** `id` del adaptador que produjo el número. */
  source: string
}

export interface SessionMetrics {
  context: ContextBudget
  /** `null` si el adaptador no publica cupo; nunca se inventa un cero. */
  rateLimits: { source: string; windows: RateLimitWindow[] } | null
}

/**
 * Umbrales por defecto (Carlos, 2026-09-03): avisar al 60% y escalar al 65%.
 * El 65% reemplaza al 75% original porque el autocompact de Claude Code
 * dispara a ~78% y `autoCompact: false` es ignorado en la práctica
 * (anthropics/claude-code#18264): el margen tiene que absorber un turno pesado
 * entero, o el aviso llega después de la compactación que existe para evitar.
 */
export const DEFAULT_THRESHOLDS: BudgetThresholds = { warn: 60, critical: 65 }

/**
 * Claude Code — el transcript no publica la ventana, así que se resuelve por
 * catálogo. Es el código de H.7.1, movido detrás de la interfaz del registro.
 *
 * El puente por statusline (Claude Code sí entrega `used_percentage` ya
 * calculado ahí) se evaluó y se **descartó**: el slot `statusLine` de esta
 * máquina está ocupado por software de terceros, y además solo existe en
 * Claude Code — justo el atajo por-proveedor que este registro evita. Detalle
 * y evidencia en PLAN.md § H.7.2b, alcance 2.
 */
export const claudeAdapter: ContextAdapter = {
  id: 'claude',
  thresholds: DEFAULT_THRESHOLDS,
  async read(transcriptPath) {
    const usage = readTranscriptUsage(transcriptPath)
    if (!usage) return null
    const window = await contextWindowFor(usage.model)
    // Sin ventana publicada no se avisa: un porcentaje sobre una ventana
    // inventada es peor que el silencio (mismo criterio que H.7.1).
    if (!window) return null
    return { used: usage.used, window, model: usage.model }
  },
}

/**
 * Codex CLI — contrato verificado en vivo sobre
 * `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (2026-09-03).
 *
 * El evento es `payload.type === 'token_count'`; el campo que ocupa la ventana
 * es `info.last_token_usage.total_tokens`. **No** `total_token_usage`: ese es
 * el acumulado de la sesión entera (5.847.113 tokens medidos contra una
 * ventana de 258.400, 22× de más) y usarlo daría un porcentaje absurdo.
 * `openai/codex#17618` menciona `token_count`, pero ese es el nombre del
 * evento, no el del campo.
 */
export const codexAdapter: ContextAdapter = {
  id: 'codex',
  thresholds: DEFAULT_THRESHOLDS,
  async read(transcriptPath) {
    let latest: ContextReading | null = null
    for (const line of readFileSync(transcriptPath, 'utf-8').split('\n')) {
      if (line.trim() === '') continue
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        // Codex también puede dejar la última línea a medio escribir.
        continue
      }
      const payload = objectAt(parsed, 'payload')
      if (payload?.type !== 'token_count') continue
      const info = objectAt(payload, 'info')
      const used = positiveNumber(objectAt(info, 'last_token_usage')?.total_tokens)
      const window = positiveNumber(info?.model_context_window)
      if (used === null || window === null) continue
      latest = { used, window, model: stringAt(payload, 'model') }
    }
    return latest
  },
  async readRateLimits(transcriptPath) {
    let latest: RateLimitWindow[] = []
    for (const line of readFileSync(transcriptPath, 'utf-8').split('\n')) {
      if (line.trim() === '') continue
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }
      const payload = objectAt(parsed, 'payload')
      if (payload?.type !== 'token_count') continue
      const limits = objectAt(payload, 'rate_limits')
      if (!limits) continue
      latest = ['primary', 'secondary'].flatMap((id) => {
        const window = objectAt(limits, id)
        const usedPct = percentage(window?.used_percent)
        if (!window || usedPct === null) return []
        return [
          {
            id,
            usedPct,
            windowMinutes: positiveNumber(window.window_minutes),
            resetsAt: positiveNumber(window.resets_at),
          },
        ]
      })
    }
    return latest
  },
}

/** Agregar un CLI nuevo es agregar una entrada acá, no escribir un camino nuevo. */
export const DEFAULT_ADAPTERS: ContextAdapter[] = [claudeAdapter, codexAdapter]

/**
 * Primer adaptador que reconoce el transcript gana. `null` si ninguno lo
 * reconoce o si el archivo no se puede leer: el llamador **falla abierto** —
 * un hook que rompe el turno es peor que un hook que no avisa.
 */
export async function readContextBudget(
  transcriptPath: string,
  adapters: ContextAdapter[] = DEFAULT_ADAPTERS,
): Promise<ContextBudget | null> {
  return (await readSessionMetrics(transcriptPath, adapters))?.context ?? null
}

/**
 * Contrato H.7.5: contexto de sesión y cupo de cuenta viajan separados aunque
 * provengan del mismo adaptador. Agregar un CLI no cambia endpoint ni UI.
 */
export async function readSessionMetrics(
  transcriptPath: string,
  adapters: ContextAdapter[] = DEFAULT_ADAPTERS,
): Promise<SessionMetrics | null> {
  for (const adapter of adapters) {
    let reading: ContextReading | null
    try {
      reading = await adapter.read(transcriptPath)
    } catch {
      continue
    }
    if (!reading) continue
    const status = budgetStatus({
      used: reading.used,
      window: reading.window,
      thresholds: adapter.thresholds ?? DEFAULT_BUDGET_THRESHOLDS,
    })
    let windows: RateLimitWindow[] = []
    try {
      windows = (await adapter.readRateLimits?.(transcriptPath)) ?? []
    } catch {
      // Un cupo ilegible no invalida una lectura de contexto correcta.
    }
    return {
      context: { ...reading, pct: status.pct, level: status.level, source: adapter.id },
      rateLimits: windows.length > 0 ? { source: adapter.id, windows } : null,
    }
  }
  return null
}

function objectAt(value: unknown, key: string): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const child = (value as Record<string, unknown>)[key]
  if (typeof child !== 'object' || child === null || Array.isArray(child)) return null
  return child as Record<string, unknown>
}

function stringAt(value: Record<string, unknown> | null, key: string): string | null {
  const found = value?.[key]
  return typeof found === 'string' && found.trim() !== '' ? found : null
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function percentage(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null
}
