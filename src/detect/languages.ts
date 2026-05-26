import { glob } from 'glob'

export interface LangStat {
  lang: string
  count: number
  pct: number
}

const EXT_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python',
  cs: 'C#',
  vue: 'Vue',
  rs: 'Rust',
  go: 'Go',
  sql: 'SQL',
  java: 'Java',
  kt: 'Kotlin',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  cpp: 'C++', cc: 'C++', cxx: 'C++',
  c: 'C', h: 'C',
}

const IGNORE = ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'target/**', '.next/**', 'out/**', 'coverage/**']

export async function detectLanguages(root: string): Promise<LangStat[]> {
  const files = await glob('**/*.*', { cwd: root, ignore: IGNORE, nodir: true })

  const counts: Record<string, number> = {}
  let total = 0

  for (const file of files) {
    const ext = file.split('.').pop()?.toLowerCase() ?? ''
    const lang = EXT_MAP[ext]
    if (lang) {
      counts[lang] = (counts[lang] ?? 0) + 1
      total++
    }
  }

  if (total === 0) return []

  return Object.entries(counts)
    .map(([lang, count]) => ({ lang, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}
