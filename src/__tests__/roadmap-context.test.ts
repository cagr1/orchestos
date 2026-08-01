import { describe, expect, it, afterEach } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadRoadmapContext } from '../roadmaps/context.ts'
import type { ToolchainProbe } from '../detect/roadmap-profile.ts'

/**
 * Toolchain simulado. Sin esto el resultado depende de qué binarios tenga la máquina
 * que corre la suite: el Mac de desarrollo no tiene cargo y ubuntu-latest sí trae Rust
 * preinstalado, así que el mismo test daba verde en local y rojo en CI. Los tests
 * afirman sobre el código, nunca sobre el PATH del host.
 */
const noToolchain: ToolchainProbe = () => null
const withCargo: ToolchainProbe = (name) => (name === 'cargo' ? 'cargo 1.90.0' : null)

const dirs: string[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-roadmap-context-'))
  dirs.push(root)
  mkdirSync(join(root, 'docs', 'roadmaps', 'disciplines'), { recursive: true })
  mkdirSync(join(root, 'docs', 'roadmaps', 'languages'), { recursive: true })
  return root
}
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

function packageJson(root: string): void {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { test: 'bun test' } }))
}

describe('M.4 roadmap context selection', () => {
  it('selects detected disciplines and known language docs alongside the profile', async () => {
    const root = fixture()
    packageJson(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'server.ts'), 'Bun.serve({ fetch: () => new Response("ok") })')
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1')
    writeFileSync(join(root, 'docs', 'roadmaps', 'project-profile.md'), '# profile')
    writeFileSync(join(root, 'docs', 'roadmaps', 'disciplines', 'backend.md'), '# backend guidance')
    writeFileSync(join(root, 'docs', 'roadmaps', 'languages', 'typescript-bun.md'), '# typescript guidance')
    const context = await loadRoadmapContext(root, [], { probe: noToolchain })
    expect(context.selected).toContain('Disciplina: backend')
    expect(context.selected).toContain('Lenguaje: TypeScript')
    expect(context.markdown).toContain('# profile')
    expect(context.markdown).toContain('# backend guidance')
    expect(context.markdown).toContain('# typescript guidance')
  })

  it('project override wins over heuristic default', async () => {
    const root = fixture()
    packageJson(root)
    writeFileSync(join(root, 'docs', 'roadmaps', 'disciplines', 'architecture.md'), '# architecture guidance')
    writeFileSync(join(root, 'docs', 'roadmaps', 'disciplines', 'backend.md'), '# backend guidance')
    writeFileSync(join(root, 'docs', 'roadmaps', 'project-overrides.yaml'), `roadmap_overrides:\n  disciplines:\n    include: [architecture]\n    exclude: [backend]\n`)
    const context = await loadRoadmapContext(root, [], { probe: noToolchain })
    expect(context.selected).toContain('Disciplina: architecture')
    expect(context.selected).not.toContain('Disciplina: backend')
    expect(context.markdown).toContain('# architecture guidance')
    expect(context.markdown).not.toContain('# backend guidance')
  })

  it('missing roadmap/tooling is visible and never represented as pass', async () => {
    // C# no tiene guía ni local ni centralizada (a diferencia de Rust, que desde
    // 2026-07-30 resuelve por fallback a docs/roadmaps/languages/ de OrchestOS aunque
    // el proyecto no tenga su propia copia) — sigue probando el mismo principio: un
    // estado missing real nunca se representa como pass.
    const root = fixture()
    packageJson(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'main.cs'), 'class Program { static void Main() {} }')
    const context = await loadRoadmapContext(root, [], { probe: noToolchain })
    expect(context.profile.languageProfiles.find(l => l.language === 'C#')?.state).toBe('missing')
    expect(context.markdown).toContain('missing/blocked')
    expect(context.markdown).not.toContain(': pass')
    expect(context.missing).toContain('lenguaje C#')
  })

  it('toolchain ausente sigue bloqueando aunque el lenguaje resuelva por fallback centralizado', async () => {
    const root = fixture()
    packageJson(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'main.rs'), 'fn main() {}')
    const context = await loadRoadmapContext(root, ['src/main.rs'], { probe: noToolchain })
    expect(context.profile.languageProfiles.find(l => l.language === 'Rust')?.state).toBe('known')
    expect(context.missing).toContain('toolchain Rust')
    expect(context.blockReason).toContain('cargo no está disponible')
  })

  it('con cargo presente el mismo proyecto Rust no queda bloqueado', async () => {
    const root = fixture()
    packageJson(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'main.rs'), 'fn main() {}')
    const context = await loadRoadmapContext(root, ['src/main.rs'], { probe: withCargo })
    expect(context.missing).not.toContain('toolchain Rust')
    expect(context.blockReason ?? '').not.toContain('cargo no está disponible')
  })

  it('polygot fixture selects each available language profile', async () => {
    const root = fixture()
    packageJson(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'a.go'), 'package main')
    writeFileSync(join(root, 'src', 'a.rs'), 'fn main() {}')
    writeFileSync(join(root, 'docs', 'roadmaps', 'languages', 'go.md'), '# go guidance')
    writeFileSync(join(root, 'docs', 'roadmaps', 'languages', 'rust.md'), '# rust guidance')
    const context = await loadRoadmapContext(root, [], { probe: noToolchain })
    expect(context.selected).toContain('Lenguaje: Go')
    expect(context.selected).toContain('Lenguaje: Rust')
  })
})
