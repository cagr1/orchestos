# USO.10 — El Chat no tiene proyecto: conversa, no toca Dev

Decisión de Carlos (2026-11-13, GO): el modo Chat se comporta como el chat de Claude Desktop. Ningún chat del modo
Chat se liga a un proyecto, no ve sus archivos ni crea tareas. Los cambios de código se piden en Dev. (UI.9 ya lo
decía: "Modo Chat = chats sin proyecto"; se rompió.) Web y documentos van en USO.11, no aquí.

## Qué existe (verificado 2026-11-13)

- Causa: `src/dashboard/app/src/App.tsx:1332` `handleNewChat` crea la sesión con
  `newChatProjectId(currentProject?.id, selectedProjectId)` (`api/chat.ts:354`): por defecto, el proyecto activo.
  El servidor le pone `mode: 'code'` porque tiene proyecto (`handlers/chat-sessions.ts:307`) y el chat puede
  crear tareas (`handlers/chat.ts:1265`, `sessionAllowsTaskExecution`). En la DB real hay 0 sesiones generales.
- El modal de New chat del modo Chat ofrece elegir proyecto: `components/layout/NewAgentSelectorModal.tsx:41`
  (`chatProjectId`), `:101`, bloque `:152-180`; `ShellSidebar.tsx:452-458` le pasa el proyecto activo.
- La lista del Chat es la del proyecto activo: `App.tsx:513` `listSessions(activeProjectId || projects[0]?.id)`.
  Dev ya lista todas las sesiones del proyecto como agentes (`api/projects.ts:128-135`).
- Enviar sin hilo ya crea una sesión general: `App.tsx:~1475` `createSession({ projectId: null })`.
- Un chat general ya corre en una carpeta temporal y sin tareas: `handlers/chat.ts:1732-1734` (`isolatedCwd`),
  `:135` (instrucción "no associated project"), `:915` (`hasProjectContext`).
- Respaldo a la carpeta de arranque: `handlers/chat.ts:919-921` usa `legacyCwdProject()` para una petición de
  alcance general y `resolveDashboardProject(req)` (que cae en `legacyCwdProject`, `project-context.ts:49-61`) si
  no viene proyecto. Ese `root` alimenta `loadOrcheConfig(root)` (`:930`) y `cwd: root` del cliente API (`:1985`).
  Otros usos: `chat-sessions.ts:231`, `:264`; `ownership.ts:15`.

## Qué cambiar

1. Frontend
   - Modo Chat: New chat crea siempre `projectId: null` (modo `chat` lo pone el servidor). Quitar el selector de
     proyecto del modal cuando `isChatMode`.
   - La lista del modo Chat muestra solo sesiones generales (`listSessions('none')` o equivalente); las de proyecto
     siguen en Dev. El historial archivado del Chat, igual.
   - En un chat del Chat no se muestran tarjetas de tarea, aprobaciones ni evidencia de runs (no las habrá).
2. Servidor
   - Una sesión general nunca usa la raíz del repo de arranque como destino de escritura, `cwd` de un CLI o de un
     cliente API: `cwd` = carpeta aislada (la de `:1732`). La config del chat general sale de la config global del
     usuario, no del `orchestos.config.yaml` de la carpeta de arranque; si eso exige un cambio grande, dilo en el
     reporte en vez de improvisar.
   - Sin proyecto explícito (cabecera o `?project=<id>` registrado) ningún handler de chat crea tareas ni lanza
     ejecutores; `legacyCwdProject` queda solo para lecturas de config que hoy dependan de él, documentado.
   - Instrucción del chat general (`:135`): si piden crear o modificar archivos de un proyecto, decir que eso se
     hace en Dev. La UI muestra en ese caso un botón "Abrir en Dev" (puede ser fijo bajo la respuesta cuando el
     servidor marque el turno; elige el mecanismo más simple y explícalo).
3. Tests unitarios de lo anterior (handler: sesión general sin tareas ni cwd del repo; App/API: New chat de Chat sin
   proyecto). Mismo estilo que `src/dashboard/__tests__/chat-sessions.test.ts`.
4. ui-gates (`scripts/ui-gate/flows/`): los que crean tareas desde un chat del modo Chat (`auto-flow`,
   `chat-followup-task`, `chat-retry-report`, `chat-permissions`, `chat-roles`, `chat-turn-details`,
   `chat-task-undo`) deben crear la sesión en Dev, dentro del proyecto temporal. Los que solo conversan pueden
   quedarse en Chat sin proyecto. Ajusta los pasos que comprueban "new chat is linked to temporary project". No
   puedes correrlos (no hay CLIs en tu sandbox): déjalos coherentes y el cerebro los corre.

## Qué no tocar
Dev (`OrchestDevWorkspace.tsx`, creación de agentes, tareas de Dev), `run/executors/*`, el borde de lectura de
`external.ts` (H.9.2), `styles.css`/`index.css`. Sin migrar sesiones existentes en la DB. No commitear.

## Verificación
`bunx tsc --noEmit`, `bunx tsc -p src/dashboard/app/tsconfig.json --noEmit`, `bunx biome check` de lo tocado,
`bun test src/dashboard`, `bun run build:app`. Reporta qué ui-gates cambiaste y por qué.

## Segunda parte — Dev pinta las tarjetas de tarea (hallado al correr el ui-gate)

Tu primera parte ya está en el árbol (sin commitear; no la deshagas). `ui:gate chat-turn-details` falló en Dev:
el chat respondió que creó la tarea pero no apareció `[data-task-state="held"]`. Causa verificada: `TaskCard`
(`components/thread/TaskCard.tsx:238`) y `buildTaskCards` (`components/thread/taskCards.ts:62`) solo se usan en
`components/chat/OrchestChatView.tsx:33`, `:153`, `:542`; `components/dev/OrchestDevWorkspace.tsx` no los usa (sus
props, `:27-46`, no reciben tareas ni acciones). Antes de USO.10 las tareas se aprobaban desde chats de proyecto
del modo Chat; ahora la única vía es Dev y no tiene tarjetas. El texto de bienvenida del producto ya promete
"Dev: para pedir cambios. Aparece una tarjeta de tarea que se actualiza sola".

Qué cambiar: Dev muestra, en el hilo de la sesión activa, las mismas tarjetas de tarea que mostraba el Chat, con
las mismas acciones (Approve & Run / rechazar una tarea retenida, reintentar, commit del run, ver evidencia) y el
mismo seguimiento de estado. Reutiliza `TaskCard`, `buildTaskCards` y los handlers que hoy `App.tsx:~2073-2100`
pasa a `OrchestChatView` (`activeThreadTasks`, `approvals`, `onApproveHeldTask`, `onRejectHeldTask`,
`onRetryTask`, `onCommitRunTask`, `onViewEvidence`), calculados para la sesión activa de Dev. Sin componentes ni
CSS nuevos. Ajusta los ui-gates migrados solo si su localizador ya no aplica (no puedes correrlos). Mismas reglas
de "Qué no tocar" salvo que ahora sí tocas `OrchestDevWorkspace.tsx`. Misma verificación.
