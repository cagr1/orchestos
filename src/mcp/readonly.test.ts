import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planReadonly, runReadonly } from './readonly.ts'

let root: string
let outside: string
let sha: string
const hasRg = !!Bun.which('rg')

const git = (...args: string[]) =>
  Bun.spawnSync(
    ['git', '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args],
    { cwd: root },
  )

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'at21-root-')))
  outside = realpathSync(mkdtempSync(join(tmpdir(), 'at21-out-')))
  git('init', '-q')
  writeFileSync(join(root, 'a.txt'), 'hello world\n')
  mkdirSync(join(root, 'sub'))
  writeFileSync(join(root, 'sub', 'b.txt'), 'needle here\n')
  writeFileSync(join(outside, 'secret.txt'), 'top secret needle\n')
  symlinkSync(outside, join(root, 'escape'))
  git('add', 'a.txt', 'sub')
  git('commit', '-q', '-m', 'first')
  sha = new TextDecoder().decode(git('rev-parse', '--short', 'HEAD').stdout as Uint8Array).trim()
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

const rejected = (argv: unknown) => {
  const plan = planReadonly({ argv }, root)
  expect(plan.ok).toBe(false)
  return plan.ok ? '' : plan.error
}

describe('run_readonly — lista de permitidos', () => {
  test('programas fuera de la lista y sh -c se rechazan', () => {
    for (const argv of [
      ['sh', '-c', 'id'],
      ['bash', '-c', 'id'],
      ['cat', 'a.txt'],
      ['bun', 'test'],
      ['npm', 'test'],
      ['/usr/bin/git', 'log'],
      ['rm', '-rf', 'a.txt'],
    ])
      expect(rejected(argv)).toContain('not allowed')
  })

  test('argv inválido', () => {
    for (const argv of [[], 'git log', [1], ['git', 'log\0x']]) rejected(argv)
  })

  test('subcomandos de git fuera de la lista', () => {
    for (const sub of [
      'commit',
      'checkout',
      'restore',
      'stash',
      'push',
      'config',
      'reset',
      'clean',
    ])
      expect(rejected(['git', sub])).toContain('not allowed')
  })

  test('git: opciones globales rechazadas', () => {
    for (const argv of [
      ['git', '-c', 'core.pager=sh', 'log'],
      ['git', '-C', '/', 'log'],
      ['git', '--git-dir=/x', 'log'],
      ['git', '--work-tree=/x', 'status'],
      ['git', '--paginate', 'log'],
      ['git', '-p', 'log'],
      ['git', '--exec-path=/x', 'log'],
    ])
      rejected(argv)
  })
})

describe('run_readonly — endurecimiento de git (uno por flag)', () => {
  const denied: Array<[string, string[]]> = [
    ['--output', ['git', 'diff', '--output=/tmp/x']],
    ['--output (valor aparte)', ['git', 'log', '--output', '/tmp/x']],
    ['-o en diff', ['git', 'diff', '-o', 'x']],
    ['-o en log', ['git', 'log', '-ox']],
    ['-O', ['git', 'diff', '-Oorder.txt']],
    ['--open-files-in-pager', ['git', 'grep', '--open-files-in-pager=sh', 'x']],
    ['-O en grep', ['git', 'grep', '-Osh', 'x']],
    ['--ext-diff', ['git', 'diff', '--ext-diff']],
    ['--exec', ['git', 'grep', '--exec=sh', 'x']],
    ['--git-dir', ['git', 'log', '--git-dir=/x']],
    ['--work-tree', ['git', 'status', '--work-tree=/x']],
    ['--textconv', ['git', 'diff', '--textconv']],
    ['--textcon abreviado', ['git', 'diff', '--textcon']],
    ['--no-index', ['git', 'diff', '--no-index', 'a.txt', 'sub/b.txt']],
    ['--no-index grep', ['git', 'grep', '--no-index', 'x']],
    ['--show-signature', ['git', 'log', '--show-signature']],
    ['%G en formato', ['git', 'log', '--format=%GG']],
    ['--paginate', ['git', 'log', '--paginate']],
    ['grep -iOsh (corta agrupada)', ['git', 'grep', '-iOsh', 'PWNED']],
    ['grep --open-files=sh (abreviatura)', ['git', 'grep', '--open-files=sh', 'x']],
    ['grep --open=sh (abreviatura)', ['git', 'grep', '--open=sh', 'x']],
    ['log --outp= (abreviatura)', ['git', 'log', '--outp=/tmp/x']],
    ['-Osh', ['git', 'grep', '-Osh', 'x']],
    ['-iO', ['git', 'grep', '-iO', 'x']],
    ['--open-files-in-pager=sh', ['git', 'grep', '--open-files-in-pager=sh', 'x']],
    ['grep -nf agrupada', ['git', 'grep', '-nf/etc/passwd', 'x']],
    ['blame -LS agrupada', ['git', 'blame', '-wS/etc/passwd', 'a.txt']],
  ]
  for (const [name, argv] of denied) test(`rechaza ${name}`, () => void rejected(argv))

  test('el env de git deshabilita abreviaturas de opciones', () => {
    const plan = planReadonly({ argv: ['git', 'status'] }, root)
    expect(plan.ok && plan.env.GIT_TEST_DISALLOW_ABBREVIATED_OPTIONS).toBe('1')
  })

  test('git status --porc: el binario rechaza la abreviatura', async () => {
    const res = await runReadonly({ argv: ['git', 'status', '--porc'] }, root)
    expect(res.isError).toBe(true)
    expect(res.text).toContain('abbreviated')
  })

  test('git grep -iOsh no ejecuta nada: el centinela no se crea', async () => {
    const sentinel = join(outside, 'pwned')
    writeFileSync(join(root, 'sh'), `#!/bin/sh\ntouch ${sentinel}\n`)
    const res = await runReadonly({ argv: ['git', 'grep', '-iOsh', 'hello'] }, root)
    expect(res.isError).toBe(true)
    expect(existsSync(sentinel)).toBe(false)
    rmSync(join(root, 'sh'))
  })

  test('branch solo lista', () => {
    for (const argv of [
      ['git', 'branch', 'nueva'],
      ['git', 'branch', '-d', 'x'],
      ['git', 'branch', '-D', 'x'],
      ['git', 'branch', '-m', 'x'],
      ['git', 'branch', '--set-upstream-to=x'],
      ['git', 'branch', '--delete', 'x'],
    ])
      rejected(argv)
    for (const argv of [
      ['git', 'branch'],
      ['git', 'branch', '--list'],
      ['git', 'branch', '-a'],
      ['git', 'branch', '-r'],
      ['git', 'branch', '--list', 'ma*'],
    ])
      expect(planReadonly({ argv }, root).ok).toBe(true)
  })

  test('el plan añade pager, ext-diff y textconv apagados y entorno de git acotado', () => {
    const plan = planReadonly({ argv: ['git', 'diff'] }, root)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.args.slice(0, 2)).toEqual(['--no-pager', '-c'])
    expect(plan.args).toContain('core.pager=cat')
    expect(plan.args).toContain('--no-ext-diff')
    expect(plan.args).toContain('--no-textconv')
    expect(plan.env.GIT_CONFIG_NOSYSTEM).toBe('1')
    expect(plan.env.GIT_TERMINAL_PROMPT).toBe('0')
    expect(plan.env.GIT_PAGER).toBe('cat')
  })

  test('entorno heredado peligroso no pasa', () => {
    process.env.GIT_EXTERNAL_DIFF = 'sh'
    process.env.RIPGREP_CONFIG_PATH = '/x'
    try {
      for (const argv of [
        ['git', 'log'],
        ['rg', 'x'],
      ]) {
        const plan = planReadonly({ argv }, root)
        expect(plan.ok && 'GIT_EXTERNAL_DIFF' in plan.env).toBe(false)
        expect(plan.ok && 'RIPGREP_CONFIG_PATH' in plan.env).toBe(false)
      }
    } finally {
      delete process.env.GIT_EXTERNAL_DIFF
      delete process.env.RIPGREP_CONFIG_PATH
    }
  })
})

describe('run_readonly — endurecimiento de rg (uno por flag)', () => {
  const denied: Array<[string, () => string[]]> = [
    ['--pre', () => ['rg', '--pre', 'sh', 'x']],
    ['--pre=', () => ['rg', '--pre=sh', 'x']],
    ['--pre-glob', () => ['rg', '--pre-glob=*.txt', 'x']],
    ['-z', () => ['rg', '-z', 'x']],
    ['-z en cluster', () => ['rg', '-iz', 'x']],
    ['--search-zip', () => ['rg', '--search-zip', 'x']],
    ['--hostname-bin', () => ['rg', '--hostname-bin=sh', 'x']],
    ['-L', () => ['rg', '-L', 'x']],
    ['--follow', () => ['rg', '--follow', 'x']],
    ['--ignore-file fuera', () => ['rg', `--ignore-file=${join(outside, 'secret.txt')}`, 'x']],
    [
      '--ignore-file fuera (aparte)',
      () => ['rg', '--ignore-file', join(outside, 'secret.txt'), 'x'],
    ],
    [
      '--ignore-file-case-insensitive fuera',
      () => ['rg', '--ignore-file-case-insensitive=/etc/hosts', 'x'],
    ],
    ['-f fuera', () => ['rg', '-f', '/etc/hosts']],
    ['ruta fuera', () => ['rg', 'x', '/etc']],
    ['ruta con ..', () => ['rg', 'x', '../..']],
  ]
  for (const [name, argv] of denied) test(`rechaza ${name}`, () => void rejected(argv()))

  test('--ignore-file dentro del proyecto se acepta; el plan fuerza --no-config y una ruta', () => {
    const plan = planReadonly({ argv: ['rg', '--ignore-file', 'a.txt', 'needle'] }, root)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.args[0]).toBe('--no-config')
    expect(plan.args.slice(-2)).toEqual(['--', '.'])
  })

  test('un valor que parece flag no se confunde con flag', () => {
    expect(planReadonly({ argv: ['rg', '-e', '-z', 'sub'] }, root).ok).toBe(true)
  })
})

describe('run_readonly — ls', () => {
  test('flags de lectura sí, el resto no', () => {
    expect(planReadonly({ argv: ['ls', '-la', 'sub'] }, root).ok).toBe(true)
    for (const argv of [
      ['ls', '-L'],
      ['ls', '--color=always'],
      ['ls', '-@x'],
      ['ls', '-H'],
    ])
      rejected(argv)
  })
})

describe('run_readonly — rutas dentro del proyecto', () => {
  test('ruta absoluta, .. y symlink que sale se rechazan', () => {
    for (const argv of [
      ['ls', '/'],
      ['ls', '..'],
      ['ls', 'sub/../..'],
      ['ls', 'escape'],
      ['ls', 'escape/secret.txt'],
      ['rg', 'needle', 'escape'],
      ['git', 'ls-files', '--', '../x'],
      ['git', 'diff', '--', '/etc/passwd'],
      ['git', 'blame', '--contents', join(outside, 'secret.txt'), 'a.txt'],
      ['git', 'blame', '--contents=/etc/hosts', 'a.txt'],
      ['git', 'grep', '-f', '/etc/hosts'],
      ['git', 'ls-files', '-X', '/etc/hosts'],
      ['git', 'log', '--', 'escape/secret.txt'],
    ])
      expect(rejected(argv)).toContain('outside the project')
  })

  test('rutas legítimas pasan', () => {
    for (const argv of [
      ['ls', '-la'],
      ['ls', 'sub'],
      ['git', 'log', '-1', '--', 'a.txt'],
      ['git', 'show', 'HEAD:a.txt'],
      ['git', 'log', 'HEAD~1..HEAD'],
      ['git', 'blame', '--contents', 'a.txt', 'a.txt'],
    ])
      expect(planReadonly({ argv }, root).ok).toBe(true)
  })
})

describe('run_readonly — ejecución real', () => {
  test('git log -1 devuelve el SHA real', async () => {
    const out = await runReadonly({ argv: ['git', 'log', '-1', '--format=%h'] }, root)
    // macOS puede añadir un warning de confstr al stderr de git; el SHA sigue siendo la primera línea.
    expect(out.text.split('\n')[0]).toBe(sha)
    expect(out.isError).toBe(false)
  })

  test('git status, diff, blame, ls-files, grep, rev-parse y branch funcionan', async () => {
    writeFileSync(join(root, 'a.txt'), 'hello world\nmore\n')
    for (const argv of [
      ['git', 'status', '--short'],
      ['git', 'diff'],
      ['git', 'show', 'HEAD'],
      ['git', 'blame', 'a.txt'],
      ['git', 'ls-files'],
      ['git', 'grep', 'needle'],
      ['git', 'rev-parse', 'HEAD'],
      ['git', 'branch', '--list'],
      ['git', 'log', '-p', '-1'],
    ]) {
      const out = await runReadonly({ argv }, root)
      expect({ argv, isError: out.isError }).toEqual({ argv, isError: false })
    }
  })

  test.skipIf(!hasRg)('rg y ls funcionan; rg sin coincidencias no es error', async () => {
    const found = await runReadonly({ argv: ['rg', 'needle'] }, root)
    expect(found.isError).toBe(false)
    expect(found.text).toContain('needle here')
    expect(found.text).not.toContain('top secret')
    const none = await runReadonly({ argv: ['rg', 'zzzzzz-nada'] }, root)
    expect(none.isError).toBe(false)
    const listing = await runReadonly({ argv: ['ls', '-1'] }, root)
    expect(listing.text).toContain('a.txt')
  })

  test('el rechazo llega como error con motivo', async () => {
    const out = await runReadonly({ argv: ['git', 'commit', '-m', 'x'] }, root)
    expect(out.isError).toBe(true)
    expect(out.text).toContain('not allowed')
  })

  test.skipIf(!hasRg)('salida recortada a 64 KB con aviso', async () => {
    writeFileSync(join(root, 'big.txt'), `${'x'.repeat(100)}\n`.repeat(2000))
    const out = await runReadonly({ argv: ['rg', 'x', 'big.txt'] }, root)
    expect(out.text).toContain('[output truncated at 64 KB]')
    expect(out.text.length).toBeLessThan(66 * 1024)
  })

  test('timeout corta el proceso', async () => {
    writeFileSync(join(root, 'slow.txt'), 'x\n'.repeat(1000))
    const out = await runReadonly({ argv: ['git', 'grep', '-n', 'x'] }, root, 1)
    // 1 ms: o termina antes o se corta; en ambos casos no cuelga ni lanza.
    expect(typeof out.text).toBe('string')
  })

  test('rg ausente: error claro, no excepción', async () => {
    const out = await runReadonly({ argv: ['rg', 'x'] }, root)
    expect(typeof out.text).toBe('string')
    if (!hasRg) expect(out).toMatchObject({ isError: true })
  })

  test('git no escribe: el árbol y el índice quedan igual tras status/diff', async () => {
    const before = await runReadonly({ argv: ['git', 'status', '--porcelain=v2'] }, root)
    await runReadonly({ argv: ['git', 'diff'] }, root)
    const after = await runReadonly({ argv: ['git', 'status', '--porcelain=v2'] }, root)
    expect(after.text).toBe(before.text)
  })
})

describe('run_readonly — config hostil del repo (ronda 3)', () => {
  const dirs: string[] = []
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
  })

  /** Repo temporal con un commit; `script(name, body)` crea un ejecutable que toca el centinela. */
  function hostileRepo() {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'at21-host-')))
    dirs.push(dir)
    const repo = join(dir, 'repo')
    mkdirSync(repo)
    const sentinel = join(dir, 'PWNED')
    const run = (...a: string[]) =>
      Bun.spawnSync(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: repo })
    const script = (name: string, body: string) => {
      const path = join(dir, name)
      writeFileSync(path, `#!/bin/sh\n${body}\n`)
      chmodSync(path, 0o755)
      return path
    }
    run('init', '-q')
    writeFileSync(join(repo, 'a.txt'), 'one\n')
    run('add', 'a.txt')
    run('commit', '-q', '-m', 'first')
    return { dir, repo, sentinel, run, script }
  }

  const readonly = (repo: string, ...argv: string[]) => runReadonly({ argv }, repo)

  test('filter.clean (gitattributes) no se ejecuta en diff ni blame', async () => {
    const h = hostileRepo()
    const clean = h.script('clean.sh', `touch ${h.sentinel}\ncat`)
    writeFileSync(join(h.repo, '.gitattributes'), 'a.txt filter=pw\n')
    h.run('config', 'filter.pw.clean', clean)
    h.run('config', 'filter.pw.required', 'true')
    writeFileSync(join(h.repo, 'a.txt'), 'one\ntwo\n')
    const diff = await readonly(h.repo, 'git', 'diff')
    expect(diff.isError).toBe(false)
    expect(existsSync(h.sentinel)).toBe(false)
    await readonly(h.repo, 'git', 'blame', 'a.txt')
    expect(existsSync(h.sentinel)).toBe(false)
  })

  test('gpg.program con log.showSignature no se ejecuta en log -1 ni show --no-patch', async () => {
    const h = hostileRepo()
    const gpg = h.script(
      'gpg.sh',
      `touch ${h.sentinel}\ncat >/dev/null\necho '[GNUPG:] SIG_CREATED ' >&2\nprintf -- '-----BEGIN PGP SIGNATURE-----\\n\\nZm9v\\n-----END PGP SIGNATURE-----\\n'`,
    )
    h.run('config', 'gpg.program', gpg)
    h.run('commit', '-q', '--allow-empty', '-S', '-m', 'signed')
    rmSync(h.sentinel, { force: true })
    h.run('config', 'log.showSignature', 'true')
    const log = await readonly(h.repo, 'git', 'log', '-1')
    expect(log.isError).toBe(false)
    expect(existsSync(h.sentinel)).toBe(false)
    await readonly(h.repo, 'git', 'show', '--no-patch', 'HEAD')
    expect(existsSync(h.sentinel)).toBe(false)
  })

  test('diff.<x>.textconv no se ejecuta, con o sin --textconv', async () => {
    const h = hostileRepo()
    const tc = h.script('tc.sh', `touch ${h.sentinel}\ncat "$1"`)
    writeFileSync(join(h.repo, '.gitattributes'), 'a.txt diff=tc\n')
    h.run('config', 'diff.tc.textconv', tc)
    writeFileSync(join(h.repo, 'a.txt'), 'one\ntwo\n')
    await readonly(h.repo, 'git', 'diff')
    await readonly(h.repo, 'git', 'log', '-p', '-1')
    expect(existsSync(h.sentinel)).toBe(false)
    expect((await readonly(h.repo, 'git', 'diff', '--textconv')).isError).toBe(true)
  })

  test('core.pager hostil no se ejecuta', async () => {
    const h = hostileRepo()
    const pager = h.script('pager.sh', `touch ${h.sentinel}\ncat`)
    h.run('config', 'core.pager', pager)
    h.run('config', 'pager.log', pager)
    const log = await readonly(h.repo, 'git', 'log', '-1')
    expect(log.isError).toBe(false)
    expect(existsSync(h.sentinel)).toBe(false)
  })

  test('include.path que trae un filter.clean tampoco se ejecuta', async () => {
    const h = hostileRepo()
    const clean = h.script('clean.sh', `touch ${h.sentinel}\ncat`)
    const inc = join(h.dir, 'inc.cfg')
    writeFileSync(inc, `[filter "pw"]\n\tclean = ${clean}\n`)
    h.run('config', 'include.path', inc)
    writeFileSync(join(h.repo, '.gitattributes'), 'a.txt filter=pw\n')
    writeFileSync(join(h.repo, 'a.txt'), 'one\ntwo\n')
    const diff = await readonly(h.repo, 'git', 'diff')
    expect(diff.isError).toBe(false)
    expect(existsSync(h.sentinel)).toBe(false)
  })

  test('git log --text se acepta (opción real, prefijo de --textconv)', () => {
    const plan = planReadonly({ argv: ['git', 'log', '--text', '-1'] }, root)
    expect(plan.ok).toBe(true)
  })

  test('timeout: un hijo con streams abiertos no retrasa la respuesta', async () => {
    const h = hostileRepo()
    h.script('git', 'if [ "$1" = config ]; then exit 0; fi\nsleep 5 &\nsleep 5')
    const savedPath = process.env.PATH
    process.env.PATH = `${h.dir}:${savedPath}`
    try {
      const t0 = Date.now()
      const res = await runReadonly({ argv: ['git', 'diff'] }, h.repo, 100)
      expect(Date.now() - t0).toBeLessThan(1000)
      expect(res.isError).toBe(true)
      expect(res.text).toContain('[timed out after 0.1s]')
    } finally {
      process.env.PATH = savedPath
    }
  })

  // Ronda 5 — defensas estructurales
  test('flags de submódulo rechazados (y abreviaturas)', () => {
    for (const argv of [
      ['git', 'diff', '--submodule=diff'],
      ['git', 'diff', '--submodule'],
      ['git', 'log', '--submodule=log'],
      ['git', 'grep', '--recurse-submodules', 'x'],
      ['git', 'ls-files', '--recurse-submodules'],
      ['git', 'status', '--recurse-submodule'],
      ['git', 'diff', '--ignore-submodules=none'],
    ])
      expect(rejected(argv)).toContain('not allowed')
    expect(rejected(['git', 'diff', '--recurse-submod'])).toContain('abbreviates')
  })

  test('el plan fuerza submódulos apagados donde el subcomando lo admite', () => {
    const args = (argv: string[]) => {
      const plan = planReadonly({ argv }, root)
      return plan.ok ? plan.args : []
    }
    for (const sub of ['diff', 'status', 'log', 'show'])
      expect(args(['git', sub])).toContain('--ignore-submodules=all')
    for (const sub of ['blame', 'grep', 'ls-files', 'rev-parse', 'branch'])
      expect(args(['git', sub])).not.toContain('--ignore-submodules=all')
    expect(args(['git', 'diff'])).toContain('diff.submodule=short')
    expect(args(['git', 'diff'])).toContain('submodule.recurse=false')
  })

  test('submódulo con filter.clean propio: ni --submodule=diff ni diff/status lo ejecutan', async () => {
    const h = hostileRepo()
    const subSrc = join(h.dir, 'subsrc')
    mkdirSync(subSrc)
    const sg = (...a: string[]) =>
      Bun.spawnSync(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: subSrc })
    sg('init', '-q')
    writeFileSync(join(subSrc, 'f.txt'), 'x\n')
    sg('add', 'f.txt')
    sg('commit', '-q', '-m', 'sub')
    h.run('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', subSrc, 'm')
    h.run('commit', '-q', '-m', 'add sub')
    const m = join(h.repo, 'm')
    const clean = h.script('clean.sh', `touch ${h.sentinel}\ncat`)
    writeFileSync(join(m, '.gitattributes'), 'f.txt filter=pw\n')
    Bun.spawnSync(['git', 'config', 'filter.pw.clean', clean], { cwd: m })
    writeFileSync(join(m, 'f.txt'), 'x\ny\n')
    expect((await readonly(h.repo, 'git', 'diff', '--submodule=diff')).isError).toBe(true)
    await readonly(h.repo, 'git', 'diff')
    await readonly(h.repo, 'git', 'status')
    await readonly(h.repo, 'git', 'log', '-p', '-1')
    expect(existsSync(h.sentinel)).toBe(false)
  })

  test('core.worktree fuera del proyecto: rechazado, no filtra el archivo de fuera', async () => {
    const h = hostileRepo()
    const out = join(h.dir, 'outside')
    mkdirSync(out)
    writeFileSync(join(out, 'a.txt'), 'SECRET_OUTSIDE_PROJECT\n')
    h.run('config', 'core.worktree', out)
    const res = await readonly(h.repo, 'git', 'diff', '--', 'a.txt')
    expect(res.isError).toBe(true)
    expect(res.text).toContain('outside the project')
    expect(res.text).not.toContain('SECRET_OUTSIDE_PROJECT')
  })

  test('work tree distinto de la raíz (raíz es subcarpeta del repo) se rechaza', async () => {
    const h = hostileRepo()
    mkdirSync(join(h.repo, 'inner'))
    const res = await readonly(join(h.repo, 'inner'), 'git', 'status')
    expect(res.isError).toBe(true)
    expect(res.text).toContain('outside the project')
  })

  test('un worktree enlazado (.git es archivo) sigue valiendo', async () => {
    const h = hostileRepo()
    const wt = join(h.dir, 'linked')
    h.run('worktree', 'add', '-q', wt)
    const res = await readonly(wt, 'git', 'rev-parse', '--show-toplevel')
    expect(res.isError).toBe(false)
    expect(res.text.trim()).toBe(realpathSync(wt))
  })

  test('clave de ejecución sin neutralización cierra la llamada nombrándola', async () => {
    const h = hostileRepo()
    h.run('config', 'merge.pw.driver', 'touch x')
    h.run('config', 'remote.origin.uploadpack', 'touch y')
    const res = await readonly(h.repo, 'git', 'status')
    expect(res.isError).toBe(true)
    expect(res.text).toContain('merge.pw.driver')
    expect(res.text).toContain('cannot be neutralized')
  })

  test('core.editor y core.askpass se neutralizan, no bloquean', async () => {
    const h = hostileRepo()
    h.run('config', 'core.editor', 'vim')
    h.run('config', 'core.askpass', 'x')
    const res = await readonly(h.repo, 'git', 'status')
    expect(res.isError).toBe(false)
  })

  test('include.path a un FIFO: el plazo único corta el listado de config', async () => {
    const h = hostileRepo()
    const fifo = join(h.dir, 'fifo.cfg')
    Bun.spawnSync(['mkfifo', fifo])
    h.run('config', 'include.path', fifo)
    const t0 = Date.now()
    const res = await runReadonly({ argv: ['git', 'status'] }, h.repo, 300)
    expect(Date.now() - t0).toBeLessThan(1500)
    expect(res.isError).toBe(true)
    expect(res.text).toContain('[timed out after 0.3s]')
  })

  // Ronda 6
  test('listado de config truncado (>1 MB de claves antes del filtro): rechaza, no ejecuta', async () => {
    const h = hostileRepo()
    const clean = h.script('clean.sh', `touch ${h.sentinel}\ncat`)
    const filler = Array.from({ length: 80_000 }, (_, i) => `\tfillerkeynumber${i} = 1`).join('\n')
    writeFileSync(
      join(h.repo, '.git', 'config'),
      `${readFileSync(join(h.repo, '.git', 'config'), 'utf8')}[safe]\n${filler}\n[filter "pw"]\n\tclean = ${clean}\n`,
    )
    writeFileSync(join(h.repo, '.gitattributes'), 'a.txt filter=pw\n')
    writeFileSync(join(h.repo, 'a.txt'), 'one\ntwo\n')
    const res = await readonly(h.repo, 'git', 'diff')
    expect(res.isError).toBe(true)
    expect(res.text).toContain('too large to verify')
    expect(existsSync(h.sentinel)).toBe(false)
  })

  test('listado de config con código ≠ 0 rechaza', async () => {
    const h = hostileRepo()
    writeFileSync(
      join(h.repo, '.git', 'config'),
      `${readFileSync(join(h.repo, '.git', 'config'), 'utf8')}[broken\n`,
    )
    const res = await readonly(h.repo, 'git', 'status')
    expect(res.isError).toBe(true)
  })

  test('blame --ignore-revs-file fuera del proyecto: ambas formas rechazadas', () => {
    expect(
      rejected(['git', 'blame', `--ignore-revs-file=${join(outside, 'x')}`, 'a.txt']),
    ).toContain('outside the project')
    expect(rejected(['git', 'blame', '--ignore-revs-file', join(outside, 'x'), 'a.txt'])).toContain(
      'outside the project',
    )
    expect(
      planReadonly({ argv: ['git', 'blame', '--ignore-revs-file=a.txt', 'a.txt'] }, root).ok,
    ).toBe(true)
  })

  test('el plan neutraliza blame.ignoreRevsFile, mailmap.file y mailmap.blob', () => {
    const plan = planReadonly({ argv: ['git', 'log', '-1'] }, root)
    expect(plan.ok && plan.args).toEqual(
      expect.arrayContaining(['blame.ignoreRevsFile=', 'mailmap.file=', 'mailmap.blob=']),
    )
  })

  test('blame.ignoreRevsFile en la config cierra blame (no se puede neutralizar); otros subcomandos siguen', async () => {
    const h = hostileRepo()
    const out = join(h.dir, 'secret.txt')
    writeFileSync(out, 'SECRET_OUTSIDE_PROJECT\n')
    h.run('config', 'blame.ignoreRevsFile', out)
    const blame = await readonly(h.repo, 'git', 'blame', 'a.txt')
    expect(blame.isError).toBe(true)
    expect(blame.text).toContain('cannot be neutralized')
    expect(blame.text).not.toContain('SECRET_OUTSIDE_PROJECT')
    expect((await readonly(h.repo, 'git', 'log', '-1')).isError).toBe(false)
  })

  test('mailmap.file de la config no se lee', async () => {
    const h = hostileRepo()
    const out = join(h.dir, 'mailmap')
    writeFileSync(out, 'LEAKED_NAME <t@t>\n')
    h.run('config', 'mailmap.file', out)
    const log = await readonly(h.repo, 'git', 'log', '-1', '--use-mailmap', '--format=%aN')
    expect(log.isError).toBe(false)
    expect(log.text).not.toContain('LEAKED_NAME')
  })
})
