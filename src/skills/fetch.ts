// ── autoskills registry (skills.sh curated index via midudev/autoskills) ──────

const REGISTRY_INDEX_URL = 'https://cdn.jsdelivr.net/npm/autoskills/skills-registry/index.json'
const REGISTRY_RAW_BASE =
  'https://raw.githubusercontent.com/midudev/autoskills/main/packages/autoskills/skills-registry'

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

interface RegistrySkillItem {
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
async function fetchRegistryIndex(): Promise<Record<string, AutoskillsSkillEntry>> {
  const response = await fetch(REGISTRY_INDEX_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch registry index: HTTP ${response.status}`)
  }
  const data = (await response.json()) as AutoskillsIndex
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
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
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
    throw new Error(`Failed to fetch skill "${id}" from registry: HTTP ${response.status}`)
  }

  return await response.text()
}
