import { readFileSync } from 'node:fs'

const testSource = readFileSync('src/sum.case.ts', 'utf-8')
if (!/\b(?:expect|assert)\s*\(/.test(testSource)) {
  throw new Error('test file contains no assertions')
}
