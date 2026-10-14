# UI.26.3 — Tasks en lista con detalle

Ítem: PLAN.md § UI.26. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear en
el árbol (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
Reglas de forma de UI.26 y UI.25 (PLAN.md). **Contraprueba sin `git stash`** (AGENTS.md: copia en `/tmp` +
`git show HEAD:<ruta> > <ruta>`, restaurar la copia y confirmar con `cmp`).

## Objetivo

La pestaña Tasks de la página de proyecto pasa de tarjetas con todo el texto a una lista de filas cortas (nombre,
agente, hora, estado) y un panel de detalle al pulsar, como Gr8r. Fuera el texto duplicado (`title || description`
seguido de `description`, `OrchestSettingsView.tsx:2462,2481`) y el UUID partido en varias líneas.

**Medido en Gr8r (navegador, 2026-10-14):** fila de 40 px con línea inferior tenue, id en mono 11 px muted, título
13,5 px en una línea; el detalle es un panel fijo a la derecha (`aside`, 620 px en ventana de 1128, fondo del panel,
`border-left` 1 px tenue, sombra `-18px 0 40px -24px rgba(0,0,0,.25)`), cabecera con id y botones, título ~20 px/600,
lista de propiedades: icono + rótulo 12,5 px muted en una columna de 112 px, valor a la derecha; luego secciones
"Description", etc.

## Backend (un campo nuevo, solo lectura)

1. `TaskRow` (`src/dashboard/types.ts:248`) gana `lastRunAt: string | null`: `created_at` del run `t.run_id` en la
   tabla `runs` (`SELECT created_at FROM runs WHERE id = ?`), `null` si no hay `run_id` o no existe la fila. Mismo
   patrón de acceso a DB que el resto de handlers.
2. Se rellena en **los dos** constructores de filas de `src/dashboard/handlers/tasks.ts`: `loadTaskRows` (~:86) y
   `handleApiTasks` (~:128). Mejor: extraer la construcción de la fila a una función común y usarla en ambos.
3. `src/dashboard/handlers/tasks.test.ts`: un caso que siembra un run y comprueba `lastRunAt`, y otro sin `run_id` →
   `null`.

## Front

4. `TaskItem` (`app/src/types/orchestos.ts`) gana `lastRunAt?: string | null`; `mapTask` (`app/src/api/tasks.ts`) y
   `TaskRowResponse` lo pasan. Grepear los fixtures `JSON.stringify` de `app/src/api/*.test.ts` y añadir el campo donde
   se construyan filas de tareas (no están tipados; `typecheck` no los ve).
5. **`ListRow`** nuevo en `app/src/components/layout/page.tsx` (junto a `PageHeader` y `StatStrip`):
   `ListRow({ leading?, id?, title, meta?, trailing?, onOpen, selected? })`. Un `div` con `role="button"`,
   `tabIndex={0}`, Enter/Espacio llaman `onOpen`, `data-list-row`. Alto `h-10`, `px-3`, `gap-3`, línea inferior
   `color-mix(in_srgb,var(--app-border)_50%,transparent)`, hover y `selected` = `bg-app-elevated`, sin borde ni sombra
   más. `id` en `font-mono text-[11px] text-app-muted max-w-[7rem] truncate` con `title`; `title` en
   `text-[13px] text-app truncate` (ocupa el resto); `meta` en `text-xs text-app-muted whitespace-nowrap`; `trailing`
   a la derecha. Los clics dentro de `trailing` no abren la fila (`stopPropagation`). Todo `whitespace-nowrap`.
6. **Pestaña Tasks** (`OrchestSettingsView.tsx:2417-2507`):
   - Fuera el bloque "Project Task Contracts" + descripción. Arriba de la lista, una línea: a la izquierda
     `N tasks` (`text-xs text-app-muted`), a la derecha "Run Next Task" como `Button` de la familia dentro de
     `SettingsPrimaryAction` (mismo nombre accesible, mismo `disabled`/`aria-disabled`).
   - Cada tarea es un `ListRow` con `data-task-row` y `data-task-id={task.id}`:
     - `leading`: punto de estado de 6 px — `done` `bg-app-success`, `failed`/`failed_permanent` `bg-app-error`,
       `running` `bg-app-accent`, `blocked` `bg-app-warning`, `pending` `bg-app-muted`. Es el único color de la fila.
     - `id`: `task.id`.
     - `title`: `task.title` si existe; si no, la primera línea de `task.description` cortada a 80 caracteres.
     - `meta`: `task.assignedAgent` (el texto actual "agente · modelo", tal cual: `tasks.mjs` lo busca exacto) y, si
       hay `lastRunAt`, la hora: hoy → `HH:MM`, otro día → `MMM D` (`Intl.DateTimeFormat('en', …)`), separados por
       `·`. Sin "Agent:".
     - `trailing`: el botón Run si `isTaskRunnable` (mismo `aria-label={`Run ${task.id}`}`, texto "Run", `disabled`
       igual), como `Button` `variant="ghost" size="compact"`; y la etiqueta de estado con el **mismo texto que
       `StatusBadge`** (DONE, FAIL, PENDING… — los flujos la buscan exacta) en `text-xs text-app-muted`, sin píldora ni
       color. Si `StatusBadge` exporta su mapa de etiquetas, reutilízalo; si no, expórtalo.
   - Lista vacía: `EmptyState` como hoy.
7. **Detalle** (`TaskDetailPanel`, archivo nuevo `app/src/components/tasks/TaskDetailPanel.tsx`): se abre al pulsar
   una fila (estado `selectedTaskId` en la vista; si la tarea desaparece de `tasks`, se cierra). `aside` fijo a la
   derecha, alto completo bajo la cabecera de la app, ancho `min(620px, 55vw)`, `bg-app-surface`, `border-l` tenue,
   la sombra de Gr8r, `data-task-detail`, `data-ff`. Entra con `motion` deslizando en x con `spring` de
   `@/lib/springs`; con `prefers-reduced-motion`, sin desplazamiento. Se cierra con Esc y con un botón
   `aria-label="Close task detail"` (icono X, `Button` ghost de solo icono: el icono va como hijo).
   Contenido:
   - cabecera: `task.id` en mono muted y el cierre;
   - título `text-xl font-semibold` (misma regla de título que la fila);
   - propiedades (rótulo muted en columna de 112 px, icono lucide 14 px muted, valor `text-[13px]`): Status (texto
     de `StatusBadge` + punto), Agent, Engine, Skill (si hay), Depends on (ids en mono, o "None"), Outputs (la lista
     **con el formato actual `[a, b]`**: `tasks.mjs` busca `[README.md]`), Run (`runId` en mono, si hay), Last run
     (fecha y hora completas, si hay), Attempts (`retryCount/TASK_MAX_ATTEMPTS`, si `retryCount > 0`);
   - si hay `retryReason` y `retryCount > 0`: el texto actual `Attempt N/M failed: <reason>` en `text-app-error`;
   - sección "Description" con `task.description` completa (`whitespace-pre-wrap`) **solo si** difiere del título
     mostrado; sección "Acceptance criteria" (lista) si hay.
8. Fuera clases de paleta de Tailwind en todo el bloque de la pestaña Tasks, incluida la sección "Orquestación"
   (`:2248-2407`) y la banda "Loading project data…" (`:2409-2415`): `text-rose-300` → `text-app-error`,
   `bg-rose-950/20` → sin fondo, `text-zinc-950` → el primario de la familia como arriba. No cambiar la estructura ni
   la lógica de "Orquestación".

## Flujos a ajustar (`scripts/ui-gate/flows/tasks.mjs`)

- `div.rounded-card` (`:238`, `:321`) → `[data-task-row]` con el mismo `has:`.
- "real output visible" (`:221-226`) y "retry reason is visible in the task tab" (`:326-331`): antes de afirmar, abrir
  el detalle de la tarea correspondiente (clic en su `[data-task-row]`) y cerrarlo después (Esc).
- Pasos nuevos, al final del flujo:
  - `task rows flat`: todas las `[data-task-row]` miden 40 px (±1) de alto, sin `border-top`/`box-shadow`.
  - `no palette in tasks tab`: ninguna clase de la regex de paleta de `shell-look.mjs` dentro del contenedor de la
    pestaña.
  - `task detail opens`: clic en una fila → `[data-task-detail]` visible con el id de la tarea; Esc → desaparece.
  - `no duplicated description`: en la fila de una tarea sin `title`, el texto de la descripción aparece una sola vez
    en la fila.
- `project-tabs.mjs:424` busca `button` "Run" exacto: debe seguir funcionando (el botón de la fila conserva nombre
  accesible `Run <id>`; comprueba a qué botón apunta ese paso y, si deja de resolverse, ajusta el selector al de la
  fila de `gate-tabs-task` sin cambiar lo que afirma).

Contraprueba: con `OrchestSettingsView.tsx` de HEAD (método de AGENTS.md), `tasks` debe fallar en `task rows flat`
o `task detail opens`; pegar la salida y restaurar.

## No tocar

`components/ui/*`, `index.css` y los `--app-*`, `ShellStatusBar.tsx`, `AgentComposer.tsx`, `components/dev/*`, las
demás pestañas de proyecto, la lógica de "Orquestación", los endpoints salvo el campo `lastRunAt`.

## Verificación (pegar salida real)

    bun run typecheck
    bun run lint
    bun test src/dashboard/handlers/tasks.test.ts src/dashboard/app/src/api
    bun run build:app
    bun run ui:fidelity:jsx
    bun run ui:gate tasks project-tabs qa-negative shell-look smoke runs-graph text-sweep

Reportar: archivos tocados, si `StatusBadge` ya exportaba sus etiquetas, a qué botón apuntaba `project-tabs.mjs:424`,
y cualquier regla que no se pudo cumplir tal cual.
