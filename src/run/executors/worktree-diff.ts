/**
 * src/run/executors/worktree-diff.ts — G.5
 *
 * Extraído de external.ts (B.1/B.4/D.1) para que lo reuse cualquier engine
 * que escriba directo al filesystem del worktree en vez de devolver un
 * buffer en memoria (hoy: external.ts para `claude -p`, opencode.ts para
 * `opencode run`). Sin cambio de comportamiento respecto al original — solo
 * relocación, para no duplicar esta lógica (con historial real de bugs, ver
 * comentario de `readWorktreeDiff` abajo) entre dos executors.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { normalizeRelPath, resolveProjectPath } from '../path-policy.ts'

/** Read NUL-delimited git output without trimming path whitespace. */
function gitPaths(root: string, args: string[]): string[] {
  const proc = Bun.spawnSync(['git', ...args], {
    cwd: root,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  })
  if (proc.exitCode !== 0)
    throw new Error(`git ${args[0]} failed: ${proc.stderr.toString().trim()}`)
  return proc.stdout.toString().split('\0').filter(Boolean)
}

export function worktreeForkPoint(root: string): string | null {
  const branch = Bun.spawnSync(['git', 'symbolic-ref', '--short', 'HEAD'], { cwd: root })
  if (branch.exitCode !== 0) return null
  const fork = Bun.spawnSync(
    ['git', 'config', '--get', `branch.${branch.stdout.toString().trim()}.orchestosForkPoint`],
    { cwd: root },
  )
  return fork.exitCode === 0 ? fork.stdout.toString().trim() || null : null
}

export function worktreeSetupArtifacts(root: string): string[] {
  const branch = Bun.spawnSync(['git', 'symbolic-ref', '--short', 'HEAD'], { cwd: root })
  if (branch.exitCode !== 0) return []
  const artifacts = Bun.spawnSync(
    [
      'git',
      'config',
      '-z',
      '--get-all',
      `branch.${branch.stdout.toString().trim()}.orchestosSetupArtifact`,
    ],
    { cwd: root },
  )
  return artifacts.exitCode === 0 ? artifacts.stdout.toString().split('\0').filter(Boolean) : []
}

export function listCommittedWorktreePaths(root: string, forkPoint: string): string[] {
  return gitPaths(root, [
    'diff',
    '--name-only',
    '-z',
    '--no-renames',
    forkPoint,
    'HEAD',
    '--',
    '.',
    ':!node_modules',
  ])
}

export function listWorktreeChanges(
  root: string,
  forkPoint: string,
): { path: string; deleted: boolean }[] {
  const entries = gitPaths(root, [
    'diff',
    '--name-status',
    '-z',
    '--no-renames',
    forkPoint,
    '--',
    '.',
    ':!node_modules',
  ])
  const changes = new Map<string, { path: string; deleted: boolean }>()
  for (let i = 0; i < entries.length; i += 2) {
    const status = entries[i]
    const path = entries[i + 1]
    if (path !== undefined) changes.set(path, { path, deleted: status === 'D' })
  }
  for (const path of gitPaths(root, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    '.',
    ':!node_modules',
  ]))
    changes.set(path, { path, deleted: false })
  return [...changes.values()]
}

/**
 * BB.5 (2026-08-16) — artefactos que escribe el TOOLING DEL HOST, no la tarea.
 *
 * Hallazgo real al correr la comparación de motores (PLAN.md § BB.4): un `claude -p`
 * lanzado por el executor hereda el `~/.claude/settings.json` del usuario, plugins y
 * hooks incluidos. Esos hooks escriben dentro del worktree (`.impeccable/hook.cache.json`)
 * y `git status` los reporta igual que cualquier archivo del agente → el contrato los
 * cuenta como escritura no autorizada y MATA la tarea, con el trabajo hecho correcto al
 * lado. Evidencia: `?? .impeccable/hook.cache.json` junto a los 2 archivos que la tarea
 * sí pidió, ambos correctos. Afecta a los 3 engines CLI (comparten este módulo).
 *
 * Mismo criterio que el pathspec `':!node_modules'` de T (Mes 26): esto no es output del
 * engine, es ruido del entorno. La diferencia es que acá NO se excluye a ciegas — si la
 * tarea declaró explícitamente ese path en su `output[]`, se respeta y se reporta normal.
 * Así una tarea que de verdad quiera editar `.claude/settings.json` sigue pudiendo, y el
 * ruido incidental deja de romper corridas ajenas.
 */
const HOST_TOOLING_PREFIXES = [
  '.impeccable/',
  '.claude/',
  '.codex/',
  '.opencode/',
  '.cursor/',
  '.aider/',
] as const

export function isHostToolingArtifact(
  relPath: string,
  declaredOutputs: readonly string[],
): boolean {
  if (declaredOutputs.includes(relPath)) return false // la tarea lo pidió explícitamente
  if (relPath === '.DS_Store' || relPath.endsWith('/.DS_Store')) return true
  return HOST_TOOLING_PREFIXES.some((prefix) => relPath.startsWith(prefix))
}

export function readWorktreeDiff(
  effectiveRoot: string,
  declaredOutputs: readonly string[] = [],
): { path: string; content: string }[] {
  const paths = listWorktreeChanges(effectiveRoot, worktreeForkPoint(effectiveRoot) ?? 'HEAD')
  const outputs = declaredOutputs.map(normalizeRelPath)
  const setupArtifacts = new Set(worktreeSetupArtifacts(effectiveRoot))
  const files: { path: string; content: string }[] = []
  for (const { path } of paths) {
    const normalized = normalizeRelPath(path)
    if (setupArtifacts.has(normalized) && !outputs.includes(normalized)) continue
    // BB.5 — ruido del tooling del host: se descarta ANTES de resolver el path, para
    // que no llegue nunca al contrato como "archivo escrito no autorizado".
    if (isHostToolingArtifact(normalized, declaredOutputs)) continue
    let full: string
    try {
      full = resolveProjectPath(effectiveRoot, normalized, 'read')
    } catch {
      continue
    }
    if (!existsSync(full)) continue // archivo borrado por el proceso externo — nada que reportar como FileChange
    // B.4 — git reporta el directorio untracked (con -uall) como una entrada mas;
    // readFileSync sobre un directorio tira EISDIR. isFile() lo descarta. Si en el
    // futuro hace falta descender, cambiar a readdirSync(full, { recursive: true, withFileTypes: true }).
    if (!statSync(full).isFile()) continue
    files.push({ path: normalized, content: readFileSync(full, 'utf-8') })
  }
  return files
}
