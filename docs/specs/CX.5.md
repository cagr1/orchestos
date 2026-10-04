# CX.5 — Consumo real de los proyectos registrados (spec para Luna)

Ítem: PLAN.md § CX.5. Decisión de Carlos (2026-10-04): el uso cuenta solo lo que pasa **en OrchestOS**, que es
(a) el chat y las tareas que lanza OrchestOS y (b) los tabs de Claude Code y Codex abiertos en proyectos
**registrados** en OrchestOS. No cuenta todo el CLI como Orca. Los números tienen que ser reales: con caché y por
catálogo. Depende de CX.4 (los runs ya guardan caché).

## Hoy

- `src/dashboard/handlers/usage.ts` suma solo la tabla `runs`. Los tabs de Claude Code o Codex (donde está el
  gasto real, unos $400 en Orca) no aparecen.
- Settings → Usage (`OrchestSettingsView.tsx:~297-337` agrupa; `~1985+` pinta) muestra KPIs y una tabla por
  modelo agrupada en "CLI" y "API".

## Formato real de los transcripts (medido 2026-10-04)

- **Claude Code**: `~/.claude/projects/<key>/*.jsonl`, con `key = ruta real del proyecto` en la que todo carácter
  no alfanumérico pasa a `-`. Las líneas `assistant` traen `message.id`, `message.model` y `message.usage`
  (`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`) y `timestamp`.
  **El mismo `message.id` se repite en varias líneas con el mismo usage**: se cuenta una sola vez por id. La
  primera línea con `sessionId` da la sesión, y `entrypoint` dice si es `cli` o `sdk-cli`.
- **Codex**: `~/.codex/sessions/**/rollout-*.jsonl`. `session_meta.payload` trae `cwd`, `originator` e `id`;
  `turn_context.payload.model` trae el modelo. Los eventos `payload.type === 'token_count'` traen
  `info.total_token_usage` acumulado (`input_tokens`, que **incluye** `cached_input_tokens`,
  `cache_write_input_tokens` y `output_tokens`). Por sesión se toma el **último** `total_token_usage`.
- Las tareas de OrchestOS corren en `<proyecto>/.orchestos/worktrees/<id>`. Por eso un transcript pertenece al
  proyecto si su `cwd` es la raíz **o está dentro de ella**. En Claude eso son las carpetas
  `<key>` y `<key>--orchestos-worktrees-*`.

## Cambios

1. **Identidad de sesión en los runs (migración 21)**: `ALTER TABLE runs ADD COLUMN cli_session_id TEXT`. Se llena
   desde el `session_id` del JSON de resultado de Claude (`external.ts`, chat y tarea) y desde el `thread_id` de
   `thread.started` de Codex (`codex.ts` y `codex-app-server.ts`, chat y tarea). Se propaga hasta `insertRun` por
   el mismo camino que `cacheReadTokens` (CX.4). Así se sabe qué transcripts lanzó OrchestOS y no se cuentan dos
   veces.
2. **Módulo nuevo `src/usage/cli-transcripts.ts`**:
   - `readCliTranscriptUsage(projectRoots: string[], agentHome = homedir())` devuelve filas
     `{ date, provider: 'claude'|'codex', model, sessionId, inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens }`
     por sesión y día. En Claude se agrupa por la fecha del `timestamp` de cada mensaje; en Codex, por la fecha
     del último `token_count`.
   - Codex: `inputTokens = input_tokens − cached_input_tokens` (mínimo 0), igual que CX.4.
   - Proyectos: `realpath` de cada raíz. Para Codex reutilizar o generalizar `transcriptDeclaresProject`
     (`scripts/session-status.ts:303`) para aceptar `cwd === root` o `cwd.startsWith(root + sep)`.
   - Caché en memoria por `(path, mtimeMs, size)`: no se re-parsea un archivo que no cambió.
   - Errores por archivo: se saltea el archivo, nunca falla la respuesta.
3. **`handlers/usage.ts`**:
   - Raíces: `listProjects()` (`src/db/projects.ts`).
   - Filas `source: 'orchestos'`: las de `runs` de hoy, con su costo guardado.
   - Filas `source: 'cli'`: transcripts cuyo `sessionId` **no** está en `SELECT DISTINCT cli_session_id FROM runs`.
     Costo con `knownCostWithCache` (CX.4) sobre el id de catálogo que da `catalogModelIdFor`
     (`scripts/context-budget.ts:99`). Sin precio conocido → `usd: null` y la fila se marca `priced: false`;
     nunca se muestra como $0.
   - `byDayModel` suma `source` y `sessions` (las filas cli cuentan sesiones; las orchestos, runs). La respuesta
     suma `totals: { orchestos: { usd, runs, tokens }, cli: { usd, sessions, tokens, unpricedSessions } }`, donde
     tokens = input + caché lectura + caché escritura + output. `totalUsd` y `totalRuns` se mantienen por
     compatibilidad.
4. **Settings → Usage (`OrchestSettingsView.tsx`)**, solo JSX con clases ya presentes en el archivo, sin CSS nuevo:
   - La tarjeta "Total Spend" muestra el total y, debajo, en la línea de texto chico que ya existe:
     `OrchestOS $X · CLI tabs $Y`.
   - En la agrupación (`usageGroups`, ~297-337) las filas `source: 'cli'` van a un grupo propio
     `{ id: 'cli-tabs', label: 'CLI tabs' }`. Los grupos "CLI" y "API" actuales quedan solo con `source: 'orchestos'`.
   - Las filas sin precio muestran `—` en spend.
   - `UsageResponse` (`api/settings.ts:64`) y `mapUsageByModel` se extienden en consecuencia.
   - La actividad diaria cuenta runs más sesiones.

## Tests

- `cli-transcripts`: fixtures en un `agentHome` temporal, sin leer el home real.
  - Claude: dos líneas con el mismo `message.id` cuentan una vez; una carpeta `--orchestos-worktrees-x` cuenta
    para el proyecto; una carpeta de otro proyecto no.
  - Codex: `cwd` dentro de la raíz cuenta y `cwd` ajeno no; se toma el último `token_count` y se resta la caché.
- `usage.ts`: una sesión cuyo id está en `runs.cli_session_id` no aparece como `cli`. Un modelo sin precio da
  `usd: null`.
- Migración 21: columna creada, igual patrón que la 20.
- Executors: `session_id` y `thread_id` llegan al resultado.

## Gate

`bunx tsc --noEmit` · `bun run lint` (sin errores nuevos) · `bun run build:app` · `bun test` completo. El cerebro
verifica en vivo con el dashboard real sobre el home real (Settings → Usage, con el proyecto OrchestOS registrado)
y contrasta contra los transcripts.

## Fuera de alcance

Proyectos no registrados, OpenCode, recalcular el costo histórico de la tabla `runs` y cambios de layout o estilos.
No commitear ni tocar `PLAN.md`.
