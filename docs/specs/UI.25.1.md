# UI.25.1 — Primitivos de Settings + piloto (General y Executor)

Ítem: PLAN.md § UI.25. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md.

## Objetivo

Settings no usa la familia Fluid Functionalism (ya instalada en `src/dashboard/app/src/components/ui`). Este paso
crea los primitivos de layout de Settings componiendo la familia y migra dos secciones como piloto. Solo
presentación: ni lógica, ni estado, ni handlers, ni textos cambian.

## Dónde

- Nuevo: `src/dashboard/app/src/components/settings/primitives.tsx`.
- Editar: `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx`
  - aviso "Loading live settings…" (`:923-927`),
  - General / Appearance (`:935-1000`),
  - Executor (`:1847-1995`).

## Primitivos (`primitives.tsx`)

Componer con `@/components/ui/button`, `card`, `badge`, `tooltip`, `fluid-hover-highlight` por props y `className`.
Leer primero cómo los usa `components/thread/` y la lámina `ThreadStatesSheet.tsx`: mismo modo de uso.

- `SettingsPage({ title, description, status?, actions?, children })`: columna `mx-auto w-full max-w-3xl`, la misma
  para todas las secciones. Cabecera: `h1` con el título (mismo texto que hoy), descripción debajo en muted. `status`
  es un hueco a la derecha del título (ahí va "Loading live settings…", ver abajo). El elemento raíz lleva `data-ff`
  para que aplique la Inter variable de la familia, y `data-settings-page`.
- `SettingsGroup({ title?, children })`: UNA superficie (`bg-app-surface`, `rounded-card`, sin borde o con
  `border-app/40`) cuyas filas hijas se separan con línea fina (`divide-y divide-app` a 40-50 %). No hay tarjeta por
  fila. Lleva `data-settings-group`.
- `SettingsRow({ label, description?, children })`: etiqueta y descripción a la izquierda, control a la derecha,
  alineados al centro vertical, `min-h` de 52 px, padding horizontal 16 px. Etiqueta 13 px peso 500; descripción
  12 px muted. Lleva `data-settings-row`.
- `SettingsSegmented({ value, onChange, options, ariaLabel })`: control segmentado (`role="radiogroup"`, cada opción
  `role="radio"` con `aria-checked`) cuyo indicador activo se desliza con `FluidHoverHighlight` o `motion`
  (`layoutId`), spring de la familia, sin animación con `prefers-reduced-motion`.
- `SettingsStepper({ value, onChange, min?, max?, step?, unit?, ariaLabel })`: − valor + con los `Button` de la
  familia (variante fantasma/terciaria, tamaño pequeño); el valor en cifras tabulares (`tabular-nums`), sin caja
  propia.
- Acción de guardar: `Button` de la familia, variante primaria, UNA por sección, alineada a la derecha bajo el
  grupo. Estado de guardando con la prop `loading` del `Button` si el código actual ya tiene ese estado.

## Migración

- **Contenedor**: General y Executor se envuelven en `SettingsPage`; las demás secciones no se tocan en este paso
  (Health, API & Models, Model routing, Usage, Danger zone, Language, proyecto se ven y funcionan igual que hoy).
  "Loading live settings…" (`:923-927`) conserva texto exacto y condición, pero deja de taparle el título: pasa a la
  esquina superior derecha de `<main>` (`absolute right-4 top-3`, sans 12 px muted, sin `font-mono`,
  `pointer-events-none`). El hueco `status` de `SettingsPage` queda disponible pero sin uso en este paso.
  Al cambiar entre secciones migradas, el contenido entra con fundido + 4 px de desplazamiento, ~150 ms, con `motion`
  (ya instalado); nada con `prefers-reduced-motion`.
- **General / Appearance**: los 4 temas son `Card` de la familia con `selected` para el activo y `onClick` para
  elegir, en rejilla de 2 columnas. Sale la píldora "Active" con borde; el estado activo lo marca `selected` más un
  check discreto. El hex del tema queda en mono (es dato técnico). Los textos no cambian.
- **Executor**: un `SettingsGroup` con dos `SettingsRow`: Timeout → `SettingsStepper`; Mode → `SettingsSegmented`
  (Single-shot / Agentic). "Save executor" → `Button` primario. Mismos textos, mismos handlers y mismo estado.

## Reglas duras

- En los rangos migrados y en `primitives.tsx`: 0 clases de paleta de Tailwind
  (`emerald|zinc|rose|sky|amber|teal|purple|indigo|blue|red|green|slate|gray|orange|violet|cyan|pink|yellow`-N).
  Color solo por tokens (`text-app`, `text-app-muted`, `bg-app-surface`, `bg-app-elevated`, `border-app`,
  `app-accent`, `app-success|warning|error`) o los de la familia.
- `font-mono` solo en el hex del tema.
- No editar `components/ui/*` (terceros, se componen), ni `index.css`, ni los `--app-*`, ni la barra lateral de
  Settings (`:703-913`, es UI.25.2), ni ninguna otra sección.
- No añadir dependencias.
- Se conservan, porque los usan los gates: botón "General" y encabezado "Appearance" (`smoke.mjs:63-71`); botón
  "Executor" y la ausencia de "Default agent" (`chat-roles.mjs:272-277`); texto "Loading live settings…" que debe
  desaparecer al cargar (`model-routing.mjs:104`).

## Verificación (el ejecutor la corre y pega la salida real)

    bun run typecheck
    bun run lint
    bun run build:app
    bun run ui:fidelity:jsx
    bun run ui:gate smoke chat-roles model-routing

Y el conteo: `grep -cE '(emerald|zinc|rose|sky|amber|teal|purple|indigo|blue|red|green|slate|gray)-[0-9]' src/dashboard/app/src/components/settings/primitives.tsx` → 0.

Reportar: archivos tocados, decisiones tomadas dentro del margen del spec, y cualquier cosa del spec que no se pudo
cumplir tal cual (sin improvisar una alternativa fuera de alcance).
