/**
 * src/run/html-script-check.ts — A.5 (Mes 22 / IDEAS #36)
 *
 * Cierra el gap que dejó pasar el bug de Mes 20 / C.1: el archivo `.html` generado
 * tenía un error de sintaxis JS real (`:` suelto donde iba `+` en una concatenación
 * dentro de `sortIcon()`) que rompía el script entero. Ni `tsc`/`bun test` (que ya cubre
 * `.ts`/`.tsx` vía `defaultChecksFor`) ni el juez QA-LLM lo detectaron — solo abriendo
 * la página de verdad en el navegador.
 *
 * Principio: para HTML con `<script>` inline, escribir el código extraído a un archivo
 * `.js` temporal y correr `node --check` sobre eso. Misma idea que `tsc --noEmit`: valida
 * sintaxis sin ejecutar, sin riesgo.
 *
 * Sin dependencias — solo APIs nativas (Bun tiene `crypto`, `fs`, `os`, `path`).
 */

import { writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join, basename, extname } from 'path'
import { createHash } from 'crypto'
import type { Check } from '../tasks/schema.ts'

export interface ExtractedScript {
  /** JS code exactly as it appears between the `<script>` and `</script>` tags */
  code: string
  /** 1-indexed start line in the original HTML — útil para que el mensaje de error sea trazable */
  startLine: number
  /** 1-indexed end line in the original HTML — inclusive */
  endLine: number
}

const SCRIPT_OPEN_RE = /<script\b([^>]*)>/gi
const SCRIPT_CLOSE_RE = /<\/script\s*>/gi

/** Tipos MIME / valores de `type=` que indican JS ejecutable. Whitelist explícita. */
const JS_SCRIPT_TYPES = new Set([
  '',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
  'module',
  'application/x-javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
])

/** Parsea el `type=` y el `src=` del interior de un tag `<script ...>` */
function parseScriptAttributes(inside: string): { type: string; hasSrc: boolean } {
  const typeMatch = inside.match(/\stype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
  const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '').toLowerCase().trim()
  const hasSrc = /\ssrc\s*=\s*/i.test(inside)
  return { type, hasSrc }
}

/**
 * Extrae todos los bloques `<script>` *inline* ejecutables de un HTML. Filtra:
 *   - `<script src="...">` — son archivos externos, ya cubiertos cuando aparezcan en `output[]`.
 *   - `<script type="application/json">` y otros no-JS — son data blocks (JSON, mustache, etc.)
 *     y `node --check` daría un falso positivo.
 */
export function extractInlineScripts(html: string): ExtractedScript[] {
  const result: ExtractedScript[] = []
  SCRIPT_OPEN_RE.lastIndex = 0
  SCRIPT_CLOSE_RE.lastIndex = 0

  let openMatch: RegExpExecArray | null
  while ((openMatch = SCRIPT_OPEN_RE.exec(html)) !== null) {
    const attrs = openMatch[1]
    const tagEnd = openMatch.index + openMatch[0].length
    if (attrs !== undefined) {
      const { type, hasSrc } = parseScriptAttributes(attrs)
      if (hasSrc || !JS_SCRIPT_TYPES.has(type)) {
        SCRIPT_OPEN_RE.lastIndex = tagEnd
        continue
      }
    }
    SCRIPT_CLOSE_RE.lastIndex = tagEnd
    const closeMatch = SCRIPT_CLOSE_RE.exec(html)
    if (!closeMatch) {
      break
    }
    const code = html.slice(tagEnd, closeMatch.index)
    const startLine = lineNumberAt(html, tagEnd)
    const endLine = lineNumberAt(html, closeMatch.index)
    result.push({ code, startLine, endLine })
    SCRIPT_OPEN_RE.lastIndex = closeMatch.index + closeMatch[0].length
  }
  return result
}

/** 1-indexed line number in `text` covering offset `offset`. */
function lineNumberAt(text: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++
  }
  return line
}

/** Path absoluto al archivo temp de check para un source path dado (determinístico por source). */
export function jsCheckTempPath(sourceAbsPath: string, tmpDir: string = tmpdir()): string {
  const hash = createHash('sha1').update(sourceAbsPath).digest('hex').slice(0, 10)
  const stem = basename(sourceAbsPath, extname(sourceAbsPath)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'script'
  return join(tmpDir, `orchestos-jscheck-${stem}-${hash}.js`)
}

/**
 * Construye un Check de `node --check <abs-path>` para un archivo `.js` declarado en
 * `output[]`. No verifica la existencia del archivo — esa decisión la toma el caller
 * (`defaultChecksFor` ya lo gatea con `existsSync` para evitar ruido cuando el LLM
 * omitió escribir el output, caso que el contrato cubre por otra vía).
 */
export function jsSyntaxCheckForJsFile(jsAbsPath: string, timeoutMs = 15_000): Check {
  return {
    cmd: `node --check ${quote(jsAbsPath)}`,
    timeout_ms: timeoutMs,
  }
}

/**
 * Construye un Check de `node --check <abs-tmp-path>` para los scripts inline de un `.html`.
 * Escribe los scripts concatenados a un archivo temp en `os.tmpdir()`. Devuelve `null` si
 * el HTML no tiene scripts inline (no se chequea nada — sin ruido). No verifica la existencia
 * del `.html` — eso lo gatea el caller.
 */
export function jsSyntaxCheckForHtmlFile(
  htmlAbsPath: string,
  htmlContent: string,
  options: { tmpDir?: string; timeoutMs?: number } = {},
): { check: Check; tempPath: string } | null {
  const scripts = extractInlineScripts(htmlContent)
  if (scripts.length === 0) return null

  const code = scripts.map(s => s.code).join('\n\n')
  const tempDir = options.tmpDir ?? tmpdir()
  mkdirSync(tempDir, { recursive: true })
  const tempPath = jsCheckTempPath(htmlAbsPath, tempDir)
  writeFileSync(tempPath, code, 'utf-8')

  return {
    check: {
      cmd: `node --check ${quote(tempPath)}`,
      timeout_ms: options.timeoutMs ?? 15_000,
    },
    tempPath,
  }
}

/** Quoting seguro para un argumento de shell — `node --check <path>` no interpreta
 * globs ni redirecciones, pero respetamos espacios en paths como `/var/folders/...`. */
function quote(p: string): string {
  if (/^[A-Za-z0-9_\-./\\]+$/.test(p)) return p
  return `"${p.replace(/"/g, '\\"')}"`
}

/** Borra el archivo temp asociado al source — útil en cleanup de tests. */
export function cleanupJsCheckTemp(sourceAbsPath: string, tmpDir: string = tmpdir()): boolean {
  try {
    unlinkSync(jsCheckTempPath(sourceAbsPath, tmpDir))
    return true
  } catch {
    return false
  }
}
