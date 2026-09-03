import { randomUUID } from 'node:crypto'
import { appendFileSync, cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrcheConfig } from '../config/load.ts'
import type { OrcheConfig } from '../config/schema.ts'
import {
  type EvalBatchRecord,
  type EvalTrialConfig,
  insertEvalTrial,
  listEvalBatches,
} from '../db/eval-trials.ts'
import { runMigrations } from '../db/migrate.ts'
import { insertRun } from '../db/runs.ts'
import { autoRoute } from '../router/auto-route.ts'
import { classifyTask } from '../router/classify.ts'
import { resolveAgentSelection } from '../router/engine-cascade.ts'
import { resolveModel } from '../router/models.ts'
import { type CheckResult, runChecks } from '../run/checks.ts'
import { runTask, type TaskResult } from '../run/harness.ts'
import { RunLogger } from '../run/logger.ts'
import { git } from '../run/sandbox.ts'
import type { CliEffort, TaskEngine } from '../tasks/schema.ts'
import { calculateEvalMetrics, type EvalMetrics } from './metrics.ts'
import { type EvalTask, loadEvalTask } from './schema.ts'

export interface EvalRunOverrides {
  model?: string
  engine?: TaskEngine
  skill?: string | null
  cliEffort?: CliEffort
}

export interface EvalTrialReport {
  trialIndex: number
  runId: string
  passed: boolean
  harnessStatus: TaskResult['status']
  checks: CheckResult[]
}

export interface EvalBatchReport {
  batchId: string
  evalTaskId: string
  config: EvalTrialConfig
  metrics: EvalMetrics
  trials: EvalTrialReport[]
  history: EvalBatchRecord[]
}

export interface RunEvalBatchOptions {
  evalsRoot: string
  taskId: string
  trials: number
  dryRun: boolean
  overrides?: EvalRunOverrides
}

export function resolveEvalConfiguration(
  task: EvalTask,
  config: OrcheConfig,
  configFound: boolean,
  overrides: EvalRunOverrides = {},
): { task: EvalTask; measured: EvalTrialConfig; modelOverride?: string; provider: string } {
  const measuredTask: EvalTask = {
    ...task,
    engine: overrides.engine ?? task.engine,
    skill: overrides.skill === undefined ? task.skill : (overrides.skill ?? undefined),
    cli_effort: overrides.cliEffort ?? task.cli_effort,
  }
  const route = autoRoute(measuredTask, config, configFound)
  const model = overrides.model ?? route?.model ?? resolveModel(classifyTask(task.description))
  const agentEngine = config.agent
    ? resolveAgentSelection(config.agent, { tier: 'api' }).engine
    : undefined
  const engine = measuredTask.engine ?? agentEngine ?? config.apiMode ?? 'single-shot'

  return {
    task: measuredTask,
    measured: {
      model,
      engine,
      skill: measuredTask.skill ?? null,
      cli_effort: measuredTask.cli_effort ?? null,
    },
    modelOverride: overrides.model,
    provider: route?.provider ?? measuredTask.executor,
  }
}

export async function runEvalBatch(options: RunEvalBatchOptions): Promise<EvalBatchReport> {
  if (!Number.isInteger(options.trials) || options.trials < 1) {
    throw new Error('--trials must be a positive integer')
  }
  runMigrations()

  const evalDirectory = findEvalDirectory(options.evalsRoot, options.taskId)
  const baseProject = join(evalDirectory, 'project')
  if (!existsSync(baseProject)) throw new Error(`missing eval base project: ${baseProject}`)

  const originalTask = loadEvalTask(join(evalDirectory, 'task.yaml'))
  const configFound = existsSync(join(baseProject, 'orchestos.config.yaml'))
  const config = loadOrcheConfig(baseProject)
  const resolved = resolveEvalConfiguration(originalTask, config, configFound, options.overrides)
  const batchId = randomUUID()
  const reports: EvalTrialReport[] = []

  for (let trialIndex = 1; trialIndex <= options.trials; trialIndex += 1) {
    reports.push(
      await runOneTrial({
        evalDirectory,
        task: resolved.task,
        config,
        configFound,
        measured: resolved.measured,
        modelOverride: resolved.modelOverride,
        provider: resolved.provider,
        batchId,
        trialIndex,
        dryRun: options.dryRun,
      }),
    )
  }

  return {
    batchId,
    evalTaskId: originalTask.id,
    config: resolved.measured,
    metrics: calculateEvalMetrics(reports.map((report) => report.passed)),
    trials: reports,
    history: listEvalBatches(originalTask.id),
  }
}

function findEvalDirectory(evalsRoot: string, taskId: string): string {
  if (!existsSync(evalsRoot)) throw new Error(`evals directory not found: ${evalsRoot}`)
  const match = readdirSync(evalsRoot, { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && entry.name === taskId,
  )
  if (!match) throw new Error(`eval task not found: ${taskId}`)
  return join(evalsRoot, match.name)
}

async function runOneTrial(input: {
  evalDirectory: string
  task: EvalTask
  config: OrcheConfig
  configFound: boolean
  measured: EvalTrialConfig
  modelOverride?: string
  provider: string
  batchId: string
  trialIndex: number
  dryRun: boolean
}): Promise<EvalTrialReport> {
  const tempRoot = mkdtempSync(join(tmpdir(), `orchestos-eval-${input.task.id}-`))
  const projectRoot = join(tempRoot, 'project')
  try {
    cpSync(join(input.evalDirectory, 'project'), projectRoot, { recursive: true })
    appendFileSync(join(projectRoot, '.gitignore'), '\nruns/\n.orchestos/\n', 'utf-8')
    const baseBranch = initializeGitRepository(projectRoot)
    const logger = new RunLogger(tempRoot, `${input.task.id}-${input.trialIndex}`)
    const result = await runTask({
      projectRoot,
      contextText: '',
      task: input.task,
      logger,
      dryRun: input.dryRun,
      modelOverride: input.modelOverride,
      orcheConfig: input.config,
      orcheConfigFound: input.configFound,
      sandboxMode: 'worktree',
      sandboxBranch: baseBranch,
    })

    const checks = await runChecks(input.task.checks, projectRoot, logger)
    const passed = checks.every((check, index) => {
      const expected = input.task.checks[index]?.expect_exit ?? 0
      return !check.timedOut && check.exitCode === expected
    })
    const runId =
      result.runId ||
      insertSyntheticRun(input.task, input.measured, input.provider, result, checks, input.dryRun)
    insertEvalTrial({
      runId,
      evalTaskId: input.task.id,
      trialIndex: input.trialIndex,
      batchId: input.batchId,
      config: input.measured,
      passed,
    })
    logger.done()
    return {
      trialIndex: input.trialIndex,
      runId,
      passed,
      harnessStatus: result.status,
      checks,
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

function initializeGitRepository(projectRoot: string): string {
  const commands = [
    ['init'],
    ['add', '-A'],
    [
      '-c',
      'user.name=OrchestOS eval fixture',
      '-c',
      'user.email=eval-fixture@invalid',
      'commit',
      '-m',
      'eval base fixture',
    ],
  ]
  for (const args of commands) {
    const result = git(args, projectRoot)
    if (result.exitCode !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr}`)
  }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot)
  if (branch.exitCode !== 0 || !branch.stdout) {
    throw new Error(`cannot resolve eval base branch: ${branch.stderr}`)
  }
  return branch.stdout
}

function insertSyntheticRun(
  task: EvalTask,
  measured: EvalTrialConfig,
  provider: string,
  result: TaskResult,
  checks: CheckResult[],
  dryRun: boolean,
): string {
  const status =
    result.status === 'done' ? 'done' : result.status === 'blocked' ? 'blocked' : 'failed'
  return insertRun({
    project_id: null,
    prompt: task.description,
    task_class: classifyTask(task.description),
    model: measured.model,
    provider,
    skill_id: measured.skill,
    task_id: task.id,
    allowed_outputs: JSON.stringify(task.output),
    files_attempted: JSON.stringify([]),
    files_authorized: JSON.stringify([]),
    files_blocked: JSON.stringify(result.filesBlocked),
    snapshot_before: null,
    snapshot_after: null,
    qa_verdict: result.qaVerdict ?? null,
    qa_reason: result.qaReason ?? null,
    checks_json: JSON.stringify(checks),
    status,
    input_tokens: result.cost.inputTokens,
    output_tokens: result.cost.outputTokens,
    usd_cost: result.cost.usd,
    elapsed_ms: result.elapsedMs,
    result: dryRun
      ? 'eval dry-run: prompt built without an LLM call'
      : (result.retryReason ?? status),
  })
}

export function formatEvalBatch(report: EvalBatchReport): string {
  const lines = [
    `eval ${report.evalTaskId} · batch ${report.batchId}`,
    `config ${JSON.stringify(report.config)}`,
    `pass^k=${report.metrics.passPowerK} · pass@k=${report.metrics.passAtK} · ${report.metrics.passedTrials}/${report.metrics.trials} trials passed`,
  ]
  for (const trial of report.trials) {
    lines.push(
      `  trial ${trial.trialIndex}: ${trial.passed ? 'pass' : 'fail'} · harness=${trial.harnessStatus} · run=${trial.runId}`,
    )
  }
  const previous = report.history.filter((batch) => batch.batch_id !== report.batchId)
  if (previous.length > 0) {
    lines.push('previous baselines:')
    for (const batch of previous) {
      const metrics = calculateEvalMetrics([
        ...Array.from({ length: batch.passed_trials }, () => true),
        ...Array.from({ length: batch.trials - batch.passed_trials }, () => false),
      ])
      lines.push(
        `  ${batch.batch_id} · ${batch.config_json} · pass^k=${metrics.passPowerK} · pass@k=${metrics.passAtK} · ${metrics.passedTrials}/${metrics.trials}`,
      )
    }
  }
  return lines.join('\n')
}
