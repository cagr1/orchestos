// checkProvenance() runs `git` against process.cwd() and doesn't touch the shared sqlite
// singleton, so this file runs each scenario in a real temp git repo in a subprocess — an
// in-process chdir() would leak across every other test file sharing this bun test process.
import { expect, it } from 'bun:test'

async function runScenario(script: string): Promise<{ code: number; out: string; err: string }> {
  const child = Bun.spawn([process.execPath, '-e', script], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, out, err] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { code, out, err }
}

// Builds one temp git repo per scenario and stages the closing commit described by the
// caller, then calls checkProvenance() and reports whether it threw.
function scenarioScript(setup: string): string {
  return `
    const { execFileSync } = await import('node:child_process')
    const { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { checkProvenance } = await import('./scripts/plan-gate.ts')

    const root = mkdtempSync(join(tmpdir(), 'orchestos-plan-gate-'))
    const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' }
    const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'pipe', env: gitEnv })
    const write = (path, content) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), content, 'utf8') }

    git(['init'])
    git(['-c', 'init.defaultBranch=master', 'checkout', '-b', 'master'])

    // Base commit: item F.1 open, its own spec still present.
    write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [ ] **F.1 — ⚡ Item fixture.**\\n  F.1 body.\\n')
    write('docs/specs/F.1.md', '# F.1 spec\\n')
    git(['add', '-A'])
    git(['commit', '-m', 'base'])

    ${setup}

    process.chdir(root)
    let threw = null
    try {
      checkProvenance()
    } catch (error) {
      threw = error instanceof Error ? error.message : String(error)
    }
    console.log(JSON.stringify({ threw }))
  `
}

it('accepts a close whose evidence lives in docs/done/ with a fresh Ejecutado por line', async () => {
  const { code, out, err } = await runScenario(
    scenarioScript(`
      write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\\n')
      write('docs/done/bloque-F.md', '<a id="bloque-f-f-1"></a>\\n### F.1\\nEjecutado por: gpt-5.6-terra · Spec: docs/specs/F.1.md\\n')
      git(['add', '-A'])
      git(['rm', '--cached', 'docs/specs/F.1.md'])
      unlinkSync(join(root, 'docs/specs/F.1.md'))
    `),
  )
  expect(code, err).toBe(0)
  expect(JSON.parse(out).threw).toBeNull()
})

it('rejects evidence that is not staged as a blob', async () => {
  const { out } = await runScenario(
    scenarioScript(`
      write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\\n')
      // docs/done/bloque-F.md written to disk but never staged.
      write('docs/done/bloque-F.md', '<a id="bloque-f-f-1"></a>\\nEjecutado por: gpt-5.6-terra · Spec: docs/specs/F.1.md\\n')
      git(['add', 'PLAN.md'])
      git(['rm', '--cached', 'docs/specs/F.1.md'])
      unlinkSync(join(root, 'docs/specs/F.1.md'))
    `),
  )
  expect(JSON.parse(out).threw).toMatch(/is not a regular blob/)
})

it('rejects a missing anchor in the evidence file', async () => {
  const { out } = await runScenario(
    scenarioScript(`
      write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\\n')
      write('docs/done/bloque-F.md', 'Ejecutado por: gpt-5.6-terra · Spec: docs/specs/F.1.md\\n')
      git(['add', '-A'])
      git(['rm', '--cached', 'docs/specs/F.1.md'])
      unlinkSync(join(root, 'docs/specs/F.1.md'))
    `),
  )
  expect(JSON.parse(out).threw).toMatch(/anchor is absent/)
})

it('rejects a duplicated anchor in the evidence file', async () => {
  const { out } = await runScenario(
    scenarioScript(`
      write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\\n')
      write('docs/done/bloque-F.md', '<a id="bloque-f-f-1"></a>\\nEjecutado por: gpt-5.6-terra · Spec: docs/specs/F.1.md\\n<a id="bloque-f-f-1"></a>\\nOther section\\n')
      git(['add', '-A'])
      git(['rm', '--cached', 'docs/specs/F.1.md'])
      unlinkSync(join(root, 'docs/specs/F.1.md'))
    `),
  )
  expect(JSON.parse(out).threw).toMatch(/anchor is duplicated/)
})

it('rejects an evidence link outside docs/done/', async () => {
  for (const href of [
    'docs/other/bloque-F.md#bloque-f-f-1',
    '/etc/passwd#bloque-f-f-1',
    'docs/done/../../etc/passwd#bloque-f-f-1',
    'https://evil.example/x#bloque-f-f-1',
  ]) {
    const { out } = await runScenario(
      scenarioScript(`
        write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.** → [evidencia](${href})\\n')
        git(['add', '-A'])
        git(['rm', '--cached', 'docs/specs/F.1.md'])
        unlinkSync(join(root, 'docs/specs/F.1.md'))
      `),
    )
    expect(JSON.parse(out).threw, href).toMatch(/must stay under docs\/done\//)
  }
})

it('rejects evidence whose section belongs to a different item', async () => {
  const { out } = await runScenario(
    scenarioScript(`
      write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\\n')
      write('docs/done/bloque-F.md', '<a id="bloque-f-f-1"></a>\\nEjecutado por: gpt-5.6-terra · Spec: docs/specs/OTHER.md\\n')
      git(['add', '-A'])
      git(['rm', '--cached', 'docs/specs/F.1.md'])
      unlinkSync(join(root, 'docs/specs/F.1.md'))
    `),
  )
  expect(JSON.parse(out).threw).toMatch(/must declare its executor and exact spec/)
})

it('rejects a symlinked evidence path', async () => {
  const { out } = await runScenario(
    scenarioScript(`
      write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\\n')
      git(['add', 'PLAN.md'])
      git(['rm', '--cached', 'docs/specs/F.1.md'])
      unlinkSync(join(root, 'docs/specs/F.1.md'))
      const blobSha = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: 'docs/elsewhere.md', encoding: 'utf8' }).trim()
      git(['update-index', '--add', '--cacheinfo', '120000,' + blobSha + ',docs/done/bloque-F.md'])
    `),
  )
  expect(JSON.parse(out).threw).toMatch(/is not a regular blob/)
})

it('rejects an Ejecutado por line that already existed at HEAD instead of being added by this commit', async () => {
  const { out } = await runScenario(
    scenarioScript(`
      // The evidence file already carried the full section before this close — nothing new
      // was added by the staged commit, so the declaration cannot be trusted as this cierre's.
      write('docs/done/bloque-F.md', '<a id="bloque-f-f-1"></a>\\nEjecutado por: gpt-5.6-terra · Spec: docs/specs/F.1.md\\n')
      git(['add', '-A'])
      git(['commit', '-m', 'pre-existing evidence'])
      write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.** → [evidencia](docs/done/bloque-F.md#bloque-f-f-1)\\n')
      git(['add', 'PLAN.md'])
      git(['rm', '--cached', 'docs/specs/F.1.md'])
      unlinkSync(join(root, 'docs/specs/F.1.md'))
    `),
  )
  expect(JSON.parse(out).threw).toMatch(/must be added in this evidence section/)
})

it('keeps accepting the historical inline Ejecutado por format with no evidenceHref', async () => {
  const { out } = await runScenario(
    scenarioScript(`
      write('PLAN.md', '## Sprint fixture\\n### Block fixture\\n- [x] **F.1 — ⚡ Item fixture.**\\n  Ejecutado por: gpt-5.6-terra · Spec: docs/specs/F.1.md\\n')
      git(['add', 'PLAN.md'])
      git(['rm', '--cached', 'docs/specs/F.1.md'])
      unlinkSync(join(root, 'docs/specs/F.1.md'))
    `),
  )
  expect(JSON.parse(out).threw).toBeNull()
})
