import base from './stryker.run-executors-codex.config.mjs'

export default {
  ...base,
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-executors-codex-server.config.mjs',
  },
  // Cortar solo entre métodos: un mutante que cruza el corte se pierde (CI.46).
  mutate: ['src/run/executors/codex-app-server.ts:1-345', 'src/run/executors/codex-approval.ts'],
}
