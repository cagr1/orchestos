# DREAMING.md — 2026-08-22

## Runs analizados
- Total: 20 runs
- Periodo: 2026-08-17T22:36:30.586Z → 2026-08-19T21:02:14.779Z
- failed: 5 | blocked: 0 | done: 15 | qa_failed: 4

## Patrones detectados

### task_class "doc" falla el 100% de las veces con la misma causa
- Evidencia: los 3 runs con `task_class: "doc"` (ids `696cc3ca`, `01f9b0e6`, `516bcb21`), todos `model: deepseek/deepseek-v4-flash`, `status: failed`, `qa_verdict: fail`.
- Frecuencia: 3/3 runs de esa clase (100%)
- qa_reason recurrente: "missing declared output(s): src/utils/helper.js"

### Todo `qa_failed` del período comparte el mismo tipo de causa
- Evidencia: los 4 runs con `qa_verdict: fail` (3 de `task_class: doc` arriba + `d064d1b9` de `task_class: implement`, `model: openai/gpt-5.4`) fallan por archivo declarado que no se creó — solo cambia el nombre del archivo (`src/utils/helper.js` vs `hello-b.txt`).
- Frecuencia: 4/4 runs con qa_failed (100%)
- qa_reason recurrente: prefijo "missing declared output(s): ..."

### deepseek/deepseek-v4-flash con qa_verdict fail en 3+ runs
- Evidencia: los 3 runs de `task_class: doc` (`696cc3ca`, `01f9b0e6`, `516bcb21`) usan `deepseek/deepseek-v4-flash` y todos terminan `qa_verdict: fail`. Nota: el mismo modelo también tiene 3 runs `done`/`pass` en `task_class: implement`, así que el fallo no parece ser del modelo en general sino específico a la combinación modelo+task_class "doc".
- Frecuencia: 3/3 runs qa_verdict fail para ese modelo en el período
- qa_reason recurrente: "missing declared output(s): src/utils/helper.js"

### Anomalía aislada — run "implement" sin ejecución real
- Evidencia: run `182c0955` (`task_class: implement`, `deepseek/deepseek-v4-flash`) termina `status: failed` pero con `qa_verdict: null`, `qa_reason: null`, `usd_cost: 0`, `tokens: 0`, `elapsed_ms: 179`. Parece un fallo de arranque/config previo a invocar el modelo, no un fallo de QA.
- Frecuencia: 1/20 runs — no es un patrón recurrente todavía, se deja registrado por si vuelve a aparecer.

## Propuestas

### Propuesta 1 — Revisar el prompt/contrato de salida para `task_class: "doc"`
- Qué cambiar: el prompt o la definición de outputs esperados para tareas de clase "doc" (probablemente en la config de skills/tasks que arma el prompt para esa clase), específicamente el caso que declara `src/utils/helper.js` como output.
- Por qué: 3/3 runs de esta clase fallan exactamente por no producir ese archivo declarado — sugiere que el contrato de salida está mal especificado para esta clase de tarea, no un problema puntual del modelo.
- Riesgo: bajo

### Propuesta 2 — Endurecer la verificación de "declared output(s)" antes de correr el modelo
- Qué cambiar: el paso de QA que verifica outputs declarados vs. producidos — agregar una comprobación temprana (pre-flight) de que el path declarado es alcanzable/escribible por el agente antes de gastar tokens, ya que el patrón se repite igual en `implement` con gpt-5.4 y en `doc` con deepseek.
- Por qué: 4/4 de los fallos de QA en el período son exactamente esta causa, cruzando modelos distintos (deepseek y gpt-5.4) — sugiere un problema sistémico de contrato output-declarado vs. output-real, no de un modelo específico.
- Riesgo: medio (toca el flujo de QA compartido por todas las clases de tarea)

### Propuesta 3 — Investigar el run `182c0955` como posible bug de arranque
- Qué cambiar: revisar logs/código alrededor del punto de entrada de `task_class: implement` con deepseek para el caso donde el run termina en 179ms con 0 tokens y 0 costo — posible excepción no capturada antes de llamar al proveedor.
- Por qué: un run "failed" sin qa_verdict ni costo es indistinguible en el dashboard de un fallo de QA real; solo 1 ocurrencia hasta ahora, vale la pena confirmar si es reproducible antes de invertir más.
- Riesgo: bajo

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Aplicar propuesta 2
- [ ] Aplicar propuesta 3
- [ ] Ignorar
- [ ] Requiere revisión
