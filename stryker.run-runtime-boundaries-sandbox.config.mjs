import base from './stryker.run-runtime-boundaries.config.mjs'

export default {
  ...base,
  commandRunner: {
    command:
      'bun run scripts/mutation-test-shard.ts stryker.run-runtime-boundaries-sandbox.config.mjs',
  },
  mutate: ['src/run/sandbox.ts', 'src/run/html-script-check.ts'],
}
