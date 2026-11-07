import { afterEach, expect, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiExplorerFile, handleApiExplorerWrite } from '../handlers/explorer.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'explorer-write-'))
  roots.push(root)
  writeFileSync(join(root, 'notes.txt'), 'original')
  return root
}
function save(root: string, body: unknown) {
  return handleApiExplorerWrite(
    new Request('http://localhost/api/explorer/file', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    root,
  )
}
const mtime = (root: string, path = 'notes.txt') => statSync(join(root, path)).mtimeMs
const read = (root: string, path = 'notes.txt') =>
  handleApiExplorerFile(
    new URL(`http://localhost/api/explorer/file?path=${encodeURIComponent(path)}`),
    root,
  ).json()

test('saves atomically, returns the new mtime, and keeps executable mode', async () => {
  const root = fixture()
  chmodSync(join(root, 'notes.txt'), 0o755)
  utimesSync(join(root, 'notes.txt'), 10, 10)
  const before = await read(root)
  const response = await save(root, {
    path: 'notes.txt',
    content: 'saved',
    expectedMtimeMs: before.mtimeMs,
  })
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body).toEqual({ path: 'notes.txt', mtimeMs: mtime(root) })
  expect(body.mtimeMs).not.toBe(before.mtimeMs)
  expect(readFileSync(join(root, 'notes.txt'), 'utf8')).toBe('saved')
  expect(statSync(join(root, 'notes.txt')).mode & 0o777).toBe(0o755)
  expect(readdirSync(root)).toEqual(['notes.txt'])
})

test('stale mtime returns the disk snapshot without overwriting it; retry can keep mine', async () => {
  const root = fixture()
  const old = mtime(root)
  writeFileSync(join(root, 'notes.txt'), 'external')
  utimesSync(join(root, 'notes.txt'), 20, 20)
  const response = await save(root, { path: 'notes.txt', content: 'mine', expectedMtimeMs: old })
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({
    error: 'conflict',
    content: 'external',
    mtimeMs: mtime(root),
  })
  expect(readFileSync(join(root, 'notes.txt'), 'utf8')).toBe('external')
  expect(
    (await save(root, { path: 'notes.txt', content: 'mine', expectedMtimeMs: mtime(root) })).status,
  ).toBe(200)
  expect(readFileSync(join(root, 'notes.txt'), 'utf8')).toBe('mine')
})

test('rejects invalid bodies and missing or non-finite expected mtimes', async () => {
  const root = fixture()
  for (const body of [
    null,
    [],
    'text',
    {},
    { path: '', content: '' },
    { path: 'notes.txt', content: 1, expectedMtimeMs: 1 },
    { path: 'notes.txt', content: '' },
    { path: 'notes.txt', content: '', expectedMtimeMs: '1' },
  ]) {
    expect((await save(root, body)).status).toBe(400)
  }
  expect(
    (
      await handleApiExplorerWrite(
        new Request('http://localhost', { method: 'PUT', body: '{' }),
        root,
      )
    ).status,
  ).toBe(400)
})

test('rejects traversal, git segments, and symlinks escaping the root', async () => {
  const root = fixture()
  const outside = fixture()
  mkdirSync(join(root, '.git'))
  writeFileSync(join(root, '.git', 'config'), 'git config')
  mkdirSync(join(root, 'nested'))
  mkdirSync(join(root, 'nested', '.git'))
  writeFileSync(join(root, 'nested', '.git', 'config'), 'nested git config')
  symlinkSync(join(outside, 'notes.txt'), join(root, 'escape.txt'))
  symlinkSync(outside, join(root, 'outside'))
  symlinkSync(join(root, '.git'), join(root, 'git-alias'))
  for (const path of [
    '../x',
    '.git/config',
    'nested/.git/config',
    'nested/../.git/config',
    'escape.txt',
    'outside/notes.txt',
    'git-alias/config',
  ]) {
    const response = await save(root, { path, content: 'bad', expectedMtimeMs: 0 })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid path' })
  }
  expect(readFileSync(join(outside, 'notes.txt'), 'utf8')).toBe('original')
  expect(readFileSync(join(root, '.git', 'config'), 'utf8')).toBe('git config')
})

test('only writes existing regular files', async () => {
  const root = fixture()
  expect((await save(root, { path: 'missing.txt', content: '', expectedMtimeMs: 0 })).status).toBe(
    404,
  )
  expect(existsSync(join(root, 'missing.txt'))).toBe(false)
  mkdirSync(join(root, 'dir'))
  expect((await save(root, { path: 'dir', content: '', expectedMtimeMs: 0 })).status).toBe(400)
})

test('writes through an internal symlink and preserves the symlink', async () => {
  const root = fixture()
  symlinkSync('notes.txt', join(root, 'link.txt'))
  const expectedMtimeMs = mtime(root)
  const response = await save(root, {
    path: 'link.txt',
    content: 'saved through link',
    expectedMtimeMs,
  })
  expect(response.status).toBe(200)
  expect(lstatSync(join(root, 'link.txt')).isSymbolicLink()).toBe(true)
  expect(readFileSync(join(root, 'notes.txt'), 'utf8')).toBe('saved through link')
})

test('checks UTF-8 byte size and refuses binary files; GET includes metadata for unavailable files', async () => {
  const root = fixture()
  expect(
    (
      await save(root, {
        path: 'notes.txt',
        content: 'é'.repeat(100_001),
        expectedMtimeMs: mtime(root),
      })
    ).status,
  ).toBe(413)
  writeFileSync(join(root, 'binary'), Buffer.from([65, 0, 66]))
  expect(
    (await save(root, { path: 'binary', content: 'text', expectedMtimeMs: mtime(root, 'binary') }))
      .status,
  ).toBe(400)
  expect(await read(root, 'binary')).toMatchObject({
    binary: true,
    content: '',
    mtimeMs: mtime(root, 'binary'),
    sizeBytes: 3,
  })
  writeFileSync(join(root, 'large'), 'x'.repeat(200_001))
  expect(await read(root, 'large')).toMatchObject({
    tooLarge: true,
    content: '',
    sizeBytes: 200_001,
    mtimeMs: mtime(root, 'large'),
  })
})
