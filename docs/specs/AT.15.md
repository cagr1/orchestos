# AT.15 — OpenCode tal cual trabaja: terminal real en el tab Dev

Plan aprobado en `PLAN.md` (AT.15). Este spec cubre los pasos (1)–(3). El paso (4) "OpenCode deja de ser
opción del chat" **NO** se toca en esta ronda.

Spike verificado por el cerebro (2026-10-01): `new Bun.Terminal({cols,rows,data})` + `Bun.spawn(['opencode'],
{terminal, cwd})` renderiza la TUI (8 KB en 4 s), `resize` funciona, `SIGTERM` sale con 0 sin huérfanos.
Dependencias ya instaladas: `@xterm/xterm`, `@xterm/addon-fit` (no ejecutes `bun add`).

## 1. Servidor — `src/dashboard/terminal.ts` (nuevo)

- `createTerminalSession({ cwd, cols, rows, command = resolveOpenCodeCommand(), onData, onExit })` →
  `{ write(data), resize(cols, rows), close() }`.
  - `resolveOpenCodeCommand()` = `[Bun.which('opencode') ?? 'opencode']`. Si no hay binario → error claro
    `OpenCode no está instalado (no se encontró "opencode" en el PATH)`.
  - Spawn con `Bun.Terminal`, `cwd` = raíz del proyecto, `env: { ...process.env, TERM: 'xterm-256color',
    COLORTERM: 'truecolor' }`. **Prohibido** tocar HOME, XDG_*, OPENCODE_*, CODEX_HOME ni elegir modelo: OpenCode
    usa su propia config y auth, exactamente como si Carlos lo abriera en su terminal.
  - `cols`/`rows` saneados a enteros 2..500 / 2..200.
  - `close()`: SIGTERM; si a los 2 s no salió, SIGKILL; luego `terminal.close()`. Idempotente.
  - `onExit(code)` cuando el proceso termina solo.
- Registro de sesiones vivas + `stopTerminalSessions()` que las cierra todas; llamarla en `startServer` junto a
  `stopCodexAppServers()` (mismo `stopWithCodex`).

## 2. Canal WebSocket — `src/dashboard/server.ts`

- Ruta `GET /api/terminal?project=<id>&cols=N&rows=N` con `Upgrade: websocket`.
  - **Origin obligatorio** y same-origin (reusar `isSameOrigin`, pero aquí sin Origin → 403: un WS sin Origin
    no viene del dashboard). Cross-site WebSocket hijacking abriría una shell: no negociable.
  - Proyecto vía `resolveDashboardProject(req)` (ya acepta `?project=`); `DashboardProjectError` → su status.
  - `server.upgrade(req, { data: { cwd, cols, rows } })`; si falla → 400.
- `Bun.serve({ websocket: { open, message, close } })`:
  - `open`: crea la sesión; datos del PTY → `ws.send(bytes)` (binario). Error al crear → `ws.send(JSON
    {type:'error', message})` y `ws.close(1011)`.
  - `message`: texto JSON `{type:'input', data:string}` → `write`; `{type:'resize', cols, rows}` → `resize`.
    Cualquier otra cosa se ignora.
  - `close`: `session.close()` (no deja procesos vivos).
  - Proceso sale solo → `ws.send(JSON {type:'exit', code})` y `ws.close(1000)`.
- `route()` es síncrono-async y no tiene el `server`: mover el chequeo de upgrade al `fetch` de `startServer`
  antes de delegar en `route`, o pasar `server` — lo más simple que no rompa los tests de `route`.

## 3. Panel — `src/dashboard/app/src/components/dev/OpenCodeTerminal.tsx` (nuevo)

- Props `{ projectId: string; sessionTitle: string; onClose?: () => void }`.
- xterm.js (`@xterm/xterm` + `FitAddon`), `import '@xterm/xterm/css/xterm.css'`. Fuente Fira Code (ya cargada),
  colores leídos de las CSS vars del tema (`--app-bg`, `--app-text`, `--app-accent`) para verse como el resto.
- Conecta `ws://${location.host}/api/terminal?project=…&cols=…&rows=…`, `binaryType='arraybuffer'`, escribe
  los bytes en xterm; `term.onData` → `{type:'input'}`; `ResizeObserver` → `fit()` + `{type:'resize'}`.
- Estados visibles: conectando, error (mensaje del servidor en texto, no silencio), proceso terminado con
  botón "Reabrir" que reconecta. Desmontar → `ws.close()` y `term.dispose()`.
- Ocupa todo el canvas central (`flex-1 min-w-0 h-full`), cabecera mínima de 1 línea con el título de la sesión.
  Sin textos explicativos extra.
- `App.tsx` rama `mode === 'dev'`: si `activeAgent?.agent === 'opencode'` renderiza `<OpenCodeTerminal
  key={activeAgent.id} …/>` en lugar de `<OrchestDevWorkspace>`. **No** edites `OrchestDevWorkspace.tsx`
  (lo vigila `ui:fidelity:jsx`).

## Tests (obligatorios)

- `src/dashboard/terminal.test.ts`: con `command: ['sh']` (o `cat`) — escribe `echo hola\n` y recibe `hola`;
  `resize` no lanza; `close()` deja el pid muerto (`process.kill(pid, 0)` lanza); `stopTerminalSessions()`
  cierra todas; binario ausente → error claro.
- Test del WS en el servidor (puerto 0 o aleatorio, `command` inyectable por variable de módulo o parámetro de
  test, nunca opencode real): sin Origin → 403; Origin ajeno → 403; same-origin abre, eco funciona, cerrar el
  socket mata el proceso.
- Flujo `scripts/ui-gate/flows/opencode-terminal.mjs` (registrarlo como los demás): proyecto temporal git,
  crear sesión `agent: 'opencode'` por la API, abrirla en Dev desde el sidebar, esperar que `.xterm-rows`
  tenga texto, cambiar el tamaño del viewport, cerrar la sesión y comprobar con `ps` que no queda ningún
  `opencode` con ese cwd. Tú no podrás correrlo en el sandbox: déjalo escrito y pasa
  `bunx biome lint --only=correctness/noUndeclaredVariables scripts/ui-gate/flows`.

## Gate del ejecutor

`bun run typecheck`, `bun run lint`, `bun test` completo (no dirigido), `bun run build:app`. Fallos conocidos de
tu sandbox que NO son tuyos: `adversarial-review` ×2 y `csrf-origin`; repórtalos y sigue. No commitees.

## Ronda 2 — arreglos del flujo `opencode-terminal.mjs` (cerebro, tras correrlo fuera del sandbox)

1. Falla `temporary project was not registered`: el registro guarda la ruta tal cual (`/var/folders/...`) y el
   flujo compara contra `realpathSync` (`/private/var/...`). Aceptar cualquiera de las dos
   (`item.path === projectRoot || item.path === realpathSync(projectRoot)`), como `project-delete.mjs:66`.
2. El chequeo de huérfanos es vacuo: el `command` de `ps` de opencode no contiene el cwd. Sustituir por pids:
   helper `opencodePids()` = `pgrep -x opencode` (Set; vacío si pgrep sale ≠0). Tomar `before` antes de
   `page.reload`, tras el render step `dashboard spawned an opencode process` con los pids nuevos (debe haber ≥1),
   y tras cerrar esperar 3 s y step `no spawned OpenCode process survives close` (ninguno de esos pids vivo).
3. Comprueba que el botón que el flujo pulsa para cerrar existe de verdad en `OpenCodeTerminal.tsx` con ese
   nombre accesible, y que la región tenga `aria-label="OpenCode terminal"`.
Solo toca el flujo (y el componente si el punto 3 lo exige). Pasa el lint de flows indicado arriba.

## Ronda 3 — el flujo no despliega el proyecto en el sidebar

Evidencia (captura del gate): el proyecto aparece plegado con contador `1`; la sesión no se ve. El flujo busca
`getByRole('button', { name: basename(projectRoot), exact: true })` y no lo encuentra (el nombre accesible incluye
el contador), así que nunca despliega. Cambiarlo a un localizador que sí coincida (p. ej. `name` como RegExp que
empiece por el basename escapado, `.first()`), hacer click si la sesión no está visible y luego esperar la sesión
con `visible()`. Solo toca el flujo; pasa el lint de flows.
