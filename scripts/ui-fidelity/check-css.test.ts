import { afterEach, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const script = join(process.cwd(), 'scripts/ui-fidelity/check-css.mjs')
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

function run(source: string, css: string) {
  const directory = mkdtempSync(join(tmpdir(), 'ui-css-check-'))
  temporaryDirectories.push(directory)
  const sourceDir = join(directory, 'src')
  const cssPath = join(directory, 'main.css')
  mkdirSync(sourceDir)
  writeFileSync(join(sourceDir, 'App.tsx'), source)
  writeFileSync(cssPath, css)
  return spawnSync(process.execPath, [script, sourceDir, cssPath], { encoding: 'utf8' })
}

test('passes when every app utility is present', () => {
  const result = run(
    '<div className="bg-app-accent/60 border-app text-app" />',
    '.bg-app-accent\\/60{color:red}.border-app{}.text-app{}',
  )
  expect(result.status).toBe(0)
})

test('fails when an app utility is missing', () => {
  const result = run('<div className="bg-app-accent border-app" />', '.bg-app-accent{}')
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('border-app')
})

test('fails when v3 alpha syntax reaches compiled CSS', () => {
  const result = run(
    '<div className="bg-app-accent" />',
    '.bg-app-accent{color:rgb(0 0 0 / <alpha-value>)}',
  )
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('<alpha-value>')
})
