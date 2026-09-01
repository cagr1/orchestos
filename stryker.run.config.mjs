export default {
  testRunner: 'command',
  commandRunner: {
    command: 'bun test src/__tests__ --timeout 30000',
  },
  mutate: ['src/run/**/*.ts'],
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'json'],
  concurrency: 1,
  timeoutMS: 120000,
}
