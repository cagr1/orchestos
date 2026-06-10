import { parse } from 'yaml'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'

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
}

const VALID_TARGETS: SkillTarget[] = ['claude', 'cursor', 'openai']

function getSkillsDir(): string {
  return join(process.cwd(), 'skills')
}

export function validateSkill(raw: Record<string, unknown>, filePath: string): SkillDef {
  const err = (msg: string) => { throw new Error(`[skill:${filePath}] ${msg}`) }

  if (!raw.id || typeof raw.id !== 'string') err('missing or invalid "id" (must be kebab-case string)')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw.id as string)) err(`"id" must be kebab-case, got: ${raw.id}`)
  if (!raw.version || typeof raw.version !== 'string') err('missing "version" (e.g. 1.0.0)')
  if (!raw.name || typeof raw.name !== 'string') err('missing "name"')
  if (!raw.description || typeof raw.description !== 'string') err('missing "description"')
  if ((raw.description as string).length > 200) err('"description" exceeds 200 chars')
  if (!raw.instructions || typeof raw.instructions !== 'string') err('missing "instructions"')
  if ((raw.instructions as string).length > 4000) err('"instructions" exceeds 4000 chars')
  if (!Array.isArray(raw.targets) || raw.targets.length === 0) err('"targets" must be a non-empty array')
  for (const t of raw.targets as string[]) {
    if (!VALID_TARGETS.includes(t as SkillTarget)) err(`invalid target "${t}" — valid: ${VALID_TARGETS.join(', ')}`)
  }

  if (raw.allowed_tools !== undefined) {
    if (!Array.isArray(raw.allowed_tools)) err('"allowed_tools" must be an array of strings')
    for (const tool of raw.allowed_tools as string[]) {
      if (typeof tool !== 'string') err(`"allowed_tools" entries must be strings, got ${typeof tool}`)
    }
  }

  return raw as unknown as SkillDef
}

export function loadSkill(filePath: string): SkillDef {
  const content = readFileSync(filePath, 'utf-8')
  const raw = parse(content) as Record<string, unknown>
  return validateSkill(raw, filePath)
}

export function listSkillFiles(): string[] {
  const dir = getSkillsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => join(dir, f))
}

export function getSkillPath(id: string): string {
  return join(getSkillsDir(), `${id}.yaml`)
}

function getProSkillsDir(): string {
  return join(getSkillsDir(), 'pro')
}

export function listProSkillFiles(): string[] {
  const dir = getProSkillsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => join(dir, f))
}

export function getProSkillPath(id: string): string {
  return join(getProSkillsDir(), `${id}.yaml`)
}
