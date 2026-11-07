# CI.67 — El pre-push no hereda GIT_DIR a la suite

## Problema
Desde un worktree, git exporta `GIT_DIR=<repo>/.git/worktrees/<nombre>` (y en pre-commit además `GIT_INDEX_FILE`) al
entorno de los hooks. `scripts/pre-push.sh:76` corre `bun run test:coverage` con ese entorno; los tests que hacen
`git init`/`git commit` en un temporal (p. ej. `scripts/plan-import.test.ts`, `scripts/post-commit.test.ts`) heredan
`GIT_DIR` y commitean en la rama del worktree real. Pasó el 2026-11-06 (13 commits revertidos en `85379e95`).

## Cambio
- `scripts/pre-push.sh`: justo antes de preparar el worktree temporal (antes de `git worktree add`, ~línea 65),
  `unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR GIT_OBJECT_DIRECTORY
  GIT_ALTERNATE_OBJECT_DIRECTORIES`, con un comentario de una línea con el motivo (CI.67). El hook arranca con cwd en
  la raíz del worktree, así que `git worktree add` y `git rev-parse` siguen resolviendo el repo correcto.
- Test nuevo `scripts/pre-push-git-env.test.ts`, dos casos:
  1. Lee `scripts/pre-push.sh`, toma la línea que empieza con `unset GIT_DIR` y la ejecuta con
     `bash -c '<línea>; env'` pasando `GIT_DIR` y `GIT_INDEX_FILE` en el `env` del spawn; afirma que ninguna aparece
     en la salida.
  2. Afirma que esa línea está antes de la línea `git worktree add` y de `bun run test:coverage`.

## No tocar
`scripts/pre-commit.sh` (sus gates leen el índice staged vía `GIT_INDEX_FILE`). El resto del pre-push.

## Verificación
`bash -n scripts/pre-push.sh`; `bun run test:coverage` verde; `bun run lint`. El cerebro reproduce el escenario real
(worktree + push a un remoto bare) por su cuenta.
