import base from './stryker.run-executors.config.mjs'

export default {
  ...base,
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-executors-routing-c.config.mjs',
  },
  mutate: [
    'src/run/executors/cli-discovery.ts',
    'src/run/executors/cli-failure.ts',
    'src/run/executors/cli-health.ts',
    'src/run/executors/generic-cli.ts',
    'src/run/executors/task-prompt.ts',
    'src/run/executors/types.ts',
  ],
}
