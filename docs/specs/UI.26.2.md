# UI.26.2 — Plantilla de página: encabezado, franja de cifras y estado vacío

Ítem: PLAN.md § UI.26. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear en
el árbol (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
Reglas de forma de UI.26 (PLAN.md § UI.26) y de UI.25 siguen valiendo.

## Objetivo

Primitivos de página con la forma de Gr8r y sus primeros consumidores: la cabecera de la página de proyecto (con sus
pestañas), la vista Runs y la cabecera interna del chat. Solo presentación: ni handlers, ni estado, ni textos visibles.
La fila de lista (`ListRow`) se crea en UI.26.3 junto a su primer consumidor (Tasks), no aquí.

**Medido en Gr8r (navegador, 2026-10-14):** título 600 con descripción 13,5 px muted debajo y acciones a la derecha
(botones de 30 px, radio 6 px); franja de cifras = una sola superficie con borde de 1 px y radio 10 px, celdas sin caja
separadas por línea vertical, `padding 14px 16px`, rótulo 12,5 px muted, cifra 22 px/600, pista 12 px muted (color solo
si es estado: "need attention" en rojo, "this week" en verde); filas de 40 px con línea inferior de 1 px muy tenue.

## Dónde

- Nuevo `src/dashboard/app/src/components/layout/page.tsx`.
- `src/dashboard/app/src/components/settings/primitives.tsx` (`SettingsPage` reutiliza el encabezado nuevo).
- `src/dashboard/app/src/components/common/ViewStateFeedback.tsx` (`EmptyState`).
- `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx:2194-2252` (cabecera de proyecto y pestañas).
- `src/dashboard/app/src/components/runs/RunsEvidenceView.tsx:284-430` (vista de lista de Runs).
- `src/dashboard/app/src/components/chat/OrchestChatView.tsx:253-275` (cabecera interna del chat).

## Primitivos (`components/layout/page.tsx`)

1. `PageHeader({ title, description?, meta?, actions? })`: `h1` `text-xl font-semibold tracking-tight text-app`;
   `meta` en línea a la derecha del título (p. ej. la rama) en `text-xs text-app-muted`; `description` debajo en
   `text-[13px] text-app-muted`; `actions` alineadas a la derecha. Sin borde, sin fondo propio.
   `SettingsPage` pasa a usar `PageHeader` para su `<header>` (mismo resultado visual que hoy; su `status` va como
   `actions`). No cambiar las props públicas de `SettingsPage`.
2. `StatStrip({ items })` con `items: { label; value; hint?; tone?: 'success' | 'error' | 'warning' }[]`: un
   contenedor `rounded-card border border-app/40`-equivalente (usar `color-mix` arbitrario como en `SettingsGroup`, las
   `border-app/NN` no generan color) sin fondo propio; celdas en `grid` con tantas columnas como ítems (2 en ancho
   estrecho), separadas por línea vertical del mismo color (`[&>*+*]:border-l`); cada celda `px-4 py-3.5`, rótulo
   `text-[12.5px] text-app-muted`, valor `text-[22px] font-semibold tabular-nums text-app` (sans), pista `text-xs
   text-app-muted`. `tone` colorea **solo la pista** con `text-app-success` / `text-app-error` / `text-app-warning`
   (verificar que esos tokens existen en `index.css`; si alguno no, usar el que exista y reportarlo). Valor largo:
   `truncate` con `title`.
3. `EmptyState` (mismo archivo y mismas props que hoy, todos los consumidores lo heredan): sin caja ni borde ni fondo;
   icono 20 px `text-app-muted` sin círculo; título `text-[13px] font-semibold text-app`; descripción `text-xs
   text-app-muted`; botón de acción = `Button` de `@/components/ui/button` envuelto en `SettingsPrimaryAction`
   (fuera `text-zinc-950`).

## Consumidores

4. **Cabecera de proyecto** (`OrchestSettingsView.tsx:2196-2250`): fuera `border-b`, `bg-app-surface/40` y la caja del
   icono `FolderClosed` (si se conserva el icono: 16 px, `text-app-muted`, sin caja). Título y rama con `PageHeader`
   (rama en `meta`, `font-mono` permitido: es un id); la ruta en `description` con `font-mono`. Padding de página
   `px-6 pt-7` como Gr8r.
5. **Pestañas de proyecto** (Tasks | Runs | Graph | …): siguen siendo `<button>` con el mismo texto (los flujos las
   buscan por rol `button` y nombre exacto). Forma de fila de navegación de UI.26.1: `h-7 px-2 gap-2 rounded-control
   text-[12.5px] font-medium`, inactiva `text-app-muted hover:bg-app-elevated hover:text-app`, activa `bg-app-elevated
   text-app`; icono 14 px en el tono del texto. Sin borde ni subrayado. Dejar de usar `app-tab-btn*` aquí (no borrar
   las clases de CSS: las usa Runs y otros).
6. **Runs, lista** (`RunsEvidenceView.tsx:284-430`):
   - raíz sin `bg-app-bg` (deja ver el panel), `px-6`;
   - las 4 tarjetas KPI → `StatStrip`: Total Runs, QA Pass Rate (`tone` success si ≥ 80 %, error si < 50 %, sin tono
     en medio o si no hay runs), Total Cost, Token Volume; sin `font-mono`, sin `text-emerald-*` ni `text-app-accent`;
   - barra de búsqueda y filtros: sin `border-b` ni fondo; buscador `h-7 bg-app-elevated` sin borde, sans;
     los filtros All | Passed | Failed con `SettingsSegmented` si encaja con el estado (`statusFilter`); si algún
     flujo los busca por rol `button`, mismas clases que `SettingsSegmented` sobre `<button>` (grep antes);
   - tabla: se queda `<table>`/`<tr>` (`runs-graph` busca `tr`). Cabecera sin fondo, `text-xs font-medium
     text-app-muted`; filas de 40 px (`h-10`) con línea inferior tenue (`color-mix` 50 %), hover `bg-app-elevated`;
     celdas `text-[13px]`; `font-mono` solo en Run ID, task id y modelo; coste y duración `tabular-nums` sans en
     `text-app-muted`; "Inspect" en `text-app-muted hover:text-app` sin subrayado.
   - La vista de detalle de un run (arriba de la línea 284) no se toca.
7. **Cabecera interna del chat** (`OrchestChatView.tsx:255`): fuera `border-b border-app` y `bg-app-bg` (la banda
   oscura dentro del panel); título `text-[13px] font-semibold`. Alto y contenido iguales.

## No tocar

`components/ui/*`, `index.css` y los `--app-*`, `ShellStatusBar.tsx`, `AgentComposer.tsx`, `components/dev/*`, la
vista de detalle de Runs, el contenido de las demás pestañas de proyecto (UI.26.3–26.5) y las demás secciones de
Settings (UI.26.6).

## Gate: ampliar `scripts/ui-gate/flows/shell-look.mjs`

Pasos nuevos, tema por defecto, con un proyecto abierto en Settings (sembrarlo como lo hace `project-tabs`):
- `project header flat`: el contenedor de la cabecera de proyecto tiene `border-bottom-width` = 0 y fondo
  transparente (`rgba(0, 0, 0, 0)`).
- `project tabs flat`: los botones de pestaña no tienen borde (`border-*-width` = 0) ni `box-shadow`, alto 28 px.
- `runs stat strip`: en la pestaña Runs existe `[data-stat-strip]` (añadir ese atributo en `StatStrip`) con 4 celdas
  y ninguna clase de paleta dentro de la vista Runs (regex de UI.26.1).
- `chat header no band`: en Chat, la cabecera interna (`data-chat-header`, añadirlo) tiene `border-bottom-width` = 0 y
  fondo transparente.
Contraprueba: con `RunsEvidenceView.tsx` revertido (`git stash push -- <ruta>`), `shell-look` debe fallar en `runs
stat strip`; pegar la salida y `git stash pop`.

## Verificación (pegar salida real)

    bun run typecheck
    bun run lint
    bun run build:app
    bun run ui:fidelity:jsx
    bun run ui:gate shell-look smoke project-tabs project-isolation runs-graph tasks chat-streaming thread-states text-sweep

Reportar: archivos tocados, si los filtros de Runs usan `SettingsSegmented` o sus clases (y por qué), tokens de tono
que existían o faltaban, y cualquier regla que no se pudo cumplir tal cual.
