import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startServer } from './server.ts'

const servers: Array<{ stop: (force?: boolean) => void }> = []

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true)
})

async function availablePort(): Promise<number | null> {
  const probe = createServer()
  try {
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject)
      probe.listen(0, '127.0.0.1', resolve)
    })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EPERM') return null
    throw error
  }
  const address = probe.address()
  if (!address || typeof address === 'string') throw new Error('Could not allocate a test port')
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  )
  return address.port
}

const portProbe = await availablePort()

describe.skipIf(portProbe === null)('terminal WebSocket origin boundary', () => {
  test('reports binaryChanged when the terminal executable rewrites itself', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-terminal-update-'))
    const script = join(root, 'terminal.sh')
    writeFileSync(script, '#!/bin/sh\nprintf "# updated binary\\n" >> "$0"\nexit 0\n', {
      mode: 0o755,
    })
    let socket: WebSocket | undefined
    try {
      const port = await availablePort()
      if (port === null) throw new Error('Loopback listener became unavailable')
      const { server } = startServer(port, [script])
      servers.push(server)
      // lib.dom omits Bun's WebSocket constructor overload for custom headers.
      const TerminalWebSocket = WebSocket as unknown as {
        new (url: string, options: Bun.WebSocketOptions): WebSocket
      }
      const result = await new Promise<unknown>((resolve, reject) => {
        socket = new TerminalWebSocket(`ws://127.0.0.1:${server.port}/api/terminal`, {
          headers: { origin: `http://127.0.0.1:${server.port}` },
        })
        socket.onmessage = (event) => {
          if (typeof event.data !== 'string') return
          const payload = JSON.parse(event.data)
          if (payload.type === 'exit') resolve(payload)
          if (payload.type === 'error') reject(new Error(payload.message))
        }
        socket.onerror = () => reject(new Error('Terminal WebSocket failed'))
      })
      expect(result).toEqual({ type: 'exit', code: 0, binaryChanged: true })
    } finally {
      socket?.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('rejects a request without Origin', async () => {
    const port = await availablePort()
    if (port === null) throw new Error('Loopback listener became unavailable')
    const { server } = startServer(port, ['sh'])
    servers.push(server)
    const response = await fetch(`http://127.0.0.1:${server.port}/api/terminal`)
    expect(response.status).toBe(403)
  })

  test('rejects a cross-origin WebSocket upgrade request', async () => {
    const port = await availablePort()
    if (port === null) throw new Error('Loopback listener became unavailable')
    const { server } = startServer(port, ['sh'])
    servers.push(server)
    const response = await fetch(`http://127.0.0.1:${server.port}/api/terminal`, {
      headers: { origin: 'http://localhost:3000' },
    })
    expect(response.status).toBe(403)
  })

  test('kind desconocido responde 400', async () => {
    const port = await availablePort()
    if (port === null) throw new Error('Loopback listener became unavailable')
    const { server } = startServer(port, ['sh'])
    servers.push(server)
    const response = await fetch(`http://127.0.0.1:${server.port}/api/terminal?kind=bogus`, {
      headers: { origin: `http://127.0.0.1:${server.port}` },
    })
    expect(response.status).toBe(400)
  })
})
