import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function isolated(body: string) {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-project-settings-'))
  try {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
      import { expect } from 'bun:test'
      import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
      import { join } from 'node:path'
      import { Database } from 'bun:sqlite'
      import { runMigrations, applyMigrationSteps, FUTURE_MIGRATIONS } from './src/db/migrate.ts'
      import { db, DB_PATH } from './src/db/sqlite.ts'
      import { getProject, upsertProject, updateProjectSettings, deleteProject } from './src/db/projects.ts'
      import { ensureProject } from './src/projects/ensure.ts'
      import { git } from './src/run/sandbox.ts'
      import { handleApiProjects, handleApiProjectPatch, handleApiProjectBranches } from './src/dashboard/handlers/projects.ts'
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'project')
      mkdirSync(root)
      git(['init', '-b', 'main'], root)
      writeFileSync(join(root, 'README.md'), 'main')
      writeFileSync(join(root, '.gitignore'), '.orchestos/\\n')
      git(['add', '.'], root)
      expect(git(['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture'], root).exitCode).toBe(0)
      git(['branch', 'develop'], root)
      const project = await ensureProject(root)
      const patch = async (value, id = project.id) => handleApiProjectPatch(new Request('http://localhost/api/projects/' + id, { method: 'PATCH', body: JSON.stringify(value) }), new URL('http://localhost/api/projects/' + id))
      ${body}
      db.close()
    `,
      ],
      { env: { ...process.env, ORCHESTOS_HOME: home }, stdout: 'pipe', stderr: 'pipe' },
    )
    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(code, `${stdout}\\n${stderr}`).toBe(0)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('local project settings', () => {
  it('migrates existing registrations once, preserves their data and nullable defaults across reopening', async () => {
    await isolated(`
      const migration = FUTURE_MIGRATIONS.find((step) => step.version === 37)
      for (const column of ['display_name', 'icon', 'base_branch', 'setup_script']) db.exec('ALTER TABLE projects DROP COLUMN ' + column)
      db.exec('DELETE FROM schema_migrations WHERE version = 37')
      applyMigrationSteps()
      applyMigrationSteps()
      expect(getProject(root)).toMatchObject({ id: project.id, path: root, display_name: null, icon: null, base_branch: null, setup_script: null })
      expect(db.query('SELECT COUNT(*) AS n FROM schema_migrations WHERE version = 37').get().n).toBe(1)
      updateProjectSettings(project.id, { display_name: 'Local', icon: 'Rocket', base_branch: 'develop', setup_script: 'echo ok' })
      const reopened = new Database(DB_PATH)
      expect(reopened.query('SELECT display_name, icon, base_branch, setup_script FROM projects WHERE id = ?').get(project.id)).toEqual({ display_name: 'Local', icon: 'Rocket', base_branch: 'develop', setup_script: 'echo ok' })
      reopened.close()
      const empty = new Database(':memory:')
      expect(() => migration.precondition(empty)).toThrow('requires projects table')
      empty.exec('CREATE TABLE projects (id TEXT)')
      expect(() => migration.postcondition(empty)).toThrow('did not add')
      empty.close()
    `)
  })

  it('validates all settings atomically, preserves them on re-registration and clears empty values', async () => {
    await isolated(`
      updateProjectSettings(project.id, { display_name: '  Local name  ', icon: 'Rocket', base_branch: 'develop', setup_script: '  echo ok\\n' })
      upsertProject(root, JSON.parse(project.stack_profile), project.agents_md)
      expect(getProject(root)).toMatchObject({ display_name: 'Local name', icon: 'Rocket', base_branch: 'develop', setup_script: '  echo ok\\n' })
      for (const partial of [
        { display_name: 'x'.repeat(81) }, { icon: 'Invalid' }, { base_branch: 'missing' },
        { base_branch: '--help' }, { base_branch: 'HEAD' }, { base_branch: 'main~0' },
        { setup_script: 'x'.repeat(10001) }, { display_name: 42 },
      ]) expect(() => updateProjectSettings(project.id, { display_name: 'must not persist', ...partial })).toThrow()
      expect(getProject(root).display_name).toBe('Local name')
      updateProjectSettings(project.id, { display_name: ' '.repeat(81), icon: null, base_branch: '', setup_script: '\\n ' })
      expect(getProject(root)).toMatchObject({ display_name: null, icon: null, base_branch: null, setup_script: null })
      expect(updateProjectSettings('missing', {})).toBeNull()
    `)
  })

  it('PATCH and GET expose persisted values, local branches and validation errors', async () => {
    await isolated(`
      const response = await patch({ displayName: ' Renamed ', icon: 'Code', baseBranch: 'develop', setupScript: 'echo ok > .setup-ran' })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ displayName: 'Renamed', icon: 'Code', baseBranch: 'develop', setupScript: 'echo ok > .setup-ran' })
      expect(await handleApiProjects().json()).toContainEqual(expect.objectContaining({ id: project.id, displayName: 'Renamed', icon: 'Code', baseBranch: 'develop', setupScript: 'echo ok > .setup-ran' }))
      const branches = handleApiProjectBranches(new URL('http://localhost/api/projects/' + project.id + '/branches'))
      expect(await branches.json()).toEqual({ branches: ['develop', 'main'] })
      for (const body of [{ icon: 'No' }, { displayName: 'x'.repeat(81) }, { baseBranch: 'absent' }, { setupScript: 3 }, { other: 'oops' }, [], null]) {
        const bad = await patch(body)
        expect(bad.status).toBe(400)
        expect((await bad.json()).error).toBeTruthy()
      }
      expect((await patch({}, 'absent')).status).toBe(404)
      const invalid = await handleApiProjectPatch(new Request('http://localhost', { method: 'PATCH', body: '{' }), new URL('http://localhost/api/projects/' + project.id))
      expect(invalid.status).toBe(400)
      deleteProject(project.id)
      expect((await patch({})).status).toBe(404)
      expect(handleApiProjectBranches(new URL('http://localhost/api/projects/' + project.id + '/branches')).status).toBe(404)
    `)
  })

  it('resolves the configured base once and warns when it disappears', async () => {
    await isolated(`
      const { resolveSandboxMode } = await import('./src/run/sandbox-policy.ts')
      expect(resolveSandboxMode(root).branch).toBe('main')
      updateProjectSettings(project.id, { base_branch: 'develop' })
      expect(resolveSandboxMode(root).branch).toBe('develop')
      expect(resolveSandboxMode(root, 'cwd').mode).toBe('cwd')
      git(['branch', '-D', 'develop'], root)
      const fallback = resolveSandboxMode(root)
      expect(fallback.branch).toBe('main')
      expect(fallback.warnings.join(' ')).toContain('no longer exists')
    `)
  })

  it('the harness uses the configured base and setup, prioritizes an explicit branch and reports failure without leaking a worktree', async () => {
    await isolated(`
      const { runTask } = await import('./src/run/harness.ts')
      const { RunLogger } = await import('./src/run/logger.ts')
      const { DEFAULT_CONFIG } = await import('./src/config/schema.ts')
      git(['checkout', 'develop'], root)
      writeFileSync(join(root, 'develop-only.txt'), 'develop')
      git(['add', '.'], root)
      git(['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'develop file'], root)
      git(['checkout', 'main'], root)
      updateProjectSettings(project.id, { base_branch: 'develop', setup_script: 'test -f develop-only.txt && echo ok > .setup-ran && cp .setup-ran "$ORCHESTOS_PROJECT_ROOT/.orchestos/setup-proof"' })
      const options = {
        projectRoot: root, contextText: '', dryRun: true, modelOverride: 'mock/model',
        task: { id: 'project-settings', description: 'fixture', executor: 'openrouter', input: [], output: ['out.txt'], depends_on: [], status: 'pending', retry_count: 0 },
        orcheConfig: { ...DEFAULT_CONFIG, roles: { executor: { agent: 'api', provider: 'openrouter', model: 'mock/model' }, reviewer: { agent: 'api', provider: 'openrouter', model: 'mock/reviewer' } } },
        logger: new RunLogger(root, 'project-settings'),
      }
      mkdirSync(join(process.env.ORCHESTOS_HOME, '.orchestos/cache'), { recursive: true })
      writeFileSync(join(process.env.ORCHESTOS_HOME, '.orchestos/cache/models.json'), JSON.stringify({ schemaVersion: 2, fetchedAt: Date.now(), models: { 'mock/model': { contextLength: 200000, priceIn: 0, priceOut: 0, supportsReasoning: false, maxOutputTokens: 8192 } } }))
      process.env.OPENROUTER_API_KEY = ['sk', 'fixture', 'key'].join('-')
      globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '<<<FILE:out.txt>>>\\nproject settings integration\\n<<<ENDFILE>>>' } }], usage: { prompt_tokens: 5, completion_tokens: 3 }, model: 'mock/model' })
      git(['config', 'user.name', 'fixture'], root)
      git(['config', 'user.email', 'fixture@example.invalid'], root)
      const mainBefore = git(['rev-parse', 'HEAD'], root).stdout
      const first = await runTask({ ...options, dryRun: false, task: { ...options.task, engine: 'single-shot', checks: [{ cmd: 'test -f develop-only.txt' }, { cmd: 'test -f .setup-ran' }, { cmd: 'test -f out.txt' }] } })
      expect(first.status, first.retryReason).toBe('done')
      expect(git(['show', 'develop:out.txt'], root).stdout).toBe('project settings integration')
      expect(git(['rev-parse', 'HEAD'], root).stdout).toBe(mainBefore)
      expect(git(['branch', '--show-current'], root).stdout).toBe('main')
      expect(readFileSync(join(root, '.orchestos/setup-proof'), 'utf8')).toBe('ok\\n')
      expect(readdirSync(join(root, '.orchestos/worktrees'))).toEqual([])
      updateProjectSettings(project.id, { setup_script: 'test ! -f develop-only.txt && echo explicit > "$ORCHESTOS_PROJECT_ROOT/.orchestos/explicit-proof"' })
      const explicit = await runTask({ ...options, sandboxMode: 'worktree', sandboxBranch: 'main' })
      expect(explicit.status, explicit.retryReason).toBe('done')
      expect(readFileSync(join(root, '.orchestos/explicit-proof'), 'utf8')).toBe('explicit\\n')
      updateProjectSettings(project.id, { setup_script: 'echo SETUP-FAIL >&2; exit 3' })
      const failure = await runTask(options)
      expect(failure.status).toBe('failed')
      expect(failure.retryReason).toContain('exit 3')
      expect(failure.retryReason).toContain('SETUP-FAIL')
      expect(readdirSync(join(root, '.orchestos/worktrees'))).toEqual([])
      expect(git(['branch', '--list', 'orchestos/*'], root).stdout).toBe('')
      updateProjectSettings(project.id, { base_branch: null, setup_script: null })
      const unchanged = await runTask(options)
      expect(unchanged.status, unchanged.retryReason).toBe('done')
    `)
  }, 20_000)
})
