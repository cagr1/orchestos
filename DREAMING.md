# DREAMING.md — 2026-08-23

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-17T22:36:30.586Z → 2026-08-19T21:02:14.779Z
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### 1. `doc` con deepseek-v4-flash: 100% de fallo por output faltante
- Evidencia: los 3 runs de `task_class: doc` (2026-08-19T20:30:14/30/48) usan `deepseek/deepseek-v4-flash` y fallan con exactamente el mismo `qa_reason`: `missing declared output(s): src/utils/helper.js`.
- Frecuencia: 3/3 runs de esta task_class (100%)
- qa_reason recurrente: "missing declared output(s): src/utils/helper.js"

### 2. `qa_reason` "missing declared output(s)" repetido entre task_class y modelos distintos
- Evidencia: además de los 3 runs de `doc` de arriba, el run `implement` de `openai/gpt-5.4` (2026-08-19T18:17:58.433Z) falla con `missing declared output(s): hello-b.txt` — el mismo archivo que sí se creó correctamente 1h39min después en el run de las 20:19:55 (mismo modelo, mismo path, esta vez `pass`).
- Frecuencia: 4/20 runs totales (20%), abarca 2 task_class y 2 modelos distintos (deepseek-v4-flash, gpt-5.4)
- qa_reason recurrente: "missing declared output(s): <archivo>"
- Nota: que el mismo modelo/archivo pase en un reintento y falle en otro sugiere una condición de carrera o de timing en la verificación del output declarado (el archivo se escribe pero el check de QA corre antes de que exista, o hay inconsistencia entre el path declarado y el path real de escritura), más que un problema de capacidad del modelo.

### 3. `implement` con deepseek-v4-flash: 1 fallo sin `qa_reason`
- Evidencia: run 2026-08-19T18:16:53.745Z, `status: failed`, `qa_verdict: None`, sin `qa_reason` registrado.
- Frecuencia: 1/20 runs (5%)
- qa_reason recurrente: N/A — este caso concreto no tiene reason, lo cual es en sí mismo una brecha de instrumentación (un run failed debería dejar traza de por qué).

## Propuestas

### Propuesta 1 — Investigar timing de verificación de "declared output(s)"
- Qué cambiar: el paso de QA que verifica `declared output(s)` (probablemente en el pipeline de verificación post-ejecución, cerca de `qa_verdict`/`checks_failed`)
- Por qué: mismo modelo + mismo archivo (`hello-b.txt`, gpt-5.4) falla una vez y pasa otra vez en menos de 2 horas — indica una condición de carrera (check corre antes de que el filesystem refleje la escritura) o una desalineación entre el path declarado por el modelo y el path real verificado, no un problema del modelo en sí.
- Riesgo: medio — si el fix toca el pipeline de verificación, puede afectar el gate de QA de todos los task_class.

### Propuesta 2 — Registrar `qa_reason` también en fallos sin qa_verdict
- Qué cambiar: el run de 2026-08-19T18:16:53.745Z tiene `status: failed` pero `qa_verdict: None` y `qa_reason: None` — no hay forma de saber por qué falló sin ir a logs crudos.
- Por qué: sin razón registrada, este tipo de fallo es invisible para el propio Dreaming (no se puede agregar a un patrón) y para cualquier revisión posterior.
- Riesgo: bajo — es un cambio de instrumentación/logging, no de lógica de negocio.

### Propuesta 3 — Revisar confiabilidad de deepseek-v4-flash en `doc`
- Qué cambiar: la task_class `doc` (o el prompt/skill que la genera) cuando el modelo asignado es `deepseek-v4-flash`.
- Por qué: 3/3 runs de `doc` fallan, todos con el mismo modelo y el mismo archivo declarado. La muestra es pequeña (n=3) pero 100% de fallo con causa idéntica amerita revisión antes de acumular más runs fallidos con el mismo patrón.
- Riesgo: bajo — es diagnóstico, no cambia código de producción hasta que se confirme la causa raíz (que probablemente coincide con la Propuesta 1).

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Ignorar
- [ ] Requiere revisión
