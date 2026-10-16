# ERP.4.17: el test del 409 deja de depender de la identidad git del host

Rol: `mecanico`. Escribe bajo el candado del cerebro (`AGENT_WRITER_TOKEN`). Si el candado dice `ocupado: claude`,
seguir. Ajenos, no tocar: `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json`.

Cambio: en `src/dashboard/handlers/tasks.test.ts:153-154`, reemplazar
`git(root, 'config', '--unset', 'user.name')` por `git(root, 'config', 'user.name', '')` y
`git(root, 'config', '--unset', 'user.email')` por `git(root, 'config', 'user.email', '')`.
Se conserva `user.useConfigOnly true`. Agregar encima un comentario de una línea con el motivo: la identidad local
vacía tapa la global del host. Ningún otro cambio.

Verifica:
- `bun test src/dashboard/handlers/tasks.test.ts`: todo pasa, en este Mac que tiene identidad global.
- `bunx biome check src/dashboard/handlers/tasks.test.ts`.
- `bun run test:coverage`: 0 fallos. Si el sandbox impide `EADDRINUSE`/puertos, decirlo; el cerebro lo repite.

Nada de `prettier` ni `git stash`, y no commitear.
