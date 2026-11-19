# DREAMING.md — 2026-11-19

> Análisis automático (scheduled task). `runs-summary.json` exportado 2026-11-18T15:41Z; último run 2026-11-17T21:17Z.
> **Sin runs nuevos desde el análisis del 2026-11-18** (mismos 20 IDs; la DB local tampoco tiene runs posteriores).
> Los patrones son los mismos; abajo solo cambia lo que se verificó hoy.

## Runs analizados
- Total: 20 runs
- Periodo: 2026-11-14T18:47:54Z → 2026-11-17T21:17:26Z
- failed: 3 | blocked: 0 | done: 17 | qa_failed: 5

Distribución: 8 `chat` (6 claude-opus-5-5 done, 2 gpt-6.1-sol failed) y 12 `gate:*` (8 semillas con `elapsed_ms: 0`).

## Patrones detectados

### Chat con `gpt-6.1-sol` falla por cupo de Codex — y queda sin clasificar
- Evidencia: `7bfc4ed4` y `0260c4e9` (2026-11-17, `chat`, codex, 0 tokens). En la DB local:
  `result = "Codex CLI usage limit reached."`, `failure_kind = NULL`.
- Verificado hoy: `'quota'` **ya existe** en `RUN_FAILURE_KINDS` (`src/db/runs.ts:22`, desde `dcae3e80`, AUD.4),
  pero el camino de chat no lo asigna. La Propuesta 1 de ayer pedía crear el tipo; lo que falta es asignarlo.
- Frecuencia: 2/20; 2/2 de `gpt-6.1-sol`; 2/8 de `chat` (25 %, bajo el umbral).
- qa_reason recurrente: ninguna (chat no pasa por QA).

### Fallos de QA = semillas del gate `chat-context` (tercer día seguido)
- Evidencia: 5/5 `qa_verdict: fail` son `codex (cli default model) via Codex CLI`, `gate:uso.1{4,5}-chat-context:implement`,
  `elapsed_ms: 0`, insertados por `scripts/ui-gate/flows/chat-context.mjs`.
- Frecuencia: 5/20.
- qa_reason recurrente: "criterion 2 missing: README line absent" (5/5, texto del fixture).

### `checks_failed > 0` no es recurrente
- Evidencia: solo `a6f7c6f1` (`gpt-6-luna`, `tsc` sobre `broken.ts` roto a propósito; el reintento pasó).
- Frecuencia: 1/20.

## Propuestas

### Propuesta 1 — Asignar `failure_kind: 'quota'` en los fallos de chat (corrige la Propuesta 1 del 2026-11-18)
- Qué cambiar: el camino que guarda el run de chat debe pasar el error del CLI por el mismo clasificador que usa
  `providerFailureKind` (`src/run/harness.ts`) en vez de dejar `failure_kind` nulo. El tipo `'quota'` ya existe.
- Por qué: los 2 fallos reales de la ventana son cupo y figuran como `failed` sin causa; AUD.4 prometió
  "cada run fallido guarda su causa clasificada" y en chat no se cumple.
- Riesgo: bajo.

### Propuesta 2 — Exportar `failure_kind` y motivo corto en `runs-summary.json` (repite 2026-11-18)
- Qué cambiar: `scripts/export-runs-summary.ts`, sumar `failure_kind` y ~120 chars redactadas de `result` si `status = 'failed'`.
- Por qué: la corrida en la nube no ve la causa; hoy hubo que abrir la DB local otra vez.
- Riesgo: bajo.

### Propuesta 3 — Excluir runs de gate y semillas del resumen (repite 2026-11-17 y 2026-11-18)
- Qué cambiar: `scripts/export-runs-summary.ts`, filtrar `task_class LIKE 'gate:%'` o marcarlos `source: 'gate'`.
- Por qué: 12/20 runs y 5/5 qa_failed son gates; tercer informe seguido con falsos patrones.
- Riesgo: bajo.

### Propuesta 4 — No reescribir DREAMING.md si no hay runs nuevos
- Qué cambiar: la tarea programada `orchestos-dreaming`: si los IDs de `runs-summary.json` son los mismos que el
  análisis anterior, escribir una línea "sin runs nuevos" en lugar del informe completo.
- Por qué: hoy el uso del dashboard está parado (trabajo en WIN.*); el informe repetido gasta cupo y ruido.
- Riesgo: bajo.

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Aplicar propuesta 4
- [ ] Ignorar
- [ ] Requiere revisión
