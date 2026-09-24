# CI.5 — 5 tests dependientes del host (spec para Luna)

CI de GitHub rojo desde 2026-09-23 (run 36040963017: 1526 pass / 5 fail). Diagnóstico del cerebro, verificado:
4 de 5 reproducidos en local con entorno limpio (comando al final). **Solo se tocan los archivos listados.**
Prohibido: `orchestos init`, `git config` de cualquier tipo, tocar ítems ⚡ ajenos, commitear.

## 1. `scripts/session-status.test.ts` — "lee la cuota de Codex de la cuenta…"
Causa: `readActiveSessionStatuses` (`scripts/session-status.ts:176`) llama `detectInstalledClis()` real; en CI no
hay `codex` → `installed:false` y nunca lee la cuota inyectada.
Arreglo: en `SessionStatusOptions` (`session-status.ts:149`) agregar `detectClis?: typeof detectInstalledClis`;
usar `const detections = (options.detectClis ?? detectInstalledClis)()`. En ese test pasar un `detectClis` que
devuelva los 3 CLI con `codex` `installed: true` (`path` falso, `readBoundary` `{kind:'none',reason:'test'}`
para los demás, copiando la forma de `CliDetectionResult` en `src/run/executors/cli-registry.ts:280`).

## 2. `src/dashboard/http.test.ts` — "does not cache the app shell or its bundle"
Causa: `src/dashboard/app/dist/main.js` está en `.gitignore:44`; en el checkout de CI no existe → 404 sin header.
Arreglo: `serveStatic(url: string, appDir = APP_DIR)` (`http.ts:57`), usando `appDir` en vez de `APP_DIR` en las
dos llamadas a `serveFrom`. `server.ts:502` no cambia. El test crea un dir temporal con `index.html` y
`dist/main.js`, llama `serveStatic('/', dir)` y `serveStatic('/app/dist/main.js', dir)`, afirma `no-cache` y
status 200, y borra el dir en `afterEach`.

## 3. `src/dashboard/__tests__/chat-sessions.test.ts` — "R.6 persiste el costo canónico del CLI…"
Causa (verificada): Bun **ignora** `process.env.HOME = home` en runtime — `os.homedir()` sigue devolviendo el
home real. El test lee el `~/.claude/stats-cache.json` real del Mac (tiene `claude-sonnet-5` → 400); en CI no
existe → catálogo vacío → 502.
Arreglo: en `runIsolated` (línea ~19) agregar `HOME: home` al `env` del `Bun.spawn`, **antes** de
`...extraEnv`. Borrar la línea `process.env.HOME = home` del cuerpo del test R.6 (ya no hace falta). No tocar
otros tests del archivo; si alguno cae por el cambio de HOME, parar y reportar, no "arreglarlo".

## 4. `src/dashboard/__tests__/tasks-delete-clean.test.ts` — los 2 tests
Causa: el handler hace `git commit` (`handlers/tasks.ts:191`) sin identidad; en ubuntu git no la autodetecta y
el commit falla → `M  tasks.yaml` queda staged.
Arreglo solo en el test: `beforeAll` que guarda y fija `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`,
`GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` (`task-test` / `task-test@example.invalid`) en `process.env`;
`afterAll` los restaura (borrar la key si antes no existía). No usar `git config`.

## Verificación (Luna corre y pega la salida real)
1. `bunx tsc --noEmit`
2. Entorno limpio, los 4 archivos, 0 fail esperado:
```
H=$(mktemp -d) && env -i HOME=$H PATH=$HOME/.bun/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin \
  GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_COUNT=1 \
  GIT_CONFIG_KEY_0=user.useConfigOnly GIT_CONFIG_VALUE_0=true TMPDIR=$TMPDIR \
  bun test scripts/session-status.test.ts src/dashboard/http.test.ts \
  src/dashboard/__tests__/chat-sessions.test.ts src/dashboard/__tests__/tasks-delete-clean.test.ts; rm -rf $H
```
3. `bun run test:coverage` (entorno normal) → 0 fail.
4. `bunx biome check` sobre los archivos tocados.
