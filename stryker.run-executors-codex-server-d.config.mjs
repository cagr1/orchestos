import base from './stryker.run-executors-codex.config.mjs'

export default {
  ...base,
  commandRunner: {
    command:
      'bun run scripts/mutation-test-shard.ts stryker.run-executors-codex-server-d.config.mjs',
  },
  // Corte dentro de turn(): solo lo cruzan 2 BlockStatement que son CompileError (CI.46, MUT.1).
  mutate: ['src/run/executors/codex-app-server.ts:646-882'],
}
