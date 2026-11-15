import base from './stryker.run-executors-codex.config.mjs'
import server from './stryker.run-executors-codex-server.config.mjs'

export default {
  ...base,
  commandRunner: {
    command:
      'bun run scripts/mutation-test-shard.ts stryker.run-executors-codex-engines.config.mjs',
  },
  // external.ts va en executors-codex-engines-b (MUT.1: el shard junto pasaba de 3 h).
  mutate: [
    ...base.mutate,
    ...server.mutate.map((pattern) => `!${pattern.replace(/:\d+-\d+$/, '')}`),
    '!src/run/executors/external.ts',
  ],
}
