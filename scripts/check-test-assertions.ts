import { readFileSync } from 'node:fs'

function stripCommentsAndLiterals(content: string): string {
  let result = ''
  let state: 'code' | 'line' | 'block' | "'" | '"' | '`' = 'code'
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const next = content[i + 1]
    if (state === 'code') {
      if (char === '/' && (next === '/' || next === '*')) {
        state = next === '/' ? 'line' : 'block'
        result += ' '
        i++
      } else if (char === "'" || char === '"' || char === '`') {
        state = char
        result += ' '
      } else result += char
    } else if (state === 'line') {
      if (char === '\n' || char === '\r') {
        state = 'code'
        result += char
      }
    } else if (state === 'block') {
      if (char === '*' && next === '/') {
        state = 'code'
        i++
      }
    } else if (char === '\\') i++
    else if (char === state) state = 'code'
  }
  return result
}

/** K.3 — textual, deliberately cheap assertion detection for generated tests. */
export function countTestAssertions(content: string): number {
  const assertionPattern =
    /\bexpect\s*\(|\bassert(?:\.\w+)?\s*\(|\.(?:toBe|toEqual|toStrictEqual|toContain|toThrow|toHaveLength|toMatch|toBeTruthy|toBeFalsy|toBeDefined|toBeUndefined|toBeNull|toBeGreaterThan|toBeLessThan|toHaveProperty)\s*\(/g
  return stripCommentsAndLiterals(content).match(assertionPattern)?.length ?? 0
}

if (import.meta.main) {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('test assertion check: missing file path')
    process.exit(1)
  }

  const count = countTestAssertions(readFileSync(filePath, 'utf-8'))
  if (count === 0) {
    console.error('test file has no assertions — passing vacuously')
    process.exit(1)
  }
}
