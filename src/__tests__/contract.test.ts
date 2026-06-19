import { describe, it, expect, afterEach } from 'bun:test'
import { existsSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseLLMResponse, enforceContract } from '../run/contract.ts'

const TMP_ROOT = join(import.meta.dir, '..', '..', 'tmp', 'contract-a1')

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
      'No <<<FILE:...>>>...<<<ENDFILE>>> blocks found'
    )
  })

  it('throws when FILE delimiter has an empty path (regex treats it as no match)', () => {
    const raw = '<<<FILE:>>>\nsome content\n<<<ENDFILE>>>'
    expect(() => parseLLMResponse(raw)).toThrow(
      'No <<<FILE:...>>>...<<<ENDFILE>>> blocks found'
    )
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

    expect(() => enforceContract(TMP_ROOT, response, ['allowed/file.txt'])).toThrow('CONTRACT VIOLATION')

    expect(existsSync(join(TMP_ROOT, 'unauthorized/payload'))).toBe(false)
  })

  it('blocks path with ../ traversal not in allowedPaths', () => {
    const response = { files: [{ path: '../outside-project.txt', content: 'leak' }] }

    expect(() => enforceContract(TMP_ROOT, response, ['inside/ok.txt'])).toThrow('CONTRACT VIOLATION')

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
