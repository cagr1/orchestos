import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { parse } from 'yaml'

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

export function renderReport(findings: DriftFinding[], generatedAt: string): string {
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
      lines.push('- Estado: `pendiente` — no aplicado, decisión humana requerida.')
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

function main() {
  const root = process.cwd()
  const registryPath = join(root, 'docs', 'sources-registry.yaml')
  const entries = parseRegistry(readFileSync(registryPath, 'utf-8'))

  const latestShas: Record<string, string | null> = {}
  for (const e of entries) {
    latestShas[e.id] = fetchLatestSha(e.repo, e.path)
  }

  const findings = computeDrift(entries, latestShas)
  const report = renderReport(findings, new Date().toISOString().slice(0, 10))
  writeFileSync(join(root, 'SOURCES_DRIFT.md'), report, 'utf-8')

  const drifted = findings.filter(f => f.status === 'drift').length
  const errored = findings.filter(f => f.status === 'error').length
  console.log(`sources-drift: ${findings.length} fuentes · ${drifted} con deriva · ${errored} con error → SOURCES_DRIFT.md`)
}

if (import.meta.main) main()
