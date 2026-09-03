#!/usr/bin/env node
/**
 * .claude/hooks/session-resume.js — H.7.4
 *
 * Hook `SessionStart`. Cumple el pedido textual de Carlos: *"si cierro el tab,
 * continuar donde me quedé sin que tenga que explicar qué estaba haciendo"*.
 *
 * Lee `.orchestos/handoff.md` (lo escribe H.7.2 vía `bun run agent:handoff`,
 * disparado por el hook de presupuesto de contexto de H.7.3) y lo inyecta como
 * contexto del arranque.
 *
 * Contrato verificado contra la doc oficial (`code.claude.com/docs/en/hooks`),
 * no supuesto: la salida es
 * `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}`.
 * `SessionStart` es además uno de los pocos eventos donde el stdout en texto
 * plano también entra como contexto, así que **todo lo que este hook imprima
 * cuesta tokens** — de ahí que el camino silencioso sea el default.
 *
 * Reglas de diseño, todas por el mismo motivo (este hook existe para ahorrar
 * contexto, no para gastarlo):
 *  - Handoff de más de 24h: **no se inyecta**. Estado rancio confunde más de lo
 *    que ayuda; solo se avisa en una línea de que el archivo existe.
 *  - Handoff ausente o ilegible: **silencio total**, exit 0. Fallar abierto —
 *    un hook que rompe el arranque es peor que un hook que no aporta.
 *  - Tamaño acotado: se trunca a MAX_CONTEXT_CHARS. Un handoff que crece sin
 *    control se volvería un impuesto fijo sobre cada sesión nueva.
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const HANDOFF_PATH = resolve(ROOT, '.orchestos/handoff.md')

/** Más viejo que esto, el handoff describe otra sesión de trabajo, no la que se retoma. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * ~2.000 tokens. El handoff real ronda los 1.6 KB; el techo está para que un
 * archivo degenerado no se cobre en cada arranque, no para recortar el normal.
 */
const MAX_CONTEXT_CHARS = 8_000

function main() {
  let stats
  let body
  try {
    stats = statSync(HANDOFF_PATH)
    body = readFileSync(HANDOFF_PATH, 'utf8')
  } catch {
    return // No hay handoff: nada que retomar.
  }

  if (body.trim() === '') return

  const ageMs = Date.now() - stats.mtimeMs
  if (ageMs > MAX_AGE_MS) {
    // Una línea, no el archivo: se avisa que existe y se deja la decisión a Carlos.
    console.log(
      `Hay un handoff de sesión sin usar en .orchestos/handoff.md, de hace ${formatAge(ageMs)}. ` +
        'No se inyectó por antiguedad; leelo si querés retomar ese trabajo.',
    )
    return
  }

  const context = truncate(body, MAX_CONTEXT_CHARS)
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          `Handoff de la sesión anterior (hace ${formatAge(ageMs)}), desde ` +
          `.orchestos/handoff.md. Es estado en vuelo, no fuente de verdad: ` +
          `PLAN.md y los commits mandan.\n\n${context}`,
      },
    }),
  )
}

function formatAge(ms) {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  return `${hours} h`
}

function truncate(text, limit) {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n\n[…truncado: el handoff supera ${limit} caracteres]`
}

try {
  main()
} catch {
  // Fallar abierto, sin ruido: nunca romper el arranque de una sesión.
}
