export default {
  testRunner: 'command',
  commandRunner: {
    command: 'bun test src/__tests__ --timeout 30000',
  },
  mutate: [
    'src/run/contract.ts',
    'src/run/graph-runner.ts',
    'src/run/graph-summary.ts',
    'src/run/harness.ts',
    'src/run/middleware.ts',
    'src/run/scheduler.ts',
  ],
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'json'],
  concurrency: 1,
  timeoutMS: 120000,
};
