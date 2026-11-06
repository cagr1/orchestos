# ERP.6 — ¿OrchestOS pesa más que el CLI directo? (medido 2026-10-18)

Pedido de Carlos (2026-10-17): "demostrar que usar OrchestOS no se siente más pesado para el modelo, tiene reglas
claras y no es costoso en tokens o uso".

**Veredicto: no pesa más.** En chat, OrchestOS arranca con menos contexto que el CLI directo en los dos CLI y gasta
menos tokens por turno: 4× menos con Claude. En tareas, el ejecutor gasta menos tokens que el CLI directo; lo que se
suma es el turno del Orquestador que propone la tarea y unos segundos de worktree y QA. La única diferencia en contra
(Codex con herramientas) tenía causa en el prompt y se cortó en ERP.6.1.

## Método
- Mismo pedido, mismo cwd (el repo), mismo modelo y esfuerzo en los dos lados: `claude-sonnet-5` y `gpt-6-luna`, los
  dos `medium`. "Directo" = el CLI como lo usa Carlos (`claude -p`, `codex exec --sandbox read-only`), con su config
  real del home. "OrchestOS" = `POST /api/chat` contra el dashboard real (sesión nueva por corrida, borrada al final).
- Contexto inicial = prompt de la primera llamada al modelo: Claude, `usage` del primer `assistant`; Codex,
  `last_token_usage.input_tokens` del primer `token_count` del rollout. Entrada total = suma de todas las llamadas
  del turno (caché incluida). 3 repeticiones; promedios.
- Arnés: `docs/done/evidence/ERP.6-bench.ts` (`bun ERP.6-bench.ts <puerto> <repeticiones>`). Crudo:
  `docs/done/evidence/ERP.6-chat-before.json` (antes de ERP.6.1) y `docs/done/evidence/ERP.6-chat-after.json`.
- Cuota: no hay lectura fiable de la cuota de 5 h por turno; se usa la entrada total como sustituto (es lo que la
  consume). Calidad: las 24 respuestas de cada serie son correctas (`src/router/model-catalog.ts:257`); algunas
  también citan la segunda definición en `scripts/`, lo que es cierto.

## Chat (después de ERP.6.1)
| pedido | modo | contexto inicial | entrada total | llamadas | latencia |
|---|---|---|---|---|---|
| "Responde solo: ok" | Claude directo | 42 455 | 42 455 | 1 | 4,8 s |
| | Claude OrchestOS | 10 650 | 10 650 | 1 | 3,9 s |
| | Codex directo | 28 891 | 28 891 | 1 | 6,0 s |
| | Codex OrchestOS | 23 890 | 23 890 | 1 | 6,1 s |
| buscar `contextWindowFor` con herramientas | Claude directo | 42 534 | 158 385 | 3,7 | 13,3 s |
| | Claude OrchestOS | 10 693 | 33 666 | 3 | 9,5 s |
| | Codex directo | 28 914 | 90 627 | 3 | 11,5 s |
| | Codex OrchestOS | 24 054 | 75 820 | 2,7 | 6,7 s |

Por qué OrchestOS arranca más liviano: cada CLI corre con un home de config propio por proyecto
(`.orchestos/agent-home/<cli>`), sin hooks, MCP, memoria ni instrucciones globales del usuario; el contexto que
OrchestOS inyecta es ~840 tokens (`runs.context_tokens`). El directo carga todo lo del home (en Claude, 42 k antes
del primer token: system prompt, skills, `CLAUDE.md` global y del proyecto, `MEMORY.md`).

**Diferencia en contra, cortada:** antes de ERP.6.1, Codex con herramientas hacía 4,3 llamadas por OrchestOS contra
2,7 directo (109 241 contra 82 220 de entrada, 14,3 contra 10,5 s). En el rollout: una llamada para descubrir
`run_readonly` en `ALL_TOOLS`, un `sed` rechazado por la lista permitida y un `"-A 18"` en un solo argumento. Arreglo
en el prompt, sin tocar la frontera de AT.21 → ERP.6.1.

## Tarea (`erp-piloto`, una corrida)
Pedido: función `stockBajo(db, umbral)` en `src/inventario/stock.ts` con su test. Ejecutor `gpt-6-luna` medium en los
dos lados.

| | contexto inicial | entrada total | llamadas | latencia | resultado |
|---|---|---|---|---|---|
| Codex directo (`exec --sandbox workspace-write`) | 20 566 | 158 208 | 7 | 23,9 s | +41 líneas, tests verdes |
| OrchestOS, ejecutor | 15 284 | 91 302 (incluye ~4,5 k del revisor) | 5 | 29,4 s (worktree + gates + QA) | +71 líneas, QA `pass` (`gpt-6.1-sol`), commit en `master` |
| OrchestOS, turno del Orquestador que propone la tarea | 10 391 | 27 617 | — | 22,5 s | `claude-opus-5-5`, $0,117 |

Lectura: el ejecutor de OrchestOS gasta 42 % menos entrada que el CLI directo, con QA independiente y commit
incluidos. El sobrecosto real del modo tarea es el turno del Orquestador (por la regla "tareas solo por chat") y unos
5,5 s de worktree y QA. Con una sola corrida, la latencia de tarea es indicativa, no concluyente.

## Hallazgos que quedan abiertos
- **ERP.6.2** — `cost_breakdown_json` de una tarea no lleva fila del revisor: se arma antes de QA
  (`src/run/harness.ts:643`), aunque los totales del run sí incluyen sus tokens (`harness.ts:1021-1027`). La caché
  del revisor no se suma a `cache_read_tokens`.
- El texto final del chat Codex por OrchestOS incluye el preámbulo de comentario ("Voy a localizar…"); el directo solo
  da el mensaje final. Es UX, no peso; queda para ERP.7 (comparación de UX).
