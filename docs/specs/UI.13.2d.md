# UI.13.2d — Pantalla Tasks con datos reales (Lote L1, ítem 3)

Settings → proyecto → pestaña **Tasks** muestra hoy `initialMockTasks` (`App.tsx:107`). Pasa a leer
`tasks.yaml` real del proyecto por `GET /api/tasks`, y `Run Next Task` corre de verdad.
Regla UI.13: el JSX de la plantilla se conserva tal cual (className literal); solo se cambia la capa de datos
y se cablean los handlers. No tocar `/legacy` ni `src/dashboard/public/`.

## Cambios

1. **Backend — `src/dashboard/handlers/tasks.ts`** (`handleApiTasks` y su hermano `loadTaskRows`, ambos):
   cada fila añade `output: string[]`, `dependsOn: string[]`, `acceptanceCriteria: string[]`,
   `executorModel: string | null` (del campo de la tarea). Tipo en `src/dashboard/types.ts` `TaskRow`.
   Test que afirme los campos nuevos en la respuesta de `/api/tasks`.
2. **Front — capa de datos:** `src/dashboard/app/src/api/tasks.ts` con `listTasks(projectId)` que mapea
   fila → `TaskItem` (`depends_on`, `acceptance_criteria`, `output`, `outputSlice = output`,
   `assignedAgent` = engine/executor + modelo si existe, `retryCount`, `qaVerdict`, `runId`, `engine`)
   y devuelve también el `error` del wrapper `{exists,tasks,error}`. Reusar `getProjectTasks`/`runProjectTask`
   de `api/chat.ts` si sirve; no duplicar `fetch`. Test del mapeo.
3. **`App.tsx`:** `tasks` arranca en `[]` (fuera `initialMockTasks` de la pestaña Tasks) y se carga por
   `currentProject.id`, igual que `runs` (`App.tsx:271-289`). Se recarga al abrir Settings.
4. **`Run Next Task`** (botón de la pestaña y `onRunNextTask` del CommandPalette, `App.tsx:884` — hermanos):
   corre la primera tarea `pending` cuyas `depends_on` estén todas `done`, con
   `POST /api/tasks/:id/run` (header `x-orchestos-project-id`). Mientras la tarea esté `pending`/`running`,
   recargar la lista cada 2 s (tope 10 min) para que el badge cambie solo; al terminar, recargar también `runs`.
   Sin tarea corrible → botón `disabled` (nunca un botón que no hace nada). Error del POST → visible en la
   pestaña (una línea), no tragado.
5. **Estado vacío:** `Create First Task` lleva a Chat (las tareas solo entran por chat, regla de Carlos), no
   crea nada. Si `/api/tasks` devuelve `error` (tasks.yaml inválido), el EmptyState muestra ese error en vez
   de "No Tasks Defined".
6. Fuera de esta pasada (anotar, no tocar): `PlanBoardView` recibe las tareas reales pero sus acciones
   (`onRunTask`/`onExplainTask`/`onAddTask`) siguen sin cablear; `handleResetOrchestos` y
   `handlePurgeProjectData` siguen siendo locales; Graph/Memory/Specs/Skills/Instincts.

## Gate (lo que el cerebro va a medir)

Flujo nuevo `scripts/ui-gate/flows/tasks.mjs`, patrón de `chat-turn-details.mjs` (proyecto temporal con git,
`orchestos init` + `task init`, registrado por la API, `cleanup` que lo des-registra y borra la carpeta):
- La tarea a correr se deja como las crea el chat con el agente de Carlos para gates: **Codex ·
  gpt-5.6-luna · medium** (leer `resolveAgentSelection` en `src/dashboard/handlers/chat.ts` para los campos
  exactos). Si el executor `codex` exige `OS_ENABLE_EXEC_CODEX=1`, verificar que el dashboard del gate lo tiene;
  si no, reportarlo, no inventar un atajo.
- Pasos: abrir Settings → proyecto temporal → Tasks; se ven los ids y outputs del `tasks.yaml` temporal;
  **no** se ve ningún id del mock (`t1_sandbox_worktree`); clic `Run Next Task` → la API recibe el run de la
  primera tarea corrible (la dependiente sigue `pending`); el badge sale de `Pending` sin recargar la página y
  termina en el mismo estado que devuelve `/api/tasks`; 0 errores de consola.
- Verde: `bun run gate:all` + `bun run ui:gate tasks` + `bun run ui:gate smoke`.

## Reglas para el ejecutor

No invoques `codex exec` ni delegues a otro agente. No toques `tasks.yaml` de este repo (reproducciones por API
siempre con `x-orchestos-project-id` del proyecto temporal). No reportes "preexistente" ni "aislado" sin la
salida que lo demuestre. Al terminar: lista de archivos tocados y salida real de los comandos del gate.
