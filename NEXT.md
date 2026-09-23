# NEXT — handoff 2026-09-21 (noche) → siguiente tab

## Siguiente tab — Lote L1 CERRADO; abrir L2
L1 terminado 2026-09-23: CI.2.B, UI.13.4c, UI.13.2d (Tasks real) con gate:all + ui:gate PASS y push.
Siguiente: abrir **L2** con los 3 siguientes de la Fase 1 (PLAN.md § Rumbo): pantallas restantes de UI.13
(Runs/Graph ya tienen parte; luego Memory/Specs/Skills/Instincts/Plan) → UI.9.9 → UI.9.8. Mismo bucle:
spec en `docs/specs/`, Luna con `codex exec -m gpt-5.6-luna -c model_reasoning_effort=medium -s workspace-write "…" < /dev/null`,
flujo en `scripts/ui-gate/flows/<pantalla>.mjs`, verificar con `bun run gate:all` + `bun run ui:gate <flujo>` + `smoke`.
Lecciones nuevas de UI.13.2d:
- El preflight solo reconoce ítems de **primer nivel** en PLAN.md (`^- [ ] **ID`); un sub-ítem con sangría lo bloquea.
  Abrir el sub-ítem como línea propia antes de lanzar a Luna.
- Luna volvió a decir "lint preexistente" en falso (era su archivo) y "typecheck PASS" corriendo solo el tsc raíz:
  exigir `bun run typecheck` completo (dos tsconfig).
- Tareas de fixture: `engine: codex` + `executor_model: openai/gpt-5.6-luna`, **nunca** `executor: codex` (exige
  `OS_ENABLE_EXEC_CODEX`); así las crea el chat (`resolveAgentSelection`). La tarea debe modificar su output o el QA
  la devuelve a `pending` con reintento.
- Un QA fallido no cambia el status: fin de run = status, `retryCount` o `runId` distintos.
- Hook PreToolUse bloquea que el cerebro edite código (`src/**`); los arreglos del flujo de gate pasaron sin bloqueo.
- El hook de contexto pide cerrar tab desde ~8% de 1M: umbral a revisar.
Antes (ítem 3, ya hecho): CI.2.B (47b4dbf) y UI.13.4c (aca8d90) cerrados y pusheados; dashboard :4242 reiniciado con el código nuevo.
Ítem 3: siguiente pantalla de UI.13 (Tasks, PLAN.md § Fase 1). Mismo bucle: spec en `docs/specs/`, Luna con
`codex exec -m gpt-5.6-luna -c model_reasoning_effort=medium -s workspace-write "…" < /dev/null` (NO `--full-auto`:
esa flag no existe), flujo nuevo en `scripts/ui-gate/flows/<pantalla>.mjs`, verificar con `bun run gate:all` +
`bun run ui:gate <flujo> smoke`. Preflight con `--scope` real del ítem (si no, el pre-commit bloquea).
Lecciones del lote: Luna afirmó 3 veces cosas falsas ("DB aislada", "catálogo sin luna", "lint preexistente") →
verificar siempre. `visible()` espera a que aparezca; para "desaparece" usar `ctx.hidden()`. Reproducciones por API:
buscar el proyecto por `realpath` y pasar `x-orchestos-project-id`, o el fallback `legacy-cwd` escribe en el
`tasks.yaml` de ESTE repo (pasó y se revirtió).

## Lote L2 (abierto 2026-09-23, pedido de Carlos)
Ítems: UI.13.2e Runs+Graph (`docs/specs/UI.13.2e.md`) → UI.13.2f Memory/Specs/Skills/Instincts/Plan (un spec,
incluye acciones de PlanBoardView) → UI.13.3 borrar vanilla/`/legacy`/islas/CSS/ui-gates de píxel (recuperable
por git). Mismo flujo y paradas que L1. Reemplaza el orden anterior (UI.9.9/UI.9.8 quedan para L3).
| ítem | rondas Luna | gate | SHA | min |
|---|---|---|---|---|
| UI.13.2e | 3 (r1 runs sin `project_id`; r2 lo propagó dashboard→CLI→harness; r3 proyecto duplicado por symlink `/var`↔`/private/var` al indexar, dejó 14 fantasmas en la DB real que rompían smoke con 410 — borrados por el cerebro) | runs-graph 16/16 (flujo endurecido por el cerebro: QA se mira con la pestaña abierta, conteo real antes y +1 tras Rebuild) · smoke 6/6 · gate:all 1533/0 | ver git log | ~120 |

## Lote L1 — prueba del flujo por lote (abierto 2026-09-23, `docs/propuesta-flujo-por-lote.md`)
Ítems: CI.2.B (`ui:gate`, spec `docs/specs/CI.2.B.md`) → UI.13.4c (`docs/specs/UI.13.4c.md`) → siguiente pantalla de UI.13.
Fin: los 3 con `gate:all` + `ui:gate` PASS, commit, `[x]` en PLAN.md, push. Paradas: el MISMO fallo tras 2 reintentos
(ajustado en el primer uso: CI.2.B tuvo 4 rondas por 4 causas distintas, cada una avanzando),
decisión de producto no prevista, acción irreversible, tope de 3 ítems. Luna escribe; el cerebro vigila y verifica.
Decisión tomada por el cerebro (Carlos no respondió las 3 preguntas; aplicó las recomendaciones): botón
`Approve & Merge to Main` → `Approve & Run` (aprobar corre la tarea, no hace merge).
**Preguntas para Carlos al cierre del lote (no bloquean):**
1. **RESPONDIDA 2026-09-23 por Carlos: "Lista por proyecto".** La lista de Chat muestra los chats del proyecto de la
   cabecera + los generales; "New chat" se liga al proyecto visible; el diálogo ofrece "Sin proyecto" explícito.
   Pregunta original — Cabecera vs chat nuevo: sin proyecto activo, la cabecera muestra `projects[0]` (`App.tsx:220`) pero "New chat" crea
   una sesión sin proyecto (`App.tsx:467`, modo Chat, no crea tareas). ¿Chat nuevo = proyecto que se ve en la cabecera,
   o la cabecera dice "sin proyecto" (chat general)? Recomendación: ligar al proyecto visible y ofrecer "sin proyecto"
   explícito en el diálogo de New chat.
2. Decidido por el cerebro en UI.13.4c r7 (revisable): un mensaje clasificado como tarea cuyo borrador no nombra
   archivos NO crea tarea ni añade nota de error (antes: guardaba `output: []`, arrancaba un run y dejaba `tasks.yaml`
   inválido para siempre). También pendiente AT.10: `buildNaturalDraft` llama a haiku por OpenRouter en silencio.
3. La tarjeta retenida copia el título literal de la plantilla "Task Ready for Git Commit Proof": no describe lo que
   pasa (tarea retenida esperando aprobación). ¿Se cambia el texto?
4. Test inestable (no del lote): `scripts/context-adapters.test.ts:187` (timeout 500 ms) falló 1 de 2 corridas de
   `test:coverage` bajo carga; aislado pasa.
5. DB real: filas huérfanas de fixtures de tests (`files`/`code_edges` de `gfc-*`, `ruby-check`) sin proyecto. ¿Limpiarlas?
| ítem | rondas Luna | gate | SHA | min |
|---|---|---|---|---|
| UI.13.2d | 4 (preflight sin ítem, implementación, fin de run por reintento, cast TS) + fixture/gate corregidos por el cerebro | PASS tasks 13/13 · smoke 6/6 · gate:all verde | ver git log | ~70 |
| UI.13.4c | 13 (código, regex, razonamiento+R.1, flujo, rutas, tarea vacía, popover, Reject/Approve, esperas, árbol sucio, decisión lista, fila) | PASS chat-turn-details 27/27 · smoke 6/6 · gate:all verde | ver git log | ~210 |
| CI.2.B | 5 (spawn fd, espera, bug Settings, flujo) + 1 chore de lint innecesario revertido (diagnóstico mío errado: eran avisos, no errores) | PASS smoke 6/6 · gate:all verde | ver git log | ~75 |

## Decisión vigente
UI.13 (PLAN.md § UI.13): el prototipo de AI Studio **es** el frontend (`src/dashboard/app/`, servido en `/`);
el vanilla vive en `/legacy` solo hasta UI.13.3 y no se edita. Tope: **lo que falta de UI.13 en 2 h**
(regla escrita en PLAN.md § UI.13).

## Regla de Carlos 2026-09-22
Cero trabajo sobre el vanilla: `/legacy` es cascarón de referencia. Todo look/comportamiento sale de la
plantilla `~/Documents/screens/orchestos-ai-agent-dashboard`. Anotado en PLAN.md § UI.13.

## Hecho y pusheado
UI.12.2a, UI.13.1, UI.13.1b, UI.13.2a (Chat), UI.13.2b (proyectos/Dev/Files, cerrado 2026-09-22).

## Decisión 2026-09-22 (tarde) — "SI go"
Copiar YA tal cual las pantallas de la plantilla sin backend (datos de ejemplo visibles), conectar después.
Primero: pasada de fidelidad pantalla por pantalla, capturas lado a lado revisadas por Opus (no haiku).
Detalles de Carlos → PLAN.md § UI.13 (3) a–d: barra inferior sin acción/usage 5h+semanal, selector de CLI/modelo/
esfuerzo real en el input del chat, iconos de CLI con color, Settings→Usage estilo GitHub.
CI verde otra vez en local (61b63b6, CI.3); pre-push ahora corre lint.

## Estado 2026-09-22 (noche)
UI.13.5 cerrado y pusheado (448f07a). Siguiente: **UI.14** — copiar la plantilla nueva de AI Studio (Dev como chat
que actúa como CLI, AgentComposer, ContextRing, ShellStatusBar, logos de producto) y cablearla. Plan en el último
mensaje del tab anterior; **espera el GO de Carlos** y su respuesta sobre tooltips (nativos `title` tal cual vs
tooltip propio instantáneo). Luego UI.13.6 (cuotas reales: Claude sin fuente, Codex vencido desde 17-sep).

## Rumbo nuevo (2026-09-22)
- PLAN.md reordenado en tres fases (sección "Rumbo" al inicio): interfaz → producto mínimo → correr dentro de
  OrchestOS igual que el CLI directo. Cerrados archivados en `docs/done/` (índice al final de PLAN.md).
- Siguiente: Fase 1, empezando por UI.13.4c. 11 ítems retirados (`docs/done/retirados.md`); UI.8.6 pasó a Fase 2.
- UI.14: sin verificar en vivo el selector nativo de nuevo proyecto.
- Carlos: turno real de gate = **Codex · gpt-5.6-luna · medium**.

## Siguiente (serial, una ronda cada uno)
1. UI.13.2c Settings — cerrado 2026-09-22. Pendiente menor: idioma solo traduce Settings.
2. UI.13.4a — cerrado 2026-09-22.
3. UI.13.4b — cerrado 2026-09-22 (816a229). Decisión pendiente de Carlos: la frontera por argumentos no frena
   `node -e`/`sh -c`; barrera real = sandbox de proceso o lista de binarios permitidos.
   UI.13.4c razonamiento/herramientas/tarea retenida en el chat — spec por escribir.
4. Tasks/Runs/Graph → Memory/Specs/Skills/Instincts/Plan → UI.13.3 borrar vanilla.
Gate en vivo con el patrón de `/tmp/ui132b-gate*.mjs`. Regla nueva: comportamientos de la plantilla se
hacen reales, no se quitan (PLAN.md § UI.13).

## Avisos
- Al lanzar Luna, agregar al prompt: "No invoques codex exec ni delegues a otro agente" (hoy se anidó sola).
- Luna en segundo plano: `codex exec … < /dev/null`. Sin eso queda colgada en "Reading additional input from
  stdin..." sin hacer nada (2026-09-22: 40 min perdidos).
- No usar `pkill -f "<patrón>"` si una tarea en segundo plano tiene ese texto en su línea de comandos: la mata
  también (2026-09-22 cortó el wrapper de Luna). Matar por PID (`lsof -ti :3000 | xargs kill`).
- Sesiones interactivas de Codex viejas abiertas: PIDs 78537 (12-sep), 48287 (11-sep), 62791 (hoy 19:07).
  No cerrarlas sin que Carlos confirme.
- Pendiente de verificar con Carlos: un turno real de chat contra un LLM (el modelo lo elige él).
- Fuente: el prototipo mismo renderiza con fuente del sistema (clase `font-sans` en `body`); la app es fiel.
  Si Carlos quiere Plus Jakarta Sans real, es un cambio de una línea.
- Stash guardados: `stash@{0}` UI.12.2b (reemplazado), `stash@{1}` UI.11 parcial. No aplicar.
