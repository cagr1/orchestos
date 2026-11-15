import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveDashboardPaths } from '../cli-dashboard-paths.ts'

describe('resolveDashboardPaths', () => {
  test('resolves the bundle and build cwd from the CLI module, not process.cwd()', () => {
    // La URL sale del módulo real (en Windows lleva unidad); se compara contra pathToFileURL del SO.
    const cli = pathToFileURL(join(tmpdir(), 'orchestos', 'src', 'cli.ts')).href
    const root = join(tmpdir(), 'orchestos')
    expect(resolveDashboardPaths(cli)).toEqual({
      packageRoot: `${root}${sep}`,
      uiBundle: join(root, 'src', 'dashboard', 'app', 'dist', 'main.js'),
    })
  })
})
