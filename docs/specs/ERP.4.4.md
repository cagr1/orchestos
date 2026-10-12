# ERP.4.4 — La corrección guardada del proyecto llega al prompt de la tarea

## Problema (reproducido en vivo, piloto ERP.4)
Instinct manual del proyecto (`verified = 1`, `confidence = 1.0`, `project_id` correcto en la tabla `instincts`).
La tarea siguiente del mismo proyecto, ejecutada por `codex exec` dentro de un worktree, no lo recibió.

Causa verificada leyendo el código:
- `src/run/harness.ts:229-239`: con sandbox, `effectiveRoot = worktree.path` y `ctx.effectiveRoot = effectiveRoot`
  antes de la cadena de enriquecimiento.
- `src/run/middlewares/instinct-apply.ts:17`: `getProject(realpathSync(ctx.effectiveRoot))` → la ruta del worktree
  (`<proyecto>/.orchestos/worktrees/<id>`) no es un proyecto registrado → `projectId = null` →
  `listApplicable(null)` devuelve `[]` (`src/instincts/store.ts:182-183`).

Sin verificar (verificarlo es parte de la tarea): que `ctx.instinctBlock` llegue de verdad al prompt que recibe el
CLI en el camino `codex` y en el camino `claude` por CLI. Consumidores vistos: `src/run/harness.ts:319`,
`src/run/executors/external.ts:96`, `src/run/executors/opencode.ts:70`, `src/run/prompt.ts:23-34`.
`src/run/executors/codex.ts` no nombra `instinctBlock` directamente: seguir el camino y confirmarlo.

## Cambio
1. `instinct-apply.ts`: resolver el proyecto por la raíz real del proyecto, no por el worktree. Usar la raíz que el
   contexto ya tenga (`opts.projectRoot` o equivalente en `RunContext`, ver `src/run/middleware.ts:100-171`); si el
   contexto no la expone, agregar el campo en `createRunContext` (`projectRoot: opts.projectRoot`). No resolver el
   proyecto recortando la cadena `.orchestos/worktrees`.
2. Si al seguir el camino el bloque de instincts NO llega al prompt del CLI en `codex` o en `claude`, corregirlo
   en el punto mínimo y decirlo en el reporte con `archivo:línea`. Si ya llega, no tocar nada ahí.
3. Buscar hermanos: otros middlewares o lecturas por proyecto en `src/run/middlewares/` y `src/run/harness.ts` que
   resuelvan el proyecto con `ctx.effectiveRoot` (mismo bug con worktree). Listarlos en el reporte con
   `archivo:línea`; corregir solo los que sean el mismo patrón exacto (`getProject(...effectiveRoot...)`).
4. Tests (bun test, sin LLM, sin red):
   - Test del middleware `instinctApply`: proyecto registrado en la DB de test con un instinct verificado;
     contexto con `effectiveRoot` = una ruta de worktree distinta de la raíz del proyecto → `ctx.instinctBlock`
     contiene la acción. Y el caso negativo: instinct de OTRO proyecto no aparece.
   - Seguir el patrón de los tests existentes que usan la DB (mirar cómo aíslan `ORCHESTOS_HOME`/la DB; recordar que
     Bun no ve cambios a `process.env` hechos en runtime).
   - Si el punto 2 requirió cambio, un test que afirme que el prompt del executor contiene `## INSTINCTS`.

## No tocar
- La selección (`listApplicable`: verified + umbral + project_id), el frontend, `scripts/`, `PLAN.md`, `NEXT.md`.
- El contador "Injected into N agent prompts" de la UI (se anota aparte).
- `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json` tienen cambios sin
  commitear ajenos: no tocarlos.

## Verificación (la corre el ejecutor)
- `bun run typecheck`
- `bun test` de los tests nuevos y de `src/run` que cubran middlewares/harness (los que existan)
- `bunx biome check` sobre los archivos tocados

NO correr `test:coverage` ni `ui:gate`, ni detenerse por el baseline (en el sandbox dan fallos falsos; se verifica
fuera). El candado de escritor `ocupado: claude …` es el cerebro que delega: se puede editar. No commitear.
