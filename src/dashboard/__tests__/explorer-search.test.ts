import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiExplorerSearch } from '../handlers/explorer.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aud25-search-'))
  roots.push(root)
  writeFileSync(join(root, 'match.txt'), 'needle')
  return root
}
const url = (q: string) =>
  new URL(`http://localhost/api/explorer/search?q=${encodeURIComponent(q)}`)
test('content search passes literal query and resolved project root, returning matching files', async () => {
  const root = fixture()
  const response = await handleApiExplorerSearch(url('-needle'), root, async (cwd, q) => {
    expect(cwd).toBe(root)
    expect(q).toBe('-needle')
    return ['match.txt']
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ paths: ['match.txt'] })
})
test('content search returns no matches and rejects short queries before spawning', async () => {
  const root = fixture()
  expect(await (await handleApiExplorerSearch(url('absent'), root, async () => [])).json()).toEqual(
    { paths: [] },
  )
  for (const query of ['', 'x', ' x ']) {
    const response = await handleApiExplorerSearch(url(query), root, async () => {
      throw new Error('must not invoke git')
    })
    expect(response.status).toBe(400)
  }
})
test('search never returns traversal or symlinks outside the resolved project and caps results', async () => {
  const root = fixture()
  const other = fixture()
  symlinkSync(join(other, 'match.txt'), join(root, 'link.txt'))
  const response = await handleApiExplorerSearch(url('needle'), root, async () => [
    '../outside',
    join(other, 'match.txt'),
    'link.txt',
    '.',
    ...Array(205).fill('match.txt'),
  ])
  const { paths } = await response.json()
  expect(paths).toHaveLength(200)
  expect(paths.every((path: string) => path === 'match.txt')).toBe(true)
})
test('search subprocess failure is explicit', async () => {
  const response = await handleApiExplorerSearch(url('needle'), fixture(), async () => {
    throw new Error('git unavailable')
  })
  expect(response.status).toBe(500)
})
