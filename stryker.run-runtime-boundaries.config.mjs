export default {
  testRunner: 'command',
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-runtime-boundaries.config.mjs',
  },
  mutate: [
    'src/run/checks.ts',
    'src/run/git-lock.ts',
    'src/run/html-script-check.ts',
    'src/run/sandbox.ts',
    'src/run/sandbox-policy.ts',
    'src/run/tool-output-cap.ts',
    'src/run/transcript-parser.ts',
  ],
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'json'],
  concurrency: 1,
  timeoutMS: 120000,
}
