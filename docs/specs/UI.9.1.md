# UI.9.1 — Switch Chat | Dev, sidebar por modo y datos separados

Ítem: `PLAN.md` § UI.9. Decisiones de Carlos cerradas (no reabrir): switch explícito; Chat lista
solo sesiones `project_id NULL`; Dev lista sesiones por proyecto ("agentes"); el switch cambia
sidebar y canvas. Contexto: `NEXT.md`.

## Estado actual (leído 2026-09-15)

- `Sidebar.tsx:46-188`: toprow (logo, buscar, colapsar) → `Chat`/`Activity` → `Projects` con árbol
  proyecto → `N agents ⌄` (fetch perezoso `?project=<id>`) → filas de sesión → Settings.
- `screens-core.js:474-529`: `sessionsAside` dentro de la pantalla Chat (botón New chat + menú de
  CLI `cliMenu` `:490-505` + lista `st.chatSessions` con borrar). Listeners `:879-903`.
  CSS `screens.css:2101-2180` (`.chat-sessions-aside`, `.chat-new-menu-wrap`, `.chat-cli-menu`,
  `.chat-session-*`). Escape del menú: `app.js:3143`.
- `app.js:455` `fetchChatSessions()` pide `/api/chat/sessions` **sin proyecto** → el backend cae
  al proyecto del cwd (`project-context.ts:49-58`, `chat-sessions.ts:81-89`), no a las generales.
- `app.js:476` `startNewChatSession(agent)` y `app.js:536` `ensureChatSession()` hacen POST sin
  `projectId` → también heredan el proyecto del cwd. El backend ya acepta `projectId: null`
  explícito (`chat-sessions.ts:106-124`) y `listChatSessions(null)` ya existe
  (`src/db/chat-sessions.ts:112`).
- Shell API: `shell-api.ts:22-32`, implementación `app.js:3207-3226`. Store:
  `public-src/lib/shell-store.ts`.

## Cambios

### 1. Backend — listar chats generales

`handleApiChatSessionsList` (`src/dashboard/handlers/chat-sessions.ts:81`): si
`new URL(req.url).searchParams.get('project') === 'none'` → `listChatSessions(null)`, antes de
llamar a `resolveDashboardProject`. Nada más cambia en el backend.
Test en `src/dashboard/__tests__/chat-sessions.test.ts` (o el archivo de tests existente de ese
handler): con una sesión general y una de proyecto, `?project=none` devuelve solo la general;
`?project=<id>` solo la del proyecto.

### 2. Estado de modo (vanilla, dueño único)

`app.js`:
- `state.shellMode = localStorage.getItem('orchestos-shell-mode') === 'dev' ? 'dev' : 'chat'`.
- `setShellMode(mode)`: guarda en `localStorage['orchestos-shell-mode']`, `pushShellState({ shellMode })`
  y aplica el canvas:
  - `chat`: `state.screen = 'chat'`; si `localStorage['orchestos-last-chat-session']` existe en
    `state.chatSessions` (generales) → `App.switchChatSession(id)`; si no → `state.chatSessionId = null`
    y `state.chatHistory = []` (estado vacío actual del chat).
  - `dev`: leer `localStorage['orchestos-last-dev']` (`{"kind":"session"|"project","id","projectId"}`).
    `session` → abrir esa sesión en Chat con `state.workspaceProjectId = projectId`; `project` →
    `selectWorkspaceProject(id)`; nada o id inexistente → primer proyecto de `GET /api/projects`
    → `selectWorkspaceProject`; sin proyectos → `App.go('activity')`.
- Guardar "último usado": al abrir/crear una sesión general → `orchestos-last-chat-session`; al abrir/
  crear una sesión con proyecto → `orchestos-last-dev` kind `session`; en `selectWorkspaceProject`
  → kind `project`.
- Cambios de modo implícitos (una sola regla, en estas funciones y en ninguna otra):
  `selectWorkspaceProject` → `dev`; `App.go('activity')` y `App.go('workspace')` → `dev`;
  `openChatSession(id, projectId)` → `projectId ? 'dev' : 'chat'`; el botón
  `chat-open-workspace` (`screens-core.js:864`) → `dev`. Cambio implícito = mismo guardado +
  `pushShellState`, **sin** la navegación de canvas de arriba (ya está navegando).
- `fetchChatSessions()`: en modo `chat` pide `/api/chat/sessions?project=none`; en modo `dev` pide
  `?project=<state.workspaceProjectId>` (sin proyecto → `state.chatSessions = []`, sin fetch).
  Al terminar, `pushShellState({ generalSessions })` solo cuando se pidió `none`.
- `startNewChatSession(agent, projectId)`: segundo parámetro obligatorio (`null` o string), va en el
  body del POST. `ensureChatSession()` (`app.js:536`): body con
  `projectId: state.shellMode === 'dev' ? state.workspaceProjectId : null`; en `dev` sin
  `workspaceProjectId` → lanzar error con toast, no crear sesión.
- Contador `state.sessionsVersion`: `+1` en create/delete/rename de sesión, empujado al store.
- `boot()`: `pushShellState({ shellMode: state.shellMode })`. No navegar en boot más allá de lo que
  ya hace (home sigue siendo Chat en modo chat — memoria `feedback-home-siempre-chat`); si el
  modo persistido es `dev`, aplicar `setShellMode('dev')` una vez que `GET /api/projects` respondió.

### 3. Store y API del shell

- `shell-store.ts`: agregar `shellMode: 'chat' | 'dev'` (inicial `'chat'`), `generalSessions:
  SessionRow[]` (inicial `[]`), `sessionsVersion: number` (inicial `0`). `SessionRow` =
  `{ id, agent, title, updatedAt, projectId }` (exportado, lo reusa `Sidebar.tsx`).
- `shell-api.ts` + `window.OrchestOS` (`app.js:3207`): `setShellMode(mode)`,
  `openChatSession(id, projectId)` (cambia firma; actualizar el único llamador en `Sidebar.tsx`),
  `startNewChatSession(agent, projectId)`, `deleteChatSession(id)`, `cliModes()` →
  `state.executorModes?.modes ?? []`.
- `data.js` `ICON`: agregar `code` (SVG `</>` de 24×24, mismo estilo stroke que `chat`).

### 4. Sidebar por modo (`Sidebar.tsx`)

Toprow **sin cambios** (reglas 1–4 de sus comentarios y `ui3-shell.mjs` siguen valiendo). Debajo
del toprow, antes de `nav-sep`, fila nueva `.sidebar-mode-row` con segmented de dos botones
`NavButton`: `#shellModeChat` (ícono `chat`, tip `t('nav.mode.chat')`) y `#shellModeDev` (ícono
`code`, tip `t('nav.mode.dev')`), clase `active` en el del modo actual, `aria-pressed`. Expandido:
en fila, alineados a la izquierda. Colapsado: apilados verticalmente.

Modo `chat`:
1. `+ New chat` (`.nav-icon`, id `#sidebarNewChat`) → abre menú de CLI (ver 5) con `projectId null`.
2. Label `Chats` (`.sidebar-section-label`, `t('nav.section.chats')`) + lista de
   `shell.generalSessions`: filas `.sidebar-agent-row` (misma anatomía que las de agente: ícono del
   CLI, título, tiempo) con botón borrar `.sidebar-row-delete` (`×`, visible solo en hover/foco,
   `api.deleteChatSession`, `stopPropagation`). Activa = `shell.screen === 'chat' &&
   shell.chatSessionId === id`. Vacía → texto `t('chat.sessions.empty')`.
3. `grow` + Settings.

Modo `dev`:
1. `Activity` (entrada `activity` de `NAV`; ya no se pinta `chat` en este modo).
2. `Projects` + árbol actual (`Sidebar.tsx:111-179`) con dos cambios: la fila de proyecto lleva
   un botón `+` `.sidebar-row-add` (hover/foco, tip `t('nav.agent.new')`) que abre el menú de CLI con
   `projectId = project.id` y expande ese proyecto; y cuando `shell.sessionsVersion` cambia se
   re-piden las sesiones de los proyectos expandidos. `openChatSession(session.id, project.id)`.
3. `grow` + Settings.

Rail colapsado (ambos modos): ocultar por CSS `.sidebar-section-label`, `.sidebar-agents-toggle`,
`.sidebar-agent-row`, `.sidebar-row-add` y los textos; quedan íconos (`+`, proyectos, Activity,
Settings). Esto corrige el amontonamiento medido; el pulido fino es UI.9.3.

i18n (`i18n.js`, en y es, y su espejo en `public-src/lib/i18n.ts` si duplica claves): `nav.mode.chat`
("Chat"/"Chat"), `nav.mode.dev` ("Dev"/"Dev"), `nav.section.chats` ("Chats"/"Chats"),
`nav.agent.new` ("New agent"/"Nuevo agente").

### 5. Menú de CLI en el sidebar

Componente React `CliMenu` en `islands/shell/` (popover absoluto bajo el botón que lo abrió).
Ítems desde `api.cliModes()`: mismo contenido y mismas reglas que `screens-core.js:490-505`
(disponible → botón con ícono + `t('chat.modelfx.agentLabel.<id>')`; `detected === false` → fila
deshabilitada con motivo). Click → `api.startNewChatSession(id, projectId)` y cierra. Cierra con click
afuera y `Escape`. Íconos por CLI: los mismos de `cliIcon` (`screens-core.js:484-490`) vía
`api.icons`.

### 6. Borrar la lista duplicada del chat

- Quitar `sessionsAside` y su interpolación del layout de `SCREENS.chat`, `cliIcon`, `cliModes`,
  `cliMenu`, listeners `screens-core.js:879-903` (new/cli-agent/open/delete), `state.chatCliMenuOpen`
  y su Escape en `app.js:3143`.
- Quitar CSS `.chat-sessions-aside`, `.chat-new-menu-wrap`, `.chat-cli-menu*`, `.chat-session-*`,
  `.chat-sessions-*` de `screens.css`; el estilo que necesite `CliMenu` va a `styles.css` junto al
  sidebar, con tokens (sin `style=` inline; el trinquete de `ui81` no puede subir).
- `openWorkspaceButton` (`screens-core.js:480-483`) se queda.
- Si el canvas del chat usaba grid de dos columnas por el aside, pasa a una columna.

## Qué NO tocar

- Toprow del sidebar, `Header.tsx`, panel derecho / `SidePanel` (UI.8.4c en pausa).
- Rename Runs→Activity, estado vacío nuevo del chat, buscar chats, agregar proyecto (UI.9.2–9.4).
- Workspace y sus tabs. Pantalla legacy `tasks`.
- `PLAN.md`, commits.

## Cómo se verifica

1. `bunx tsc --noEmit`; `bunx biome check` en archivos tocados (0 errores); `bun run build:ui`.
2. Test del handler (sección 1) y `bun run test:coverage` completo en verde.
3. `grep -rn "sessionsAside\|chat-sessions-aside\|chatCliMenuOpen\|chat-session-item" src scripts
   --exclude-dir=node_modules` sin resultados fuera de `dist/` regenerado.
4. `node scripts/ui-gates/ui3-shell.mjs` y `node scripts/ui-gates/ui81-visual-consistency.mjs` en
   verde. Si un criterio de `ui3-shell.mjs`, `s6-sprint-board.mjs` o `s6a-sprint-board.mjs` asumía
   `data-nav="chat"` y `data-nav="activity"` a la vez, fijar el modo por `localStorage` antes de
   medir — no borrar criterios.
5. **Gate en vivo** (dashboard real + Playwright, viewport 1440×900), evidencia
   `docs/done/evidence/UI.9.1-live.json` con valores medidos y capturas en
   `docs/done/evidence/UI.9.1/`:
   - Datos: usar los proyectos de `GET /api/projects`. Prerrequisito: UI.9.4 cerrado y ≥2 proyectos
     agregados desde la UI. Si hay menos de 2, **parar y reportar** — nunca registrar por CLI. Crear por API ≥5 sesiones generales (`projectId: null`) y ≥3 por cada
     uno de 2 proyectos; guardar sus ids y **borrarlas todas al final** (DELETE), dejando la DB
     como estaba.
   1. Modo Chat: sidebar muestra solo las generales (ids exactos), ninguna de proyecto; no existe
      `Activity` ni árbol; canvas Chat sin aside de sesiones (`.chat-sessions-aside` ausente).
   2. `+ New chat` → elegir un CLI detectado → la sesión nueva aparece arriba en Chats y su
      `projectId` (GET) es `null`.
   3. Switch a Dev: sidebar con Activity + árbol; expandir proyecto A muestra solo sus sesiones,
      proyecto B solo las suyas; ninguna general.
   4. `+` en proyecto A → CLI → sesión nueva con `projectId` = A, visible bajo A sin recargar.
   5. Canvas: volver a Chat abre el último chat general usado; volver a Dev abre el último agente
      o proyecto usado. Recargar conserva el modo.
   6. Enviar un mensaje en modo Chat desde el estado sin sesión (`ensureChatSession`) crea sesión con
      `projectId null`.
   7. Rail colapsado en ambos modos: captura sin textos solapados (bounding boxes de los íconos
      visibles sin intersección).
   8. Regresión UI.8.4b: sesión con trabajo persistente → "Open in Workspace" abre el workspace y
      el modo pasa a Dev.
   Bajar el dashboard si lo levantó el gate.

## Evidencia de cierre

`docs/done/evidence/UI.9.1-live.json` + capturas. Borrar este spec en el commit de cierre.
