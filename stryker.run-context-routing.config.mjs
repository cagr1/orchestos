export default {
  testRunner: 'command',
  commandRunner: {
    command: 'bun test src/__tests__ --timeout 30000',
  },
  mutate: [
    'src/run/e2e-smoke.ts',
    'src/run/e2e-smoke-agents.ts',
    'src/run/logger.ts',
    'src/run/prompt.ts',
    'src/run/qa.ts',
    'src/run/middlewares/**/*.ts',
  ],
  coverageAnalysis: 'off',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'json'],
  concurrency: 1,
  timeoutMS: 120000,
};
