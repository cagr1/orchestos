import { expect, test } from 'bun:test'
import { localPreviewUrl } from './local-url.ts'
import { previewDir } from './paths.ts'

test('only local http(s) Preview URLs are accepted', () => {
  for (const input of [
    'localhost:3000',
    'http://127.0.0.1:5173/x',
    'http://[::1]:8080',
    'http://app.localhost',
  ])
    expect(localPreviewUrl(input)).toBe(
      new URL(input.startsWith('http') ? input : `http://${input}`).href,
    )
  for (const input of [
    'https://example.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://localhost.evil.com',
    '',
    'http://localhost@evil.com',
    'http://[::2]',
  ])
    expect(localPreviewUrl(input)).toBeNull()
  for (const id of ['../x', 'a/b', 'a\\b', '']) expect(() => previewDir(id)).toThrow()
  expect(previewDir('project-1')).toEndWith('/previews/project-1')
})
