# DREAMING.md — 2026-07-31

## Runs analizados
- Total: 20 runs
- Periodo: 2026-07-17T20:54:37.509Z → 2026-07-27T22:24:25.712Z
- failed: 2 | blocked: 0 | done: 18 | qa_failed: 2

**Nota:** `runs-summary.json` sigue sin datos nuevos desde al menos la corrida de dreaming del
2026-07-22 (y las siguientes del 2026-07-24, 2026-07-27, 2026-07-28): mismos 20 runs, mismos IDs,
mismas estadísticas (`total_cost_usd: 0.8004`). No hubo actividad nueva registrada desde entonces
hasta esta corrida. Los patrones y propuestas de abajo son los mismos que las corridas anteriores;
se reitera el hallazgo porque sigue sin decisión tomada (ver sección Decisión, sin marcar desde
2026-07-22 — van ya 4+ corridas consecutivas sin resolver).

## Patrones detectados

### Fallo determinista en `implement` con claude-sonnet-5: archivo declarado nunca se escribe
- Evidencia: los 2 únicos runs con `model: anthropic/claude-sonnet-5` en la muestra (ids `96f4e52d` y `c198a55d`), ambos `task_class: implement`, ambos `status: failed`, ambos con el mismo `qa_reason` exacto: "missing declared output(s): scratch/design-test-premium-a1.html". Ambos con `elapsed_ms` muy bajo (1549 y 5263 ms) y `usd_cost: 0`, `tokens: 0` — sugiere que el run terminó casi de inmediato sin generar output real, no un fallo de calidad del contenido.
- Frecuencia: 2/2 runs de ese modelo (100% de la muestra), 2/20 runs totales.
- qa_reason recurrente: "missing declared output(s): scratch/design-test-premium-a1.html" (idéntico carácter por carácter en ambos runs, mismo path de archivo).

## Propuestas

### Propuesta 1 — Investigar por qué claude-sonnet-5 no escribe el archivo declarado en tareas `implement`
- Qué cambiar: revisar el wiring del executor para `anthropic/claude-sonnet-5` en tareas `task_class: implement` (posible timeout/early-exit dado `elapsed_ms` bajo y `tokens: 0` — el modelo puede no estar recibiendo la tarea o estar retornando vacío antes de escribir a `scratch/`).
- Por qué: 100% de fallo en la única combinación modelo+task_class observada para sonnet-5 en esta muestra, con el mismo archivo faltante en ambos casos — indica un problema sistemático de wiring, no una tarea difícil puntual.
- Riesgo: bajo (es investigación, no cambia comportamiento hasta decidir un fix).

### Propuesta 2 — Agregar retry o fallback cuando `tokens: 0` y `elapsed_ms` es anómalamente bajo para `implement`
- Qué cambiar: en el executor de tareas `implement`, si un run retorna `tokens: 0` en menos de ~10s, tratarlo como fallo de infraestructura (no de calidad) y reintentar automáticamente o escalar a otro modelo antes de marcar `qa_verdict: fail`.
- Por qué: mismo patrón que Propuesta 1 — ambos runs fallidos tienen esta firma (tokens=0, elapsed muy bajo), consistente con una llamada que nunca llegó a ejecutar el modelo.
- Riesgo: medio (cambia lógica de retry del executor, requiere validar que no enmascare fallos reales de calidad).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
