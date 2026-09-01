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

import { existsSync, readFileSync, statSync } from 'fs'
import { normalizeRelPath, resolveProjectPath } from '../path-policy.ts'

function parseGitStatusPorcelain(stdout: string): string[] {
  if (!stdout) return []
  // stdout SIN trim global (ver gitStatusRawStdout) — cada línea conserva su
  // ancho de columna fijo "XY path", donde X/Y pueden ser un espacio literal
  // (ej. " M path" = modificado sin stage).
  return stdout
    .replace(/\n+$/, '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      // formato: "XY path" o "XY old -> new" para renames — nos quedamos con el path final
      const rest = line.slice(3)
      const arrow = rest.indexOf(' -> ')
      return arrow >= 0 ? rest.slice(arrow + 4) : rest
    })
}

/**
 * Hallazgo real en vivo (D.1, 2026-07-05): el `git()` compartido de
 * sandbox.ts hace `.trim()` sobre TODO el stdout — eso se come el espacio
 * inicial de la PRIMERA línea cuando esa línea es una modificación sin stage
 * (" M path" → "M path"), corrompiendo el offset fijo `slice(3)` de arriba:
 * "M src/foo.ts" queda "rc/foo.ts" tras el slice, un path que no existe →
 * `existsSync` lo descarta silenciosamente. El gate D.1 corrió con dinero
 * real dos veces y Claude Code editó exactamente lo pedido las dos veces —
 * pero `readWorktreeDiff` reportaba `files: []` igual, disparando "missing
 * declared output" en el harness. `sandbox-policy.ts` no lo sufre porque solo
 * usa el flag para un mensaje de warning (cosmético); acá el offset fijo lo
 * convierte en un bug de correctitud real. Fix: spawn directo sin el trim
 * global, solo recortando el/los newline(s) finales.
 */
function gitStatusRawStdout(cwd: string): string {
  // T (Mes 26, IDEAS #19, 2026-08-06) — `createWorktree()` symlinkea
  // `node_modules` para que `defaultChecksFor()` deje de perder tsc/bun test
  // en worktrees frescos. Un `.gitignore` con `node_modules/` (con slash) NO
  // matchea un symlink — solo directorios reales — así que sin este pathspec
  // el symlink aparecería como `?? node_modules` y `readWorktreeDiff()`
  // intentaría leerlo como si fuera output del engine. Verificado en vivo con
  // un fixture real: sin el pathspec, `node_modules` sale en el status pese
  // al `.gitignore`; con él, desaparece del todo.
  const proc = Bun.spawnSync(
    ['git', 'status', '--porcelain', '-uall', '--', '.', ':!node_modules'],
    { cwd },
  )
  return proc.stdout.toString()
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

function isHostToolingArtifact(relPath: string, declaredOutputs: readonly string[]): boolean {
  if (declaredOutputs.includes(relPath)) return false // la tarea lo pidió explícitamente
  if (relPath === '.DS_Store' || relPath.endsWith('/.DS_Store')) return true
  return HOST_TOOLING_PREFIXES.some((prefix) => relPath.startsWith(prefix))
}

export function readWorktreeDiff(
  effectiveRoot: string,
  declaredOutputs: readonly string[] = [],
): { path: string; content: string }[] {
  // B.4 — `-uall` (--untracked-files=all): sin este flag, git status --porcelain colapsa
  // un directorio untracked con contenido en una sola entrada `?? sub/`, ignorando los
  // archivos internos. Eso rompería la decisión d de B.1 ("diff completo, sin filtrar")
  // para el caso realista de Claude Code creando sub/inner.txt. Con -uall git emite
  // entradas individuales para cada archivo Y para el dir, y el isFile() de abajo filtra
  // el dir sin perder los archivos.
  const paths = parseGitStatusPorcelain(gitStatusRawStdout(effectiveRoot))
  const files: { path: string; content: string }[] = []
  for (const p of paths) {
    const normalized = normalizeRelPath(p)
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
