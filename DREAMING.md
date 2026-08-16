# DREAMING.md — 2026-08-16

## Runs analizados
- Total: 20 runs
- Periodo: 2026-07-17T20:56:37.618Z → 2026-08-12T22:33:07.698Z
- failed: 2 | blocked: 0 | done: 18 | qa_failed: 2

## Patrones detectados

### Output declarado no producido, repetido idéntico (task_class implement, claude-sonnet-5)
- Evidencia: 2 runs, ambos 2026-07-20T20:3x, `task_class: implement`, `model: anthropic/claude-sonnet-5`, `status: failed`, `qa_verdict: fail`. El `qa_reason` es EXACTAMENTE el mismo texto en los dos: "missing declared output(s): scratch/design-test-premium-a1.html".
- Frecuencia: 2/5 runs `implement` (40%), 2/2 runs `qa_verdict: fail` totales.
- qa_reason recurrente: "missing declared output(s): scratch/design-test-premium-a1.html"

Nota: con solo 20 runs en la ventana y un único par de fallos idénticos, la muestra es chica — pero que el mismo path exacto (`scratch/design-test-premium-a1.html`) falle dos veces seguidas sugiere una tarea repetida (retry) que sigue apuntando al mismo output declarado sin corregir la causa raíz, no dos incidentes independientes.

## Propuestas

### Propuesta 1 — Verificar por qué `scratch/design-test-premium-a1.html` no se generó en ninguno de los 2 intentos
- Qué cambiar: revisar el prompt/tarea que declaró ese output (probablemente en `tasks.yaml` o el run log asociado a esos dos runs del 2026-07-20) y ver si el modelo escribió el archivo en otra ruta, no lo escribió, o el gate de verificación busca en el lugar equivocado.
- Por qué: mismo qa_reason letra por letra en 2 corridas consecutivas indica que el segundo intento (probablemente un retry manual) repitió el mismo fallo sin cambios — señal de que el problema no se diagnosticó entre el primer y segundo intento.
- Riesgo: bajo (solo investigación, no cambia código)

### Propuesta 2 — Sin acción adicional recomendada por ahora
- Qué cambiar: ninguno — el resto de los runs (18/20) están `done` sin `checks_failed`, sin patrón de fallo por modelo (deepseek-v4-flash: 0 fallos en 15 runs) ni por `task_class chat/doc`.
- Por qué: la muestra de 20 runs es demasiado chica para inferir una tendencia sistémica más allá del caso puntual de Propuesta 1; conviene esperar a que se acumulen más runs de `implement` antes de tocar el pipeline de verificación de outputs.
- Riesgo: bajo

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Ignorar
- [ ] Requiere revisión
