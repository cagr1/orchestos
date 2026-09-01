import { existsSync, readFileSync } from 'fs'
import { glob } from 'glob'
import { join } from 'path'
import { parse } from 'yaml'
import { type Conventions, readConventions } from './conventions.ts'
import { detectLanguages, type LangStat } from './languages.ts'
import { type Manifest, readManifest } from './manifest.ts'

/**
 * Las guías genéricas de `docs/roadmaps/{disciplines,languages}/` viven centralizadas en la
 * instalación de OrchestOS, no en cada proyecto gestionado (decisión Carlos, 2026-07-30) — un
 * proyecto sin `docs/roadmaps/` propio igual debe poder resolver `state: 'known'`/`'detected'`
 * contra la guía central. Mismo constante que [[src/roadmaps/context.ts]] usa para leer el
 * contenido; acá se usa solo para decidir existencia.
 */
const ROADMAP_DOCS_ROOT = join(import.meta.dir, '..', '..')

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

export interface RoadmapOverrides {
  disciplines?: { include?: string[]; exclude?: string[] }
  languages?: { include?: string[]; exclude?: string[] }
}

const DISCIPLINES = new Set([
  'backend',
  'frontend',
  'qa-seguridad',
  'devops',
  'architecture',
  'ai-agents',
])

function validList(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && allowed.has(v))
}

export function readRoadmapOverrides(root: string): RoadmapOverrides {
  const path = join(root, 'docs', 'roadmaps', 'project-overrides.yaml')
  if (!existsSync(path)) return {}
  try {
    const raw = parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
    const source = (raw.roadmap_overrides ?? raw) as Record<string, unknown>
    const disciplines = (source.disciplines ?? {}) as Record<string, unknown>
    const languages = (source.languages ?? {}) as Record<string, unknown>
    return {
      disciplines: {
        include: validList(disciplines.include, DISCIPLINES),
        exclude: validList(disciplines.exclude, DISCIPLINES),
      },
      languages: {
        include: validList(
          languages.include,
          new Set(['typescript', 'rust', 'go', 'javascript', 'html', 'csharp']),
        ),
        exclude: validList(
          languages.exclude,
          new Set(['typescript', 'rust', 'go', 'javascript', 'html', 'csharp']),
        ),
      },
    }
  } catch {
    return {}
  }
}

function applyRoadmapOverrides(
  profile: RoadmapProfile,
  overrides: RoadmapOverrides,
): RoadmapProfile {
  const disciplines = [...profile.disciplines]
  const d = overrides.disciplines ?? {}
  for (const slug of d.exclude ?? []) {
    const found = disciplines.find((item) => item.discipline === slug)
    if (found) {
      found.state = 'not-applicable'
      found.evidence = 'excluida explícitamente por docs/roadmaps/project-overrides.yaml'
    }
  }
  for (const slug of d.include ?? []) {
    const found = disciplines.find((item) => item.discipline === slug)
    if (found) {
      found.state = 'detected'
      found.evidence = 'incluida explícitamente por docs/roadmaps/project-overrides.yaml'
    }
  }

  const languageProfiles = [...profile.languageProfiles]
  const l = overrides.languages ?? {}
  for (const slug of l.exclude ?? []) {
    const found = languageProfiles.find((item) => item.language.toLowerCase() === slug)
    if (found) {
      found.state = 'not-applicable'
      found.evidence = 'excluido explícitamente por docs/roadmaps/project-overrides.yaml'
    }
  }
  for (const slug of l.include ?? []) {
    const found = languageProfiles.find((item) => item.language.toLowerCase() === slug)
    if (found) {
      found.state = found.docPath ? 'known' : 'missing'
      found.evidence = `incluido explícitamente por docs/roadmaps/project-overrides.yaml${found.docPath ? '' : ' — roadmap ausente'}`
    }
  }
  return { ...profile, disciplines, languageProfiles }
}

const BACKEND_FRAMEWORKS = new Set([
  'Express',
  'Fastify',
  'NestJS',
  'Actix',
  'Axum',
  'FastAPI',
  'Django',
  'Flask',
  'Gin',
  'Fiber',
  'ASP.NET',
])
const FRONTEND_FRAMEWORKS = new Set(['Next.js', 'Nuxt', 'Vue', 'React', 'Svelte', 'Angular'])
const DB_DEPS = [
  'prisma',
  '@prisma/client',
  'drizzle-orm',
  'typeorm',
  'pg',
  'mysql2',
  'mongoose',
  'better-sqlite3',
  'sqlite3',
  'sequelize',
  'knex',
]
const AGENT_DEPS = ['@anthropic-ai/sdk', 'openai', 'langchain', '@langchain/core', 'ollama']

const SERVER_ENTRY_PATTERNS = [
  /Bun\.serve\s*\(/,
  /createServer\s*\(/,
  /express\s*\(\s*\)/,
  /fastify\s*\(/,
  /NestFactory\.create/,
]

/**
 * Busca `docs/roadmaps/languages/<slug>*.md` por prefijo, no por nombre exacto —
 * evita hardcodear cada variante de nombre (ej. `typescript-bun.md` en vez de
 * `typescript.md`, que es como quedó nombrado el perfil real de TypeScript/Bun).
 */
function findLanguageDocUnder(base: string, lang: string): string | undefined {
  const slug = lang.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const dir = join(base, 'docs', 'roadmaps', 'languages')
  if (!existsSync(dir)) return undefined
  const matches = glob.sync(`${slug}*.md`, { cwd: dir })
  return matches[0] ? join('docs', 'roadmaps', 'languages', matches[0]) : undefined
}

function findLanguageDoc(root: string, lang: string): string | undefined {
  return findLanguageDocUnder(root, lang) ?? findLanguageDocUnder(ROADMAP_DOCS_ROOT, lang)
}

function docExistsUnder(
  base: string,
  kind: 'disciplines' | 'languages',
  slug: string,
): string | undefined {
  const rel = join('docs', 'roadmaps', kind, `${slug}.md`)
  return existsSync(join(base, rel)) ? rel : undefined
}

function docExists(
  root: string,
  kind: 'disciplines' | 'languages',
  slug: string,
): string | undefined {
  return docExistsUnder(root, kind, slug) ?? docExistsUnder(ROADMAP_DOCS_ROOT, kind, slug)
}

function findServerEntry(root: string): string | undefined {
  const files = glob.sync('src/**/*.ts', { cwd: root, ignore: ['**/__tests__/**', '**/*.test.ts'] })
  for (const f of files) {
    try {
      const content = readFileSync(join(root, f), 'utf-8')
      if (SERVER_ENTRY_PATTERNS.some((re) => re.test(content))) return f
    } catch {
      /* archivo ilegible — se ignora */
    }
  }
  return undefined
}

/**
 * M.5 (dogfooding contra rust-hello/go-hello) — el patrón `*.test.*`/`*.spec.*`
 * es convención JS/TS; Go usa sufijo `_test.go` (sin punto) y Rust usa módulos
 * inline `#[cfg(test)]` o un directorio `tests/` — sin esto, un proyecto Go/Rust
 * real con tests reales salía `missing` de qa-seguridad, un falso negativo.
 */
function findTestSignals(root: string): string[] {
  const ignore = ['node_modules/**', '.git/**']
  const files = [
    ...glob.sync('**/*.{test,spec}.{ts,tsx,js,jsx}', { cwd: root, ignore }),
    ...glob.sync('**/*_test.go', { cwd: root, ignore }),
    ...glob.sync('**/{test_*,*_test}.py', { cwd: root, ignore }),
    ...glob.sync('**/tests/**/*.rs', { cwd: root, ignore }),
  ]
  if (files.length > 0) return files
  const hasInlineRustTests = glob.sync('**/*.rs', { cwd: root, ignore }).some((f) => {
    try {
      return readFileSync(join(root, f), 'utf-8').includes('#[cfg(test)]')
    } catch {
      return false
    }
  })
  return hasInlineRustTests ? ['#[cfg(test)] inline (Rust)'] : []
}

function detectDisciplines(
  root: string,
  manifest: Manifest,
  languages: LangStat[],
): DisciplineFinding[] {
  const hasHtml = languages.some((l) => l.lang === 'HTML')
  const testFiles = findTestSignals(root)
  const ciFiles = existsSync(join(root, '.github', 'workflows'))
    ? glob.sync('*.{yml,yaml}', { cwd: join(root, '.github', 'workflows') })
    : []
  const allDeps = manifest.deps

  const results: DisciplineFinding[] = []

  const backendMatch = findServerEntry(root)
  results.push(
    BACKEND_FRAMEWORKS.has(manifest.framework)
      ? {
          discipline: 'backend',
          state: 'detected',
          evidence: `framework detectado: ${manifest.framework}`,
        }
      : backendMatch
        ? {
            discipline: 'backend',
            state: 'detected',
            evidence: `servidor custom detectado en ${backendMatch}`,
          }
        : {
            discipline: 'backend',
            state: 'not-applicable',
            evidence: 'sin señal de framework/servidor backend — confirmar manualmente',
          },
  )
  results.push(
    hasHtml || FRONTEND_FRAMEWORKS.has(manifest.framework)
      ? {
          discipline: 'frontend',
          state: 'detected',
          evidence: hasHtml
            ? 'archivos .html detectados'
            : `framework detectado: ${manifest.framework}`,
        }
      : {
          discipline: 'frontend',
          state: 'not-applicable',
          evidence: 'sin señal de HTML/framework frontend — confirmar manualmente',
        },
  )
  results.push(
    testFiles.length > 0
      ? {
          discipline: 'qa-seguridad',
          state: 'detected',
          evidence: `${testFiles.length} archivos de test encontrados`,
        }
      : {
          discipline: 'qa-seguridad',
          state: 'missing',
          evidence: 'no se encontraron archivos *.test.*/*.spec.*',
        },
  )
  results.push(
    ciFiles.length > 0 || existsSync(join(root, 'Dockerfile'))
      ? {
          discipline: 'devops',
          state: 'detected',
          evidence:
            ciFiles.length > 0 ? `${ciFiles.length} workflow(s) de CI` : 'Dockerfile presente',
        }
      : { discipline: 'devops', state: 'missing', evidence: 'sin CI ni Dockerfile detectado' },
  )
  results.push({
    discipline: 'architecture',
    state: 'not-applicable',
    evidence: 'sin heurística automática para arquitectura — requiere revisión manual',
  })
  results.push(
    AGENT_DEPS.some((d) => allDeps.includes(d))
      ? {
          discipline: 'ai-agents',
          state: 'detected',
          evidence: `dependencia de agente/LLM detectada: ${AGENT_DEPS.find((d) => allDeps.includes(d))}`,
        }
      : {
          discipline: 'ai-agents',
          state: 'not-applicable',
          evidence: 'sin dependencia de SDK de agente/LLM detectada',
        },
  )

  for (const r of results) {
    r.docPath = docExists(root, 'disciplines', r.discipline)
    if (!r.docPath && r.state === 'detected') {
      // La disciplina aplica pero todavía no se promovió su roadmap desde el vault.
      r.evidence +=
        ' — roadmap de disciplina aún no promovido (docs/roadmaps/disciplines/ no lo tiene)'
    }
  }
  return results
}

function detectLanguageProfiles(root: string, languages: LangStat[]): LanguageFinding[] {
  return languages.map((l) => {
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
  const known = DB_DEPS.filter((d) => manifest.deps.includes(d))
  if (known.length > 0)
    return { state: 'detected', evidence: `dependencia(s) de DB: ${known.join(', ')}` }
  const sqliteUsage = glob
    .sync('src/**/*.ts', { cwd: root, ignore: ['**/__tests__/**'] })
    .some((f) => {
      try {
        return readFileSync(join(root, f), 'utf-8').includes('bun:sqlite')
      } catch {
        return false
      }
    })
  if (sqliteUsage)
    return { state: 'detected', evidence: "uso de 'bun:sqlite' encontrado en el código fuente" }
  return {
    state: 'not-applicable',
    evidence: 'sin dependencia de DB ni uso de bun:sqlite detectado',
  }
}

function detectInstructionFiles(root: string): Record<string, StageState> {
  const files = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md', 'PLAN.md']
  const out: Record<string, StageState> = {}
  for (const f of files) out[f] = existsSync(join(root, f)) ? 'detected' : 'missing'
  return out
}

/**
 * Ejecuta un comando read-only de versión y devuelve su stdout, o null si el binario
 * no está en el PATH. Inyectable para que un test no dependa de qué toolchains tenga
 * instalada la máquina que lo corre (Mac sin cargo vs. ubuntu-latest con Rust
 * preinstalado hacía verde en local y rojo en CI — incidente 2026-08-01).
 */
export type ToolchainProbe = (name: string, args: string[]) => string | null

export const spawnToolchainProbe: ToolchainProbe = (name, args) => {
  try {
    const proc = Bun.spawnSync([name, ...args])
    return proc.exitCode === 0 ? proc.stdout.toString().trim() : null
  } catch {
    return null /* toolchain ausente — el perfil lo deja explícito */
  }
}

export interface RoadmapProfileOptions {
  /** Sonda de toolchain. Default: el spawn real contra el PATH del host. */
  probe?: ToolchainProbe
}

/** Comandos read-only y baratos — nunca build/test completo. Fallo → 'missing', nunca bloquea. */
function verifyToolchain(
  languages: LangStat[],
  probe: ToolchainProbe,
): { name: string; version: string }[] {
  const out: { name: string; version: string }[] = [{ name: 'bun', version: Bun.version }]
  const tsc = probe('bunx', ['tsc', '--version'])
  if (tsc !== null) out.push({ name: 'typescript', version: tsc.replace(/^Version\s+/, '') })
  const verify = (name: string, args: string[]) => {
    const version = probe(name, args)
    if (version !== null) out.push({ name, version })
  }
  if (languages.some((l) => l.lang === 'Rust')) verify('cargo', ['--version'])
  if (languages.some((l) => l.lang === 'Go')) verify('go', ['version'])
  return out
}

export async function buildRoadmapProfile(
  root: string,
  options: RoadmapProfileOptions = {},
): Promise<RoadmapProfile> {
  const manifest = readManifest(root)
  const languages = await detectLanguages(root)
  const conventions = await readConventions(root)
  const commands: string[] = []
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
    const scripts = pkg.scripts ?? {}
    const interesting = ['dev', 'build', 'start', 'test', 'lint', 'format', 'typecheck', 'migrate']
    const pm =
      pkg.packageManager?.startsWith('bun') || existsSync(join(root, 'bun.lock')) ? 'bun' : 'npm'
    for (const key of interesting) if (scripts[key]) commands.push(`${pm} run ${key}`)
  } catch {
    /* sin package.json */
  }

  return applyRoadmapOverrides(
    {
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
      docker:
        existsSync(join(root, 'Dockerfile')) || existsSync(join(root, 'docker-compose.yml'))
          ? { state: 'detected', evidence: 'Dockerfile/docker-compose.yml presente' }
          : {
              state: 'not-applicable',
              evidence: 'sin Dockerfile/docker-compose.yml — no necesariamente aplica',
            },
      database: detectDatabase(root, manifest),
      instructionFiles: detectInstructionFiles(root),
      toolchain: verifyToolchain(languages, options.probe ?? spawnToolchainProbe),
    },
    readRoadmapOverrides(root),
  )
}

export function renderProjectProfileMarkdown(profile: RoadmapProfile): string {
  const lines: string[] = []
  lines.push('# project-profile.md — perfil efectivo del proyecto')
  lines.push('')
  lines.push(`Generado: ${profile.generatedAt}. Regenerar con \`orchestos roadmap check\`.`)
  lines.push('')
  lines.push('## Entorno')
  lines.push('')
  lines.push(
    `- Runtime/framework detectado: ${profile.manifest.runtime} / ${profile.manifest.framework}`,
  )
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
  for (const [f, state] of Object.entries(profile.instructionFiles))
    lines.push(`- ${f}: \`${state}\``)
  lines.push('')
  lines.push('## Comandos detectados (package.json scripts)')
  lines.push('')
  lines.push(
    profile.commands.length > 0
      ? profile.commands.map((c) => `- \`${c}\``).join('\n')
      : '- ninguno detectado',
  )
  lines.push('')
  return lines.join('\n')
}
