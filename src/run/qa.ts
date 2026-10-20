import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPatch } from 'diff'
import type { ProviderClient } from '../providers/index.ts'
import type { SkillDef } from '../skills/registry.ts'
import { buildSections } from '../skills/targets/_shared.ts'
import type { CheckResult } from './checks.ts'
import type { FileChange } from './contract.ts'

interface QAEvidence {
  file: string
  excerpt: string
}

interface QACriterionResult {
  text: string
  pass: boolean
  evidence?: QAEvidence
}

/** Normalize only quote typography, escaped quotes, and whitespace for R.3 identity checks. */
export function normalizeCriterionText(text: string): string {
  return text
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/\\(["'])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

interface QAVerdict {
  verdict: 'pass' | 'fail'
  reason: string
  criteria?: QACriterionResult[]
  inputTokens: number
  outputTokens: number
  model: string
  usd?: number | null
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

// v0.12 Bloque C — visor de diff por run (docs/done/design/diff-review-design.md, Decisión 1/3/4).
// Calculado por CONTENIDO (before/after ya en memoria), no por `git diff` — cubre los 3
// engines uniformemente y no depende de que el worktree sobreviva al run. Solo
// 'added'/'modified': el contrato del LLM (enforceContract) nunca borra archivos.
export interface FileDiffEntry {
  path: string
  status: 'added' | 'modified'
  diff: string // unified diff completo (formato `diff`/git) — nunca recortado
}

export function computeFileDiffs(before: ContentSnapshot, written: FileChange[]): FileDiffEntry[] {
  return written.map((file) => {
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
  checksResults: CheckResult[]
  provider: ProviderClient
  /**
   * O.3 (Bloque O, 2026-08-05) — skills-gate resueltas por `resolveGates()`
   * que aplicaron a esta corrida (nunca decidido por este mismo LLM). Se
   * inyectan post-hoc sobre este stage existente, no un stage nuevo.
   * `qa-structured` se excluye a propósito: su metodología YA es el branch
   * `hasCriteria` de abajo — inyectarla de nuevo sería el mismo contenido
   * duplicado, no una gate adicional.
   */
  gateSkills?: SkillDef[]
}): Promise<QAVerdict> {
  const filesBlock = opts.written
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n')

  const hasCriteria = opts.acceptance_criteria && opts.acceptance_criteria.length > 0

  const gateBlock = (opts.gateSkills ?? [])
    .filter((s) => s.id !== 'qa-structured')
    .map(
      (s) =>
        `\n## GATE: ${s.name}\nThis gate is mandatory — it was NOT chosen by you, it activated because the task matched its trigger conditions. Apply it in addition to everything else below; do not skip it because the rest of the review already looks fine.\n${buildSections(s).join('\n\n')}`,
    )
    .join('\n')

  const system =
    (hasCriteria
      ? [
          'You are a QA reviewer. You receive a task description, specific acceptance criteria, and the files an LLM wrote.',
          'Evaluate EACH criterion independently. A single failing criterion makes the whole verdict "fail".',
          'For criteria in WHEN/THEN format: verify that the implementation handles the WHEN condition and produces the THEN result.',
          'Respond with ONLY a JSON object — no markdown fences, no prose:',
          '{ "verdict": "pass" | "fail", "reason": "one short sentence summarizing result", "criteria": [ { "text": "...", "pass": true | false, "evidence": { "file": "path/to/file", "excerpt": "literal excerpt from that file" } } ] }',
          'The "criteria" array must have one entry per criterion, in the same order as given.',
          'Copy each criterion into "text" EXACTLY as given, without the numbering. Do not paraphrase, duplicate, replace, or omit criteria.',
          'For every criterion with pass: true, evidence is REQUIRED: cite a literal excerpt from one of the written files using its relative path.',
          'If no written file contains evidence that satisfies a criterion, mark that criterion pass: false.',
          'If the checks block says that no mechanical verification ran, be maximally skeptical: a pass can only rely on reading the files.',
        ].join('\n')
      : [
          'You are a QA reviewer. You receive a task description and the files an LLM wrote to fulfill it.',
          'Your job: decide if the output addresses the task.',
          'Respond with ONLY a JSON object — no markdown fences, no prose:',
          '{ "verdict": "pass" | "fail", "reason": "one short sentence" }',
          'Verdict "fail" if: files are empty, contain placeholders/TODOs, do not address the task, or are obviously broken.',
          'Verdict "pass" if: files are non-trivial, on-topic, and a reasonable attempt at the task.',
          'If the checks block says that no mechanical verification ran, be maximally skeptical: a pass can only rely on reading the files.',
        ].join('\n')) + gateBlock

  const criteriaBlock = hasCriteria
    ? `\n## Acceptance criteria (evaluate each)\n${opts.acceptance_criteria!.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`
    : ''

  const userContent =
    `## Task description\n${opts.description}\n` +
    criteriaBlock +
    `\n## Declared output files\n${opts.output.join(', ')}\n\n` +
    `## Checks executed\n${
      opts.checksResults.length > 0
        ? opts.checksResults.map((c) => `- ${c.cmd} — exitCode: ${c.exitCode}`).join('\n')
        : 'NINGUNA verificación mecánica corrió.'
    }\n\n` +
    `## Files written\n${filesBlock}\n\n` +
    `Return your JSON verdict now.`

  const resp = await opts.provider.chat({
    model: opts.model,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  const parsed = parseVerdict(resp.text, opts.acceptance_criteria ?? [], opts.written)
  return {
    verdict: parsed.verdict,
    reason: parsed.reason,
    criteria: parsed.criteria,
    inputTokens: resp.inputTokens,
    outputTokens: resp.outputTokens,
    model: resp.model,
    ...(resp.usd !== undefined ? { usd: resp.usd } : {}),
  }
}

/** One complete JSON value, optionally surrounded by exactly one markdown fence.
 * Never recover a convenient object from a malformed outer response. */
function parseCompleteJson(raw: string): { value?: unknown; parseError?: true } {
  const fenced = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)```$/)
  try {
    return { value: JSON.parse(fenced?.[1] ?? raw.trim()) }
  } catch {
    return { parseError: true }
  }
}

function parseVerdict(
  raw: string,
  expectedCriteria: string[],
  written: FileChange[],
): { verdict: 'pass' | 'fail'; reason: string; criteria?: QACriterionResult[] } {
  const parsed = parseCompleteJson(raw)
  if (parsed.parseError) {
    return { verdict: 'fail', reason: `QA response not parseable: ${raw.slice(0, 200)}` }
  }
  const obj = parsed.value
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { verdict: 'fail', reason: 'QA response must be a JSON object' }
  }
  const o = obj as Record<string, unknown>
  const v = o.verdict === 'pass' ? 'pass' : 'fail'
  let reason = typeof o.reason === 'string' ? o.reason : '(no reason)'

  const expectedCriteriaCount = expectedCriteria.length
  if (expectedCriteriaCount === 0) return { verdict: v, reason }

  if (
    new Set(expectedCriteria).size !== expectedCriteriaCount ||
    expectedCriteria.some((text) => !text.trim())
  ) {
    return {
      verdict: 'fail',
      reason: 'Original QA criteria must be non-empty and unique',
      criteria: [],
    }
  }

  if (!Array.isArray(o.criteria) || o.criteria.length !== expectedCriteriaCount) {
    return {
      verdict: 'fail',
      reason: `QA response must include exactly ${expectedCriteriaCount} criterion results`,
      criteria: [],
    }
  }

  // K.4a — un juez QA puede citar un excerpt plausible que nunca aparece en el
  // archivo (evidencia fabricada). K.1 solo exigía evidencia no vacía; esto
  // verifica que sea una cita LITERAL del contenido real escrito, sin costo de
  // un segundo LLM.
  const byPath = new Map(written.map((f) => [f.path, f.content]))

  let identityMismatch = false
  const criteria: QACriterionResult[] = (o.criteria as unknown[]).map((c, index) => {
    if (c === null || typeof c !== 'object' || Array.isArray(c)) {
      const expectedText = expectedCriteria[index] ?? ''
      if (!identityMismatch) {
        identityMismatch = true
        reason = `QA criterion results must match the original text and order exactly (criterion ${index + 1}: got "?")`
      }
      return { text: expectedText, pass: false }
    }
    const cr = c as Record<string, unknown>
    const expectedText = expectedCriteria[index] ?? ''
    const rawCriterionText = typeof cr.text === 'string' ? cr.text : '?'
    const matchesOriginal =
      typeof cr.text === 'string' &&
      normalizeCriterionText(cr.text) === normalizeCriterionText(expectedText)
    if (!matchesOriginal && !identityMismatch) {
      identityMismatch = true
      reason = `QA criterion results must match the original text and order exactly (criterion ${index + 1}: got "${rawCriterionText.slice(0, 200)}")`
    }
    const rawEvidence = cr.evidence as Record<string, unknown> | undefined
    const evidence =
      rawEvidence &&
      typeof rawEvidence === 'object' &&
      !Array.isArray(rawEvidence) &&
      typeof rawEvidence.file === 'string' &&
      rawEvidence.file.trim() &&
      typeof rawEvidence.excerpt === 'string' &&
      rawEvidence.excerpt.trim()
        ? { file: rawEvidence.file, excerpt: rawEvidence.excerpt }
        : undefined
    const evidenceIsReal =
      evidence !== undefined && (byPath.get(evidence.file) ?? '').includes(evidence.excerpt)
    const pass = matchesOriginal && cr.pass === true && evidenceIsReal
    return {
      text: expectedText,
      pass,
      ...(evidence ? { evidence } : {}),
    }
  })

  // If any criterion failed, force verdict to fail regardless of what LLM said
  const anyFailed = criteria.some((c) => !c.pass)
  return {
    verdict: anyFailed ? 'fail' : v,
    reason,
    criteria,
  }
}

export const MAX_RETRIES = 3
