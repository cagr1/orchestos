import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { commitFinalTaskState, commitTasksYaml } from '../run/commit-tasks-yaml.ts'
import { saveTasks } from '../tasks/loader.ts'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function sh(args: string[], cwd: string): string {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  const p = Bun.spawnSync(['git', ...args], { cwd, env })
  return p.stdout.toString().trim()
}

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-ctasks-'))
  dirs.push(dir)
  sh(['init', '-q'], dir)
  sh(['config', 'user.name', 'fixture'], dir)
  sh(['config', 'user.email', 'fixture@example.invalid'], dir)
  writeFileSync(join(dir, 'tasks.yaml'), 'tasks: []\n')
  writeFileSync(join(dir, 'other.txt'), 'a\n')
  writeFileSync(join(dir, '.gitignore'), '.orchestos/\n')
  sh(['add', '-A'], dir)
  sh(
    [
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      'init',
    ],
    dir,
  )
  return dir
}

describe('commitTasksYaml', () => {
  it('commitea solo tasks.yaml; otro archivo del índice sigue staged', () => {
    const dir = fixture()
    writeFileSync(join(dir, 'tasks.yaml'), 'tasks:\n  - id: a\n')
    writeFileSync(join(dir, 'other.txt'), 'b\n')
    sh(['add', 'other.txt'], dir)
    commitTasksYaml(dir, 'chore(tasks): a done')
    expect(sh(['log', '-1', '--format=%s'], dir)).toBe('chore(tasks): a done')
    expect(sh(['show', '--name-only', '--format=', 'HEAD'], dir)).toBe('tasks.yaml')
    expect(sh(['diff', '--cached', '--name-only'], dir)).toBe('other.txt')
    expect(sh(['status', '--porcelain', '--', 'tasks.yaml'], dir)).toBe('')
  })

  it('sin cambios no crea commit ni lanza', () => {
    const dir = fixture()
    const before = sh(['rev-parse', 'HEAD'], dir)
    expect(() => commitTasksYaml(dir, 'chore(tasks): x done')).not.toThrow()
    expect(sh(['rev-parse', 'HEAD'], dir)).toBe(before)
  })

  it('directorio que no es repo: no lanza ni crea nada', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-ctasks-norepo-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, 'tasks.yaml'), 'tasks: []\n')
    expect(() => commitTasksYaml(dir, 'chore(tasks): x done')).not.toThrow()
  })

  it('tasks.yaml ignorado: silencioso, sin commit', () => {
    const dir = fixture()
    sh(['rm', '--cached', '-q', 'tasks.yaml'], dir)
    writeFileSync(join(dir, '.gitignore'), 'tasks.yaml\n.orchestos/\n')
    sh(['add', '.gitignore'], dir)
    sh(
      [
        '-c',
        'user.name=fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '-qm',
        'ign',
      ],
      dir,
    )
    const before = sh(['rev-parse', 'HEAD'], dir)
    writeFileSync(join(dir, 'tasks.yaml'), 'tasks:\n  - id: z\n')
    expect(() => commitTasksYaml(dir, 'chore(tasks): z done')).not.toThrow()
    expect(sh(['rev-parse', 'HEAD'], dir)).toBe(before)
  })
})

describe('commitFinalTaskState', () => {
  function setTaskStatus(dir: string, status: 'done' | 'running') {
    saveTasks(dir, {
      version: 1,
      project: 'fixture',
      tasks: [
        {
          id: 'task-1',
          description: 'fixture task',
          executor: 'openrouter',
          input: [],
          output: ['result.txt'],
          depends_on: [],
          status,
          retry_count: 0,
        },
      ],
    })
  }

  it('commitea el estado final de la tarea', () => {
    const dir = fixture()
    setTaskStatus(dir, 'done')

    commitFinalTaskState(dir, 'task-1')

    expect(sh(['log', '-1', '--format=%s'], dir)).toBe('chore(tasks): task-1 done')
    expect(sh(['status', '--porcelain', '--', 'tasks.yaml'], dir)).toBe('')
  })

  it('no commitea una tarea que sigue running', () => {
    const dir = fixture()
    setTaskStatus(dir, 'running')
    const before = sh(['rev-parse', 'HEAD'], dir)

    commitFinalTaskState(dir, 'task-1')

    expect(sh(['rev-parse', 'HEAD'], dir)).toBe(before)
  })

  it('ignora un id inexistente', () => {
    const dir = fixture()
    const before = sh(['rev-parse', 'HEAD'], dir)

    expect(() => commitFinalTaskState(dir, 'missing')).not.toThrow()
    expect(sh(['rev-parse', 'HEAD'], dir)).toBe(before)
  })
})
