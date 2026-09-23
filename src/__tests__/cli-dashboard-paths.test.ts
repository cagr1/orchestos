import { describe, expect, test } from 'bun:test'
import { resolveDashboardPaths } from '../cli-dashboard-paths.ts'

describe('resolveDashboardPaths', () => {
  test('resolves the bundle and build cwd from the CLI module, not process.cwd()', () => {
    expect(resolveDashboardPaths('file:///opt/orchestos/src/cli.ts')).toEqual({
      packageRoot: '/opt/orchestos/',
      uiBundle: '/opt/orchestos/src/dashboard/app/dist/main.js',
    })
  })
})
