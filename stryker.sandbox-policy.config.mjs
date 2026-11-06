export default {
  testRunner: 'command',
  commandRunner: {
    command: 'bun test src/__tests__/sandbox-policy.test.ts --timeout 30000',
  },
  mutate: ['src/run/sandbox-policy.ts'],
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'json'],
  concurrency: 1,
  timeoutMS: 120000,
}
