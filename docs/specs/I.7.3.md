# I.7.3 — Regresión de I.7.2: aprobar una tarea retenida no oculta la tarjeta (spec para Luna)

Ítem: PLAN.md § I.7.3.

## Bug medido (2026-10-04)

`ui:gate chat-turn-details` falla en "Approve & Run removes card": la tarjeta "Task ready to run" sigue visible
15 s después de aprobar, aunque la tarea ya está en `running`. Pasaba en CI.7 y CI.9. Causas leídas en el
useEffect de sondeo de `src/dashboard/app/src/App.tsx` (~299-360):

1. El efecto hace `setThreads(... messages)` con mensajes recargados de la API. `POST /api/tasks/:id/run` deja la
   tarea en `pending` hasta que el proceso hijo la pasa a `running`. Si la recarga cae en ese hueco, el mensaje
   vuelve con `taskHeld: true`, pisa el `taskHeld: false` local de `handleApproveHeldTask` y la tarjeta reaparece.
2. Una tarea rechazada (borrada) cuenta como "espera reporte" y provoca recargas inútiles.

## Cambios (solo `App.tsx`, solo ese efecto)

1. Si la tarea no está en la lista de `getProjectTasks`, marcar su clave en `reportedTaskIds` y **no** recargar
   mensajes. Una tarea borrada nunca reporta.
2. Al agotar los intentos (`attempts >= 6`), marcar la clave sin `setThreads`.
3. Cuando el reporte llegó (`reportCount > 1`), no reemplazar el arreglo de mensajes. **Agregar** solo los mensajes
   cargados cuyo `id` todavía no está en el hilo:
   `setThreads(prev => prev.map(t => t.id === id ? { ...t, messages: [...t.messages, ...loaded.filter(m => !t.messages.some(x => x.id === m.id))] } : t))`.
   El estado local de los mensajes existentes (`taskHeld`, `proposedTask`) no se toca nunca.
4. Nada más cambia: ni el intervalo de 5 s, ni las dependencias del efecto, ni otros handlers.

## Gate

`bunx tsc --noEmit` · `bun run lint` (sin errores nuevos) · `bun run build:app` · `bun test` completo. Si hay
tests del App/chat que cubran el sondeo, ajustarlos. Si no hay, no crear un harness nuevo: el gate real es
`ui:gate chat-turn-details` en vivo, y lo corre el cerebro.

## Fuera de alcance

Backend, `runProjectTask`, el flujo de ui-gate, CX.*. No commitear ni tocar `PLAN.md`.
