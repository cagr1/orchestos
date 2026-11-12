import { afterEach, beforeEach, expect, test } from 'bun:test'
import { installDashboardToken, TOKEN_REQUIRED_EVENT } from './dashboard-token'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let values: Map<string, string>
let calls: Array<{ input: RequestInfo | URL; init?: RequestInit }>
let response: Response
let replaced: string

beforeEach(() => {
  values = new Map()
  calls = []
  response = new Response('{}')
  replaced = ''
  const location = new URL('http://localhost:4242/?view=dev#t=browser-token')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      location,
      history: {
        replaceState: (_data: unknown, _unused: string, url: string) => {
          replaced = url
        },
      },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
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

test('hash token is stored and removed from the URL', () => {
  installDashboardToken()
  expect(values.get('orchestos.dashboardToken')).toBe('browser-token')
  expect(replaced).toBe('/?view=dev')
})

test('pasting the token URL into an open tab reloads to pick it up', () => {
  let reloads = 0
  Object.assign(window.location, { hash: '' })
  Object.assign(window, { location: Object.assign(window.location, { reload: () => reloads++ }) })
  installDashboardToken()
  window.dispatchEvent(new Event('hashchange'))
  expect(reloads).toBe(0)
  window.location.hash = '#t=pasted-token'
  window.dispatchEvent(new Event('hashchange'))
  expect(reloads).toBe(1)
})

test('only same-origin API fetches receive the header, preserving Request and init headers', async () => {
  installDashboardToken()
  const wrapped = window.fetch
  installDashboardToken()
  expect(window.fetch).toBe(wrapped)
  await window.fetch('/api/projects', { headers: { Accept: 'application/json' } })
  await window.fetch(
    new Request('http://localhost:4242/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
  )
  await window.fetch(new URL('http://localhost:4242/api/health'))
  for (const call of calls)
    expect(new Headers(call.init?.headers).get('x-orchestos-token')).toBe('browser-token')
  expect(new Headers(calls[0]?.init?.headers).get('Accept')).toBe('application/json')
  expect(new Headers(calls[1]?.init?.headers).get('Content-Type')).toBe('application/json')
  calls.length = 0
  for (const url of [
    'http://localhost:4243/api/projects',
    'https://evil.com/api/projects',
    '/main.js',
    '/apiary',
  ])
    await window.fetch(url)
  for (const call of calls)
    expect(new Headers(call.init?.headers).has('x-orchestos-token')).toBe(false)
})

test('only the dashboard token error emits an event and response remains readable', async () => {
  installDashboardToken()
  let events = 0
  window.addEventListener(TOKEN_REQUIRED_EVENT, () => events++)
  response = Response.json({ error: 'other error' }, { status: 401 })
  await window.fetch('/api/projects')
  expect(events).toBe(0)
  response = Response.json({ error: 'dashboard token required' }, { status: 401 })
  const result = await window.fetch('/api/projects')
  expect(events).toBe(1)
  expect(await result.json()).toEqual({ error: 'dashboard token required' })
})
