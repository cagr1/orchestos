import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { handleCurate, handleImport, DASHBOARD_URL } from '../cli-skill-curate.ts'

const MOCK_SKILL = {
  id: 'test-skill',
  name: 'Test Skill',
  description: 'A test skill',
  version: '1.0.0',
  targets: ['claude'],
  instructions: 'Do the thing',
}

const CURATE_RESPONSE = {
  ok: true,
  skill: MOCK_SKILL,
  iterations: 1,
}

const IMPORT_RESPONSE = {
  ok: true,
  skill: MOCK_SKILL,
  normalized: false,
  warnings: [],
  iterations: 0,
}

const SAVE_RESPONSE = {
  ok: true,
  id: 'test-skill',
}

const FAIL_RESPONSE = {
  ok: false,
  error: 'something went wrong',
}

let originalFetch: typeof globalThis.fetch
let logs: string[]
let warns: string[]
let errors: string[]

const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

beforeEach(() => {
  originalFetch = globalThis.fetch
  logs = []
  warns = []
  errors = []
  mock.restore()

  console.log = (...args: string[]) => { logs.push(args.join(' ')) }
  console.warn = (...args: string[]) => { warns.push(args.join(' ')) }
  console.error = (...args: string[]) => { errors.push(args.join(' ')) }
})

afterEach(() => {
  globalThis.fetch = originalFetch
  console.log = originalConsoleLog
  console.warn = originalConsoleWarn
  console.error = originalConsoleError
})

describe('DASHBOARD_URL', () => {
  it('defaults to http://localhost:4242', () => {
    expect(DASHBOARD_URL).toBe('http://localhost:4242')
  })
})

describe('handleCurate', () => {
  it('calls curator API and prints YAML', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(CURATE_RESPONSE)))
    ) as unknown as typeof globalThis.fetch

    await handleCurate('create a code review skill')

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const callUrl = (globalThis.fetch as any).mock.calls[0][0]
    const callBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)
    expect(callUrl).toBe(`${DASHBOARD_URL}/api/skills/curate`)
    expect(callBody.text).toBe('create a code review skill')
    expect(logs.join('\n')).toContain('id: test-skill')
    expect(logs.join('\n')).toContain('name: Test Skill')
  })

  it('with --save calls save API after curate', async () => {
    let callCount = 0
    globalThis.fetch = mock(async () => {
      callCount++
      if (callCount === 1) {
        return new Response(JSON.stringify(CURATE_RESPONSE))
      }
      return new Response(JSON.stringify(SAVE_RESPONSE))
    }) as unknown as typeof globalThis.fetch

    await handleCurate('create a code review skill', true)

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    const saveCall = (globalThis.fetch as any).mock.calls[1]
    expect(saveCall[0]).toBe(`${DASHBOARD_URL}/api/skills`)
    const saveBody = JSON.parse(saveCall[1].body)
    expect(saveBody.id).toBe('test-skill')
    expect(logs.join('\n')).toContain('Saved as skills/test-skill.yaml')
  })

  it('exits on API error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(FAIL_RESPONSE)))
    ) as unknown as typeof globalThis.fetch

    const exitCode = await new Promise<number>(resolve => {
      const origExit = process.exit
      process.exit = ((code?: number) => { resolve(code ?? 1); return undefined as never }) as typeof process.exit
      handleCurate('bad').then(() => { process.exit = origExit; resolve(0) }).catch(() => {})
    })

    expect(exitCode).toBe(1)
    expect(errors.join('\n')).toContain('something went wrong')
  })

  it('exits on connection error', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof globalThis.fetch

    const exitCode = await new Promise<number>(resolve => {
      const origExit = process.exit
      process.exit = ((code?: number) => { resolve(code ?? 1); return undefined as never }) as typeof process.exit
      handleCurate('test').then(() => { process.exit = origExit; resolve(0) }).catch(() => {})
    })

    expect(exitCode).toBe(1)
    expect(errors.join('\n')).toContain('Cannot connect to dashboard')
  })
})

describe('handleImport', () => {
  it('calls import API and saves', async () => {
    let callCount = 0
    globalThis.fetch = mock(async () => {
      callCount++
      if (callCount === 1) {
        return new Response(JSON.stringify(IMPORT_RESPONSE))
      }
      return new Response(JSON.stringify(SAVE_RESPONSE))
    }) as unknown as typeof globalThis.fetch

    await handleImport('https://example.com/skill.yaml')

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    const importCall = (globalThis.fetch as any).mock.calls[0]
    expect(importCall[0]).toBe(`${DASHBOARD_URL}/api/skills/import`)
    const importBody = JSON.parse(importCall[1].body)
    expect(importBody.type).toBe('url')
    expect(importBody.url).toBe('https://example.com/skill.yaml')

    const saveCall = (globalThis.fetch as any).mock.calls[1]
    expect(saveCall[0]).toBe(`${DASHBOARD_URL}/api/skills`)
    expect(logs.join('\n')).toContain('Imported and saved as skills/test-skill.yaml')
  })

  it('prints warnings when normalized', async () => {
    const normalizedResp = {
      ...IMPORT_RESPONSE,
      normalized: true,
      warnings: ['Missing description, filled by AI'],
    }
    let callCount = 0
    globalThis.fetch = mock(async () => {
      callCount++
      if (callCount === 1) {
        return new Response(JSON.stringify(normalizedResp))
      }
      return new Response(JSON.stringify(SAVE_RESPONSE))
    }) as unknown as typeof globalThis.fetch

    await handleImport('https://example.com/skill.yaml')

    expect(warns.join('\n')).toContain('Missing description')
    expect(logs.join('\n')).toContain('normalized by AI')
  })

  it('exits on API error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(FAIL_RESPONSE)))
    ) as unknown as typeof globalThis.fetch

    const exitCode = await new Promise<number>(resolve => {
      const origExit = process.exit
      process.exit = ((code?: number) => { resolve(code ?? 1); return undefined as never }) as typeof process.exit
      handleImport('https://example.com/skill.yaml').then(() => { process.exit = origExit; resolve(0) }).catch(() => {})
    })

    expect(exitCode).toBe(1)
    expect(errors.join('\n')).toContain('something went wrong')
  })

  it('exits on connection error', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof globalThis.fetch

    const exitCode = await new Promise<number>(resolve => {
      const origExit = process.exit
      process.exit = ((code?: number) => { resolve(code ?? 1); return undefined as never }) as typeof process.exit
      handleImport('https://example.com/skill.yaml').then(() => { process.exit = origExit; resolve(0) }).catch(() => {})
    })

    expect(exitCode).toBe(1)
    expect(errors.join('\n')).toContain('Cannot connect to dashboard')
  })
})
