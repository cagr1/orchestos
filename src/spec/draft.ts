/**
 * src/spec/draft.ts
 *
 * Calls the LLM to generate the body of a spec for a given task,
 * including a capabilities contract (added / modified / removed).
 * Investigates existing specs before suggesting modified/removed.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { loadOrcheConfig } from '../config/load.ts'
import { getProvider } from '../providers/index.ts'
import { type CapabilitiesContract, listSpecs } from './store.ts'

// AA.3 (IDEAS #6) — fragmento insertado SOLO cuando la tarea se marcó compleja
// (`spec create --design`). Contenido deliberadamente DISTINTO de "Descripción"/"Criterios de
// aceptación": esas responden qué hay que hacer, esto responde por qué esta forma y no otra —
// decisiones y alternativas descartadas, no relleno repetido.
const DESIGN_SECTION_INSTRUCTIONS = `
Esta tarea fue marcada como COMPLEJA — antes de "Criterios de aceptación", incluí una sección
## Design con:
  - Decisiones técnicas clave y su justificación (por qué esta forma, no otra).
  - Alternativas consideradas y por qué se descartaron.
  - Riesgos o trade-offs conocidos.
No repitas el contenido de "Descripción" acá — Design explica el CÓMO y el PORQUÉ, no el QUÉ.
`

function buildSystemPrompt(design: boolean): string {
  return `Eres un arquitecto de software. Genera una spec técnica para la tarea dada.
Los criterios de aceptación DEBEN estar en formato WHEN/THEN:
  - WHEN <condición observable> THEN <resultado esperado>
Nunca uses criterios vagos como "funciona correctamente" o "la función retorna algo".
Responde SOLO con el body markdown (sin frontmatter): secciones Contexto, Descripción${design ? ', Design' : ''}, Criterios de aceptación, Notas.
${design ? DESIGN_SECTION_INSTRUCTIONS : ''}
Además, al final incluye un bloque ---capabilities con el contrato de capacidades en YAML:

---capabilities
added:
  - <funcionalidad nueva 1>
modified:
  - <spec-id-de-funcionalidad-existente-que-cambia>
removed: []

Si no hay modificaciones o eliminaciones, deja los arrays vacíos.`
}

export interface DraftResult {
  body: string
  capabilities?: CapabilitiesContract
}

/**
 * Investigate existing specs and build a summary string for the prompt.
 */
function buildExistingSpecsSummary(root: string): string {
  const specs = listSpecs(root)
  if (specs.length === 0) return ''
  const lines = specs.map((s) => {
    const caps = s.frontmatter.capabilities
    const capStr = caps
      ? `added=${caps.added.length} modified=${caps.modified.length} removed=${caps.removed.length}`
      : 'no-capabilities'
    return `  - ${s.frontmatter.id} (${s.frontmatter.status}, ${capStr})`
  })
  return `## Existing specs\n${lines.join('\n')}\n`
}

/**
 * Parse capabilities from the ---capabilities YAML block appended to the body.
 * Returns the clean body and any capabilities found.
 */
function extractCapabilities(text: string): { body: string; capabilities?: CapabilitiesContract } {
  const capMatch = text.match(/\n---capabilities\n([\s\S]*)$/)
  if (!capMatch) return { body: text.trim() }

  const yamlText = capMatch[1]!.trim()
  const body = text.slice(0, capMatch.index).trim()

  try {
    const lines = yamlText.split('\n')
    const caps: CapabilitiesContract = { added: [], modified: [], removed: [] }
    let currentKey: keyof CapabilitiesContract | null = null

    for (const line of lines) {
      const keyMatch = line.match(/^(\w+):/)
      if (keyMatch) {
        currentKey = keyMatch[1] as keyof CapabilitiesContract
        const rest = line.slice(keyMatch[0].length).trim()
        if (rest === '[]' || rest === '') continue
        if (rest.startsWith('- ')) {
          caps[currentKey]!.push(rest.slice(2).trim())
        }
        continue
      }
      if (currentKey && line.trim().startsWith('- ')) {
        caps[currentKey]!.push(line.trim().slice(2).trim())
      }
    }

    const hasCaps = caps.added.length > 0 || caps.modified.length > 0 || caps.removed.length > 0
    return { body, capabilities: hasCaps ? caps : undefined }
  } catch {
    return { body }
  }
}

/**
 * Draft a spec body for the given task using the LLM.
 * Returns the body string and optional capabilities contract.
 */
export async function draftSpec(
  root: string,
  taskId: string,
  taskDescription: string,
  opts: { design?: boolean } = {},
): Promise<DraftResult> {
  const design = opts.design ?? false
  const contextParts: string[] = []

  const constitutionPath = join(root, 'CONSTITUTION.md')
  if (existsSync(constitutionPath)) {
    contextParts.push(`## CONSTITUTION.md\n${readFileSync(constitutionPath, 'utf-8')}`)
  }

  const contextMdPath = join(root, 'CONTEXT.md')
  const agentsMdPath = join(root, 'AGENTS.md')
  if (existsSync(contextMdPath)) {
    contextParts.push(`## CONTEXT.md\n${readFileSync(contextMdPath, 'utf-8')}`)
  } else if (existsSync(agentsMdPath)) {
    contextParts.push(`## AGENTS.md\n${readFileSync(agentsMdPath, 'utf-8')}`)
  }

  const existingSummary = buildExistingSpecsSummary(root)
  if (existingSummary) contextParts.push(existingSummary)

  const userContent = [
    contextParts.length > 0 ? `## Project context\n${contextParts.join('\n\n')}` : '',
    `## Task to spec`,
    `ID: ${taskId}`,
    `Description: ${taskDescription}`,
    '',
    'Generate the spec body markdown for this task. Use the template structure:',
    '',
    '## Contexto',
    '<explain the background>',
    '',
    '## Descripción',
    '<explain what must be done>',
    '',
    ...(design
      ? [
          '## Design',
          '<key decisions, alternatives considered, trade-offs — NOT a repeat of Descripción>',
          '',
        ]
      : []),
    '## Criterios de aceptación',
    '- [ ] WHEN <trigger/condition> THEN <observable result>',
    '',
    '## Notas',
    '<any relevant notes>',
    '',
    'After the body, add a ---capabilities block. Investigate the existing specs above',
    'to determine which existing specs (by their ID) are modified or removed.',
    'Use the *spec IDs* from "Existing specs" for modified/removed entries.',
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n')

  const orcheConfig = loadOrcheConfig(root)
  const defaultRole = orcheConfig?.models?.default
  const provider = defaultRole?.provider
    ? getProvider(defaultRole.provider)
    : getProvider('openrouter')
  const model = defaultRole?.model || 'deepseek/deepseek-r1'

  const response = await provider.chat({
    model,
    system: buildSystemPrompt(design),
    messages: [{ role: 'user', content: userContent }],
  })

  return extractCapabilities(response.text.trim())
}
