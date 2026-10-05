# R.8.1 — auto-flow estricto

Ítem: `PLAN.md` § R.8.1. Hallazgos 3-4 de `docs/done/evidence/R.8-revision-sol-2026-10-05.md`.
Único archivo a tocar: `scripts/ui-gate/flows/auto-flow.mjs`. Nada de `src/`.

## Contexto del producto (verificado leyendo el código)
- `src/dashboard/handlers/chat.ts:1104-1129`: la tarea creada por chat queda **retenida** (`held`, botón
  "Approve & Run") solo si alguno de sus `output` ya existe en el proyecto; si no, arranca sola.
- El reporte de fin (`src/dashboard/handlers/task-report.ts`) es `✓ Task \`<id>\` done · <provider>/<model>`
  y se persiste en `chat_messages` con `task_id`. Lo dispara tanto el arranque automático como
  "Approve & Run" (`src/dashboard/handlers/tasks.ts:417-423`, con `sessionId`).

## Cambios
1. **Fixture con archivo previo para el camino retenido.** Antes del commit "task scaffold" (`:260`), escribir
   `codex-nota.md` con `borrador viejo\n` e incluirlo en el commit. Así la tarea de Codex queda retenida
   y la de Claude (`claude-nota.md`, inexistente) arranca sola.
2. **Prompt de creación sin ambigüedad** (`:330`): `Crea el archivo ${filename} con exactamente este contenido, sin
   comillas ni nada más: nota de ${agent}` (agent en minúsculas). (Sustituido en la ronda 2.)
3. **Camino de aprobación con aserciones reales** (reemplaza `:351-363`; elimina los dos `true` literales).
   `createTask` recibe `expectHeld` (Claude `false`, Codex `true`).
   - `expectHeld === true`: paso `${filename}: held for approval` exige botón "Approve & Run" visible (hasta 30 s),
     y, ANTES del clic, la tarea en `/api/tasks` con `status === 'pending'` y sin `runId`, y el contenido de
     `codex-nota.md` todavía `borrador viejo`. Esperar 3 s y volver a comprobar que sigue `pending` sin `runId`
     (no arrancó sola). Luego clic y paso `${filename}: starts after approval`: en ≤60 s la tarea pasa a
     `running`/`done` o tiene `runId`, y el botón desaparece.
   - `expectHeld === false`: paso `${filename}: starts without approval` exige que el botón "Approve & Run" NO
     esté visible para esa tarea y que tenga `runId` o estado `running`/`done`.
4. **Exigir `done`** (`:365-369`): el paso `task finished` pasa solo si `finished.status === 'done'`.
5. **Contenido exacto**: `${filename}: exact content` pasa si `content.replace(/\r?\n$/, '') === \`nota de ${agent}\``.
6. **Persistencia de run** (`:406-417`): además de `result` no vacío, exigir `snapshot.run.status === 'done'`.
7. **Recarga final** antes de "no implementation text visible": recargar, volver a Chat, abrir el mismo hilo;
   paso `reload recovers task reports`: para cada tarea creada, algún `div.prose` contiene su `task.id` y `done`.
8. Si `sendMessage` o la espera de tarea fallan, devolver `null` sin pasos `true`.

## Ronda 2 (tras 1.ª corrida en vivo, 2026-10-05)
Corrida: ninguna de las dos peticiones creó tarea (`task created` FAIL ×2); con el prompt anterior pasaba 26/26.
La captura `after-reload` muestra el hilo sin mensajes y "Loading models…": se evaluó antes de cargar.
1. Prompt de creación: `Crea el archivo ${filename} con una sola línea: nota de ${agent}`.
2. Si `task created` falla, el detalle incluye los primeros 400 caracteres de la respuesta y `git status --porcelain`.
3. Recarga: esperar (≤30 s) a al menos un `div.prose` antes de buscar reportes; sin `taskIds`, falla con
   `no tasks to recover`.

## Fuera de alcance
QA en el reporte (R.8.3), reinicio del backend (R.8.4), `read-boundary.mjs` (cambios ajenos), CI.11.

## Verificación
`bunx tsc --noEmit`, `bunx biome check` del archivo y
`bun run gate:evidence -- --label R.8.1-auto-flow -- bun run ui:gate auto-flow` → todos los pasos PASS.
