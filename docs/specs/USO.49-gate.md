# USO.49 gate — `chat-retry-report` al día con el reintento automático y el botón Retry

Ítem: PLAN.md USO.49 (código ya en el árbol, sin commitear). Rol: criterio. No commitear ni tocar PLAN.md ni `src/`.

## Contexto (verificado)
- USO.49 cambia dos cosas: `task run --id` reintenta en la misma invocación hasta `MAX_RETRIES` (`src/cli.ts:1414`),
  y TaskCard muestra `Retry` en tarjetas `failed` no interrumpidas (`TaskCard.tsx:519`); `launchTask` reinicia
  `retry_count` si la tarea estaba `failed`/`failed_permanent` (`src/dashboard/handlers/tasks.ts:523`).
- Decisión nueva de Carlos (2026-11-23, `NEXT.md:16`: "reintento → visible y con botón") reemplaza la de RUN.1
  (`6bce134f`, 2026-11-05: "sin Retry"). El diagnóstico de RUN.1 se queda intacto.
- `scripts/ui-gate/flows/chat-retry-report.mjs` codifica lo viejo:
  - ~línea 193-205: espera `pending` con `retryCount === 1` tras el primer intento (el check falla siempre por
    `broken.ts`). Con USO.49 el mismo lanzamiento hace 3 intentos y termina `failed_permanent`, `retryCount 3`.
  - ~línea 280: paso `failed attempt has no Retry or Resume action`.

## Cambios en `chat-retry-report.mjs`
1. Esperar el estado terminal del primer lanzamiento (`failed_permanent`, `retryCount 3`, motivo `check failed`), no
   el `pending`/1. Ajustar los textos que esperan `Attempt 1/3` a lo que el reporte muestre realmente para la tarea
   agotada (leer `src/dashboard/handlers/task-report.ts:60-120` y `taskCards.ts` antes de decidir el texto).
2. Reemplazar el paso "no Retry or Resume" por: la tarjeta fallida (no interrumpida) muestra el botón `Retry` y no
   `Resume`.
3. Después de que el flujo quita `broken.ts`/`tsconfig.json` (ya lo hace), un paso que pulse `Retry` en la tarjeta y
   verifique por API que la tarea vuelve a correr con `retryCount` reiniciado (0 al lanzarse) y llega a `done`. Si eso
   choca con el escenario de árbol sucio que sigue, colócalo donde no interfiera y explícalo en el reporte.
4. Todo lo demás (diagnóstico, causa clasificada, sin uuid, árbol sucio, Commit & Run) se conserva.

## No tocar
`src/`, `restart-mid-run.mjs` (Resume de interrumpidas sigue igual), otros flujos.

## Verificación
`node --check scripts/ui-gate/flows/chat-retry-report.mjs` y `bunx biome check scripts/ui-gate/flows/chat-retry-report.mjs`.
El gate en vivo lo corre el cerebro: `bun run gate:evidence -- --label USO.49 -- bun run ui:gate chat-retry-report`.

## Ampliación (bloqueo reportado por criterio, verificado)
`src/dashboard/handlers/task-report.ts:76` solo arma `diagnosis` para `failed` o `pending` con reintentos; una tarea
agotada (`failed_permanent`, ahora el final normal de un lanzamiento con USO.49) queda sin diagnóstico y su headline
dice `failed_permanent` crudo. Permitido tocar **solo** `task-report.ts` y su test (`task-report.test.ts`):
- `failed_permanent` se trata como `failed` en `diagnosis` y en el headline: `✗ Task \`<id>\` failed · attempt
  <retry_count>/<MAX_RETRIES>` + proveedor/modelo; `attempt`/`maxAttempts` también en `data` para ese caso.
- `interrupted` no cambia.
- Test: tarea `failed_permanent` con `retry_count: 3` → diagnosis presente y headline con `attempt 3/3`.
Verificación extra: `bun test src/dashboard/handlers/task-report.test.ts`.
