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

Es lo único que se suma, y va en `ui.css`, no en `styles.css`/`screens.css`. Esto es únicamente
cableado declarativo de tokens para que Tailwind genere las clases copiadas: **no agregar
selectores, propiedades visuales, `@layer`, reglas responsive ni CSS artesanal** en `ui.css`.
En `styles.css` y `screens.css` el diff de líneas añadidas debe ser **cero**; esos archivos solo
pueden bajar. Si copiar el prototipo exige algo más que estos alias, parar y reportarlo.

## 2. Copiar el JSX del prototipo en las islas

- `src/dashboard/public-src/islands/shell/Header.tsx` ← `P/components/layout/ShellHeader.tsx:22-80`.
- `src/dashboard/public-src/islands/shell/Sidebar.tsx` ← `P/components/layout/ShellSidebar.tsx`:
  segmentado Chat | Dev y New chat `:88-130`, fila de proyecto `:234-270`, fila de agente con
  loader/check `:354-410`, menú `…` del proyecto (buscarlo en el mismo archivo).

Copiar los `className` **tal cual**, incluidas transiciones y animaciones (`transition-*`, `animate-spin`, `group-hover:*`, `opacity-*`): Carlos exige fidelidad total al prototipo en colores, animaciones y vistas. Se conservan la lógica, los handlers, los datos, los `id`,
los `data-*` y los `aria-*` actuales. Las clases viejas (`shell-*`, `sidebar-*`) quedan en el JSX
solo como ganchos de los gates, sin estilo. Lo que el producto no tiene sigue fuera (CLI QUOTAS,
SESSION CONTEXT: decisión de Carlos, `PLAN.md` § UI.12). El menú `…` usa el componente shadcn que ya
se usa; su ancho y padding van por `className`, sin `!important`.

### Estado incompleto que hay que corregir al retomar

La ronda anterior terminó sin proceso activo y dejó un diff parcial. No darlo por bueno solo porque
compila. Comparar nuevamente, lado a lado, con el prototipo y corregir al menos estas divergencias
ya verificadas por lectura:

- `SessionRow` sigue renderizando únicamente las clases vanilla
  (`sidebar-agent-row sidebar-chat-row`): copiar la fila de chat de
  `ShellSidebar.tsx:146-190`, incluidos estado activo, hover, icono, truncado, tiempo y botón de
  borrado al hover.
- La lista de agentes del proyecto perdió el contenedor del prototipo
  `ml-3 pl-3 border-l border-app/80 py-0.5 space-y-0.5`; recuperarlo en la estructura React.
- En cada agente, icono + título deben estar en el mismo control flex como en
  `ShellSidebar.tsx:354-410`; el diff parcial dejó el título fuera del wrapper del icono.
- No traducir visualmente a selectores propios. Las clases `shell-*`/`sidebar-*` solo son ganchos
  de compatibilidad para gates y deben aparecer al final del `className`, sin reglas visuales.
- Formatear el JSX final: no dejar indentación rota ni líneas compactadas que oculten diferencias
  con el prototipo.

### Ronda 2 — fallos medidos por el gate real

La primera reanudación pasó `ui3-shell`, `ui9a-inspector` y `ui10-project-settings`, pero dejó
`ui12-shell` con dos fallos y luego borró la regla de colapso **después** de ejecutar el gate. Esta
ronda corrige solo lo siguiente y vuelve a ejecutar todos los gates sobre el diff final:

- Restaurar desde `HEAD` —sin reescribir ni compactar— las reglas ya existentes y explícitamente
  permitidas de `.app[data-sidebar="collapsed"] .sidebar`/`.resize-handle-sidebar` y todo
  `.dev-empty-*` (`styles.css:1698,1734-1787` en `HEAD`). Al quedar idénticas a `HEAD` no cuentan
  como CSS añadido. No restaurar ninguna regla visual `.shell-*`, `.sidebar-mode-*`,
  `.sidebar-project-*`, `.sidebar-agent-*` ni `.sidebar-project-menu*`.
- La carpeta falla porque `Icon` renderiza un `span` que contiene el `svg`, mientras Lucide en el
  prototipo renderiza el `svg` directo. Resolverlo en el `className` del `Icon` con variantes
  Tailwind para el hijo (`[&>svg]:w-4 [&>svg]:h-4` o equivalente literal), conservando 16×16 y
  `text-app-accent`. No agregar selector CSS.
- No aceptar resultados de gates corridos antes de la última edición. Si `ui81` ignora
  `GATE_BASE`, levantar el dashboard en el puerto que el propio script declara (hoy `:4321`) y
  volver a correrlo allí; reportar su salida real completa.

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

- `bun run build:ui` y `bunx tsc --noEmit` limpios.
- `git diff --numstat -- src/dashboard/public/styles.css src/dashboard/public/screens.css` muestra
  cero líneas añadidas en ambos; `ui.css` solo contiene los 12 renglones de alias `@theme`/
  `@utility` descritos arriba.
- `wc -l src/dashboard/public/styles.css` baja (hoy 1788); reportar el número.
- Con el dashboard levantado en el puerto que consumen los scripts (usar `:4321` para
  `ui81-visual-consistency.mjs`, que hoy fija ese origen): `ui12-shell`, `ui3-shell`, `ui81`,
  `ui9a-inspector`, `ui10-project-settings` verdes sobre el **diff final**. Bajar el dashboard al
  terminar.
