import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('git-init creates a commit, rejects committed repos and retries after identity errors', async () => {
  const home = mkdtempSync(join(tmpdir(), 'uso44-git-init-'))
  try {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
      import { expect } from 'bun:test'
      import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
      import { join } from 'node:path'
      import { runMigrations } from './src/db/migrate.ts'
      import { upsertProject, getProject } from './src/db/projects.ts'
      import { handleApiProjectGitInit } from './src/dashboard/handlers/projects.ts'
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'project')
      mkdirSync(root)
      writeFileSync(join(root, 'README.md'), 'hello')
      const secrets = ['.env', '.env.local', 'cert.pem', 'private.key', 'id_rsa', 'cert.p12', 'credentials-dev.json', '.npmrc', 'nested/.env']
      mkdirSync(join(root, 'nested'))
      for (const file of secrets) writeFileSync(join(root, file), 'fixture')
      upsertProject(root, {}, '')
      const project = getProject(root)
      const url = new URL('http://localhost/api/projects/' + project.id + '/git-init')
      expect(handleApiProjectGitInit(new URL('http://localhost/api/projects/missing/git-init')).status).toBe(404)
      const failed = handleApiProjectGitInit(url)
      expect(failed.status).toBe(422)
      expect((await failed.json()).error).toMatch(/identity|name|email/i)
      expect(existsSync(join(root, '.git'))).toBe(true)
      process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = 'fixture'
      process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL = 'fixture@example.invalid'
      const result = handleApiProjectGitInit(url)
      expect(result.status).toBe(200)
      const body = await result.json()
      expect(body).toMatchObject({ ok: true, commit: expect.stringMatching(/^[a-f0-9]+$/) })
      expect(body.excluded.sort()).toEqual(secrets.sort())
      const committed = Bun.spawnSync(['git', 'show', '--name-only', '--format=', 'HEAD'], { cwd: root, env: { ...process.env } })
      expect(committed.exitCode).toBe(0)
      expect(committed.stdout.toString().trim()).toBe('README.md')
      expect(handleApiProjectGitInit(url).status).toBe(409)
      const empty = join(process.env.ORCHESTOS_HOME, 'empty')
      mkdirSync(empty)
      upsertProject(empty, {}, '')
      const emptyProject = getProject(empty)
      expect(handleApiProjectGitInit(new URL('http://localhost/api/projects/' + emptyProject.id + '/git-init')).status).toBe(200)
    `,
      ],
      {
        env: {
          ...process.env,
          HOME: home,
          ORCHESTOS_HOME: home,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'user.useConfigOnly',
          GIT_CONFIG_VALUE_0: 'true',
          GIT_AUTHOR_NAME: '',
          GIT_AUTHOR_EMAIL: '',
          GIT_COMMITTER_NAME: '',
          GIT_COMMITTER_EMAIL: '',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(code, stdout + stderr).toBe(0)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('git-init rejects staged secret files without creating a commit', async () => {
  const home = mkdtempSync(join(tmpdir(), 'uso44-git-staged-secret-'))
  try {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
      import { expect } from 'bun:test'
      import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
      import { join } from 'node:path'
      import { runMigrations } from './src/db/migrate.ts'
      import { upsertProject, getProject } from './src/db/projects.ts'
      import { handleApiProjectGitInit } from './src/dashboard/handlers/projects.ts'
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'project')
      mkdirSync(root)
      writeFileSync(join(root, '.env'), 'SECRET=value')
      upsertProject(root, {}, '')
      const project = getProject(root)
      const env = { ...process.env, GIT_AUTHOR_NAME: 'fixture', GIT_COMMITTER_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' }
      const init = Bun.spawnSync(['git', 'init'], { cwd: root, env })
      expect(init.exitCode).toBe(0)
      const staged = Bun.spawnSync(['git', 'add', '.env'], { cwd: root, env })
      expect(staged.exitCode).toBe(0)
      const response = handleApiProjectGitInit(new URL('http://localhost/api/projects/' + project.id + '/git-init'))
      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ error: 'Staged files may contain secrets: .env. Unstage them (git rm --cached <file>) or make the first commit yourself.' })
      const head = Bun.spawnSync(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: root, env })
      expect(head.exitCode).not.toBe(0)
      expect(existsSync(join(root, '.env'))).toBe(true)
    `,
      ],
      {
        env: {
          ...process.env,
          HOME: home,
          ORCHESTOS_HOME: home,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'user.useConfigOnly',
          GIT_CONFIG_VALUE_0: 'true',
          GIT_AUTHOR_NAME: '',
          GIT_AUTHOR_EMAIL: '',
          GIT_COMMITTER_NAME: '',
          GIT_COMMITTER_EMAIL: '',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(code, stdout + stderr).toBe(0)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
