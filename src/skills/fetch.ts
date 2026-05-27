import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

const REGISTRY_BASE = 'https://raw.githubusercontent.com/midudev/autoskills/main/skills'
const GITHUB_API_BASE = 'https://api.github.com/repos/midudev/autoskills/contents/skills'
const DEFAULT_CACHE_DIR = join(homedir(), '.orchestos', 'cache', 'skills')

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
