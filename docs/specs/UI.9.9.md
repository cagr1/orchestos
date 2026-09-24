# UI.9.9 — `Delete project` quita del espacio de trabajo; la data solo se borra en Project settings

Semántica decidida por Carlos (PLAN.md § UI.9.9, no volver a preguntarla): `Delete project` del menú `…` es el
borrado **suave** — el proyecto sale de la lista y **ningún dato se toca**; al volver a agregarlo con
`+ Add project` reaparece con sus chats/tasks/runs. Borrar la data definitivamente vive en Project settings →
Danger Zone.

## Estado real (leído por el cerebro)
- Front ya existe y está cableado: menú `…` con `Project settings`/`Delete project` (`ShellSidebar.tsx:257-340`),
  `DeleteProjectModal.tsx`, `App.tsx:525 handleDeleteProject`, `handleOpenProjectSettings` (`App.tsx:455`).
- **Bug de semántica:** `DELETE /api/projects/:id` (`src/dashboard/handlers/projects.ts:33`) hace
  `deleteChatSessionsForProject` (borra los chats) y `deleteProject` (`src/db/projects.ts:76`) borra
  `context_chunks` y la fila de `projects`; con FKs `ON DELETE SET NULL` los runs/files/code_edges quedan sin
  proyecto → al re-agregar (mismo id, `hashPath`) no vuelven. Es un borrado duro disfrazado de suave.
- **Botón que no hace nada:** la Danger Zone de Project settings (`OrchestSettingsView.tsx:2105-2170`,
  "Borrar definitivamente los datos del proyecto") llama `App.tsx:539 handlePurgeProjectData`, que solo filtra
  estado del cliente; no hay endpoint.

## Cambios
1. **DB:** columna `removed_at TEXT` en `projects` (migración nueva en `src/db/migrate.ts`, con postcondición como
   las demás). `listProjects` (y todo lo que liste proyectos para la UI) excluye `removed_at IS NOT NULL`.
   `upsertProject`/`ensureProject` (el camino de `+ Add project`, `POST /api/projects/choose` e `init`) limpian
   `removed_at` → el proyecto reaparece con el mismo id y todo lo suyo.
2. **Borrado suave, `DELETE /api/projects/:id`:** solo marca `removed_at`. No borra chats, runs, files,
   context_chunks ni nada más. Si el proyecto removido era el activo, el front ya cambia a otro (`App.tsx:530`).
3. **Purga, endpoint nuevo `POST /api/projects/:id/purge`:** borra en una transacción todas las filas del proyecto
   en toda tabla con columna `project_id` (chat_sessions y sus mensajes, runs, files, code_edges, context_chunks, y
   las que haya — descubrirlas con `PRAGMA table_info`, no con lista a mano que se desactualice) y luego la fila de
   `projects`. Nunca toca la carpeta del repo ni su `tasks.yaml`. Funciona también sobre un proyecto ya removido.
4. **Front:** `handlePurgeProjectData` llama al endpoint, recarga proyectos/runs/historial y sale de Settings del
   proyecto. Texto del `DeleteProjectModal` y de la Danger Zone: decir la verdad en una línea (suave: "Sale de la
   lista; sus datos quedan. Vuelve al agregarlo de nuevo."; purga: qué borra). Borrar el resto del texto que no
   aporta (memoria `feedback-texto-que-no-aporta-desaparece`); no tocar className.
5. **Hermanos — gates y fantasmas:** todo `cleanup` de `scripts/ui-gate/flows/*.mjs` y el barrido de
   `scripts/ui-gate/run.mjs:105` pasan a usar la purga (si no, los proyectos temporales quedarían ocultos en la DB
   real). Cualquier otro llamador de `deleteProject`/`DELETE /api/projects` en `src/` y `scripts/`: revisar cuál
   de los dos quiere.
6. **Tests** (`bun:test`, DB temporal): borrado suave conserva chats/runs y `listProjects` no lo muestra; re-agregar
   lo restituye con el mismo id; purga deja 0 filas con ese `project_id` en todas las tablas.

## Gate (lo que el cerebro va a medir)
Flujo nuevo `scripts/ui-gate/flows/project-delete.mjs`:
- Proyecto temporal (patrón de `usage-bar.mjs`) con 1 chat real sembrado por la API y 1 run (el más barato que
  exista por la API; si no hay forma sin LLM, un turno real Codex · gpt-5.6-luna · medium).
- Hover sobre la fila → `Project actions` visible; menú con exactamente `Project settings` y `Delete project`.
- `Delete project` → confirmar → la fila desaparece de la barra lateral; SQLite (consulta de solo lectura desde el
  flujo) tiene todavía sus `chat_sessions` y `runs` con ese `project_id`.
- Re-agregar el mismo path (por la API que usa `+ Add project`) → la fila vuelve con el mismo id y el chat aparece
  en la lista del proyecto.
- `Project settings` del menú abre Settings del proyecto; Danger Zone → confirmar → 0 filas con ese `project_id` en
  toda tabla que lo tenga, y el proyecto ya no está.
- 0 errores de consola. Verde: `bun run gate:all` + `bun run ui:gate project-delete` + `smoke` + los flujos cuyo
  cleanup cambió (`tasks`, `runs-graph`, `project-tabs`, `usage-bar`, `chat-turn-details`).

## Reglas para el ejecutor
No invoques `codex exec` ni delegues. La DB real solo por la API y solo sobre el proyecto temporal. No
re-ejecutes `agent:preflight`. `bun run typecheck` completo; `bunx biome check . --diagnostic-level=error` = 0
errores; `bun run test:coverage` completo. Lista TODOS los archivos que toques. No hagas commit.
