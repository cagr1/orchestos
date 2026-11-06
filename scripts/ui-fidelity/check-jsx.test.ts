import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const script = join(process.cwd(), 'scripts/ui-fidelity/check-jsx.mjs')

function runCheck(template: string, app: string) {
  const directory = mkdtempSync(join(tmpdir(), 'orchestos-jsx-check-'))
  const templatePath = join(directory, 'template.tsx')
  const appPath = join(directory, 'app.tsx')
  writeFileSync(templatePath, template)
  writeFileSync(appPath, app)
  const result = spawnSync('node', [script, templatePath, appPath], { encoding: 'utf8' })
  rmSync(directory, { recursive: true, force: true })
  return result
}

describe('check-jsx', () => {
  test('passes for an identical file', () => {
    const source = `<main className="p-4"><Widget className={cn("text-app", ok ? "bg-ok" : "bg-warn")} /></main>`
    expect(runCheck(source, source).status).toBe(0)
  })

  test('passes when only data changes', () => {
    const template = `<main className="p-4"><span>{example}</span></main>`
    const app = `<main className="p-4"><span>{realValue}</span></main>`
    expect(runCheck(template, app).status).toBe(0)
  })

  test('fails when a className occurrence is missing', () => {
    const template = `<main className="p-4 text-app"><span /></main>`
    const app = `<main className="p-4"><span /></main>`
    const result = runCheck(template, app)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('className "text-app"')
  })

  test('fails when an element occurrence is missing', () => {
    const template = `<main><section><span /></section></main>`
    const app = `<main><span /></main>`
    const result = runCheck(template, app)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('element <section')
  })

  test('fails when a registered template sample string is copied into the app', () => {
    const samplePath = join(process.cwd(), 'scripts/ui-fidelity/jsx-sample-text.json')
    const original = readFileSync(samplePath, 'utf8')
    writeFileSync(
      samplePath,
      JSON.stringify([{ archivo: 'app.tsx', texto: 'fake template output' }]),
    )
    try {
      const result = runCheck('<main />', '<main>fake template output</main>')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('sample text')
    } finally {
      writeFileSync(samplePath, original)
    }
  })
})
