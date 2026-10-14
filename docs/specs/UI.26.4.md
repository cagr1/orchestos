# UI.26.4 — Plan (tablero) e Instincts sin color de decoración

Ítem: PLAN.md § UI.26. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear en
el árbol (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
Reglas de forma de UI.26 y UI.25 (PLAN.md). **PROHIBIDO `git stash`, `git checkout` y `git restore`**: la contraprueba
se hace con copia en `/tmp` + `git show HEAD:<ruta> > <ruta>`, restaurar la copia y confirmar con `cmp` (AGENTS.md).

## Objetivo

Plan (`components/plan/PlanBoardView.tsx`, 719 líneas, 180 clases de paleta) e Instincts
(`components/instincts/InstinctsView.tsx`, 278 líneas, 83 clases de paleta) con la forma de Gr8r y los primitivos de
`components/layout/page.tsx` y `components/settings/primitives.tsx`. Solo presentación: ni handlers, ni estado, ni
endpoints, ni textos visibles (salvo mayúsculas forzadas, ver 4).

**Visto por el cerebro en el dashboard real (2026-10-14):** Plan pinta columnas con caja y cabecera de color
(azul "SANDBOXED RUNNING", ámbar "BLOCKED BY DAG"), id de tarjeta en índigo, "Add task" índigo, línea "10 tasks
declared in tasks.yaml" en mono; Instincts, etiquetas TRIGGER rosa y LEARNED ACTION índigo, "Add Manual Instinct"
índigo, barra de confianza verde, UUID completo en la cabecera. Ambas vistas pintan su propio fondo más oscuro que el
panel (`bg-zinc-950`), una banda dentro del panel. Y en la página de proyecto la "Zona de peligro" ocupa el fondo de la
pantalla: el tablero queda en ~120 px de alto en una ventana de 800×500.

## Reglas de esta pasada

1. **Cero clases de paleta de Tailwind** en los dos archivos (regex de `scripts/ui-gate/flows/shell-look.mjs`).
   Mapeo: fondos `zinc-950/900/800` → nada (deja ver el panel) o `bg-app-elevated` para superficies elevadas
   (tarjetas, entradas); textos `zinc-100/200/300` → `text-app`, `zinc-400/500/600` → `text-app-muted`; bordes
   `zinc-*` → línea tenue con `color-mix(in_srgb,var(--app-border)_50%,transparent)` (las `border-app/NN` no generan
   color); `indigo-*`/`pink-*`/`purple-*` de decoración → neutro; botones primarios ("Add task", "Add Manual
   Instinct", "Run"…) → `Button` de `@/components/ui/button` dentro de `SettingsPrimaryAction`; botones secundarios →
   `Button` `variant="ghost"`/`secondary` de la familia.
2. **Color solo como estado**, por token: éxito `app-success`, error `app-error`, aviso `app-warning`. Un punto de 6 px o
   el texto de una pista; nunca fondos ni bordes tintados (`bg-*-500/10`, `border-*-500/30` fuera).
3. **Plan (Kanban):** columnas sin caja ni borde, separadas por espacio (`gap-4`); cabecera de columna = punto de estado
   + nombre en `text-[12.5px] font-semibold text-app` + contador `text-[11px] tabular-nums text-app-muted` sin píldora.
   Tarjetas: `bg-app-elevated rounded-card`, sin borde ni sombra, `p-3`; id en `font-mono text-[11px] text-app-muted`
   en una línea (`truncate` con `title`); descripción `text-[13px] text-app` cortada a 3 líneas (`line-clamp-3`);
   motor (`external`, `codex`…) como `text-[11px] text-app-muted` sin caja. "No tasks in this lane" en
   `text-xs text-app-muted` sin caja punteada.
   Barra superior: el selector Kanban | PLAN.md | Table con `SettingsSegmented` si los flujos no buscan esos botones
   por rol `button` (grep en `scripts/ui-gate/flows/`); si los buscan, mismas clases sobre `<button>`. Buscador `h-7
   bg-app-elevated` sin borde, sans. "N tasks declared in tasks.yaml" en sans `text-xs text-app-muted`.
   Table: filas con la forma de Runs (UI.26.2): `h-10`, línea inferior tenue, `whitespace-nowrap`, ids truncados.
   PLAN.md (vista documento): solo los colores; la tipografía del documento no se toca.
4. **Instincts:** cada instinct como una superficie `bg-app-elevated rounded-card` sin borde; cabecera con el id en mono
   truncado (`max-w-[10rem] truncate` + `title`), las insignias AUTO / SIN PROYECTO como texto `text-[11px]
   text-app-muted` separado por `·` (sin caja), "verified" con punto `app-success`. TRIGGER y LEARNED ACTION: rótulo
   `text-[11px] font-semibold text-app-muted` (el literal se queda; quita `uppercase`/`tracking-*` solo si el texto en
   el JSX no está ya en mayúsculas) y el valor en `text-[13px] text-app`, sin caja de color. Confianza: barra de 4 px en
   `bg-app-accent` sobre `bg-app-bg`, cifra en `tabular-nums text-app`. El selector Active | Review Proposals con
   `SettingsSegmented` (mismo criterio de grep que en 3).
5. **Raíz de ambas vistas sin fondo propio** (fuera `bg-zinc-950`/`bg-app-bg`): el panel se ve continuo.
6. **Página de proyecto (`settings/OrchestSettingsView.tsx:2253` y `:2581-2600`):** la pestaña abierta ocupa al menos el
   alto visible del área de contenido y la "Zona de peligro" solo aparece al hacer scroll hasta el final (no comparte
   pantalla con el tablero). La Zona de peligro: fuera `rose-*`; un grupo como `SettingsGroup` con título "Zona de
   peligro (Danger Zone)" en `text-app-error`, texto en `text-app-muted` y el botón con el mismo nombre accesible
   ("Borrar definitivamente los datos del proyecto", lo busca `project-delete.mjs`) como `Button` de la familia en
   variante destructiva si existe, si no `ghost` con `text-app-error`.

## No tocar

`components/ui/*`, `index.css` y los `--app-*`, `ShellStatusBar.tsx`, `AgentComposer.tsx`, `components/dev/*`, las
demás pestañas, los modales que abre Plan (Explain, crear tarea) salvo sus clases de paleta si están en los mismos
archivos (en ese caso, mismo mapeo).

## Gate: ampliar `scripts/ui-gate/flows/project-tabs.mjs`

Pasos nuevos (el flujo ya abre Plan e Instincts con un proyecto sembrado):
- `plan no palette`: ninguna clase de la regex de paleta dentro del contenedor de la pestaña Plan, en Kanban y en
  Table.
- `instincts no palette`: igual en Instincts (si el fixture no tiene instincts, sembrar uno por la API que use el
  flujo o afirmar sobre el estado vacío y anotarlo).
- `plan board fills the view`: con la pestaña Plan abierta y el viewport del flujo, el borde superior de la Zona de
  peligro (`[data-danger-zone]`, añadir el atributo) queda por debajo del borde inferior del viewport.
- `tab roots transparent`: el `background-color` computado de la raíz de Plan y de Instincts es `rgba(0, 0, 0, 0)`.
Contraprueba: con `PlanBoardView.tsx` de HEAD (método de arriba), `project-tabs` debe fallar en `plan no palette`;
pegar la salida y restaurar.

## Verificación (pegar salida real)

    bun run typecheck
    bunx biome check <archivos tocados>
    bun run build:app
    bun run ui:fidelity:jsx
    bun run ui:gate project-tabs project-delete plan-doc tasks shell-look smoke text-sweep

Reportar: archivos tocados, qué selectores usan `SettingsSegmented` y cuáles conservan `<button>` (y qué flujo lo
exige), y cualquier regla que no se pudo cumplir tal cual.
