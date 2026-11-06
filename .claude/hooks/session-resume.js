#!/usr/bin/env node
/**
 * Hook `SessionStart`: inyecta una consulta compacta de los ítems listos.
 *
 * El hook debe costar poco contexto y nunca impedir un arranque. `bun run next`
 * consulta `plan_items` y acota su salida; si Bun, la DB o el comando fallan,
 * este proceso sale en silencio.
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function nextContext() {
  try {
    const output = execFileSync('bun', ['run', '--silent', 'next'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 4_000,
    }).trim()
    return output || null
  } catch {
    return null
  }
}

function main() {
  const context = nextContext()
  if (!context) return
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          'Estado compacto del plan, obtenido con `bun run next`. PLAN.md y los commits siguen siendo la fuente durable.\n\n' +
          context,
      },
    }),
  )
}

try {
  main()
} catch {
  // Fallar abierto: un hook no puede romper el inicio de una sesión.
}
