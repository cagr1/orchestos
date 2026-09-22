# UI.13.2b — Proyectos, header y Dev de la app nueva con datos reales

Regla de la cadena (PLAN.md § UI.13): la UI del prototipo (`src/dashboard/app/src/`) no se rediseña;
solo se cambian sus mocks por la API real. El vanilla es referencia de lectura. Reusar
`app/src/api/chat.ts` (UI.13.2a) para todo lo que sea sesión.

## Qué es Dev hoy en el producto (leer, no copiar markup)

`src/dashboard/public/app.js:730-765` y `:836-845`: Dev = proyectos registrados y, bajo cada uno,
sus **agentes**, que son sesiones de chat con `projectId` (`GET /api/chat/sessions?project=<id>`),
con loader mientras el turno corre y check al terminar (`turn-status`). Abrir un agente muestra esa
sesión en Dev; sin agente abierto → estado vacío con logo. Se recuerda el último en
`localStorage['orchestos-last-dev']`.

## Qué conectar

Nueva `app/src/api/projects.ts` (+ tests de mapeo), y en la UI:

1. **Sidebar Dev** (`components/layout/ShellSidebar.tsx`): proyectos de `GET /api/projects`
   (`app.js:749`, `:919`) en lugar de `INITIAL_PROJECTS` (`App.tsx:31`). Chip con el número de
   agentes, agentes con loader/check reales. `+` del grupo → `POST /api/projects/choose` (selector
   nativo; ver cómo lo llama el vanilla). `+` de un proyecto → New chat (modal real de 13.2a) con ese
   `projectId`. Menú `…` → las acciones que el vanilla tiene para un proyecto; las que no tengan
   backend no se muestran.
2. **Dev workspace** (`components/dev/OrchestDevWorkspace.tsx`): con agente abierto, la sesión
   real (mensajes y envío con `api/chat.ts`); sin agente, el estado vacío del prototipo. Lo del
   prototipo que no tenga backend (salidas de terminal falsas, etc.) se quita; listarlo en el reporte.
3. **Header** (`components/layout/ShellHeader.tsx`): nombre del proyecto activo real; la rama solo si
   la API la da (buscar en `/api/projects` o `/api/project/context`); si no, no se muestra.
4. **Panel derecho** (`components/dev/OrcaRightInspector.tsx`): Files con `GET /api/explorer/tree` y
   `GET /api/explorer/file` en lugar de `ORCHESTOS_FILE_TREE`; Diff con lo que usa el vanilla
   (`app.js:956-1000`). **History se oculta**: su backend es un ítem de producto aparte (PLAN.md § UI.12,
   "Fuera").
5. Cualquier import restante de `data/orcaProjectData.ts` o `data/mockOrchestosData.ts` en estas
   vistas se elimina; si queda sin uso, borrar el archivo de mocks correspondiente.

## No tocar

`src/dashboard/public/**`, `src/dashboard/public-src/**`, handlers del server, `PLAN.md`. Sin CSS
escrito a mano: estilos solo como `className` Tailwind. No commitear.

## Verificación

- Ejecutor: `bun run build:app`, `bun run typecheck`, tests de `app/src/api/*.test.ts` verdes. Tu
  sandbox no abre puertos: el gate en vivo lo corre el cerebro.
- Cerebro, en vivo en :4330: proyectos del sidebar = `GET /api/projects`; agentes de cada proyecto =
  sesiones con ese `projectId`; abrir un agente muestra sus mensajes; `+` de proyecto crea una sesión
  con `projectId`; header con el nombre real; Files lista el árbol real y abre un archivo; 0 errores.
