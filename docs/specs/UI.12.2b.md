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

### Ronda 3 — corrección final después de rechazar la segunda salida

La segunda salida no es aceptable aunque cuatro gates estén verdes: restauró reglas visuales
prohibidas y `ui81` midió seis tamaños tipográficos. Corregir ambos puntos sin crear CSS:

- En el bloque final de `styles.css`, conservar únicamente las reglas de geometría/estado que esta
  especificación permite: `.app[data-sidebar="collapsed"] .sidebar` junto con
  `.resize-handle-sidebar`, y `.dev-empty-*`. Borrar de nuevo todas las reglas restauradas para
  `.sidebar-mode-*`, `.sidebar-section-label`, `.sidebar-agent-row`, `.sidebar-cli-menu`,
  `.sidebar-new-chat*`, `.sidebar-project-main`, `.sidebar-project-folder*` y
  `.sidebar-project-actions*`. El estado colapsado ya oculta el contenedor completo; no necesita
  reglas para sus hijos. No restaurar ningún otro selector visual del Header o Sidebar.
- El prototipo fija en `P/index.css:75-100` la escala que Tailwind debe producir: `text-xs = 11px`
  y `text-sm = 12px`. En este producto, por el `font-size` raíz, Tailwind calcula 10.5px y 12.25px.
  Resolverlo **solo en JSX con utilidades que ya existen**: añadir `font-ui-meta` a los elementos
  copiados de Header/Sidebar que llevan `text-xs`, y `font-ui-control` a los que llevan `text-sm`.
  Esas utilidades ya equivalen a 11px y 12px. Conservar también las clases `text-xs`/`text-sm` del
  prototipo; no editar `ui.css`, no crear una regla CSS y no tocar el gate.
- Al terminar, `styles.css` debe seguir con cero adiciones frente a `HEAD`; `ui.css` debe conservar
  exactamente sus 12 renglones declarativos ya añadidos. Correr los cinco gates sobre este diff
  final. `ui81` debe quedar verde con cinco tamaños o menos; si no, reportar los nodos y medidas
  restantes sin ensayar una solución distinta.

### Ronda 4 — dos medidas restantes, diagnosticadas en vivo

La tercera salida dejó `ui81` verde (11/12/14/20px) y confirmó cero CSS añadido, pero `ui12-shell`
midió dos diferencias. Ya no hay una decisión pendiente:

- La carpeta mide 14×14 porque en este producto `w-4`/`h-4` usa `1rem` sobre una raíz de 14px. En
  el prototipo esa clase mide 16×16. Cambiar en el `Icon` de carpeta únicamente las cuatro clases
  dimensionales por utilidades Tailwind arbitrarias explícitas de 16px:
  `w-[16px] h-[16px] [&>svg]:w-[16px] [&>svg]:h-[16px]`. Mantener `text-app-accent`,
  `flex-shrink-0` y el gancho del gate. No escribir CSS.
- El logo ya termina en 96×96 por la regla permitida existente. La medida 93.12×93.12 es exactamente
  `96 × .97`: `ui12-shell` lo inspecciona durante `placeholder-in` antes de que termine la animación
  de 300ms. Hacer determinista `scripts/ui-gates/ui12-shell.mjs`: después de que el logo sea visible
  y antes de medir su caja, esperar a que terminen las animaciones activas de
  `.dev-empty-screen .placeholder` usando la API Web Animations (`getAnimations()` y sus promesas
  `finished`). No agregar un `sleep`, no cambiar el esperado 96, no tocar producto para satisfacer
  una carrera del gate y no relajar ninguna aserción.
- Volver a correr build, TypeScript y los cinco gates sobre el diff final. La modificación del gate
  es parte de esta ronda y debe reportarse; no tocar ningún otro script.

### Ronda 5 — revisión visual real contra el prototipo, sin CSS nuevo

La captura lado a lado a 1440×900 mostró que pasar los gates todavía no equivale a copiar el look.
El prototipo tiene raíz de 16px; el producto, 14px. Por eso las utilidades espaciales copiadas con
`rem` quedan al 87.5% (`p-3` da 10.5px en vez de 12px, `w-3.5` da 12.25px en vez de 14px). Además,
los contenedores vanilla conservan padding/gap heredado y los `Icon` del Header no tienen caja.

Resolver mecánicamente, sin sumar ninguna línea ni declaración CSS:

1. En `styles.css`, **borrar** únicamente las declaraciones heredadas que compiten con las islas:
   `gap: 16px` y `padding: 0 18px` del `.header` base; `gap: 10px` y `padding: 0 12px` de `.header`
   dentro de `@media (max-width: 640px)`; `gap: 3px` y `padding: 0 8px 9px` del `.sidebar` base.
   Borrar también los bloques visuales usados solo por el `NavIcon` de Settings:
   `.sidebar .nav-icon`, sus estados `:hover`, `:focus-visible`, `.active`, `.active::before`,
   `.sidebar .nav-icon.operator`, `.sidebar .nav-icon.operator.visible`, el tooltip
   `.nav-icon[data-tip]:hover::after` y `.sidebar .grow`. No tocar reglas que aún use otra pantalla.
   El diff del archivo sigue siendo solo eliminaciones.
2. En `Header.tsx`, hacer que `.shell-header-inner` sea la barra real del prototipo:
   `h-[44px] w-full px-[14px]`, y convertir sus espaciados copiados a píxeles (`gap-3`→`gap-[12px]`,
   `gap-1`→`gap-[4px]`, `ml-1`→`ml-[4px]`, `gap-2`→`gap-[8px]`, `p-1.5`→`p-[6px]`).
   Cada `Icon` de `HeaderButton` debe llevar una caja de 14×14 y forzar el SVG hijo a 14×14 con
   variantes Tailwind; lo mismo para la carpeta del breadcrumb. No crear selector CSS.
3. En `Sidebar.tsx`, sustituir todas las utilidades dimensionales/espaciales copiadas que dependen
   de `rem` por el píxel que produce el prototipo con raíz 16. Mapa exacto:
   `.5→2px`, `1→4px`, `1.5→6px`, `2→8px`, `2.5→10px`, `3→12px`, `3.5→14px`, `4→16px`,
   `6→24px`, `8→32px`, `44→176px`, `56→224px`. Aplica a `p*`, `m*`, `gap*`, `space-y-*`,
   `top/left-*`, `w/h-*` y `min-w-*` en este componente; porcentajes, `full`, `grow`, colores,
   radios y tipografía no cambian. Usar utilidades arbitrarias Tailwind, nunca `style=`.
4. Copiar el footer Settings del prototipo (`ShellSidebar.tsx:422-432`) sin CLI QUOTAS: envolver el
   `NavIcon` en `p-[12px] border-t border-app bg-app-surface/40 flex-shrink-0`; el control usa
   `flex items-center gap-[8px] text-xs font-ui-meta text-app-muted hover:text-app transition-colors`
   y el icono/SVG 16×16. Conservar `data-nav`, teclado, estado activo y el gancho `nav-icon`, pero
   no darle estilo por ese gancho. Quitar el `div.grow`: la región Chat/Dev ya es `flex-1`.

Verificación adicional obligatoria en navegador, además de los cinco gates:

- `.shell-header-inner`: x=0, ancho=viewport, alto=44; primer contenido a x=14.
- botones Search/Sidebar/Right: SVG visible 14×14; caja del botón ≈26×26.
- `.sidebar-mode-row`: ocupa todo el ancho interior del sidebar sin el inset heredado de 8px;
  wrapper con padding 4px/gap 6px y botones con padding vertical 6px/horizontal 12px.
- `.sidebar-project-row`: padding vertical 6px/horizontal 10px.
- Capturar Chat y Dev a 1440×900 y compararlos con el prototipo vivo. Si queda una diferencia del
  shell causada por una regla vanilla, reportar selector y medida; no compensarla con CSS nuevo.

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
