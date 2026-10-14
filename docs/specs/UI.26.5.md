# UI.26.5 — Memory, Specs, Skills y Graph con la forma de Gr8r

Ítem: PLAN.md § UI.26. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear en
el árbol (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
Reglas de forma de UI.26 y UI.25 (PLAN.md § UI.26, línea "Reglas:"). **PROHIBIDO `git stash`, `git checkout` y
`git restore`**: la contraprueba se hace con copia en `/tmp` + `git show HEAD:<ruta> > <ruta>`, restaurar la copia y
confirmar con `cmp` (AGENTS.md).

## Objetivo

Cuatro vistas de proyecto (rutas bajo `src/dashboard/app/src/components/`) con la forma de Gr8r y los primitivos de
`layout/page.tsx` (`ListRow`, `ListHeader`, `PageHeader`), `settings/primitives.tsx` (`SettingsSegmented`,
`SettingsGroup`, `SettingsPrimaryAction`) y `common/ViewStateFeedback.tsx` (`EmptyState`). Solo presentación: ni
handlers, ni estado de datos, ni endpoints, ni textos visibles (salvo mayúsculas forzadas por CSS).

| Archivo | Líneas | Clases de paleta | `font-mono` |
|---|---|---|---|
| `context/ContextView.tsx` (Graph) | 162 | 46 | 8 |
| `memory/MemoryView.tsx` | 240 | 66 | 7 |
| `specs/SpecsView.tsx` | 226 | 74 | 10 |
| `skills/SkillsView.tsx` | 177 | 46 | 6 |

**Señalado por Carlos (tema `orchestos`, 2026-10-14):** la raíz de `ContextView.tsx:20`, `SpecsView.tsx:45` y
`SkillsView.tsx:52` es `bg-zinc-950` (casi negro neutro) sobre el panel `bg-app-surface` (#0e1320): toda el área de
contenido se ve con otro fondo. Y la tarjeta de Graph es `bg-zinc-900/60` + `border-zinc-800` en los 4 temas.

## Reglas de esta pasada

1. **Raíz de las 4 vistas sin fondo propio** (fuera `bg-zinc-950`, `bg-zinc-950/80` de barras internas y
   `bg-app-bg`): el panel se ve continuo, como Tasks. Primero esto.
2. **Cero clases de paleta de Tailwind** en los 4 archivos (regex `PALETTE` de
   `scripts/ui-gate/flows/shell-look.mjs:8`). Mapeo, el mismo de UI.26.4: fondos `zinc-950/900/800` → nada o
   `bg-app-elevated` para superficies elevadas (tarjetas, entradas, panel de detalle); textos `white`/`zinc-100/200/300`
   → `text-app`, `zinc-400/500/600` → `text-app-muted`; bordes `zinc-*` → línea tenue
   `border-[color:color-mix(in_srgb,var(--app-border)_50%,transparent)]` (las `border-app/NN` no generan color);
   `indigo-*`/`purple-*`/`sky-*`/`teal-*` de decoración → neutro. Botones primarios → `Button` de
   `@/components/ui/button` dentro de `SettingsPrimaryAction`; secundarios → `Button` `variant="ghost"`/`secondary`.
3. **Color solo como estado**, por token (`app-success`, `app-error`, `app-warning`): punto de 6 px o texto de la
   pista; nunca fondos ni bordes tintados (`bg-*-500/10`, `border-*-500/30` fuera). Ej.: estado del spec (approved /
   draft), lint pass/fail, conflicto de memoria abierto, build OK/fallo de skill.
4. **`font-mono` solo en código, rutas, ids y cifras de tabla** (ej. `.orchestos/specs/<id>.md`, `$ orchestos spec
   show …`, topicKey, nombres de archivo). Títulos, descripciones y rótulos en sans.
5. **Rótulos de sección:** `text-[11px] font-semibold text-app-muted`; quitar `uppercase`/`tracking-*` solo si el
   literal del JSX no está ya en mayúsculas (los literales no se cambian).
6. **Maestro-detalle con estado vacío:**
   - **Specs** (ya es maestro-detalle): lista izquierda con `ListRow` (o sus mismas clases si `ListRow` no encaja en el
     ancho) — id en mono, título, punto de estado; activo = `bg-app-elevated`. Detalle a la derecha sin caja de color;
     "UNLOCKED / LOCKED (AWAITING APPROVAL)" como texto con punto de estado. Sin specs: `EmptyState` actual.
   - **Memory:** filas planas (`ListRow` o mismas clases) con topicKey en mono y contenido como título; el banner de
     conflictos como una fila de aviso (punto `app-warning` + texto + botón "Open Synthesis & Resolution Wizard"),
     sin caja ámbar. El asistente de resolución conserva su estructura (es un modal/panel); solo pasa a tokens. Sin
     memorias: `EmptyState` con el texto que ya exista en la vista, o "No memory yet" si no hay ninguno.
   - **Skills:** filas planas en una columna (fuera la rejilla de tarjetas `md:grid-cols-2`): nombre, lenguaje y
     verificadores en `text-app-muted`; **cada fila conserva su botón "Recompile"** (el gate cuenta un "Recompile" por
     skill) y el resultado "Build succeeded:" / "Build failed:" se ve en la fila o justo debajo. El filtro de lenguaje y
     el buscador: `h-7 bg-app-elevated` sin borde, sans. Sin skills: `EmptyState`.
   - **Graph (`ContextView`):** el selector CONSTITUTION.md | CONTEXT.md | Code Graph con `SettingsSegmented` si los
     flujos no buscan esos botones por rol `button` y nombre (grep en `scripts/ui-gate/flows/`; `runs-graph.mjs:241`
     busca `button` `/^Code Graph/`); si los buscan, mismas clases que `SettingsSegmented` sobre `<button>`. Contenido
     sin tarjeta con borde: superficie `bg-app-elevated rounded-card` sin borde; las cifras del grafo con
     `tabular-nums`. "Rebuild Code Graph" conserva su nombre accesible.
7. **Filas de 28–40 px sin borde de caja ni sombra**; separador inferior tenue como en `ListRow`.

## No tocar

`components/ui/*`, `index.css` y los `--app-*`, `layout/page.tsx` y `settings/primitives.tsx` (se usan, no se
cambian; si un primitivo no encaja, copiar sus clases), `ShellStatusBar.tsx`, `AgentComposer.tsx`, `components/dev/*`,
`OrchestSettingsView.tsx` (salvo que la raíz con fondo propio esté ahí, en cuyo caso reportarlo sin tocarlo), las
demás pestañas. Ningún nombre accesible ni texto que lean los flujos: `Open Synthesis & Resolution Wizard`,
`Commit Authoritative Resolution`, `Approve Gate`, `Lint WHEN/THEN`, `Lint: <status> (<n>)`, `Recompile`,
`Build succeeded:`, `Build failed:`, `Dependency Topology & Code Graph`, `Rebuild Code Graph`, `Code Graph (…)`, y el
contenido de memoria/spec como texto exacto en un nodo (`getByText(..., { exact: true })`).

## Gate: ampliar `scripts/ui-gate/flows/project-tabs.mjs`

Pasos nuevos (el flujo ya siembra memoria, spec y skills y abre cada pestaña):
- `memory no palette`, `specs no palette`, `skills no palette`: ninguna clase de la regex `PALETTE` dentro del
  contenedor de la pestaña (reutilizar la función de inspección de `shell-look.mjs` o copiar su regex).
- `graph no palette`: igual en Graph; si `project-tabs` no abre Graph, añadirlo al flujo (el botón de pestaña o
  `runs-graph.mjs:240-241` muestran cómo se llega) o ponerlo en `runs-graph.mjs` y decirlo.
- `tab roots transparent (memory/specs/skills/graph)`: el `background-color` computado de la raíz de cada vista es
  `rgba(0, 0, 0, 0)`. Añadir `data-view="memory|specs|skills|graph"` a la raíz para localizarla.
Contraprueba: con `SpecsView.tsx` de HEAD (método de arriba), `project-tabs` debe fallar en `specs no palette` y en la
raíz transparente de specs; pegar la salida y restaurar.

## Verificación (pegar salida real)

    bun run typecheck
    bunx biome check <archivos tocados>
    bun run build:app
    bun run ui:fidelity:jsx
    bun run ui:gate project-tabs runs-graph project-isolation shell-look smoke text-sweep

Si un gate falla por Codex (`workspace routing discovery failed`, HTTP 502) y no por esta vista, decirlo con la línea
del log y seguir con los demás; no es de este ítem.

Reportar: archivos tocados, qué selectores usan `SettingsSegmented` y cuáles conservan `<button>` (y qué flujo lo
exige), conteo final de paleta y `font-mono` por archivo, y cualquier regla que no se pudo cumplir tal cual.

## Corrección r2 (cerebro, tras mirar las capturas del gate 2026-10-14)

La cabecera de cada vista (título, buscador, acciones) va a todo el ancho desde el borde izquierdo del panel, pero el
contenido va centrado en un contenedor `mx-auto max-w-4xl` (o similar): en Memory, Skills y Graph la lista/tarjeta
empieza ~120 px más a la derecha que la cabecera y termina antes. Gr8r alinea todo al mismo borde izquierdo.
1. En las 4 vistas, quitar los contenedores `mx-auto max-w-*` del contenido: el contenido usa el mismo padding
   horizontal que la cabecera (`px-6`) y llega al borde derecho. Textos largos (descripción de skill, párrafo del
   conflicto de memoria) con `max-w-prose` en el propio párrafo, no en el contenedor.
2. En Specs, la lista y el detalle ocupan todo el alto y ancho del panel (lista de ancho fijo, detalle `flex-1`).
3. Gate: en `project-tabs.mjs`, paso `content aligned with header` por vista (memory, specs, skills, graph): el
   `left` del primer hijo del contenido (fila, tarjeta o lista) difiere ≤ 4 px del `left` del título de la cabecera
   de esa vista; y un `shot` por vista (`memory`, `specs`, `skills`, `graph`) para que el cerebro las mire.
   Contraprueba: con el `MemoryView.tsx` actual (copia antes de editar), el paso de memory falla.
4. Verificación: la misma de arriba.
