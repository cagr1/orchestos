import { createHash } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

export interface FileChange {
  path: string   // relative to project root
  content: string
}

export interface ContractResult {
  filesAttempted: string[]
  filesAuthorized: string[]
  filesBlocked: string[]
  written: FileChange[]
}

export interface LLMFileResponse {
  files: FileChange[]
}

// ── snapshot ──────────────────────────────────────────────────────────────────
export function snapshotHashes(root: string, paths: string[]): Record<string, string> {
  const snap: Record<string, string> = {}
  for (const p of paths) {
    const full = join(root, p)
    if (existsSync(full)) {
      snap[p] = createHash('sha1').update(readFileSync(full)).digest('hex')
    } else {
      snap[p] = 'absent'
    }
  }
  return snap
}

// ── parse LLM response ────────────────────────────────────────────────────────
// Expects delimiter format: <<<FILE:path>>>\ncontent\n<<<ENDFILE>>>
// More robust than JSON — no escaping issues with code content.
export function parseLLMResponse(raw: string): LLMFileResponse {
  const files: FileChange[] = []
  const delimiter = /<<<FILE:([^>\n]+)>>>([\s\S]*?)<<<ENDFILE>>>/g
  let match: RegExpExecArray | null

  while ((match = delimiter.exec(raw)) !== null) {
    const rawPath = match[1]
    const rawContent = match[2]
    if (rawPath === undefined || rawContent === undefined) continue
    const path = rawPath.trim()
    if (!path) throw new Error('FILE delimiter found with empty path')
    // Strip exactly one leading newline that follows the opening delimiter
    const content = rawContent.startsWith('\n') ? rawContent.slice(1) : rawContent
    files.push({ path, content })
  }

  if (files.length === 0) {
    throw new Error(
      `No <<<FILE:...>>>...<<<ENDFILE>>> blocks found in LLM response.\n` +
      `Got:\n${raw.slice(0, 400)}`
    )
  }

  return { files }
}

// ── path normalization (F4.1) ──────────────────────────────────────────────────
export function normalizeRelPath(p: string): string {
  let s = p.replaceAll('\\', '/')
  s = s.replace(/\/+/g, '/')
  while (s.startsWith('./')) s = s.slice(2)
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s
}

// ── enforce contract ──────────────────────────────────────────────────────────
// BLOCKS writes outside allowedPaths — throws on violation.
export function enforceContract(
  root: string,
  response: LLMFileResponse,
  allowedPaths: string[]
): ContractResult {
  const normalizedAllowed = allowedPaths.map(normalizeRelPath)
  const attempted: string[] = []
  const authorized: string[] = []
  const blocked: string[] = []

  for (const file of response.files) {
    const normalizedPath = normalizeRelPath(file.path)
    attempted.push(normalizedPath)
    if (!normalizedAllowed.includes(normalizedPath)) {
      blocked.push(normalizedPath)
    } else {
      authorized.push(normalizedPath)
    }
  }

  if (blocked.length > 0) {
    throw new Error(
      `CONTRACT VIOLATION — LLM attempted to write files outside declared outputs:\n` +
      blocked.map(p => `  ✗ ${p}`).join('\n') +
      `\nAllowed: ${normalizedAllowed.join(', ')}`
    )
  }

  const written: FileChange[] = []
  for (const file of response.files) {
    const normalizedPath = normalizeRelPath(file.path)
    const fullPath = join(root, normalizedPath)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, file.content, 'utf-8')
    written.push({ path: normalizedPath, content: file.content })
  }

  return { filesAttempted: attempted, filesAuthorized: authorized, filesBlocked: blocked, written }
}
