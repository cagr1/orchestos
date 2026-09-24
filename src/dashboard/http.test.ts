import { describe, expect, test } from 'bun:test'
import { serveStatic } from './http.ts'

describe('serveStatic', () => {
  test('does not cache the app shell or its bundle', async () => {
    expect(serveStatic('/').headers.get('cache-control')).toBe('no-cache')
    expect(serveStatic('/app/dist/main.js').headers.get('cache-control')).toBe('no-cache')
  })
})
