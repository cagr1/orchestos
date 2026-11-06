import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type ExplorerIgnoreProbe, handleApiExplorerTree } from '../handlers/explorer.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'explorer-ignored-'))
  roots.push(root)
  mkdirSync(join(root, 'runs'))
  writeFileSync(join(root, 'runs', 'output.txt'), 'output')
  writeFileSync(join(root, 'tracked.txt'), 'source')
  writeFileSync(join(root, 'ignored\nfile.txt'), 'ignored')
  return root
}

test('lists ignored files and folders with one root-scoped probe per level', async () => {
  const root = fixture()
  const calls: string[][] = []
  const probe: ExplorerIgnoreProbe = (cwd, paths) => {
    expect(cwd).toBe(root)
    calls.push(paths)
    return (
      paths.filter((path) => path.startsWith('runs') || path.startsWith('ignored')).join('\0') +
      '\0'
    )
  }
  const body = await handleApiExplorerTree(
    new URL('http://localhost/api/explorer/tree'),
    root,
    probe,
  ).json()
  expect(
    body.entries.map(({ path, ignored }: { path: string; ignored: boolean }) => [path, ignored]),
  ).toEqual([
    ['runs', true],
    ['ignored\nfile.txt', true],
    ['tracked.txt', false],
  ])
  expect(calls).toHaveLength(1)
  expect(calls[0]).toEqual(['runs', 'ignored\nfile.txt', 'tracked.txt'])
  const children = await handleApiExplorerTree(
    new URL('http://localhost/api/explorer/tree?path=runs'),
    root,
    probe,
  ).json()
  expect(children.entries[0]).toMatchObject({ path: 'runs/output.txt', ignored: true })
  expect(calls).toHaveLength(2)
  expect(calls[1]).toEqual(['runs/output.txt'])
})

test('without git, failed git, or no ignored paths, every entry stays visible and unmarked', async () => {
  const root = fixture()
  for (const probe of [
    () => null,
    () => '',
    () => {
      throw new Error('git unavailable')
    },
  ]) {
    const body = await handleApiExplorerTree(
      new URL('http://localhost/api/explorer/tree'),
      root,
      probe,
    ).json()
    expect(body.entries).toHaveLength(3)
    expect(body.entries.every((entry: { ignored: boolean }) => entry.ignored === false)).toBe(true)
  }
})
