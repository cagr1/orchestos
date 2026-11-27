# RUN.3.4 — Migrar el resto de flujos a `settled`

Contexto: `docs/specs/RUN.3-diagnostico.md` § 3 (lista y líneas). RUN.3.3 (cerrado, `3b281ded`) migró
`chat-retry-report`, `read-boundary` y `project-isolation`: copiar su patrón.

Helpers ya existentes en `scripts/ui-gate/lib.mjs`:
- `waitTurnSettled(api, projectId, sessionId, knownTurnIds, timeout)` → `{ turnId, settled }`.
- `waitLaunchSettled(api, projectId, taskId, previousLaunchId, timeout)` → `launch` (`{ id, startedAt, settled }`).
Selector de la respuesta persistida: `[data-turn-id="<turnId>"][data-settled="<outcome>"]`. Regla vigente en
`AGENTS.md` § Flujos: fin de turno = `settled` no nulo, no la respuesta de `POST /api/chat`.

## Cambios, por grupo

1. **Cambio de intento confundido con fin** — `auto-flow.mjs:29`, `runs-graph.mjs:26`, `custom-cli.mjs:153`,
   `restart-mid-run.mjs:246`: donde esperan un cambio de contador, de `runId` o `pending` con retry, esperar
   `waitLaunchSettled` (launch previo leído de `tasks[].launch?.id` antes de lanzar) y asegurar el `outcome`
   esperado. `restart-mid-run` prueba la recuperación tras reinicio: ahí el `outcome` esperado es `interrupted` si
   el flujo mata el runner; leer el flujo y elegir el que corresponda a lo que hoy asegura.
2. **HTTP + prosa / burbuja por índice** — `chat-context`, `chat-roles`, `chat-continuity`, `chat-readonly-shell`,
   `chat-timeout`, `chat-notices`, `session-message`, `notifications`, `usage-bar`, `auto-flow:41/:64`,
   `chat-followup-task`, `chat-task-roles`, `chat-task-undo`, `lessons`, `text-sweep`: cada envío de turno pasa a
   `knownTurnIds` + `waitTurnSettled`; la respuesta se lee por `turnId`, no por `div.prose`.last() ni índice.
   `chat-timeout` espera `outcome === 'failed'` y su `reason`; los que esperan éxito, `completed`. Si un flujo
   necesita la respuesta HTTP por un dato que solo viene ahí (p. ej. `autoTask`), puede seguir leyéndola, pero el
   fin lo marca `settled`.
3. **Inactividad agregada** — `chat-attachments` (`:220`, `:241`, estabilidad textual de 4 s), `chat-streaming`
   (`:291`, `:572`, `:831`), `chat-turn-details` (`:226`): sustituir la espera de "nadie trabajando + algún
   assistant" por `waitTurnSettled` del turno concreto. En `chat-streaming` solo cambia la espera de FIN; lo que
   observa durante el streaming (texto vivo) se queda.
- **Rechazo antes del turno:** un envío que el servidor rechaza antes de `beginTurn` (`src/dashboard/handlers/chat.ts`
  ~`:1052` modelo inválido, y cualquier 4xx cuya respuesta no traiga `turnId`) no crea turno: ahí la respuesta HTTP
  ES el fin y se sigue esperando con `waitForResponse`, asegurando además que no trae `turnId`. Regla general: si la
  respuesta trae `turnId`, el fin es `settled`; si no lo trae, no hubo turno. Aplica a `chat-notices` y a cualquier
  otro flujo con el mismo caso; no es motivo para parar.
- Si al migrar un helper `sendTurn` se repite igual en varios flujos, se puede mover a `lib.mjs`; no es obligatorio.
- Flujos ya precisos (`chat-stop`, `chat-restart-interrupted`, `qa-negative`) no se tocan.

## No tocar

- `src/`. Si un flujo muestra que falta algo en el contrato, parar y reportarlo.
- Los tres flujos de RUN.3.3.

## Verificación

- `bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows` y `bun run lint` exit 0.
- Correr FUERA del sandbox, una vez cada uno, solo los cuatro del grupo 1 y `chat-timeout`, `chat-streaming`,
  `chat-attachments` con `bun run gate:evidence -- --label run.3.4-<flujo> -- bun run ui:gate -- <flujo>`. El resto
  lo valida la nocturna (`scripts/nightly-ui-gates.ts`): no correrlos aquí.
- Un flujo que falla: diagnosticar si es el gate (se arregla) o producto (se reporta, no se parchea `src/`).
- Guardar resumen en `docs/done/evidence/RUN.3.4-live.json` (flujo, resultado N/M, ruta del log).
- Reportar diff y la lista de flujos tocados con el cambio de cada uno en una línea.
