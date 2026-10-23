import base from './stryker.run-executors-codex.config.mjs'
import server from './stryker.run-executors-codex-server.config.mjs'

export default {
  ...base,
  commandRunner: {
    command:
      'bun run scripts/mutation-test-shard.ts stryker.run-executors-codex-engines.config.mjs',
  },
  mutate: [...base.mutate, ...server.mutate.map((pattern) => `!${pattern}`)],
}
