/**
 * src/spec/store.ts
 *
 * CRUD for spec files: .orchestos/specs/<task-id>.md
 * Frontmatter is YAML, body is the markdown after the closing --- delimiter.
 */

import { parse as parseYaml, stringify as yamlStringify } from 'yaml'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'

export interface SpecFrontmatter {
  id: string
  status: 'draft' | 'approved'
  createdAt: string
  approvedAt?: string
  clarify: 'pending' | 'resolved' | 'none'
}

export interface Spec {
  frontmatter: SpecFrontmatter
  body: string
}

const SPECS_DIR = '.orchestos/specs'

/** Returns the absolute path for a given task spec file. */
export function specPath(root: string, taskId: string): string {
  return join(root, SPECS_DIR, `${taskId}.md`)
}

/** Load a spec by task id. Returns null if the file does not exist. */
export function loadSpec(root: string, taskId: string): Spec | null {
  const filePath = specPath(root, taskId)
  if (!existsSync(filePath)) return null

  const text = readFileSync(filePath, 'utf-8')
  return parseSpec(text)
}

/** Serialize and write a spec to disk. Creates directories as needed. */
export function saveSpec(root: string, spec: Spec): void {
  const dir = join(root, SPECS_DIR)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const filePath = specPath(root, spec.frontmatter.id)
  writeFileSync(filePath, serializeSpec(spec), 'utf-8')
}

/** List all specs in the project. */
export function listSpecs(root: string): Spec[] {
  const dir = join(root, SPECS_DIR)
  if (!existsSync(dir)) return []

  const files = readdirSync(dir).filter(f => f.endsWith('.md'))
  const specs: Spec[] = []
  for (const file of files) {
    try {
      const text = readFileSync(join(dir, file), 'utf-8')
      specs.push(parseSpec(text))
    } catch {
      // skip malformed files
    }
  }
  return specs
}

// ── internal ──────────────────────────────────────────────────────────────────

function parseSpec(text: string): Spec {
  if (!text.startsWith('---\n')) throw new Error('Spec file must start with --- frontmatter')

  const closingIndex = text.indexOf('\n---\n', 4)
  if (closingIndex === -1) throw new Error('Spec file missing closing --- delimiter')

  const yamlText = text.slice(4, closingIndex)
  const body     = text.slice(closingIndex + 5) // skip '\n---\n'

  const raw = parseYaml(yamlText) as Record<string, unknown>

  const frontmatter: SpecFrontmatter = {
    id:         String(raw.id ?? ''),
    status:     (raw.status === 'approved' ? 'approved' : 'draft'),
    createdAt:  String(raw.createdAt ?? new Date().toISOString()),
    clarify:    (['pending', 'resolved', 'none'].includes(raw.clarify as string)
                  ? raw.clarify as 'pending' | 'resolved' | 'none'
                  : 'none'),
  }
  if (raw.approvedAt) frontmatter.approvedAt = String(raw.approvedAt)

  return { frontmatter, body }
}

function serializeSpec(spec: Spec): string {
  const fm: Record<string, unknown> = {
    id:        spec.frontmatter.id,
    status:    spec.frontmatter.status,
    createdAt: spec.frontmatter.createdAt,
    clarify:   spec.frontmatter.clarify,
  }
  if (spec.frontmatter.approvedAt) fm.approvedAt = spec.frontmatter.approvedAt

  const yamlText = yamlStringify(fm).trimEnd()
  return `---\n${yamlText}\n---\n${spec.body}`
}
