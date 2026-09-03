#!/usr/bin/env bun
import { resolve } from 'node:path'
import { Command, InvalidArgumentError } from 'commander'
import { formatEvalBatch, runEvalBatch } from '../src/evals/runner.ts'
import { CLI_EFFORT_LEVELS } from '../src/tasks/schema.ts'
import type { CliEffort, TaskEngine } from '../src/tasks/schema.ts'

const ENGINES: TaskEngine[] = ['single-shot', 'agentic', 'external', 'opencode', 'codex']
const CLI_EFFORTS = CLI_EFFORT_LEVELS.external

function positiveInteger(value: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError('must be a positive integer')
  }
  return parsed
}

function allowed<T extends string>(values: readonly T[]): (value: string) => T {
  return (value) => {
    if (!values.includes(value as T)) {
      throw new InvalidArgumentError(`must be one of: ${values.join(', ')}`)
    }
    return value as T
  }
}

if (import.meta.main) {
  const program = new Command()
    .name('eval-run')
    .requiredOption('--task <id>', 'eval task id')
    .requiredOption('--trials <k>', 'number of isolated trials', positiveInteger)
    .option('--model <id>', 'model override')
    .option('--engine <engine>', 'engine override', allowed(ENGINES))
    .option('--skill <id>', 'skill override; use "none" to disable the task skill')
    .option('--cli-effort <level>', 'Claude CLI effort override', allowed(CLI_EFFORTS))
    .option(
      '--dry-run',
      'build prompts and persist zero-cost trial evidence without calling an LLM',
    )
    .parse()

  const options = program.opts<{
    task: string
    trials: number
    model?: string
    engine?: TaskEngine
    skill?: string
    cliEffort?: CliEffort
    dryRun?: boolean
  }>()

  try {
    if (!options.dryRun) {
      console.warn('[eval] paid execution enabled: every trial may call the configured model')
    }
    const report = await runEvalBatch({
      evalsRoot: resolve(process.cwd(), 'evals'),
      taskId: options.task,
      trials: options.trials,
      dryRun: options.dryRun === true,
      overrides: {
        model: options.model,
        engine: options.engine,
        skill: options.skill === 'none' ? null : options.skill,
        cliEffort: options.cliEffort,
      },
    })
    console.log(formatEvalBatch(report))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
