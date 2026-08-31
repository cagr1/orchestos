# DREAMING.md — 2026-08-31

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-18T01:15:25.413Z → 2026-08-30T18:23:59.512Z (created_at más reciente: 2026-08-30T17:53:00.307Z)
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### Fallo sistemático en task_class=doc con deepseek/deepseek-v4-flash
- Evidencia: runs `696cc3ca`, `01f9b0e6`, `516bcb21` — los 3 únicos runs con `task_class: "doc"` en la muestra, todos con `model: "deepseek/deepseek-v4-flash"`, todos `status: "failed"`, `qa_verdict: "fail"`
- Frecuencia: 3/3 runs de esa clase (100%)
- qa_reason recurrente (idéntico en los 3): `"missing declared output(s): src/utils/helper.js"`
- Nota: el mismo modelo SÍ completa con éxito `task_class: "implement"` contra el mismo archivo objetivo (`792ebc9f`, `09a013c7` ambos `qa_verdict: "pass"` creando/tocando `src/utils/helper.js`) — el fallo parece específico de la combinación task_class=doc + este modelo, no del modelo en general ni del archivo en sí.

### Fallo aislado de gpt-5.4 con output declarado no producido
- Evidencia: run `d064d1b9`, `task_class: "implement"`, `model: "openai/gpt-5.4"`, `qa_reason: "missing declared output(s): hello-b.txt"`
- Frecuencia: 1/2 runs de gpt-5.4 en la muestra (el otro, `091d9132`, mismo output declarado `hello-b.txt`, sí pasó)
- Frecuencia insuficiente (solo 2 runs de este modelo) para tratarlo como patrón fuerte — se deja registrado por si se repite.

### checks_failed no aporta señal
- `checks_failed` es 0 en los 20 runs — ningún fallo detectado en esta muestra se explica por gates de checks; todos los `qa_verdict: fail` vienen de "missing declared output(s)".

## Propuestas

### Propuesta 1 — investigar por qué task_class=doc falla 100% con deepseek-v4-flash al declarar output
- Qué cambiar: revisar el prompt/template que arma la tarea para `task_class: "doc"` (dónde se genera la instrucción y el `declared_output` que se le pasa al modelo) vs. el de `task_class: "implement"`, que sí funciona con el mismo modelo y archivo destino
- Por qué: evidencia arriba — 3/3 fallos idénticos, mismo qa_reason exacto, mismo modelo, mismo archivo declarado, pero el análogo "implement" sí pasa. Sugiere que el problema está en cómo se le pide al modelo escribir cuando la tarea es de tipo "doc" (¿le pide documentar sin pedirle escribir el archivo directamente? ¿el path declarado no coincide con el que el prompt de doc le indica al modelo?), no en la capacidad del modelo de tocar ese archivo
- Riesgo: bajo (es solo investigación/lectura, ninguna propuesta de cambio de código aún)

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Ignorar
- [ ] Requiere revisión
