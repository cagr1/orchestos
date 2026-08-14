# DREAMING.md — 2026-08-14

## Runs analizados
- Total: 20 runs
- Periodo: 2026-07-17T20:56:37.618Z → 2026-08-12T22:33:07.698Z
- failed: 2 | blocked: 0 | done: 18 | qa_failed: 2

## Patrones detectados

### Fallo 100% de anthropic/claude-sonnet-5 en task_class "implement", con qa_reason idéntico y coste/tokens en cero
- Evidencia: runs `96f4e52d-54a9-49b6-a329-474cfec3bdf3` (2026-07-20T20:36:58.556Z) y `c198a55d-15eb-43be-9923-f7a5f5cb2305` (2026-07-20T20:30:56.590Z). Ambos: `task_class: implement`, `model: anthropic/claude-sonnet-5`, `provider: openrouter`, `status: failed`, `qa_verdict: fail`, `qa_reason: "missing declared output(s): scratch/design-test-premium-a1.html"` — texto exacto en ambos.
- Frecuencia: 2/2 runs de ese modelo en `task_class: implement` (100%). Es el único par de runs con `usd_cost: 0` y `tokens: 0` en todo el dataset.
- qa_reason recurrente: "missing declared output(s): scratch/design-test-premium-a1.html"
- Nota: `elapsed_ms` muy bajo (1549ms y 5263ms) frente a runs `implement` exitosos de deepseek en el mismo periodo (93195–232686ms). `tokens: 0` + `usd_cost: 0` sugieren que el run terminó antes de generar contenido (fallo de arranque/routing vía openrouter), no un fallo de calidad de la salida.

## Propuestas

### Propuesta 1 — Investigar por qué anthropic/claude-sonnet-5 vía openrouter no llegó a generar tokens en ninguno de sus 2 runs "implement"
- Qué cambiar: revisar logs/config del provider openrouter para el modelo `anthropic/claude-sonnet-5` en tareas `implement` (mismo target de archivo `scratch/design-test-premium-a1.html` en ambos runs, 2026-07-20). Confirmar si es un problema de disponibilidad del modelo en openrouter, de mapeo de nombre de modelo, o de un bug puntual en la generación de ese archivo concreto.
- Por qué: 100% de fallo con `tokens: 0` es una señal de fallo estructural/de arranque, no de calidad — distinto a los demás `qa_verdict: fail` que sí tienen tokens y costo.
- Riesgo: bajo (solo investigación, no requiere tocar código de producción).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Ignorar
- [ ] Requiere revisión
