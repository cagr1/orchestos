import base from './stryker.run-runtime-boundaries.config.mjs'

export default {
  ...base,
  commandRunner: {
    command:
      'bun run scripts/mutation-test-shard.ts stryker.run-runtime-boundaries-checks.config.mjs',
  },
  mutate: [
    'src/run/checks.ts',
    'src/run/git-lock.ts',
    'src/run/sandbox-policy.ts',
    'src/run/tool-output-cap.ts',
    'src/run/transcript-parser.ts',
  ],
}
