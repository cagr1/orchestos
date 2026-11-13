import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { db } from '../db/sqlite.ts'
import { loadOrCreateDashboardToken, withPageToken } from './auth-token.ts'
import { startServer } from './server.ts'

const servers: ReturnType<typeof startServer>['server'][] = []
const roots: string[] = []
const originalHome = process.env.ORCHESTOS_HOME
const originalToken = process.env.ORCHESTOS_DASHBOARD_TOKEN

test('withPageToken injects a non-cacheable meta token into HTML and preserves JSON responses', async () => {
  const html = await withPageToken(
    new Response('<html><head><title>Dashboard</title></head></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '53' },
    }),
    'token/with unsafe chars',
  )
  expect(await html.text()).toContain(
    '<meta name="orchestos-token" content="tokenwithunsafechars" />',
  )
  expect(html.headers.get('cache-control')).toBe('no-store')
  expect(html.headers.has('content-length')).toBe(false)
  const json = Response.json({ ok: true })
  expect(await withPageToken(json, 'secret')).toBe(json)
})

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true)
  db.run("DELETE FROM projects WHERE id = 'aud7-terminal'")
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  if (originalHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = originalHome
  if (originalToken === undefined) delete process.env.ORCHESTOS_DASHBOARD_TOKEN
  else process.env.ORCHESTOS_DASHBOARD_TOKEN = originalToken
})

function start() {
  process.env.ORCHESTOS_DASHBOARD_TOKEN = 'aud7-test-dashboard-token'
  const result = startServer(0, ['sh', '-c', 'exit 0'])
  servers.push(result.server)
  return { ...result, headers: { 'x-orchestos-token': loadOrCreateDashboardToken() } }
}

test('API requires a valid token; query tokens only authorize terminal upgrades', async () => {
  const { url, headers } = start()
  for (const path of [
    '/api/projects',
    '/api/projects?t=aud7-test-dashboard-token',
    '/api/terminal?t=aud7-test-dashboard-token',
  ]) {
    const response = await fetch(`${url}${path}`)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'dashboard token required' })
  }
  expect(
    (await fetch(`${url}/api/projects`, { headers: { 'x-orchestos-token': 'wrong' } })).status,
  ).toBe(401)
  expect((await fetch(`${url}/api/projects`, { headers })).status).toBe(200)
  expect((await fetch(`${url}/`)).status).toBe(200)
})

test('Host and Origin protect API and static requests', async () => {
  const { url, headers, server } = start()
  for (const path of ['/', '/api/projects']) {
    const hostileHeaders: Record<string, string>[] = [
      { Host: `evil.com:${server.port}` },
      { Origin: 'https://evil.com' },
      { Origin: `https://localhost:${server.port}` },
      { Origin: `http://localhost:${server.port}/` },
    ]
    for (const extra of hostileHeaders) {
      expect((await fetch(`${url}${path}`, { headers: { ...headers, ...extra } })).status).toBe(403)
    }
    expect((await fetch(`${url}${path}`, { headers: { ...headers, Origin: url } })).status).toBe(
      200,
    )
  }
})

test('terminal upgrade requires a token and accepts query authentication', async () => {
  const { url } = start()
  const root = mkdtempSync(join(tmpdir(), 'aud7-terminal-'))
  roots.push(root)
  db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', [
    'aud7-terminal',
    root,
    '{}',
    '',
    new Date().toISOString(),
  ])
  const response = await fetch(`${url}/api/terminal`, {
    headers: {
      Origin: url,
      Upgrade: 'websocket',
      Connection: 'Upgrade',
      'Sec-WebSocket-Key': Buffer.alloc(16).toString('base64'),
      'Sec-WebSocket-Version': '13',
    },
  })
  expect(response.status).toBe(401)
  const TerminalWebSocket = WebSocket as unknown as {
    new (url: string, options: Bun.WebSocketOptions): WebSocket
  }
  await new Promise<void>((resolve, reject) => {
    const socket = new TerminalWebSocket(
      `${url.replace('http:', 'ws:')}/api/terminal?project=aud7-terminal&t=aud7-test-dashboard-token`,
      { headers: { Origin: url } },
    )
    socket.onopen = () => {
      socket.close()
      resolve()
    }
    socket.onerror = () => {
      socket.close()
      reject(new Error('Authenticated upgrade failed'))
    }
  })
})

test('token file has mode 600 and is reused across server restarts; env overrides it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aud7-token-'))
  roots.push(root)
  process.env.ORCHESTOS_HOME = root
  delete process.env.ORCHESTOS_DASHBOARD_TOKEN
  const first = startServer(0)
  servers.push(first.server)
  const path = join(root, '.orchestos', 'dashboard-token')
  const token = readFileSync(path, 'utf8')
  expect(token).toMatch(/^[a-f0-9]{64}$/)
  expect(statSync(path).mode & 0o777).toBe(0o600)
  first.server.stop(true)
  const second = startServer(0)
  servers.push(second.server)
  expect(loadOrCreateDashboardToken()).toBe(token)
  expect(
    (await fetch(`${second.url}/api/projects`, { headers: { 'x-orchestos-token': token } })).status,
  ).toBe(200)
  process.env.ORCHESTOS_DASHBOARD_TOKEN = 'explicit-token'
  expect(loadOrCreateDashboardToken()).toBe('explicit-token')
  expect(readFileSync(path, 'utf8')).toBe(token)
})
