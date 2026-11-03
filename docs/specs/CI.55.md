# CI.55 fase 1 — `tasks`: que el fallo de `gate-role-task` deje la salida del CLI

## Problema
`scripts/ui-gate/flows/tasks.mjs:583-590` falló 1 vez (pre-push 2026-11-02, `docs/done/evidence/CI.55-prepush-fail.log`):
Codex real (`gpt-6-luna`) terminó sin escribir `ROLE.md`; la tarea quedó `pending`, `retryReason: "missing declared
output(s): ROLE.md"`, `retryCount: 1`, `runId: null`. Aislado pasa. No sabemos si fue el modelo (respondió sin
escribir), cuota, sandbox o el harness. Esta fase NO arregla: hace que el próximo fallo diga por qué.

## Qué cambiar
Solo `scripts/ui-gate/flows/tasks.mjs`, en ese paso. Si `roleFinished` no es `status === 'done'` con
`qaVerdict === 'skipped'`, antes del `step(...)`:
1. Juntar un objeto de diagnóstico, cada parte con try/catch propio (un fallo de captura no tapa el resto):
   - la tarea (`roleFinished`) tal cual;
   - todas las filas de `GET /api/runs` con `taskId === 'gate-role-task'` y, para cada una, el detalle
     `GET /api/runs/:id`: `status`, `result`, `executorReply` (completo), `filesAttempted`, `filesAuthorized`,
     `filesBlocked`, `checks`, `model`, `provider`, `qaVerdict`, `qaReason`, `costBreakdown`;
   - de `join(runDir, 'dashboard.log')`: las líneas `[cli-spawn]` (inicio y fin del CLI: exit code, stderr tail,
     timedOut) y cualquier línea que contenga `gate-role-task`, últimas ~80;
   - en `projectRoot`: `git status --porcelain`, `git log -3 --oneline`, `git worktree list`, y si existe `ROLE.md`
     en la raíz o en algún worktree listado (ruta + contenido truncado).
2. Escribir el objeto completo en `join(runDir, 'role-task-missing-output.json')` (patrón de
   `codex-live.mjs:219-225`) y pasar al `step` un detalle JSON acotado (~2 KB: tarea, `result`, cola de
   `executorReply`, cola de `[cli-spawn]`, `diagnosticPath`).
3. El paso sigue fallando igual que hoy; solo cambia la evidencia. Sin reintento nuevo.

## Qué no tocar
Producto (`src/`), otros pasos y flows, la condición del paso, `PLAN.md`, `NEXT.md`. No commitear.

## Cómo se verifica
- `bun run lint` y `bun run typecheck` verdes.
- Contraprueba forzada (temporal, no se entrega): cambiar localmente la condición de entrada a la rama de
  diagnóstico para que corra siempre (p. ej. `|| true`), correr `bun run ui:gate tasks` fuera del sandbox, comprobar
  que existe `role-task-missing-output.json` con las 4 partes no vacías (o el error de cada captura) y pegar en el
  reporte el detalle del paso. Restaurar.
- Corrida normal: `bun run ui:gate tasks` verde.
