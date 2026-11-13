import { expect, it } from 'bun:test'
import { cliArgumentLines, getClis, saveClis, saveHiddenClis } from './settings'

it('converts argument lines without splitting spaces inside an argument', () => {
  expect(cliArgumentLines('-p\r\n{prompt}\r\n\r\n--model\nmodel with spaces\n')).toEqual([
    '-p',
    '{prompt}',
    '--model',
    'model with spaces',
  ])
  expect(cliArgumentLines('')).toEqual([])
})

it('saves picker visibility with the project scope required by the server', async () => {
  const original = globalThis.fetch
  const calls: Array<{ path: string; init?: RequestInit }> = []
  globalThis.fetch = (async (path, init) => {
    calls.push({ path: String(path), init })
    const headers = new Headers(init?.headers)
    return headers.get('x-orchestos-project-id') === 'project'
      ? Response.json({ ok: true })
      : Response.json({ error: 'project required' }, { status: 400 })
  }) as typeof fetch
  try {
    await saveHiddenClis(['claude'], 'project')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.path).toBe('/api/clis')
    expect(calls[0]?.init?.method).toBe('PUT')
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ hiddenClis: ['claude'] })
    await expect(saveHiddenClis(['claude'])).rejects.toThrow('project required')
  } finally {
    globalThis.fetch = original
  }
})

it('GET and PUT use the custom CLI endpoint and surface server validation errors', async () => {
  const original = globalThis.fetch
  const calls: Array<{ path: string; init?: RequestInit }> = []
  const cli = { id: 'own', label: 'Own', command: 'own', args: [] }
  globalThis.fetch = (async (path, init) => {
    calls.push({ path: String(path), init })
    return init?.method === 'PUT'
      ? Response.json({ error: 'clis[0].id choca con "claude"' }, { status: 400 })
      : Response.json({ clis: [{ ...cli, installed: true }], hiddenClis: [] })
  }) as typeof fetch
  try {
    expect(await getClis()).toEqual({ clis: [{ ...cli, installed: true }], hiddenClis: [] })
    await expect(saveClis([cli], 'project')).rejects.toThrow('clis[0].id choca con "claude"')
    expect(calls.map((call) => call.path)).toEqual(['/api/clis', '/api/clis'])
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ clis: [cli] })
    expect(calls[1]?.init?.headers).toEqual({
      'Content-Type': 'application/json',
      'x-orchestos-project-id': 'project',
    })
  } finally {
    globalThis.fetch = original
  }
})
