# CI.2.A — Reparar 5 gates y reescribirlos para que lleguen clickeando

Ejecutor: Luna. No commitear, no tocar `PLAN.md`. El ítem está en `PLAN.md` § `CI.2.A`; el
diagnóstico de cada gate está en § `CI.2` ("DIAGNÓSTICO DE LOS 6 ROJOS").

Gates: `ui0-islands`, `ui4-specs-screen`, `ui81-visual-consistency`, `s6-sprint-board`,
`s6a-sprint-board` (todos en `scripts/ui-gates/`). No tocar los otros 9.

## Reglas para los 5

1. **Se llega clickeando, empezando en frío.** `page.goto(BASE)` y después solo clicks.
   No se puede usar `window.App.go`, `window.state.screen = …` ni `?screen=` para *llegar*.
   Camino a Specs, Skills y Plan (existe desde `UI.10`): `[data-nav="settings"]` →
   `[data-settings-project="<id>"]` → `[data-project-tab="specs|skills|plan"]`. Referencia que
   ya funciona: `scripts/ui-gates/ui10-project-settings.mjs`.
   Una vez en la pantalla, sí se puede usar `page.evaluate` para *afirmar* cosas y
   `window.App.rerender()` para *provocar* un repintado (es lo que hace el poll del producto,
   no navegación).
2. **Datos de prueba por red, no por `window.state`.** Si el gate necesita datos que el
   dashboard real puede no tener, usar `page.route('**/api/<ruta>', …)` con un fixture antes de
   hacer el click. Sembrar `window.state` queda prohibido: la isla React vuelve a pedir los datos
   y los pisa, y además saltea el fetch con `x-orchestos-project-id` que es justo lo que hay que
   ejercer.
3. **No escribir nada versionado.** Capturas y JSON de evidencia van a
   `process.env.GATE_ARTIFACTS_DIR` o, si no está definido, a un `mkdtemp` en `os.tmpdir()`.
   El gate imprime la ruta al final. Hoy `ui0`/`ui4-specs` dejan PNGs en el cwd, y `s6`/`s6a`
   pisan `scripts/s6-live-evidence.json`, `scripts/s6a-live-evidence.json` y sus `.png`, que
   son la evidencia de cierre de `S.6`/`S.6a` y **no se tocan**.
4. **Runtime declarado.** Primera línea del comentario de cabecera de cada gate:
   `Runtime: node` o `Runtime: bun`. `s6`/`s6a` son `bun` (importan `src/` en proceso), el resto
   `node`.
5. **Salida uniforme:** una línea `PASS — …`/`FAIL — …` por afirmación y `process.exitCode = 1`
   si alguna falla. `s6`/`s6a` hoy abortan con `assert`: cambiarlos a este formato.

## Por gate

### `ui0-islands`
- Bloque 1: la afirmación "sin `?island-probe` no se monta ninguna isla" caducó (hay islas
  permanentes a propósito). Pasa a ser: sin `?island-probe`, `[data-island="lang-probe"]` = 0 y
  cero errores de consola.
- Bloque 5 (i18n): en vez de `window.setLang`, clickear `[data-nav="settings"]` →
  `[data-settings-sec="lang"]` → `[data-lang="es"]` / `[data-lang="en"]`. Si la isla de probe no
  sobrevive a entrar a Settings, reportarlo y parar: es un hallazgo, no se arregla con JS.
- Bloque 7 (navegación): en vez de `App.go('runs')`/`App.go('chat')`, clickear Settings → un
  proyecto → pestaña Specs → `[data-nav="chat"]`, y afirmar que sigue habiendo exactamente 1
  `lang-probe`.

### `ui4-specs-screen`
- Llegar por Settings → primer proyecto → `[data-project-tab="specs"]`, con `page.route` de
  `/api/specs` devolviendo el fixture que hoy se siembra en `window.state.specs` (mismas specs
  activas y archivadas).
- (a) Exigir 4 `<th>` fuera de modo bulk. Entrar a modo bulk por el control de la pantalla y
  ahí sí exigir la 5ª columna (checkbox), como define `SpecsScreen.tsx:178`.
- (b) Los `.badge` amber/green ya no existen: afirmar el `StatusRail` (glifo + texto mono) que
  los reemplazó (`SpecsScreen.tsx:292-299`), una por estado.
- La paridad visual contra Runs se hace por `App.go('runs')` y Runs no tiene camino clickeable.
  Tomar como referencia una `table.tbl` vanilla a la que se llegue clickeando dentro de
  Settings. Si no hay ninguna, borrar ese bloque y explicarlo en el comentario de cabecera.
- El 404 esperado del lint se mantiene filtrado solo por esa ruta.

### `ui81-visual-consistency`
- Quitar el `page.evaluate` que fija `state.screen`: `goto(BASE)` ya abre Chat. Afirmar que se
  está en Chat por el DOM (el `[data-nav="chat"]` activo), no por `window.state`.
- El conteo de `[style]` deja de contar los que dependen de datos: excluir los
  `.session-statusbar-cli-fill` cuyo `style` es solo `width:…` (una barra por CLI configurado).
  Volver a medir y fijar el baseline con ese criterio.
- No reescribir el baseline mientras corre. Solo con `--update-baseline`; sin el flag, si baja,
  imprime `INFO — el baseline puede bajar a N` y no toca el archivo.

### `s6-sprint-board` y `s6a-sprint-board`
- Mantener el home aislado y el `assert(DB_PATH.startsWith(home))` que ya tienen.
- Después de `importPlan`, registrar el fixture como proyecto en la DB aislada con
  `upsertProject` (`src/db/projects.ts:17`), para que aparezca en Settings. El server corre con
  `process.chdir(fixture)`, así que ese proyecto es el del cwd y `/api/plan` le responde (el
  corte de `server.ts:158-177` solo aplica a otros proyectos).
- Reemplazar cada `#navModeBtn` + `[data-nav="plan"]` (s6: 104-105, 174-175; s6a: 108-109, 163,
  184, 219, 260) por Settings → proyecto del fixture → `[data-project-tab="plan"]`. Hacer un helper
  `openPlan(page)` y usarlo en todos los lugares, incluidos los que vuelven a la pantalla después
  de recargar.
- Afirmar que los fetch de `/api/plan` llevan el `x-orchestos-project-id` del fixture.

## Verificación (la corre el cerebro, no alcanza con el reporte)

- `bunx tsc --noEmit` limpio y `bun run test:coverage` verde.
- Dashboard real en un puerto libre, y los 5 gates con su runtime: todos en verde, **3 corridas
  seguidas** cada uno.
- `git status` limpio después de las corridas: ningún PNG ni JSON nuevo o modificado.
- `grep -nE "App\.go|state\.screen|navModeBtn|setLang\(" scripts/ui-gates/{ui0-islands,ui4-specs-screen,ui81-visual-consistency,s6-sprint-board,s6a-sprint-board}.mjs`
  no devuelve nada.
- La DB real (`~/.orchestos/db.sqlite`) tiene el mismo conteo de `plan_items` antes y después.

## Fuera de esta pasada

El workflow de CI que corre los gates (sigue en `CI.2`), el inventario de afordancias
(propiedad 2 de `CI.2`), los otros 4 gates que llegan por `window.*` (`ui1`, `ui1b`, `ui3`,
`ui4-skills`), el lint rojo.
