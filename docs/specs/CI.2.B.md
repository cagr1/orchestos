# CI.2.B — `ui:gate`: comprobador en vivo de la app React (spec para Luna)

Lote L1, ítem 1 de 3. Propuesta: `docs/propuesta-flujo-por-lote.md` § Paso 0.

## Objetivo

Un comando versionado que arranca el dashboard real, recorre flujos **clickeando desde un arranque en frío**
con Playwright y termina con una línea `PASS`/`FAIL` por flujo. Hoy los gates en vivo viven en `/tmp` y se
pierden. Los 13 gates de `scripts/ui-gates/` son del vanilla (que se borra en UI.13.3): **no tocarlos**.

## Qué crear

1. `scripts/ui-gate/run.mjs` (Node ESM, mismo estilo que `scripts/ui-fidelity/check-jsx.mjs`; Playwright ya
   está en `package.json:69`). Uso: `node scripts/ui-gate/run.mjs <flujo> [<flujo>...]`.
   - Busca un puerto libre (abrir `net.createServer().listen(0)`, leer el puerto, cerrar).
   - Arranca `bun run src/cli.ts dashboard --port <puerto>` con `spawn` (cwd = raíz del repo, `stdio` a un
     archivo de log en `os.tmpdir()/ui-gate-<pid>/dashboard.log`). Guarda el PID.
   - Espera hasta 30 s a que `GET /api/health` devuelva 200. Si no: `FAIL boot: health timeout` y sale 1.
   - Por cada flujo: importa `scripts/ui-gate/flows/<flujo>.mjs`, abre `chromium`, página 1440×1000, registra
     `pageerror` y toda respuesta `>= 400` a `/api/` como error, `page.goto(base + '/')`, y llama
     `await flow.default(ctx)`.
   - `ctx = { page, base, api(path, init?), step(nombre, condicion, detalle?), shot(nombre), cleanup(fn) }`.
     `api` = fetch JSON contra `base` con header `Origin: base` (el server exige mismo origen en
     POST/PUT/PATCH/DELETE, `server.ts:148-152`). `step` registra un paso; si `condicion` es falsa el flujo
     falla con ese paso. `shot` guarda PNG en `os.tmpdir()/ui-gate-<pid>/<flujo>/<nombre>.png`. `cleanup`
     registra funciones que se corren **siempre** al final del flujo (pasó o no), en orden inverso.
   - Un flujo falla si: un `step` falla, el flujo lanza excepción, o hubo `pageerror`/respuestas `>= 400` no
     declaradas (el flujo puede declarar esperadas con `ctx.expectHttpError(regex)`).
   - Salida: una línea por flujo, exactamente `PASS <flujo> <n>/<n>` o `FAIL <flujo>: <paso>: <detalle>`.
     Nada más en stdout (el log del dashboard va al archivo). Al final escribe
     `os.tmpdir()/ui-gate-<pid>/result.json` con `{ flujo, pass, steps:[{nombre, ok, detalle}], errores, capturas }`
     y lo imprime como última línea `EVIDENCE <ruta>`.
   - Limpieza: mata el dashboard **por PID** (`process.kill(pid)`, y si sigue vivo a los 3 s, `SIGKILL`).
     Prohibido `pkill`. Registrar `process.on('exit'|'SIGINT'|'SIGTERM')` para no dejarlo huérfano.
   - Exit code 0 solo si todos pasan.
2. **Regla de camino clickeable** (PLAN.md § CI.2, propiedad 1): `run.mjs`, antes de ejecutar un flujo, lee su
   fuente y falla con `FAIL <flujo>: lint: navega por window` si contiene `window.OrchestOS`, `window.state` o
   `page.evaluate(` seguido de `location`/`history`. Los flujos llegan a cada pantalla con clics.
3. `scripts/ui-gate/flows/smoke.mjs` — el primer flujo, que prueba el propio comprobador:
   - `/` carga; hay un botón/enlace visible con texto `Chat` y otro `Dev` (usar `getByRole`/`getByText` como
     en la app real; leer `src/dashboard/app/src/components/layout/*.tsx` para los textos exactos).
   - Clic en `Dev` → aparece la vista Dev (elige un texto estable de `OrchestDevWorkspace.tsx`).
   - Clic en `Chat` → vuelve el composer (`AgentComposer`, un `textarea` visible).
   - Abrir Settings desde su control visible → aparece un texto estable de Settings.
   - `shot` de cada pantalla. 0 errores.
4. `scripts/ui-gate/run.test.ts` (bun test) para la parte pura: extraer a `scripts/ui-gate/lib.mjs` las
   funciones `lintFlowSource(src)` y `formatResult(result)` y testearlas (casos: fuente con `window.state`
   falla; fuente limpia pasa; `formatResult` produce exactamente las dos formas de línea). Sin Playwright en
   el test.
5. `package.json` scripts:
   - `"ui:gate": "node scripts/ui-gate/run.mjs"`
   - `"gate:all": "bun run typecheck && bun run lint && bun run test:coverage && bun run build:app && bun run ui:fidelity:jsx"`
     (el `ui:gate` de cada flujo se corre aparte, porque depende del ítem).

## Fuera de alcance

- No tocar `scripts/ui-gates/` (vanilla), ni CI (`.github/`), ni `scripts/pre-*.sh`.
- No comparar píxeles contra la plantilla (datos reales ≠ datos de ejemplo; la fidelidad la cubre
  `ui:fidelity:jsx`).
- No commits, no stash. No invoques `codex exec` ni delegues a otro agente.

## Gate (lo corre el cerebro fuera del sandbox)

- `bun run gate:all` verde.
- `bun run ui:gate smoke` → `PASS smoke n/n` y `EVIDENCE …`; después del comando no queda ningún proceso
  escuchando en el puerto usado (`lsof -ti :<puerto>` vacío).
- Un flujo de prueba con `window.state` da `FAIL …: lint: navega por window`.
- El dashboard de Carlos en `:4242` sigue vivo (el comprobador usa su propio puerto).
