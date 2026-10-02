import { afterAll, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { withFileLock } from '../run/file-lock.ts'
import { loadTasks, mutateTasks, saveTasks, updateTaskStatus } from '../tasks/loader.ts'
import type { Task } from '../tasks/schema.ts'

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-tasks-concurrency-'))
  saveTasks(root, {
    version: 1,
    project: 'fixture',
    tasks: ['one', 'two', 'three', 'four'].map((id) => ({
      id,
      description: id,
      executor: 'openrouter',
      input: [],
      output: [`${id}.txt`],
      depends_on: [],
      status: 'pending',
      retry_count: 0,
    })),
  })
  return root
}

const workerPrelude = `import { updateTaskStatus, mutateTasks } from ${JSON.stringify(join(import.meta.dir, '..', 'tasks', 'loader.ts'))}\n`

function spawn(root: string, script: string, args: string[] = []) {
  const file = join(
    root,
    `orchestos-worker-${process.pid}-${Math.random().toString(36).slice(2)}.ts`,
  )
  writeFileSync(file, script)
  const proc = Bun.spawn([process.execPath, 'run', file, ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  })
  return { proc, file }
}

describe('tasks concurrency across OS processes', () => {
  afterAll(() => {
    const workerPrefix = `orchestos-worker-${process.pid}-`
    expect(readdirSync(tmpdir()).filter((name) => name.startsWith(workerPrefix))).toEqual([])
  })

  it('serializes 4 processes × 25 updates without losing tasks or the last update', async () => {
    const root = makeRoot()
    try {
      const workers = ['one', 'two', 'three', 'four'].map((id, index) =>
        spawn(
          root,
          `${workerPrelude}const root = process.argv[2]; for (let i=0;i<25;i++) updateTaskStatus(root, ${JSON.stringify(id)}, { retry_reason: 'p${index}-'+i })`,
          [root],
        ),
      )
      const codes = await Promise.all(workers.map(({ proc }) => proc.exited))
      for (const code of codes) expect(code).toBe(0)
      const file = loadTasks(root)
      expect(file.tasks).toHaveLength(4)
      for (const [index, task] of file.tasks.entries())
        expect(task.retry_reason).toBe(`p${index}-24`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 20_000)

  it('merges separate field patches and a deleted task stays deleted', async () => {
    const root = makeRoot()
    try {
      const workers = [
        spawn(
          root,
          `${workerPrelude}updateTaskStatus(process.argv[2], 'one', { retry_reason: 'reason' })`,
          [root],
        ),
        spawn(
          root,
          `${workerPrelude}updateTaskStatus(process.argv[2], 'one', { qa_verdict: 'fail' })`,
          [root],
        ),
      ]
      expect(await Promise.all(workers.map(({ proc }) => proc.exited))).toEqual([0, 0])
      expect(loadTasks(root).tasks[0]).toMatchObject({ retry_reason: 'reason', qa_verdict: 'fail' })
      mutateTasks(root, (file) => {
        file.tasks = file.tasks.filter((task) => task.id !== 'one')
      })
      expect(() => updateTaskStatus(root, 'one', { retry_reason: 'resurrect' })).toThrow(
        'Task "one" not found in tasks.yaml',
      )
      expect(loadTasks(root).tasks.some((task) => task.id === 'one')).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 10_000)

  it('recovers valid YAML after five SIGKILL interruptions and accepts a following mutation quickly', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-tasks-interrupt-'))
    const lockDir = join(root, '.orchestos')
    mkdirSync(lockDir, { recursive: true })
    const tasks: Task[] = Array.from({ length: 3000 }, (_, i) => ({
      id: `task-${i}`,
      description: `description-${i}`,
      executor: 'openrouter',
      input: [],
      output: [`out-${i}.txt`],
      depends_on: [],
      status: 'pending',
      retry_count: 0,
    }))
    saveTasks(root, { version: 1, project: 'large-fixture', tasks })
    const worker = spawn(
      root,
      `${workerPrelude}const root=process.argv[2]; let n=0; while(true) mutateTasks(root, f => { f.tasks[0]!.retry_reason='worker-'+process.pid+'-'+(n++) })`,
      [root],
    )
    try {
      for (let round = 0; round < 5; round++) {
        const previous = loadTasks(root).tasks[0]?.retry_reason
        const deadline = Date.now() + 5000
        while (loadTasks(root).tasks[0]?.retry_reason === previous && Date.now() < deadline)
          await Bun.sleep(10)
        expect(loadTasks(root).tasks[0]?.retry_reason).not.toBe(previous)
        await Bun.sleep(Math.floor(Math.random() * 21))
        worker.proc.kill('SIGKILL')
        await worker.proc.exited
        const file = loadTasks(root)
        expect(file.tasks).toHaveLength(3000)
        const start = Date.now()
        mutateTasks(root, (current) => {
          const task = current.tasks[1]
          if (task) task.retry_reason = `recovered-${round}`
        })
        expect(Date.now() - start).toBeLessThan(2000)
        expect(readdirSync(root).filter((name) => name.startsWith('.tasks.yaml.tmp-'))).toEqual([])
        if (round < 4) {
          // Spawn a fresh process after each simulated crash.
          const replacement = spawn(
            root,
            `${workerPrelude}const root=process.argv[2]; let n=0; while(true) mutateTasks(root, f => { f.tasks[0]!.retry_reason='worker-'+process.pid+'-'+(n++) })`,
            [root],
          )
          Object.assign(worker, replacement)
        }
      }
    } finally {
      worker.proc.kill('SIGKILL')
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
})

describe('file lock recovery and ownership', () => {
  it('cleans orphaned task temporaries while preserving temporaries from live PIDs', () => {
    const root = makeRoot()
    const orphan = join(root, `.tasks.yaml.tmp-${process.pid + 1000000}-orphan`)
    const live = join(root, `.tasks.yaml.tmp-${process.pid}-live`)
    try {
      writeFileSync(orphan, 'orphan')
      writeFileSync(live, 'live')
      mutateTasks(root, () => undefined)
      expect(existsSync(orphan)).toBe(false)
      expect(existsSync(live)).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('recovers a dead PID promptly and an old empty lock by mtime', () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-file-lock-'))
    const path = join(root, 'dead.lock')
    try {
      writeFileSync(path, `${process.pid + 1000000}:dead-token`)
      expect(withFileLock(path, () => 'recovered')).toBe('recovered')
      writeFileSync(path, '')
      const old = new Date(Date.now() - 120_000)
      utimesSync(path, old, old)
      expect(withFileLock(path, () => 'empty-recovered')).toBe('empty-recovered')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('times out with lock path for a live owner and does not unlink an altered token', () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-file-lock-'))
    const path = join(root, 'live.lock')
    try {
      writeFileSync(path, `${process.pid}:live-token`)
      expect(() =>
        withFileLock(path, () => undefined, { waitTimeoutMs: 120, pollIntervalMs: 20 }),
      ).toThrow(path)
      rmSync(path)
      expect(
        withFileLock(path, () => {
          writeFileSync(path, 'another-owner')
        }),
      ).toBeUndefined()
      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path, 'utf8')).toBe('another-owner')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
