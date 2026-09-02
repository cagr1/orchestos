#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import {
  contextWindowFor as catalogContextWindowFor,
  ensureCatalogLoaded,
  getCatalog,
  hasRealContextWindow,
} from '../src/router/model-catalog.ts'

export interface TranscriptUsage {
  used: number
  model: string | null
}

export interface BudgetThresholds {
  warn: number
  critical: number
}

export interface BudgetStatus {
  pct: number
  level: 'ok' | 'warn' | 'critical'
}

export const DEFAULT_BUDGET_THRESHOLDS: BudgetThresholds = {
  warn: 60,
  critical: 75,
}

/** Lee el último uso real del transcript; líneas parcialmente escritas se ignoran. */
export function readTranscriptUsage(transcriptPath: string): TranscriptUsage | null {
  let latest: TranscriptUsage | null = null
  const lines = readFileSync(transcriptPath, 'utf-8').split('\n')

  for (const line of lines) {
    if (line.trim() === '') continue
    try {
      const parsed = JSON.parse(line) as unknown
      const message = valueAt(parsed, 'message')
      const usage = valueAt(message, 'usage')
      if (!usage) continue

      latest = {
        used:
          nonNegativeNumber(fieldAt(usage, 'input_tokens')) +
          nonNegativeNumber(fieldAt(usage, 'cache_creation_input_tokens')) +
          nonNegativeNumber(fieldAt(usage, 'cache_read_input_tokens')),
        model: stringAt(message, 'model') ?? stringAt(parsed, 'model'),
      }
    } catch {
      // Claude puede dejar el último JSON truncado mientras escribe el transcript.
    }
  }

  return latest
}

/**
 * Usa solo una ventana publicada por el catálogo: no cae al fallback por familia,
 * porque un aviso con una ventana inventada es peor que el silencio.
 */
export async function contextWindowFor(model: string | null): Promise<number | null> {
  const catalogModel = await catalogModelIdFor(model)
  return catalogModel ? catalogContextWindowFor(catalogModel) : null
}

/**
 * Une el identificador que un CLI deja en su transcript con el catálogo sin
 * codificar proveedores. Un match exacto gana; si falta el provider, solo se
 * acepta el slug normalizado cuando el catálogo publicado da una única opción.
 * Cero o varias opciones sigue siendo desconocido: nunca se adivina ventana.
 */
export async function catalogModelIdFor(model: string | null): Promise<string | null> {
  if (!model) return null
  // apiKey vacío: carga exclusivamente memoria/disco y nunca hace red ni escribe cache.
  await ensureCatalogLoaded({ apiKey: '' })
  if (hasRealContextWindow(model)) return model
  // Un ID ya calificado que no existe no se "arregla" por su segmento final:
  // `unknown/model` no puede heredar la ventana de `known/model`.
  if (model.includes('/')) return null

  const slug = normalizedModelSlug(model)
  if (!slug) return null
  const matches = [...(getCatalog()?.entries() ?? [])]
    .filter(([id, info]) => info.contextLength > 0 && normalizedModelSlug(id) === slug)
    .map(([id]) => id)
  return matches.length === 1 ? (matches[0] ?? null) : null
}

function normalizedModelSlug(model: string): string {
  const slug = model.trim().toLowerCase().split('/').at(-1)
  return slug ? slug.replace(/[._-]+/g, '-') : ''
}

export function budgetStatus(input: {
  used: number
  window: number
  thresholds?: BudgetThresholds
}): BudgetStatus {
  const thresholds = input.thresholds ?? DEFAULT_BUDGET_THRESHOLDS
  if (!Number.isFinite(input.used) || input.used < 0) throw new Error('used must be non-negative')
  if (!Number.isFinite(input.window) || input.window <= 0)
    throw new Error('window must be positive')
  if (
    !Number.isFinite(thresholds.warn) ||
    !Number.isFinite(thresholds.critical) ||
    thresholds.warn < 0 ||
    thresholds.critical < thresholds.warn
  ) {
    throw new Error('invalid budget thresholds')
  }

  const pct = (input.used / input.window) * 100
  return {
    pct,
    level: pct >= thresholds.critical ? 'critical' : pct >= thresholds.warn ? 'warn' : 'ok',
  }
}

function valueAt(value: unknown, key: string): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const child = (value as Record<string, unknown>)[key]
  if (typeof child !== 'object' || child === null || Array.isArray(child)) return null
  return child as Record<string, unknown>
}

function stringAt(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const found = (value as Record<string, unknown>)[key]
  return typeof found === 'string' && found.trim() !== '' ? found : null
}

function fieldAt(value: Record<string, unknown> | null, key: string): unknown {
  return value?.[key]
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

if (import.meta.main) {
  const transcriptFlag = process.argv.indexOf('--transcript')
  const transcriptPath = transcriptFlag >= 0 ? process.argv[transcriptFlag + 1] : undefined
  if (!transcriptPath) {
    console.error('Usage: bun run context:budget -- --transcript <path>')
    process.exit(1)
  }

  try {
    const usage = readTranscriptUsage(transcriptPath)
    if (!usage) {
      console.log(JSON.stringify({ used: null, model: null, window: null, pct: null, level: null }))
      process.exit(0)
    }
    const window = await contextWindowFor(usage.model)
    const status = window ? budgetStatus({ used: usage.used, window }) : null
    console.log(
      JSON.stringify({
        used: usage.used,
        model: usage.model,
        window,
        pct: status?.pct ?? null,
        level: status?.level ?? null,
      }),
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
