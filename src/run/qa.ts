import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { createPatch } from 'diff'
import { chat } from '../providers/openrouter.ts'
import type { ProviderClient } from '../providers/index.ts'
import type { FileChange } from './contract.ts'
import type { CheckResult } from './checks.ts'

export interface QAEvidence {
  file: string
  excerpt: string
}

export interface QACriterionResult {
  text: string
  pass: boolean
  evidence?: QAEvidence
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
  checksResults: CheckResult[]
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
    '{ "verdict": "pass" | "fail", "reason": "one short sentence summarizing result", "criteria": [ { "text": "...", "pass": true | false, "evidence": { "file": "path/to/file", "excerpt": "literal excerpt from that file" } } ] }',
    'The "criteria" array must have one entry per criterion, in the same order as given.',
    'For every criterion with pass: true, evidence is REQUIRED: cite a literal excerpt from one of the written files using its relative path.',
    'If no written file contains evidence that satisfies a criterion, mark that criterion pass: false.',
    'If the checks block says that no mechanical verification ran, be maximally skeptical: a pass can only rely on reading the files.',
  ].join('\n') : [
    'You are a QA reviewer. You receive a task description and the files an LLM wrote to fulfill it.',
    'Your job: decide if the output addresses the task.',
    'Respond with ONLY a JSON object — no markdown fences, no prose:',
    '{ "verdict": "pass" | "fail", "reason": "one short sentence" }',
    'Verdict "fail" if: files are empty, contain placeholders/TODOs, do not address the task, or are obviously broken.',
    'Verdict "pass" if: files are non-trivial, on-topic, and a reasonable attempt at the task.',
    'If the checks block says that no mechanical verification ran, be maximally skeptical: a pass can only rely on reading the files.',
  ].join('\n')

  const criteriaBlock = hasCriteria
    ? `\n## Acceptance criteria (evaluate each)\n${opts.acceptance_criteria!.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`
    : ''

  const userContent =
    `## Task description\n${opts.description}\n` +
    criteriaBlock +
    `\n## Declared output files\n${opts.output.join(', ')}\n\n` +
    `## Checks executed\n${opts.checksResults.length > 0
      ? opts.checksResults.map(c => `- ${c.cmd} — exitCode: ${c.exitCode}`).join('\n')
      : 'NINGUNA verificación mecánica corrió.'}\n\n` +
    `## Files written\n${filesBlock}\n\n` +
    `Return your JSON verdict now.`

  const resp = await (opts.provider?.chat ?? chat)({
    model: opts.model,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  const parsed = parseVerdict(resp.text, opts.acceptance_criteria?.length ?? 0, opts.written)
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
  expectedCriteriaCount: number,
  written: FileChange[]
): { verdict: 'pass' | 'fail'; reason: string; criteria?: QACriterionResult[] } {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch?.[1] ?? raw.trim()
  let obj: unknown
  try {
    obj = JSON.parse(jsonStr)
  } catch {
    return { verdict: 'fail', reason: `QA response not parseable: ${raw.slice(0, 200)}` }
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { verdict: 'fail', reason: 'QA response must be a JSON object' }
  }
  const o = obj as Record<string, unknown>
  const v = o.verdict === 'pass' ? 'pass' : 'fail'
  const reason = typeof o.reason === 'string' ? o.reason : '(no reason)'

  if (expectedCriteriaCount === 0) return { verdict: v, reason }

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
  const byPath = new Map(written.map(f => [f.path, f.content]))

  const criteria: QACriterionResult[] = (o.criteria as unknown[]).map(c => {
    const cr = c as Record<string, unknown>
    const rawEvidence = cr.evidence as Record<string, unknown> | undefined
    const evidence = rawEvidence && typeof rawEvidence === 'object' &&
      typeof rawEvidence.file === 'string' && rawEvidence.file.trim() &&
      typeof rawEvidence.excerpt === 'string' && rawEvidence.excerpt.trim()
      ? { file: rawEvidence.file, excerpt: rawEvidence.excerpt }
      : undefined
    const evidenceIsReal = evidence !== undefined &&
      (byPath.get(evidence.file) ?? '').includes(evidence.excerpt)
    const pass = cr.pass === true && evidenceIsReal
    return { text: typeof cr.text === 'string' ? cr.text : '?', pass, ...(evidence ? { evidence } : {}) }
  })

  // If any criterion failed, force verdict to fail regardless of what LLM said
  const anyFailed = criteria.some(c => !c.pass)
  return { verdict: anyFailed ? 'fail' : v, reason, criteria }
}

export const MAX_RETRIES = 3

// K.4b — segundo juez adversarial, opt-in (orcheConfig.adversarialQA). Corre SOLO
// cuando el QA normal ya dio pass, y ANTES del merge (harness.ts). Reusa el mismo
// qaJudge (modelo/provider) ya resuelto para el QA normal — no hay selección de
// modelo nueva. Deliberadamente NO recibe el veredicto/evidencia del primer QA
// (re-evalúa desde cero) para no anclarse en el razonamiento que puede estar
// fallando: el hallazgo real (ver src/__tests__/qa-judge.test.ts, tests
// "K.4a limitation") es que evidencia LITERAL puede venir de contexto
// equivocado, código muerto, o ser contradictoria — K.1/K.4a solo garantizan
// que el string existe, no que el criterio se cumple de verdad.
export interface AdversarialVerdict {
  verdict: 'VERIFIED' | 'CAVEATS' | 'REFUTED'
  reason: string
  inputTokens: number
  outputTokens: number
  model: string
}

export async function runAdversarialQA(opts: {
  description: string
  output: string[]
  written: FileChange[]
  model: string
  acceptance_criteria?: string[]
  checksResults: CheckResult[]
  provider?: ProviderClient
}): Promise<AdversarialVerdict> {
  const filesBlock = opts.written.map(f =>
    `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
  ).join('\n\n')

  const hasCriteria = opts.acceptance_criteria && opts.acceptance_criteria.length > 0
  const criteriaBlock = hasCriteria
    ? `\n## Acceptance criteria\n${opts.acceptance_criteria!.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`
    : ''

  const system = [
    'You are a skeptical second-opinion reviewer. A first QA pass already approved this work — your',
    'job is to try to REFUTE that approval, not to rubber-stamp it.',
    'A prior weakness this review exists to catch: a criterion can look satisfied because a quoted',
    'excerpt is LITERALLY present in a file, while the excerpt does not actually prove the criterion —',
    'e.g. the excerpt is a comment/TODO or unrelated string mentioning the right keywords, the excerpt',
    'is real code but sits in a dead/unreachable branch, or the excerpt technically matches the words',
    'of the criterion but its logic does the OPPOSITE of what is required.',
    'Read the actual files and checks below and judge honestly, from scratch, whether the task',
    'description and acceptance criteria are TRULY satisfied by working, reachable code — not by',
    'the mere presence of matching text.',
    'Respond with ONLY a JSON object — no markdown fences, no prose:',
    '{ "verdict": "VERIFIED" | "CAVEATS" | "REFUTED", "reason": "one or two sentences explaining what you checked and why" }',
    '"REFUTED": you found concrete proof the work does NOT do what is required (dead code, wrong logic, missing behavior).',
    '"CAVEATS": it plausibly works but you found something worth a human look (untested edge case, weak evidence, ambiguity) — not severe enough to block.',
    '"VERIFIED": you independently confirmed the criteria are genuinely met by working code.',
  ].join('\n')

  const userContent =
    `## Task description\n${opts.description}\n` +
    criteriaBlock +
    `\n## Declared output files\n${opts.output.join(', ')}\n\n` +
    `## Checks executed\n${opts.checksResults.length > 0
      ? opts.checksResults.map(c => `- ${c.cmd} — exitCode: ${c.exitCode}`).join('\n')
      : 'NINGUNA verificación mecánica corrió.'}\n\n` +
    `## Files written\n${filesBlock}\n\n` +
    `Return your JSON verdict now.`

  const resp = await (opts.provider?.chat ?? chat)({
    model: opts.model,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  return {
    ...parseAdversarialVerdict(resp.text),
    inputTokens: resp.inputTokens,
    outputTokens: resp.outputTokens,
    model: resp.model,
  }
}

function parseAdversarialVerdict(raw: string): { verdict: AdversarialVerdict['verdict']; reason: string } {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch?.[1] ?? raw.trim()
  let obj: unknown
  try {
    obj = JSON.parse(jsonStr)
  } catch {
    // fail-safe: una respuesta no parseable no puede sostener un pase silencioso
    return { verdict: 'REFUTED', reason: `adversarial QA response not parseable: ${raw.slice(0, 200)}` }
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { verdict: 'REFUTED', reason: 'adversarial QA response must be a JSON object' }
  }
  const o = obj as Record<string, unknown>
  const verdict: AdversarialVerdict['verdict'] =
    o.verdict === 'VERIFIED' || o.verdict === 'CAVEATS' || o.verdict === 'REFUTED' ? o.verdict : 'REFUTED'
  const reason = typeof o.reason === 'string' ? o.reason : '(no reason)'
  return { verdict, reason }
}
