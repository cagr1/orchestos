# CI.23 — `tasks`: el commit `chore(tasks)` de la tarea relanzada no llega (fase 1: evidencia)

Ítem: PLAN.md § CI.23. Rol: `mecanico`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear
(`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
**PROHIBIDO `git stash`, `git checkout`, `git restore`.**

## Defecto
En 2 de 6 corridas en batería, el paso `relaunched task final state is committed in tasks.yaml`
(`scripts/ui-gate/flows/tasks.mjs:~381`) ve, tras 15 s, el último commit del trabajo
(`orchestos(gate-failed-task): …`) y `tasks.yaml` modificado: `commitFinalTaskState` no dejó su commit. Hoy no se
sabe por qué: `commitTasksYaml` (`src/run/commit-tasks-yaml.ts:10-22`) traga todo (timeout del candado de 30 s de
`file-lock.ts`, `git add`/`git commit` con exit ≠ 0) y no deja rastro.

Esta fase solo hace que el fallo deje evidencia; **no cambia el comportamiento** (sigue siendo best-effort, no lanza).

## Cambios
1. `src/run/commit-tasks-yaml.ts`, `commitTasksYaml`: cuando `git add` o `git commit` devuelven exit ≠ 0, o el `try`
   captura una excepción (p. ej. el timeout del candado), escribir una línea con `console.error`:
   `[tasks-yaml] commit skipped: <message> · <motivo>` donde motivo = `add exit=N <stderr>` / `commit exit=N
   <stderr || stdout>` / `error <mensaje>` (recortar a 300 caracteres). Los `return` silenciosos legítimos (no es
   repo, archivo ignorado, sin cambios) se quedan silenciosos. `commitFinalTaskState`: lo mismo en su `catch`, y si
   `task.status === 'running'` en el momento de commitear, una línea `[tasks-yaml] final state still running: <id>`.
2. Test en `src/run/commit-tasks-yaml.test.ts` (crear si no existe; fixtures git con identidad propia `-c user.name=…
   -c user.email=…` o `git config` local en el repo temporal, ver CLAUDE.md): un repo donde el commit falla (p. ej. un
   hook `pre-commit` que hace `exit 1`) → `console.error` recibe una línea que empieza por `[tasks-yaml] commit
   skipped:` (espiar `console.error`); y un caso sin cambios → ninguna línea.
3. `scripts/ui-gate/run.mjs`: añadir `runDir` al `ctx` que reciben los flujos (junto a `step`, `note`…).
4. `scripts/ui-gate/flows/tasks.mjs`, paso `relaunched task final state is committed in tasks.yaml`: si falla, el
   detalle pasa a ser un JSON con `porcelain`, `subject`, `log` (`git log -5 --format=%h %s` del proyecto fixture),
   `taskStatus` (status y `retryCount` de `gate-failed-task` en `tasks.yaml` vía `/api/tasks`) y `dashboardLog`: las
   últimas 40 líneas de `path.join(runDir, 'dashboard.log')` que contengan `[tasks-yaml]`, `[task]` o
   `gate-failed-task`. Si pasa, el detalle no cambia. Recibe `runDir` del `ctx`.

## No tocar
Ningún otro paso, timeouts, ni la lógica de commit (fase 2, cuando haya evidencia).

## Verificación (pegar salida)
    bun run typecheck
    bunx biome check src/run/commit-tasks-yaml.ts src/run/commit-tasks-yaml.test.ts scripts/ui-gate/run.mjs scripts/ui-gate/flows/tasks.mjs
    bun test src/run/commit-tasks-yaml.test.ts
    bun run ui:gate tasks        # 28/28
