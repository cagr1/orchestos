import { spawn } from 'node:child_process'
import type { CustomCliConfig } from '../../config/schema.ts'
import { safeChildEnv } from '../path-policy.ts'
import { buildCliTaskPrompt } from './task-prompt.ts'
import type { ExecutorEngine } from './types.ts'
import { readWorktreeDiff } from './worktree-diff.ts'

/** A configured executable is trusted global input; arguments never pass through a shell. */
export function genericCliEngine(cli: CustomCliConfig): ExecutorEngine {
  return {
    async run(ctx, opts) {
      if (!ctx.worktree)
        throw new Error(
          `${cli.id} engine requires worktree sandbox mode — refusing to run an uncontrolled external process against the real project directory`,
        )
      const prompt = buildCliTaskPrompt(ctx)
      const templates = [
        ...cli.args,
        ...(ctx.model && ctx.model !== 'default'
          ? (cli.modelArgs ?? []).map((arg) => arg.replaceAll('{model}', ctx.model))
          : []),
      ]
      const promptInArgs = templates.some((arg) => arg.includes('{prompt}'))
      const args = templates.map((arg) => arg.replaceAll('{prompt}', prompt))
      const display = templates.map((arg) => arg.replaceAll('{prompt}', '<contract>'))
      const timeoutMs = cli.timeoutMs ?? opts.timeoutMs ?? 20 * 60 * 1000
      const stdout = await new Promise<string>((resolve, reject) => {
        const proc = spawn(cli.command, args, {
          cwd: ctx.effectiveRoot,
          env: safeChildEnv(),
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        })
        let out = ''
        let err = ''
        let timedOut = false
        const timer = setTimeout(() => {
          timedOut = true
          proc.kill('SIGKILL')
        }, timeoutMs)
        proc.stdout.on('data', (chunk) => {
          out += chunk.toString()
        })
        proc.stderr.on('data', (chunk) => {
          err += chunk.toString()
        })
        // A process may exit without reading stdin (including when its arguments carry the prompt).
        proc.stdin.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code !== 'EPIPE') reject(error)
        })
        proc.on('error', (error) => {
          clearTimeout(timer)
          reject(new Error(`failed to spawn ${cli.id}: ${error.message}`))
        })
        proc.on('close', (code) => {
          clearTimeout(timer)
          if (timedOut) reject(new Error(`${cli.id} timed out after ${timeoutMs}ms`))
          else if (code !== 0)
            reject(new Error(`${cli.id} failed (exit ${code}): ${(out + err).trim().slice(-600)}`))
          else resolve(out)
        })
        proc.stdin.end(promptInArgs ? undefined : prompt)
      })
      const files = readWorktreeDiff(ctx.effectiveRoot, ctx.task.output)
      return {
        files,
        finalText: stdout.trim(),
        iterations: 1,
        // Numeric storage is legacy; source=unknown is the durable measurement mark.
        inputTokens: 0,
        outputTokens: 0,
        usd: 0,
        costByIteration: [
          {
            label: `cli:${cli.id}`,
            model: ctx.model,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            source: 'unknown',
            binary: cli.command,
            args: display,
          },
        ],
        log: [
          `${cli.command} ${display.join(' ')}${promptInArgs ? '' : ' < <contract>'}`,
          `${files.length} file(s) changed in worktree; tokens and cost unknown`,
        ],
      }
    },
  }
}
