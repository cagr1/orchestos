# UI.12.2 — Shell con la cara del prototipo: header, sidebar, estado vacío, panel derecho

Ejecutor: Luna. No commitear, no tocar `PLAN.md`. Contexto: `PLAN.md` § `UI.12` y las decisiones
de Carlos del 2026-09-21 en § `UI.10.A`. Guía visual: el prototipo en
`~/Documents/screens/orchestos-ai-agent-dashboard` — leer `src/components/layout/ShellHeader.tsx`
y `ShellSidebar.tsx`; las medidas de abajo salen de ahí. **Se copia el look, no la
estructura funcional**: donde este spec y el prototipo difieren, manda el spec. Los tokens ya
son los del prototipo (`UI.12.1`); usar `var(--…)`/clases de Tailwind mapeadas, nunca hex.

## Qué se ve al terminar

- Un **header de 44px que cruza todo el ancho**: a la izquierda el wordmark "Orchest**OS**", la
  lupa (paleta) y el botón de mostrar/ocultar sidebar; al centro el proyecto activo; a la derecha el
  único botón del panel derecho. Sin pill `IDLE`/`RUNNING`.
- Debajo: sidebar de 256px | contenido | panel derecho (cuando está abierto). La barra de estado
  de abajo (`SessionStatusBar`, uso de los CLI) **queda exactamente como está**.
- El sidebar se **oculta entero** con su botón (sin riel de iconos colapsado).
- Arriba del sidebar, el segmentado **Chat | Dev**.
- En Dev: proyectos con carpeta cerrada, chip con el número de agentes, y al hover chevron, `…` y
  `+`. El clic solo expande/colapsa. Agentes con loader o check. Área principal vacía con el logo
  hasta que se abre algo.
- `…` → **Project settings** → Settings, página del proyecto, que ahora tiene **todas** las
  pestañas del proyecto.

## Cambios

1. **Grilla** — `styles.css:189-205` (`.app`): el header pasa a una fila propia que ocupa las tres
   columnas; debajo `sidebar | main | rightpanel`; abajo el statusbar. `--header-h: 44px`. Borrar
   las reglas del sidebar colapsado a riel (`.app[data-sidebar="collapsed"] …`, el swap
   logo/botón del toprow): colapsado = columna de 0px. Conservar el resize-handle del sidebar.
   Regla que se mantiene de la memoria `feedback-ui-toprow-alignment-rules`: el header y el
   `#rpToprow` miden la misma altura (44px) y sin padding vertical propio.

2. **Header** (`public-src/islands/shell/Header.tsx`), como `ShellHeader.tsx` del prototipo:
   - Izquierda: wordmark (texto, 14px, peso 800; "OS" en `--accent`); botón lupa →
     `api.openCommandPalette()` (`id="navSearchBtn"`); botón `panelLeft` →
     `api.toggleSidebar()` (`id="navCollapseBtn"`). Botones 28×28, icono 14px, `rounded` de control,
     hover con `--surface`. Mover acá esos dos botones desde el toprow del sidebar (`Sidebar.tsx:115-143`),
     que desaparece.
   - Centro: icono de carpeta + nombre del proyecto del contexto (sesión de chat abierta con
     proyecto, o el proyecto de la página de Settings), en mono 12px. Sin rama: no hay API que la
     dé; no inventarla. Si no hay proyecto, nada.
   - Derecha: `id="rpToggle"`, icono `panelRight`, abre el inspector en la última herramienta usada
     (Explorer por defecto) o lo cierra. Activo = fondo `--accent-dim` y color `--accent`.
   - Quitar el pill `#statusBadge` y su CSS; sacar su excepción de `ui81`. Actualizar el
     comentario de cabecera de `Header.tsx` (la regla "el header no lleva iconos" queda
     reemplazada por decisión de Carlos del 2026-09-21).

3. **Sidebar** (`Sidebar.tsx`), como `ShellSidebar.tsx` del prototipo. Ancho 256px.
   - Arriba, con borde inferior: segmentado Chat | Dev (grilla de 2, `p-1`, fondo `--surface`,
     borde, radio de control; activo con `--surface-hi` e icono en `--accent`). Mismos ids que hoy
     (`shellModeChat`, `shellModeDev`).
   - **Chat:** botón "New chat" de ancho completo con borde (abre el `CliMenu` como hoy), rótulo
     "CHATS" (11px, bold, `--text-muted`, tracking), buscador (input 12px con lupa), filas de chat
     (`px-3 py-2`, 12px, icono de 14px, título truncado con `title`). El botón de borrar aparece al
     hover y **no puede ir dentro de otro `<button>`** (hoy `SessionRow` lo hace bien con `div
     role=button`; mantenerlo).
   - **Dev:** rótulo "PROJECTS" con `+` (agregar proyecto, `id="addProjectBtn"`, igual que hoy).
     Fila de proyecto (`px-2.5 py-1.5`, 12px, radio de control, hover con `--surface`):
     icono `folderClosed` 16px en `--accent`, nombre truncado en peso 500, y a la derecha el chip
     (píldora, mono 11px, borde, `--text-muted`) que se oculta al hover y deja ver tres botones de
     20px con icono 12px: chevron (`ChevronDown`/`ChevronRight`), `ellipsis`, `plus`. Atributos
     `data-project-id` en la fila y `data-project-action="toggle|menu|add"` en los botones.
     Iconos nuevos en el catálogo `ICON` de `data.js` (SVG de lucide): `folderClosed`, `ellipsis`,
     `chevronDown`, `chevronRight`, `panelRight`, `check`, `loader` si faltan.
   - **Clic en la fila o en el chevron = expandir/colapsar.** Borrar `api?.selectWorkspaceProject`
     de la fila.
   - **Contador real sin expandir:** al montar y cuando cambia `shell.sessionsVersion`, cargar las
     sesiones de todos los proyectos. Mientras no cargó, el chip no muestra número.
   - **Agentes:** lista con `ml-3 pl-3 border-l` (`--border`); fila `px-2 py-1`, 12px: a la
     izquierda loader (12px, `--warning`, girando) si `chatPendingBySession[id]` está activo, check
     (12px, `--success`) si pasó de pendiente a terminado mientras la página estaba abierta y el
     usuario todavía no la abrió, y si no el icono del CLI; título truncado; a la derecha el tiempo
     relativo en mono `--text-muted`. Exponer `chatPendingBySession` por `pushShellState`
     (`app.js:401,418,549`). Sin botón de cerrar agente todavía (necesita back; ítem aparte).
   - **Menú `…`**: popover (usar el `Popover` de `components/ui/popover.tsx`), 176px, radio de
     tarjeta, sombra, un ítem **Project settings** con engranaje (`data-project-menu-item="settings"`)
     → `state.settingsProjectId = id` y `App.go('settings')`. *Delete project* no se agrega acá: es
     `UI.9.9`, con su back.
   - Abajo, con borde superior: botón Settings (engranaje + texto) → Settings. **No** agregar las
     barras "CLI QUOTAS" del prototipo.

4. **Entrar a Dev** (`app.js:747-770`): restaurar la última sesión como hoy; si no hay, ir a
   `dev-empty`, nunca al `workspace` del primer proyecto. Quitar `{kind:'project'}` de
   `orchestos-last-dev`. `SCREENS['dev-empty']` (`screens-ops.js:~2434`) con proyectos: logo
   `assets/orchestos-mark.svg` 64px dentro de un cuadro con borde y radio de tarjeta, título
   "OrchestOS Dev" (20px) y el texto "No active agent session open. Select an agent from the sidebar
   or click + on a project to launch a CLI." (i18n en/es). Sin proyectos, el botón de agregar
   proyecto que tiene hoy.

5. **Página del proyecto en Settings con todas las pestañas** — `projectSettingsHead`
   (`screens-ops.js:11-26`): `tasks | runs | graph | memory | specs | skills | instincts | plan`,
   reusando los `SCREENS[tab].render/wire` que hoy monta `SCREENS.workspace`. Cada `fetch` de esas
   pantallas lleva el header del proyecto (`projectHeaders()` de `UI.10`); agregarlo donde falte.
   Con esto la pantalla `workspace` queda sin camino desde el sidebar: dejarla, no borrarla (se
   limpia al final de `UI.12`).

6. **Panel derecho** — ancho 384px. Mismas herramientas que hoy (Explorer, Diff, Terminal); el
   único control de abrir/cerrar es `#rpToggle` (el `#rpClose` de `RightPanelToprow.tsx` se queda
   porque también cierra el inspector de tarea). Quitar los tres botones de herramientas de la
   barra del workspace (`screens-ops.js:40-44`): ya no hacen falta.

## Gate en vivo — `scripts/ui-gates/ui12-shell.mjs`

`// Runtime: node`, reglas de `CI.2.A` (llegar clickeando, artefactos a un temporal, sin
`waitForTimeout` antes de afirmar). Dashboard real con ≥2 proyectos.

- En frío: header de 44px que empieza en x=0 y ocupa el ancho de la ventana; contiene wordmark,
  `#navSearchBtn`, `#navCollapseBtn`, `#rpToggle`; no existe `#statusBadge`.
- `#navCollapseBtn` oculta el sidebar (ancho 0) y lo vuelve a mostrar (256px ±1).
- `#shellModeDev`: se ve el logo del estado vacío y no hay `[data-workspace-project]`.
- Por proyecto, antes de expandir: el chip = largo de `/api/chat/sessions?project=<id>`.
- Sin hover, los `[data-project-action]` no son visibles (computado); con `hover()` sí, y el chip
  no. Centro vertical del chip y de los botones = centro de la fila (±1px).
- Clic en la fila: aparecen/desaparecen sus agentes; la pantalla no cambia.
- `…` → Project settings: Settings con `[data-project-title]` = nombre y 8 pestañas; clic en
  `tasks` y `runs`: sus fetch llevan el `x-orchestos-project-id` del proyecto.
- `#rpToggle` abre el panel (384px ±1) y lo cierra (0px).
- Cero errores de consola.

## Verificación del cerebro

`tsc`, `test:coverage`, `build:ui`; `ui12` 3/3; además `ui3-shell`, `ui9a-inspector`, `ui10`,
`ui81`, `ui0`: los que se rompan por un cambio pedido acá se actualizan en el mismo diff (llegando
clickeando), listados en el reporte con el motivo. Capturas de Chat, Dev vacío, Dev con un proyecto
expandido y hover sobre otro, y el menú `…`, comparadas a ojo con el prototipo.

## Fuera de esta pasada

Settings (layout, grupos, Executor: `UI.12.3`); chat (`UI.12.4`); History y cerrar/archivar
agentes; *Delete project* (`UI.9.9`); borrar la pantalla `workspace`; las barras "CLI QUOTAS" y
"SESSION CONTEXT" del prototipo (no se copian, decisión de Carlos).
