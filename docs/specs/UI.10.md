# UI.10 — Specs, Skills y Plan, por proyecto, dentro de Settings

Ejecutor: Luna. No commitear, no tocar `PLAN.md`. Plan aprobado en `PLAN.md` § `UI.10`.

## Qué se ve al terminar

Settings → grupo nuevo **Projects** al final de la barra de secciones, con un botón por proyecto
registrado (su nombre). Al clickear uno se abre la página de ese proyecto: título = nombre del
proyecto, un botón "← Settings" y tres pestañas **Specs | Skills | Plan**. Cada pestaña muestra la
isla que ya existe (`screen-specs`, `screen-skills`, `screen-plan`), con los datos de **ese**
proyecto.

## Cambios

1. **Estado** (`src/dashboard/public/app.js`, objeto `state` ~línea 35): agregar `projectsList: []` y
   `settingsProjectId: null`.

2. **Helper de header** (`app.js`, junto a los `fetch*`): `projectHeaders()` devuelve
   `{ 'x-orchestos-project-id': state.settingsProjectId }` si hay id, `{}` si no. El nombre del
   header ya existe en el server (`src/dashboard/project-context.ts:5`).

3. **Todos los `fetch` a `/api/specs*`, `/api/plan*` y `/api/skills*`** del front
   (`src/dashboard/public/*.js` y `src/dashboard/public-src/**`; hoy son 27, listarlos con
   `grep -rnE "/api/(specs|plan|skills)" src/dashboard/public src/dashboard/public-src`) mandan
   `projectHeaders()` combinado con los headers que ya tengan. Sin excepción: una escritura sin
   el header cae al proyecto del cwd y escribe en el proyecto equivocado. Las islas React llegan a
   `fetch` a través de `window.OrchestOS` (`public-src/islands/screens/screen-api.ts:17-67`) o
   directo; cubrir los dos.

4. **Skills por proyecto en el server:**
   - `src/skills/registry.ts:84` `getSkillsDir()` → `getSkillsDir(root = process.cwd())`. Propagar
     un parámetro opcional `root?: string` a `resolveSkillPath`, `listSkillFiles`, `getSkillPath`,
     `getProSkillsDir` y a cualquier otra función exportada que llame a `getSkillsDir()`. Sin
     `root`, el comportamiento es idéntico al de hoy.
   - `src/dashboard/server.ts:237-275`: toda ruta `/api/skills*` que lea o escriba el `skills/`
     del proyecto pasa por `withDashboardProject(req, (project) => handler(..., project.root))`,
     igual que las de specs (`server.ts:344-373`). Los handlers de `handlers/skills.ts` reciben
     `root` y se lo pasan al registro. `/api/skills/registry*` (catálogo externo) no cambia su
     fuente, pero su import escribe con `root`.

5. **Barra de Settings** (`src/dashboard/public/screens-ops.js:1899-1920`): después del grupo
   `protect`, un `settings-nav-group` con label `t('settings.navGroup.projects')` y, por cada
   proyecto de `state.projectsList`, un `<button class="settings-nav-item"
   data-settings-project="<id>">` con el nombre escapado con `esc()`. **Nombre = último segmento
   de `path`**, exactamente como el sidebar (`Sidebar.tsx:249`:
   `project.path.split('/').pop() || project.path`); `/api/projects` no devuelve `name`
   (`handlers/projects.ts:7-15`). `state.projectsList` es estado nuevo (`[]` por defecto) que se
   llena con `fetch('/api/projects')` al entrar a Settings (en `App.go` cuando `id ===
   'settings'`) y luego `App.rerender()`. **No** usar `data-settings-sec`: ese handler (`screens-ops.js:1991`) solo
   alterna paneles locales. Si no hay proyectos, el grupo muestra
   `t('settings.projects.empty')` en texto muted.

6. **Click en un proyecto** (en `wire()` de Settings): `state.settingsProjectId = id`,
   `state.projectTab = 'specs'` y `App.go('specs')`. Después de `go`, refrescar los datos de esa
   pantalla con los `fetch*` existentes (`fetchSpecs`, `fetchSkills`, `fetchPlan`) y
   `App.rerender()`.

7. **Página del proyecto:** `SCREENS.specs`, `SCREENS.skills` y `SCREENS.plan`
   (`screens-ops.js:2349-2390`) siguen `react: true`, pero su `render()` devuelve, antes del
   `<div data-island=...>`, una cabecera estática:
   `<div class="project-settings-head">` con `<button data-project-back>← Settings</button>`, un
   `<h2 data-project-title>` con el nombre del proyecto de `state.settingsProjectId`, y
   `<nav class="project-settings-tabs">` con tres
   `<button data-project-tab="specs|skills|plan">`; la de la pantalla actual lleva `active`.
   Como `rerender()` no llama a `wire()` en pantallas React (`app.js:800-828`), los clicks se
   atienden con **un único listener delegado** sobre `#main`, registrado una vez al iniciar la app:
   `[data-project-tab]` → `App.go(tab)` y su `fetch*`; `[data-project-back]` →
   `App.go('settings')`. Si `state.settingsProjectId` es `null` (se llegó por la paleta,
   `app.js:2335`), la cabecera no se pinta y todo queda como hoy.
   Estilos en `src/dashboard/public/screens.css`, junto a `.settings-*` (~590-692), con los
   tokens existentes (`var(--radius-lg)`, colores de `.settings-nav-item`). Nada de `style=`
   inline.

8. **i18n** (`src/dashboard/public/i18n.js`, en es y en): `settings.navGroup.projects`
   ("Proyectos"/"Projects"), `settings.projects.empty` ("Sin proyectos registrados"/"No
   registered projects"), `project.tab.specs`, `project.tab.skills`, `project.tab.plan`,
   `project.back` ("← Settings" en ambos).

9. **Build del bundle React** si tocaste `public-src`: el comando que use el repo (ver
   `package.json`), para que el dashboard sirva el cambio.

## Gate nuevo: `scripts/ui-gates/ui10-project-settings.mjs`

Con el estilo de `scripts/ui-gates/ui9a-inspector.mjs`: `GATE_BASE` (por defecto `:4323`),
líneas `PASS`/`FAIL`, `exitCode` 1 si falla alguna. **Prohibido** `window.state`, `window.App` o
`window.OrchestOS` para navegar: todo por click desde `page.goto(BASE)`. Escribir capturas solo en
`os.tmpdir()`, nunca en el repo.
1. Desde Chat, click en `[data-nav="settings"]` → existe el grupo Projects con ≥ 2
   `[data-settings-project]` visibles (si hay < 2, `FAIL` con el motivo).
2. Registrar los requests (`page.on('request')`). Click en el primer proyecto → `[data-project-title]`
   muestra el texto del botón clickeado; el `/api/specs` posterior lleva
   `x-orchestos-project-id` = `data-settings-project` del botón.
3. Click en cada `[data-project-tab]` (specs, skills, plan) → su isla
   (`[data-island="screen-…"]`) es visible y tiene contenido; el `/api/skills` y el `/api/plan`
   llevan el mismo header.
4. `[data-project-back]` → vuelve a Settings. Click en el segundo proyecto → título y header
   cambian al segundo id.
5. Sin errores de consola.

## Qué no tocar

- Rediseñar las islas (`SpecsScreen.tsx`, `SkillsScreen.tsx`, `PlanBoardScreen.tsx`).
- El sidebar, el menú de tres puntos por proyecto, reglas por proyecto.
- `NAV` (`app.js:144-149`): no se agregan pantallas al menú.
- Los gates `ui0`, `ui4-specs`, `s6`, `s6a` (son `CI.2.A`).

## Verificación del ejecutor

`bunx tsc --noEmit`, `bun run test:coverage` (comando exacto de CI) y los tests nuevos:
`registry.ts` con `root` explícito lee y escribe bajo ese root (tmpdir, sin tocar el repo), y sin
`root` mantiene el comportamiento actual. Reportar la salida real de ambos comandos.
El gate en vivo lo corre el cerebro.
