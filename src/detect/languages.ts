import { glob } from 'glob'

export interface LangStat {
  lang: string
  count: number
  pct: number
}

const EXT_MAP: Record<string, string> = {
  // Web — JS ecosystem
  ts: 'TypeScript', tsx: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  vue: 'Vue',
  svelte: 'Svelte',
  html: 'HTML', htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS', sass: 'SCSS',
  // Backend — general purpose
  py: 'Python',
  rb: 'Ruby',
  php: 'PHP',
  go: 'Go',
  java: 'Java',
  kt: 'Kotlin',
  scala: 'Scala',
  groovy: 'Groovy',
  // .NET ecosystem
  cs: 'C#',
  vb: 'Visual Basic', vbs: 'Visual Basic',
  fs: 'F#', fsi: 'F#', fsx: 'F#',
  // Systems
  rs: 'Rust',
  cpp: 'C++', cc: 'C++', cxx: 'C++', hpp: 'C++',
  c: 'C', h: 'C',
  swift: 'Swift',
  // Mobile
  dart: 'Dart',
  // Data / Science / Analytics
  r: 'R', rmd: 'R',
  jl: 'Julia',
  sql: 'SQL', psql: 'SQL', mysql: 'SQL',
  // Functional
  hs: 'Haskell', lhs: 'Haskell',
  ex: 'Elixir', exs: 'Elixir',
  clj: 'Clojure', cljs: 'ClojureScript', cljc: 'Clojure',
  erl: 'Erlang', hrl: 'Erlang',
  ml: 'OCaml', mli: 'OCaml',
  // Scripting / Shell
  sh: 'Shell', bash: 'Shell', zsh: 'Shell',
  ps1: 'PowerShell', psm1: 'PowerShell', psd1: 'PowerShell',
  lua: 'Lua',
  pl: 'Perl', pm: 'Perl',
}

const IGNORE = [
  'node_modules/**', '.git/**', 'dist/**', 'build/**',
  'target/**', '.next/**', 'out/**', 'coverage/**', 'bin/**', 'obj/**',
]

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

export async function detectPrimaryLanguage(root: string): Promise<string | null> {
  const stats = await detectLanguages(root)
  return stats.length > 0 ? (stats[0]?.lang ?? null) : null
}

export const SUPPORTED_LANGUAGES = Object.values(EXT_MAP).filter(
  (v, i, a) => a.indexOf(v) === i
).sort()
