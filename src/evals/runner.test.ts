import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('eval runner dry-run', () => {
  test('persists isolated zero-cost trials and compares configurations without an LLM', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-eval-runner-test-'))
    try {
      const runCli = async (model: string, trials: number) => {
        const proc = Bun.spawn(
          [
            'bun',
            'run',
            'scripts/eval-run.ts',
            '--task',
            'failed-check-counting',
            '--trials',
            String(trials),
            '--model',
            model,
            '--engine',
            'single-shot',
            '--skill',
            'none',
            '--dry-run',
          ],
          {
            cwd: process.cwd(),
            // Reproduce GitHub Actions: ningún config global/sistema puede ocultar
            // la falta de identidad del repo temporal que crea el eval.
            env: {
              ...process.env,
              ORCHESTOS_HOME: home,
              GIT_CONFIG_NOSYSTEM: '1',
              GIT_CONFIG_GLOBAL: join(home, 'missing-global-gitconfig'),
            },
            stdout: 'pipe',
            stderr: 'pipe',
          },
        )
        const [exitCode, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ])
        expect(exitCode, stderr).toBe(0)
        return stdout
      }

      const first = await runCli('fixture/no-llm-a', 2)
      expect(first).toContain('pass^k=false · pass@k=false · 0/2 trials passed')
      const second = await runCli('fixture/no-llm-b', 1)
      expect(second).toContain('pass^k=false · pass@k=false · 0/1 trials passed')
      expect(second).toContain('previous baselines:')
      expect(second).toContain('fixture/no-llm-a')

      const database = new Database(join(home, '.orchestos', 'db.sqlite'))
      const trials = database
        .query<{ run_id: string; trial_index: number; config_json: string; passed: number }, []>(
          'SELECT run_id, trial_index, config_json, passed FROM eval_trials ORDER BY trial_index',
        )
        .all()
      const runs = database
        .query<{ id: string; usd_cost: number; input_tokens: number; output_tokens: number }, []>(
          'SELECT id, usd_cost, input_tokens, output_tokens FROM runs ORDER BY created_at',
        )
        .all()
      database.close()

      expect(trials).toHaveLength(3)
      expect(new Set(trials.map((trial) => trial.run_id)).size).toBe(3)
      expect(trials.map((trial) => trial.trial_index)).toEqual([1, 1, 2])
      expect(trials.every((trial) => trial.passed === 0)).toBe(true)
      expect(new Set(trials.map((trial) => JSON.parse(trial.config_json).model))).toEqual(
        new Set(['fixture/no-llm-a', 'fixture/no-llm-b']),
      )
      expect(runs).toHaveLength(3)
      expect(
        runs.every(
          (run) => run.usd_cost === 0 && run.input_tokens === 0 && run.output_tokens === 0,
        ),
      ).toBe(true)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  }, 30_000)
})
