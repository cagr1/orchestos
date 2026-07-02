/**
 * src/run/executors/agentic.ts — G.3
 *
 * Ejecutor agéntico: reusa runToolLoop()/callWithTools() (Mes 13,
 * src/providers/tool-call.ts) tal cual, sin reimplementar el loop de
 * tool-calling. Diseño completo: docs/executor-engine-design.md (G.1).
 *
 * 4 tools (read_file, write_file, list_dir, run_check). El gate del
 * contrato vive DENTRO de write_file — devuelve un string de error al
 * modelo (no una excepción) para que se autocorrija en la siguiente
 * iteración, en vez de descubrir la violación recién al final como hace
 * single-shot. write_file escribe a un buffer en memoria, NUNCA a disco —
 * enforceContract() en el harness sigue siendo el único punto que toca el
 * filesystem (defensa en profundidad, F4).
 *
 * Terminación del loop: maxIterations es una garantía de terminación
 * (anti-loop-infinito), NO un tope de gasto — OrchestOS no pone techos de
 * dinero (decisión Carlos 2026-07-02, ver docs/executor-engine-design.md §3).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { calcCost } from '../../router/pricing.ts'
import { normalizeRelPath } from '../contract.ts'
import { runChecks } from '../checks.ts'
import {
  runToolLoop, createToolRouter,
  type ToolDef, type ToolExecutor,
} from '../../providers/tool-call.ts'
import type { ExecutorEngine } from './types.ts'

// -- path safety (same anti-escape convention as F4: never resolve `..`, just refuse it) --

function isSafeRelPath(p: string): boolean {
  const normalized = normalizeRelPath(p)
  return !normalized.split('/').includes('..')
}

// -- tool definitions -----------------------------------------------------------

const READ_FILE_TOOL: ToolDef = {
  name: 'read_file',
  description: 'Reads the full text content of a file relative to the project root. Use to inspect existing code before editing it.',
  input_schema: {
    type: 'object',
    required: ['path'],
    properties: {
      path: { type: 'string', description: 'Path relative to the project root, e.g. "src/foo.ts"' },
    },
  },
}

const WRITE_FILE_TOOL: ToolDef = {
  name: 'write_file',
  description: 'Writes (replaces) the full content of a file. Only paths declared in the task output contract are allowed — if you write elsewhere the tool returns an error, fix the path and retry.',
  input_schema: {
    type: 'object',
    required: ['path', 'content'],
    properties: {
      path: { type: 'string', description: 'Path relative to the project root — must be one of the declared output files' },
      content: { type: 'string', description: 'Full file content — this replaces the entire file' },
    },
  },
}

const LIST_DIR_TOOL: ToolDef = {
  name: 'list_dir',
  description: 'Lists files and subdirectories inside a directory relative to the project root.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path relative to the project root — omit or use "." for the project root' },
    },
  },
}

const RUN_CHECK_TOOL: ToolDef = {
  name: 'run_check',
  description: 'Runs one of the deterministic checks already declared for this task and reports its exit code and output. Only checks declared in the task are allowed.',
  input_schema: {
    type: 'object',
    required: ['cmd'],
    properties: {
      cmd: { type: 'string', description: 'Exact command string of one of the declared checks' },
    },
  },
}

// -- engine -----------------------------------------------------------------------

export const agenticEngine: ExecutorEngine = {
  async run(ctx, opts) {
    const effectiveRoot = ctx.effectiveRoot
    const declaredOutputs = new Set(ctx.task.output.map(normalizeRelPath))
    const declaredInputs = ctx.task.input.length > 0
      ? new Set(ctx.task.input.map(normalizeRelPath))
      : null // null → no restriction, any file in the repo
    const declaredChecks = ctx.task.checks ?? []

    // In-memory write buffer — enforceContract() in the harness does the real
    // disk write afterwards. This is a *virtual* write for the model's own
    // read-back, not the point of truth.
    const buffer = new Map<string, string>()
    const log: string[] = []

    function readFile(relPath: string): string {
      if (!isSafeRelPath(relPath)) return `[Error: path '${relPath}' escapes the project root]`
      const normalized = normalizeRelPath(relPath)
      if (declaredInputs && !declaredInputs.has(normalized)) {
        return `[Error: '${normalized}' is not in the declared input files: ${[...declaredInputs].join(', ')}]`
      }
      if (buffer.has(normalized)) return buffer.get(normalized)!
      const full = join(effectiveRoot, normalized)
      if (!existsSync(full)) return `[Error: file not found: ${normalized}]`
      try {
        return readFileSync(full, 'utf-8')
      } catch (e: any) {
        return `[Error reading ${normalized}: ${e.message}]`
      }
    }

    function writeFile(relPath: string, content: string): string {
      if (!isSafeRelPath(relPath)) return `[Error: path '${relPath}' escapes the project root]`
      const normalized = normalizeRelPath(relPath)
      if (!declaredOutputs.has(normalized)) {
        return `[Error: '${normalized}' is not in the declared output contract: ${[...declaredOutputs].join(', ')}. Write only to declared output files.]`
      }
      buffer.set(normalized, content)
      log.push(`write_file: ${normalized} (${content.length} chars)`)
      return `OK: buffered ${normalized} (${content.length} chars) — will be written after all tool calls complete`
    }

    function listDir(relPath: string): string {
      const p = relPath?.trim() || '.'
      if (!isSafeRelPath(p)) return `[Error: path '${p}' escapes the project root]`
      const normalized = normalizeRelPath(p)
      const full = join(effectiveRoot, normalized)
      if (!existsSync(full) || !statSync(full).isDirectory()) {
        return `[Error: not a directory: ${normalized}]`
      }
      try {
        const entries = readdirSync(full, { withFileTypes: true })
        return entries.map(e => e.isDirectory() ? `${e.name}/` : e.name).join('\n') || '(empty directory)'
      } catch (e: any) {
        return `[Error listing ${normalized}: ${e.message}]`
      }
    }

    async function runCheck(cmd: string): Promise<string> {
      const check = declaredChecks.find(c => c.cmd === cmd)
      if (!check) {
        return `[Error: '${cmd}' is not a declared check for this task. Allowed: ${declaredChecks.map(c => c.cmd).join(', ') || '(none declared)'}]`
      }
      const results = await runChecks([check], effectiveRoot, ctx.opts.logger)
      const r = results[0]
      if (!r) return `[Error: check produced no result]`
      log.push(`run_check: ${cmd} → exit ${r.exitCode}${r.timedOut ? ' (timed out)' : ''}`)
      return `exit ${r.exitCode}${r.timedOut ? ' (TIMED OUT)' : ''}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`
    }

    const executeTool: ToolExecutor = createToolRouter({
      read_file:  async (_name, input) => readFile((input as { path: string }).path),
      write_file: async (_name, input) => { const i = input as { path: string; content: string }; return writeFile(i.path, i.content) },
      list_dir:   async (_name, input) => listDir((input as { path?: string }).path ?? '.'),
      run_check:  async (_name, input) => runCheck((input as { cmd: string }).cmd),
    })

    const toolInstructions = [
      '## TOOLS',
      `You have tools to explore and edit this project: read_file, list_dir, run_check, write_file.`,
      `You may ONLY write to these files: ${ctx.task.output.join(', ')}. write_file will return an error if you try any other path — fix it and retry.`,
      declaredChecks.length > 0
        ? `Declared checks you can run to verify your work: ${declaredChecks.map(c => c.cmd).join(', ')}.`
        : `No deterministic checks are declared for this task.`,
      `When all declared output files are written and correct, stop calling tools and reply with a short summary of what you did.`,
    ].join('\n')

    const system = [ctx.effectiveContext, ctx.constitutionBlock, ctx.skillInstructions, ctx.instinctBlock, toolInstructions]
      .filter(Boolean).join('\n\n')

    const loopResult = await runToolLoop(ctx.providerName, ctx.model, {
      system,
      messages: [{ role: 'user', content: ctx.prompt.userContent }],
      tools: [READ_FILE_TOOL, WRITE_FILE_TOOL, LIST_DIR_TOOL, RUN_CHECK_TOOL],
      executeTool,
      maxTurns: opts.maxIterations,
      // Fix del bug real encontrado en G.5: antes cada ronda tenía max_tokens=4096
      // hardcodeado en tool-call.ts, así que write_file truncaba el argumento
      // `content` en archivos grandes. opts.maxTokens ya es el presupuesto real
      // que el harness deriva de contextWindow−prompt (mismo cálculo que usa
      // single-shot desde F0.6) — se pasa tal cual, nunca un número inventado.
      maxTokens: opts.maxTokens,
    })

    if (loopResult.rounds >= opts.maxIterations && buffer.size < declaredOutputs.size) {
      log.push(`maxIterations reached (${opts.maxIterations}) with ${declaredOutputs.size - buffer.size} declared output(s) still unwritten`)
    }

    const usd = calcCost(ctx.model, loopResult.inputTokens, loopResult.outputTokens)
    const files = [...buffer.entries()].map(([path, content]) => ({ path, content }))

    return {
      files,
      inputTokens: loopResult.inputTokens,
      outputTokens: loopResult.outputTokens,
      usd,
      iterations: loopResult.rounds,
      // runToolLoop agrega tokens en un total único, no expone desglose por
      // ronda individual — reusarlo "tal cual" (decisión de G.1) implica esta
      // limitación honesta: una sola entrada agregada, no N entradas falsas.
      costByIteration: [{
        label: `agentic (${loopResult.rounds} round${loopResult.rounds === 1 ? '' : 's'})`,
        model: ctx.model,
        inputTokens: loopResult.inputTokens,
        outputTokens: loopResult.outputTokens,
        costUsd: usd,
      }],
      log,
    }
  },
}
