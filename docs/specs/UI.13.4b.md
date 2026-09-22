# UI.13.4b — Consola de Dev: logs reales del agente + línea de comandos con la frontera del runner

PLAN.md § UI.13.4 (punto 4). Plantilla: `~/Documents/screens/orchestos-ai-agent-dashboard/src/components/dev/OrchestDevWorkspace.tsx`
(cabecera `:70-118`, consola `:120-185`). Decisiones de Carlos 2026-09-22 (las tres con la opción recomendada):
- Dev **como la plantilla**: la consola reemplaza al chat en Dev. Para hablar con el agente se usa el modo Chat.
- Frontera **idéntica al runner**: la misma función que ejecuta los checks, sin lista de bloqueo propia.
- Los comandos se **guardan en DB**.

## Backend

1. **Frontera compartida.** En `src/run/checks.ts` exportar `runOneCheck` (hoy es privada, `:156`) sin
   cambiar su comportamiento: argv sin shell (`splitCommand`, sin pipes, `&&` ni redirecciones), cwd por
   `resolveProjectCwd`, `safeChildEnv()`, timeout de 60 s y salida truncada a 2.000 caracteres. Prohibido copiarla.
1b. **Endurecer la frontera para los dos a la vez** (Carlos 2026-09-22: "hagamos lo mejor").
    En `runOneCheck`, cualquier argumento con forma de ruta (empieza por `/`, `~` o `.`, o contiene `/`)
    se resuelve contra el cwd y debe quedar dentro de la raíz real del proyecto (`realRoot`, que sigue
    symlinks). Si no, devuelve `failureResult` con `path outside project: <arg>` sin llegar a hacer spawn.
    Ejemplos que se rechazan: `cat ../x`, `rm -rf /`, `ls ~/.ssh`.
    - Excepción: los checks que genera OrchestOS (`testAssertionCheckFor`, `checks.ts:44`, que pasa
      `process.execPath` y un script de `scripts/` por ruta absoluta) llevan `trusted: true` en `Check`,
      y ese campo no se puede leer de `tasks.yaml`: el validador lo descarta.
    - Motivo: los checks de `tasks.yaml` los puede escribir el LLM del chat, así que el agujero ya existía
      en el runner. La consola no lo crea, lo hereda.
    - Fuera de alcance: una lista de bloqueo de comandos. `rm -rf src` dentro del proyecto sigue
      permitido, y se recupera con git.
    - Tests: `cat ../x` rechazado, `ls src` aceptado, un symlink que apunta fuera rechazado y el check
      de aserciones interno sigue pasando.
2. **Migración 13** en `src/db/migrate.ts` (patrón de la 12, `:450`): tabla `console_commands`
   (`id INTEGER PK AUTOINCREMENT`, `session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE`,
   `cmd`, `exit_code`, `stdout`, `stderr`, `timed_out INTEGER`, `elapsed_ms`, `created_at`), con un índice
   `(session_id, id)`. Acceso en un `src/db/console-commands.ts` nuevo.
3. `POST /api/chat/sessions/:id/exec` con body `{ cmd }`. Se añade a `sessionIdFromUrl`
   (`handlers/chat-sessions.ts:66`) y a `server.ts` junto a las rutas de sesión (`:335`), con el mismo
   chequeo de `Origin` que las demás escrituras. Errores:
   - 400 si `cmd` está vacío o supera 1.000 caracteres;
   - 404 si la sesión no existe;
   - 400 si la sesión no tiene proyecto (sesión general).

   Si todo es válido, cwd = raíz del proyecto (`dashboardProjectFromId`), se ejecuta
   `runOneCheck({ cmd }, root)`, se guarda la fila y se devuelve.
4. `GET /api/chat/sessions/:id/console` devuelve `{ lines, pending }`. `lines` es una lista cronológica
   de entradas `{ at, kind, text }`, con `kind` en `turn | step | command | output | error`. Se construye con:
   - `chat_turns` de la sesión: estado, error, `run_id`;
   - `run_steps` de los `task_id` de esos turnos (`getRunSteps`, `src/db/run-steps.ts:65`), en formato
     `[tool] label`, `[text] …` o `[step] tokens/costo`;
   - `console_commands`: `$ cmd` y, a continuación, stdout, stderr y `exit N`.

   `pending` = `hasActiveTurn(id)`.
5. Tests `bun:test`:
   - `exec` corre `echo hola` → `exit 0` + stdout y la fila queda guardada;
   - `ls | wc` no se interpreta como pipe;
   - una sesión sin proyecto → 400;
   - las variables de entorno fuera de `safeChildEnv` no llegan al hijo;
   - borrar la sesión arrastra sus comandos;
   - `console` intercala turnos, pasos y comandos en orden.

## Front (`src/dashboard/app/src/`)

6. `OrchestDevWorkspace.tsx`: se reemplaza el `OrchestChatView` por la cabecera y la consola de la
   plantilla, con JSX y `className` literales (regla UI.13: no se escribe CSS). `agentLogs` sale de
   `GET …/console`. El submit llama a `POST …/exec` y añade la salida real, no el texto fijo `exit code 0`
   de la plantilla. Se colorea igual que la plantilla (error, success, `$`). Se consulta cada 2 s solo
   mientras `pending`, y una vez después de cada `exec`. Scroll al final con cada línea nueva.
   - Botón "Archive Session" → el `onCloseAgent` que ya existe (`App.tsx:218`).
   - Badge "AST Gate Active" de la plantilla: se quita, porque no hay backend que lo respalde (`texto que no aporta desaparece`).
7. Cliente en `src/api/chat.ts` (`getConsole`, `execCommand`) con un test como los de `chat.test.ts`.

## No tocar

`src/dashboard/public/**`, `src/dashboard/public-src/**`, `PLAN.md`, el modo Chat. Nada de SSE (se queda
en polling). Nada de UI.13.4c. No commitear. No invocar `codex exec` ni delegar a otro agente.

## Verificación

- Ejecutor: `bun run build:app`, `bun run typecheck`, `bun run test:coverage` en verde.
- Cerebro en vivo en :4330 con Playwright, patrón `/tmp/ui132b-gate*.mjs`, evidencia en
  `docs/done/evidence/UI.13.4b-live.json`. Casos:
  - abrir un agente con turnos previos muestra sus pasos reales;
  - `ls` devuelve los archivos reales del proyecto;
  - `ls | wc` falla sin interpretar la pipe;
  - `cat ../x` y `ls /` se rechazan con `path outside project`, y `ls src` funciona;
  - recargar mantiene el historial;
  - Archive Session lo lleva a History;
  - 0 errores de consola.
