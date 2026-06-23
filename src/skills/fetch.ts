import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

const DEFAULT_CACHE_DIR = join(homedir(), '.orchestos', 'cache', 'skills')

// ── autoskills registry (skills.sh curated index via midudev/autoskills) ──────

const REGISTRY_INDEX_URL = 'https://cdn.jsdelivr.net/npm/autoskills/skills-registry/index.json'
const REGISTRY_RAW_BASE = 'https://raw.githubusercontent.com/midudev/autoskills/main/packages/autoskills/skills-registry'

interface AutoskillsIndex {
  version: number
  generatedAt: string
  skills: Record<string, AutoskillsSkillEntry>
}

interface AutoskillsSkillEntry {
  source: string
  skillPath: string
  commitSha: string
  files: string[]
  sha256: Record<string, string>
  bundleHash: string
  review: {
    status: string
    flags: string[]
    summary: string
    model: string
  }
}

export interface RegistrySkillItem {
  id: string
  name: string
  description: string
  source: string
  fileCount: number
  bundleHash: string
  reviewStatus: string
}

/**
 * Fetch the full autoskills registry index.
 * Returns a map of skill id → detail entry from the index JSON.
 */
export async function fetchRegistryIndex(): Promise<Record<string, AutoskillsSkillEntry>> {
  const response = await fetch(REGISTRY_INDEX_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch registry index: HTTP ${response.status}`)
  }
  const data = await response.json() as AutoskillsIndex
  return data.skills
}

/**
 * Fetch and parse the registry index into a flat list of skill items.
 * Skills with "rejected" review status are excluded.
 */
export async function fetchRegistryList(): Promise<RegistrySkillItem[]> {
  const skills = await fetchRegistryIndex()
  const items: RegistrySkillItem[] = []

  for (const [id, entry] of Object.entries(skills)) {
    if (entry.review?.status === 'rejected') continue

    // Derive a human-readable name from the id (kebab-case → Title Case)
    const name = id
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    items.push({
      id,
      name,
      description: '',
      source: entry.source,
      fileCount: entry.files.length,
      bundleHash: entry.bundleHash,
      reviewStatus: entry.review?.status || 'unknown',
    })
  }

  return items
}

/**
 * Fetch the raw SKILL.md content for a skill from the registry.
 * Includes the frontmatter + body as raw markdown.
 * Throws if the skill or file is not found.
 */
export async function fetchRegistrySkillContent(id: string): Promise<string> {
  const url = `${REGISTRY_RAW_BASE}/${encodeURIComponent(id)}/SKILL.md`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch skill "${id}" from registry: HTTP ${response.status}`
    )
  }

  return await response.text()
}

// ── legacy autoskills fetch (GitHub-based, kept for backward compat) ──────────

const REGISTRY_BASE = 'https://raw.githubusercontent.com/midudev/autoskills/main/skills'
const GITHUB_API_BASE = 'https://api.github.com/repos/midudev/autoskills/contents/skills'

/**
 * Fetch a skill YAML from the autoskills registry and cache it locally.
 * Throws if the HTTP request fails (non-2xx or network error).
 */
export async function fetchSkill(language: string, name: string): Promise<string> {
  const url = `${REGISTRY_BASE}/${language}/${name}.yaml`
  const response = await fetch(url)

  if (!response.ok) {
    const status = response.status
    const statusText = response.statusText
    throw new Error(
      `Failed to fetch skill "${name}" for language "${language}": ` +
      `HTTP ${status} ${statusText}`
    )
  }

  const yamlText = await response.text()

  // Save to cache
  const cacheDir = join(DEFAULT_CACHE_DIR, language)
  mkdirSync(cacheDir, { recursive: true })
  const cachePath = join(cacheDir, `${name}.yaml`)
  writeFileSync(cachePath, yamlText, 'utf-8')

  return yamlText
}

/**
 * List skill names (without .yaml extension) available for a language.
 * Returns an empty array if the language directory does not exist (404).
 */
export async function listRemoteSkills(language: string): Promise<string[]> {
  const url = `${GITHUB_API_BASE}/${language}`
  const response = await fetch(url)

  // If language directory doesn't exist, GitHub returns 404
  if (response.status === 404) {
    return []
  }

  if (!response.ok) {
    const status = response.status
    const statusText = response.statusText
    throw new Error(
      `Failed to list skills for language "${language}": ` +
      `HTTP ${status} ${statusText}`
    )
  }

  const data = await response.json() as Array<{ name: string }>

  // Filter only .yaml files and strip extension
  return data
    .filter(item => item.name.endsWith('.yaml'))
    .map(item => item.name.replace(/\.yaml$/, ''))
}

/**
 * Returns the absolute path where a skill would be cached.
 */
export function getCachedSkillPath(language: string, name: string, cacheDir: string = DEFAULT_CACHE_DIR): string {
  return join(cacheDir, language, `${name}.yaml`)
}
