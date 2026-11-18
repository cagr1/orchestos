# DREAMING.md — 2026-11-18

> Análisis automático (scheduled task). `runs-summary.json` exportado 2026-11-17T21:58Z; último run 2026-11-17T21:17Z.

## Runs analizados
- Total: 20 runs
- Periodo: 2026-11-14T18:47:54Z → 2026-11-17T21:17:26Z
- failed: 3 | blocked: 0 | done: 17 | qa_failed: 5

Distribución: 8 `chat` (6 claude-opus-5-5 done, 2 gpt-6.1-sol failed) y 12 runs `gate:*`
(gates en vivo `uso.14`/`uso.15`; 8 con `elapsed_ms: 0` y `tokens: 0`, filas sembradas por fixture).

## Patrones detectados

### Nuevo: chat con `gpt-6.1-sol` falla por cupo de Codex agotado
- Evidencia: runs `7bfc4ed4` (2026-11-17T19:20Z, "di solo: ok") y `0260c4e9` (19:31Z, "USO19 codex:
  di solo ok"), `task_class: chat`, provider `codex`, ~4-5 s, 0 tokens. En la DB local
  (`~/.orchestos/db.sqlite`, lectura) `result = "Codex CLI usage limit reached."` y `failure_kind` vacío.
- Frecuencia: 2/20 runs; 2/2 de `gpt-6.1-sol`; 2/8 del `task_class` chat (25 %, bajo el umbral del 50 %).
- qa_reason recurrente: ninguna (chat no pasa por QA). El motivo solo está en `result`, que
  `runs-summary.json` no exporta.

### Los fallos de QA siguen siendo semillas del gate `chat-context` (sin cambio desde 2026-11-17)
- Evidencia: los 5 `qa_verdict: fail` son `codex (cli default model) via Codex CLI`,
  `gate:uso.14-chat-context:implement` (3) y `gate:uso.15-chat-context:implement` (2), `elapsed_ms: 0`.
  Los inserta `scripts/ui-gate/flows/chat-context.mjs` como fixture.
- Frecuencia: 5/20; ambos task_class `chat-context` al 50 % de fallo y "mismo modelo con fail en 3+"
  se cumple — todo artificial.
- qa_reason recurrente: "criterion 2 missing: README line absent" (5/5, texto del fixture).

### `checks_failed > 0` no es recurrente
- Evidencia: solo `a6f7c6f1` (`gate:uso.14-chat-retry-report:implement`, `gpt-6-luna`), `tsc` sobre
  `broken.ts` roto a propósito por el flujo de reintento; el reintento siguiente pasó.
- Frecuencia: 1/20.

## Propuestas

### Propuesta 1 — Clasificar el agotamiento de cupo como `failure_kind` propio
- Qué cambiar: `src/db/runs.ts:6` (`RunFailureKind`) sumar `'quota'`; el camino de chat que guarda
  el run (hoy deja `failure_kind` nulo) y `providerFailureKind` en `src/run/harness.ts:506` lo asignan
  cuando el error es el de `src/run/executors/codex-app-server.ts:487` ("usage limit reached").
- Por qué: 2/2 fallos reales de la ventana son cupo, no del modelo ni de la tarea; sin clasificación
  cuentan como `failed` y el análisis no puede distinguirlos de un fallo de razonamiento. También
  permite que la UI diga "cupo agotado, se renueva a las X" en vez de un fallo genérico.
- Riesgo: bajo.

### Propuesta 2 — Exportar `failure_kind` (y el motivo corto) en `runs-summary.json`
- Qué cambiar: `scripts/export-runs-summary.ts`, sumar `failure_kind` y las primeras ~120 chars de
  `result` cuando `status = 'failed'`.
- Por qué: hoy un `failed` de chat llega sin causa; este análisis tuvo que abrir la DB local, que
  la corrida en la nube no tiene.
- Riesgo: bajo (revisar que `result` no lleve secretos; truncado y solo en fallos).

### Propuesta 3 — Excluir runs de gate y semillas del resumen (repite la Propuesta 1 de 2026-11-17, sin decidir)
- Qué cambiar: `scripts/export-runs-summary.ts`, filtrar `task_class LIKE 'gate:%'` o marcarlos
  `source: 'gate'`, y descartar `prompt = 'fixture'`.
- Por qué: 12/20 runs y 5/5 qa_failed de esta ventana son gates; dos días seguidos de falsos patrones.
- Riesgo: bajo.

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Ignorar
- [ ] Requiere revisión
