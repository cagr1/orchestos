import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { parse } from 'yaml'
import { orchestosDir } from '../config/orchestos-home.ts'
import type { TaskClass } from '../router/classify.ts'
import { excludeRuntimeArtifacts } from '../run/git-exclude.ts'

export type SkillTarget = 'claude' | 'cursor' | 'openai'

export interface SkillExample {
  title: string
  input: string
  output: string
}

export interface LanguageTarget {
  verifiers?: string[]
  anti_patterns?: string[]
}

export interface SkillRationalization {
  excuse: string
  refutation: string
}

export type SkillActivationMode = 'automatic' | 'suggest' | 'explicit'

// O.0 (Bloque O, 2026-08-02) — contrato de activación mínimo, 3 campos y
// nada más (ver PLAN.md § Bloque O para el porqué de cada uno y de lo
// descartado). `phases` reusa `TaskClass` — a propósito no se inventa una
// taxonomía de fase propia para skills.
export interface SkillActivation {
  mode: SkillActivationMode
  /** Solo para gates: señales deterministas/observables, nunca juicio del LLM que hace el trabajo. */
  triggers?: string[]
  phases?: TaskClass[]
}

export interface SkillDef {
  id: string
  version: string
  name: string
  description: string
  instructions: string
  targets: SkillTarget[]
  when_to_use?: string[]
  inputs_required?: string[]
  verifiers?: string[]
  anti_patterns?: string[]
  examples?: SkillExample[]
  language_targets?: Record<string, LanguageTarget>
  allowed_tools?: string[]
  iron_law?: string
  common_rationalizations?: SkillRationalization[]
  red_flags?: string[]
  activation?: SkillActivation
  source?: { url: string; fetchedAt: string }
}

const IRON_LAW_MAX_LENGTH = 300

const VALID_TARGETS: SkillTarget[] = ['claude', 'cursor', 'openai']
const VALID_ACTIVATION_MODES: SkillActivationMode[] = ['automatic', 'suggest', 'explicit']
const VALID_TASK_CLASSES: TaskClass[] = ['plan', 'implement', 'fix', 'review', 'doc']

/**
 * O.1 (Bloque O, 2026-08-03) — las skills viven CENTRALIZADAS en la instalación
 * de OrchestOS, no copiadas en cada proyecto gestionado. Mismo patrón y misma
 * decisión que los roadmaps (decisión M, 2026-07-30, "centralizado, no
 * copiado"): se prueba el proyecto primero y se cae a la instalación.
 *
 * Antes `getSkillsDir()` era `join(process.cwd(), 'skills')` **sin fallback**:
 * cuando OrchestOS gestionaba otro proyecto, ahí no hay carpeta `skills/`,
 * `listSkillFiles()` devolvía `[]` y **no se activaba ninguna skill jamás**.
 * Todo el Bloque O habría funcionado solo dentro de este repo.
 *
 * Lectura y escritura NO son simétricas, a propósito:
 * - leer  → proyecto, biblioteca del usuario, instalación como fallback (`resolveSkillPath`)
 * - escribir → SIEMPRE el proyecto (`getSkillPath`), nunca la instalación:
 *   crear/editar una skill mientras se gestiona otro repo no debe mutar el
 *   OrchestOS instalado. Es la misma excepción que `project-profile.md` en la
 *   decisión M.
 */
const SKILLS_INSTALL_ROOT = join(import.meta.dir, '..', '..')

/** Carpeta de skills del proyecto en curso. Destino de toda ESCRITURA. */
function getSkillsDir(root = process.cwd()): string {
  return join(root, 'skills')
}

/** Carpeta de skills de la instalación de OrchestOS. Solo LECTURA. */
function getInstallSkillsDir(): string {
  return join(SKILLS_INSTALL_ROOT, 'skills')
}

/**
 * Ruta de la que LEER una skill: la del proyecto gana; si no existe, la
 * biblioteca del usuario y luego la instalación. Devuelve la ruta del proyecto cuando no hay ninguna, para que
 * el mensaje de error apunte a donde el usuario esperaría crearla.
 */
export function resolveSkillPath(id: string, root = process.cwd()): string {
  const entry = listSkillFilesWithOrigin(root).find(
    ({ path }) => basename(path).replace(/\.ya?ml$/, '') === id,
  )
  if (entry) return entry.path
  const own = join(getSkillsDir(root), `${id}.yaml`)
  const centralPro = join(getInstallSkillsDir(), 'pro', `${id}.yaml`)
  if (existsSync(centralPro)) return centralPro
  return own
}

/**
 * Une los `.yaml` del proyecto con los de la instalación, **el proyecto gana**
 * ante mismo id. Dedupe por nombre de archivo, no por ruta: si `cwd` es la
 * propia instalación (OrchestOS trabajando sobre sí mismo) las dos carpetas son
 * la misma y sin dedupe cada skill aparecería dos veces.
 */
function mergeSkillDirs(ownDir: string, installDir: string): string[] {
  const byName = new Map<string, string>()
  for (const dir of [installDir, ownDir]) {
    // ownDir segundo: pisa al central
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.yaml') && !f.endsWith('.yml')) continue
      byName.set(f, join(dir, f))
    }
  }
  return [...byName.values()]
}

export function validateSkill(raw: Record<string, unknown>, filePath: string): SkillDef {
  const err = (msg: string) => {
    throw new Error(`[skill:${filePath}] ${msg}`)
  }

  if (!raw.id || typeof raw.id !== 'string')
    err('missing or invalid "id" (must be kebab-case string)')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw.id as string))
    err(`"id" must be kebab-case, got: ${raw.id}`)
  if (!raw.version || typeof raw.version !== 'string') err('missing "version" (e.g. 1.0.0)')
  if (!raw.name || typeof raw.name !== 'string') err('missing "name"')
  if (!raw.description || typeof raw.description !== 'string') err('missing "description"')
  if ((raw.description as string).length > 1024) err('"description" exceeds 1024 chars')
  if (!raw.instructions || typeof raw.instructions !== 'string') err('missing "instructions"')
  if ((raw.instructions as string).length > 32000) err('"instructions" exceeds 32000 chars')
  if (!Array.isArray(raw.targets) || raw.targets.length === 0)
    err('"targets" must be a non-empty array')
  for (const t of raw.targets as string[]) {
    if (!VALID_TARGETS.includes(t as SkillTarget))
      err(`invalid target "${t}" — valid: ${VALID_TARGETS.join(', ')}`)
  }

  if (raw.allowed_tools !== undefined) {
    if (!Array.isArray(raw.allowed_tools)) err('"allowed_tools" must be an array of strings')
    for (const tool of raw.allowed_tools as string[]) {
      if (typeof tool !== 'string')
        err(`"allowed_tools" entries must be strings, got ${typeof tool}`)
    }
  }

  if (raw.iron_law !== undefined) {
    if (typeof raw.iron_law !== 'string' || raw.iron_law.length === 0)
      err('"iron_law" must be a non-empty string')
    if ((raw.iron_law as string).length > IRON_LAW_MAX_LENGTH)
      err(`"iron_law" exceeds ${IRON_LAW_MAX_LENGTH} chars — it's a rule, not a paragraph`)
  }

  if (raw.common_rationalizations !== undefined) {
    if (!Array.isArray(raw.common_rationalizations) || raw.common_rationalizations.length === 0) {
      err('"common_rationalizations" must be a non-empty array')
    }
    for (const r of raw.common_rationalizations as Record<string, unknown>[]) {
      if (typeof r !== 'object' || r === null)
        err('"common_rationalizations" entries must be objects with "excuse" and "refutation"')
      if (!r.excuse || typeof r.excuse !== 'string')
        err('"common_rationalizations" entry missing string "excuse"')
      if (!r.refutation || typeof r.refutation !== 'string')
        err('"common_rationalizations" entry missing string "refutation"')
    }
  }

  if (raw.red_flags !== undefined) {
    if (!Array.isArray(raw.red_flags) || raw.red_flags.length === 0)
      err('"red_flags" must be a non-empty array')
    for (const f of raw.red_flags as string[]) {
      if (typeof f !== 'string') err(`"red_flags" entries must be strings, got ${typeof f}`)
    }
  }

  if (raw.activation !== undefined) {
    const activation = raw.activation as Record<string, unknown>
    if (typeof activation !== 'object' || activation === null) err('"activation" must be an object')
    if (!VALID_ACTIVATION_MODES.includes(activation.mode as SkillActivationMode)) {
      err(
        `"activation.mode" must be one of: ${VALID_ACTIVATION_MODES.join(', ')} — got: ${activation.mode}`,
      )
    }
    if (activation.triggers !== undefined) {
      if (!Array.isArray(activation.triggers) || activation.triggers.length === 0) {
        err('"activation.triggers" must be a non-empty array')
      }
      for (const t of activation.triggers as string[]) {
        if (typeof t !== 'string')
          err(`"activation.triggers" entries must be strings, got ${typeof t}`)
      }
    }
    if (activation.phases !== undefined) {
      if (!Array.isArray(activation.phases) || activation.phases.length === 0) {
        err('"activation.phases" must be a non-empty array')
      }
      for (const p of activation.phases as string[]) {
        if (!VALID_TASK_CLASSES.includes(p as TaskClass)) {
          err(`"activation.phases" entry invalid: "${p}" — valid: ${VALID_TASK_CLASSES.join(', ')}`)
        }
      }
    }
  }

  return raw as unknown as SkillDef
}

export function loadSkill(filePath: string): SkillDef {
  const content = readFileSync(filePath, 'utf-8')
  const raw = parse(content) as Record<string, unknown>
  return validateSkill(raw, filePath)
}

export type SkillOrigin = 'project' | 'user-library' | 'built-in'

export function getUserSkillsDir(): string {
  return join(orchestosDir(), 'skills')
}

export function getEnabledSkillIds(root = process.cwd()): Set<string> {
  try {
    const state = JSON.parse(readFileSync(join(root, '.orchestos', 'skills.json'), 'utf8'))
    if (
      !Array.isArray(state.enabled) ||
      state.enabled.some((id: unknown) => typeof id !== 'string')
    )
      return new Set()
    return new Set(state.enabled)
  } catch {
    return new Set()
  }
}

export function setSkillEnabled(id: string, enabled: boolean, root = process.cwd()): void {
  const ids = getEnabledSkillIds(root)
  if (enabled) ids.add(id)
  else ids.delete(id)
  const dir = join(root, '.orchestos')
  excludeRuntimeArtifacts(root)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'skills.json')
  const temp = `${path}.${crypto.randomUUID()}.tmp`
  writeFileSync(temp, JSON.stringify({ enabled: [...ids] }, null, 2) + '\n')
  renameSync(temp, path)
}

/** Complete catalog for Settings; precedence is independent of activation. */
export function listSkillFilesWithOrigin(
  root = process.cwd(),
): Array<{ path: string; origin: SkillOrigin }> {
  const byId = new Map<string, { path: string; origin: SkillOrigin }>()
  for (const [dir, origin] of [
    [getInstallSkillsDir(), 'built-in'],
    [getUserSkillsDir(), 'user-library'],
    [getSkillsDir(root), 'project'],
  ] as const) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).sort()) {
      if (!/\.ya?ml$/.test(file)) continue
      byId.set(basename(file).replace(/\.ya?ml$/, ''), { path: join(dir, file), origin })
    }
  }
  return [...byId.values()]
}

/** Runtime catalog: user-library skills are opt-in for each project. */
export function listSkillFiles(root = process.cwd()): string[] {
  const enabled = getEnabledSkillIds(root)
  return listSkillFilesWithOrigin(root)
    .filter(
      ({ path, origin }) =>
        origin !== 'user-library' || enabled.has(basename(path).replace(/\.ya?ml$/, '')),
    )
    .map(({ path }) => path)
}

/** Runtime resolution cannot bypass project activation through an explicit id. */
export function resolveEnabledSkillPath(id: string, root = process.cwd()): string {
  const entry = listSkillFilesWithOrigin(root).find(
    ({ path }) => basename(path).replace(/\.ya?ml$/, '') === id,
  )
  if (entry?.origin === 'user-library' && !getEnabledSkillIds(root).has(id))
    throw new Error(`Skill "${id}" is disabled in this project`)
  return entry?.path ?? resolveSkillPath(id, root)
}

/** Destino de ESCRITURA — siempre el proyecto, nunca la instalación. Para leer usar `resolveSkillPath()`. */
export function getSkillPath(id: string, root = process.cwd()): string {
  return join(getSkillsDir(root), `${id}.yaml`)
}

function getProSkillsDir(root = process.cwd()): string {
  return join(getSkillsDir(root), 'pro')
}

function getInstallProSkillsDir(): string {
  return join(getInstallSkillsDir(), 'pro')
}

/** Catálogo pro legible: pro del proyecto + pro centralizadas (proyecto gana). */
export function listProSkillFiles(root = process.cwd()): string[] {
  return mergeSkillDirs(getProSkillsDir(root), getInstallProSkillsDir())
}

/** Destino de ESCRITURA de una skill pro — siempre el proyecto. */
export function getProSkillPath(id: string, root = process.cwd()): string {
  return join(getProSkillsDir(root), `${id}.yaml`)
}

/** Ruta de LECTURA de una skill pro: proyecto primero, instalación como fallback. */
export function resolveProSkillPath(id: string, root = process.cwd()): string {
  const own = join(getProSkillsDir(root), `${id}.yaml`)
  if (existsSync(own)) return own
  const central = join(getInstallProSkillsDir(), `${id}.yaml`)
  if (existsSync(central)) return central
  return own
}
