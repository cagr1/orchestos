# ERP.4.9 — el hilo abierto muestra el fin de un reintento sin recargar

Rol: `criterio`. Eres el ejecutor: no delegues. No commitees ni toques `PLAN.md`.
Preflight: `bun run agent:preflight -- --item ERP.4.9 --agent claude --scope "src/dashboard/app/src/**,NEXT.md,PLAN.md,docs/**,.orchestos/feature-status.json"`.
Candado de escritor: te lanzó el cerebro que lo tiene y heredas `AGENT_WRITER_TOKEN`; escribes bajo su candado.
`writer-lock.js status` → `ocupado: claude …` es lo esperado, no un bloqueo: no pares por eso.
Hay cambios ajenos sin commitear (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`): no los toques.

## Síntoma (piloto ERP.4, hallazgo 17)
Tarea `chat-528621f9`: el intento 1 falló y el hilo mostró "✗ Task … failed · attempt 1/3". Tras recargar la página,
la tarjeta "Task ready to run" volvió a ofrecer "Approve & Run"; se pulsó, el run tardó 102 s y terminó `done`. El
hilo abierto siguió terminando en el "✗ failed" 3 minutos después; el "✓ Task … done" apareció solo al recargar.

## Causas (leídas en el código)
1. `runProjectTask` (`src/dashboard/app/src/api/chat.ts:449-479`) espera 60 s como máximo y lanza
   "remained pending after 60 seconds". `handleApproveHeldTask` (`src/dashboard/app/src/App.tsx:934-973`) tiene
   `try/finally` sin `catch`: ese error salta el `loadThreadMessages` de las líneas 966-971.
2. El efecto de polling del hilo (`App.tsx:300-372`) solo espera tareas con **exactamente un** mensaje en el hilo
   (línea 308) y, una vez visto el reporte, mete `${threadId}:${taskId}` en `reportedTaskIds` para siempre (líneas
   332 y 338). Una tarea con un intento fallido ya tiene 2 mensajes: su segundo intento nunca se espera.
3. El servidor escribe el reporte en el hilo entre 8 y 30 s después de que la tarea cambia de estado; recargar el
   hilo justo al cambiar el estado no basta: hace falta el polling.

## Comportamiento exigido
- El polling espera el reporte de **cada intento**, no solo del primero. Clave de "ya resuelto" por intento:
  `${threadId}:${taskId}:${n}`, con `n` = número de mensajes del hilo local con ese `taskId`.
- Candidatas: `taskId` distintos de los mensajes `assistant` no retenidos (`!taskHeld`) cuya clave no esté resuelta.
- Por cada candidata, en cada sondeo:
  - la tarea no existe → resolver la clave;
  - `isTaskStillRunning(task)` → recordar que se la vio corriendo (ref nueva, clave `${threadId}:${taskId}`) y seguir;
  - terminó, `n > 1` y **no** se la vio corriendo en esta sesión de página → resolver la clave sin pedir mensajes
    (hilo viejo abierto: no hay reporte nuevo que esperar; evita 6 lecturas por tarea al abrir un hilo);
  - terminó y (`n === 1` o se la vio corriendo) → `loadThreadMessages`; si el servidor trae más mensajes de esa
    tarea que el hilo local, fusionar como hoy (líneas 344-359), resolver la clave y olvidar el "vista corriendo";
    si no, contar el intento y resolver la clave al sexto, como hoy.
- La decisión por tarea vive en una función pura exportada en `src/dashboard/app/src/api/tasks.ts` (junto a
  `isTaskStillRunning`), que el efecto usa; el efecto conserva solo los refs, el `fetch` y el `setThreads`.
- `runProjectTask`: plazo de 10 minutos (el de `runTask`, `api/tasks.ts:108`); sondeo cada 250 ms durante los
  primeros 60 s y cada 2 s después. Sigue lanzando el mismo error si la tarea termina `failed`/`failed_permanent`.
- `handleApproveHeldTask`: la recarga del hilo (`loadThreadMessages` + `setThreads`) y `refreshUsage()` pasan al
  `finally`, de modo que un error de `runProjectTask` no las salte. El error se sigue propagando (el chat lo
  muestra en la tarjeta vía `taskActionErrors`, `OrchestChatView.tsx:409`).

## Tests (`src/dashboard/app/src/api/tasks.test.ts`)
Casos de la función pura, con nombres que digan el escenario:
- primer intento (`n = 1`) corriendo → esperar; terminado sin mensaje nuevo → reintentar, y resolver al sexto.
- segundo intento: `n = 2`, vista corriendo, terminada, servidor con 3 mensajes → fusionar y resolver.
- `n = 2`, terminada, nunca vista corriendo → resolver sin pedir mensajes.
- tarea inexistente → resolver.
El caso del segundo intento debe fallar con la lógica vieja (un `n === 1` fijo): compruébalo y dilo en el reporte.

## No tocar
Backend, `styles.css`, `OrchestChatView.tsx` (no se añade ningún botón ni texto), `scripts/ui-gate/**`, `PLAN.md`.
No añadir clases CSS.

## Verificación (corre y pega la salida)
`bun run typecheck` · `bun run lint` · `bun test src/dashboard/app/src/api/tasks.test.ts` · `bun run build:app` ·
`bun run ui:fidelity:jsx`. El gate en vivo lo corre el cerebro.
