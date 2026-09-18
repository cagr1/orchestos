# UI.9.A — Devolver el acceso al inspector (explorer / source control / terminal)

## Diagnóstico ya verificado (no re-investigar)

`30ab117` (UI.9.5) reemplazó el botón permanente `#rpToggle` del aside por `#rpClose`, y añadió
`if (!inspector) return null` en `src/dashboard/public-src/islands/shell/RightPanelToprow.tsx:27`.
Consecuencia: los botones de explorer/terminal/diff **solo se renderizan cuando el inspector ya
está abierto**, y el único punto de entrada que queda en el producto es el command palette
(`src/dashboard/public/app.js:2305-2312`). Además `selectWorkspaceProject()` llama
`closeInspector()` (`src/dashboard/public/app.js:3357`), así que abrir un proyecto garantiza que
el panel quede cerrado y sin forma de reabrirlo con el mouse.

## Qué cambiar

### 1. Tres botones permanentes en la barra de tabs del workspace

`src/dashboard/public/screens-ops.js:18` — al final de `tabBar`, después del botón
`Project settings`, agregar un grupo alineado a la derecha con tres botones de icono:

```
<span class="workspace-tools">
  <button type="button" class="workspace-tool" data-inspector-tool="explorer"
          aria-label="…" data-tip="…">${ICON.folder}</button>
  <button type="button" class="workspace-tool" data-inspector-tool="diff"     …>${ICON.diff}</button>
  <button type="button" class="workspace-tool" data-inspector-tool="terminal" …>${ICON.term}</button>
</span>
```

- Los iconos ya existen en `src/dashboard/public/data.js` (`folder`, `diff`, `term`). No crear SVG nuevos.
- Las etiquetas salen de i18n con las claves que ya existen: `rp.tab.explorer`, `rp.tab.diff`,
  `rp.tab.terminal` (usar el helper `t()` que ya usa ese archivo). No inventar claves.
- Marcar `active` el botón cuyo tool está abierto: `st.inspector?.kind === 'tool' && st.inspector.tab === <tool>`.

En `SCREENS.workspace.wire()` (`screens-ops.js:21-34`), cablear:

```
root.querySelectorAll('[data-inspector-tool]').forEach((b) =>
  b.addEventListener('click', () => window.OrchestOS.openInspectorTool(b.dataset.inspectorTool)),
)
```

### 2. Seleccionar un proyecto no puede cerrar un inspector de herramienta

`src/dashboard/public/app.js:3357` — dentro de `selectWorkspaceProject`, reemplazar la llamada
incondicional `closeInspector()` por: cerrar **solo** si `state.inspector?.kind !== 'tool'`
(un inspector de tarea pertenece a otra tarea y sí debe cerrarse; una herramienta es del shell y
sobrevive al cambio de proyecto). Si sobrevive, llamar `syncRightPanel()` para que el contenido se
re-renderice contra el proyecto nuevo.

### 3. CSS

`src/dashboard/public/screens.css` — hoy **no existe ninguna regla `.workspace-tabs`** (verificado
por grep; solo está estilado `.proj-tab`). Agregar:

- `.workspace-tabs { display: flex; align-items: center; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 16px; }`
- `.workspace-tools { margin-left: auto; display: flex; gap: 2px; padding-right: 8px; }`
- `.workspace-tool` reutilizando el aspecto de `.header-icon-btn` (mismo tamaño de icono y estado
  `.active` con `var(--accent)`). No duplicar valores a ojo: mirar `.header-icon-btn` en
  `src/dashboard/public/styles.css` y seguir esos tokens.

El grupo debe quedar **visible y clickeable con el sidebar colapsado y con el sidebar expandido**,
en ambos temas. Ese fue el modo exacto en que se perdió el botón "+ Add project" la primera vez.

## Qué NO tocar

- `RightPanelToprow.tsx` — su contrato de UI.9.5 (`#rpClose` último, ancho 0px al cerrar) queda
  intacto. No reintroducir `#rpToggle`.
- `Header.tsx` — decisión cerrada de Carlos (ronda 4 de v0.12): el header no lleva iconos.
- `shell-store.ts`, `use-shell.ts`, `shell-api.ts`, la sidebar React, y cualquier endpoint.
- `PLAN.md`, `AGENTS.md`, `CLAUDE.md`. No commitear nada.

## Gate — cómo se verifica

Crear `scripts/ui-gates/ui9a-inspector.mjs`, con la misma forma que los gates existentes de
`scripts/ui-gates/` (copiar la inicialización de Playwright de `ui3-shell.mjs`). **Regla dura de
este gate, que es la razón de que exista:** no puede usar `page.evaluate(() => window.OrchestOS…)`
ni `window.state` para abrir el inspector. Todo se hace clickeando, como un humano. `ui3-shell.mjs:58`
abre el inspector por la API de JS, y por eso pasó en verde mientras no había ningún botón.

Afirmaciones, desde arranque en frío:

1. Entrar en modo Dev y seleccionar un proyecto clickeando en la sidebar.
2. Los tres `[data-inspector-tool]` existen, tienen `boundingBox()` no nulo con ancho y alto > 0,
   y `page.locator(...).click({ trial: true })` pasa (es decir: visible, no tapado, clickeable).
   Repetir con el sidebar colapsado y expandido.
3. Click real en `[data-inspector-tool="explorer"]` → `#rightpanel` pasa de `width: 0px` a > 0px
   y `.app[data-rightpanel] === 'expanded'`.
4. Con el explorer abierto, clickear otro proyecto en la sidebar → el inspector **sigue** abierto
   (`data-rightpanel === 'expanded'`).
5. Click en `#rpClose` → vuelve a `0px`, y los tres `[data-inspector-tool]` siguen clickeables
   (esto es lo que faltaba: la afordancia de abrir sobrevive al cierre).

Correr, además: `bun run build:ui`, `bunx tsc --noEmit` y `bun run test:coverage` (el comando
exacto de CI, no `bun test`).

El gate se corre con el dashboard real levantado, nunca contra mocks.
