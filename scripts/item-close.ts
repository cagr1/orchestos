import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parsePlanDocumentSegments, parsePlanItemSources } from './plan-status.ts'

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type CommandRunner = (command: string[], root: string) => CommandResult

export const runCommand: CommandRunner = (command, root) => {
  const result = Bun.spawnSync(command, { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

interface Options {
  item: string
  message: string
  body: string
  paths: string[]
  evidence: string[]
  executor: string
  noDelegation: string
  spec: string
  live: string
  dryRun: boolean
  noPush: boolean
}

function parseOptions(args: string[]): { options: Options; errors: string[] } {
  const options: Options = {
    item: '',
    message: '',
    body: '',
    paths: [],
    evidence: [],
    executor: '',
    noDelegation: '',
    spec: '',
    live: '',
    dryRun: false,
    noPush: false,
  }
  const errors: string[] = []
  const keys = {
    '--item': 'item',
    '--message': 'message',
    '--body': 'body',
    '--executor': 'executor',
    '--no-delegation': 'noDelegation',
    '--spec': 'spec',
    '--live': 'live',
  } as const
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--') continue
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--no-push') options.noPush = true
    else if (arg && (Object.hasOwn(keys, arg) || arg === '--path' || arg === '--evidence')) {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) {
        errors.push(`Falta valor para ${arg}`)
        continue
      }
      index += 1
      if (arg === '--path') options.paths.push(value)
      else if (arg === '--evidence') options.evidence.push(value)
      else options[keys[arg as keyof typeof keys]] = value
    } else errors.push(`Argumento desconocido: ${arg}`)
  }
  return { options, errors }
}

function provenance(options: Options): string {
  return options.executor
    ? `Ejecutado por: ${options.executor}${options.spec ? ` · Spec: ${options.spec}` : ''}`
    : `Sin delegación: ${options.noDelegation}`
}

function wrapFreeText(prefix: string, text: string, suffix = ''): string {
  const lines = [prefix]
  for (const word of [...text.trim().split(/\s+/), ...(suffix ? [suffix.trimStart()] : [])]) {
    const last = lines.length - 1
    const line = lines[last] ?? ''
    if (line.length + word.length + 1 > 120) lines.push(`  ${word}`)
    else lines[last] = `${line} ${word}`
  }
  return lines.join('\n')
}

function closePlan(plan: string, options: Options): string {
  return parsePlanDocumentSegments(plan)
    .map((segment) => {
      if (segment.itemId !== options.item) return segment.text
      let text = segment.text.replace(/^- \[ \]/, '- [x]')
      const additions: string[] = []
      if (options.live) {
        const citations = options.evidence.map((path) => `\`${path}\``).join(', ')
        const gate = wrapFreeText('  Gate en vivo:', options.live, ` — ${citations}`)
        // Only free text wraps; evidence citations stay intact.
        if (!text.includes(gate)) additions.push(gate)
      }
      const declaration = options.executor
        ? `  ${provenance(options)}`
        : wrapFreeText('  Sin delegación:', options.noDelegation)
      if (!text.includes(`${declaration}\n`) && !text.endsWith(declaration))
        additions.push(declaration)
      if (additions.length) {
        if (!text.endsWith('\n')) text += '\n'
        text += `${additions.join('\n')}\n`
      }
      return text
    })
    .join('')
}

function planDiff(before: string, after: string): string {
  if (before === after) return ''
  const lines = (text: string) => (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n')
  const oldLines = lines(before)
  const newLines = lines(after)
  let start = 0
  while (oldLines[start] === newLines[start] && start < oldLines.length) start += 1
  let end = 0
  while (
    end < oldLines.length - start &&
    end < newLines.length - start &&
    oldLines[oldLines.length - end - 1] === newLines[newLines.length - end - 1]
  )
    end += 1
  start = Math.max(0, start - 3)
  end = Math.max(0, end - 3)
  const removed = oldLines.slice(start, oldLines.length - end)
  const added = newLines.slice(start, newLines.length - end)
  return [
    '--- a/PLAN.md',
    '+++ b/PLAN.md',
    `@@ -${start + 1},${removed.length} +${start + 1},${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join('\n')
}

export interface CloseDependencies {
  runner?: CommandRunner
  reconcile?: (root: string) => void | Promise<void>
  output?: (text: string) => void
  writerLockPath?: string
}

async function reconcilePlan(root: string): Promise<void> {
  const { configureWorktreePlanHome } = await import('./plan-worktree-home.ts')
  configureWorktreePlanHome()
  const { runMigrations } = await import('../src/db/migrate.ts')
  const { importPlan } = await import('./plan-import.ts')
  runMigrations()
  importPlan(root, true)
}

export async function closeItem(
  args: string[],
  root = process.cwd(),
  dependencies: CloseDependencies = {},
): Promise<number> {
  const runner = dependencies.runner ?? runCommand
  const output = dependencies.output ?? console.log
  const reconcile = dependencies.reconcile ?? reconcilePlan
  const { options, errors } = parseOptions(args)
  const planPath = join(root, 'PLAN.md')
  const plan = existsSync(planPath) ? readFileSync(planPath, 'utf8') : ''
  const item = parsePlanItemSources(plan).find((source) => source.id === options.item)
  if (!item) errors.push(`Ítem no encontrado en PLAN.md: ${options.item}`)
  if (item?.status === 'done') {
    const head = runner(['git', 'show', 'HEAD:PLAN.md'], root)
    if (head.exitCode !== 0) errors.push(head.stderr || 'No se pudo comprobar el cierre en HEAD')
    else if (
      parsePlanItemSources(head.stdout).some(
        (source) => source.id === item.id && source.status === 'done',
      )
    )
      errors.push(`El ítem ${item.id} ya tiene commit de cierre`)
  }
  const lockPath =
    dependencies.writerLockPath ?? join(homedir(), '.agent-method/hooks/writer-lock.js')
  if (existsSync(lockPath)) {
    const lock = runner(['node', lockPath, 'check'], root)
    if (lock.exitCode !== 0)
      errors.push(lock.stderr || lock.stdout || 'Candado de escritura rechazado')
  }
  if (!options.paths.length) errors.push('Se requiere al menos un --path')
  for (const path of options.paths) {
    if (!existsSync(join(root, path))) {
      const status = runner(['git', 'status', '--porcelain', '--', path], root)
      if (status.exitCode !== 0 || !status.stdout.trim()) errors.push(`Ruta inexistente: ${path}`)
    }
  }
  if (Boolean(options.executor.trim()) === Boolean(options.noDelegation.trim()))
    errors.push('Usa --executor o --no-delegation, exactamente uno')
  if (options.spec && !/^docs\/specs\/[^/\s]+\.md$/.test(options.spec))
    errors.push('--spec debe ser docs/specs/<algo>.md')
  for (const path of options.evidence) {
    if (!existsSync(join(root, path)) || !/\.(?:json|ndjson|log)$/.test(path))
      errors.push(`Evidencia inexistente o extensión inválida: ${path}`)
  }
  if (Boolean(options.live.trim()) !== Boolean(options.evidence.length))
    errors.push('--live y --evidence se requieren mutuamente')
  if (!options.message.trim()) errors.push('--message no puede estar vacío')
  if (errors.length) {
    output(errors.join('\n'))
    return 1
  }

  const nextPlan = closePlan(plan, options)
  const ownSpec = `docs/specs/${options.item}.md`
  const removeSpec = options.spec === ownSpec && existsSync(join(root, ownSpec))
  const checked = (command: string[]): string => {
    const result = runner(command, root)
    if (result.exitCode !== 0) throw new Error(result.stdout + result.stderr)
    return result.stdout
  }
  try {
    const specInIndex =
      options.spec === ownSpec &&
      runner(['git', 'ls-files', '--error-unmatch', '--', ownSpec], root).exitCode === 0
    const trackedSpec =
      specInIndex ||
      (options.spec === ownSpec &&
        runner(['git', 'cat-file', '-e', `HEAD:${ownSpec}`], root).exitCode === 0)
    const paths = [
      ...new Set([
        'PLAN.md',
        ...options.paths,
        ...options.evidence,
        ...(trackedSpec ? [ownSpec] : []),
      ]),
    ]
    const commit = ['git', 'commit', '-m', options.message, '-m', provenance(options)]
    // The caller's Co-Authored-By trailer, if supplied, remains last.
    if (options.body) commit.push('-m', options.body)
    commit.push('--', ...paths)
    if (options.dryRun) {
      // Preview without writing temporary files or changing the index/DB.
      output(planDiff(plan, nextPlan))
      output(commit.map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(' '))
      return 0
    }
    writeFileSync(planPath, nextPlan)
    if (removeSpec) {
      if (specInIndex) checked(['git', 'rm', '-q', '--', ownSpec])
      else unlinkSync(join(root, ownSpec))
    }
    const biomePaths = [...new Set([...options.paths, ...options.evidence])].filter(
      (path) => /\.(?:ts|tsx|js|mjs|json|jsonc|css)$/.test(path) && existsSync(join(root, path)),
    )
    if (biomePaths.length) checked(['bunx', 'biome', 'check', '--write', ...biomePaths])
    await reconcile(root)
    const untracked = paths.filter(
      (path) =>
        existsSync(join(root, path)) &&
        runner(['git', 'ls-files', '--error-unmatch', '--', path], root).exitCode !== 0,
    )
    if (untracked.length) checked(['git', 'add', '-N', '--', ...untracked])
    checked(commit)
    await reconcile(root)
    if (!options.noPush) {
      const branch = checked(['git', 'branch', '--show-current']).trim()
      checked(['git', 'push', '--no-verify', 'origin', branch])
    }
    output(checked(['git', 'rev-parse', 'HEAD']).trim())
    output(checked(['git', 'status', '--short']).trimEnd())
    return 0
  } catch (error) {
    output(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (import.meta.main) process.exitCode = await closeItem(Bun.argv.slice(2))
