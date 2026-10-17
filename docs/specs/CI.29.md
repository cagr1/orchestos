# CI.29 — El modelo del chat se entera de que el usuario rechazó (borró) una tarea que propuso

Rol: criterio. Sin decisiones abiertas.

## Evidencia
Pre-push 2026-10-17 tras AT.20: `FAIL chat-turn-details: second held task card visible: bot response: La modificación
sigue pendiente de aprobación en OrchestOS…`. Flujo (`scripts/ui-gate/flows/chat-turn-details.mjs:279-330`): el chat
propone una tarea, el usuario pulsa Reject (la tarea se BORRA, `App.tsx:1089-1094` → `deleteProjectTask`) y repite el
mismo pedido. El modelo, que retoma su propia conversación (hilo Codex / `--resume` de Claude, AT.19.1), solo recuerda
"queda pendiente de aprobación" y no vuelve a llamar a `create_task`. Nada le dice que la tarea se rechazó: la lista de
tareas del prompt solo deja de mostrarla. 2.ª vez visto (la 1.ª, 2026-10-14, en `NEXT.md` "Visto una vez").

## Qué cambiar
1. **Servidor** (`src/dashboard/handlers/chat.ts`, donde se arma `buildChatSystemPrompt`, ~`:1320`): con la sesión y
   `taskRows` ya cargados, calcular las tareas propuestas en ESTA sesión que el usuario borró, con la misma regla que el
   front (`src/dashboard/app/src/App.tsx:229-238`): mensaje de `listChatMessages(session.id)` con `task_id`, ese id ya no
   está en `tasks.yaml` y no hay un mensaje posterior con reporte de esa tarea. Leer en `src/db/chat-sessions.ts` cómo se
   llaman los campos reales (`task_id`, reporte). Extraer la regla a una función pura testeable.
2. **Prompt** (`src/chat/chat-context.ts`): campo nuevo `rejectedTasks?: Array<{ id: string; description: string }>`.
   Si no está vacío, en "Project state" una sección:
   `Rejected by the user (deleted, nothing was run): - <id>: <descripción recortada a 80>` y la línea
   `If the user asks for it again, call create_task again.` Máximo las 5 más recientes.
   La descripción: la del mensaje con la tarjeta (`content` de ese mensaje) si no hay otra fuente.
3. Esto cambia el hash de contexto → Codex y Claude reanudados reciben `<orchestos-context-update>` en ese turno (ya
   existe, AT.19.1 / codex-app-server). No hace falta tocar eso; comprobarlo en un test o en la captura del gate.

## Tests
- Unit: la función de la regla (borrada / existente / con reporte posterior); `buildChatSystemPrompt` con
  `rejectedTasks` (con y sin).

## No tocar
`App.tsx`, el flujo del gate (no se afloja la aserción), `create_task`, el ejecutor. Sin `git stash`/commit/checkout.

## Verificación (el ejecutor la corre; el cerebro la repite)
- `bun run typecheck`, `bun run lint` (exit 0; biome revisa también `.mjs`), `bun run test:coverage`.
- `bun run gate:evidence -- --label CI.29-chat-turn-details -- bun run ui:gate chat-turn-details` **3 veces seguidas**,
  todas PASS; pegar las 3 líneas PASS.
