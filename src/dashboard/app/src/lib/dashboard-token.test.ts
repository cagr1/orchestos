import { afterEach, beforeEach, expect, test } from 'bun:test'
import { installDashboardToken, readDashboardToken } from './dashboard-token'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let values: Map<string, string>
let sessionValues: Map<string, string>
let calls: Array<{ input: RequestInfo | URL; init?: RequestInit }>
let response: Response
let replaced: string
let reloads: number

beforeEach(() => {
  values = new Map([['orchestos.dashboardToken', 'old-token']])
  sessionValues = new Map()
  calls = []
  response = new Response('{}')
  replaced = ''
  reloads = 0
  const location = Object.assign(new URL('http://localhost:4242/?view=dev#t=browser-token'), {
    reload: () => reloads++,
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      location,
      document: { querySelector: (selector: string) => selector === 'meta[name="orchestos-token"]'
        ? { getAttribute: () => 'meta-token' } : null },
      history: {
        replaceState: (_data: unknown, _unused: string, url: string) => {
          replaced = url
          location.hash = new URL(url, location.origin).hash
        },
      },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      sessionStorage: {
        getItem: (key: string) => sessionValues.get(key) ?? null,
        setItem: (key: string, value: string) => sessionValues.set(key, value),
        removeItem: (key: string) => sessionValues.delete(key),
      },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ input, init })
        return response
      },
    }),
  })
})
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

test('reads the token from the meta tag', () => {
  expect(readDashboardToken()).toBe('meta-token')
})

test('hash token is removed without storing it and old local storage is cleared', () => {
  installDashboardToken()
  expect(replaced).toBe('/?view=dev')
  expect(values.has('orchestos.dashboardToken')).toBe(false)
  expect(values.has('browser-token')).toBe(false)
})

test('only same-origin API fetches receive the header, preserving Request and init headers', async () => {
  installDashboardToken()
  const wrapped = window.fetch
  installDashboardToken()
  expect(window.fetch).toBe(wrapped)
  await window.fetch('/api/projects', { headers: { Accept: 'application/json' } })
  await window.fetch(new Request('http://localhost:4242/api/tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }))
  await window.fetch(new URL('http://localhost:4242/api/health'))
  for (const call of calls)
    expect(new Headers(call.init?.headers).get('x-orchestos-token')).toBe('meta-token')
  expect(new Headers(calls[0]?.init?.headers).get('Accept')).toBe('application/json')
  expect(new Headers(calls[1]?.init?.headers).get('Content-Type')).toBe('application/json')
  calls.length = 0
  for (const url of ['http://localhost:4243/api/projects', 'https://evil.com/api/projects', '/main.js', '/apiary'])
    await window.fetch(url)
  for (const call of calls)
    expect(new Headers(call.init?.headers).has('x-orchestos-token')).toBe(false)
})

test('dashboard token 401 reloads once, another 401 does not reload, and success clears the guard', async () => {
  installDashboardToken()
  response = Response.json({ error: 'dashboard token required' }, { status: 401 })
  await window.fetch('/api/projects')
  await window.fetch('/api/projects')
  expect(reloads).toBe(1)
  response = Response.json({ error: 'other error' }, { status: 401 })
  await window.fetch('/api/projects')
  expect(reloads).toBe(1)
  response = Response.json({ ok: true })
  await window.fetch('/api/projects')
  expect(sessionValues.has('orchestos.tokenReload')).toBe(false)
})
