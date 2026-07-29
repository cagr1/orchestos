import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { glob } from 'glob'
import { readManifest, type Manifest } from './manifest.ts'
import { detectLanguages, type LangStat } from './languages.ts'
import { readConventions, type Conventions } from './conventions.ts'

/**
 * M.3 (Mes 24) — perfil efectivo del proyecto para el sistema de roadmaps.
 *
 * Reusa la detección existente (manifest/languages/conventions de `src/detect/`,
 * ya consumida por `context update` para AGENTS.md/CONTEXT.md) en vez de
 * reinventarla — mismo principio de auditoría previa que M.0. Este módulo solo
 * agrega lo que faltaba: qué disciplina(s)/lenguaje(s) de `docs/roadmaps/`
 * aplican a ESTE proyecto, con estado explícito por hallazgo.
 */
export type StageState = 'known' | 'detected' | 'verified' | 'missing' | 'not-applicable'

export interface Finding {
  state: StageState
  evidence: string
  /** Ruta relativa a docs/roadmaps/{disciplines,languages}/<slug>.md, si existe. */
  docPath?: string
}

export interface DisciplineFinding extends Finding {
  discipline: string
}

export interface LanguageFinding extends Finding {
  language: string
  pct: number
}

export interface RoadmapProfile {
  generatedAt: string
  manifest: Manifest
  languages: LangStat[]
  conventions: Conventions
  commands: string[]
  disciplines: DisciplineFinding[]
  languageProfiles: LanguageFinding[]
  ci: Finding
  docker: Finding
  database: Finding
  instructionFiles: Record<string, StageState>
  toolchain: { name: string; version: string }[]
}

const BACKEND_FRAMEWORKS = new Set([
  'Express', 'Fastify', 'NestJS', 'Actix', 'Axum', 'FastAPI', 'Django', 'Flask', 'Gin', 'Fiber', 'ASP.NET',
])
const FRONTEND_FRAMEWORKS = new Set(['Next.js', 'Nuxt', 'Vue', 'React', 'Svelte', 'Angular'])
const DB_DEPS = ['prisma', '@prisma/client', 'drizzle-orm', 'typeorm', 'pg', 'mysql2', 'mongoose', 'better-sqlite3', 'sqlite3', 'sequelize', 'knex']
const AGENT_DEPS = ['@anthropic-ai/sdk', 'openai', 'langchain', '@langchain/core', 'ollama']

const SERVER_ENTRY_PATTERNS = [/Bun\.serve\s*\(/, /createServer\s*\(/, /express\s*\(\s*\)/, /fastify\s*\(/, /NestFactory\.create/]

/**
 * Busca `docs/roadmaps/languages/<slug>*.md` por prefijo, no por nombre exacto —
 * evita hardcodear cada variante de nombre (ej. `typescript-bun.md` en vez de
 * `typescript.md`, que es como quedó nombrado el perfil real de TypeScript/Bun).
 */
function findLanguageDoc(root: string, lang: string): string | undefined {
  const slug = lang.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const dir = join(root, 'docs', 'roadmaps', 'languages')
  if (!existsSync(dir)) return undefined
  const matches = glob.sync(`${slug}*.md`, { cwd: dir })
  return matches[0] ? join('docs', 'roadmaps', 'languages', matches[0]) : undefined
}

function docExists(root: string, kind: 'disciplines' | 'languages', slug: string): string | undefined {
  const rel = join('docs', 'roadmaps', kind, `${slug}.md`)
  return existsSync(join(root, rel)) ? rel : undefined
}

function findServerEntry(root: string): string | undefined {
  const files = glob.sync('src/**/*.ts', { cwd: root, ignore: ['**/__tests__/**', '**/*.test.ts'] })
  for (const f of files) {
    try {
      const content = readFileSync(join(root, f), 'utf-8')
      if (SERVER_ENTRY_PATTERNS.some(re => re.test(content))) return f
    } catch { /* archivo ilegible — se ignora */ }
  }
  return undefined
}

function detectDisciplines(root: string, manifest: Manifest, languages: LangStat[]): DisciplineFinding[] {
  const hasHtml = languages.some(l => l.lang === 'HTML')
  const testFiles = glob.sync('**/*.{test,spec}.{ts,tsx,js,jsx,py,go,rs}', {
    cwd: root, ignore: ['node_modules/**', '.git/**'],
  })
  const ciFiles = existsSync(join(root, '.github', 'workflows'))
    ? glob.sync('*.{yml,yaml}', { cwd: join(root, '.github', 'workflows') })
    : []
  const allDeps = manifest.deps

  const results: DisciplineFinding[] = []

  const backendMatch = findServerEntry(root)
  results.push(
    BACKEND_FRAMEWORKS.has(manifest.framework)
      ? { discipline: 'backend', state: 'detected', evidence: `framework detectado: ${manifest.framework}` }
      : backendMatch
      ? { discipline: 'backend', state: 'detected', evidence: `servidor custom detectado en ${backendMatch}` }
      : { discipline: 'backend', state: 'not-applicable', evidence: 'sin señal de framework/servidor backend — confirmar manualmente' }
  )
  results.push(
    hasHtml || FRONTEND_FRAMEWORKS.has(manifest.framework)
      ? { discipline: 'frontend', state: 'detected', evidence: hasHtml ? 'archivos .html detectados' : `framework detectado: ${manifest.framework}` }
      : { discipline: 'frontend', state: 'not-applicable', evidence: 'sin señal de HTML/framework frontend — confirmar manualmente' }
  )
  results.push(
    testFiles.length > 0
      ? { discipline: 'qa-seguridad', state: 'detected', evidence: `${testFiles.length} archivos de test encontrados` }
      : { discipline: 'qa-seguridad', state: 'missing', evidence: 'no se encontraron archivos *.test.*/*.spec.*' }
  )
  results.push(
    ciFiles.length > 0 || existsSync(join(root, 'Dockerfile'))
      ? { discipline: 'devops', state: 'detected', evidence: ciFiles.length > 0 ? `${ciFiles.length} workflow(s) de CI` : 'Dockerfile presente' }
      : { discipline: 'devops', state: 'missing', evidence: 'sin CI ni Dockerfile detectado' }
  )
  results.push({
    discipline: 'architecture', state: 'not-applicable',
    evidence: 'sin heurística automática para arquitectura — requiere revisión manual',
  })
  results.push(
    AGENT_DEPS.some(d => allDeps.includes(d))
      ? { discipline: 'ai-agents', state: 'detected', evidence: `dependencia de agente/LLM detectada: ${AGENT_DEPS.find(d => allDeps.includes(d))}` }
      : { discipline: 'ai-agents', state: 'not-applicable', evidence: 'sin dependencia de SDK de agente/LLM detectada' }
  )

  for (const r of results) {
    r.docPath = docExists(root, 'disciplines', r.discipline)
    if (!r.docPath && r.state === 'detected') {
      // La disciplina aplica pero todavía no se promovió su roadmap desde el vault.
      r.evidence += ' — roadmap de disciplina aún no promovido (docs/roadmaps/disciplines/ no lo tiene)'
    }
  }
  return results
}

function detectLanguageProfiles(root: string, languages: LangStat[]): LanguageFinding[] {
  return languages.map(l => {
    const docPath = findLanguageDoc(root, l.lang)
    return {
      language: l.lang,
      pct: l.pct,
      state: docPath ? 'known' : 'missing',
      evidence: docPath
        ? `${l.pct}% del código, roadmap de lenguaje disponible`
        : `${l.pct}% del código, sin roadmap de lenguaje todavía (eje secundario, M.2 pendiente)`,
      docPath,
    } as LanguageFinding
  })
}

function detectDatabase(root: string, manifest: Manifest): Finding {
  const known = DB_DEPS.filter(d => manifest.deps.includes(d))
  if (known.length > 0) return { state: 'detected', evidence: `dependencia(s) de DB: ${known.join(', ')}` }
  const sqliteUsage = glob.sync('src/**/*.ts', { cwd: root, ignore: ['**/__tests__/**'] })
    .some(f => {
      try { return readFileSync(join(root, f), 'utf-8').includes('bun:sqlite') } catch { return false }
    })
  if (sqliteUsage) return { state: 'detected', evidence: "uso de 'bun:sqlite' encontrado en el código fuente" }
  return { state: 'not-applicable', evidence: 'sin dependencia de DB ni uso de bun:sqlite detectado' }
}

function detectInstructionFiles(root: string): Record<string, StageState> {
  const files = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md', 'PLAN.md']
  const out: Record<string, StageState> = {}
  for (const f of files) out[f] = existsSync(join(root, f)) ? 'detected' : 'missing'
  return out
}

/** Comandos read-only y baratos — nunca build/test completo. Fallo → 'missing', nunca bloquea. */
function verifyToolchain(): { name: string; version: string }[] {
  const out: { name: string; version: string }[] = [{ name: 'bun', version: Bun.version }]
  try {
    const proc = Bun.spawnSync(['bunx', 'tsc', '--version'])
    if (proc.exitCode === 0) {
      const text = proc.stdout.toString().trim()
      out.push({ name: 'typescript', version: text.replace(/^Version\s+/, '') })
    }
  } catch { /* tsc no disponible localmente — se omite, no bloquea */ }
  return out
}

export async function buildRoadmapProfile(root: string): Promise<RoadmapProfile> {
  const manifest = readManifest(root)
  const languages = await detectLanguages(root)
  const conventions = await readConventions(root)
  const commands: string[] = []
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
    const scripts = pkg.scripts ?? {}
    const interesting = ['dev', 'build', 'start', 'test', 'lint', 'format', 'typecheck', 'migrate']
    const pm = pkg.packageManager?.startsWith('bun') || existsSync(join(root, 'bun.lock')) ? 'bun' : 'npm'
    for (const key of interesting) if (scripts[key]) commands.push(`${pm} run ${key}`)
  } catch { /* sin package.json */ }

  return {
    generatedAt: new Date().toISOString(),
    manifest,
    languages,
    conventions,
    commands,
    disciplines: detectDisciplines(root, manifest, languages),
    languageProfiles: detectLanguageProfiles(root, languages),
    ci: (() => {
      const dir = join(root, '.github', 'workflows')
      if (!existsSync(dir)) return { state: 'missing', evidence: 'no existe .github/workflows' }
      const files = glob.sync('*.{yml,yaml}', { cwd: dir })
      return { state: 'detected', evidence: `${files.length} workflow(s): ${files.join(', ')}` }
    })(),
    docker: existsSync(join(root, 'Dockerfile')) || existsSync(join(root, 'docker-compose.yml'))
      ? { state: 'detected', evidence: 'Dockerfile/docker-compose.yml presente' }
      : { state: 'not-applicable', evidence: 'sin Dockerfile/docker-compose.yml — no necesariamente aplica' },
    database: detectDatabase(root, manifest),
    instructionFiles: detectInstructionFiles(root),
    toolchain: verifyToolchain(),
  }
}

export function renderProjectProfileMarkdown(profile: RoadmapProfile): string {
  const lines: string[] = []
  lines.push('# project-profile.md — perfil efectivo del proyecto')
  lines.push('')
  lines.push(`Generado: ${profile.generatedAt}. Regenerar con \`orchestos roadmap check\`.`)
  lines.push('')
  lines.push('## Entorno')
  lines.push('')
  lines.push(`- Runtime/framework detectado: ${profile.manifest.runtime} / ${profile.manifest.framework}`)
  for (const t of profile.toolchain) lines.push(`- \`${t.name}\` **verified**: ${t.version}`)
  lines.push('')
  lines.push('## Lenguajes detectados (políglota, no reducido a uno solo)')
  lines.push('')
  lines.push('| Lenguaje | % | Estado | Roadmap |')
  lines.push('|---|---:|---|---|')
  for (const l of profile.languageProfiles) {
    lines.push(`| ${l.language} | ${l.pct}% | \`${l.state}\` | ${l.evidence} |`)
  }
  lines.push('')
  lines.push('## Disciplinas aplicables')
  lines.push('')
  lines.push('| Disciplina | Estado | Evidencia |')
  lines.push('|---|---|---|')
  for (const d of profile.disciplines) {
    lines.push(`| ${d.discipline} | \`${d.state}\` | ${d.evidence} |`)
  }
  lines.push('')
  lines.push('## Infraestructura')
  lines.push('')
  lines.push(`- CI: \`${profile.ci.state}\` — ${profile.ci.evidence}`)
  lines.push(`- Docker: \`${profile.docker.state}\` — ${profile.docker.evidence}`)
  lines.push(`- Base de datos: \`${profile.database.state}\` — ${profile.database.evidence}`)
  lines.push('')
  lines.push('## Archivos de instrucciones')
  lines.push('')
  for (const [f, state] of Object.entries(profile.instructionFiles)) lines.push(`- ${f}: \`${state}\``)
  lines.push('')
  lines.push('## Comandos detectados (package.json scripts)')
  lines.push('')
  lines.push(profile.commands.length > 0 ? profile.commands.map(c => `- \`${c}\``).join('\n') : '- ninguno detectado')
  lines.push('')
  return lines.join('\n')
}
