import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { orchestosDir } from '../config/orchestos-home.ts'

export function loadOrCreateDashboardToken(): string {
  if (process.env.ORCHESTOS_DASHBOARD_TOKEN) return process.env.ORCHESTOS_DASHBOARD_TOKEN
  const directory = orchestosDir()
  const path = join(directory, 'dashboard-token')
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  mkdirSync(directory, { recursive: true })
  const token = randomBytes(32).toString('hex')
  try {
    writeFileSync(path, token, { mode: 0o600, flag: 'wx' })
    return token
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    return readFileSync(path, 'utf8')
  }
}

export function guardRequest(req: Request, port: number, token: string): Response | null {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`]
  if (!hosts.includes(req.headers.get('host') ?? ''))
    return new Response('Forbidden', { status: 403 })
  const origin = req.headers.get('origin')
  if (origin !== null && !hosts.some((host) => origin === `http://${host}`))
    return new Response('Forbidden', { status: 403 })
  const url = new URL(req.url)
  if (!url.pathname.startsWith('/api/')) return null
  const websocket =
    url.pathname === '/api/terminal' &&
    req.method === 'GET' &&
    req.headers.get('upgrade')?.toLowerCase() === 'websocket'
  const supplied =
    req.headers.get('x-orchestos-token') ?? (websocket ? url.searchParams.get('t') : null)
  const expected = Buffer.from(token)
  const actual = Buffer.from(supplied ?? '')
  if (!supplied || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: 'dashboard token required' }, { status: 401 })
  return null
}
