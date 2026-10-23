import base from './stryker.run-executors.config.mjs'

export default {
  ...base,
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-executors-engines.config.mjs',
  },
  mutate: [
    'src/run/executors/agentic.ts',
    'src/run/executors/claude-approval.ts',
    'src/run/executors/opencode*.ts',
    'src/run/executors/single-shot.ts',
    'src/run/executors/spawn-trace.ts',
    'src/run/executors/worktree-diff.ts',
  ],
}
