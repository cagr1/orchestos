import { expect, test } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Manifest } from '../src/dashboard/app/src/lib/file-icons'

test('app build ships only referenced file icons and the license', async () => {
  const root = join(import.meta.dir, '..')
  const result = Bun.spawnSync(['bun', 'run', 'build:app'], { cwd: root })
  expect(result.exitCode).toBe(0)
  const dir = join(root, 'src/dashboard/app/dist/file-icons')
  const manifest: Manifest = await Bun.file(join(dir, 'manifest.json')).json()
  expect(Object.keys(manifest).sort()).toEqual([
    'file',
    'fileExtensions',
    'fileNames',
    'folder',
    'folderExpanded',
    'folderNames',
    'folderNamesExpanded',
  ])
  const referenced = new Set([
    manifest.file,
    manifest.folder,
    manifest.folderExpanded,
    ...Object.values(manifest.fileExtensions),
    ...Object.values(manifest.fileNames),
    ...Object.values(manifest.folderNames),
    ...Object.values(manifest.folderNamesExpanded),
  ])
  expect(referenced.size).toBeGreaterThan(0)
  for (const icon of referenced) {
    expect(icon.endsWith('.svg')).toBe(true)
    expect(existsSync(join(dir, icon))).toBe(true)
  }
  expect(
    readdirSync(dir)
      .filter((name) => name.endsWith('.svg'))
      .sort(),
  ).toEqual([...referenced].sort())
  expect(await Bun.file(join(dir, 'LICENSE')).text()).toBe(
    await Bun.file(join(root, 'node_modules/material-icon-theme/LICENSE')).text(),
  )
}, 30_000)
