# DREAMING.md — 2026-09-23

## Runs analizados
- Total: 20 runs
- Periodo: 2026-09-18T15:31:18Z → 2026-09-23T02:42:10Z
- failed: 1 | blocked: 0 | done: 19 | qa_failed: 0

## Patrones detectados

Ningún patrón alcanza los umbrales (task_class >50% fallo, modelo con 3+ qa fail, qa_reason repetida, checks_failed recurrente): 0 runs con qa_verdict, 0 qa_reason, 0 checks_failed, 0 files_blocked. Todos los runs son `task_class: chat`.

### Fallo aislado de Codex sin diagnóstico
- Evidencia: run 2026-09-23T01:39:44Z, provider `codex`, model `codex` (sin modelo real ni effort), status `failed`, 0 tokens, qa_verdict null.
- Frecuencia: 1/20 runs (único fallo). El análisis anterior (09-18) registró el mismo patrón con opencode: fallo sin causa ni modelo.
- qa_reason recurrente: ninguna.

### elapsed_ms siempre 0
- Evidencia: los 20 runs (claude, codex, openrouter) tienen `elapsed_ms: 0`.
- Frecuencia: 20/20 runs.
- qa_reason recurrente: n/a. La latencia no se está midiendo en runs de chat.

### Coste de contexto de Codex en chat creciendo
- Evidencia: runs de Codex en chat pasaron de ~15.3k–15.8k tokens (09-18) a ~38.7k–45.3k tokens (09-23), incluso en respuestas cortas; runs de Claude en el mismo periodo: 143–2,657 tokens.
- Frecuencia: 6/12 runs de Codex por encima de 38k.
- qa_reason recurrente: n/a. No verificado contra el código si el aumento viene del prompt de sistema/contexto inyectado por OrchestOS o del propio CLI.

### Etiqueta de modelo de Codex heterogénea
- Evidencia: el mismo proveedor registra `codex`, `codex (cli default model) via Codex CLI`, `... (effort: …)` y `gpt-5.6-luna via Codex CLI (effort: …)`.
- Frecuencia: 12/12 runs de Codex, 4 formatos distintos.
- qa_reason recurrente: n/a. Impide agrupar por modelo. Mejora respecto al 09-18: ya no aparecen runs de Codex con provider `openrouter`.

## Propuestas

### Propuesta 1 — Persistir causa y modelo en runs fallidos de CLI
- Qué cambiar: en el adaptador de chat por CLI (codex/opencode), al fallar guardar el error (stderr/exit code) en el run y el modelo/effort resueltos, no `codex`/`unknown`.
- Por qué: los 2 últimos fallos observados (opencode 09-15, codex 09-23) no son diagnosticables desde runs-summary.json.
- Riesgo: bajo

### Propuesta 2 — Medir elapsed_ms en runs de chat
- Qué cambiar: registrar inicio/fin del turno de chat y guardar la duración en el run.
- Por qué: 20/20 runs con 0 ms; no hay dato para comparar latencia entre motores.
- Riesgo: bajo

### Propuesta 3 — Investigar el salto de tokens de Codex en chat
- Qué cambiar: comparar el prompt enviado a Codex el 09-18 vs 09-23 (contexto de proyecto, historial, instrucciones) y recortar lo que no aporte.
- Por qué: ~2.5x tokens por turno en 5 días; va contra la regla de que OrchestOS debe ahorrar frente al CLI directo.
- Riesgo: medio

### Propuesta 4 — Normalizar model/effort en campos separados
- Qué cambiar: guardar `model` como id limpio (o `cli-default`) y `effort` en campo propio.
- Por qué: 4 formatos para el mismo proveedor impiden detectar patrones por modelo.
- Riesgo: bajo

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Aplicar propuesta 4
- [ ] Ignorar
- [ ] Requiere revisión
