/**
 * H.10.2 — revisor adversarial nocturno, de un modelo distinto al que
 * implementó el diff del día. Corre solo, en silencio, nunca aplica nada —
 * mismo principio que Dreaming (scripts/export-runs-summary.ts + DREAMING.md),
 * nunca la misma fuente: Dreaming lee runs-summary.json, esto revisa el diff
 * del día contra el código real.
 *
 * Por qué existe: incidente R.5 (2026-09-08, ver PLAN.md § H.10). Un modelo
 * cerró un ítem con 1335 tests en verde; horas después, otro modelo (sin el
 * contexto ni el compromiso con el propio diseño) encontró 4 bugs reales de
 * concurrencia/ownership que esa suite nunca tocó — porque los tests se
 * habían escrito contra el mismo contrato que tenía el bug.
 *
 * Regla dura anti-ruido (la parte que hace o rompe esto, decisión explícita
 * de Carlos): un hallazgo solo sobrevive si el propio script ejecuta el test
 * que lo demuestra y ese test FALLA contra el código actual. Si no falla, se
 * descarta en silencio — nunca entra a REVIEW.md una opinión sin prueba.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export const REVIEWER_MODEL = 'gpt-5.6-sol'
export const STATE_PATH = '.orchestos/adversarial-review-state.json'
export const REVIEW_MD = 'REVIEW.md'
export const EVIDENCE_DIR = 'review-evidence'
const CODEX_TIMEOUT_MS = 20 * 60 * 1000
export const FINDING_TEST_TIMEOUT_MS = 30_000

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}
export type RunCommand = (args: string[], cwd: string) => CommandResult

export function runCommand(args: string[], cwd: string): CommandResult {
  const result = Bun.spawnSync(args, { cwd, stdout: 'pipe', stderr: 'pipe' })
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

// -- estado: qué ya se revisó -------------------------------------------------

export interface ReviewState {
  lastReviewedSha: string
}

export function loadState(root: string): ReviewState | null {
  const path = join(root, STATE_PATH)
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return typeof parsed?.lastReviewedSha === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function saveState(root: string, state: ReviewState): void {
  const path = join(root, STATE_PATH)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`)
}

/**
 * null significa "nada nuevo que revisar" (ya se procesó ese HEAD). Si el sha
 * guardado ya no existe en la historia (rebase/force-push), no se asume nada
 * sobre cuánto diff cubrir — se acota al último commit, igual que una
 * primera corrida.
 */
export function resolveDiffRange(
  state: ReviewState | null,
  headSha: string,
  run: RunCommand,
  root: string,
): { from: string; to: string } | null {
  if (state?.lastReviewedSha === headSha) return null
  if (state?.lastReviewedSha) {
    const check = run(['git', 'cat-file', '-e', state.lastReviewedSha], root)
    if (check.exitCode === 0) return { from: state.lastReviewedSha, to: headSha }
  }
  return { from: 'HEAD~1', to: headSha }
}

export function getDiff(
  range: { from: string; to: string },
  run: RunCommand,
  root: string,
): string {
  const result = run(['git', 'diff', `${range.from}..${range.to}`, '--unified=6'], root)
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || 'git diff failed')
  return result.stdout
}

// -- parseo del stream --json de codex exec -----------------------------------

export function extractThreadId(stdout: string): string | null {
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const evt = JSON.parse(trimmed)
      if (evt?.type === 'thread.started' && typeof evt.thread_id === 'string') return evt.thread_id
    } catch {}
  }
  return null
}

export function extractAgentMessage(stdout: string): string | null {
  let last: string | null = null
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const evt = JSON.parse(trimmed)
      if (evt?.type === 'item.completed' && evt.item?.type === 'agent_message') {
        if (typeof evt.item.text === 'string') last = evt.item.text
      }
    } catch {}
  }
  return last
}

// -- verificación del modelo real, contra el rollout de la sesión ------------
// (reference-codex-modelo-real-rollout, memoria) — el stream --json NUNCA
// declara el modelo; el rollout sí, en una línea {"type":"turn_context",
// "payload":{"model":"<id>",...}}. Verificado en vivo el 2026-09-08.

export function findRolloutPath(threadId: string, sessionsRoot: string): string | null {
  if (!existsSync(sessionsRoot)) return null
  const suffix = `-${threadId}.jsonl`
  const stack = [sessionsRoot]
  while (stack.length) {
    const dir = stack.pop() as string
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name.endsWith(suffix)) return full
    }
  }
  return null
}

export function extractModelFromRollout(rolloutText: string): string | null {
  for (const line of rolloutText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const evt = JSON.parse(trimmed)
      if (evt?.type === 'turn_context' && typeof evt.payload?.model === 'string') {
        return evt.payload.model
      }
    } catch {}
  }
  return null
}

export interface ModelVerification {
  ok: boolean
  actualModel: string | null
  reason?: string
}

export function verifyModelUsed(
  threadId: string | null,
  sessionsRoot: string,
  expectedModel: string,
): ModelVerification {
  if (!threadId) return { ok: false, actualModel: null, reason: 'sin thread_id en el stream' }
  const rolloutPath = findRolloutPath(threadId, sessionsRoot)
  if (!rolloutPath) return { ok: false, actualModel: null, reason: 'rollout no encontrado' }
  const actualModel = extractModelFromRollout(readFileSync(rolloutPath, 'utf8'))
  if (!actualModel)
    return { ok: false, actualModel: null, reason: 'rollout sin turn_context.model' }
  return { ok: actualModel === expectedModel, actualModel }
}

// -- hallazgos: parseo, y la regla dura de "el test tiene que fallar" --------

export interface Finding {
  file: string
  line: number | null
  category: string
  summary: string
  failure_scenario: string
  test_path: string
  test_code: string
}

export interface FindingTestResult {
  survived: boolean
  evidencePath: string | null
  outcomePath: string | null
  reason:
    | 'assertion-failed'
    | 'test-passed'
    | 'syntax-error'
    | 'import-error'
    | 'infrastructure-error'
    | 'timeout'
    | 'non-assertion-failure'
    | 'invalid-path'
    | 'already-exists'
  stdout: string
  stderr: string
}

/** Tolerante a texto alrededor de la cerca ```json — nunca lanza, devuelve null si no hay array parseable. */
export function parseFindings(agentMessage: string): Finding[] | null {
  const fenced = agentMessage.match(/```json\s*([\s\S]*?)```/i)
  const raw = fenced?.[1] ?? agentMessage
  try {
    const parsed = JSON.parse(raw.trim())
    if (!Array.isArray(parsed)) return null
    if (
      !parsed.every(
        (f) =>
          f &&
          typeof f.file === 'string' &&
          (typeof f.line === 'number' || f.line === null) &&
          typeof f.category === 'string' &&
          typeof f.summary === 'string' &&
          typeof f.failure_scenario === 'string' &&
          typeof f.test_path === 'string' &&
          typeof f.test_code === 'string',
      )
    )
      return null
    return parsed as Finding[]
  } catch {
    return null
  }
}

/**
 * Escribe test_code bajo review-evidence/ y lo corre con `bun test <path>`
 * explícito dentro de un sandbox macOS fail-closed (sin red, credenciales ni
 * escritura fuera de su temporal). Sobrevive SOLO si el error es una aserción;
 * sintaxis, imports, infraestructura y timeout se conservan como resultado
 * pero no demuestran el diagnóstico.
 */
/** Rechaza escapes léxicos y canónicos; nunca crea ni pisa una evidencia existente. */
export function resolveEvidencePath(
  root: string,
  testPath: string,
): { evidencePath: string; fullPath: string } | null {
  if (!testPath || isAbsolute(testPath) || testPath.split(/[\\/]+/).some((part) => part === '..'))
    return null
  const evidenceRoot = resolve(realpathSync(root), EVIDENCE_DIR)
  const name = testPath.endsWith('.check.ts') ? testPath : `${testPath}.check.ts`
  const fullPath = resolve(evidenceRoot, name)
  if (relative(evidenceRoot, fullPath).startsWith('..') || relative(evidenceRoot, fullPath) === '')
    return null
  let ancestor = dirname(fullPath)
  while (ancestor.startsWith(evidenceRoot)) {
    if (existsSync(ancestor)) {
      const realAncestor = realpathSync(ancestor)
      if (realAncestor !== evidenceRoot && !realAncestor.startsWith(`${evidenceRoot}/`)) return null
    }
    if (ancestor === evidenceRoot) break
    ancestor = dirname(ancestor)
  }
  if (existsSync(fullPath)) return null
  return { evidencePath: join(EVIDENCE_DIR, name), fullPath }
}

export function classifyFindingFailure(result: {
  exitCode: number
  stdout: string
  stderr: string
  timedOut?: boolean
}): FindingTestResult['reason'] {
  if (result.timedOut) return 'timeout'
  // H.10.2-bis — un test que TERMINA BIEN no demuestra nada: el hallazgo
  // afirmaba que el código actual está roto y la prueba dice que no lo está.
  // Antes caía en 'non-assertion-failure' por descarte, lo que hacía ilegible
  // el `.result.json` (mismo veredicto para "pasó limpio" y para "explotó de
  // una forma rara").
  if (result.exitCode === 0) return 'test-passed'
  const output = `${result.stdout}\n${result.stderr}`
  if (/syntaxerror|parse error|unexpected token|expected .+ but found/i.test(output))
    return 'syntax-error'
  if (/cannot find module|module not found|failed to resolve|import .* not found/i.test(output))
    return 'import-error'
  if (/eacces|enotdir|enoent|sandbox|spawn |failed to start|permission denied/i.test(output))
    return 'infrastructure-error'
  if (/expect\(received\)|assertionerror|expected:\s|received:\s/i.test(output))
    return 'assertion-failed'
  return 'non-assertion-failure'
}

/**
 * H.10.2-bis (2026-09-08) — el perfil anterior era `(deny default)` con solo
 * `process*`, `network*` y unas rutas de lectura. **Ningún binario arrancaba**:
 * verificado a mano, hasta `/bin/echo` moría con SIGABRT (exit 134) y stdout/
 * stderr vacíos, así que TODO hallazgo caía en `non-assertion-failure` y se
 * descartaba — el revisor habría reportado cero hallazgos para siempre, en
 * silencio. Faltaban clases enteras de operación que macOS 26 exige para
 * ejecutar cualquier proceso: `mach*`, `sysctl*`, `signal`, `ipc*`, `system*`.
 *
 * Trade-off consciente en la lectura: se permite `file-read*` global en vez de
 * una allowlist de rutas, porque acotarla volvía a impedir el arranque (el
 * dyld shared cache de macOS 26 vive detrás de firmlinks que no se resuelven
 * como uno espera). La frontera efectiva que sí importa se mantiene dura y es
 * la que evita daño real: **escritura solo dentro del temporal** y **red
 * denegada** — sin red, leer no permite exfiltrar. Como residuo queda que un
 * test podría copiar un secreto al `.result.json` local, así que las rutas de
 * credenciales conocidas se deniegan explícitamente igual.
 */
/**
 * Sonda del entorno, exportada a propósito: `CLAUDE.md` exige que todo lo que
 * dependa de un binario del sistema viva detrás de una sonda inyectable y no
 * de un chequeo suelto dentro de un test — la regla nació de un test que
 * afirmaba sobre el PATH del host y solo fallaba fuera del Mac. `sandbox-exec`
 * es exclusivo de macOS: en CI (ubuntu) no existe, y sin él la ejecución de
 * evidencia falla cerrada (ningún hallazgo se confirma) en vez de correr sin
 * aislamiento. Los tests que necesitan un sandbox real se saltan con esta
 * misma sonda, nunca duplicando la condición.
 */
export function sandboxAvailable(
  platform: string = process.platform,
  pathExists: (path: string) => boolean = existsSync,
): boolean {
  return platform === 'darwin' && pathExists('/usr/bin/sandbox-exec')
}

export function sandboxProfile(sandboxRoot: string): string {
  const quote = (path: string) => `"${path.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
  const home = process.env.HOME ?? ''
  const secrets = ['.ssh', '.aws', '.codex', '.claude', '.gnupg', '.config/gh']
    .map((dir) => `(subpath ${quote(join(home, dir))})`)
    .join(' ')
  return [
    '(version 1)',
    '(deny default)',
    '(allow process*)',
    '(allow mach*)',
    '(allow sysctl*)',
    '(allow signal)',
    '(allow ipc*)',
    '(allow system*)',
    '(deny network*)',
    '(allow file-read*)',
    home ? `(deny file-read* ${secrets})` : '',
    `(allow file-write* (subpath ${quote(sandboxRoot)}) (literal "/dev/null"))`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function runSandboxedFindingTest(
  root: string,
  evidencePath: string,
): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> {
  if (!sandboxAvailable()) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'sandbox efectivo no disponible en esta plataforma',
      timedOut: false,
    }
  }
  const sandboxRoot = mkdtempSync(join(tmpdir(), 'orchestos-review-sandbox-'))
  mkdirSync(join(sandboxRoot, 'home'), { recursive: true })
  try {
    const proc = Bun.spawn(
      [
        '/usr/bin/sandbox-exec',
        '-p',
        sandboxProfile(sandboxRoot),
        process.execPath,
        'test',
        // El `./` NO es cosmético: sin él, `bun test <ruta>` trata el argumento
        // como un FILTRO de nombre, y como la evidencia usa `.check.ts` (para
        // quedar fuera del glob de la suite del repo) no matchea ningún test y
        // no ejecuta NADA — devolviendo exit≠0 igual. Con la regla original
        // ("sobrevive si exit≠0") eso convertía cualquier hallazgo en
        // "confirmado" sin haber corrido una sola aserción. Verificado a mano:
        // sin `./` → `0 expect() calls`; con `./` → `1 fail, 1 expect() calls`.
        `./${evidencePath}`,
      ],
      {
        cwd: root,
        env: {
          HOME: join(sandboxRoot, 'home'),
          ORCHESTOS_HOME: join(sandboxRoot, 'home'),
          TMPDIR: sandboxRoot,
          PATH: dirname(process.execPath),
        },
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
    }, FINDING_TEST_TIMEOUT_MS)
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    const exitCode = await proc.exited
    clearTimeout(timer)
    return { exitCode, stdout, stderr, timedOut }
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true })
  }
}

export async function runFindingTest(root: string, finding: Finding): Promise<FindingTestResult> {
  const target = resolveEvidencePath(root, finding.test_path)
  if (!target)
    return {
      survived: false,
      evidencePath: null,
      outcomePath: null,
      reason: 'invalid-path',
      stdout: '',
      stderr: '',
    }
  const { evidencePath, fullPath } = target
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, finding.test_code)
  const result = await runSandboxedFindingTest(root, evidencePath)
  const reason = classifyFindingFailure(result)
  const outcomePath = `${evidencePath}.result.json`
  writeFileSync(
    join(root, outcomePath),
    `${JSON.stringify({ reason, timedOut: result.timedOut, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }, null, 2)}\n`,
  )
  return {
    survived: reason === 'assertion-failed',
    evidencePath,
    outcomePath,
    reason,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

// -- REVIEW.md -----------------------------------------------------------------

export function formatReviewEntry(
  finding: Finding,
  evidencePath: string,
  range: { from: string; to: string },
  model: string,
): string {
  const date = new Date().toISOString().slice(0, 10)
  const location = finding.line ? `${finding.file}:${finding.line}` : finding.file
  return [
    `## ${date} — ${finding.category} — ${location}`,
    ``,
    `**Diff revisado:** \`${range.from}..${range.to}\` · **Modelo:** \`${model}\` (verificado contra el rollout)`,
    ``,
    finding.summary,
    ``,
    `**Cómo falla:** ${finding.failure_scenario}`,
    ``,
    `**Prueba que lo demuestra (falla hoy contra el código real):** \`${evidencePath}\``,
    ``,
    `---`,
    ``,
  ].join('\n')
}

export function appendToReviewMd(root: string, entries: string[]): void {
  if (entries.length === 0) return
  const path = join(root, REVIEW_MD)
  const header = existsSync(path)
    ? ''
    : [
        '# REVIEW.md',
        '',
        '> Generado por `scripts/adversarial-review.ts` (H.10.2) — revisión adversarial',
        '> nocturna, de un modelo distinto al que implementó el diff. Nunca aplica nada,',
        '> igual que DREAMING.md. Cada entrada trae un test que falla contra el código',
        '> real en el momento de escribirse — si el test no falla, el hallazgo se',
        '> descarta antes de llegar acá.',
        '',
        '---',
        '',
        '',
      ].join('\n')
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
  writeFileSync(path, header + entries.join('') + existing)
}

// -- codex exec ------------------------------------------------------------------

export function buildReviewPrompt(diff: string, promptTemplate: string): string {
  return promptTemplate.replace('{{DIFF}}', diff)
}

export function buildCodexArgs(prompt: string, model: string): string[] {
  return [
    'exec',
    prompt,
    '--json',
    '--sandbox',
    'read-only',
    '--color',
    'never',
    '--ignore-user-config',
    '-m',
    model,
    '-c',
    'model_reasoning_effort=medium',
  ]
}

export type CodexRunner = (
  cwd: string,
  args: string[],
  timeoutMs: number,
) => Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }>

export const runCodexStreaming: CodexRunner = async (cwd, args, timeoutMs) => {
  const proc = Bun.spawn(['codex', ...args], {
    cwd,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    proc.kill('SIGTERM')
  }, timeoutMs)
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited
  clearTimeout(timer)
  return { stdout, stderr, exitCode, timedOut }
}

// -- orquestación ----------------------------------------------------------------

function log(message: string): void {
  console.log(`[adversarial-review] ${message}`)
}

export async function main(
  root = process.cwd(),
  run: RunCommand = runCommand,
  sessionsRoot = join(process.env.HOME ?? '', '.codex', 'sessions'),
  // Solo para el gate H.10.2 ("verificar el chequeo de modelo real con un
  // valor deliberadamente distinto"): codex sigue corriendo con REVIEWER_MODEL
  // de verdad; esto únicamente hace que la verificación posterior compare
  // contra otro id a propósito, para probar que el abort-sin-escribir funciona
  // sin gastar una segunda corrida real de codex con un modelo distinto.
  expectedModel = REVIEWER_MODEL,
  codexRunner: CodexRunner = runCodexStreaming,
): Promise<number> {
  const head = run(['git', 'rev-parse', 'HEAD'], root)
  if (head.exitCode !== 0) {
    log(`no se pudo resolver HEAD: ${head.stderr.trim()}`)
    return 1
  }
  const headSha = head.stdout.trim()
  const state = loadState(root)
  const range = resolveDiffRange(state, headSha, run, root)
  if (!range) {
    log('sin commits nuevos desde la última corrida — nada que revisar')
    return 0
  }

  let diff: string
  try {
    diff = getDiff(range, run, root)
  } catch (error) {
    log(
      `abortado: no se pudo obtener el diff — ${error instanceof Error ? error.message : String(error)}`,
    )
    return 1
  }
  if (!diff.trim()) {
    log(`diff vacío en ${range.from}..${range.to} — nada que revisar`)
    saveState(root, { lastReviewedSha: headSha })
    return 0
  }

  const promptTemplatePath = join(root, 'scripts', 'adversarial-review-prompt.md')
  const promptTemplate = readFileSync(promptTemplatePath, 'utf8')
  const prompt = buildReviewPrompt(diff, promptTemplate)

  const args = buildCodexArgs(prompt, REVIEWER_MODEL)
  let execution: { stdout: string; stderr: string; exitCode: number; timedOut: boolean }
  try {
    execution = await codexRunner(root, args, CODEX_TIMEOUT_MS)
  } catch (error) {
    log(
      `abortado: codex no pudo iniciar — ${error instanceof Error ? error.message : String(error)}`,
    )
    return 1
  }
  if (execution.timedOut || execution.exitCode !== 0) {
    log(
      `abortado: codex terminó ${execution.timedOut ? 'por timeout' : `con exit ${execution.exitCode}`} — el SHA no avanza`,
    )
    return 1
  }

  const threadId = extractThreadId(execution.stdout)
  const verification = verifyModelUsed(threadId, sessionsRoot, expectedModel)
  if (!verification.ok) {
    log(
      `abortado: no se pudo confirmar que corrió con ${REVIEWER_MODEL} ` +
        `(real: ${verification.actualModel ?? 'desconocido'}, motivo: ${verification.reason ?? 'mismatch'}) ` +
        `— no se escribe ningún hallazgo`,
    )
    return 1
  }

  const agentMessage = extractAgentMessage(execution.stdout)
  if (!agentMessage) {
    log('abortado: codex no devolvió un agent_message — el SHA no avanza')
    return 1
  }

  const findings = parseFindings(agentMessage)
  if (!findings) {
    log('abortado: hallazgos con JSON inválido o elementos malformados — el SHA no avanza')
    return 1
  }
  if (findings.length === 0) {
    log('sin hallazgos declarados por el modelo — REVIEW.md no cambia')
    saveState(root, { lastReviewedSha: headSha })
    return 0
  }

  const entries: string[] = []
  for (const finding of findings) {
    const result = await runFindingTest(root, finding)
    if (!result.survived || !result.evidencePath) {
      log(`descartado (${result.reason}): ${finding.summary}`)
      continue
    }
    log(`hallazgo confirmado: ${finding.summary}`)
    entries.push(
      formatReviewEntry(
        finding,
        result.evidencePath,
        range,
        verification.actualModel ?? REVIEWER_MODEL,
      ),
    )
  }

  appendToReviewMd(root, entries)
  saveState(root, { lastReviewedSha: headSha })
  log(`listo — ${entries.length}/${findings.length} hallazgo(s) sobrevivieron a su propio test`)
  return 0
}

if (import.meta.main) {
  main().then((code) => process.exit(code))
}
