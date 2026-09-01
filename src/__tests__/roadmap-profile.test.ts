/**
 * M.3 (Mes 24) — perfil efectivo del proyecto.
 *
 * Cubre las heurísticas de detección con fixtures aislados (no depende de qué
 * exista en disco fuera del fixture) y un caso de dogfooding contra el propio
 * repo de OrchestOS para probar que las señales reales se detectan bien.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { buildRoadmapProfile, renderProjectProfileMarkdown } from '../detect/roadmap-profile.ts'

const dirs: string[] = []
function tmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'orchestos-roadmap-profile-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function writePkg(root: string, extra: Record<string, unknown> = {}): void {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture', ...extra }, null, 2))
}

describe('M.3 — buildRoadmapProfile: disciplinas', () => {
  it('proyecto vacío: nada aplica, sin inventar un pass falso', async () => {
    const root = tmpDir()
    writePkg(root)
    const profile = await buildRoadmapProfile(root)
    const byDiscipline = Object.fromEntries(profile.disciplines.map((d) => [d.discipline, d.state]))
    expect(byDiscipline.backend).toBe('not-applicable')
    expect(byDiscipline.frontend).toBe('not-applicable')
    expect(byDiscipline['qa-seguridad']).toBe('missing')
    expect(byDiscipline.devops).toBe('missing')
  })

  it('detecta backend por framework conocido en package.json', async () => {
    const root = tmpDir()
    writePkg(root, { dependencies: { express: '^4.0.0' } })
    const profile = await buildRoadmapProfile(root)
    const backend = profile.disciplines.find((d) => d.discipline === 'backend')!
    expect(backend.state).toBe('detected')
    expect(backend.evidence).toContain('Express')
  })

  it('detecta backend por servidor custom (Bun.serve) aunque no haya framework npm', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(
      join(root, 'src', 'server.ts'),
      'export function start() { Bun.serve({ fetch: () => new Response("ok") }) }',
    )
    const profile = await buildRoadmapProfile(root)
    const backend = profile.disciplines.find((d) => d.discipline === 'backend')!
    expect(backend.state).toBe('detected')
    expect(backend.evidence).toContain('src/server.ts')
  })

  it('detecta frontend por archivos .html', async () => {
    const root = tmpDir()
    writePkg(root)
    writeFileSync(join(root, 'index.html'), '<html></html>')
    const profile = await buildRoadmapProfile(root)
    expect(profile.disciplines.find((d) => d.discipline === 'frontend')!.state).toBe('detected')
  })

  it('detecta qa-seguridad contando archivos *.test.ts reales', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'foo.test.ts'), 'test("x", () => {})')
    const profile = await buildRoadmapProfile(root)
    const qa = profile.disciplines.find((d) => d.discipline === 'qa-seguridad')!
    expect(qa.state).toBe('detected')
    expect(qa.evidence).toContain('1 archivos')
  })

  it('M.5: detecta qa-seguridad con convención Go (_test.go), no solo *.test.ts', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'pkg'), { recursive: true })
    writeFileSync(join(root, 'go.mod'), 'module fixture\n\ngo 1.22\n')
    writeFileSync(join(root, 'pkg', 'greet.go'), 'package pkg')
    writeFileSync(join(root, 'pkg', 'greet_test.go'), 'package pkg')
    const profile = await buildRoadmapProfile(root)
    expect(profile.disciplines.find((d) => d.discipline === 'qa-seguridad')!.state).toBe('detected')
  })

  it('M.5: detecta qa-seguridad con módulo inline #[cfg(test)] de Rust, sin archivo *.test.rs', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'Cargo.toml'), '[package]\nname = "fixture"\n')
    writeFileSync(join(root, 'src', 'main.rs'), 'fn main() {}\n\n#[cfg(test)]\nmod tests {}\n')
    const profile = await buildRoadmapProfile(root)
    expect(profile.disciplines.find((d) => d.discipline === 'qa-seguridad')!.state).toBe('detected')
  })

  it('detecta devops por workflows de CI', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'name: ci')
    const profile = await buildRoadmapProfile(root)
    expect(profile.disciplines.find((d) => d.discipline === 'devops')!.state).toBe('detected')
    expect(profile.ci.state).toBe('detected')
    expect(profile.ci.evidence).toContain('ci.yml')
  })
})

describe('M.3 — buildRoadmapProfile: infraestructura', () => {
  it('CI missing cuando no existe .github/workflows', async () => {
    const root = tmpDir()
    writePkg(root)
    const profile = await buildRoadmapProfile(root)
    expect(profile.ci.state).toBe('missing')
  })

  it('Docker detected con Dockerfile presente', async () => {
    const root = tmpDir()
    writePkg(root)
    writeFileSync(join(root, 'Dockerfile'), 'FROM node:20')
    const profile = await buildRoadmapProfile(root)
    expect(profile.docker.state).toBe('detected')
  })

  it('Docker not-applicable sin Dockerfile ni docker-compose', async () => {
    const root = tmpDir()
    writePkg(root)
    const profile = await buildRoadmapProfile(root)
    expect(profile.docker.state).toBe('not-applicable')
  })

  it('database detected por dependencia conocida (prisma)', async () => {
    const root = tmpDir()
    writePkg(root, { dependencies: { prisma: '^5.0.0' } })
    const profile = await buildRoadmapProfile(root)
    expect(profile.database.state).toBe('detected')
    expect(profile.database.evidence).toContain('prisma')
  })

  it('database detected por uso real de bun:sqlite en el código, sin dependencia npm', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'db.ts'), "import { Database } from 'bun:sqlite'")
    const profile = await buildRoadmapProfile(root)
    expect(profile.database.state).toBe('detected')
  })

  it('instructionFiles: cada archivo se marca detected/missing según exista', async () => {
    const root = tmpDir()
    writePkg(root)
    writeFileSync(join(root, 'AGENTS.md'), '# agents')
    const profile = await buildRoadmapProfile(root)
    expect(profile.instructionFiles['AGENTS.md']).toBe('detected')
    expect(profile.instructionFiles['CLAUDE.md']).toBe('missing')
    expect(profile.instructionFiles['CONTEXT.md']).toBe('missing')
    expect(profile.instructionFiles['PLAN.md']).toBe('missing')
  })
})

describe('M.3 — perfiles de lenguaje (eje secundario, contra docs/roadmaps/languages/)', () => {
  it('known cuando existe el doc del lenguaje, incluso con sufijo distinto (typescript-bun.md)', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'a.ts'), 'export const x = 1')
    mkdirSync(join(root, 'docs', 'roadmaps', 'languages'), { recursive: true })
    writeFileSync(join(root, 'docs', 'roadmaps', 'languages', 'typescript-bun.md'), '# TS/Bun')
    const profile = await buildRoadmapProfile(root)
    const ts = profile.languageProfiles.find((l) => l.language === 'TypeScript')!
    expect(ts.state).toBe('known')
    expect(ts.docPath).toBe(join('docs', 'roadmaps', 'languages', 'typescript-bun.md'))
  })

  it('missing cuando no hay doc de lenguaje todavía (ni local ni centralizado) — nunca inventa contenido', async () => {
    // C# no tiene doc ni en el proyecto ni en docs/roadmaps/languages/ de OrchestOS —
    // a diferencia de TypeScript/Go/Rust, que desde 2026-07-30 resuelven por fallback
    // a la guía centralizada de OrchestOS aunque el proyecto no tenga la suya propia.
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'a.cs'), 'class Program { static void Main() {} }')
    const profile = await buildRoadmapProfile(root)
    const cs = profile.languageProfiles.find((l) => l.language === 'C#')!
    expect(cs.state).toBe('missing')
    expect(cs.docPath).toBeUndefined()
  })

  it('known por fallback a la guía centralizada de OrchestOS cuando el proyecto no tiene docs/roadmaps propio', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'a.ts'), 'export const x = 1')
    const profile = await buildRoadmapProfile(root)
    const ts = profile.languageProfiles.find((l) => l.language === 'TypeScript')!
    expect(ts.state).toBe('known')
    expect(ts.docPath).toBe(join('docs', 'roadmaps', 'languages', 'typescript-bun.md'))
  })

  it('proyecto políglota: registra cada lenguaje detectado, no reduce a uno primario', async () => {
    const root = tmpDir()
    writePkg(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'a.ts'), 'x')
    writeFileSync(join(root, 'src', 'b.go'), 'package main')
    writeFileSync(join(root, 'src', 'c.rs'), 'fn main() {}')
    const profile = await buildRoadmapProfile(root)
    const langs = profile.languageProfiles.map((l) => l.language).sort()
    expect(langs).toEqual(['Go', 'Rust', 'TypeScript'])
  })
})

describe('M.3 — toolchain: verified requiere comando real, no memoria', () => {
  it('bun queda verified con la versión real del runtime actual', async () => {
    const root = tmpDir()
    writePkg(root)
    const profile = await buildRoadmapProfile(root)
    const bun = profile.toolchain.find((t) => t.name === 'bun')!
    expect(bun.version).toBe(Bun.version)
  })
})

describe('M.3 — dogfooding contra el propio repo de OrchestOS', () => {
  it('detecta backend/frontend/qa-seguridad/devops reales de este repo', async () => {
    const profile = await buildRoadmapProfile(process.cwd())
    const byDiscipline = Object.fromEntries(profile.disciplines.map((d) => [d.discipline, d.state]))
    expect(byDiscipline.backend).toBe('detected')
    expect(byDiscipline.frontend).toBe('detected')
    expect(byDiscipline['qa-seguridad']).toBe('detected')
    expect(byDiscipline.devops).toBe('detected')
  })

  it('TypeScript queda known porque docs/roadmaps/languages/ ya tiene su perfil', async () => {
    const profile = await buildRoadmapProfile(process.cwd())
    const ts = profile.languageProfiles.find((l) => l.language === 'TypeScript')!
    expect(ts.state).toBe('known')
  })
})

describe('M.3 — renderProjectProfileMarkdown', () => {
  it('incluye estado explícito por hallazgo, nunca texto suelto sin estado', async () => {
    const root = tmpDir()
    writePkg(root, { dependencies: { express: '^4.0.0' } })
    const profile = await buildRoadmapProfile(root)
    const md = renderProjectProfileMarkdown(profile)
    expect(md).toContain('`detected`')
    expect(md).toContain('backend')
    expect(md).toContain(Bun.version)
  })
})
