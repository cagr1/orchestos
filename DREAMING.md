# DREAMING.md — 2026-11-17

> Análisis automático (scheduled task). `runs-summary.json` exportado 2026-11-17T15:23Z; último run 2026-11-15T16:01Z.

## Runs analizados
- Total: 20 runs
- Periodo: 2026-11-14T17:07:21Z → 2026-11-15T16:01:57Z
- failed: 1 | blocked: 0 | done: 19 | qa_failed: 6

Distribución: 5 `chat` (uso real, claude-opus-5-5 y otros, 5/5 done, sin QA) y 15 runs con
`task_class` `gate:*` (gates en vivo `uso.14`/`uso.15`). 10 de los 20 tienen `elapsed_ms: 0` y
`tokens: 0`: son filas sembradas por fixture, no ejecuciones.

## Patrones detectados

### Los fallos de QA son semillas del gate `chat-context`, no fallos reales
- Evidencia: los 5 `qa_verdict: fail` con modelo `codex (cli default model) via Codex CLI` tienen
  id `ui-chat-context-seed-*`, `elapsed_ms: 0`, `tokens: 0`. Los inserta a propósito
  `scripts/ui-gate/flows/chat-context.mjs:172-173` (`prompt 'fixture'`, `qa_reason` fijo).
- Frecuencia: 5/20 runs; `gate:uso.14-chat-context:implement` 3/6 y `gate:uso.15-chat-context:implement`
  2/4 marcados como fallo (≥ 50 %), y "Mismo modelo con fail en 3+ runs" se cumple — todo por las semillas.
- qa_reason recurrente: "criterion 2 missing: README line absent" (5/5, texto literal del fixture).

### El único `failed` con check rojo también es de gate
- Evidencia: run `a6f7c6f1`, `gate:uso.14-chat-retry-report:implement`, `gpt-6-luna`, `checks_failed: 1`,
  `bunx tsc --noEmit` exit 2 sobre `broken.ts` (archivo roto a propósito por el flujo de reintento).
- Frecuencia: 1/20; `checks_failed > 0` no es recurrente.
- qa_reason recurrente: ninguna fuera de las semillas.

### Uso real sin señal
- Los 5 runs `chat` están `done`, sin QA ni checks. Ningún run `implement` real en la ventana:
  los criterios de este análisis no tienen datos de producción que evaluar.

## Propuestas

### Propuesta 1 — Excluir runs de gate y semillas del resumen de Dreaming
- Qué cambiar: `scripts/export-runs-summary.ts` (query `FROM runs ... LIMIT 20`): filtrar
  `task_class NOT LIKE 'gate:%'` (o exportarlos aparte con un campo `source: 'gate'`), y descartar
  filas con `prompt = 'fixture'`.
- Por qué: 15/20 runs de esta ventana son gates y 6/6 qa_failed son artificiales; el análisis
  nocturno detecta "patrones" que son el fixture funcionando. Mismo tipo de falso positivo que el
  bug de `checks_failed` ya corregido en ese script.
- Riesgo: bajo.

### Propuesta 2 — Que los gates no escriban en la DB real del usuario
- Qué cambiar: verificar por qué filas `gate:*` y `ui-chat-context-seed-*` llegan a la DB que lee
  el pre-commit; los gates deberían correr con HOME temporal (`bun run gate:evidence`). Si la
  etiqueta `gate:` es deliberada (gates en vivo sobre la DB real), la Propuesta 1 basta.
- Por qué: las semillas de `chat-context.mjs` aparecen en `runs-summary.json` del repo. No verificado
  qué camino las escribe en la DB real.
- Riesgo: medio (toca el harness de gates).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
