import base from './stryker.run-executors-codex.config.mjs'

export default {
  ...base,
  commandRunner: {
    command:
      'bun run scripts/mutation-test-shard.ts stryker.run-executors-codex-engines-b.config.mjs',
  },
  mutate: ['src/run/executors/external.ts'],
}
