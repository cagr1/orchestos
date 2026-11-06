export default {
  testRunner: 'command',
  commandRunner: {
    command: 'bun test src/__tests__/graph-runner.test.ts --timeout 30000',
  },
  mutate: ['src/run/graph-runner.ts'],
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'json'],
  concurrency: 1,
  timeoutMS: 120000,
}
