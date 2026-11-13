import { lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { InstinctDef } from './schema.ts'

const START = '<!-- orchestos:lessons:start -->'
const END = '<!-- orchestos:lessons:end -->'
type Lesson = Pick<InstinctDef, 'trigger' | 'action'>

export function planGraduation(
  current: string | null,
  lesson: Lesson,
): { after: string; added: string[]; created: boolean } {
  const line = `- When ${lesson.trigger.replace(/[\r\n]+/g, ' ')}: ${lesson.action.replace(/[\r\n]+/g, ' ')}`
  const block = `${START}\n## Lessons learned\n${line}\n${END}\n`
  if (current === null) return { after: block, added: [line], created: true }
  // Markers count only as whole lines: a lesson whose text quotes a marker must not move the block.
  const lines = current.split('\n')
  const start = lines.findIndex((l) => l.trimEnd() === START)
  const end = start < 0 ? -1 : lines.findIndex((l, i) => i > start && l.trimEnd() === END)
  if (start >= 0 && end >= 0) {
    if (lines.slice(start + 1, end).some((l) => l.trimEnd() === line))
      return { after: current, added: [], created: false }
    return {
      after: [...lines.slice(0, end), line, ...lines.slice(end)].join('\n'),
      added: [line],
      created: false,
    }
  }
  return {
    after: `${current}\n${block}`,
    added: [line],
    created: false,
  }
}

export class GraduationSymlinkError extends Error {}

export function graduateLesson(root: string, lesson: Lesson, { write }: { write: boolean }) {
  const path = join(root, 'AGENTS.md')
  let current: string | null = null
  try {
    if (lstatSync(path).isSymbolicLink()) throw new GraduationSymlinkError('AGENTS.md is a symlink')
    current = readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const plan = planGraduation(current, lesson)
  if (write && plan.added.length > 0) writeFileSync(path, plan.after)
  return { path, ...plan }
}
