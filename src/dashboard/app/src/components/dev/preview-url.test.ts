import { describe, expect, test } from 'bun:test'
import { normalizePreviewUrl, previewUrlKey } from './preview-url'

describe('preview URLs', () => {
  test('normalizes bare hosts and preserves http and https URLs', () => {
    expect(normalizePreviewUrl('localhost:3000')).toBe('http://localhost:3000/')
    expect(normalizePreviewUrl('  localhost:3000  ')).toBe('http://localhost:3000/')
    expect(normalizePreviewUrl('https://x.dev')).toBe('https://x.dev/')
    expect(normalizePreviewUrl('http://localhost:3000/path?q=1')).toBe(
      'http://localhost:3000/path?q=1',
    )
  })

  test('rejects empty, invalid and non-http URLs', () => {
    for (const input of [
      '',
      '  ',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'ftp://x.dev',
      'http://',
      'bad host',
    ]) {
      expect(normalizePreviewUrl(input)).toBeNull()
    }
  })

  test('keys the saved URL by project', () => {
    expect(previewUrlKey('project-a')).toBe('orchestos-preview-url:project-a')
    expect(previewUrlKey('project-b')).not.toBe(previewUrlKey('project-a'))
  })
})
