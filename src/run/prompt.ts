import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { loadSkill, getSkillPath } from '../skills/registry.ts'
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
): BuiltPrompt {
  const guidelines = skillGuidelines ?? loadSkillGuidelines(task.skill)

  const system = [
    contextText || '# Project context\nNo AGENTS.md found.',
    constitutionBlock ?? '',
    guidelines,
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

function loadSkillGuidelines(skillId?: string): string {
  if (!skillId) return ''

  try {
    const skill = loadSkill(getSkillPath(skillId))
    return `\n## SKILL GUIDELINES: ${skill.name}\n${skill.instructions}\n`
  } catch {
    return ''
  }
}
