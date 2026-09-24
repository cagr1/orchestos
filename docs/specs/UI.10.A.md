# UI.10.A — El PLAN.md de cada proyecto, en solo lectura, en la pestaña Plan

Decisiones de Carlos (PLAN.md § UI.10.A, no volver a preguntar): (b) cada proyecto usa su propio `PLAN.md` en solo
lectura, sin imponer el formato de OrchestOS y sin migrar `plan_items`; y se ve con un conmutador
`Kanban | Table | PLAN.md` en la pestaña Plan de Settings → proyecto, igual para todos los proyectos.

## Estado real (leído por el cerebro)
- `PlanBoardView.tsx:64` tiene `viewMode: 'kanban' | 'table'` con su toggle en `:139-155`; se monta en
  `OrchestSettingsView.tsx:2095` con las tasks del proyecto.
- `server.ts:174-193`: `/api/plan*` solo responde para el cwd del dashboard (OrchestOS); el resto devuelve
  `unavailable`/409. Esas rutas (DB de OrchestOS) se quedan como están.
- El `PLAN.md` de SalaDespecho es una checklist libre (`- [ ] Auditar…`, sin ID ni 🧠⚡🔍): el parser de
  `scripts/plan-status.ts` devuelve 0 ítems sobre él. No reutilizarlo.

## Cambios
1. **Módulo nuevo** (p. ej. `src/plan/read-plan-doc.ts`): lee `<root>/PLAN.md` del proyecto y devuelve
   `{ exists, sections: [{ title, level, items: [{ checked, text, depth }], text }] }`. Reglas: encabezados `#`..`###`
   abren sección; `- [ ]`/`- [x]` (con sangría = `depth`) son ítems; el resto de líneas se conserva como texto plano
   de la sección (sin HTML, sin ejecutar nada). Tope de tamaño razonable (p. ej. 1 MB) → error claro. Nunca escribe.
   Tests con: checklist libre tipo SalaDespecho, el `PLAN.md` real de este repo (≥1 sección, ítems con ID), archivo
   ausente (`exists:false`), sangrías.
2. **Endpoint** `GET /api/plan/doc` con `withDashboardProject` (proyecto por `x-orchestos-project-id`), sin corte por
   cwd: funciona para cualquier proyecto registrado, OrchestOS incluido.
3. **Front:** tercera opción `PLAN.md` en el toggle de `PlanBoardView` (mismo markup/className que `Kanban`/`Table`,
   icono lucide `FileText`). Al elegirla: pide `/api/plan/doc` del proyecto de la pestaña y pinta secciones
   (título) con sus checkboxes deshabilitados y el texto; sin edición. Sin `PLAN.md`: estado vacío de una línea
   (`No PLAN.md in this project`). El proyecto llega por props desde `OrchestSettingsView` (el de la pestaña, no el
   activo de la cabecera).

## Gate (lo que el cerebro va a medir)
Flujo nuevo `scripts/ui-gate/flows/plan-doc.mjs`:
- Proyecto temporal con `PLAN.md` estilo SalaDespecho (`## Fase 1`, `- [ ] Auditar login`, `- [x] Migrar DB`,
  sub-ítem sangrado) → Settings → proyecto → Plan → `PLAN.md`: se ven `Fase 1`, los 3 ítems, `Migrar DB` marcado y
  deshabilitado.
- Segundo proyecto temporal sin `PLAN.md` → estado vacío.
- Proyecto OrchestOS (el repo): la vista muestra al menos un ítem con ID real de este `PLAN.md` (p. ej. `UI.10.A`).
- `Kanban` y `Table` siguen funcionando (volver a `Kanban` muestra el tablero).
- 0 errores de consola; proyectos temporales purgados (`POST /api/projects/:id/purge`).
- Verde: `bun run gate:all` + `bun run ui:gate plan-doc` + `project-tabs` + `smoke`.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues. El dashboard real corre en :4242: no lo mates. La DB real solo por la API y
solo sobre los proyectos temporales. No re-ejecutes `agent:preflight`. `bun run typecheck` completo;
`bunx biome check . --diagnostic-level=error` = 0 errores; `bun run ui:fidelity:jsx` verde. Lista TODOS los
archivos que toques. Si algo falla por el sandbox (EADDRINUSE, EPERM, red), dilo así. No hagas commit.
