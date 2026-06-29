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
  /** True si OpenRouter publica `"reasoning"` en `supported_parameters` para este modelo. */
  supportsReasoning: boolean
}

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
      pricing?: { prompt?: string }
      supported_parameters?: string[]
    }>
  }
  const models: Record<string, ModelInfo> = {}
  for (const m of data.data ?? []) {
    if (!m.id) continue
    // AR.7: Number(m.pricing.prompt) da NaN si el string no es numérico (p.ej.
    // un valor "free" o malformado) — NaN se serializa como null en el cache de
    // disco, contaminando el catálogo para cualquier consumidor futuro de precio.
    const rawPrice = m.pricing?.prompt !== undefined ? Number(m.pricing.prompt) * 1_000_000 : 0
    models[m.id] = {
      contextLength: typeof m.context_length === 'number' ? m.context_length : 0,
      priceIn: Number.isFinite(rawPrice) ? rawPrice : 0,
      supportsReasoning: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('reasoning'),
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

/** Solo para tests: limpia el estado en memoria. */
export function _resetCatalog(): void {
  memoryCatalog = null
  memoryFetchedAt = 0
}
