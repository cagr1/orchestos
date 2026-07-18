# DREAMING.md — 2026-07-18

## Runs analizados
- Total: 20 runs
- Periodo: 2026-07-17T02:19:48.812Z → 2026-07-17T21:42:28.525Z
- failed: 0 | blocked: 0 | done: 20 | qa_failed: 0

## Patrones detectados

### checks_failed=1 en el 100% de los runs "implement" y "plan"
- Evidencia: los 4 runs `task_class: implement` (ec1a242e, 241687e8, 2f70c9fc, 07a9deec — todos `deepseek/deepseek-v4-flash`) y los 2 runs `task_class: plan` (3b273760, 1e8891ce — ambos `anthropic/claude-haiku-4-5`) tienen `checks_failed: 1`. El único run `doc` (404ead78) tiene `checks_failed: 0`. Todos los `chat` (14 runs) tienen `checks_failed: 0`.
- Frecuencia: 6/6 runs que generan archivo de código (implement+plan) tienen exactamente 1 check fallido — no es ruido puntual, es el 100% de esa categoría.
- qa_reason recurrente: en los 6 casos el `qa_verdict` es `"pass"` con reasons que describen el archivo como completo y funcional — ninguno de los `qa_reason` menciona el check fallido ni explica por qué se ignoró.

## Propuestas

### Propuesta 1 — Investigar qué check falla sistemáticamente en implement/plan
- Qué cambiar: agregar el nombre/id del check fallido a `runs-summary.json` (hoy solo se registra el conteo `checks_failed`, no cuál check fue). Candidatos a revisar: `defaultChecksFor()` (mencionado en memoria del proyecto como fuente de checks por tipo de tarea) y el paso de QA que decide `pass` pese al check fallido.
- Por qué: si el mismo check falla siempre en el 100% de una categoría de tarea, o el check está mal calibrado (falso positivo sistemático) o hay un bug real que QA no está capturando porque su criterio de pass/fail no depende de `checks_failed`.
- Riesgo: bajo (es instrumentación + revisión, no cambia comportamiento de ejecución).

### Propuesta 2 — Revisar si QA debería considerar checks_failed en su veredicto
- Qué cambiar: el paso de QA (el que produce `qa_verdict`/`qa_reason`) parece evaluar solo el contenido del archivo, no el resultado de los checks automatizados. Evaluar si `checks_failed > 0` debería bajar el veredicto a `pass_with_warnings` o similar en vez de `pass` silencioso.
- Por qué: con la muestra actual, un check fallido nunca impidió un "pass" — no hay evidencia de que el check importe para la decisión final, lo cual le resta valor a tenerlo.
- Riesgo: medio (cambia el criterio de aceptación de runs; podría convertir passes actuales en warnings/fails).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
