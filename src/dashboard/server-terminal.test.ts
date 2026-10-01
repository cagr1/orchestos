import { afterEach, describe, expect, test } from 'bun:test'
import { createServer } from 'node:net'
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
})
