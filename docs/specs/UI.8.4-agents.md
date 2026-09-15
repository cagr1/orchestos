# UI.8.4 (pieza 1/2) — agentes como filas colapsables en el árbol de proyectos

Contrato en `PLAN.md:1762-1772` (§A.2/§A.3/§A.4 de `docs/ui-reference-patterns.md`). Primera de
dos piezas de UI.8.4 — **esta pasada NO incluye** el contrato Chat→Workspace (pieza 2, después).
Extiende el árbol de proyectos que `UI.8.3` ya dejó en `Sidebar.tsx` (fetch de
`GET /api/projects`, filas con `data-project-id`).

## Alcance exacto

Por cada proyecto en el árbol: header colapsable `N agents ⌄` (contador real, no fijo) que
expande/colapsa una lista de filas, una por **sesión de chat** de ese proyecto (`chat_sessions`
es la fuente — ya se decidió en UI.8.2 que `agents` no es tabla propia). Fila de agente:
`[glifo del agente] [título truncado] [tiempo relativo]`. Sin borde, sin caja, sin badge de color
(anatomía literal de §A.2). Clic en una fila abre esa sesión en Chat (`state.screen = 'chat'`,
`state.chatSessionId = <esa sesión>`, mismo camino que `App.switchChatSession` ya usa en
`app.js:471-481`).

### Cómo obtener las sesiones de un proyecto que NO es el proyecto legacy-cwd

`GET /api/chat/sessions` hoy filtra por `resolveDashboardProject(req).id`
(`src/dashboard/project-context.ts:49-57`), que sin header cae al cwd del proceso — por eso el
árbol de UI.8.3 no puede listar sesiones de un proyecto distinto al que corre el dashboard.
**Solución acotada, sin abrir ERP.2 completo:** `resolveDashboardProject` ya acepta
`url.searchParams.get('project')` como alternativa al header (misma función, línea 51-52) — usar
`GET /api/chat/sessions?project=<id>` al expandir el header de cada proyecto. Esto NO es ERP.2
(que filtra tasks/runs/graph/memory/specs/skills — nada de eso se toca acá), es un uso puntual de
un parámetro que el backend ya soporta para una sola llamada.

### Selección — único contenedor con borde (§A.3)

Solo la fila **activa** (proyecto seleccionado en el workspace, o sesión de chat abierta) tiene
borde + fondo levemente más claro. Todo lo demás plano — ya es así para la fila de proyecto
(`className` con `' active'` condicional en `Sidebar.tsx`); extender el mismo patrón a la fila de
sesión activa (`state.chatSessionId === session.id` cuando `state.screen === 'chat'`).

### Anomalía inline (§A.4) — alcance mínimo

Si la última respuesta de una sesión falló (`status: 'failed'` o `'interrupted'`, ya expuesto por
`GET /turn-status` / lo que ya use `chatTurnStatus` en `app.js`), la fila de esa sesión muestra un
pill ámbar chico inline (mismo patrón visual que ya existe para otras anomalías en `screens.css` —
grepear `amber` antes de inventar una clase nueva). Si conseguir ese dato requiere un fetch nuevo
por sesión (N+1), **no lo hagas** — usar solo lo que ya esté disponible en el estado sin fetches
adicionales; si no está disponible sin costo, omitir el pill en esta pasada y anotarlo como
pendiente explícito (no fingir la anomalía).

## Dónde

- `src/dashboard/public-src/islands/shell/Sidebar.tsx` — la sección de árbol de proyectos que
  UI.8.3 dejó (fetch de `/api/projects`, filas `data-project-id`).
- Necesita un componente nuevo pequeño (`ProjectAgentRows` o similar) en el mismo archivo o uno
  hermano — no un archivo gigante nuevo.
- `shellApi()`/`shell-api.ts` si hace falta exponer una acción nueva (p. ej.
  `openChatSession(sessionId)`) — seguir el patrón ya usado por `selectWorkspaceProject`.
- Icono de agente: ya expuesto vía `icons: { ...ICON, ...AGENT_ICONS }` en `shellApi()`
  (`app.js:3208`) — usar `api.icons[session.agent]`, no reinventar el mapeo.
- Tiempo relativo: no existe helper hoy (grepeado, confirmado) — escribir uno chico y local
  (minutos/horas/días, sin librería nueva) en el mismo archivo, no una utilidad global todavía.

## Qué NO tocar

- El contrato Chat→Workspace (pieza 2 de UI.8.4, después).
- Ningún endpoint de tasks/runs/graph/memory/specs/skills — el filtro por proyecto de ESOS es
  ERP.2, explícitamente fuera de esta pasada.
- El inspector condicional (también UI.8.4, pero no es esta pieza — confirmar con el cerebro antes
  de tocarlo si aparece la tentación).
- UI.8.5 (barra de estado, Settings, chips, barra de contexto) — ítem aparte, no mezclar.

## Cómo se verifica

1. `bunx tsc --noEmit` limpio.
2. `bunx biome check` sobre los archivos tocados, 0 errores.
3. `bun run build:ui` — **obligatorio, no lo olvides** (UI.8.3 lo tuvo que hacer de vuelta porque
   se olvidó la primera vez: el navegador sirve un bundle estático, no se reconstruye solo).
4. `bun run test:coverage` completo en verde.
5. **Gate en vivo, navegador real:** con al menos un proyecto que tenga 2+ sesiones de chat
   (crear un par vía el mini-menú de ERP.1 si no existen), expandir su header de agentes, ver las
   filas reales con icono+título+tiempo, click en una abre esa sesión en Chat, la fila
   correspondiente queda marcada como activa (borde), colapsar el header oculta las filas.
   Confirmar con un segundo proyecto (temporal, registrado como en el gate de UI.8.3) que sus
   sesiones no se mezclan con las del primero.

## Evidencia de cierre

`docs/done/evidence/UI.8.4-agents-live.json`. Borrar este spec en el commit de cierre.
