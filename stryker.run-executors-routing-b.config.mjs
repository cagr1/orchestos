import base from './stryker.run-executors.config.mjs'

export default {
  ...base,
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-executors-routing-b.config.mjs',
  },
  mutate: [
    'src/run/executors/step-event.ts',
    'src/run/executors/chat-adapters.ts',
    'src/run/executors/task-engines.ts',
  ],
}
