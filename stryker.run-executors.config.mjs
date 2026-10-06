export default {
  testRunner: 'command',
  commandRunner: {
    command: 'bun run scripts/mutation-test-shard.ts stryker.run-executors.config.mjs',
  },
  mutate: ['src/run/executors/**/*.ts'],
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'json'],
  concurrency: 1,
  timeoutMS: 120000,
}
