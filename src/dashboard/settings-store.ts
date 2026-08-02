import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'

/**
 * Honra `ORCHESTOS_HOME` — misma convención que `db/sqlite.ts`,
 * `router/model-catalog.ts` y `router/opencode-catalog.ts`. Este módulo era el
 * único que la ignoraba y apuntaba siempre al `~/.orchestos/.env` REAL, lo que
 * hacía imposible testear el camino de escritura sin arriesgar las keys de
 * verdad del usuario (ver [[reference-test-fixtures-leak-into-real-db]]).
 * Detectado al corregir L62-002 en el gate L.6.2 (2026-08-02).
 *
 * Se resuelve por llamada, NO se captura en un `const` a nivel de módulo: los
 * tests mutan `process.env.ORCHESTOS_HOME` en beforeEach/afterEach y un valor
 * capturado al importar quedaría obsoleto — mismo gotcha ya documentado en
 * `model-catalog.ts:96-99`.
 */
function envHome(): string {
  return process.env.ORCHESTOS_HOME || homedir()
}

function envFilePath(): string {
  return join(envHome(), '.orchestos', '.env')
}

const SETTINGS_KEYS = ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_HOST'] as const

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function maskKey(v: string): string {
  if (!v) return ''
  if (v.length <= 8) return '••••••••'
  return v.slice(0, 6) + '••••' + v.slice(-4)
}

function readEnv(): Record<string, string> {
  try {
    const file = envFilePath()
    if (existsSync(file)) return parseEnvFile(readFileSync(file, 'utf-8'))
  } catch {}
  return {}
}

function writeEnv(data: Record<string, string>): void {
  mkdirSync(join(envHome(), '.orchestos'), { recursive: true })
  const content = Object.entries(data).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
  writeFileSync(envFilePath(), content, 'utf-8')
}

export { envFilePath, SETTINGS_KEYS, parseEnvFile, maskKey, readEnv, writeEnv }
