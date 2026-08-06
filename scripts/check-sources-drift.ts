import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { parse } from 'yaml'
import { chat as openrouterChat, type ChatResponse } from '../src/providers/openrouter.ts'

/**
 * Bloque P (PLAN.md, 2026-08-02) — vigilancia de deriva de las fuentes
 * externas de las que OrchestOS copió contenido/diseño (docs/sources-registry.yaml).
 *
 * Mecánico, sin LLM: compara el último commit real que tocó cada `path` en
 * GitHub contra `last_synced_sha` registrado. Nunca decide si el cambio
 * importa ni toca `local_artifact` — eso queda en SOURCES_DRIFT.md para
 * revisión humana (mismo contrato que Dreaming: propone, nunca aplica).
 */

export interface SourceEntry {
  id: string
  repo: string
  path: string
  license: string
  local_artifact: string
  last_synced_sha: string
  last_synced_date: string
  note?: string
}

export type DriftStatus = 'clean' | 'drift' | 'error'

export interface DriftFinding {
  id: string
  status: DriftStatus
  repo: string
  path: string
  local_artifact: string
  last_synced_sha: string
  latest_sha: string | null
  compare_url?: string
}

export function parseRegistry(content: string): SourceEntry[] {
  const parsed = parse(content) as { sources?: SourceEntry[] }
  return parsed.sources ?? []
}

export function computeDrift(
  entries: SourceEntry[],
  latestShas: Record<string, string | null>,
): DriftFinding[] {
  return entries.map(e => {
    const latest = latestShas[e.id] ?? null
    const status: DriftStatus = latest === null
      ? 'error'
      : latest === e.last_synced_sha
        ? 'clean'
        : 'drift'
    const finding: DriftFinding = {
      id: e.id,
      status,
      repo: e.repo,
      path: e.path,
      local_artifact: e.local_artifact,
      last_synced_sha: e.last_synced_sha,
      latest_sha: latest,
    }
    if (status === 'drift') {
      finding.compare_url = `https://github.com/${e.repo}/compare/${e.last_synced_sha}...${latest}`
    }
    return finding
  })
}

// P.4 (PLAN.md § Bloque P, 2026-08-05) — mejora opt-in sobre P.1-P.3: en vez de
// solo listar "cambió, revisar a mano", lee el diff real del path entre
// last_synced_sha y el HEAD actual y le pide a un modelo barato que redacte
// una propuesta corta. Sigue sin decidir ni tocar `local_artifact`/el
// registro — el LLM solo redacta la propuesta que ya requería "revisión
// humana"; la promoción real sigue pasando por /knowledge-promote (mismo
// gate que rige todo esto: "no promover sin propuesta, diff y confirmación
// explícita"). `chatFn` inyectable para que el prompt sea testeable sin red.

export function fetchDiffPatch(repo: string, base: string, head: string, path: string): string | null {
  try {
    const out = execFileSync('gh', [
      'api', `repos/${repo}/compare/${base}...${head}`,
      '--jq', `.files[] | select(.filename == "${path}") | .patch // ""`,
    ], { encoding: 'utf-8' }).trim()
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

export function buildSummaryPrompt(entry: SourceEntry, patch: string): { system: string; user: string } {
  const system = [
    'You are drafting a short review note for a human maintainer about an upstream source file that',
    'a local project previously borrowed content or design from.',
    'Given the diff since the last sync and a note about what was borrowed, write a proposal in 2-4',
    'sentences: (1) what changed in plain terms, (2) whether it looks like it could be relevant to',
    'port into the local artifact, or whether it looks unrelated to what was borrowed.',
    'Never claim certainty and never say something was already applied — this is a suggestion for a',
    'human to review, not a decision. Respond with plain text, no markdown headers, no JSON.',
  ].join('\n')
  const user =
    `## Local artifact\n${entry.local_artifact}\n\n` +
    `## What was borrowed (registry note)\n${entry.note ?? '(sin nota registrada)'}\n\n` +
    `## Diff since last sync (${entry.path})\n\`\`\`diff\n${patch}\n\`\`\`\n\n` +
    `Write the proposal now.`
  return { system, user }
}

export async function summarizeDrift(
  entry: SourceEntry,
  patch: string,
  chatFn: (opts: { model: string; system: string; messages: { role: 'user'; content: string }[] }) => Promise<ChatResponse> = openrouterChat,
  model = 'anthropic/claude-haiku-4-5',
): Promise<string> {
  const { system, user } = buildSummaryPrompt(entry, patch)
  const resp = await chatFn({ model, system, messages: [{ role: 'user', content: user }] })
  return resp.text.trim()
}

export function renderReport(findings: DriftFinding[], generatedAt: string, summaries?: Record<string, string>): string {
  const drifted = findings.filter(f => f.status === 'drift')
  const errored = findings.filter(f => f.status === 'error')
  const clean = findings.filter(f => f.status === 'clean')

  const lines: string[] = [
    '# Sources drift report',
    '',
    `Generado: ${generatedAt} — ver [docs/sources-registry.yaml](docs/sources-registry.yaml) y PLAN.md § Bloque P.`,
    '',
    `${drifted.length} con deriva · ${clean.length} sin cambios · ${errored.length} con error de consulta.`,
    '',
  ]

  if (drifted.length > 0) {
    lines.push('## Deriva detectada — revisar y decidir si portar')
    lines.push('')
    for (const f of drifted) {
      lines.push(`### \`${f.id}\``)
      lines.push(`- Fuente: [${f.repo}](https://github.com/${f.repo}) — \`${f.path}\``)
      lines.push(`- Artefacto local: \`${f.local_artifact}\``)
      lines.push(`- SHA sincronizado: \`${f.last_synced_sha}\` → SHA actual: \`${f.latest_sha}\``)
      lines.push(`- Comparar: ${f.compare_url}`)
      const summary = summaries?.[f.id]
      lines.push(summary
        ? `- Propuesta (LLM, revisar — nunca aplicado solo): ${summary}`
        : '- Estado: `pendiente` — no aplicado, decisión humana requerida.')
      lines.push('')
    }
  }

  if (errored.length > 0) {
    lines.push('## Error de consulta — reintentar')
    lines.push('')
    for (const f of errored) {
      lines.push(`- \`${f.id}\` (${f.repo} — \`${f.path}\`)`)
    }
    lines.push('')
  }

  if (clean.length > 0) {
    lines.push('## Sin cambios')
    lines.push('')
    for (const f of clean) {
      lines.push(`- \`${f.id}\` — \`${f.last_synced_sha.slice(0, 12)}\``)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function fetchLatestSha(repo: string, path: string): string | null {
  try {
    const out = execFileSync('gh', [
      'api', `repos/${repo}/commits?path=${path}&per_page=1`, '--jq', '.[0].sha',
    ], { encoding: 'utf-8' }).trim()
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

async function main() {
  const root = process.cwd()
  const doSummarize = process.argv.includes('--summarize')
  const registryPath = join(root, 'docs', 'sources-registry.yaml')
  const entries = parseRegistry(readFileSync(registryPath, 'utf-8'))

  const latestShas: Record<string, string | null> = {}
  for (const e of entries) {
    latestShas[e.id] = fetchLatestSha(e.repo, e.path)
  }

  const findings = computeDrift(entries, latestShas)

  // P.4 — opt-in a propósito (mismo patrón que orcheConfig.adversarialQA): el
  // camino mecánico de P.1-P.3 sigue siendo el default, sin costo ni llamada
  // a un LLM. Un fallo de red/LLM al resumir degrada a la línea "pendiente"
  // de siempre, nunca rompe el reporte entero.
  let summaries: Record<string, string> | undefined
  if (doSummarize) {
    summaries = {}
    for (const f of findings.filter(f => f.status === 'drift')) {
      const entry = entries.find(e => e.id === f.id)!
      const patch = fetchDiffPatch(entry.repo, entry.last_synced_sha, f.latest_sha!, entry.path)
      if (!patch) continue
      try {
        summaries[f.id] = await summarizeDrift(entry, patch)
      } catch {
        // sin resumen — renderReport cae al "pendiente" mecánico de siempre
      }
    }
  }

  const report = renderReport(findings, new Date().toISOString().slice(0, 10), summaries)
  writeFileSync(join(root, 'SOURCES_DRIFT.md'), report, 'utf-8')

  const drifted = findings.filter(f => f.status === 'drift').length
  const errored = findings.filter(f => f.status === 'error').length
  console.log(`sources-drift: ${findings.length} fuentes · ${drifted} con deriva · ${errored} con error → SOURCES_DRIFT.md${doSummarize ? ' (resumen LLM activado)' : ''}`)
}

if (import.meta.main) main()
