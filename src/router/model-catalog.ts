/**
 * src/router/model-catalog.ts
 *
 * Fuente de verdad del contexto real por modelo.
 *
 * El motor NO debe adivinar la ventana de contexto de un modelo por su nombre:
 * un modelo de ventana chica (p.ej. gpt-3.5, 16K) tratado como 128K deja pasar
 * prompts que lo hacen alucinar o truncar. OpenRouter publica `context_length`
 * exacto por cada modelo en /api/v1/models — este módulo lo trae, lo cachea en
 * disco con TTL, y lo expone como lookup síncrono.
 *
 * Precedencia (de más a menos confiable):
 *   1. catálogo OpenRouter en memoria (fresco)        ← número real publicado
 *   2. catálogo en disco (~/.orchestos/cache/models.json, TTL 24h)
 *   3. red (OpenRouter) → guarda en disco
 *   4. tabla de familias hardcodeada (context-monitor) ← offline / id desconocido / Ollama local
 *
 * Nunca lanza: ante cualquier fallo cae a la tabla de familias. Eso importa
 * porque OrchestOS también corre modelos Ollama locales que no están en OpenRouter.
 */

import { join, dirname } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { getModelContextWindow } from '../hooks/context-monitor.ts'
import { tryLoadApiKey } from '../providers/openrouter.ts'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export interface ModelInfo {
  /** Ventana de contexto real en tokens, según OpenRouter. */
  contextLength: number
  /** Precio de prompt en USD por 1M tokens (para reuso futuro en routing por costo). */
  priceIn: number
  /** Precio de completion en USD por 1M tokens. */
  priceOut: number
  /** True si OpenRouter publica `"reasoning"` en `supported_parameters` para este modelo. */
  supportsReasoning: boolean
  /** True si OpenRouter publica `"tools"` en `supported_parameters` para este modelo (function calling real, no solo Claude/GPT/Gemini). */
  supportsTools: boolean
  /** Tope real de tokens de salida del proveedor (`top_provider.max_completion_tokens`), 0 si desconocido. */
  maxOutputTokens: number
  /** True si OpenRouter publica `"image"` en `architecture.input_modalities` — el modelo acepta input multimodal (visión). */
  supportsVision: boolean
}

/** Fallback cuando el modelo no está en catálogo (offline / id desconocido / Ollama local) — mismo valor que se usaba hardcodeado antes de leer el catálogo real. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192

interface DiskCache {
  fetchedAt: number
  models: Record<string, ModelInfo>
}

const TTL_MS = 24 * 60 * 60 * 1000
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

/** Honra ORCHESTOS_HOME para tests; por defecto ~/.orchestos (misma convención que sqlite.ts y skills/fetch.ts). */
function cacheFilePath(): string {
  const home = process.env.ORCHESTOS_HOME || homedir()
  return join(home, '.orchestos', 'cache', 'models.json')
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let memoryCatalog: Map<string, ModelInfo> | null = null
let memoryFetchedAt = 0

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < TTL_MS
}

// ---------------------------------------------------------------------------
// Disk cache
// ---------------------------------------------------------------------------

function loadDiskCache(): DiskCache | null {
  try {
    const path = cacheFilePath()
    if (!existsSync(path)) return null
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as DiskCache
    if (typeof raw?.fetchedAt !== 'number' || typeof raw?.models !== 'object' || raw.models === null) return null
    return raw
  } catch {
    return null
  }
}

function saveDiskCache(cache: DiskCache): void {
  // Bug real encontrado en vivo (Mes 19, Bloque C.3, 2026-07-09): `bun test`
  // corre ~58 archivos en el mismo proceso; varios tests mutan
  // `process.env.ORCHESTOS_HOME` (beforeEach/afterEach) mientras OTROS tests
  // (`chat-effort.test.ts`, `planner-fc.test.ts`) invocan `ensureCatalogLoaded()`
  // real SIN override, confiando en `~/.orchestos` real. `cacheFilePath()` relee
  // `process.env.ORCHESTOS_HOME` en cada llamada (no lo captura una sola vez),
  // así que una carrera entre ambos deja escribir el catálogo FAKE de un test
  // (un solo modelo, `supportsVision:false` a propósito) al cache REAL de disco
  // — reproducido de forma consistente corriendo la suite completa dos veces
  // seguidas, nunca con <4 archivos a la vez. Con TTL de 24h esto rompía en
  // silencio el gating de visión/razonamiento/tools del dashboard real durante
  // un día entero cada vez que corría `bun test`. Guard: bajo `bun test`
  // (`NODE_ENV=test`, seteado automáticamente por el runner) sin un
  // `ORCHESTOS_HOME` explícito, jamás escribir al cache real — el catálogo en
  // memoria del proceso de test sigue funcionando igual, solo no persiste.
  if (process.env.NODE_ENV === 'test' && !process.env.ORCHESTOS_HOME) return
  try {
    const path = cacheFilePath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(cache, null, 2), 'utf-8')
  } catch {
    /* best-effort — el cache es una optimización, no una garantía */
  }
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

async function fetchFromOpenRouter(apiKey: string): Promise<Record<string, ModelInfo>> {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`OpenRouter models fetch failed: ${res.status}`)
  const data = (await res.json()) as {
    data?: Array<{
      id?: string
      context_length?: number
      pricing?: { prompt?: string; completion?: string }
      supported_parameters?: string[]
      top_provider?: { max_completion_tokens?: number }
      architecture?: { input_modalities?: string[] }
    }>
  }
  const models: Record<string, ModelInfo> = {}
  for (const m of data.data ?? []) {
    if (!m.id) continue
    // AR.7: Number(m.pricing.prompt) da NaN si el string no es numérico (p.ej.
    // un valor "free" o malformado) — NaN se serializa como null en el cache de
    // disco, contaminando el catálogo para cualquier consumidor futuro de precio.
    const rawPriceIn = m.pricing?.prompt !== undefined ? Number(m.pricing.prompt) * 1_000_000 : 0
    const rawPriceOut = m.pricing?.completion !== undefined ? Number(m.pricing.completion) * 1_000_000 : 0
    models[m.id] = {
      contextLength: typeof m.context_length === 'number' ? m.context_length : 0,
      priceIn: Number.isFinite(rawPriceIn) ? rawPriceIn : 0,
      priceOut: Number.isFinite(rawPriceOut) ? rawPriceOut : 0,
      supportsReasoning: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('reasoning'),
      supportsTools: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('tools'),
      maxOutputTokens: typeof m.top_provider?.max_completion_tokens === 'number' ? m.top_provider.max_completion_tokens : 0,
      supportsVision: Array.isArray(m.architecture?.input_modalities) && m.architecture!.input_modalities!.includes('image'),
    }
  }
  return models
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Carga el catálogo en memoria. Llamar una vez al inicio de la sesión
 * (el harness lo hace antes del check de context-monitor). Es idempotente y
 * barata: noop si la memoria ya está fresca, y a lo sumo un fetch de red por
 * proceso cuando el cache de disco está vencido o ausente. Nunca lanza.
 */
export async function ensureCatalogLoaded(opts: { force?: boolean; apiKey?: string } = {}): Promise<void> {
  if (!opts.force && memoryCatalog && isFresh(memoryFetchedAt)) return

  const disk = loadDiskCache()
  if (!opts.force && disk && isFresh(disk.fetchedAt)) {
    memoryCatalog = new Map(Object.entries(disk.models))
    memoryFetchedAt = disk.fetchedAt
    return
  }

  const apiKey = opts.apiKey ?? tryLoadApiKey()
  if (apiKey) {
    try {
      const models = await fetchFromOpenRouter(apiKey)
      if (Object.keys(models).length > 0) {
        const fetchedAt = Date.now()
        saveDiskCache({ fetchedAt, models })
        memoryCatalog = new Map(Object.entries(models))
        memoryFetchedAt = fetchedAt
        return
      }
    } catch {
      /* fall through: cache vencido es mejor que nada */
    }
  }

  // Sin red / sin key: usa el cache vencido si existe (mejor que la tabla a secas).
  // AR.2 — memoryFetchedAt se marca con Date.now(), NO con disk.fetchedAt: si
  // dejáramos el timestamp vencido, isFresh() seguiría dando false y el próximo
  // ensureCatalogLoaded() de este mismo proceso volvería a intentar el fetch
  // (10s de timeout) en cada tarea del grafo. Marcar "ya lo intenté ahora" evita
  // reintentos repetidos dentro de la misma corrida — a lo sumo un intento real.
  if (disk) {
    memoryCatalog = new Map(Object.entries(disk.models))
    memoryFetchedAt = Date.now()
  }
}

/**
 * Ventana de contexto real de un modelo, síncrona.
 * Match exacto en el catálogo OpenRouter (autoritativo) → su context_length.
 * Si no está cargado o el id no existe → tabla de familias de context-monitor.
 * Funciona sin `ensureCatalogLoaded()` previo; solo que entonces usa el fallback.
 */
/** Returns the in-memory catalog (null if not yet loaded). Used by calcCost in pricing.ts. */
export function getCatalog(): Map<string, ModelInfo> | null {
  return memoryCatalog
}

export function contextWindowFor(modelId: string): number {
  const entry = memoryCatalog?.get(modelId)
  if (entry && entry.contextLength > 0) return entry.contextLength
  return getModelContextWindow(modelId)
}

/** True si el id tiene contexto real (no fallback). Útil para diagnósticos/UI. */
export function hasRealContextWindow(modelId: string): boolean {
  const entry = memoryCatalog?.get(modelId)
  return !!entry && entry.contextLength > 0
}

/**
 * True si el modelo acepta `reasoning: { effort }` en el body del chat completions
 * de OpenRouter (publicado en `supported_parameters`). False si no está en el
 * catálogo (offline, id desconocido, Ollama local) — nunca asume soporte sin dato real.
 */
export function supportsReasoningEffort(modelId: string): boolean {
  return !!memoryCatalog?.get(modelId)?.supportsReasoning
}

/**
 * J.2 (Mes 18) — True si el modelo acepta input de imagen (`architecture.input_modalities`
 * incluye `"image"` en OpenRouter). Bug real encontrado en dogfooding (2026-07-09): el chat
 * mandaba el `image_url` block sin chequear esto — con un modelo sin visión la imagen se
 * ignoraba en silencio. False si el catálogo no tiene el id — nunca asume soporte sin dato real
 * (mismo fail-safe que supportsReasoningEffort/catalogSupportsTools).
 */
export function supportsVisionInput(modelId: string): boolean {
  if (modelId.startsWith('ollama/')) return false
  return !!memoryCatalog?.get(modelId)?.supportsVision
}

/**
 * True si el modelo soporta function calling real según OpenRouter (publicado en
 * `supported_parameters`). Reemplaza la lista fija de prefijos (`anthropic/`,
 * `openai/`, `google/gemini`) que `supportsToolCalling()` (tool-call.ts) usaba
 * antes — esa lista dejaba afuera modelos que sí soportan tools (deepseek, grok,
 * qwen, mistral, etc.), causando que el chat corriera SIN ninguna tool (ni
 * siquiera `read_plan`/`read_tasks`) contra el modelo default. False si el
 * catálogo no tiene el id (offline, Ollama local) — nunca asume soporte sin dato real.
 */
export function catalogSupportsTools(modelId: string): boolean {
  return !!memoryCatalog?.get(modelId)?.supportsTools
}

/**
 * Tope real de tokens de salida (`top_provider.max_completion_tokens`), síncrono.
 * Mismo principio que `contextWindowFor`: no adivinar por el nombre del modelo,
 * usar el dato real publicado por OpenRouter. Si no está en catálogo (offline, id
 * desconocido, Ollama local) → DEFAULT_MAX_OUTPUT_TOKENS (mismo valor que el
 * hardcode histórico), nunca 0 — un `max_tokens:0` en el body rompería el request.
 */
export function maxOutputTokensFor(modelId: string): number {
  const entry = memoryCatalog?.get(modelId)
  if (entry && entry.maxOutputTokens > 0) return entry.maxOutputTokens
  return DEFAULT_MAX_OUTPUT_TOKENS
}

/**
 * Mes 22/E.1 — tope real de salida SIN el fallback a DEFAULT (8192). Devuelve
 * `0` cuando el catálogo no lo publica (ej. `deepseek/deepseek-v4-flash`),
 * preservando la distinción "tope real conocido" vs "sin info" que
 * `maxOutputTokensFor()` destruye al colapsar todo en 8192.
 *
 * Por qué existe: la regla de Carlos ([[feedback-context-no-max-tokens]],
 * 2026-06-30, "no reabrir") es que `max_tokens` se deriva de `contextWindow −
 * prompt`, NUNCA de un tope de catálogo poco confiable. El único uso legítimo
 * del tope de catálogo es un clamp de SEGURIDAD hacia abajo cuando el proveedor
 * SÍ publica un límite real menor que la ventana (caso gpt-4o-mini: ventana
 * 128K pero salida real 16384 → sin clamp da 400). Ese clamp solo debe aplicar
 * cuando el dato es real (>0); con 0/desconocido no se clampa nada — se usa el
 * presupuesto completo de la ventana. Meter 8192 ahí es exactamente el bug que
 * truncó tareas a mitad de generación (regresión reintroducida por G.5).
 */
export function knownMaxOutputTokensFor(modelId: string): number {
  const entry = memoryCatalog?.get(modelId)
  return entry && entry.maxOutputTokens > 0 ? entry.maxOutputTokens : 0
}

/** Solo para tests: limpia el estado en memoria. */
export function _resetCatalog(): void {
  memoryCatalog = null
  memoryFetchedAt = 0
}
