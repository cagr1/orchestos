# ERP.4.16 — Cada tarea terminada deja una entrada mecánica en Memory

Rol: `mecanico`. **Escribe bajo el candado del cerebro** (`AGENT_WRITER_TOKEN`, lo pasa `delegate`): si
`writer-lock status` dice `ocupado: claude`, es lo esperado; seguir. Los cambios sin commitear del árbol (`IDEAS.md`,
`orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json`) son ajenos: no tocarlos. Formatear lo
tocado con `bunx biome format --write` (nunca `prettier`). Fuente: `PLAN.md` § ERP.4.16. Decisión de Carlos (2026-10-13): la entrada es mecánica, sin LLM.
Lleva qué hizo la tarea, sus archivos y el veredicto de QA. No se agrega UI nueva en Settings.

## Problema (verificado en HEAD)
Hoy `memory_entries` solo se escribe al cerrar una subtarea que tiene `topic_key` (`src/run/scheduler.ts:200-204`).
Una tarea normal termina en `src/cli.ts` y no deja nada en Memory: la que pasa (rama `done`, `:1348`) y la que falla
para siempre (rama `failed_permanent`, `:1461-1465`). Por eso la pestaña Memory de Settings sale vacía.

## Qué cambiar
1. **Función nueva**, `recordTaskMemory`, en `src/db/task-memory.ts` (archivo nuevo). Es pura respecto al contenido y
   recibe:
   `{ projectId, taskId, description, outcome: 'done' | 'failed_permanent', files: string[], qaVerdict: 'pass' | 'fail' | null, qaReason?: string, provider?: string, model?: string, attempts: number }`.
   - Escribe con `upsertMemory(projectId, \`task/${taskId}\`, content, 'project')` (`src/db/memory.ts:79`). Ignora
     los `candidates` que devuelve: no crea conflictos.
   - El contenido es texto plano, sin LLM:
     ```
     Task <taskId> — done | failed
     <primera línea no vacía de la descripción, ≤ 200 caracteres>
     Files: a.ts, b.ts            (o "Files: none")
     QA: pass — <qaReason ≤ 200>  (o "QA: fail — <motivo>" o "QA: not run")
     Model: <provider>/<model> · attempts <n>
     ```
   - Si `projectId` falta, no escribe nada. Cualquier error se captura y se registra con `console.error`: nunca
     cambia el resultado de la tarea.
2. **Llamadas en `src/cli.ts`.**
   - Rama `done`, después de `updateTaskStatus`. Archivos: `result.filesWritten`. QA: `pass` con `result.qaReason`.
     Intentos: `t.retry_count + 1`.
   - Rama `failed_permanent`. Archivos: `[]`. QA: `fail` con `result.retryReason`. Intentos: `t.retry_count + 1`.
   - `projectId`: el que ya resuelve ese bloque. Si no lo resuelve, `getProject(root)?.id`.
   - `provider`/`model`: del `result`, si los trae. Si no, de la última fila de `listRunsByTaskId(taskId)`.
3. **Tests** en `src/__tests__/task-memory.test.ts`, con la DB aislada del preload:
   - una tarea `done` con 2 archivos genera exactamente una entrada `task/<id>` con el texto de arriba;
   - correr de nuevo la misma tarea actualiza esa entrada (sigue habiendo una sola);
   - `failed_permanent` deja "QA: fail";
   - sin `projectId` no escribe nada;
   - un error de la DB no se propaga.

## Gate en vivo
`scripts/ui-gate/flows/tasks.mjs` ya corre una tarea real de punta a punta. Después del paso en que la tarea queda
`done`, agregar dos pasos:
- `GET /api/memory?project=<id>` (el mismo que usa `api/projectTabs.ts:26`) devuelve una entrada con topic
  `task/<taskId>` que contiene "QA: pass".
- La pestaña Memory de Settings de ese proyecto muestra esa entrada. Usar los selectores reales de la vista
  (UI.26.5, `OrchestSettingsView.tsx`) y no cambiar la vista.

Contraprueba: con `cli.ts` de HEAD, `tasks` falla en el primer paso nuevo.

## Verificación (corre el ejecutor y pega las salidas)
- `bunx tsc --noEmit`
- `bun run lint`
- `bun test src/__tests__/task-memory.test.ts`
- `bun run test:coverage`
- `bun run ui:gate tasks`

## No tocar
- `scheduler.ts`, la UI de Settings, el esquema de la DB, `chat.ts`.
- No commitear ni tocar `PLAN.md`/`NEXT.md`.
- No `git stash`.
