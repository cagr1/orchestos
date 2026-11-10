import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DEFAULT_CONFIG } from '../config/schema.ts'
import { updateProjectSettings } from '../db/projects.ts'
import { getRun } from '../db/runs.ts'
import { db } from '../db/sqlite.ts'
import { ensureProject } from '../projects/ensure.ts'
import { singleShotEngine } from '../run/executors/single-shot.ts'
import {
  listWorktreeChanges,
  readWorktreeDiff,
  worktreeForkPoint,
  worktreeSetupArtifacts,
} from '../run/executors/worktree-diff.ts'
import { runTask } from '../run/harness.ts'
import { RunLogger } from '../run/logger.ts'
import { createWorktree, git, mergeWorktreeBack, type Worktree } from '../run/sandbox.ts'

const roots: string[] = []
const runIds: string[] = []
const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
  for (const id of runIds.splice(0)) db.run('DELETE FROM runs WHERE id = ?', [id])
  for (const root of roots.splice(0)) {
    db.run('DELETE FROM projects WHERE path = ?', [root])
    rmSync(root, { recursive: true, force: true })
  }
})

function checkedGit(root: string, args: string[]): string {
  const result = git(args, root)
  expect(result.exitCode, result.stderr).toBe(0)
  return result.stdout
}

function write(root: string, path: string, content = 'new\n') {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-aud1-'))
  roots.push(root)
  checkedGit(root, ['init', '-b', 'main'])
  // Production commits inherit identity only from this disposable repository.
  checkedGit(root, ['config', 'user.name', 'fixture'])
  checkedGit(root, ['config', 'user.email', 'fixture@example.invalid'])
  write(root, '.gitignore', '.orchestos/\nruns/\nnode_modules/\n')
  write(root, 'out.txt', 'old\n')
  write(root, 'tracked.txt', 'keep\n')
  checkedGit(root, ['add', '.'])
  checkedGit(root, [
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'base',
  ])
  return root
}

function committedPaths(root: string): string[] {
  const result = Bun.spawnSync(['git', 'show', '--format=', '--name-only', '-z', 'HEAD'], {
    cwd: root,
  })
  expect(result.exitCode).toBe(0)
  return result.stdout.toString().split('\0').filter(Boolean)
}

async function throughHarness(
  root: string,
  mutate: (root: string) => void,
  output = ['out.txt'],
  lateWrite = false,
  setupScript?: string,
) {
  if (setupScript) {
    const project = await ensureProject(root)
    updateProjectSettings(project.id, { setup_script: setupScript })
  }
  process.env.OPENROUTER_API_KEY = ['sk-', 'test-or-key'].join('')
  let lateWrites = 0
  const engine = spyOn(singleShotEngine, 'run').mockImplementation(async (ctx) => {
    mutate(ctx.effectiveRoot)
    return {
      files: output
        .filter((path) => existsSync(join(ctx.effectiveRoot, path)))
        .map((path) => ({ path, content: readFileSync(join(ctx.effectiveRoot, path), 'utf8') })),
      inputTokens: 1,
      outputTokens: 1,
      usd: 0,
      iterations: 1,
      costByIteration: [],
      log: [],
    }
  })
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    if (lateWrite && init?.body && JSON.parse(String(init.body)).model === 'mock/reviewer') {
      const worktrees = checkedGit(root, ['worktree', 'list', '--porcelain'])
      const path = worktrees
        .split('\n')
        .filter((line) => line.startsWith('worktree '))
        .at(-1)
        ?.slice(9)
      expect(path).toBeTruthy()
      write(path!, 'late.txt')
      lateWrites++
    }
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                verdict: 'pass',
                reason: 'ok',
                criteria: [
                  {
                    text: 'out.txt contains new',
                    pass: true,
                    evidence: { file: 'out.txt', excerpt: 'new' },
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        model: 'mock/reviewer',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as unknown as typeof fetch
  const logger = new RunLogger(root, 'aud1-contract')
  const violation = spyOn(logger, 'contractViolation')
  try {
    const result = await runTask({
      readProfile: () => ({ codes: true }),
      projectRoot: root,
      contextText: '',
      logger,
      task: {
        id: 'aud1-contract',
        description: 'worktree contract',
        executor: 'openrouter',
        engine: 'single-shot',
        input: [],
        output,
        depends_on: [],
        status: 'pending',
        retry_count: 0,
        checks: [],
        acceptance_criteria: lateWrite ? ['out.txt contains new'] : undefined,
      },
      modelOverride: 'anthropic/claude-haiku-4-5',
      sandboxMode: 'worktree',
      sandboxBranch: 'main',
      orcheConfig: {
        ...DEFAULT_CONFIG,
        roles: {
          executor: { agent: 'api', provider: 'openrouter', model: 'anthropic/claude-haiku-4-5' },
          reviewer: { agent: 'api', provider: 'openrouter', model: 'mock/reviewer' },
        },
      },
    })
    if (result.runId) runIds.push(result.runId)
    if (lateWrite) expect(lateWrites).toBe(1)
    return { result, logged: violation.mock.calls.map(([paths]) => paths) }
  } finally {
    engine.mockRestore()
    violation.mockRestore()
  }
}

describe('AUD.1 worktree contract and merge paths', () => {
  it('filters persisted setup artifacts from CLI diffs unless declared as outputs', () => {
    const root = fixture()
    expect(worktreeSetupArtifacts(root)).toEqual([])
    const wt = createWorktree(
      'setup-diff',
      'main',
      root,
      'printf "setup\\n" > .setup-ran; printf "space\\n" > "setup space.txt"',
    )
    try {
      expect(worktreeSetupArtifacts(wt.path).sort()).toEqual(['.setup-ran', 'setup space.txt'])
      write(wt.path, 'out.txt')
      expect(readWorktreeDiff(wt.path, ['out.txt'])).toEqual([
        { path: 'out.txt', content: 'new\n' },
      ])
      expect(readWorktreeDiff(wt.path, ['out.txt', '.setup-ran'])).toEqual(
        expect.arrayContaining([
          { path: 'out.txt', content: 'new\n' },
          { path: '.setup-ran', content: 'setup\n' },
        ]),
      )
      expect(readWorktreeDiff(wt.path, ['out.txt', '.setup-ran'])).toHaveLength(2)
    } finally {
      wt.cleanup()
    }
    expect(
      git(['config', '--get-all', `branch.${wt.branch}.orchestosSetupArtifact`], root).exitCode,
    ).not.toBe(0)
  })

  it('records the fork SHA and removes its config during cleanup', () => {
    const root = fixture()
    const base = checkedGit(root, ['rev-parse', 'main'])
    const wt = createWorktree('fork', 'main', root)
    expect(wt.setupArtifacts).toEqual([])
    expect(worktreeForkPoint(wt.path)).toBe(base)
    wt.cleanup()
    expect(
      git(['config', '--get', `branch.${wt.branch}.orchestosForkPoint`], root).exitCode,
    ).not.toBe(0)
    expect(worktreeForkPoint(root)).toBeNull()
  })

  it('blocks an undeclared tracked deletion and records its path without changing base', async () => {
    const root = fixture()
    const base = checkedGit(root, ['rev-parse', 'HEAD'])
    const { result, logged } = await throughHarness(root, (path) => {
      write(path, 'out.txt')
      unlinkSync(join(path, 'tracked.txt'))
    })
    expect(result.status).toBe('failed')
    expect(result.retryReason).toContain('deleted: tracked.txt')
    expect(result.filesBlocked).toContain('tracked.txt')
    expect(JSON.parse(getRun(result.runId)!.files_blocked!)).toContain('tracked.txt')
    expect(logged).toEqual([['tracked.txt']])
    expect(checkedGit(root, ['rev-parse', 'HEAD'])).toBe(base)
    expect(readFileSync(join(root, 'tracked.txt'), 'utf8')).toBe('keep\n')
    expect(checkedGit(root, ['branch', '--list', 'orchestos/*'])).toBe('')
  })

  it('allows uncommitted tooling noise but merges only the declared output', async () => {
    const root = fixture()
    const { result } = await throughHarness(root, (path) => {
      write(path, 'out.txt')
      write(path, '.claude/hooks/x.sh')
    })
    expect(result.status).toBe('done')
    expect(committedPaths(root)).toEqual(['out.txt'])
    expect(existsSync(join(root, '.claude/hooks/x.sh'))).toBe(false)
  })

  it('blocks an undeclared path containing spaces', async () => {
    const root = fixture()
    const { result } = await throughHarness(root, (path) => {
      write(path, 'out.txt')
      write(path, 'con espacio.txt')
    })
    expect(result.status).toBe('failed')
    expect(result.filesBlocked).toContain('con espacio.txt')
    expect(existsSync(join(root, 'con espacio.txt'))).toBe(false)
  })

  it('allows setup artifacts without merging them into the base', async () => {
    const root = fixture()
    const { result, logged } = await throughHarness(
      root,
      (path) => {
        expect(readFileSync(join(path, '.setup-ran'), 'utf8')).toBe('setup\n')
        write(path, 'out.txt')
      },
      ['out.txt'],
      false,
      'printf "setup\\n" > .setup-ran',
    )
    expect(result.status).toBe('done')
    expect(logged).toEqual([])
    expect(committedPaths(root)).toEqual(['out.txt'])
    expect(existsSync(join(root, '.setup-ran'))).toBe(false)
  })

  it('blocks a setup artifact committed by the executor', async () => {
    const root = fixture()
    const base = checkedGit(root, ['rev-parse', 'HEAD'])
    const { result } = await throughHarness(
      root,
      (path) => {
        write(path, 'out.txt')
        checkedGit(path, ['add', 'out.txt', '.setup-ran'])
        checkedGit(path, ['commit', '-m', 'executor commits setup artifact'])
      },
      ['out.txt'],
      false,
      'printf "setup\\n" > .setup-ran',
    )
    expect(result.status).toBe('failed')
    expect(result.filesBlocked).toContain('.setup-ran')
    expect(checkedGit(root, ['rev-parse', 'HEAD'])).toBe(base)
  })

  it('reads and merges declared paths containing spaces and non-ASCII characters', async () => {
    const root = fixture()
    const outputs = ['con espacio.txt', 'canción.txt']
    const { result } = await throughHarness(
      root,
      (path) => {
        for (const output of outputs) write(path, output)
        expect(
          readWorktreeDiff(path, outputs)
            .map((file) => file.path)
            .sort(),
        ).toEqual([...outputs].sort())
      },
      outputs,
    )
    expect(result.status).toBe('done')
    expect(committedPaths(root).sort()).toEqual([...outputs].sort())
  })

  it('does not merge an undeclared file written by QA after the early gate', async () => {
    const root = fixture()
    const { result } = await throughHarness(
      root,
      (path) => write(path, 'out.txt'),
      ['out.txt'],
      true,
    )
    expect(result.status).toBe('done')
    expect(committedPaths(root)).toEqual(['out.txt'])
    expect(existsSync(join(root, 'late.txt'))).toBe(false)
  })

  it('stages a literal wildcard output without matching an undeclared late file', () => {
    const root = fixture()
    const wt = createWorktree('literal-output', 'main', root)
    try {
      write(wt.path, 'out*.txt')
      // Simulate a file written by a check after the early contract gate.
      write(wt.path, 'outside.txt')
      expect(mergeWorktreeBack(wt, 'commit', undefined, ['out*.txt'])).toBeTruthy()
      expect(committedPaths(root)).toEqual(['out*.txt'])
      expect(readFileSync(join(root, 'out*.txt'), 'utf8')).toBe('new\n')
      expect(existsSync(join(root, 'outside.txt'))).toBe(false)
    } finally {
      if (existsSync(wt.path)) wt.cleanup()
    }
  })

  it('cleans excluded tracked changes before rebasing onto an advanced base', () => {
    const root = fixture()
    write(root, '.claude/settings.json', '{}\n')
    checkedGit(root, ['add', '.claude/settings.json'])
    checkedGit(root, ['commit', '-m', 'tracked tooling'])
    mkdirSync(join(root, 'node_modules'))
    const wt = createWorktree('excluded-rebase', 'main', root)
    try {
      write(wt.path, '.claude/settings.json', '{"changed":true}\n')
      write(wt.path, 'out.txt')
      write(wt.path, 'late.txt')
      write(root, 'base-advance.txt')
      checkedGit(root, ['add', 'base-advance.txt'])
      checkedGit(root, ['commit', '-m', 'advance base'])
      const base = checkedGit(root, ['rev-parse', 'HEAD'])
      expect(mergeWorktreeBack(wt, 'commit', undefined, ['out.txt'])).toBeTruthy()
      expect(checkedGit(root, ['rev-parse', 'HEAD^'])).toBe(base)
      expect(committedPaths(root)).toEqual(['out.txt'])
      expect(readFileSync(join(root, 'out.txt'), 'utf8')).toBe('new\n')
      expect(readFileSync(join(root, '.claude/settings.json'), 'utf8')).toBe('{}\n')
      expect(existsSync(join(root, 'base-advance.txt'))).toBe(true)
      expect(existsSync(join(root, 'late.txt'))).toBe(false)
      expect(existsSync(join(root, 'node_modules'))).toBe(true)
    } finally {
      if (existsSync(wt.path)) wt.cleanup()
    }
  })

  it('unstages an undeclared file before committing declared outputs', () => {
    const root = fixture()
    const wt = createWorktree('staged', 'main', root)
    try {
      write(wt.path, 'out.txt')
      write(wt.path, 'undeclared.txt')
      checkedGit(wt.path, ['add', 'undeclared.txt'])
      expect(mergeWorktreeBack(wt, 'commit', undefined, ['out.txt'])).toBeTruthy()
      expect(committedPaths(root)).toEqual(['out.txt'])
      expect(existsSync(join(root, 'undeclared.txt'))).toBe(false)
    } finally {
      if (existsSync(wt.path)) wt.cleanup()
    }
  })

  for (const undeclared of ['undeclared.txt', '.claude/hooks/x.sh']) {
    it(`blocks committed ${undeclared} at both the harness gate and direct merge`, async () => {
      const root = fixture()
      const base = checkedGit(root, ['rev-parse', 'HEAD'])
      const commit = (path: string) => {
        write(path, 'out.txt')
        write(path, undeclared)
        checkedGit(path, ['add', 'out.txt', undeclared])
        checkedGit(path, ['commit', '-m', 'executor commit'])
      }
      const { result } = await throughHarness(root, commit)
      expect(result.status).toBe('failed')
      expect(result.filesBlocked).toContain(undeclared)
      expect(JSON.parse(getRun(result.runId)!.files_blocked!)).toContain(undeclared)
      expect(checkedGit(root, ['rev-parse', 'HEAD'])).toBe(base)
      const wt = createWorktree('committed', 'main', root)
      try {
        commit(wt.path)
        expect(readWorktreeDiff(wt.path, ['out.txt']).map((file) => file.path)).toContain('out.txt')
        expect(() => mergeWorktreeBack(wt, 'commit', undefined, ['out.txt'])).toThrow(
          'committed undeclared:',
        )
        expect(checkedGit(root, ['rev-parse', 'HEAD'])).toBe(base)
      } finally {
        wt.cleanup()
      }
    })
  }

  it('fails closed when fork-point metadata is missing', async () => {
    const root = fixture()
    const { result } = await throughHarness(root, (path) => {
      write(path, 'out.txt')
      const branch = checkedGit(path, ['symbolic-ref', '--short', 'HEAD'])
      checkedGit(path, ['config', '--unset', `branch.${branch}.orchestosForkPoint`])
    })
    expect(result.filesBlocked).toEqual(['fork-point: missing'])
    const wt = createWorktree('missing-fork', 'main', root)
    try {
      checkedGit(root, ['config', '--unset', `branch.${wt.branch}.orchestosForkPoint`])
      expect(() => mergeWorktreeBack(wt, 'commit', undefined, [])).toThrow('fork-point: missing')
    } finally {
      wt.cleanup()
    }
  })

  it('lists rename source and destination, and stages declared deletions', () => {
    const root = fixture()
    const wt: Worktree = createWorktree('rename', 'main', root)
    try {
      checkedGit(wt.path, ['mv', 'tracked.txt', 'renamed.txt'])
      expect(listWorktreeChanges(wt.path, worktreeForkPoint(wt.path)!)).toEqual(
        expect.arrayContaining([
          { path: 'tracked.txt', deleted: true },
          { path: 'renamed.txt', deleted: false },
        ]),
      )
      expect(
        mergeWorktreeBack(wt, 'commit', undefined, ['tracked.txt', 'renamed.txt']),
      ).toBeTruthy()
      expect(existsSync(join(root, 'tracked.txt'))).toBe(false)
      expect(readFileSync(join(root, 'renamed.txt'), 'utf8')).toBe('keep\n')
    } finally {
      if (existsSync(wt.path)) wt.cleanup()
    }
  })
})
