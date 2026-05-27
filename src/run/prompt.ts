import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { loadSkill, getSkillPath } from '../skills/registry.ts'
import type { Task } from '../tasks/schema.ts'

export interface BuiltPrompt {
  system: string
  userContent: string
}

export function buildPrompt(task: Task, contextText: string, projectRoot: string): BuiltPrompt {
  const skillGuidelines = loadSkillGuidelines(task.skill)

  const system = [
    contextText || '# Project context\nNo AGENTS.md found.',
    skillGuidelines,
    `\n## OUTPUT CONTRACT`,
    `You may ONLY write to these files: ${task.output.join(', ')}`,
    `Respond with ONLY valid JSON - no markdown, no explanation:`,
    `{ "files": [{ "path": "relative/path", "content": "full file content" }] }`,
  ].join('\n')

  let userContent = `Task: ${task.description}\n`
  for (const file of task.input) {
    const fullPath = join(projectRoot, file)
    if (existsSync(fullPath)) {
      userContent += `\n### ${file}\n\`\`\`\n${readFileSync(fullPath, 'utf-8')}\n\`\`\`\n`
    }
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
