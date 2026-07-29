import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { buildRoadmapProfile, type RoadmapProfile } from '../detect/roadmap-profile.ts'

const MAX_PROFILE_CHARS = 4_000
const MAX_DOC_CHARS = 3_000
const MAX_TOTAL_CHARS = 12_000

export interface RoadmapContext {
  profile: RoadmapProfile
  markdown: string
  selected: string[]
  missing: string[]
  blockReason?: string
}

function readBounded(root: string, relativePath: string, max: number): string {
  const path = join(root, relativePath)
  if (!existsSync(path)) return ''
  const content = readFileSync(path, 'utf-8')
  return content.length <= max ? content : `${content.slice(0, max)}\n\n[roadmap truncado por presupuesto de contexto]`
}

export async function loadRoadmapContext(root: string, output: string[] = []): Promise<RoadmapContext> {
  const profile = await buildRoadmapProfile(root)
  const selected: string[] = []
  const missing: string[] = []
  const sections: string[] = ['## ROADMAP GUIDANCE', 'Usa estas guías como restricciones y contexto de trabajo.',
    'Los estados `known`/`detected` no son evidencia de que el proyecto cumpla la práctica.']

  const profilePath = 'docs/roadmaps/project-profile.md'
  const profileText = readBounded(root, profilePath, MAX_PROFILE_CHARS)
  if (profileText) {
    sections.push('\n### Perfil efectivo del proyecto\n' + profileText)
  }

  const docs = [
    ...profile.disciplines.filter(d => d.state === 'detected'),
    ...profile.languageProfiles.filter(l => l.state === 'known'),
  ]
  let used = sections.join('\n').length
  for (const item of docs) {
    if (!item.docPath) {
      missing.push('language' in item ? item.language : item.discipline)
      continue
    }
    const content = readBounded(root, item.docPath, MAX_DOC_CHARS)
    if (!content) {
      missing.push('language' in item ? item.language : item.discipline)
      continue
    }
    const label = 'language' in item ? `Lenguaje: ${item.language}` : `Disciplina: ${item.discipline}`
    const section = `\n### ${label} (${item.state})\n${content}`
    if (used + section.length > MAX_TOTAL_CHARS) {
      missing.push(`${label} — omitido por presupuesto de contexto`)
      continue
    }
    sections.push(section)
    selected.push(label)
    used += section.length
  }

  const missingStates = [
    ...profile.disciplines.filter(d => d.state === 'missing').map(d => `disciplina ${d.discipline}`),
    ...profile.languageProfiles.filter(l => l.state === 'missing').map(l => `lenguaje ${l.language}`),
  ]
  const toolchain = new Set(profile.toolchain.map(t => t.name))
  const missingTooling = profile.languageProfiles
    .filter(l => (l.language === 'Rust' && !toolchain.has('cargo')) || (l.language === 'Go' && !toolchain.has('go')))
    .map(l => `toolchain ${l.language}`)
  const missingChecks = [...missingStates, ...missingTooling]
  if (missingChecks.length > 0) {
    sections.push(`\n### Checks de roadmap ausentes\n${missingChecks.map(s => `- ${s}: missing/blocked; no convertir en pass`).join('\n')}`)
  }
  const outputNeedsRust = output.some(p => p.endsWith('.rs'))
  const outputNeedsGo = output.some(p => p.endsWith('.go'))
  const blockedLanguage = outputNeedsRust && missingTooling.includes('toolchain Rust')
    ? 'Rust: cargo no está disponible; check obligatorio missing/blocked'
    : outputNeedsGo && missingTooling.includes('toolchain Go')
    ? 'Go: go no está disponible; check obligatorio missing/blocked'
    : undefined
  return { profile, markdown: sections.join('\n'), selected, missing: [...missing, ...missingChecks], blockReason: blockedLanguage }
}
