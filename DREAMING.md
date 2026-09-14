# DREAMING.md — 2026-09-14

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-19T18:16:53.745Z → 2026-09-14T20:13:47.057Z
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### task_class "doc" falla 100% de las veces
- Evidencia: 3/3 runs de `task_class: doc` (696cc3ca, 01f9b0e6, 516bcb21), todos `model: deepseek/deepseek-v4-flash`, `status: failed`, `qa_verdict: fail`.
- Frecuencia: 3/3 runs (100%)
- qa_reason recurrente: "missing declared output(s): src/utils/helper.js" — texto **idéntico** en los 3 runs, mismo path de archivo. No es variación de contenido, es el mismo archivo declarado y nunca producido.

### Costo hundido sin output en tarea "doc"
- Evidencia: los 3 runs fallidos de "doc" sumaron $0.1432167 + $0.1311552 + $0.0893121 = $0.3636840 (42% del `total_cost_usd` de la sesión: $0.8674) sin producir el archivo declarado.
- Frecuencia: 3/3 runs de esa clase
- qa_reason recurrente: igual al patrón anterior.

## Propuestas

### Propuesta 1 — revisar por qué `src/utils/helper.js` se declara pero nunca se escribe en task_class "doc"
- Qué cambiar: el prompt/template de la tarea "doc" (buscar dónde se declara `src/utils/helper.js` como output esperado) o el paso de escritura del adaptador deepseek/openrouter para esa clase de tarea.
- Por qué: 3/3 fallos idénticos, mismo path, mismo modelo, mismo qa_reason exacto — indica bug determinístico de configuración/prompt, no variabilidad del modelo.
- Riesgo: bajo (investigación + fix puntual de config/prompt, no toca código central)

### Propuesta 2 — gate de costo por reintento en task_class "doc" antes de reintentar con el mismo modelo
- Qué cambiar: si `task_class: doc` con `model: deepseek/deepseek-v4-flash` falla por "missing declared output" una vez, no reintentar automáticamente con el mismo modelo sin cambiar el prompt — cortar y avisar.
- Por qué: los 3 fallos ocurrieron en la misma franja horaria (20:30:14 → 20:30:48, ~34s entre runs) gastando $0.36 sin producir nada; sugiere reintento ciego del mismo patrón fallido.
- Riesgo: medio (toca lógica de reintento/orquestación, no solo config)

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
