import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { enforceContract, parseLLMResponse } from '../run/contract.ts'

let TMP_ROOT: string

beforeEach(() => {
  TMP_ROOT = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-contract-')))
})

afterEach(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true })
})

describe('parseLLMResponse', () => {
  it('parses a single valid FILE block', () => {
    const raw = '<<<FILE:hello.txt>>>\nHello world\n<<<ENDFILE>>>'
    const result = parseLLMResponse(raw)
    expect(result.files).toHaveLength(1)
    const [file] = result.files
    expect(file!.path).toBe('hello.txt')
    expect(file!.content).toBe('Hello world\n')
  })

  it('parses multiple FILE blocks', () => {
    const raw = [
      '<<<FILE:a.txt>>>',
      'content a',
      '<<<ENDFILE>>>',
      '<<<FILE:b.txt>>>',
      'content b',
      '<<<ENDFILE>>>',
    ].join('\n')
    const result = parseLLMResponse(raw)
    expect(result.files).toHaveLength(2)
    const [a, b] = result.files
    expect(a!.path).toBe('a.txt')
    expect(a!.content).toBe('content a\n')
    expect(b!.path).toBe('b.txt')
    expect(b!.content).toBe('content b\n')
  })

  it('strips one leading newline from content', () => {
    const raw = '<<<FILE:note.md>>>\n\n# Title\n\nBody\n<<<ENDFILE>>>'
    const result = parseLLMResponse(raw)
    const [file] = result.files
    expect(file!.content).toBe('\n# Title\n\nBody\n')
  })

  it('throws when no FILE blocks are found', () => {
    expect(() => parseLLMResponse('just some random text without delimiters')).toThrow(
      'No <<<FILE:...>>>...<<<ENDFILE>>> blocks found',
    )
  })

  it('throws when FILE delimiter has an empty path (regex treats it as no match)', () => {
    const raw = '<<<FILE:>>>\nsome content\n<<<ENDFILE>>>'
    expect(() => parseLLMResponse(raw)).toThrow('No <<<FILE:...>>>...<<<ENDFILE>>> blocks found')
  })
})

describe('enforceContract', () => {
  it('writes authorized files with correct content', () => {
    const response = { files: [{ path: 'out/hello.txt', content: 'Hello world' }] }
    const result = enforceContract(TMP_ROOT, response, ['out/hello.txt'])

    expect(result.filesAttempted).toEqual(['out/hello.txt'])
    expect(result.filesAuthorized).toEqual(['out/hello.txt'])
    expect(result.filesBlocked).toEqual([])
    expect(result.written).toHaveLength(1)
    expect(result.written[0]!.path).toBe('out/hello.txt')

    const filePath = join(TMP_ROOT, 'out/hello.txt')
    expect(existsSync(filePath)).toBe(true)
    expect(readFileSync(filePath, 'utf-8')).toBe('Hello world')
  })

  it('writes multiple authorized files', () => {
    const response = {
      files: [
        { path: 'a.txt', content: 'AAA' },
        { path: 'b.txt', content: 'BBB' },
      ],
    }
    const result = enforceContract(TMP_ROOT, response, ['a.txt', 'b.txt'])
    expect(result.filesAuthorized).toHaveLength(2)
    expect(readFileSync(join(TMP_ROOT, 'a.txt'), 'utf-8')).toBe('AAA')
    expect(readFileSync(join(TMP_ROOT, 'b.txt'), 'utf-8')).toBe('BBB')
  })

  it('throws CONTRACT VIOLATION and writes nothing when path is outside allowedPaths', () => {
    const response = { files: [{ path: 'unauthorized/payload', content: 'evil' }] }

    expect(() => enforceContract(TMP_ROOT, response, ['allowed/file.txt'])).toThrow(
      'CONTRACT VIOLATION',
    )

    expect(existsSync(join(TMP_ROOT, 'unauthorized/payload'))).toBe(false)
  })

  it('blocks path with ../ traversal not in allowedPaths', () => {
    const response = { files: [{ path: '../outside-project.txt', content: 'leak' }] }

    expect(() => enforceContract(TMP_ROOT, response, ['inside/ok.txt'])).toThrow(
      'CONTRACT VIOLATION',
    )

    expect(existsSync(join(TMP_ROOT, '../outside-project.txt'))).toBe(false)
  })

  it('blocks all paths when none are authorized and writes nothing', () => {
    const response = {
      files: [
        { path: 'x.txt', content: 'x' },
        { path: 'y.txt', content: 'y' },
      ],
    }

    expect(() => enforceContract(TMP_ROOT, response, ['z.txt'])).toThrow('CONTRACT VIOLATION')

    expect(existsSync(join(TMP_ROOT, 'x.txt'))).toBe(false)
    expect(existsSync(join(TMP_ROOT, 'y.txt'))).toBe(false)
  })
})

describe('enforceContract — path normalization (F4.3)', () => {
  function expectAuthorizedAt(llmPath: string, declaredPath: string, expectedOnDisk: string) {
    const response = { files: [{ path: llmPath, content: `payload for ${llmPath}` }] }
    const result = enforceContract(TMP_ROOT, response, [declaredPath])

    expect(result.filesBlocked).toEqual([])
    expect(result.filesAuthorized).toEqual([expectedOnDisk])
    expect(result.filesAttempted).toEqual([expectedOnDisk])
    expect(result.written).toHaveLength(1)
    expect(result.written[0]!.path).toBe(expectedOnDisk)

    const onDisk = join(TMP_ROOT, expectedOnDisk)
    expect(existsSync(onDisk)).toBe(true)
    expect(readFileSync(onDisk, 'utf-8')).toBe(`payload for ${llmPath}`)
  }

  it('authorizes "./src/a.ts" against declared "src/a.ts" (strips ./ prefix, writes normalized)', () => {
    expectAuthorizedAt('./src/a.ts', 'src/a.ts', 'src/a.ts')
  })

  it('authorizes "src\\\\a.ts" (Windows separator) against declared "src/a.ts"', () => {
    expectAuthorizedAt('src\\a.ts', 'src/a.ts', 'src/a.ts')
  })

  it('authorizes "src//a.ts" (collapsed) against declared "src/a.ts"', () => {
    expectAuthorizedAt('src//a.ts', 'src/a.ts', 'src/a.ts')
  })

  it('authorizes "././/src/a.ts" (combined: prefix + separator + collapse) against declared "src/a.ts"', () => {
    expectAuthorizedAt('././/src/a.ts', 'src/a.ts', 'src/a.ts')
  })

  it('still blocks "../x" (anti-escape: .. is never resolved)', () => {
    const response = { files: [{ path: '../x', content: 'leak' }] }
    expect(() => enforceContract(TMP_ROOT, response, ['src/a.ts'])).toThrow('CONTRACT VIOLATION')
    expect(existsSync(join(TMP_ROOT, 'x'))).toBe(false)
  })

  it('still blocks "src/../../x" (anti-escape: .. segments are preserved literally)', () => {
    const response = { files: [{ path: 'src/../../x', content: 'leak' }] }
    expect(() => enforceContract(TMP_ROOT, response, ['src/a.ts'])).toThrow('CONTRACT VIOLATION')
    expect(existsSync(join(TMP_ROOT, 'x'))).toBe(false)
    expect(existsSync(join(TMP_ROOT, 'src/x'))).toBe(false)
  })

  it('still blocks "./../x" (anti-escape even with ./ prefix stripped first)', () => {
    const response = { files: [{ path: './../x', content: 'leak' }] }
    expect(() => enforceContract(TMP_ROOT, response, ['src/a.ts'])).toThrow('CONTRACT VIOLATION')
  })

  it('contract with "./src/a.ts" authorizes LLM "src/a.ts" (both sides normalize to the same)', () => {
    expectAuthorizedAt('src/a.ts', './src/a.ts', 'src/a.ts')
  })
})

it('AUD.20 a staging failure leaves every destination intact and removes temporaries', () => {
  writeFileSync(join(TMP_ROOT, 'first.txt'), 'original')
  writeFileSync(join(TMP_ROOT, 'blocked'), 'regular file')
  expect(() =>
    enforceContract(
      TMP_ROOT,
      {
        files: [
          { path: 'first.txt', content: 'changed' },
          { path: 'blocked/second.txt', content: 'second' },
        ],
      },
      ['first.txt', 'blocked/second.txt'],
    ),
  ).toThrow()
  expect(readFileSync(join(TMP_ROOT, 'first.txt'), 'utf8')).toBe('original')
  expect(readdirSync(TMP_ROOT).sort()).toEqual(['blocked', 'first.txt'])
})

it('AUD.20-fix preserves foreign temporaries after an exclusive-create failure', () => {
  const id = '00000000-0000-4000-8000-000000000000'
  const legacy = join(TMP_ROOT, `first.txt.orchestos-tmp-${process.pid}-0`)
  const foreign = join(TMP_ROOT, `first.txt.orchestos-tmp-${id}`)
  writeFileSync(legacy, 'foreign legacy')
  writeFileSync(foreign, 'foreign uuid')
  const uuid = spyOn(crypto, 'randomUUID').mockReturnValue(id)
  try {
    expect(() =>
      enforceContract(TMP_ROOT, { files: [{ path: 'first.txt', content: 'new' }] }, ['first.txt']),
    ).toThrow()
    expect(readFileSync(legacy, 'utf8')).toBe('foreign legacy')
    expect(readFileSync(foreign, 'utf8')).toBe('foreign uuid')
  } finally {
    uuid.mockRestore()
  }
})

it('AUD.20-fix attempts every rollback and preserves the original error as cause', () => {
  for (const name of ['a', 'b', 'c']) writeFileSync(join(TMP_ROOT, name), `old ${name}`)
  const rename = fs.renameSync
  const write = fs.writeFileSync
  const original = new Error('injected commit failure')
  const renameSpy = spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (to === join(TMP_ROOT, 'c')) throw original
    return rename(from, to)
  })
  const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation((path, data, options) => {
    if (path === join(TMP_ROOT, 'b')) throw new Error('injected rollback failure')
    return write(path, data, options)
  })
  let caught: unknown
  try {
    enforceContract(
      TMP_ROOT,
      { files: ['a', 'b', 'c'].map((path) => ({ path, content: 'new' })) },
      ['a', 'b', 'c'],
    )
  } catch (error) {
    caught = error
  } finally {
    renameSpy.mockRestore()
    writeSpy.mockRestore()
  }
  expect(caught).toBeInstanceOf(Error)
  expect((caught as Error).message).toContain('injected commit failure')
  expect((caught as Error).message).toContain(`rollback incompleto: ${join(TMP_ROOT, 'b')}`)
  expect((caught as Error).cause).toBe(original)
  expect(readFileSync(join(TMP_ROOT, 'a'), 'utf8')).toBe('old a')
  expect(readFileSync(join(TMP_ROOT, 'b'), 'utf8')).toBe('new')
  expect(readFileSync(join(TMP_ROOT, 'c'), 'utf8')).toBe('old c')
  expect(readdirSync(TMP_ROOT).sort()).toEqual(['a', 'b', 'c'])
})

it('AUD.20-fix preserves executable destination permissions', () => {
  const destination = join(TMP_ROOT, 'script.sh')
  writeFileSync(destination, 'old')
  chmodSync(destination, 0o755)
  enforceContract(TMP_ROOT, { files: [{ path: 'script.sh', content: 'new' }] }, ['script.sh'])
  expect(readFileSync(destination, 'utf8')).toBe('new')
  expect(statSync(destination).mode & 0o7777).toBe(0o755)
})

it('AUD.20-fix cleans a temporary after a partial write failure', () => {
  writeFileSync(join(TMP_ROOT, 'a'), 'old a')
  const write = fs.writeFileSync
  const original = Object.assign(new Error('disk full'), { code: 'ENOSPC' })
  const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation((path, data, options) => {
    if (String(path).includes('.orchestos-tmp-')) {
      write(path, 'partial', options)
      throw original
    }
    return write(path, data, options)
  })
  try {
    expect(() =>
      enforceContract(TMP_ROOT, { files: [{ path: 'a', content: 'new a' }] }, ['a']),
    ).toThrow(original)
    expect(readFileSync(join(TMP_ROOT, 'a'), 'utf8')).toBe('old a')
    expect(readdirSync(TMP_ROOT)).toEqual(['a'])
  } finally {
    writeSpy.mockRestore()
  }
})

it('AUD.20-fix attempts every temporary cleanup without replacing the original error', () => {
  const original = new Error('rename failed')
  const renameSpy = spyOn(fs, 'renameSync').mockImplementation(() => {
    throw original
  })
  const unlink = fs.unlinkSync
  let unlinkCalls = 0
  const unlinkSpy = spyOn(fs, 'unlinkSync').mockImplementation((path) => {
    unlinkCalls += 1
    if (unlinkCalls === 1) throw new Error('cleanup failed')
    return unlink(path)
  })
  let caught: unknown
  try {
    enforceContract(
      TMP_ROOT,
      {
        files: [
          { path: 'a', content: 'new a' },
          { path: 'b', content: 'new b' },
        ],
      },
      ['a', 'b'],
    )
  } catch (error) {
    caught = error
  } finally {
    renameSpy.mockRestore()
    unlinkSpy.mockRestore()
  }
  expect(caught).toBe(original)
  expect(unlinkCalls).toBe(2)
  const leftovers = readdirSync(TMP_ROOT)
  expect(leftovers).toHaveLength(1)
  expect(leftovers[0]).toContain('.orchestos-tmp-')
})
