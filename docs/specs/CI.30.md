# CI.30 — El pre-push verifica el commit que se empuja, no el árbol de trabajo

## Evidencia
CI rojo en `lint` (run 39076415730, 2026-10-17): `docs/done/evidence/CX.6-live.json` entró sin formatear en
`74afe6d`; el archivo se formateó después en el árbol sin commitear. `scripts/pre-push.sh:48` corre `bun run lint` (y
`:34` `test:coverage`) en el directorio de trabajo → vio la versión formateada y dejó pasar el push. Mismo hueco para
cualquier cambio sin commitear que tape (o rompa) lo que de verdad se empuja.

## Qué hacer (solo `scripts/pre-push.sh`)
1. Leer las refs de stdin **al principio** (hoy el `while read` de `:65` las lee después; stdin solo se lee una vez) y
   guardarlas en un array; el bucle de `changed_paths` itera ese array.
2. Elegir el SHA a verificar: el `local_sha` no nulo de la ref `refs/heads/master` si está; si no, el último no nulo.
   Si no hay ninguno (push de borrado), saltar suite y lint con un mensaje.
3. `git worktree add --detach "$log_dir/tree" <sha>` (con `trap` que haga `git worktree remove --force` y
   `git worktree prune` al salir, también en error). Enlazar `node_modules` del repo en el worktree (symlink), y lo
   mismo para cualquier otro `node_modules` anidado que exista (p. ej. `src/dashboard/app/node_modules`).
4. Correr `test:coverage` (mismo env de HOME/PATH/gitconfig de hoy) y `bun run lint` **dentro del worktree**.
   Mensajes y logs iguales que hoy; añadir una línea "verificando <sha corto> (commit empujado, no el árbol)".
5. Los ui-gates y chat-gates siguen como hoy (árbol de trabajo); fuera de alcance.
6. Comentario de cabecera: una línea con la fecha y el motivo (CX.6, run 39076415730).

## Qué NO se toca
Nada fuera de `scripts/pre-push.sh`. No reinstalar hooks ni commitear (lo hace el cerebro). Prohibido `git stash`,
`git commit`, `git checkout`/`restore`, `prettier`.

## Verificación (correr y pegar la salida)
- `printf 'refs/heads/master 74afe6d<SHA completo> refs/heads/master fad53fc<SHA completo>\n' | bash scripts/pre-push.sh`
  → debe abortar en lint por `docs/done/evidence/CX.6-live.json` (aunque el árbol esté bien).
- Lo mismo con `HEAD` como local y `origin/master` como remoto → suite y lint verdes.
- `git worktree list` tras ambas corridas: solo el árbol principal.
- `bash -n scripts/pre-push.sh`.
