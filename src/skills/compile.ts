import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SkillDef, SkillTarget } from './registry.ts'
import { compileClaude } from './targets/claude.ts'
import { compileCursor } from './targets/cursor.ts'
import { compileOpenAI } from './targets/openai.ts'

const EXT: Record<SkillTarget, string> = {
  claude: '.md',
  cursor: '.mdc',
  openai: '.json',
}

const COMPILERS: Record<SkillTarget, (s: SkillDef, detectedLanguage?: string) => string> = {
  claude: compileClaude,
  cursor: compileCursor,
  openai: compileOpenAI,
}

export function compileSkill(
  skill: SkillDef,
  targets?: SkillTarget[],
  detectedLanguage?: string,
  root = process.cwd(),
): string[] {
  const toCompile = targets ?? skill.targets
  const written: string[] = []

  for (const target of toCompile) {
    if (!skill.targets.includes(target)) {
      console.warn(`[skill] ${skill.id} does not declare target "${target}" — skipping`)
      continue
    }
    const outDir = join(root, 'dist', 'skills', target)
    mkdirSync(outDir, { recursive: true })
    const content = COMPILERS[target](skill, detectedLanguage)
    const outPath = join(outDir, `${skill.id}${EXT[target]}`)
    writeFileSync(outPath, content, 'utf-8')
    written.push(outPath)
  }

  return written
}
