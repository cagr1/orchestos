import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { classifyTask } from '../router/classify.ts'
import { buildSkillInstructions } from '../skills/catalog.ts'
import type { Task } from '../tasks/schema.ts'

export interface BuiltPrompt {
  system: string
  userContent: string
}

/** Selects retry feedback for the next attempt; kept pure for deterministic coverage. */
export function previousFailureForTask(task: Task): string | undefined {
  return task.retry_count > 0 ? task.retry_reason : undefined
}

export function buildPrompt(
  task: Task,
  contextText: string,
  projectRoot: string,
  skillGuidelines?: string,
  instinctBlock?: string,
  previousFailure?: string,
  roadmapInstructions?: string,
): BuiltPrompt {
  const guidelines = skillGuidelines ?? loadSkillGuidelines(task, projectRoot)

  const system = [
    contextText || '# Project context\nNo AGENTS.md found.',
    guidelines,
    roadmapInstructions ?? '',
    instinctBlock ?? '',
    `\n## OUTPUT CONTRACT`,
    `You may ONLY write to these files: ${task.output.join(', ')}`,
    `Output each file using EXACTLY this format — nothing else before the first delimiter or after the last:`,
    ...task.output.map((p) => `<<<FILE:${p}>>>\n(full file content)\n<<<ENDFILE>>>`),
    `Replace the placeholder with the actual file content. No JSON, no markdown fences, no extra text.`,
  ]
    .filter(Boolean)
    .join('\n')

  let userContent = `Task: ${task.description}\n`
  for (const file of task.input) {
    const fullPath = join(projectRoot, file)
    if (existsSync(fullPath)) {
      userContent += `\n### ${file}\n\`\`\`\n${readFileSync(fullPath, 'utf-8')}\n\`\`\`\n`
    }
  }

  if (previousFailure) {
    const head = previousFailure.split('\n', 1)[0]!.slice(0, 300)
    const truncated =
      previousFailure.length <= 2000
        ? previousFailure
        : `${head}\n…\n${previousFailure.slice(-(2000 - head.length - 3))}`
    userContent += `\n## PREVIOUS ATTEMPT FAILED\nThe last attempt at this task failed for this reason:\n${truncated}\nFix the cause described above. Do not repeat the same mistake.`
  }

  return { system, userContent }
}

function loadSkillGuidelines(task: Task, root = process.cwd()): string {
  return buildSkillInstructions(task, task.task_class ?? classifyTask(task.description), root).text
}
