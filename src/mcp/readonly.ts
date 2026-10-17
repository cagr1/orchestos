/**
 * src/mcp/readonly.ts — AT.21
 *
 * `run_readonly`: shell de solo lectura para el chat de cualquier CLI. Capa común del servidor MCP y del chat por
 * API: la misma función valida y ejecuta. Sin shell (`Bun.spawn` con argv), sin pipes ni redirecciones; la frontera
 * es esta lista de permitidos, no el prompt.
 *
 * Revisado con git 2.50.1 y ripgrep 14.1.1 (2026-10-17): ver `docs/specs/AT.21.md` § Ajustes 4 y el reporte.
 */

import { realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export const RUN_READONLY_TOOL = 'run_readonly'
export const READONLY_TIMEOUT_MS = 20_000
export const READONLY_MAX_BYTES = 64 * 1024
/** Tope propio del listado de config: truncado = no verificable = se rechaza (ronda 6). */
const CONFIG_LISTING_MAX_BYTES = 1024 * 1024

export const RUN_READONLY_SCHEMA = {
  type: 'object',
  properties: {
    argv: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Program and arguments, no shell. Allowed: `git` (log, show, diff, status, blame, ls-files, grep, rev-parse, branch --list), `ls`, `rg`. Example: ["git","log","-1"].',
    },
  },
  required: ['argv'],
  additionalProperties: false,
} as const

export const RUN_READONLY_DESCRIPTION =
  'Run a read-only command in the project root to verify facts instead of guessing: `git` (log, show, diff, status, blame, ls-files, grep, rev-parse, branch --list), `ls`, `rg`. No shell, pipes or redirects; project tests are not allowed.'

export type ReadonlyPlan =
  | { ok: true; program: string; args: string[]; env: Record<string, string> }
  | { ok: false; error: string }

const GIT_SUBCOMMANDS = [
  'log',
  'show',
  'diff',
  'status',
  'blame',
  'ls-files',
  'grep',
  'rev-parse',
  'branch',
] as const
type GitSubcommand = (typeof GIT_SUBCOMMANDS)[number]

/** Flags de git que ejecutan programas, escriben archivos o salen del árbol; se rechazan en cualquier posición. */
const GIT_DENIED_FLAGS = [
  '--output',
  '-O',
  '--open-files-in-pager',
  '--ext-diff',
  '--exec',
  '--git-dir',
  '--work-tree',
  '--exec-path',
  '--textconv',
  '--no-index',
  '--show-signature',
  '--paginate',
  '--namespace',
  '--super-prefix',
  '--config-env',
  '--submodule',
  '--recurse-submodules',
  '--ignore-submodules',
] as const

/** Opciones reales que son prefijo de un flag denegado (`--text` vs `--textconv`); el binario las acepta exactas. */
const GIT_REAL_FLAG_EXCEPTIONS = new Set(['--text'])

/** Flags de git cuyo valor es una ruta que se lee; deben quedar dentro del proyecto. */
const GIT_PATH_FLAGS = [
  '--contents',
  '--exclude-from',
  '--ignore-revs-file',
  '-X',
  '-f',
  '--file',
  '-S',
] as const

const RG_DENIED_LONG = [
  '--pre',
  '--pre-glob',
  '--search-zip',
  '--hostname-bin',
  '--follow',
  '--config',
] as const
const RG_DENIED_SHORT = ['z', 'L'] as const
const RG_PATH_FLAGS = ['--ignore-file', '--ignore-file-case-insensitive', '--file', '-f'] as const
const RG_VALUE_SHORT = new Set([
  'A',
  'B',
  'C',
  'e',
  'E',
  'f',
  'g',
  'j',
  'm',
  'M',
  'r',
  't',
  'T',
  'd',
])
const RG_VALUE_LONG = new Set([
  '--after-context',
  '--before-context',
  '--context',
  '--regexp',
  '--encoding',
  '--file',
  '--glob',
  '--iglob',
  '--threads',
  '--max-count',
  '--max-columns',
  '--replace',
  '--type',
  '--type-not',
  '--type-add',
  '--type-clear',
  '--max-depth',
  '--maxdepth',
  '--max-filesize',
  '--ignore-file',
  '--ignore-file-case-insensitive',
  '--engine',
  '--dfa-size-limit',
  '--regex-size-limit',
  '--color',
  '--colors',
  '--context-separator',
  '--field-context-separator',
  '--field-match-separator',
  '--hyperlink-format',
  '--path-separator',
  '--sort',
  '--sortr',
  '--generate',
])

const LS_SAFE_SHORT = /^-[1aAdFhilpRrSstU]+$/

function realpathOrAncestor(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    const parent = dirname(path)
    if (parent === path) return path
    return join(realpathOrAncestor(parent), path.slice(parent.length + 1))
  }
}

/** `null` si la ruta (con symlinks resueltos) queda dentro de `root`; si no, el motivo. */
export function pathOutsideProject(path: string, root: string): string | null {
  const realRoot = realpathOrAncestor(resolve(root))
  const real = realpathOrAncestor(resolve(root, path))
  const rel = relative(realRoot, real)
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return null
  return `path is outside the project: ${path}`
}

function matchesFlag(token: string, flag: string): boolean {
  return token === flag || (flag.startsWith('--') && token.startsWith(`${flag}=`))
}

function baseEnv(): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    LANG: process.env.LANG ?? 'C.UTF-8',
  }
  if (process.env.HOME) env.HOME = process.env.HOME
  return env
}

function planGit(args: string[], root: string): ReadonlyPlan {
  const sub = args[0]
  if (!sub || !(GIT_SUBCOMMANDS as readonly string[]).includes(sub))
    return {
      ok: false,
      error: `git ${sub ?? ''}: not allowed. Allowed git subcommands: ${GIT_SUBCOMMANDS.join(', ')}. Global options (-c, -C, -p, --git-dir…) are not accepted.`,
    }
  const rest = args.slice(1)
  const diffLike = sub === 'log' || sub === 'show' || sub === 'diff'
  let afterDashes = false
  let valueIsPath = false
  for (const token of rest) {
    if (valueIsPath) {
      valueIsPath = false
      const outside = pathOutsideProject(token, root)
      if (outside) return { ok: false, error: `git ${sub}: ${outside}` }
      continue
    }
    if (afterDashes) {
      const outside = pathOutsideProject(token, root)
      if (outside) return { ok: false, error: `git ${sub}: ${outside}` }
      continue
    }
    if (token === '--') {
      afterDashes = true
      continue
    }
    if (token.includes('%G'))
      return { ok: false, error: `git ${sub}: signature placeholders (%G) are not allowed` }
    if (token.startsWith('-')) {
      // Submódulos: git entraría a su repo y a su config (filtros, textconv), que este chequeo no ve.
      if (token.startsWith('--submodule') || token.startsWith('--recurse-submodule'))
        return {
          ok: false,
          error: `git ${sub}: flag ${token.split('=')[0]} is not allowed (submodules)`,
        }
      for (const flag of GIT_DENIED_FLAGS)
        if (matchesFlag(token, flag) || (flag === '-O' && token.startsWith('-O')))
          return { ok: false, error: `git ${sub}: flag ${token.split('=')[0]} is not allowed` }
      if (token.startsWith('--')) {
        // Abreviatura de un flag denegado (git la acepta en parse-options): defensa propia además del env.
        const name = token.split('=')[0] as string
        if (
          name.length > 2 &&
          !GIT_REAL_FLAG_EXCEPTIONS.has(name) &&
          GIT_DENIED_FLAGS.some((f) => f.startsWith('--') && f !== name && f.startsWith(name))
        )
          return { ok: false, error: `git ${sub}: flag ${name} abbreviates a denied flag` }
      } else if (token.length > 2) {
        // Cortas agrupadas: parse-options examina cada letra; `-iOsh` ejecuta `sh`.
        const letters = token.slice(1)
        if (
          letters.includes('O') ||
          (diffLike && letters.includes('o')) ||
          (sub === 'grep' && letters.includes('f')) ||
          (sub === 'ls-files' && letters.includes('X')) ||
          (sub === 'blame' && letters.includes('S'))
        )
          return { ok: false, error: `git ${sub}: grouped short flags ${token} are not allowed` }
      }
      if (diffLike && /^-o/.test(token) && !token.startsWith('--'))
        return { ok: false, error: `git ${sub}: flag -o is not allowed` }
      for (const flag of GIT_PATH_FLAGS) {
        if (flag === '-f' && sub !== 'grep') continue
        if (flag === '-S' && sub !== 'blame') continue
        if (flag === '-X' && sub !== 'ls-files') continue
        if (token === flag) {
          valueIsPath = true
          break
        }
        if (flag.startsWith('--') && token.startsWith(`${flag}=`)) {
          const outside = pathOutsideProject(token.slice(flag.length + 1), root)
          if (outside) return { ok: false, error: `git ${sub}: ${outside}` }
        }
      }
      continue
    }
    // Positional: revisión, patrón o ruta. Sin shell no hay expansión; se resuelve contra la raíz y debe quedar dentro.
    const outside = pathOutsideProject(token, root)
    if (outside) return { ok: false, error: `git ${sub}: ${outside}` }
  }
  if (valueIsPath) return { ok: false, error: `git ${sub}: flag is missing its path value` }
  if (sub === 'branch') {
    const flags = rest.filter((t) => t.startsWith('-'))
    const allowed = ['--list', '-a', '-r', '--all', '--remotes']
    if (flags.some((f) => !allowed.includes(f)))
      return { ok: false, error: 'git branch: only listing is allowed (no args, --list, -a, -r)' }
    if (rest.some((t) => !t.startsWith('-')) && !rest.includes('--list'))
      return { ok: false, error: 'git branch: a name creates a branch; use --list <pattern>' }
  }
  const prelude = [
    '--no-pager',
    '-c',
    'core.pager=cat',
    '-c',
    'core.fsmonitor=false',
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'log.showSignature=false',
    '-c',
    'submodule.recurse=false',
    '-c',
    'diff.submodule=short',
    '-c',
    'status.submoduleSummary=false',
    '-c',
    'blame.ignoreRevsFile=',
    '-c',
    'mailmap.file=',
    '-c',
    'mailmap.blob=',
    sub as GitSubcommand,
  ]
  const extra: string[] = []
  // Medido con git 2.50.1: lo aceptan diff, status, log y show; blame/grep/ls-files/rev-parse/branch no.
  if (diffLike || sub === 'status') extra.push('--ignore-submodules=all')
  if (sub === 'log' || sub === 'show') extra.push('--no-show-signature')
  if (diffLike) extra.push('--no-ext-diff', '--no-textconv')
  if (sub === 'grep') extra.push('--no-textconv')
  if (sub === 'blame') extra.push('--no-textconv')
  return {
    ok: true,
    program: 'git',
    args: [...prelude, ...extra, ...rest],
    env: gitEnv(),
  }
}

function gitEnv(): Record<string, string> {
  return {
    ...baseEnv(),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TEST_DISALLOW_ABBREVIATED_OPTIONS: '1',
  }
}

/** Valor neutro para una clave de config que ejecuta programas, o `null` si la clave no ejecuta nada. */
function neutralValue(key: string): string | null {
  const parts = key.split('.')
  const section = parts[0]
  const variable = parts[parts.length - 1]
  const multi = parts.length > 2
  if (section === 'filter' && multi) {
    if (variable === 'clean' || variable === 'smudge' || variable === 'process') return ''
    if (variable === 'required') return 'false'
  }
  if (section === 'diff' && multi && (variable === 'textconv' || variable === 'command')) return ''
  if (section === 'gpg' && variable === 'program') return 'false'
  if (key === 'core.pager' || (section === 'pager' && parts.length >= 2)) return 'cat'
  if (key === 'core.fsmonitor') return 'false'
  if (key === 'core.sshcommand') return ''
  if (variable === 'helper' && section === 'credential') return ''
  if (key === 'core.hookspath') return '/dev/null'
  // Nunca se lanzan en solo lectura; `false` los vuelve inertes (evita rechazar el `core.editor` típico del usuario).
  if (variable === 'editor' || variable === 'askpass') return 'false'
  return null
}

/** Último segmento de clave que ejecuta programas o saca el work tree del proyecto (ronda 5). */
const EXEC_KEY_SEGMENTS = new Set([
  'command',
  'program',
  'driver',
  'clean',
  'smudge',
  'process',
  'textconv',
  'helper',
  'sshcommand',
  'askpass',
  'editor',
  'pager',
  'fsmonitor',
  'hookspath',
  'worktree',
  'alternaterefscommand',
  'packobjectshook',
  'uploadpack',
  'receivepack',
])

/**
 * Antes de ejecutar git: lista la config efectiva (`git config --list --includes --name-only`, solo lee), neutraliza
 * con `-c clave=valor` cada clave que ejecuta programas, falla cerrado ante una clave de ejecución que no puede
 * neutralizar y comprueba que el work tree de git sea el proyecto. Todo bajo el plazo común `remaining()`.
 */
async function prepareGit(
  isBlame: boolean,
  root: string,
  env: Record<string, string>,
  remaining: () => number,
): Promise<{ args: string[] } | { error: string; timedOut?: boolean }> {
  const listing = await execCapped(
    ['git', 'config', '--list', '--includes', '--name-only'],
    root,
    env,
    remaining(),
    CONFIG_LISTING_MAX_BYTES,
  )
  if (listing.timedOut) return { error: '', timedOut: true }
  if (listing.truncated) return { error: 'git config too large to verify; refusing' }
  if (listing.code !== 0)
    return { error: listing.text || `git config --list failed (exit ${listing.code})` }
  const seen = new Set<string>()
  const args: string[] = []
  for (const key of listing.stdout.split('\n')) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    const lower = key.toLowerCase()
    if (lower === 'core.worktree')
      return { error: `git work tree is outside the project (config ${key})` }
    // Medido con git 2.50.1: ni `-c blame.ignoreRevsFile=` ni `--ignore-revs-file=` la vacían; blame lee la ruta de la config.
    if (lower === 'blame.ignorerevsfile' && isBlame)
      return {
        error: `git config key ${key} reads a file outside the checks and cannot be neutralized; refusing`,
      }
    const value = neutralValue(lower)
    if (value !== null) {
      args.push('-c', `${key}=${value}`)
      continue
    }
    const last = lower.slice(lower.lastIndexOf('.') + 1)
    if (EXEC_KEY_SEGMENTS.has(last))
      return { error: `git config key ${key} can run programs and cannot be neutralized; refusing` }
  }
  const top = await execCapped(
    [
      'git',
      '--no-pager',
      ...args,
      '-c',
      'core.fsmonitor=false',
      '-c',
      'core.hooksPath=/dev/null',
      'rev-parse',
      '--show-toplevel',
    ],
    root,
    env,
    remaining(),
  )
  if (top.timedOut) return { error: '', timedOut: true }
  if (top.code !== 0) return { error: top.text || 'git rev-parse --show-toplevel failed' }
  if (realpathOrAncestor(top.stdout.trim()) !== realpathOrAncestor(resolve(root)))
    return { error: 'git work tree is outside the project' }
  return { args }
}

function planLs(args: string[], root: string): ReadonlyPlan {
  let afterDashes = false
  for (const token of args) {
    if (!afterDashes && token === '--') {
      afterDashes = true
      continue
    }
    if (!afterDashes && token.startsWith('-')) {
      if (!LS_SAFE_SHORT.test(token))
        return { ok: false, error: `ls: flag ${token} is not allowed (only -1aAdFhilpRrSstU)` }
      continue
    }
    const outside = pathOutsideProject(token, root)
    if (outside) return { ok: false, error: `ls: ${outside}` }
  }
  return { ok: true, program: 'ls', args, env: baseEnv() }
}

function planRg(args: string[], root: string): ReadonlyPlan {
  const positional: string[] = []
  let patternGiven = false
  let afterDashes = false
  let valueFor: string | null = null
  for (const token of args) {
    if (valueFor) {
      const flag = valueFor
      valueFor = null
      if ((RG_PATH_FLAGS as readonly string[]).includes(flag)) {
        const outside = pathOutsideProject(token, root)
        if (outside) return { ok: false, error: `rg: ${outside}` }
      }
      continue
    }
    if (!afterDashes && token === '--') {
      afterDashes = true
      continue
    }
    if (!afterDashes && token.startsWith('--')) {
      const [name = '', value] = token.split(/=(.*)/s)
      if ((RG_DENIED_LONG as readonly string[]).includes(name))
        return { ok: false, error: `rg: flag ${name} is not allowed` }
      if (name === '--files' || name === '--type-list') patternGiven = true
      if (name === '--regexp' || name === '--file') patternGiven = true
      if ((RG_PATH_FLAGS as readonly string[]).includes(name) && value !== undefined) {
        const outside = pathOutsideProject(value, root)
        if (outside) return { ok: false, error: `rg: ${outside}` }
      }
      if (RG_VALUE_LONG.has(name) && value === undefined) valueFor = name
      continue
    }
    if (!afterDashes && token.startsWith('-') && token.length > 1) {
      const letters = token.slice(1)
      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i] as string
        if ((RG_DENIED_SHORT as readonly string[]).includes(letter))
          return { ok: false, error: `rg: flag -${letter} is not allowed` }
        if (RG_VALUE_SHORT.has(letter)) {
          if (letter === 'e' || letter === 'f') patternGiven = true
          const attached = letters.slice(i + 1)
          if (attached) {
            if (letter === 'f') {
              const outside = pathOutsideProject(attached, root)
              if (outside) return { ok: false, error: `rg: ${outside}` }
            }
          } else valueFor = `-${letter}`
          break
        }
      }
      continue
    }
    positional.push(token)
  }
  if (valueFor) return { ok: false, error: `rg: flag ${valueFor} is missing its value` }
  const paths = patternGiven ? positional : positional.slice(1)
  for (const path of paths) {
    const outside = pathOutsideProject(path, root)
    if (outside) return { ok: false, error: `rg: ${outside}` }
  }
  // Sin ruta, rg podría leer de stdin; se fija el proyecto como destino.
  let final = args
  if (paths.length === 0 && !args.includes('--type-list'))
    final = afterDashes ? [...args, '.'] : [...args, '--', '.']
  return { ok: true, program: 'rg', args: ['--no-config', ...final], env: baseEnv() }
}

/** Valida `argv` y devuelve el plan de ejecución, o el motivo claro del rechazo. */
export function planReadonly(input: unknown, root: string): ReadonlyPlan {
  const argv = (input as { argv?: unknown } | null)?.argv ?? input
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((a) => typeof a !== 'string'))
    return { ok: false, error: '`argv` must be a non-empty array of strings' }
  const [program, ...args] = argv as string[]
  if (args.some((a) => a.includes('\0')))
    return { ok: false, error: 'arguments must not contain NUL bytes' }
  switch (program) {
    case 'git':
      return planGit(args, root)
    case 'ls':
      return planLs(args, root)
    case 'rg':
      return planRg(args, root)
    default:
      return {
        ok: false,
        error: `\`${program}\` is not allowed. Allowed programs: git (${GIT_SUBCOMMANDS.join(', ')}), ls, rg. Tests and other project commands are not read-only.`,
      }
  }
}

async function readCapped(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  state: { bytes: number; chunks: Uint8Array[]; truncated: boolean },
  onOverflow: () => void,
  maxBytes: number,
): Promise<void> {
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      const room = maxBytes - state.bytes
      if (room <= 0) {
        state.truncated = true
        onOverflow()
        continue
      }
      const take = value.length > room ? value.subarray(0, room) : value
      state.chunks.push(take)
      state.bytes += take.length
      if (value.length > room) {
        state.truncated = true
        onOverflow()
      }
    }
  } catch {
    // lector cancelado por timeout
  }
}

/** Mata el proceso y su grupo (hijos incluidos); el grupo existe porque se lanza `detached`. */
function killTree(proc: ReturnType<typeof Bun.spawn>): void {
  try {
    process.kill(-proc.pid, 'SIGKILL')
  } catch {
    proc.kill('SIGKILL')
  }
}

type Captured = {
  text: string
  stdout: string
  code: number | null
  timedOut: boolean
  truncated: boolean
}

/** Ejecuta con tope de salida y plazo `timeoutMs`; al vencer mata el grupo y cancela los lectores. Nunca lanza. */
async function execCapped(
  argv: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
  maxBytes = READONLY_MAX_BYTES,
): Promise<Captured> {
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(argv, {
      cwd,
      env,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      detached: true,
    })
  } catch (e: any) {
    return {
      text: `${argv[0]} could not start: ${e.message}`,
      stdout: '',
      code: -1,
      timedOut: false,
      truncated: false,
    }
  }
  const out = { bytes: 0, chunks: [] as Uint8Array[], truncated: false }
  const err = { bytes: 0, chunks: [] as Uint8Array[], truncated: false }
  const outReader = (proc.stdout as ReadableStream<Uint8Array>).getReader()
  const errReader = (proc.stderr as ReadableStream<Uint8Array>).getReader()
  const kill = () => killTree(proc)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolveTimeout) => {
    timer = setTimeout(() => resolveTimeout('timeout'), Math.max(1, timeoutMs))
  })
  const finished = Promise.all([
    readCapped(outReader, out, kill, maxBytes),
    readCapped(errReader, err, kill, maxBytes),
    proc.exited,
  ])
  const winner = await Promise.race([finished, timeout])
  clearTimeout(timer)
  const timedOut = winner === 'timeout'
  if (timedOut) {
    killTree(proc)
    outReader.cancel().catch(() => {})
    errReader.cancel().catch(() => {})
  }
  const decoder = new TextDecoder()
  const join2 = (s: typeof out) => decoder.decode(Buffer.concat(s.chunks))
  const stdout = join2(out)
  let text = stdout
  const stderr = join2(err).trim()
  if (stderr) text += `${text && !text.endsWith('\n') ? '\n' : ''}${stderr}`
  return {
    text,
    stdout,
    code: proc.exitCode,
    timedOut,
    truncated: out.truncated || err.truncated,
  }
}

/** Valida y ejecuta; nunca lanza. `isError` marca rechazo, fallo del programa o timeout. Un solo plazo para todo. */
export async function runReadonly(
  input: unknown,
  root: string,
  timeoutMs = READONLY_TIMEOUT_MS,
): Promise<{ text: string; isError: boolean }> {
  const plan = planReadonly(input, root)
  if (!plan.ok) return { text: plan.error, isError: true }
  const deadline = Date.now() + timeoutMs
  const remaining = () => deadline - Date.now()
  const timedOutResult = (text = '') => ({
    text: `${text}\n[timed out after ${timeoutMs / 1000}s]`.trim(),
    isError: true,
  })
  let args = plan.args
  if (plan.program === 'git') {
    const prepared = await prepareGit(plan.args.includes('blame'), root, plan.env, remaining)
    if ('error' in prepared)
      return prepared.timedOut ? timedOutResult() : { text: prepared.error, isError: true }
    args = [...prepared.args, ...args]
  }
  const res = await execCapped([plan.program, ...args], root, plan.env, remaining())
  if (res.code === -1 && !res.timedOut) return { text: res.text, isError: true }
  let text = res.text
  if (res.truncated) text += `\n[output truncated at ${READONLY_MAX_BYTES / 1024} KB]`
  if (res.timedOut) return timedOutResult(text)
  // rg y git grep devuelven 1 cuando no hay coincidencias: no es un error.
  const code = res.code ?? 0
  const noMatch = code === 1 && (plan.program === 'rg' || plan.args.includes('grep'))
  return { text: text || '(no output)', isError: code !== 0 && !noMatch && !res.truncated }
}
