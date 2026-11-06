import base from './stryker.run-executors.config.mjs'

export default {
  ...base,
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-executors-engines-b.config.mjs',
  },
  mutate: ['src/run/executors/opencode*.ts'],
}
