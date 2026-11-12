import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse, stringify } from 'yaml'

const source = resolve(import.meta.dir, '..')
const moduleUrl = (path: string) => JSON.stringify(join(source, path))

describe('AUD.21 + AUD.5 task execution with isolated fake CLIs', () => {
  let dir: string
  let root: string
  let home: string
  let bin: string
  let env: Record<string, string | undefined>

  function git(...args: string[]) {
    const result = Bun.spawnSync(['git', ...args], { cwd: root, env })
    expect(result.exitCode).toBe(0)
    return result.stdout.toString()
  }

  async function spawn(args: string[]) {
    const proc = Bun.spawn([process.execPath, ...args], {
      cwd: root,
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { stdout, stderr, code }
  }

  async function evaluate(code: string) {
    const result = await spawn(['--eval', code])
    expect(result.stderr).not.toContain('error:')
    expect(result.code).toBe(0)
    return result.stdout
  }

  async function query(sql: string) {
    const out = await evaluate(`
      import { db } from ${moduleUrl('db/sqlite.ts')};
      console.log('AUD_RESULT=' + JSON.stringify(db.query(${JSON.stringify(sql)}).all()));
    `)
    return JSON.parse(out.split('AUD_RESULT=')[1]!)
  }

  function task(id = 'fixture-task', status = 'pending') {
    return {
      id,
      description: 'Write a plain fixture note',
      executor: 'anthropic',
      executor_model: 'fixture-executor',
      engine: 'external',
      input: [],
      output: ['out.txt'],
      depends_on: [] as string[],
      status,
      retry_count: 0,
    }
  }

  function tasks(rows = [task()]) {
    writeFileSync(
      join(root, 'tasks.yaml'),
      stringify({ version: 1, project: 'fixture', tasks: rows }),
    )
  }

  function loadTasks() {
    return parse(readFileSync(join(root, 'tasks.yaml'), 'utf8')).tasks
  }

  function fakeClaude(body: string) {
    writeFileSync(join(bin, 'claude'), `#!/bin/sh\ncat >/dev/null\n${body}\n`)
    chmodSync(join(bin, 'claude'), 0o755)
  }

  function failingClaude() {
    fakeClaude(
      `echo '{"type":"result","is_error":true,"result":"fixture API failure","total_cost_usd":0.01}'`,
    )
  }

  const cli = (...args: string[]) => spawn([join(source, 'cli.ts'), ...args])

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'aud21-task-'))
    root = join(dir, 'project')
    home = join(dir, 'home')
    bin = join(dir, 'bin')
    for (const path of [root, home, bin]) mkdirSync(path)
    env = {
      ...process.env,
      HOME: home,
      ORCHESTOS_HOME: home,
      ORCHESTOS_PROJECT_ID: undefined,
      ORCHESTOS_CLI_SEARCH_PATH: '1',
      PATH: `${bin}:${process.env.PATH}`,
      ORCHESTOS_CLAUDE_USAGE_LIVE: '0',
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    }
    const config = {
      config_version: 1,
      roles: {
        executor: { agent: 'claude', model: 'fixture-executor' },
        reviewer: { agent: 'claude', model: 'fixture-reviewer' },
        auxiliary: { agent: 'claude', model: 'fixture-auxiliary' },
      },
    }
    mkdirSync(join(home, '.orchestos'), { recursive: true })
    writeFileSync(join(home, '.orchestos', 'config.yaml'), stringify(config))
    writeFileSync(join(root, 'orchestos.config.yaml'), stringify(config))
    writeFileSync(join(root, 'AGENTS.md'), 'Plain text fixture project.\n')
    writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
    mkdirSync(join(home, '.orchestos', 'cache'), { recursive: true })
    writeFileSync(
      join(home, '.orchestos', 'cache', 'models.json'),
      JSON.stringify({
        schemaVersion: 2,
        fetchedAt: Date.now(),
        models: {
          'fixture-executor': { contextLength: 200000, maxOutputTokens: 8192 },
        },
      }),
    )
    tasks()
    git('init')
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'fixture')
    await evaluate(`import { runMigrations } from ${moduleUrl('db/migrate.ts')}; runMigrations();`)
    writeFileSync(join(bin, 'bunx'), '#!/bin/sh\nexit 1\n')
    chmodSync(join(bin, 'bunx'), 0o755)
    failingClaude()
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('dryRun creates neither a worktree nor the setup marker, even on a dirty repo', async () => {
    writeFileSync(join(root, 'uncommitted.txt'), 'dirty fixture')
    await evaluate(`
      import { upsertProject, getProject, updateProjectSettings } from ${moduleUrl('db/projects.ts')};
      import { runTask } from ${moduleUrl('run/harness.ts')};
      import { RunLogger } from ${moduleUrl('run/logger.ts')};
      upsertProject(process.cwd(), {}, 'fixture');
      updateProjectSettings(getProject(process.cwd()).id, { setup_script: ${JSON.stringify('touch ' + join(dir, 'setup-marker'))} });
      const result = await runTask({ projectRoot: process.cwd(), contextText: '',
        task: ${JSON.stringify(task())}, logger: new RunLogger(process.cwd(), 'fixture-task'), dryRun: true });
      console.log('AUD_RESULT=' + JSON.stringify(result));
    `).then((out) => expect(JSON.parse(out.split('AUD_RESULT=')[1]!).status).toBe('done'))
    expect(existsSync(join(dir, 'setup-marker'))).toBe(false)
    expect(existsSync(join(root, '.orchestos', 'worktrees'))).toBe(false)
    expect(git('worktree', 'list', '--porcelain').match(/^worktree /gm)).toHaveLength(1)
  })

  it('Claude is_error with a cost fails the task and persists the API message', async () => {
    const result = await cli('task', 'run', '--id', 'fixture-task')
    expect(result.code).toBe(1)
    expect(loadTasks()[0].status).not.toBe('done')
    const runs = await query("SELECT status, result FROM runs WHERE task_id='fixture-task'")
    expect(runs).toHaveLength(1)
    expect(runs[0].status).toBe('failed')
    expect(runs[0].result).toContain('fixture API failure')
  })

  it('task run --id returns 1 for an unknown id', async () => {
    const result = await cli('task', 'run', '--id', 'missing-task')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Task "missing-task" not found')
  })

  it('three ordinary failures increment retry_count and end in failed_permanent', async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await cli('task', 'run', '--id', 'fixture-task')
      expect(result.code).toBe(1)
      const rows = loadTasks()
      expect(rows[0].retry_count).toBe(attempt)
      expect(rows[0].status).toBe(attempt === 3 ? 'failed_permanent' : 'failed')
      if (attempt < 3) {
        rows[0].status = 'pending'
        tasks(rows)
        git('add', 'tasks.yaml')
        git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'requeue')
      }
    }
  }, 15000)

  it('--all lists unfinished states instead of claiming all tasks are done', async () => {
    tasks([
      task('a', 'done'),
      task('b', 'blocked'),
      task('c', 'failed'),
      task('d', 'failed_permanent'),
    ])
    const result = await cli('task', 'run', '--all')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('b (blocked), c (failed), d (failed_permanent)')
    expect(result.stdout).not.toContain('All tasks done ✓')
  })

  it('--all reports success when every task is done', async () => {
    tasks([task('a', 'done')])
    const result = await cli('task', 'run', '--all')
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('All tasks done ✓')
  })

  it('--all reports pending tasks whose dependencies are unresolved', async () => {
    tasks([{ ...task(), depends_on: ['missing-task'] }])
    const result = await cli('task', 'run', '--all')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('No executable tasks — blocked: fixture-task')
  })

  it('--all stops after an ordinary failure', async () => {
    const result = await cli('task', 'run', '--all')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Stopping — task failed')
    expect(loadTasks()[0].retry_count).toBe(1)
  })

  it('--all reports the iteration cap and the remaining pending task', async () => {
    tasks(Array.from({ length: 21 }, (_, i) => task(`note-${i}`)))
    git('add', 'tasks.yaml')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'many tasks')
    fakeClaude(
      `echo fixture >> out.txt\necho '{"type":"result","result":"written","total_cost_usd":0.01}'`,
    )
    const result = await cli('task', 'run', '--all')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Iteration limit reached (20) — pending: note-20')
    expect(loadTasks().filter((t: { status: string }) => t.status === 'done')).toHaveLength(20)
  }, 90000)

  it('--all stops on blocked without incrementing retries or invoking diagnosis', async () => {
    writeFileSync(join(root, 'Cargo.toml'), '[package]\nname = "fixture"\nversion = "0.1.0"\n')
    writeFileSync(join(root, 'main.rs'), 'fn main() {}\n')
    const rows = [task()]
    rows[0]!.output = ['out.rs']
    tasks(rows)
    writeFileSync(join(bin, 'cargo'), '#!/bin/sh\nexit 1\n')
    chmodSync(join(bin, 'cargo'), 0o755)
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'fixture Rust without cargo')
    const result = await cli('task', 'run', '--all')
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('Stopping — task blocked')
    expect(loadTasks()[0]).toMatchObject({ status: 'blocked', retry_count: 0 })
    expect(result.stderr).not.toContain('[diagnose]')
  })

  it('done does not invoke Auxiliary even with three prior runs', async () => {
    await evaluate(`
      import { db } from ${moduleUrl('db/sqlite.ts')};
      for (let i=0;i<3;i++) db.run("INSERT INTO runs (id,prompt,task_class,model,provider,status,created_at) VALUES (?, 'fixture','implement','fixture','claude','done',datetime('now'))", ['seed-'+i]);
    `)
    const marker = join(dir, 'auxiliary-marker')
    fakeClaude(
      `case "$*" in\n  *fixture-auxiliary*) touch '${marker}'; echo '{"type":"result","result":"[]","total_cost_usd":0.01}';;\n  *) echo fixture > out.txt; echo '{"type":"result","result":"written","total_cost_usd":0.01}';;\nesac`,
    )
    const result = await cli('task', 'run', '--id', 'fixture-task')
    expect(result.code).toBe(0)
    expect(loadTasks()[0].status).toBe('done')
    expect(existsSync(marker)).toBe(false)
  })

  it('runs --analyze reads only this project and unregistered projects read only unscoped runs', async () => {
    await evaluate(`
      import { upsertProject, getProject } from ${moduleUrl('db/projects.ts')};
      import { db } from ${moduleUrl('db/sqlite.ts')};
      upsertProject(process.cwd(), {}, 'fixture');
      upsertProject(process.cwd() + '/other', {}, 'other');
      const own = getProject(process.cwd()).id, other = getProject(process.cwd() + '/other').id;
      for (const [id, pid] of [['own',own],['foreign-1',other],['foreign-2',other],['foreign-3',other],['unscoped',null]]) {
        db.run("INSERT INTO runs (id,project_id,prompt,task_class,model,provider,status,created_at) VALUES (?,?,'fixture','implement','fixture','claude','done',datetime('now'))", [id,pid]);
      }
    `)
    const result = await cli('runs', '--analyze')
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Not enough runs to analyze (need at least 3).')
    expect(result.stdout).not.toContain('Analyzing')
    await evaluate(
      `import { db } from ${moduleUrl('db/sqlite.ts')}; db.run("UPDATE projects SET removed_at=datetime('now') WHERE path=?", [process.cwd()]);`,
    )
    const unregistered = await cli('runs', '--analyze')
    expect(unregistered.code).toBe(0)
    expect(unregistered.stdout).toContain('Not enough runs to analyze (need at least 3).')
  })
})
