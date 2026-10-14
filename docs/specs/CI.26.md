# CI.26 — `CC.2 — chat sessions backend` se cuelga a veces en `test:coverage`

Ítem: PLAN.md § CI.26. Rol: `criterio`. No commitear, no tocar PLAN.md, NEXT.md, IDEAS.md, `orchestos.config.yaml`,
`runs-summary.json`, `.orchestos/feature-status.json`, `docs/specs/UI.24.4.md`. **PROHIBIDO `git stash`, `git checkout`
y `git restore`.**

## Hechos (verificados por el cerebro 2026-10-14)

- Pre-push de `8701044` (`scripts/pre-push.sh`: HOME temporal, PATH mínimo, `bun run test:coverage`):
  `(fail) CC.2 — chat sessions backend > implements CRUD, immutable agent, persistence and cascade delete [5003.04ms]`.
  El stderr del subproceso (`runIsolated`, `src/dashboard/__tests__/chat-sessions.test.ts:19-60`) termina en
  `[chat-turn] {"event":"received","sessionId":…,"agent":null,…}` y el exit es 143 (muerto por el timeout).
  Esa línea sale de `handleApiChat` (`src/dashboard/handlers/chat.ts:827`) para la sesión `codex` de
  `chat-sessions.test.ts:323-326`, que el test espera en 502 (`:390`): codex no está en el PATH.
- Ya pasó una vez el 2026-10-13. A solas tarda 0.6–0.8 s, también con el entorno exacto del pre-push y `--coverage`.
  Solo falla dentro de la suite completa.

## Objetivo

1. Encontrar qué espera `handleApiChat` entre `received` y el 502 cuando el binario no existe: leer el camino desde
   `chat.ts:827` (p. ej. `readCliModelCatalogsCached` en `:906`, la resolución del binario, cualquier `await` con red,
   lock, spawn o timeout). Si hay una espera sin cota o con estado compartido entre tests (caché global, archivo en un
   HOME común, puerto), esa es la causa candidata; demostrarlo (p. ej. reproducir el cuelgue forzando la condición).
2. Arreglar en el producto si la espera es un defecto real (un chat que tarda segundos en decir "codex no está" lo es),
   o en el test si la dependencia es solo del fixture. Nunca subir el timeout como arreglo.
3. Si no se puede demostrar la causa: que el fallo deje evidencia la próxima vez (marcas de tiempo por fase en stderr
   del subproceso o del handler, ya existe `[cli-spawn]` en `src/run/executors/spawn-trace.ts`) y decirlo.

## Verificación (pegar salida real)

    bun run typecheck
    bun test src/dashboard/__tests__/chat-sessions.test.ts
    bun run test:coverage

Si hay causa demostrada: contraprueba (forzar la condición sin el arreglo → cuelga; con el arreglo → 502 rápido).
Reportar: causa (demostrada o inferida, decirlo), archivos tocados, salida.
