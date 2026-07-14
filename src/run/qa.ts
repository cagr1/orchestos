import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { createPatch } from 'diff'
import { chat } from '../providers/openrouter.ts'
import type { ProviderClient } from '../providers/index.ts'
import type { FileChange } from './contract.ts'

export interface QACriterionResult {
  text: string
  pass: boolean
}

export interface QAVerdict {
  verdict: 'pass' | 'fail'
  reason: string
  criteria?: QACriterionResult[]
  inputTokens: number
  outputTokens: number
  model: string
}

// Capture full contents of files before writing — used to revert on QA fail.
// Files that don't exist yet are recorded as ABSENT so revert can delete them.
export type ContentSnapshot = Record<string, { existed: boolean; content: string }>

export function snapshotContents(root: string, paths: string[]): ContentSnapshot {
  const snap: ContentSnapshot = {}
  for (const p of paths) {
    const full = join(root, p)
    if (existsSync(full)) {
      snap[p] = { existed: true, content: readFileSync(full, 'utf-8') }
    } else {
      snap[p] = { existed: false, content: '' }
    }
  }
  return snap
}

export function restoreContents(root: string, snap: ContentSnapshot): void {
  for (const [p, s] of Object.entries(snap)) {
    const full = join(root, p)
    if (s.existed) {
      writeFileSync(full, s.content, 'utf-8')
    } else if (existsSync(full)) {
      unlinkSync(full)
    }
  }
}

// v0.12 Bloque C — visor de diff por run (docs/diff-review-design.md, Decisión 1/3/4).
// Calculado por CONTENIDO (before/after ya en memoria), no por `git diff` — cubre los 3
// engines uniformemente y no depende de que el worktree sobreviva al run. Solo
// 'added'/'modified': el contrato del LLM (enforceContract) nunca borra archivos.
export interface FileDiffEntry {
  path: string
  status: 'added' | 'modified'
  diff: string   // unified diff completo (formato `diff`/git) — nunca recortado
}

export function computeFileDiffs(before: ContentSnapshot, written: FileChange[]): FileDiffEntry[] {
  return written.map(file => {
    const prior = before[file.path]
    const status: FileDiffEntry['status'] = prior?.existed ? 'modified' : 'added'
    const diff = createPatch(file.path, prior?.content ?? '', file.content)
    return { path: file.path, status, diff }
  })
}

export async function runQA(opts: {
  description: string
  output: string[]
  written: FileChange[]
  model: string
  acceptance_criteria?: string[]
  provider?: ProviderClient
}): Promise<QAVerdict> {
  const filesBlock = opts.written.map(f =>
    `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
  ).join('\n\n')

  const hasCriteria = opts.acceptance_criteria && opts.acceptance_criteria.length > 0

  const system = hasCriteria ? [
    'You are a QA reviewer. You receive a task description, specific acceptance criteria, and the files an LLM wrote.',
    'Evaluate EACH criterion independently. A single failing criterion makes the whole verdict "fail".',
    'For criteria in WHEN/THEN format: verify that the implementation handles the WHEN condition and produces the THEN result.',
    'Respond with ONLY a JSON object — no markdown fences, no prose:',
    '{ "verdict": "pass" | "fail", "reason": "one short sentence summarizing result", "criteria": [ { "text": "...", "pass": true | false } ] }',
    'The "criteria" array must have one entry per criterion, in the same order as given.',
  ].join('\n') : [
    'You are a QA reviewer. You receive a task description and the files an LLM wrote to fulfill it.',
    'Your job: decide if the output addresses the task.',
    'Respond with ONLY a JSON object — no markdown fences, no prose:',
    '{ "verdict": "pass" | "fail", "reason": "one short sentence" }',
    'Verdict "fail" if: files are empty, contain placeholders/TODOs, do not address the task, or are obviously broken.',
    'Verdict "pass" if: files are non-trivial, on-topic, and a reasonable attempt at the task.',
  ].join('\n')

  const criteriaBlock = hasCriteria
    ? `\n## Acceptance criteria (evaluate each)\n${opts.acceptance_criteria!.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`
    : ''

  const userContent =
    `## Task description\n${opts.description}\n` +
    criteriaBlock +
    `\n## Declared output files\n${opts.output.join(', ')}\n\n` +
    `## Files written\n${filesBlock}\n\n` +
    `Return your JSON verdict now.`

  const resp = await (opts.provider?.chat ?? chat)({
    model: opts.model,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  const parsed = parseVerdict(resp.text, hasCriteria ?? false)
  return {
    verdict: parsed.verdict,
    reason: parsed.reason,
    criteria: parsed.criteria,
    inputTokens: resp.inputTokens,
    outputTokens: resp.outputTokens,
    model: resp.model,
  }
}

function parseVerdict(
  raw: string,
  expectCriteria: boolean
): { verdict: 'pass' | 'fail'; reason: string; criteria?: QACriterionResult[] } {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch?.[1] ?? raw.trim()
  let obj: unknown
  try {
    obj = JSON.parse(jsonStr)
  } catch {
    return { verdict: 'fail', reason: `QA response not parseable: ${raw.slice(0, 200)}` }
  }
  const o = obj as Record<string, unknown>
  const v = o.verdict === 'pass' ? 'pass' : 'fail'
  const reason = typeof o.reason === 'string' ? o.reason : '(no reason)'

  if (!expectCriteria) return { verdict: v, reason }

  const criteria: QACriterionResult[] = Array.isArray(o.criteria)
    ? (o.criteria as unknown[]).map(c => {
        const cr = c as Record<string, unknown>
        return { text: typeof cr.text === 'string' ? cr.text : '?', pass: cr.pass === true }
      })
    : []

  // If any criterion failed, force verdict to fail regardless of what LLM said
  const anyFailed = criteria.some(c => !c.pass)
  return { verdict: anyFailed ? 'fail' : v, reason, criteria }
}

export const MAX_RETRIES = 3
