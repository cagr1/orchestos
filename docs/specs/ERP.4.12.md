# ERP.4.12 — el estado que el run deja en `tasks.yaml` queda commiteado

Rol: `criterio`. Eres el ejecutor: no delegues. No commitees ni toques `PLAN.md`/`NEXT.md`.
Preflight: `bun run agent:preflight -- --item ERP.4.12 --agent claude --scope "src/**,scripts/ui-gate/**,NEXT.md,PLAN.md,LEDGER.md,docs/**,.orchestos/feature-status.json"`.
Candado de escritor: te lanzó el cerebro que lo tiene y heredas `AGENT_WRITER_TOKEN`; escribes bajo su candado.
`writer-lock.js status` → `ocupado: claude …` es lo esperado, no un bloqueo: no pares por eso.
Hay cambios ajenos sin commitear (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`): no los toques. Prohibido `prettier`, `git stash`, `git commit`, `git checkout` de archivos.
NO corras `bun run test:coverage` ni te detengas por el baseline: lo corre el cerebro.

## Síntoma (piloto ERP.4, hallazgo 5)
Tras cada run (bueno o fallido) el proyecto `erp-piloto` quedó con `tasks.yaml` modificado sin commitear: el árbol
del usuario nunca vuelve a estar limpio y el estado final de la tarea no está en el historial.

## Causas (leídas en el código)
1. `updateTaskStatus` (`src/tasks/loader.ts:129`) solo escribe el YAML. El comando de una tarea lo llama al marcar
   `running` y al terminar (`src/cli.ts:1276-1440`; camino `task:clarify` en `cli.ts:2775-2806`) y nadie commitea después.
2. Solo se commitea al crear, lanzar y borrar desde el dashboard: `commitTasksYaml` (`src/dashboard/handlers/tasks.ts:201-206`,
   usos en `:314`, `:351`, `:475`, `:504`), y en el grafo `commitTasksYamlReal` (`src/run/graph-runner.ts:62-65`).
3. Los dos helpers hacen `git add tasks.yaml` + `git commit -m …` **sin ruta**: se llevan cualquier otro archivo que
   el usuario tuviera en el índice.

## Comportamiento exigido
- Un único helper compartido (mueve `commitTasksYaml` a un módulo que puedan importar el dashboard, el CLI y el grafo
  sin ciclos; conserva `withGitLock`). Hace `git add -- tasks.yaml` y `git commit -m <msg> -- tasks.yaml` (commit
  limitado a esa ruta). Es best-effort y silencioso si: el directorio no es un repo git, `tasks.yaml` no cambió, o
  `tasks.yaml` está ignorado. Los fixtures y cualquier commit de este helper NO fijan identidad: usa la del repo.
- Los 4 usos del dashboard y el del grafo pasan a ese helper (mismo mensaje que hoy).
- Al terminar el comando de una tarea, **después** de la última escritura de estado y **después** del merge del
  worktree, se commitea `tasks.yaml` con `chore(tasks): <id> <estado final>` (`done`, `pending`, `failed`,
  `failed_permanent`, `blocked`). Un solo punto de salida: envuelve el cuerpo del comando (try/finally o función
  interna que devuelve el estado) en vez de repetir la llamada en cada rama. Aplica a los dos caminos de `cli.ts`
  (`:1276-1440` y `task:clarify` en `:2775-2806`).
- No se commitea el estado intermedio `running`.
- Lee antes cómo y cuándo se hace el merge del worktree (`mergeWorktreeBack`) y bajo qué candado; el commit nuevo no
  puede intercalarse con ese merge (comentario E.5 en `handlers/tasks.ts:311-313`; el harness hace el merge en `run/harness.ts:1126`).
- Si tocas `src/run/harness.ts` añade la entrada correspondiente en `LEDGER.md` (lo exige el pre-commit); lo esperado
  es que no haga falta tocarlo.

## Tests
- Helper, con un repo git temporal real (identidad en el fixture: `git -c user.name=… -c user.email=… commit` para el
  commit inicial del fixture; el helper se prueba con `git config` local del repo temporal, nunca `--global`):
  - `tasks.yaml` modificado + otro archivo en el índice → el commit contiene solo `tasks.yaml`; el otro sigue en el índice;
  - sin cambios → no crea commit y no lanza;
  - directorio que no es repo → no lanza.
- Camino del comando (el nivel más alto que tenga costura hoy; si no hay, test del helper + función interna): tras
  una tarea terminada, `git status --porcelain -- tasks.yaml` vacío y el último commit es `chore(tasks): <id> done`.
- Pasa el `env` explícito a todo `Bun.spawn`/`spawnSync` de los tests (Bun no ve cambios de `process.env` en runtime).

## Gate en vivo (lo escribes tú, lo corre el cerebro)
En `scripts/ui-gate/flows/tasks.mjs`, tras el paso en que una tarea termina `done` y tras el de una que falla, añade
un paso por cada una: `git status --porcelain` del proyecto temporal no lista `tasks.yaml` y `git log -1 --format=%s`
empieza por `chore(tasks): <id> `. Sin pasos `true` literales; cada paso con su `note`.

## No tocar
Frontend, `styles.css`, el formato de `tasks.yaml`, la política de sandbox (`sandbox-policy.ts`, es ERP.4.13), `PLAN.md`.

## Verificación (corre y pega la salida)
`bun run typecheck` · `bun run lint` · `bun test <los archivos de test que tocaste>` · `node --check
scripts/ui-gate/flows/tasks.mjs`.
