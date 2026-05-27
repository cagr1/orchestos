/**
 * src/spec/draft.ts
 *
 * Calls the LLM to generate the body of a spec for a given task.
 * Uses the same provider pattern as harness.ts.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getProvider } from '../providers/index.ts'
import { loadOrcheConfig } from '../config/load.ts'

const SYSTEM_PROMPT = `Eres un arquitecto de software. Genera una spec técnica para la tarea dada. Los criterios de aceptación deben ser verificables y concretos — nunca vagos como "funciona correctamente". Responde SOLO con el body markdown (sin frontmatter): secciones Contexto, Descripción, Criterios de aceptación, Notas.`

/**
 * Draft a spec body for the given task using the LLM.
 * Returns the body string (no frontmatter).
 */
export async function draftSpec(root: string, taskId: string, taskDescription: string): Promise<string> {
  // Load optional context files
  const contextParts: string[] = []

  const constitutionPath = join(root, 'CONSTITUTION.md')
  if (existsSync(constitutionPath)) {
    contextParts.push(`## CONSTITUTION.md\n${readFileSync(constitutionPath, 'utf-8')}`)
  }

  const contextMdPath = join(root, 'CONTEXT.md')
  const agentsMdPath  = join(root, 'AGENTS.md')
  if (existsSync(contextMdPath)) {
    contextParts.push(`## CONTEXT.md\n${readFileSync(contextMdPath, 'utf-8')}`)
  } else if (existsSync(agentsMdPath)) {
    contextParts.push(`## AGENTS.md\n${readFileSync(agentsMdPath, 'utf-8')}`)
  }

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
    '## Criterios de aceptación',
    '- [ ] <concrete, verifiable criterion>',
    '',
    '## Notas',
    '<any relevant notes>',
  ].filter(l => l !== null && l !== undefined).join('\n')

  // Resolve model and provider from config
  const orcheConfig = loadOrcheConfig(root)
  const defaultRole = orcheConfig?.models?.default
  const provider = defaultRole?.provider
    ? getProvider(defaultRole.provider)
    : getProvider('openrouter')
  const model = defaultRole?.model || 'deepseek/deepseek-r1'

  const response = await provider.chat({
    model,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  return response.text.trim()
}
