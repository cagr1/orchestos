# UI.13.4a — Cerrar agente → History, y quitar proyecto (backend + front)

PLAN.md § UI.13.4 (puntos 1, 2, 3 y 6). Regla de Carlos 2026-09-22: los comportamientos de la plantilla
`/Users/carlosgallardo/Documents/screens/orchestos-ai-agent-dashboard` se hacen reales, no se quitan.
Recuperar el markup/comportamiento de la plantilla (`src/components/...`) tal cual y cablearlo.

## Backend

1. **Archivar sesión.** Migración nueva en `src/db/migrate.ts`: columna `archived_at TEXT NULL` en la
   tabla de sesiones de chat (`src/db/chat-sessions.ts`). Rutas nuevas en `src/dashboard/server.ts` con
   handlers en `src/dashboard/handlers/`:
   - `POST /api/chat/sessions/:id/archive` y `POST /api/chat/sessions/:id/restore`.
   - `GET /api/chat/sessions` excluye archivadas por defecto; `?archived=1` devuelve solo archivadas
     (combinable con `project=`).
   - `DELETE /api/chat/sessions/:id` ya existe: es el "borrar definitivo".
2. **Quitar proyecto.** `DELETE /api/projects/:id`: des-registra el proyecto (tabla `projects`,
   `migrate.ts:521`) y borra sus sesiones de chat. **Nunca toca archivos del disco.** Con el mismo
   chequeo de `Origin` que los demás métodos que escriben.
3. Tests `bun:test` de las tres rutas (incluido: quitar proyecto no borra nada del disco; archivada no
   aparece en la lista normal y vuelve al restaurar).

## Front (`src/dashboard/app/src/`)

4. Sidebar Dev: botón cerrar agente en hover (plantilla `ShellSidebar.tsx:388-410`) → archive. Menú `…`
   del proyecto con "Project settings" y "Delete project" + `DeleteProjectModal` (plantilla `:310-345`,
   `:547`) → `DELETE /api/projects/:id`; el texto del modal dice que los archivos no se tocan.
5. Inspector: pestaña **History** de la plantilla (`OrcaRightInspector.tsx:399-600`) de vuelta, con
   sesiones archivadas reales: agrupadas por proyecto con contador, Workspace | Project | All, búsqueda,
   última línea del mensaje, meta (nº de mensajes, hace cuánto, modelo), detalle expandible, menú con
   Restaurar y Borrar.
6. Tiempo relativo de agentes: hoy muestra `0m` casi siempre; calcularlo de `updatedAt` real
   (formato de la plantilla).

## No tocar

`src/dashboard/public/**`, `src/dashboard/public-src/**`, `PLAN.md`. Sin CSS escrito a mano. No
commitear. No invocar `codex exec` ni delegar a otro agente.

## Verificación

- Ejecutor: `bun run build:app`, `bun run typecheck`, `bun run test:coverage` verdes.
- Cerebro en vivo en :4330: cerrar un agente → desaparece del sidebar y aparece en History; restaurar →
  vuelve; borrar desde History → `DELETE`; quitar un proyecto de prueba registrado para el gate →
  desaparece de `/api/projects` y su carpeta sigue en disco; tiempos relativos reales; 0 errores.
