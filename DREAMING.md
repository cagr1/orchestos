# DREAMING.md — 2026-09-15

## Runs analizados
- Total: 20 runs
- Periodo: 2026-09-03T21:37:32.310Z → 2026-09-15T15:00:37.294Z
- failed: 1 | blocked: 0 | done: 19 | qa_failed: 0

## Patrones detectados

### qa_verdict/qa_reason nunca poblados
- Evidencia: los 20 runs tienen `qa_verdict: null` y `qa_reason: null`, sin excepción.
- Frecuencia: 20/20 runs
- qa_reason recurrente: N/A — el campo nunca se llena, así que no hay causa de fallo que extraer. No se puede aplicar el criterio "misma qa_reason en múltiples runs" del prompt porque el dato no existe en la serie actual.

### Run `failed` con datos en cero (opencode)
- Evidencia: run `8e0d62e9` (2026-09-15T15:00:37Z), `task_class: chat`, `provider: opencode`, `model: "unknown"`, `status: failed`, `tokens: 0`, `usd_cost: 0`, `elapsed_ms: 0`.
- Frecuencia: 1/20 runs (no alcanza el umbral >50% de un mismo task_class, pero es el único `failed` de toda la serie y todos sus campos numéricos están en cero, lo que sugiere que el run no llegó a ejecutar nada, no que falló a mitad de camino).

### Inconsistencia provider/model en 2 runs
- Evidencia: runs `db0af51f` (2026-09-03T21:39:22Z) y `c10c459f` (2026-09-03T21:37:32Z) tienen `provider: "openrouter"` pero `model: "codex (cli default model) via Codex CLI"` — el nombre de modelo corresponde a Codex, no a OpenRouter, mientras que el resto de runs de Codex en la serie sí declaran `provider: "codex"`.
- Frecuencia: 2/20 runs, ambos del mismo día (2026-09-03), ausente en las corridas posteriores (2026-09-14/15) donde el mismo modelo ya aparece con `provider: "codex"` correcto.

## Propuestas

### Propuesta 1 — investigar el run `opencode` en cero antes de asumir que es ruido
- Qué cambiar: nada en código todavía; primero inspeccionar cómo se generó `8e0d62e9` (logs del provider opencode alrededor de 2026-09-15T15:00:37Z) para confirmar si es un fallo real de ejecución o un artefacto de registro (run creado pero nunca completado).
- Por qué: es el único `failed` de 20 runs y sus métricas en cero no encajan con un fallo típico (que normalmente deja algo de tokens/elapsed_ms).
- Riesgo: bajo — es solo observación, no cambia comportamiento.

### Propuesta 2 — validar que el mismatch provider/model de 2026-09-03 ya no ocurre
- Qué cambiar: nada en código; confirmar (grep en el código que escribe `runs-summary.json` o el registro de providers) que la corrección que hizo que los runs de Codex del 14-15/09 tengan `provider: "codex"` correcto sea intencional y no una coincidencia de que esos 2 runs viejos simplemente no se volvieron a generar.
- Por qué: si fue un bug ya corregido, no hace falta acción; si fue casualidad, el mismo mismatch podría reaparecer.
- Riesgo: bajo.

### Propuesta 3 — no hay evidencia suficiente para tocar el gate de QA
- Qué cambiar: ninguno por ahora.
- Por qué: `qa_verdict`/`qa_reason` están vacíos en el 100% de los runs, así que cualquier propuesta sobre "3+ runs con qa_verdict: fail" sería inventada. Si se espera que el harness llene ese campo y no lo está haciendo, es un problema de instrumentación, no de calidad de los runs — pero requiere revisar el código que genera `runs-summary.json`, fuera del alcance de este análisis (solo lectura).
- Riesgo: N/A (no acción).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
