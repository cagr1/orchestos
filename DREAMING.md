# DREAMING.md — 2026-08-11

## Runs analizados
- Total: 20 runs
- Periodo: 2026-07-17T20:54:37.509Z → 2026-07-27T22:24:25.712Z
- done: 18 | failed: 2 | blocked: 0 | qa_failed: 2 (qa pass: 4, sin QA/null: 14)

## Patrones detectados

Ninguno de los patrones definidos (tasa de fallo >50% por `task_class`, mismo `model` con `qa_verdict: fail` en 3+ runs, `checks_failed > 0` recurrente) se cumple con el umbral pedido en este batch de 20 runs. Hay una señal débil, no un patrón confirmado:

### Fallo QA repetido idéntico (señal débil, no cumple umbral de 3+)
- Evidencia: 2 runs `task_class: implement`, `model: anthropic/claude-sonnet-5`, ambos el mismo día (2026-07-20, 20:30 y 20:36 UTC), mismo `qa_reason` exacto: "missing declared output(s): scratch/design-test-premium-a1.html". `usd_cost: 0` y `tokens: 0` en ambos — sugiere que el run falló antes de invocar el modelo (output declarado nunca se generó), no un fallo de calidad del modelo en sí.
- Frecuencia: 2/20 runs totales, 2/5 runs de `task_class: implement` (40% de esa clase, por debajo del umbral de 50%)
- qa_reason recurrente: "missing declared output(s): scratch/design-test-premium-a1.html"

No hay evidencia suficiente (solo 2 ocurrencias, mismo día, posible reintento del mismo trabajo) para separar "bug sistémico en la declaración de outputs" de "un caso puntual reintentado". No se propone acción sobre esto — solo queda registrado por si reaparece en corridas futuras y cruza el umbral de 3+.

## Propuestas

Ninguna. No hay evidencia suficiente en este batch para proponer un cambio concreto con confianza.

## Decisión (llenar manualmente)
- [ ] Aplicar propuesta 1
- [ ] Ignorar
- [ ] Requiere revisión
