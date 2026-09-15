# UI.8.3 — matar la navegación vieja, rail de 3 zonas

Contrato en `PLAN.md:1732-1743` (absorbe UI.7). Tercer paso de la Entrega 2 (`NEXT.md`), después
de UI.8.1/UI.8.2 (cerrados). El ítem más grande de esta entrega — leer completo antes de tocar
código, no improvisar sobre la marcha.

## Alcance de ESTA pasada (leer antes de empezar)

El texto del ítem dice "las 7 capacidades pasan a tabs de la entidad seleccionada" — eso describe
el estado final, no exige reconstruir las 7 pantallas. **Esta pasada monta un contenedor de tabs
que reusa el `render()`/`wire()` de cada `SCREENS.*` existente tal cual, sin reescribir su
interior.** Rehacer cada pantalla es trabajo de otros ítems (UI.4, pausado a propósito hasta que
esto exista). El árbol de proyectos de esta pasada muestra el/los proyecto(s) ya registrados en
`projects` (hoy: 1 real, este repo) — la multi-selección con header por-request
(`x-orchestos-project-id`, ya soportado en el backend, `src/dashboard/project-context.ts:5,35-45`,
nunca enviado por el frontend hoy) se **completa en ERP.2**, no acá. Dejar la estructura lista
para que ERP.2 solo tenga que empezar a mandar el header, no que rediseñe el árbol.

## Qué ya existe y no hay que redescubrir

- `GET /api/projects` (`server.ts:277`) y `listProjects()` (`src/db/projects.ts:39`) — el backend
  ya puede listar proyectos registrados. El frontend nunca los consume hoy.
- `src/dashboard/public-src/islands/shell/Sidebar.tsx` — riel actual en React (UI.3). Su propio
  comentario (líneas 19-21) dice explícitamente: *"el botón de modo avanzado... se migran TAL
  CUAL, aunque UI.7 los vaya a borrar... si aparece la tentación, se anota para UI.7 y se sigue"*
  — este ítem ES esa tentación autorizada. Tocar `Sidebar.tsx` acá no viola ningún scope-lock.
- `NAV` (`src/dashboard/public/app.js:143-157`), 11 entradas con flag `operator` para las 5 que
  hoy solo aparecen en "modo avanzado" (`runs`, `graph`, `memory`, `specs`, `plan` — nota:
  `specs`/`skills` faltan `operator: true` en el array actual, revisar si es intencional o bug
  antes de decidir qué pasa a tabs).
- `toggleAdvancedMode()` (`app.js:2972-2980`), flag `localStorage['orchestos-mode']`, filtro
  `isAdv` en `openCommandPalette()` (`app.js:2198`), prop `advanced` en `Sidebar.tsx`/`NavIcon`
  (líneas 43,83,92,107,118,123,130,134) — todo esto se borra, no se deja apagado.
- `SCREENS.runner` (`screens-core.js:1076`) — deuda CC.0-D5, confirmar que ningún `NAV`/enlace
  activo apunta a `state.screen === 'runner'` antes de borrarlo (el `NAV` actual ya no lo lista,
  así que debería estar húerfano — confirmar con grep, no asumir).

## Cambios

### 1. Rail de 3 zonas (`Sidebar.tsx`)

- **Arriba:** `Chat` y `Activity`. `Activity` es vista transversal (cruza proyectos, per
  `docs/dashboard-experience-direction.md` línea 84) — para esta pasada, apunta al contenido
  existente de `SCREENS.runs` (ya es la vista más parecida a "actividad reciente"; no inventar
  una pantalla nueva).
- **Medio:** árbol de proyectos. `GET /api/projects` al montar, listar cada proyecto (nombre desde
  `path`, o el campo que ya tenga la fila — revisar `ProjectRow` en `src/db/projects.ts`).
  Seleccionar un proyecto abre la vista de workspace (punto 2) con ese proyecto activo
  (`state.workspaceProjectId`). Con un solo proyecto registrado (caso real hoy), el árbol muestra
  esa única fila — no es un placeholder ni un fake, es el dato real.
- **Abajo:** `Settings`, como ya está.
- Borrar el botón de modo avanzado (`NavButton id="navModeBtn"`, líneas 90-100) y toda la prop
  `advanced` que fluye desde `shell.advanced`/`use-shell.ts`/`syncNav()` (`app.js:788`) — si
  `shell-api.ts`/`use-shell.ts` exponen `advanced` solo para esto, borrar esa propiedad también
  (grep `shell.advanced` y `.advanced` en todo `public-src/` antes de tocar `use-shell.ts`, no
  dejar una prop que nadie lee).

### 2. Vista de workspace por proyecto (tabs, reusando pantallas existentes)

Nueva superficie (puede vivir en `screens-ops.js` o un archivo nuevo `screens-workspace.js`
cargado igual que los demás) que, con `state.workspaceProjectId` seteado, renderiza una barra de
tabs — `Tasks · Runs · Graph · Memory · Specs · Skills · Instincts` — y bajo cada una, **llama
directo** a `SCREENS.tasks.render(state)` / `SCREENS.runs.render(state)` / etc. (mismo patrón que
ya usa `SCREENS.project` con sus 3 tabs internos, `screens-ops.js:60-140`, como referencia de
implementación). El `wire()` de cada pantalla se invoca igual que hoy cuando su tab está activo.
No cambia el contrato de ninguna `SCREENS.*` existente — este contenedor es un wrapper, no una
reescritura.

### 3. `NAV` colapsa

`app.js:143-157`: de 11 entradas a las que quedan como destinos globales reales —
`chat`, `activity` (nueva), `settings`. `project` (la pantalla de constitution/context/evidence)
deja de ser nav global — se vuelve accesible desde dentro del workspace del proyecto seleccionado
(otro tab, o un botón dentro de esa vista — decidir el mínimo que no rompa el flujo actual de
edición de `CONSTITUTION.md`/contexto, sin inventar UI nueva para eso en esta pasada).
`tasks`/`runs`/`graph`/`memory`/`specs`/`skills`/`instincts`/`plan` dejan de estar en `NAV`: viven
como tabs del workspace (punto 2).

### 4. Borrar `SCREENS.runner`

Confirmar orfandad (`grep -rn "'runner'" src/dashboard/public/`) y borrar
`screens-core.js:1076-1165` (rango aproximado, confirmar límites reales del objeto).

## Qué NO tocar en esta pasada

- El interior de `SCREENS.tasks`/`runs`/`graph`/`memory`/`specs`/`skills`/`instincts` — solo se
  reusan, no se rediseñan (eso es UI.4/UI.8.5).
- El header `x-orchestos-project-id` en fetches existentes de tasks/runs/graph/memory — eso es
  ERP.2. El árbol de proyectos de esta pasada puede mostrar más de un proyecto si existe más de
  uno registrado, pero cambiar de proyecto seleccionado no necesita re-filtrar cada endpoint
  todavía (documentarlo como límite conocido, no fingir que ya filtra).
- El inspector condicional y el contrato Chat→Workspace completo — eso es UI.8.4.
- Composición visual (barra de estado inferior, chips de agente) — eso es UI.8.5.

## Cómo se verifica

1. `bunx tsc --noEmit` limpio (Sidebar.tsx es TypeScript/TSX).
2. `bun run test:coverage` completo en verde — grepear si hay tests de `Sidebar.tsx`/`NAV`/modo
   avanzado que ahora deben actualizarse en vez de romperse en silencio.
3. **Gate en vivo, obligatorio, navegador real:** registrar un segundo proyecto real para poder
   probar "dos proyectos" (el gate del ítem lo exige explícito) — la forma más simple es levantar
   el dashboard una vez desde un segundo directorio temporal distinto (`cd` a un tmpdir con un
   repo git mínimo, `bun run <repo>/src/cli.ts dashboard`) para que se registre en `projects` vía
   el mismo camino que ya usa el proyecto real, sin inventar un endpoint de alta manual. Con dos
   proyectos registrados: abrir el dashboard, ver el árbol con ambos, seleccionar cada uno, crear
   una sesión de chat por proyecto con CLIs distintos (reusar el mini-menú de ERP.1), confirmar
   que el workspace de cada proyecto muestra sus propias tabs sin mezclarse. Confirmar que "modo
   avanzado" ya no existe en ningún lado de la UI (sin botón, sin flag en localStorage nuevo).
4. Bajar cualquier dashboard levantado para el gate al terminar.

## Evidencia de cierre

`docs/done/evidence/UI.8.3-live.json` con capturas/pasos del gate en vivo (dos proyectos, rail de
3 zonas, tabs del workspace, modo avanzado ausente). Borrar este spec en el commit de cierre.
