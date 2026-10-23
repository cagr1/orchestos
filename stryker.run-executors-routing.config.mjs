import base from './stryker.run-executors.config.mjs'
import engines from './stryker.run-executors-engines.config.mjs'

export default {
  ...base,
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-executors-routing.config.mjs',
  },
  mutate: [...base.mutate, ...engines.mutate.map((pattern) => `!${pattern}`)],
}
