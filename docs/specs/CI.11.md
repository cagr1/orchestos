# CI.11 — `codex-live`: turno 2 a 180 s (fase 1: evidencia)

Ítem: PLAN.md § CI.11. Rol: `criterio-alt`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear
(`.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos. **PROHIBIDO `git stash`, `git checkout`,
`git restore`.**

## Defecto
Una vez, en la batería completa, el paso `turn 2 is faster than turn 1` (`scripts/ui-gate/flows/codex-live.mjs:326`)
vio 22 s contra 180 s (el timeout del flujo). Reproducido solo 3 de 3 verde el 2026-10-21 (turno 1 ≈10 s, turno 2
≈3–5 s). Hoy `dashboard.log` solo guarda `[chat-turn] received` por turno: si vuelve a fallar no se sabe si el tiempo se
fue en `thread/resume`, en `turn/start` o esperando al modelo (primer delta / `turn/completed`).

Esta fase solo deja evidencia; **no cambia comportamiento** (ni timeouts, ni reintentos, ni el orden de requests).

## Cambios
1. `src/run/executors/codex-app-server.ts`, camino de turno de chat (`thread/start`/`thread/resume` ~381–440,
   `turn/start` ~491, notificaciones ~315): una línea por fase con `console.error`, mismo estilo que `[chat-turn]` en
   `src/dashboard/handlers/chat.ts:831`:
   `[codex-turn] {"event":…,"threadId":…,"ms":…}` con `ms` = milisegundos desde el inicio de ese turno.
   Eventos: `thread-start` / `thread-resume` (al resolver, con `ms`), `turn-start` (al resolver), `first-delta` (primera
   notificación de texto del turno, una sola vez), `turn-completed`, y `turn-error` con mensaje recortado a 300
   caracteres si el turno rechaza o expira. Sin contenido del prompt ni de la respuesta (privacidad). Una helper
   privada pequeña; nada de logger nuevo.
2. Test en el `*.test.ts` existente de `codex-app-server` (con el `spawnProcess` falso que ya usan sus tests): un turno
   completo emite, en orden, `thread-start`, `turn-start`, `first-delta`, `turn-completed` (espiar `console.error`); un
   segundo turno sobre el mismo hilo emite `thread-resume` o, si el código no re-reanuda (ver comentario AT.20/AT.21
   ~417), ninguno de los dos: afirmar lo que el código hace hoy, no cambiarlo.
3. `scripts/ui-gate/flows/codex-live.mjs`, paso `turn 2 is faster than turn 1`: si falla, el detalle pasa a ser JSON con
   `turn1`, `turn2` y `codexTurn`: las líneas de `path.join(runDir, 'dashboard.log')` que contengan `[codex-turn]` o
   `[chat-turn]` (últimas 40). El `runDir` llega por el `ctx` (ya existe en `scripts/ui-gate/run.mjs`, CI.23; si el flujo
   no lo recibe, añadirlo a la desestructuración de la línea 64). Si pasa, el detalle no cambia.

## No tocar
Otros pasos, timeouts, el flujo `chat-streaming`, la lógica de hilos/reanudación.

## Verificación (pegar salida)
    bun run typecheck
    bunx biome check src/run/executors/codex-app-server.ts scripts/ui-gate/flows/codex-live.mjs <test tocado>
    bun test <test tocado>
    bun run gate:evidence -- --label CI.11-codex-live -- bun run ui:gate codex-live    # 14/14
    grep '\[codex-turn\]' <runDir>/dashboard.log     # las fases de ambos turnos con ms

## Corrección tras QA (2026-10-21) — aplicar sobre el diff actual
1. `src/run/executors/codex-app-server.ts`, `logTurn`: no registrar `error.message` (un error remoto puede repetir
   texto del chat). En su lugar `"kind"`: `"timeout"` si el mensaje termina en ` timed out` (lo genera `request()`
   localmente, ~209) con `"method"` = lo que va antes de ` timed out`; si no, `"kind":"error"` y `"name"` = `error.name`
   (o `typeof error` si no es `Error`). Nada más del error.
2. Test: un `turn/start` que responde con error cuyo `message` contiene `PRIVATE_CHAT_123` → ninguna línea
   `[codex-turn]` contiene `PRIVATE_CHAT_123`, y sí `"event":"turn-error"`. Otro: timeout de `turn/start` →
   `"kind":"timeout","method":"turn/start"` (si el test no puede forzar el timeout sin esperar 15 s, omitirlo y decirlo).
3. `scripts/ui-gate/flows/codex-live.mjs:~342`: la lectura de `dashboard.log` va en una función con `try/catch`; si
   falla, `codexTurn: ['dashboard.log unreadable: <error.code || error.message>']`. El `step` siempre se ejecuta.

Verificación: la misma de arriba (typecheck, biome, test, `codex-live` 14/14).

## Corrección 2 (cerebro, 2026-10-21)
`logTurn`: el regex de timeout pasa a `/^([\w/]+) timed out$/` (un método JSON-RPC, sin espacios); cualquier otro mensaje
cae en `kind:"error"`. Test: un error remoto con message `"secret words timed out"` → `kind:"error"`, sin `method`, y
la línea no contiene `secret`. Verificación: typecheck, biome, `bun test src/__tests__/codex-app-server.test.ts`.
