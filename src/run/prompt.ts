import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { loadSkill, resolveSkillPath } from '../skills/registry.ts'
import { buildSections } from '../skills/targets/_shared.ts'
import type { Task } from '../tasks/schema.ts'

export interface BuiltPrompt {
  system: string
  userContent: string
}

export function buildPrompt(
  task: Task,
  contextText: string,
  projectRoot: string,
  constitutionBlock?: string,
  skillGuidelines?: string,
  instinctBlock?: string,
  previousFailure?: string,
  roadmapInstructions?: string,
): BuiltPrompt {
  const guidelines = skillGuidelines ?? loadSkillGuidelines(task.skill)

  const system = [
    contextText || '# Project context\nNo AGENTS.md found.',
    constitutionBlock ?? '',
    guidelines,
    roadmapInstructions ?? '',
    instinctBlock ?? '',
    `\n## OUTPUT CONTRACT`,
    `You may ONLY write to these files: ${task.output.join(', ')}`,
    `Output each file using EXACTLY this format — nothing else before the first delimiter or after the last:`,
    ...task.output.map(p => `<<<FILE:${p}>>>\n(full file content)\n<<<ENDFILE>>>`),
    `Replace the placeholder with the actual file content. No JSON, no markdown fences, no extra text.`,
  ].filter(Boolean).join('\n')

  let userContent = `Task: ${task.description}\n`
  for (const file of task.input) {
    const fullPath = join(projectRoot, file)
    if (existsSync(fullPath)) {
      userContent += `\n### ${file}\n\`\`\`\n${readFileSync(fullPath, 'utf-8')}\n\`\`\`\n`
    }
  }

  if (previousFailure) {
    const truncated = previousFailure.slice(0, 2000)
    userContent += `\n## PREVIOUS ATTEMPT FAILED\nThe last attempt at this task failed for this reason:\n${truncated}\nFix the cause described above. Do not repeat the same mistake.`

  }

  return { system, userContent }
}

// N.4.5 (Mes 25, 2026-07-31) — usa buildSections(), el mismo renderer que
// compila las skills para Claude Code/Cursor/OpenAI. Antes este helper
// duplicaba `skill.instructions` a mano y nunca incluía iron_law /
// common_rationalizations / red_flags (N.1-N.3) — el endurecimiento llegaba
// a herramientas externas pero nunca al ejecutor propio de OrchestOS.
function loadSkillGuidelines(skillId?: string): string {
  if (!skillId) return ''

  try {
    const skill = loadSkill(resolveSkillPath(skillId))
    return `\n## SKILL GUIDELINES: ${skill.name}\n${buildSections(skill).join('\n\n')}\n`
  } catch {
    return ''
  }
}
