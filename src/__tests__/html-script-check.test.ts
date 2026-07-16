/**
 * A.5 (Mes 22 / IDEAS #36) — extractor de `<script>` inline ejecutables.
 * Verifica que:
 *   - Extrae scripts simples y múltiples.
 *   - Ignora `<script src=...>` (son externos — cubiertos aparte).
 *   - Ignora `<script type="application/json">` y otros no-JS (evita falso positivo de `node --check`).
 *   - Soporta `=>` y otros `>` legítimos dentro del cuerpo sin romper el regex.
 *   - Devuelve números de línea trazables.
 */
import { describe, it, expect } from 'bun:test'
import { extractInlineScripts } from '../run/html-script-check.ts'

describe('extractInlineScripts', () => {
  it('extracts one inline script with no attributes', () => {
    const html = `<!doctype html><html><body>
<script>
const x = 1;
</script>
</body></html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(1)
    expect(s[0]!.code.trim()).toBe('const x = 1;')
    expect(s[0]!.startLine).toBe(2)
    expect(s[0]!.endLine).toBe(4)
  })

  it('extracts multiple inline scripts preserving order', () => {
    const html = `<html>
<script>
const a = 1;
</script>
<main>hello</main>
<script>
const b = 2;
</script>
</html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(2)
    expect(s[0]!.code).toContain('const a = 1;')
    expect(s[1]!.code).toContain('const b = 2;')
  })

  it('skips scripts with src attribute (external)', () => {
    const html = `<html>
<script src="external.js"></script>
<script>
const x = 1;
</script>
</html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(1)
    expect(s[0]!.code).toContain('const x = 1;')
  })

  it('skips application/json script blocks (not executable JS)', () => {
    const html = `<html>
<script type="application/json">
{"foo": "bar", "n": 1}
</script>
<script>
const x = 1;
</script>
</html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(1)
    expect(s[0]!.code).toContain('const x = 1;')
  })

  it('skips text/template script blocks', () => {
    const html = `<html>
<script type="text/template">
{{name}}
</script>
<script>
const x = 1;
</script>
</html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(1)
  })

  it('includes type="module" scripts (still JS)', () => {
    const html = `<html>
<script type="module">
const x = 1;
</script>
</html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(1)
    expect(s[0]!.code).toContain('const x = 1;')
  })

  it('includes type="application/javascript" scripts', () => {
    const html = `<html>
<script type="application/javascript">
const x = 1;
</script>
</html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(1)
  })

  it('handles `=>` arrows inside the body without breaking the regex', () => {
    const html = `<html>
<script>
const f = (a, b) => a + b;
const r = f(1, 2);
</script>
</html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(1)
    expect(s[0]!.code).toContain('=>')
  })

  it('returns startLine and endLine that are 1-indexed and reflect original HTML', () => {
    const html = `<html>
<!-- separator -->
<script>
const x = 1;
</script>
</html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(1)
    expect(s[0]!.startLine).toBe(3)
    expect(s[0]!.endLine).toBe(5)
  })

  it('returns empty array when there are no scripts', () => {
    const html = `<html><body><p>hello</p></body></html>`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(0)
  })

  it('stops gracefully on unclosed <script>', () => {
    const html = `<html><body><script>const x = 1;`
    const s = extractInlineScripts(html)
    expect(s).toHaveLength(0)
  })
})
