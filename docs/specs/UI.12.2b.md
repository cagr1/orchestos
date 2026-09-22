# UI.12.2b — Deshacer el CSS de UI.12.2: Header/Sidebar con los className del prototipo

Prerrequisito: `UI.12.2a` cerrado (trinquete activo). Prototipo:
`~/Documents/screens/orchestos-ai-agent-dashboard/src` (en adelante `P/`).

## 1. Vocabulario del prototipo en Tailwind (`src/dashboard/public-src/styles/ui.css`)

El prototipo usa clases propias (`P/index.css:113-157`): `bg-app-bg`, `bg-app-surface`,
`bg-app-elevated`, `border-app`, `text-app`, `text-app-muted`, `text-app-accent`, `bg-app-accent`,
`rounded-control`, `rounded-card`, `rounded-pill`. Agregarlas para que su JSX se copie **literal**:

- En el `@theme inline` existente: `--color-app-bg: var(--bg)`, `--color-app-surface: var(--surface)`,
  `--color-app-elevated: var(--surface-2)`, `--color-app-muted: var(--text-muted)`,
  `--color-app-accent: var(--accent)`, `--radius-control: var(--radius)`,
  `--radius-card: var(--radius-lg)`, `--radius-pill: var(--radius-pill)`. Mirar `P/index.css:113-157`
  y usar la misma variable del producto que corresponda si alguna difiere.
- `text-app` y `border-app` chocan como color (uno es texto, el otro borde): van como
  `@utility text-app { color: var(--text); }` y `@utility border-app { border-color: var(--border); }`.

Es lo único que se suma, y va en `ui.css`, no en `styles.css`/`screens.css`.

## 2. Copiar el JSX del prototipo en las islas

- `src/dashboard/public-src/islands/shell/Header.tsx` ← `P/components/layout/ShellHeader.tsx:22-80`.
- `src/dashboard/public-src/islands/shell/Sidebar.tsx` ← `P/components/layout/ShellSidebar.tsx`:
  segmentado Chat | Dev y New chat `:88-130`, fila de proyecto `:234-270`, fila de agente con
  loader/check `:354-410`, menú `…` del proyecto (buscarlo en el mismo archivo).

Copiar los `className` **tal cual**. Se conservan la lógica, los handlers, los datos, los `id`,
los `data-*` y los `aria-*` actuales. Las clases viejas (`shell-*`, `sidebar-*`) quedan en el JSX
solo como ganchos de los gates, sin estilo. Lo que el producto no tiene sigue fuera (CLI QUOTAS,
SESSION CONTEXT: decisión de Carlos, `PLAN.md` § UI.12). El menú `…` usa el componente shadcn que ya
se usa; su ancho y padding van por `className`, sin `!important`.

## 3. Borrar de `src/dashboard/public/styles.css`

Del bloque que agregó UI.12.2 (desde `:root { --sidebar-w-exp` hasta el final del archivo),
borrar toda regla cuyos selectores apunten **solo** a elementos que renderizan `Header.tsx` o
`Sidebar.tsx`: `.shell-*`, `.sidebar-mode-*`, `.sidebar-new-chat*`, `.sidebar-project-*`,
`.sidebar-agent-*` y `.sidebar-project-menu*`. Borrar también las reglas más viejas del archivo
con esos mismos selectores, si ya no tienen efecto.

Se **quedan** (los elementos son vanilla, no isla): `:root` de anchos, `.app` y su grid, `.header`,
`.sidebar` (grid-area/colapsado), `.rightpanel`, `.rp-toprow`, `.resize-handle-sidebar` y
`.dev-empty-*`.

## No tocar

`screens.css` (solo borrar, y aquí no aplica), `PLAN.md`, los gates en `scripts/ui-gates/`. Si un
gate falla porque mide un valor que el prototipo hace distinto, **parar y reportar** la medida
y la línea del prototipo; no editar el gate. No commitear.

## Verificación (el ejecutor)

- `bun run build` (o el build de islas que use el repo) y `bunx tsc --noEmit` limpios.
- `wc -l src/dashboard/public/styles.css` baja (hoy 1788); reportar el número.
- Con el dashboard levantado en :4330: `ui12-shell`, `ui3-shell`, `ui81`, `ui9a-inspector`,
  `ui10-project-settings` verdes. Bajar el dashboard al terminar.
