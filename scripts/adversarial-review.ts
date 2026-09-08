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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const REVIEWER_MODEL = 'gpt-5.6-sol'
export const STATE_PATH = '.orchestos/adversarial-review-state.json'
export const REVIEW_MD = 'REVIEW.md'
export const EVIDENCE_DIR = 'review-evidence'
const CODEX_TIMEOUT_MS = 20 * 60 * 1000

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

export function getDiff(range: { from: string; to: string }, run: RunCommand, root: string): string {
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
  if (!actualModel) return { ok: false, actualModel: null, reason: 'rollout sin turn_context.model' }
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

/** Tolerante a texto alrededor de la cerca ```json — nunca lanza, devuelve null si no hay array parseable. */
export function parseFindings(agentMessage: string): Finding[] | null {
  const fenced = agentMessage.match(/```json\s*([\s\S]*?)```/i)
  const raw = fenced?.[1] ?? agentMessage
  try {
    const parsed = JSON.parse(raw.trim())
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (f): f is Finding =>
        f &&
        typeof f.file === 'string' &&
        typeof f.category === 'string' &&
        typeof f.summary === 'string' &&
        typeof f.failure_scenario === 'string' &&
        typeof f.test_path === 'string' &&
        typeof f.test_code === 'string',
    )
  } catch {
    return null
  }
}

/**
 * Escribe test_code bajo review-evidence/ y lo corre con `bun test <path>`
 * explícito (bypassa el glob de descubrimiento — ver nota de extensión
 * .check.ts en package.json/docs). Sobrevive SOLO si el proceso termina con
 * código distinto de 0 (el test falló contra el código real, hoy). Un
 * hallazgo cuyo test pasa se descarta: no demuestra nada.
 */
export function runFindingTest(
  root: string,
  finding: Finding,
  run: RunCommand,
): { survived: boolean; evidencePath: string } {
  const safeName = finding.test_path.replace(/[^a-zA-Z0-9_.\/-]/g, '_')
  const evidencePath = join(EVIDENCE_DIR, safeName.endsWith('.check.ts') ? safeName : `${safeName}.check.ts`)
  const fullPath = join(root, evidencePath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, finding.test_code)
  const result = run(['bun', 'test', evidencePath], root)
  return { survived: result.exitCode !== 0, evidencePath }
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

async function runCodexStreaming(cwd: string, args: string[], timeoutMs: number): Promise<string> {
  const proc = Bun.spawn(['codex', ...args], { cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const timer = setTimeout(() => proc.kill('SIGTERM'), timeoutMs)
  const stdout = await new Response(proc.stdout).text()
  await proc.exited
  clearTimeout(timer)
  return stdout
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

  const diff = getDiff(range, run, root)
  if (!diff.trim()) {
    log(`diff vacío en ${range.from}..${range.to} — nada que revisar`)
    saveState(root, { lastReviewedSha: headSha })
    return 0
  }

  const promptTemplatePath = join(root, 'scripts', 'adversarial-review-prompt.md')
  const promptTemplate = readFileSync(promptTemplatePath, 'utf8')
  const prompt = buildReviewPrompt(diff, promptTemplate)

  const args = buildCodexArgs(prompt, REVIEWER_MODEL)
  const stdout = await runCodexStreaming(root, args, CODEX_TIMEOUT_MS)

  const threadId = extractThreadId(stdout)
  const verification = verifyModelUsed(threadId, sessionsRoot, expectedModel)
  if (!verification.ok) {
    log(
      `abortado: no se pudo confirmar que corrió con ${REVIEWER_MODEL} ` +
        `(real: ${verification.actualModel ?? 'desconocido'}, motivo: ${verification.reason ?? 'mismatch'}) ` +
        `— no se escribe ningún hallazgo`,
    )
    return 1
  }

  const agentMessage = extractAgentMessage(stdout)
  if (!agentMessage) {
    log('codex no devolvió un agent_message — sin hallazgos que evaluar')
    saveState(root, { lastReviewedSha: headSha })
    return 0
  }

  const findings = parseFindings(agentMessage)
  if (!findings || findings.length === 0) {
    log('sin hallazgos declarados por el modelo (o formato no parseable) — REVIEW.md no cambia')
    saveState(root, { lastReviewedSha: headSha })
    return 0
  }

  const entries: string[] = []
  for (const finding of findings) {
    const { survived, evidencePath } = runFindingTest(root, finding, run)
    if (!survived) {
      log(`descartado (el test no falló): ${finding.summary}`)
      rmSync(join(root, evidencePath), { force: true })
      continue
    }
    log(`hallazgo confirmado: ${finding.summary}`)
    entries.push(formatReviewEntry(finding, evidencePath, range, verification.actualModel ?? REVIEWER_MODEL))
  }

  appendToReviewMd(root, entries)
  saveState(root, { lastReviewedSha: headSha })
  log(`listo — ${entries.length}/${findings.length} hallazgo(s) sobrevivieron a su propio test`)
  return 0
}

if (import.meta.main) {
  main().then((code) => process.exit(code))
}
