# UI.11 — Sidebar de proyectos con la cara nueva

Ejecutor: Luna. No commitear, no tocar `PLAN.md`. Decisiones de Carlos en `PLAN.md` §
"DECISIONES DE CARLOS 2026-09-21" (UI.10.A). Referencias: `docs/ui-reference-patterns.md`,
capturas en `~/Documents/screens/` (`Orca1_main.png`), Circle (`ln-dev7/circle`,
`components/layout/sidebar/nav-teams.tsx` y `components/ui/sidebar.tsx`).

**Regla visual:** de Circle se toma la **anatomía y las medidas** (abajo, en números). Los
**colores no se tocan**: salen de los tokens del tema activo (`styles.css`). El toprow del sidebar
y sus 4 reglas (memoria `feedback-ui-toprow-alignment-rules`) quedan como están.

## Qué se ve al terminar

- En modo Dev, cada proyecto es una fila con icono de carpeta cerrada, su nombre y un chip con
  la cantidad real de agentes. Al pasar el mouse aparecen a la derecha tres iconos: chevron,
  `…` y `+`; sin hover no se ven.
- Clickear la fila **solo** expande o colapsa sus agentes. No cambia la pantalla.
- Al entrar a Dev sin una sesión que restaurar, el área principal queda vacía con el logo de
  OrchestOS.
- `…` abre un menú con **Project settings**, que lleva a Settings → página de ese proyecto. Esa
  página ahora tiene todas las pestañas del proyecto.
- Un agente que está trabajando muestra un loader chico; cuando termina, un check chico.
- Arriba a la derecha hay un botón fijo que abre y cierra el panel derecho.
- No existe el pill `IDLE`/`RUNNING`, y ningún tema se llama "Claude".

## Cambios

1. **Icono** — `src/dashboard/public/data.js`, catálogo `ICON`: agregar `folderClosed` (lucide
   `folder-closed`: el path de `folder` + `<path d="M2 10h20"/>`), `ellipsis` (lucide
   `ellipsis`: tres `circle r=1` en x=5,12,19 y=12), `chevronRight` si no existe, `check` y
   `panelRight` si no existen. SVG de lucide, `stroke-width 2`, igual que los que ya están.

2. **Fila de proyecto** — `src/dashboard/public-src/islands/shell/Sidebar.tsx`, el bloque de
   `projects.map` (~líneas 240-330). Reescribirlo como componente `ProjectRow` con Tailwind:
   - Fila `h-8`, `px-2`, `gap-2`, `rounded-md`, `text-sm`; hover con el fondo `--surface-hi`
     (o el token de hover que ya usa el riel). Icono de 16px, `shrink-0`. Nombre `truncate`.
   - Chip del contador: `text-xs`, `px-1.5`, `rounded-full`, color `--text-faint`, alineado al
     **centro vertical** de la fila (hoy el `⌄` queda abajo porque vive en una fila aparte,
     `.sidebar-agents-toggle`; esa fila desaparece).
   - Acciones a la derecha, en este orden: chevron (rota 90° al expandir), `…`, `+`. Cada una es
     un botón de 20×20 con icono de 14px. Visibles solo con `:hover` o `:focus-within` de la fila,
     y siempre visibles mientras el menú de ese proyecto está abierto. Mientras se ven, el chip se
     esconde (en Circle las acciones ocupan ese lugar).
   - Clic en la fila o en el chevron = expandir/colapsar. **Borrar la llamada a
     `api?.selectWorkspaceProject(project.id)`** de la fila (`Sidebar.tsx:258` y `:262`).
   - `+` hace lo mismo que hoy: expande y abre `CliMenu`.
   - `data-project-id` en la fila y `data-project-action="toggle|menu|add"` en cada botón (para
     el gate).

3. **Agentes del proyecto** — lista anidada como `SidebarMenuSub` de Circle: `border-l` con el
   color de `--border`, `mx-3.5`, `px-2.5`, `gap-1`. Cada agente: `h-7`, `text-sm`, icono del
   CLI de 14px, título `truncate`, a la derecha el tiempo relativo en `text-xs --text-faint`.
   - **Estado:** si `state.chatPendingBySession[session.id]` está activo, en lugar del icono del
     CLI va un loader de 12px (anillo con `animate-spin`, color `--text-faint`). Cuando esa
     sesión pasa de pendiente a no pendiente mientras la página está abierta, va un check de
     12px en `--success` (o el token verde del tema) hasta que el usuario abre esa sesión.
     Exponer `chatPendingBySession` por el puente de shell (`pushShellState`, donde hoy se
     setea/borra en `app.js:401,418,549`), igual que los demás campos de `useShell`.
   - El estado es de este navegador. Lo que corre en otra pestaña no se ve: está fuera de esta
     pasada, y se dice así en el cierre.

4. **Contador real sin expandir** — al montar, y cada vez que cambia `shell.sessionsVersion`,
   cargar las sesiones de **todos** los proyectos (`loadProjectSessions` por cada uno, ya
   existe). El chip muestra `sessions[project.id]?.length`; mientras no cargó, no se muestra
   ningún número (nunca un `0` falso).

5. **Menú `…`** — agregar `@radix-ui/react-dropdown-menu` (misma familia que los `@radix-ui` que
   ya están en `package.json`) y un `components/ui/dropdown-menu.tsx` al estilo shadcn. Menú
   `w-48`, `rounded-lg`, `side="right"`, `align="start"`, ítems con icono de 16px + texto.
   **Un solo ítem en esta pasada: Project settings** (icono de engranaje). `Delete project` entra
   en `UI.9.9`, con su back; no agregar un ítem que no haga nada.
   Project settings → `state.settingsProjectId = id` y `App.go('settings')`, o sea, la página de
   proyecto que armó `UI.10` (`screens-ops.js:11-26`). `data-project-menu-item="settings"`.

6. **Página del proyecto en Settings con todas las pestañas** — `projectSettingsHead`
   (`screens-ops.js:11-26`) pasa de `specs | skills | plan` a
   `tasks | runs | graph | memory | specs | skills | instincts | plan`, en ese orden, reusando los
   `SCREENS[tab].render/wire` que hoy monta `SCREENS.workspace` (`screens-ops.js:28-60`). Cada
   pestaña pide sus datos con el `x-orchestos-project-id` del proyecto elegido (el helper
   `projectHeaders()` de `UI.10`); revisar los `fetch` de tasks/runs/graph/memory/instincts y
   agregarlo donde falte. Sin el header, una escritura cae en el proyecto del cwd.
   El botón "Project settings" de la barra del workspace (`App.go('project')`, la danger zone) no
   se mueve en esta pasada.

7. **Entrar a Dev** — `App.setShellMode('dev')` (`app.js:747-770`): si la última cosa abierta
   fue una sesión, restaurarla como hoy. Si no, ir a `dev-empty`, **ya no** a
   `workspace` con el primer proyecto. `SCREENS['dev-empty']` (`screens-ops.js:2434`): con
   proyectos registrados muestra solo `assets/orchestos-mark.svg` centrado, 64px, opacidad 0.25;
   sin proyectos conserva el botón de agregar proyecto que tiene hoy. Quitar la entrada
   `{ kind: 'project' }` de `orchestos-last-dev` (ya no se abre un proyecto al entrar).

8. **Botón fijo del panel derecho** — en `Header.tsx`, a la derecha del todo, un botón con icono
   `panelRight` (16px, 28×28, `id="rpToggle"`) que abre el inspector en la última herramienta
   usada (Explorer por defecto) y lo cierra si está abierto. `#rpClose` se queda: también cierra
   el inspector de tarea, y `ui3`/`ui9a` lo usan (`app.js:3148`). Las tabs
   Explorer/Diff/Terminal de dentro del panel quedan igual. Los tres botones de la barra del
   workspace (`screens-ops.js:40-44`) se quedan: esa pantalla sigue existiendo por ahora.
   Esto reemplaza la regla "el header no lleva iconos" (`Header.tsx:4-7`): actualizar ese
   comentario con la fecha y el motivo (decisión de Carlos del 2026-09-21).

9. **Quitar el pill** `#statusBadge` de `Header.tsx:18-21` y su CSS. Revisar que nada más lo lea
   (`grep -rn statusBadge src scripts`); `ui81` lo exceptúa y hay que sacar esa excepción.

10. **Temas** — `theme.js:9`: `claude` → `carbon`. En `getTheme()`, si lo guardado es `claude`,
    devolver `carbon` y reescribir `localStorage`. `styles.css:121` `html[data-theme="claude"]` →
    `carbon`. Etiquetas en `i18n.js` (en/es): `orchestos` "OrchestOS", `dark2026` "Graphite",
    `carbon` "Carbon", `bright` "Light"/"Claro". El default sigue siendo `orchestos`; confirmar
    que es oscuro.

## Gate en vivo — `scripts/ui-gates/ui11-sidebar-projects.mjs`

`Runtime: node`. Reglas de `docs/specs/CI.2.A.md` (llegar clickeando, datos por `page.route`,
artefactos a un temporal). Dashboard real con al menos 2 proyectos registrados.

- En frío: click en `#shellModeDev`. El área principal muestra el logo y **no** hay
  `[data-workspace-project]`.
- Por cada proyecto, **antes de expandir nada**: el chip muestra el número que devuelve
  `/api/chat/sessions?project=<id>`.
- Sin hover, los tres `[data-project-action]` tienen `opacity 0` o `visibility hidden`
  (computado); con `hover()` sobre la fila, visibles. Afirmar el centro vertical del chip y del
  chevron contra el centro de la fila con `getBoundingClientRect()` (±1px).
- Click en la fila: aparecen sus agentes y la URL/pantalla no cambió.
- `…` → `Project settings`: se ve Settings con `[data-project-title]` = nombre del proyecto y las
  8 pestañas. Click en `tasks` y `runs`: cada fetch lleva el `x-orchestos-project-id` correcto.
- Loader/check: `page.route` sobre el endpoint de envío del chat que responda con 1.5s de
  demora. Abrir un agente, mandar un mensaje, afirmar el loader en su fila mientras espera y el
  check cuando termina.
- `#rpToggle` abre el panel (ancho > 0) y lo vuelve a cerrar (ancho 0), sin haber abierto antes
  ningún proyecto ni workspace.
- No existe `#statusBadge`. Settings → Language/tema: ninguna opción dice "Claude".
- Cero errores de consola.

## Verificación del cerebro

- `bunx tsc --noEmit`, `bun run test:coverage` verde, `bun run build` de las islas si aplica.
- `ui11` en verde, 3 corridas seguidas. Además correr `ui3-shell`, `ui9a-inspector`,
  `ui10-project-settings` y `ui81`: los que se rompan por un cambio **pedido acá** se actualizan
  en el mismo diff (llegando clickeando), con una línea en el reporte que diga cuál y por qué.
  Los que se rompan por otra cosa se reportan, no se tocan.
- Captura de Dev con un proyecto expandido y hover sobre otro, revisada a ojo contra
  `Orca1_main.png` y la sidebar de Circle.

## Fuera de esta pasada

`Delete project` (`UI.9.9`); el panel History y archivar agentes (pieza 3); cerrar/borrar la
pantalla `workspace` y la danger zone; el plan de otros proyectos (`UI.10.A`); las etiquetas del
plan en lugar de emojis; restilar el modo Chat más allá de lo que comparte la fila de agente.
