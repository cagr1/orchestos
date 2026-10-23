import base from './stryker.run-executors-codex.config.mjs'

export default {
  ...base,
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-executors-codex-server.config.mjs',
  },
  mutate: ['src/run/executors/codex-app-server.ts', 'src/run/executors/codex-approval.ts'],
}
