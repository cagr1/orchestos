export default {
  testRunner: 'command',
  commandRunner: {
    command:
      'bun test src/__tests__/qa-core.test.ts src/__tests__/qa-judge.test.ts --timeout 30000',
  },
  mutate: ['src/run/qa.ts'],
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'json'],
  concurrency: 1,
  timeoutMS: 120000,
}
