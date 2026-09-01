/**
 * D3 follow-up (Mes 14, 2026-06-25) — defaultChecksFor(): fills in tsc/bun test for
 * code-output tasks that don't declare their own `checks:`. See docs/E2E.md for the
 * real bug this closes (LLM QA approved a generated test file that didn't compile).
 *
 * A.5 (Mes 22 / IDEAS #36) — gap análogo para JS embebido en `.html`/`.js` (bug real
 * en Mes 20/C.1 — `:` donde iba `+` en `<script>`).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultChecksFor, runChecks } from '../run/checks.ts'
import { cleanupJsCheckTemp, jsCheckTempPath } from '../run/html-script-check.ts'
import { RunLogger } from '../run/logger.ts'

let tmpDirs: string[] = []
let tempPathsToCleanup: string[] = []

function makeRoot(withNodeModules: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'checks-test-'))
  if (withNodeModules) mkdirSync(join(dir, 'node_modules'))
  tmpDirs.push(dir)
  return dir
}

/** Trackea el temp file que `defaultChecksFor` va a escribir para un dado htmlPath,
 *  para que afterEach lo limpie. Sin esto, cada corrida deja un `orchestos-jscheck-*.js`
 *  en `os.tmpdir()`. */
function trackHtmlTemp(htmlAbsPath: string): void {
  tempPathsToCleanup.push(jsCheckTempPath(htmlAbsPath))
}

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true })
  for (const p of tempPathsToCleanup) {
    try {
      unlinkSync(p)
    } catch {
      /* ya borrado */
    }
  }
  tmpDirs = []
  tempPathsToCleanup = []
})

describe('defaultChecksFor', () => {
  it('adds a tsc check when output includes a .ts file and node_modules exists', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/foo.ts'], root)
    expect(checks).toContainEqual(expect.objectContaining({ cmd: 'bunx tsc --noEmit' }))
  })

  it('adds a tsc check for .tsx output too', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/Foo.tsx'], root)
    expect(checks.some((c) => c.cmd === 'bunx tsc --noEmit')).toBe(true)
  })

  it('adds a bun test check per *.test.ts output file', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/foo.ts', 'src/__tests__/foo.test.ts'], root)
    expect(checks).toContainEqual(
      expect.objectContaining({ cmd: 'bun test src/__tests__/foo.test.ts' }),
    )
  })

  it('K.3: empty test file gets an assertion check that fails', async () => {
    const root = makeRoot(true)
    const testPath = join(root, 'empty.test.ts')
    writeFileSync(testPath, `import { it } from 'bun:test'\nit('x', () => {})\n`)
    const checks = defaultChecksFor(['empty.test.ts'], root)
    const assertionCheck = checks.find((c) => c.cmd.includes('check-test-assertions'))
    expect(assertionCheck).toBeDefined()

    const results = await runChecks([assertionCheck!], root, new RunLogger(root, 'k3-empty'))
    expect(results[0]?.exitCode).not.toBe(0)
    expect(results[0]?.stderr).toContain('test file has no assertions — passing vacuously')
  })

  it('K.3: test file with a real assertion passes the assertion check', async () => {
    const root = makeRoot(true)
    const testPath = join(root, 'real.test.ts')
    writeFileSync(
      testPath,
      `import { expect, it } from 'bun:test'\nit('x', () => expect(1).toBe(1))\n`,
    )
    const checks = defaultChecksFor(['real.test.ts'], root)
    const assertionCheck = checks.find((c) => c.cmd.includes('check-test-assertions'))
    expect(assertionCheck).toBeDefined()

    const results = await runChecks([assertionCheck!], root, new RunLogger(root, 'k3-real'))
    expect(results[0]?.exitCode).toBe(0)
  })

  it('returns no checks for non-code output (e.g. markdown)', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['docs/README.md'], root)
    expect(checks).toHaveLength(0)
  })

  it('returns no checks at all when node_modules is missing (fresh worktree) AND output is only ts files', () => {
    const root = makeRoot(false)
    const checks = defaultChecksFor(['src/foo.ts', 'src/__tests__/foo.test.ts'], root)
    expect(checks).toHaveLength(0)
  })

  it('does not duplicate the tsc check when multiple .ts files are declared', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/a.ts', 'src/b.ts'], root)
    expect(checks.filter((c) => c.cmd === 'bunx tsc --noEmit')).toHaveLength(1)
  })

  it('adds tsc for mixed TypeScript and non-code output when dependencies exist', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/a.ts', 'docs/README.md'], root)
    expect(checks.some((c) => c.cmd === 'bunx tsc --noEmit')).toBe(true)
  })

  it('adds a bun test check for TSX test output', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['src/Foo.test.tsx'], root)
    expect(checks).toContainEqual(expect.objectContaining({ cmd: 'bun test src/Foo.test.tsx' }))
  })

  it('adds the assertion gate for an existing TSX test file', () => {
    const root = makeRoot(false)
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src/Foo.test.tsx'), 'it("x", () => {})')
    const checks = defaultChecksFor(['src/Foo.test.tsx'], root)
    expect(checks.some((c) => c.cmd.includes('check-test-assertions'))).toBe(true)
  })

  it('does not add an assertion check for a non-test TypeScript file', () => {
    const root = makeRoot(false)
    writeFileSync(join(root, 'src.ts'), 'export const value = 1')
    const checks = defaultChecksFor(['src.ts'], root)
    expect(checks.some((c) => c.cmd.includes('check-test-assertions'))).toBe(false)
  })

  // ── A.5 (Mes 22 / IDEAS #36): sintaxis JS embebido en HTML/.js ───────────────

  it('emits a node --check for an existing .js output even without node_modules', () => {
    const root = makeRoot(false)
    const jsPath = join(root, 'inline.js')
    writeFileSync(jsPath, 'const x = 1;')
    const checks = defaultChecksFor(['inline.js'], root)
    const jsCheck = checks.find((c) => c.cmd.startsWith('node --check '))
    expect(jsCheck).toBeDefined()
    expect(jsCheck!.cmd).toContain('inline.js')
    expect(jsCheck!.timeout_ms).toBeGreaterThan(0)
  })

  it('does NOT emit a check for a .js file that does not exist on disk (el contrato lo cubre)', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['ghost.js'], root)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(false)
  })

  it('emits a node --check temp-file for an .html with inline JS', () => {
    const root = makeRoot(true)
    const htmlPath = join(root, 'page.html')
    trackHtmlTemp(htmlPath)
    writeFileSync(
      htmlPath,
      `<!doctype html><html><body><script>const x = 1;</script></body></html>`,
    )
    const checks = defaultChecksFor(['page.html'], root)
    const jsCheck = checks.find((c) => c.cmd.startsWith('node --check '))
    expect(jsCheck).toBeDefined()
    expect(jsCheck!.cmd).not.toContain('page.html')
    expect(jsCheck!.cmd).toMatch(/orchestos-jscheck-/)
    expect(jsCheck!.timeout_ms).toBe(15_000)
  })

  it('does NOT emit a JS check for an .html without inline scripts', () => {
    const root = makeRoot(true)
    writeFileSync(join(root, 'static.html'), '<!doctype html><html><body></body></html>')
    const checks = defaultChecksFor(['static.html'], root)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(false)
  })

  it('does not treat script-like text in a non-HTML file as inline JavaScript', () => {
    const root = makeRoot(true)
    writeFileSync(join(root, 'notes.md'), '<script>const broken = :;</script>')
    const checks = defaultChecksFor(['notes.md'], root)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(false)
  })

  it('does NOT emit a JS check for an .html that does not exist on disk', () => {
    const root = makeRoot(true)
    const checks = defaultChecksFor(['missing.html'], root)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(false)
  })

  it('emits a JS check for an .html even when node_modules is missing (does not depend on node_modules)', () => {
    const root = makeRoot(false)
    const htmlPath = join(root, 'page.html')
    trackHtmlTemp(htmlPath)
    writeFileSync(
      htmlPath,
      '<!doctype html><html><body><script>const x = 1;</script></body></html>',
    )
    const checks = defaultChecksFor(['page.html'], root)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(true)
  })

  it('keeps tsc/bun test gated on node_modules while emitting JS check (mixed output)', () => {
    const root = makeRoot(false)
    const htmlPath = join(root, 'page.html')
    trackHtmlTemp(htmlPath)
    writeFileSync(
      htmlPath,
      '<!doctype html><html><body><script>const x = 1;</script></body></html>',
    )
    const checks = defaultChecksFor(['src/foo.ts', 'page.html'], root)
    expect(checks.some((c) => c.cmd === 'bunx tsc --noEmit')).toBe(false)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(true)
  })

  // ── Gate causal (A.5): el bug de C.1 (`:` en vez de `+`) ahora se detecta ────
  // Demuestra que el wiring es real, no solo teórico: corre `node --check` de verdad
  // sobre el temp generado por `defaultChecksFor` y verifica que el bug real del
  // Mes 20/C.1 (`const x = "a" : "b"` dentro de un `<script>` inline) hace fallar
  // el check con un mensaje que menciona el error de sintaxis.

  it('A.5 integration: catches the C.1 bug pattern (`: en vez de +` en `<script>` inline) end-to-end', async () => {
    const root = makeRoot(true)
    const htmlPath = join(root, 'broken.html')
    trackHtmlTemp(htmlPath)
    writeFileSync(
      htmlPath,
      '<!doctype html><html><body>\n' +
        '<script>\n' +
        '  const label = "hi" : "world";\n' +
        '  console.log(label);\n' +
        '</script>\n' +
        '</body></html>',
    )
    const checks = defaultChecksFor(['broken.html'], root)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(true)
    const [{ runChecks }, { RunLogger }] = await Promise.all([
      import('../run/checks.ts'),
      import('../run/logger.ts'),
    ])
    const logger = new RunLogger(root, 'a5-integration')
    const results = await runChecks(checks, root, logger)
    const jsResult = results.find((r) => r.cmd.startsWith('node --check '))
    expect(jsResult).toBeDefined()
    expect(jsResult!.exitCode).not.toBe(0)
    expect(jsResult!.stderr).toContain("Unexpected token ':'")
  })

  it('A.5 integration: passes a syntactically-valid inline script end-to-end', async () => {
    const root = makeRoot(true)
    const htmlPath = join(root, 'good.html')
    trackHtmlTemp(htmlPath)
    writeFileSync(
      htmlPath,
      '<!doctype html><html><body>\n' +
        '<script>\n' +
        '  const label = "hi" + "world";\n' +
        '  console.log(label);\n' +
        '</script>\n' +
        '</body></html>',
    )
    const checks = defaultChecksFor(['good.html'], root)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(true)
    const [{ runChecks }, { RunLogger }] = await Promise.all([
      import('../run/checks.ts'),
      import('../run/logger.ts'),
    ])
    const logger = new RunLogger(root, 'a5-positive')
    const results = await runChecks(checks, root, logger)
    const jsResult = results.find((r) => r.cmd.startsWith('node --check '))
    expect(jsResult).toBeDefined()
    expect(jsResult!.exitCode).toBe(0)
    expect(jsResult!.timedOut).toBe(false)
    expect(jsResult!.elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('A.5 integration: catches a JS syntax error in a standalone .js file', async () => {
    const root = makeRoot(true)
    const jsPath = join(root, 'broken-standalone.js')
    trackHtmlTemp(jsPath) // reuso el tracking — el path se computa de forma estable
    writeFileSync(jsPath, 'const x = 1;\nconst y = "a" : "b";\n')
    const checks = defaultChecksFor(['broken-standalone.js'], root)
    expect(checks.some((c) => c.cmd.startsWith('node --check '))).toBe(true)
    const [{ runChecks }, { RunLogger }] = await Promise.all([
      import('../run/checks.ts'),
      import('../run/logger.ts'),
    ])
    const logger = new RunLogger(root, 'a5-js-standalone')
    const results = await runChecks(checks, root, logger)
    const jsResult = results.find((r) => r.cmd.startsWith('node --check '))
    expect(jsResult).toBeDefined()
    expect(jsResult!.exitCode).not.toBe(0)
    expect(jsResult!.stderr).toContain("Unexpected token ':'")
  })

  it('roundtrip: jsCheckTempPath + cleanupJsCheckTemp remove the temp file', () => {
    const path = jsCheckTempPath('/nonexistent/abc/def.html')
    tempPathsToCleanup.push(path)
    writeFileSync(path, 'const x = 1;')
    expect(cleanupJsCheckTemp('/nonexistent/abc/def.html')).toBe(true)
    try {
      unlinkSync(path)
      throw new Error('expected ENOENT')
    } catch (e: any) {
      expect(e.code).toBe('ENOENT')
    }
  })

  it('runChecks marks a command timeout and kills the process', async () => {
    const root = makeRoot(false)
    const [result] = await runChecks(
      [{ cmd: 'sleep 1', timeout_ms: 10 }],
      root,
      new RunLogger(root, 'timeout'),
    )

    expect(result?.timedOut).toBe(true)
    expect(result?.exitCode).not.toBe(0)
  })

  it('runChecks keeps only the tail of oversized command output', async () => {
    const root = makeRoot(false)
    const [result] = await runChecks(
      [{ cmd: `${process.execPath} -e "process.stdout.write('x'.repeat(2500))"` }],
      root,
      new RunLogger(root, 'output-limit'),
    )

    expect(result?.exitCode).toBe(0)
    expect(result?.stdout).toHaveLength(2000)
    expect(result?.timedOut).toBe(false)
  })

  it('splitCommand preserves spaces inside single-quoted arguments', async () => {
    const root = makeRoot(false)
    const [result] = await runChecks(
      [{ cmd: "printf 'hello world'" }],
      root,
      new RunLogger(root, 'quoted-args'),
    )

    expect(result?.exitCode).toBe(0)
    expect(result?.stdout).toBe('hello world')
  })

  it('runChecks fails closed for an empty command', async () => {
    const root = makeRoot(false)
    const [result] = await runChecks([{ cmd: '' }], root, new RunLogger(root, 'empty-command'))

    expect(result).toMatchObject({ cmd: '', exitCode: 1, timedOut: false })
    expect(result?.stderr).toContain('empty command')
  })
})
