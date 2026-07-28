import { readFileSync } from 'fs'

/** K.3 — textual, deliberately cheap assertion detection for generated tests. */
export function countTestAssertions(content: string): number {
  const assertionPattern = /\bexpect\s*\(|\bassert(?:\.\w+)?\s*\(|\.(?:toBe|toEqual|toStrictEqual|toContain|toThrow|toHaveLength|toMatch|toBeTruthy|toBeFalsy|toBeDefined|toBeUndefined|toBeNull|toBeGreaterThan|toBeLessThan|toHaveProperty)\s*\(/g
  return content.match(assertionPattern)?.length ?? 0
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
