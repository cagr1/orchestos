/**
 * src/spec/constitution.ts
 *
 * Loads and parses CONSTITUTION.md from a project directory.
 * The file defines what the agent is ALLOWED, FORBIDDEN, and must
 * REQUIRE_CONFIRMATION before doing.
 *
 * Format (Markdown, parsed with regex — no DSL):
 *
 *   ## ALLOWED
 *   - Modify files under src/
 *
 *   ## FORBIDDEN
 *   - Modify .env files
 *   - Delete files
 *
 *   ## REQUIRE_CONFIRMATION
 *   - Any change to src/db/schema.ts
 *
 * Each section is optional. Unrecognised headings are ignored.
 */

import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

export interface Constitution {
  allowed:              string[]
  forbidden:            string[]
  require_confirmation: string[]
  /** Total rule count across all sections */
  ruleCount: number
}

const CONSTITUTION_FILE = 'CONSTITUTION.md'

/**
 * Load and parse CONSTITUTION.md from projectPath.
 * Returns null if the file doesn't exist.
 */
export function loadConstitution(projectPath: string): Constitution | null {
  const filePath = join(projectPath, CONSTITUTION_FILE)
  if (!existsSync(filePath)) return null

  const text = readFileSync(filePath, 'utf-8')
  return parseConstitution(text)
}

/**
 * Parse constitution text into structured sections.
 * Exported for testing.
 */
export function parseConstitution(text: string): Constitution {
  const allowed:              string[] = []
  const forbidden:            string[] = []
  const require_confirmation: string[] = []

  // Split into sections by ## headings
  const lines        = text.split('\n')

  let currentSection: 'allowed' | 'forbidden' | 'require_confirmation' | null = null

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/)
    if (headingMatch && headingMatch[1]) {
      const heading = headingMatch[1].trim().toUpperCase()
      if (heading === 'ALLOWED')              currentSection = 'allowed'
      else if (heading === 'FORBIDDEN')       currentSection = 'forbidden'
      else if (heading.includes('CONFIRMATION')) currentSection = 'require_confirmation'
      else                                    currentSection = null
      continue
    }

    if (!currentSection) continue

    // Bullet items: "- text" or "* text"
    const bulletMatch = line.match(/^[-*]\s+(.+)$/)
    if (bulletMatch && bulletMatch[1]) {
      const rule = bulletMatch[1].trim()
      if (rule) {
        if (currentSection === 'allowed')              allowed.push(rule)
        else if (currentSection === 'forbidden')       forbidden.push(rule)
        else if (currentSection === 'require_confirmation') require_confirmation.push(rule)
      }
    }
  }

  const ruleCount = allowed.length + forbidden.length + require_confirmation.length
  return { allowed, forbidden, require_confirmation, ruleCount }
}

/**
 * Build the constitution block to inject into the system prompt.
 * Returns empty string if constitution is null.
 */
export function buildConstitutionBlock(constitution: Constitution | null): string {
  if (!constitution || constitution.ruleCount === 0) return ''

  const lines: string[] = ['\n## PROJECT CONSTITUTION (enforced — do not violate)']

  if (constitution.forbidden.length > 0) {
    lines.push('\n### STRICTLY FORBIDDEN (never do these):')
    for (const rule of constitution.forbidden) lines.push(`- ${rule}`)
  }

  if (constitution.require_confirmation.length > 0) {
    lines.push('\n### REQUIRE CONFIRMATION before doing:')
    for (const rule of constitution.require_confirmation) lines.push(`- ${rule}`)
  }

  if (constitution.allowed.length > 0) {
    lines.push('\n### EXPLICITLY ALLOWED:')
    for (const rule of constitution.allowed) lines.push(`- ${rule}`)
  }

  return lines.join('\n')
}

/**
 * Generate CONSTITUTION.md scaffold content.
 */
export function scaffoldConstitutionMd(): string {
  return `# CONSTITUTION.md
# Defines what the agent CAN and CANNOT do in this project.
# Injected into every task prompt automatically.
# Docs: https://github.com/cagr1/orchestos

## ALLOWED
- Modify files under src/
- Create new test files under tests/ or __tests__/
- Update package.json dependencies

## FORBIDDEN
- Modify .env or .env.* files
- Delete existing files (use deprecation comments instead)
- Modify files under src/db/migrations/
- Hardcode secrets or API keys

## REQUIRE_CONFIRMATION
- Any change to src/db/schema.ts
- Any change to authentication logic
- Any change to public API contracts
`
}
