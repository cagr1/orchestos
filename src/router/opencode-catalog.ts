/**
 * Catálogo de modelos OpenRouter reconocidos por opencode.
 *
 * models.dev publica los ids del namespace OpenRouter en formato
 * `provider/model`; opencode los recibe como `openrouter/provider/model`.
 * Este módulo cachea solo las claves conocidas para permitir una traducción
 * síncrona y fail-safe.
 */

import { join, dirname } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

interface DiskCache {
  fetchedAt: number
  models: string[]
}

const TTL_MS = 24 * 60 * 60 * 1000
const MODELS_DEV_URL = 'https://models.dev/api.json'

function cacheFilePath(): string {
  const home = process.env.ORCHESTOS_HOME || homedir()
  return join(home, '.orchestos', 'cache', 'opencode-models.json')
}

let memoryCatalog: Set<string> | null = null
let memoryFetchedAt = 0

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < TTL_MS
}

function loadDiskCache(): DiskCache | null {
  try {
    const path = cacheFilePath()
    if (!existsSync(path)) return null
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as DiskCache
    if (
      typeof raw?.fetchedAt !== 'number' ||
      !Array.isArray(raw?.models) ||
      !raw.models.every((model) => typeof model === 'string')
    ) return null
    return raw
  } catch {
    return null
  }
}

function saveDiskCache(cache: DiskCache): void {
  if (process.env.NODE_ENV === "test" && !process.env.ORCHESTOS_HOME) return
  try {
    const path = cacheFilePath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(cache, null, 2), 'utf-8')
  } catch {
    /* best-effort — el cache es una optimización, no una garantía */
  }
}

async function fetchCatalogKeys(): Promise<string[]> {
  const res = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`models.dev fetch failed: ${res.status}`)
  const data = (await res.json()) as {
    openrouter?: { models?: Record<string, unknown> }
  }
  const models = data.openrouter?.models
  if (!models || typeof models !== 'object' || Array.isArray(models)) {
    throw new Error('models.dev response has no valid openrouter.models catalog')
  }
  return Object.keys(models)
}

/** Carga el catálogo models.dev en memoria; nunca lanza y usa caché stale offline. */
export async function ensureOpencodeCatalogLoaded(opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force && memoryCatalog && isFresh(memoryFetchedAt)) return

  const disk = loadDiskCache()
  if (!opts.force && disk && isFresh(disk.fetchedAt)) {
    memoryCatalog = new Set(disk.models)
    memoryFetchedAt = disk.fetchedAt
    return
  }

  try {
    const models = await fetchCatalogKeys()
    const fetchedAt = Date.now()
    saveDiskCache({ fetchedAt, models })
    memoryCatalog = new Set(models)
    memoryFetchedAt = fetchedAt
    return
  } catch {
    /* fall through: cache vencido es mejor que nada */
  }

  if (disk) {
    memoryCatalog = new Set(disk.models)
    memoryFetchedAt = Date.now()
  }
}

export function getOpencodeCatalog(): Set<string> | null {
  return memoryCatalog
}

/** Solo para tests — mismo propósito que `_resetCatalog()` en model-catalog.ts. */
export function _resetOpencodeCatalog(): void {
  memoryCatalog = null
  memoryFetchedAt = 0
}
