import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { chat } from '../providers/openrouter.ts'
import type { FileChange } from './contract.ts'

export interface QAVerdict {
  verdict: 'pass' | 'fail'
  reason: string
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

export async function runQA(opts: {
  description: string
  output: string[]
  written: FileChange[]
  model: string
}): Promise<QAVerdict> {
  const filesBlock = opts.written.map(f =>
    `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
  ).join('\n\n')

  const system = [
    'You are a QA reviewer. You receive a task description and the files an LLM wrote to fulfill it.',
    'Your job: decide if the output cumple exactamente lo pedido.',
    'Respond with ONLY a JSON object — no markdown fences, no prose:',
    '{ "verdict": "pass" | "fail", "reason": "one short sentence" }',
    'Verdict "fail" if: files are empty, contain placeholders/TODOs, do not address the task, or are obviously broken.',
    'Verdict "pass" if: files are non-trivial, on-topic, and a reasonable attempt at the task.',
  ].join('\n')

  const userContent =
    `## Task description\n${opts.description}\n\n` +
    `## Declared output files\n${opts.output.join(', ')}\n\n` +
    `## Files written\n${filesBlock}\n\n` +
    `Return your JSON verdict now.`

  const resp = await chat({
    model: opts.model,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  const parsed = parseVerdict(resp.text)
  return {
    verdict: parsed.verdict,
    reason: parsed.reason,
    inputTokens: resp.inputTokens,
    outputTokens: resp.outputTokens,
    model: resp.model,
  }
}

function parseVerdict(raw: string): { verdict: 'pass' | 'fail'; reason: string } {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch?.[1] ?? raw.trim()
  let obj: unknown
  try {
    obj = JSON.parse(jsonStr)
  } catch {
    // If the QA call returns garbage, treat as fail with the raw text as reason.
    return { verdict: 'fail', reason: `QA response not parseable: ${raw.slice(0, 200)}` }
  }
  const o = obj as Record<string, unknown>
  const v = o.verdict === 'pass' ? 'pass' : 'fail'
  const reason = typeof o.reason === 'string' ? o.reason : '(no reason)'
  return { verdict: v, reason }
}

export const MAX_RETRIES = 3
