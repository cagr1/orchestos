# I.7.2 — El chat reporta el final de la tarea que lanzó (spec para Luna)

Ítem: PLAN.md § I.7.2. Plan aprobado por Carlos (2026-10-04, opción "con el hermano"). No reabrirlo.

## Hoy

- `src/dashboard/handlers/chat.ts:1108` lanza la tarea con `spawnTaskRun(root, created.id)` y el chat solo dice
  `▶ Started task <id>` (`chat.ts:1122`). Nadie se entera de cuándo termina.
- Aprobar una tarea retenida desde el chat (`App.tsx:859` → `runProjectTask` en `api/chat.ts:424` →
  `POST /api/tasks/:id/run`, `tasks.ts:381`) tampoco reporta.
- El frontend solo pide los mensajes al hidratar la sesión (`loadThreadMessages`, `App.tsx:152`).

## Cambios

1. **`src/dashboard/handlers/tasks.ts:326` `spawnTaskRun`** — quinto parámetro opcional `onExit?: () => void`.
   Guardar el `proc` de `Bun.spawn` y, si hay `onExit`, `void proc.exited.then(onExit).catch(() => {})`.
   Sin `onExit`: comportamiento idéntico.
2. **`src/db/chat-sessions.ts`** (junto a `appendChatExchange`, ~línea 230) — exportar
   `appendTaskReport(sessionId: string, taskId: string, content: string): ChatMessageRecord | null`:
   si `getChatSession(sessionId)` es null → `null`. Si no, en una transacción: `INSERT` en `chat_messages`
   (`role 'assistant'`, `model NULL`, `task_id = taskId`, `ocr_used '[]'`, `task_held NULL`,
   `existing_files NULL`, `turn_id NULL`, `created_at` = ahora ISO) + `UPDATE chat_sessions SET updated_at`.
   Devuelve el último mensaje de la sesión.
3. **Archivo nuevo `src/dashboard/handlers/task-report.ts`** — exportar
   `reportTaskOutcome(root: string, sessionId: string, taskId: string, projectId?: string | null): void`.
   Todo dentro de `try/catch` que solo hace `console.error` (nunca tira: corre en un callback de proceso).
   - Estado: `loadTasks(root).tasks.find(t => t.id === taskId)?.status` (si no existe la tarea: `missing`).
   - Run: `listRunsByTaskId(taskId)` (`src/db/runs.ts:199`); el primero con `project_id === projectId` si
     viene `projectId`, si no el primero.
   - Texto (markdown, el `status` va **literal**, el gate lo busca tal cual):
     - `done` → ``✓ Task `<id>` done · <provider>/<model>``
     - `pending` → ``⟳ Task `<id>` pending · retry scheduled``
     - cualquier otro → ``✗ Task `<id>` <status>``, más `· <provider>/<model>` si hay run.
     - Debajo, una línea en blanco y luego `> ` + resumen: si el estado es `done`, `run.result` y si no,
       `task.retry_reason ?? run.result`. Espacios colapsados a uno solo y recorte a 300 chars con `…`.
       Si no hay nada que resumir, `> No run was recorded.`
   - `appendTaskReport(sessionId, taskId, texto)`.
4. **`chat.ts:1108`** — si hay `session` (variable de `chat.ts:791`), pasar
   `spawnTaskRun(root, created.id, undefined, undefined, () => reportTaskOutcome(root, session.id, created.id, session.project_id))`.
   Sin sesión (camino legacy): igual que hoy.
5. **Hermano, `tasks.ts:381` `handleApiTasksRun`** — el body acepta `sessionId?: string`. Si viene y
   `getChatSession(sessionId)` existe, se pasa `onExit` con `reportTaskOutcome(root, sessionId, id, projectId)`.
   Si viene un `sessionId` desconocido, se ignora: no es error.
6. **Frontend**:
   - `src/dashboard/app/src/types/orchestos.ts:~185` `ChatMessage` suma `taskId?: string`; `mapMessage`
     (`api/chat.ts:190`) lo llena con `row.taskId ?? undefined`.
   - `runProjectTask` (`api/chat.ts:424`) suma un 4.º parámetro opcional `sessionId?: string` y lo manda en el
     body (`JSON.stringify(sessionId ? { sessionId } : {})`). `handleApproveHeldTask` (`App.tsx:862`) pasa
     `thread.id`.
   - `App.tsx`: un `useEffect` sobre `activeThread` (id + messages). Una tarea **espera reporte** si un
     mensaje assistant tiene `taskId`, no tiene `taskHeld` y es el único mensaje del hilo con ese `taskId`.
     Mientras haya alguna, cada 5 s `getProjectTasks(projectId)`. Si alguna de esas tareas ya no está en
     `pending`/`running` (o falta), `loadThreadMessages` y `setThreads` como en `App.tsx:879-882`. Marcarla
     en un `useRef<Set<string>>` para no volver a sondearla, y así el historial viejo sin reporte no sondea
     para siempre. Limpiar el intervalo al desmontar o al cambiar de hilo. Sin dependencias nuevas ni CSS:
     el reporte es un mensaje markdown normal.
7. **Gate `scripts/ui-gate/flows/auto-flow.mjs:370-388`** — reemplazar la lectura de `body` por:
   - esperar hasta 30 s (poll 1 s) a que algún `div.prose` contenga a la vez `task.id` y `finalStatus`
     (case-insensitive), y
   - tomar el `databaseSnapshot` **después** de esa espera y exigir además un mensaje con
     `role === 'assistant'`, `task_id === task.id` y `content` que incluya `finalStatus`.
   El paso sigue llamándose `${filename}: inline report`, con detalle `dom=<bool>; persisted=<bool>`. No tocar
   el resto del flujo.

## Tests (bun:test)

- `appendTaskReport`: inserta con `task_id`, devuelve el mensaje y para una sesión inexistente devuelve `null`
  sin insertar. Ubicarlo junto a los tests existentes de chat-sessions; si no hay, crear
  `src/db/chat-sessions.test.ts` con el patrón de DB temporal de `src/db/chat-turn-steps.test.ts`.
- `reportTaskOutcome` (`src/dashboard/handlers/task-report.test.ts`): `done` con run, `failed` con
  `retry_reason` y tarea sin run. Afirmar sobre el `content` persistido: estado literal, `provider/model` y
  recorte a 300.
- `handleApiTasksRun` con `sessionId` desconocido sigue respondiendo `{ ok: true }`. Si los tests existentes
  mockean `Bun.spawn`, cubrir que `onExit` se invoca; no spawnear CLIs reales.

## Gate (todo antes de reportar)

`bunx tsc --noEmit` · `bun run lint` · `bun test` **completo** · `bun run build:app` (el `dist/` está
versionado; incluirlo). Reportar la salida real de cada uno. El cerebro corre después `test:coverage`,
`gate:evidence I.7.2-chat-live` y `ui:gate auto-flow` en vivo fuera del sandbox.

## Fuera de alcance

Reporte si el dashboard se reinicia a mitad del run, cambios de estilo/CSS, el modal muerto de
`PlanBoardView.tsx:623`, `opencode`, cualquier otro flujo de ui-gate. No commitear ni tocar `PLAN.md`.
