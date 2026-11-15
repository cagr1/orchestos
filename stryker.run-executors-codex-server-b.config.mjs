import base from './stryker.run-executors-codex.config.mjs'

export default {
  ...base,
  commandRunner: {
    command:
      'bun run scripts/mutation-test-shard.ts stryker.run-executors-codex-server-b.config.mjs',
  },
  // Corte medido: ningún mutante ejecutable cruza la línea (CI.46, MUT.1).
  mutate: ['src/run/executors/codex-app-server.ts:346-492'],
}
