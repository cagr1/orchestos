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
// Expects JSON block: { "files": [{ "path": "...", "content": "..." }] }
export function parseLLMResponse(raw: string): LLMFileResponse {
  // Try to extract JSON block from markdown fences or raw JSON
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch?.[1] ?? raw.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`LLM response is not valid JSON. Got:\n${raw.slice(0, 300)}`)
  }

  if (
    typeof parsed !== 'object' || parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).files)
  ) {
    throw new Error(`LLM response missing "files" array. Got: ${JSON.stringify(parsed).slice(0, 200)}`)
  }

  const files = (parsed as { files: unknown[] }).files
  for (const f of files) {
    if (typeof (f as Record<string, unknown>).path !== 'string') throw new Error(`File entry missing "path"`)
    if (typeof (f as Record<string, unknown>).content !== 'string') throw new Error(`File entry missing "content"`)
  }

  return parsed as LLMFileResponse
}

// ── enforce contract ──────────────────────────────────────────────────────────
// BLOCKS writes outside allowedPaths — throws on violation.
export function enforceContract(
  root: string,
  response: LLMFileResponse,
  allowedPaths: string[]
): ContractResult {
  const attempted = response.files.map(f => f.path)
  const authorized: string[] = []
  const blocked: string[] = []

  for (const file of response.files) {
    if (!allowedPaths.includes(file.path)) {
      blocked.push(file.path)
    } else {
      authorized.push(file.path)
    }
  }

  if (blocked.length > 0) {
    throw new Error(
      `CONTRACT VIOLATION — LLM attempted to write files outside declared outputs:\n` +
      blocked.map(p => `  ✗ ${p}`).join('\n') +
      `\nAllowed: ${allowedPaths.join(', ')}`
    )
  }

  // All files authorized — write them
  const written: FileChange[] = []
  for (const file of response.files) {
    const fullPath = join(root, file.path)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, file.content, 'utf-8')
    written.push(file)
  }

  return { filesAttempted: attempted, filesAuthorized: authorized, filesBlocked: blocked, written }
}
