# CMD.3 — `/cut` como comando propio de OrchestOS

Objetivo: en Dev, `/cut` cierra la sesión limpia con cualquier CLI: el agente cierra lo que lleva, deja el handoff,
commitea y sube; después el servidor comprueba sin tokens que no quede nada y muestra una tarjeta con el resultado y
"Continue in new session". GO de Carlos el 2026-11-19 (`PLAN.md` § CMD.3). Fuente del procedimiento:
`~/.agent-method/commands/cut.md`.

Verificado por grep el 2026-11-19 (releer las líneas antes de editar):
- `components/common/AgentComposer.tsx`: `SlashCommand` L183-188, `SLASH_COMMANDS` L203-208 (`/rename`, `/usage`,
  `/model`, `/archive`, `source: 'builtin'`), `slashCommandGroups` L210-251 (en Chat solo el grupo OrchestOS, L248),
  prop `mode` L306/L338, `handleSend` L746-757 (comandos propios → `onSlashCommand?.(command, argument)`),
  `handleSelectSlashCommand` L885-894. Cola de mensajes: `lib/chat-queue.ts` (`writeChatQueue` L25); drenaje
  `AgentComposer.tsx:853-883` (un mensaje sin `cli` toma cli/modelo/esfuerzo del composer).
- `App.tsx`: `handleSlashCommand` L1457-1477; `handleCreateAgentInProject` L1349-1385; `handleNewChat` L1388-1426
  (patrón `createSession` + `writeChatQueue`); `handleSendMessage` L1531 (mensaje optimista con `content` tal cual).
- `src/dashboard/chat-cli-commands.ts:11` `ORCHESTOS_COMMAND_NAMES`.
- Envío: `api/chat.ts:742` `sendMessage` → `POST /api/chat`; el system prompt lo arma el servidor
  (`handlers/chat.ts:1588`, `src/chat/chat-context.ts:144`). Raíz del proyecto en el turno: `handlers/chat.ts:968`
  (`root = project.root`; las sesiones Dev corren en la raíz, sin worktree).
- Tarjeta propia de punta a punta (patrón a copiar): `chat_messages.task_report` (`src/db/migrate.ts:840`),
  `appendTaskReport` (`src/db/chat-sessions.ts:434-452`), parse L176-184, `toMessageRow`
  (`handlers/chat-sessions.ts:97-131`), `ChatMessageRow`/`mapMessage` (`api/chat.ts:37-81`, L295-322), render en
  `OrchestDevWorkspace.tsx:811-830`. Última migración: versión 43 (`src/db/migrate.ts:1329`).
- Git en el servidor: `listDirtyFiles` (`src/run/sandbox-policy.ts:49`), `gitValue` (`handlers/project.ts:28`),
  `currentBranch` (`handlers/projects.ts:17`). No hay helper que compare con el remoto.
- Candado del método: `scripts/writer-lock.mjs` (`readLock` L16, archivo `agent-writer.lock` en el gitdir). Nada en
  `src/` lo lee hoy.

## Cambios

### 1. Menú (cliente)
- `SLASH_COMMANDS` suma `{ cmd: '/cut', label: 'Wrap up: hand off, commit and push', source: 'builtin' }`.
  Solo en Dev: `slashCommandGroups` lo quita del grupo OrchestOS cuando `mode === 'chat'`.
- `ORCHESTOS_COMMAND_NAMES` suma `'cut'` (un `/cut` del CLI no sale duplicado en su grupo).
- `/cut` NO pasa por `onSlashCommand`: en `handleSend`, en Dev, se envía como mensaje normal con el texto `/cut`
  (lo que se ve en el hilo es `/cut`). En Chat no aparece y, si se escribe a mano, el aviso es
  "/cut is available in Dev".

### 2. Servidor: el turno de `/cut`
- `POST /api/chat`: si `message.trim() === '/cut'`, la sesión tiene proyecto y no es general, el mensaje persistido
  sigue siendo `/cut` pero al CLI va el prompt de `cutPrompt({ hasNextMd })` (módulo nuevo `src/chat/cut-prompt.ts`).
  `hasNextMd` = existe `NEXT.md` en la raíz del proyecto.
- `cutPrompt` (inglés, genérico para cualquier LLM), en este orden:
  1. Item in progress: close it if its checks pass under the project's own rules (`AGENTS.md`/`CLAUDE.md`/plan); if
     not, leave it open and say exactly where it stopped and what is missing.
  2. Handoff: con `NEXT.md` → "rewrite NEXT.md as one present, not a log: what closed (with SHAs), what comes next
     and in what order, new traps, decisions pending; drop lines no longer true". Sin `NEXT.md` → "do not create
     NEXT.md; write the handoff as your final reply under a `## Handoff` heading with the same content".
  3. Commit by explicit paths (never the whole index); push if the project's rules allow it, in the foreground.
  4. Do not release locks or close the session: OrchestOS checks the result.
- Al terminar ese turno (éxito o error), el servidor corre `cutCheck(root, cliSessionId?)` (módulo nuevo
  `src/dashboard/cut-check.ts`, git por un `git()` inyectable para tests):
  - `dirty`: `git status --porcelain` (lista de rutas, máx. 20 + total).
  - `branch` y `upstream`: `git rev-parse --abbrev-ref HEAD` y `@{u}`; `ahead`/`behind` con
    `git rev-list --left-right --count HEAD...@{u}` contra la referencia remota local (sin `fetch`). Sin upstream →
    `upstream: null`.
  - `lock`: lee `<gitdir>/agent-writer.lock` (JSON con `session`). Si existe y `session` es el id de sesión del CLI de
    este chat (`chat_sessions.claude_session_id`, lectura en `src/db/chat-sessions.ts:303-313`; Codex no toma el
    candado, así que con Codex solo se informa) y `dirty` está
    vacío, lo borra → `lock: 'released'`; si es de otra sesión → `'held-by-other'`; sin archivo → `'none'`.
  - `handoff`: `'next-md'` si `hasNextMd` y `NEXT.md` cambió en el último commit o en el árbol; si no, el texto bajo
    `## Handoff` de la respuesta final del agente (máx. 4000 caracteres) o `null`.
- Resultado en una columna nueva `chat_messages.cut_report TEXT` (migración 44, con pre/postcondición como la 37),
  insertado como mensaje `assistant` con `appendCutReport(sessionId, report)` al estilo de `appendTaskReport`, y
  expuesto como `cutReport` en `toMessageRow` / `ChatMessageRow` / `mapMessage`.

### 3. Tarjeta (Dev)
- `components/thread/CutReportCard.tsx`, render junto a `TaskCard` en `OrchestDevWorkspace.tsx`. Estilo: copiar las
  clases de `TaskCard.tsx`; sin CSS nuevo.
  - Título "Session wrapped up" si `dirty` vacío y `ahead === 0`; si no, "Wrap-up incomplete".
  - Filas: "Working tree clean" o "N uncommitted files" (lista plegable); "Pushed to <upstream>" / "N commits not
    pushed" / "No upstream branch"; "Writer lock released" / "Writer lock held by another session" (sin fila si
    `none`); "Handoff in NEXT.md" / "Handoff in the last reply" / "No handoff found".
  - Botón "Continue in new session": crea una sesión Dev en el mismo proyecto con el mismo agente (patrón de
    `handleCreateAgentInProject`), abre su pestaña y encola con `writeChatQueue` el primer mensaje:
    con `next-md` → "Continue. Start from NEXT.md."; con texto → "Continue from this handoff:\n\n<handoff>"; sin
    handoff → "Continue." La sesión vieja no se toca.

## Qué no tocar
- Chat, OpenCode (su ventana tiene sus propios comandos), el `/cut` del método en `~/.agent-method`.
- Los demás comandos de `SLASH_COMMANDS` y los de CMD.1.
- Nada de `git fetch`, `push` o `commit` hecho por el servidor: eso es del agente.

## Tests (deben fallar sin el cambio)
- `src/chat/cut-prompt.test.ts`: con y sin `NEXT.md` (la variante sin pide `## Handoff` y prohíbe crear NEXT.md).
- `src/dashboard/cut-check.test.ts` con `git` falso: limpio y al día; sucio; ahead 2; sin upstream; candado propio y
  limpio → borrado; candado ajeno → se conserva; candado propio con árbol sucio → se conserva; extracción de
  `## Handoff`.
- Migración 44 (patrón de los tests de migraciones existentes).
- Handler de chat: `/cut` en sesión Dev persiste `/cut` y manda al CLI el prompt (con el adaptador falso que ya usan
  los tests de `handlers/chat`), y crea el mensaje con `cut_report`; en Chat general no se expande.
- `AgentComposer`/`slashCommandGroups`: `/cut` en Dev sí, en Chat no; `ORCHESTOS_COMMAND_NAMES` contiene `cut`.

## Gates
`bunx tsc --noEmit`, `tsc -p src/dashboard/app/tsconfig.json --noEmit`, `bunx biome check` de lo tocado, tests de
arriba más `src/db` y `src/dashboard/handlers`, `bun run build:app`. La verificación en vivo (Dev con Claude y con
Codex en un repo de prueba: `/cut` → commit → tarjeta → "Continue in new session") la hace el cerebro.
