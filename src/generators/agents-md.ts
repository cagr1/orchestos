import type { Manifest } from '../detect/manifest.ts'
import type { LangStat } from '../detect/languages.ts'
import type { Conventions } from '../detect/conventions.ts'

export interface StackProfile {
  manifest: Manifest
  languages: LangStat[]
  conventions: Conventions
  commands: string[]
}

export function generateAgentsMd(profile: StackProfile): string {
  const { manifest, languages, conventions, commands } = profile

  const langLine = languages.length > 0
    ? languages.slice(0, 3).map(l => `${l.lang} (${l.pct}%)`).join(', ')
    : 'unknown'

  const conventionBullets: string[] = []
  if (conventions.prettier) conventionBullets.push('Prettier configured — match existing formatting')
  if (conventions.eslint) conventionBullets.push('ESLint configured — no new lint errors')
  if (conventions.editorconfig) conventionBullets.push('EditorConfig present — respect indent and charset')
  if (conventions.tsconfig?.strict) conventionBullets.push('TypeScript strict mode enabled')
  if (conventions.tsconfig?.target) conventionBullets.push(`TS target: ${conventions.tsconfig.target}`)
  if (conventionBullets.length === 0) conventionBullets.push('No convention files detected')

  const cmdLines = commands.length > 0
    ? commands.map(c => `- \`${c}\``).join('\n')
    : '- No scripts detected'

  const dbNote = manifest.deps.includes('Prisma')
    ? '\n- Schema changes require `npx prisma migrate dev` — do not edit the DB directly.'
    : manifest.deps.includes('Drizzle')
    ? '\n- Schema changes go through Drizzle migrations.'
    : ''

  return `# AGENTS.md — ${manifest.name}

## Stack
- Runtime: ${manifest.runtime}
- Framework: ${manifest.framework}
- Languages: ${langLine}

## Conventions
${conventionBullets.map(b => `- ${b}`).join('\n')}

## Useful commands
${cmdLines}

## Notes for AI agents
- Edit only files explicitly requested.
- Match existing code style — do not reformat unrelated code.
- Do not introduce new dependencies without asking.
- Do not run destructive commands (drop tables, delete files, git reset --hard) without explicit confirmation.${dbNote}
`
}
