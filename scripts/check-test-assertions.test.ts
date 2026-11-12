import { expect, test } from 'bun:test'
import { countTestAssertions } from './check-test-assertions.ts'

test('AUD.26 ignores assertions in comments and escaped string literals', () => {
  const content = [
    '// expect(x)',
    '/* assert(x); expect(y).toBe(1) */',
    'const s = "expect(1)"',
    "const t = 'assert(true)'",
    `const u = \`expect(1) \${expect(2)}\``,
    String.raw`const escaped = "a\" expect(3)"`,
    String.raw`const single = 'a\' expect(4)'`,
  ].join('\n')
  expect(countTestAssertions(content)).toBe(0)
})

test('AUD.26 counts real assertions after comments and literals', () => {
  expect(countTestAssertions('// expect(x)\nconst s = "expect(1)"; expect(a).toBe(1)')).toBe(2)
  expect(countTestAssertions('/* ignored */ assert.equal(a, 1)')).toBe(1)
})
