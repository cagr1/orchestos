# R.8.5.1 — revisión adversarial (rol qa)

Spec de lo revisado: `docs/specs/R.8.5.1.md` (+ `R.8.5.1-r3.md`).

Revisa SOLO el diff sin commitear de: `src/run/executors/codex.ts`, `src/run/executors/external.ts`,
`src/__tests__/codex-engine.test.ts`, `src/__tests__/external-engine.test.ts`, `scripts/ui-gate/flows/qa-negative.mjs`.
Ignora `IDEAS.md`, `orchestos.config.yaml`, `read-boundary.mjs`, `runs-summary.json`, `feature-status.json` (ajenos).

Busca defectos reales, no estilo:
1. Caminos de tareas de Codex o Claude que sigan lanzando el CLI sin el home/flags aislados (reintentos, QA, juez,
   adversarial/refuter, diagnose, split, cualquier otro spawn de `codex`/`claude` fuera del chat). Lista cada spawn
   con `archivo:línea` y di si aísla o no.
2. `ctx.opts.projectRoot` indefinido o apuntando al worktree en algún llamador.
3. Efectos de `--restricted --strict-mcp-config --settings` en una tarea de Claude que escribe archivos: ¿algo que
   antes funcionaba deja de funcionar (inputs fuera del worktree, MCP del proyecto, hooks del proyecto)?
4. Carreras o escrituras concurrentes en `.orchestos/agent-home/<cli>` cuando chat y tarea corren a la vez, y si ese
   directorio queda fuera de git y del diff de la tarea (el worktree no debe ver esos archivos como cambios).
5. Pasos del gate que no pueden fallar o cuyo nombre promete más de lo que comprueban.

No edites nada. No corras `test:coverage` ni `ui:gate` (hay un gate en vivo corriendo ahora mismo).
Entrega hallazgos ordenados por severidad con `archivo:línea` y un escenario concreto de fallo; si no hay, dilo.
Máximo 40 líneas.
