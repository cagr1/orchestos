# DREAMING.md — 2026-09-11

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-18T17:42:31.415Z → 2026-09-03T21:39:22.453Z
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### deepseek/deepseek-v4-flash falla 100% en task_class "doc"
- Evidencia: runs `696cc3ca`, `01f9b0e6`, `516bcb21` — mismo modelo, mismo task_class, mismo output declarado (`src/utils/helper.js`)
- Frecuencia: 3/3 runs de esa combinación (3/20 del total)
- qa_reason recurrente: "missing declared output(s): src/utils/helper.js"

### "missing declared output(s)" es todo el qa_failed, cruza modelos
- Evidencia: los 4 qa_failed del periodo comparten exactamente esta causa — 3 con deepseek/deepseek-v4-flash (task_class doc) + 1 con openai/gpt-5.4 (`d064d1b9`, task_class implement, output `hello-b.txt`)
- Frecuencia: 4/4 de los qa_failed, 4/20 del total
- qa_reason recurrente: "missing declared output(s): <archivo>"
- Nota: el mismo archivo `hello-b.txt` se completó bien en otros dos runs (`091d9132` con gpt-5.4, `09a013c7` con deepseek) — la falla no es consistente por modelo ni por archivo, sugiere un problema intermitente en cómo se verifica/escribe el output declarado, no en la capacidad del modelo.

## Propuestas

### Propuesta 1 — investigar por qué deepseek-v4-flash no escribe `src/utils/helper.js` en task_class "doc"
- Qué cambiar: revisar el prompt/plantilla de task_class "doc" y el parser de "declared output(s)" para esa ruta específica
- Por qué: 3/3 de fallo exacto con el mismo archivo y el mismo mensaje de qa_reason, tasa de fallo 100% (> umbral 50%)
- Riesgo: bajo

### Propuesta 2 — auditar el mecanismo de verificación de "declared output(s)"
- Qué cambiar: el código que compara output declarado vs. archivos realmente escritos (probablemente en el runner de tasks/gate de QA)
- Por qué: la misma causa de fallo aparece con dos modelos distintos y el mismo archivo (`hello-b.txt`) pasa y falla en corridas distintas — indicio de condición de carrera o de timing en la verificación, no de capacidad del modelo
- Riesgo: medio

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Ignorar
- [ ] Requiere revisión
