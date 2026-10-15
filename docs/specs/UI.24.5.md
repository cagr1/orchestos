# UI.24.5 — Una tarjeta por tarea

Ítem: PLAN.md § UI.24. Rol: `criterio`. No commitear, no tocar PLAN.md ni NEXT.md. Cambios ajenos sin commitear
(`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`): no tocarlos.
Dirección y reglas visuales de UI.24 (PLAN.md § UI.24, "Dirección:"). **PROHIBIDO `git stash`, `git checkout` y
`git restore`**: la contraprueba se hace con copia en `/tmp` + `git show HEAD:<ruta> > <ruta>`, restaurar la copia y
confirmar con `cmp`.

## Problema

Hoy una tarea ocupa varias burbujas en `src/dashboard/app/src/components/chat/OrchestChatView.tsx`: el mensaje
propuesto con la caja "Task ready to run" (`:415-471`), y un mensaje de reporte por intento (`✗ Task \`<uuid>\`
failed · attempt 1/3 · provider/model`, texto que arma `src/dashboard/handlers/task-report.ts:23-58`) con su caja
"Uncommitted changes" o su botón Retry (`:472-` hasta el cierre del bloque). El UUID se lee 2-3 veces.

## Objetivo

Una tarea = **una sola tarjeta**, en la posición del primer mensaje del hilo con ese `taskId`, que cambia de estado en
su sitio. Los mensajes posteriores con el mismo `taskId` (reportes) no se dibujan como burbujas: alimentan la tarjeta.

Contenido de la tarjeta:
- **Nombre corto**: primera línea de la descripción, sin markdown, cortada a ~60 caracteres con `…`. Debajo, la
  descripción completa solo si es distinta del nombre (texto secundario, `text-app-muted`, máx. 3 líneas con
  `line-clamp`).
- **UUID**: no se muestra como texto. Botón solo icono para copiarlo, `aria-label="Copy task id"`, `title` = el id; el
  id también va en `data-task-id` del contenedor de la tarjeta.
- **Estado** (atributo `data-task-state` en el contenedor, y una etiqueta corta visible):
  `held` → "Ready to run"; `running` → "Running" (texto con el shimmer de UI.24.3, el mismo que usa
  `ThreadThinking`); `failed` → "Failed"; `blocked` (pending con `dirtyFiles`) → "Uncommitted changes";
  `pending` sin archivos → "Pending"; `done` → "Done". Color solo como estado (punto o texto con `app-success`,
  `app-error`, `app-warning`), nunca fondo de color ni degradado. El acento celeste solo en el botón primario.
- **Intento y modelo**: "Attempt 1/3 · codex/gpt-6-luna" en una línea secundaria, del último reporte.
- **Resumen** del último intento (la cita `> …` del reporte), texto secundario.
- **Acciones dentro de la tarjeta**, mismos textos exactos de hoy: `held` → "Approve & Run" (primario) y "Reject";
  `blocked` → lista de archivos sucios + "Commit & Run"; `failed`/`pending` → "Retry". Mismas funciones y mismo
  manejo de error/ocupado que hoy (`taskActionErrors`, `runReportAction`, `busyReportActions`); el error se muestra
  dentro de la tarjeta con `role="alert"`.
- **Intentos anteriores plegados**: si hay más de un reporte, una fila "N earlier attempts" plegada por defecto que
  abre la lista (estado + intento + modelo + resumen de cada uno), con el mismo mecanismo de plegado que ya usa
  `ThreadThinking`/`components/ui/thinking-steps.tsx` (no añadir dependencias).

## Datos

1. Extender `TaskReportData` (`src/db/chat-sessions.ts:38`) de forma **aditiva**, campos opcionales: `attempt`,
   `maxAttempts`, `provider`, `model`, `summary`. Llenarlos en `buildTaskReportData` (`task-report.ts:23`) con los
   mismos valores que ya entran en el texto. **El `content` del reporte no cambia** (otros consumidores lo leen).
   Propagar el tipo a `src/dashboard/types.ts:107`, `app/src/api/chat.ts:30` y `app/src/types/orchestos.ts:212`.
   Añadir el caso a `src/dashboard/handlers/task-report.test.ts` (`toEqual` de `:121,125,144` se ajusta).
2. Mensajes viejos sin esos campos: la tarjeta deriva estado de `outcome` y muestra el `content` del reporte (vía
   `ThreadMarkdown`) como resumen; sin intento/modelo.
3. Estado `running`: tarea con mensaje lanzado (`taskHeld` falso) y sin reporte posterior, o con un "Retry"/"Commit &
   Run" en curso (`busyReportActions`). Al llegar el reporte nuevo, la misma tarjeta cambia de estado (sin burbuja
   nueva).
4. Lógica de agrupado en una función pura `components/thread/taskCards.ts` (entrada: `ChatMessage[]`; salida: por
   `taskId`, el id del mensaje ancla, los reportes en orden, el estado derivado y el set de ids de mensajes a no
   dibujar), con test `taskCards.test.ts` (held; lanzado sin reporte; failed→retry→done; blocked; mensaje viejo sin
   campos nuevos; dos tareas intercaladas en el hilo). Reemplaza `lastMessageIdByTask` (`OrchestChatView.tsx:93-97`).
5. Si el contenido del mensaje ancla es igual a la descripción de la tarea (trim), no dibujar ese texto aparte (hoy
   sale dos veces: markdown + caja). Si es otro texto del orquestador, se dibuja arriba de la tarjeta como hoy.
6. `App.tsx:205-235` (qué mensaje sigue `taskHeld`) no cambia de lógica.

## Componente

`components/thread/TaskCard.tsx`, presentacional (props: datos derivados + callbacks). Superficie plana:
`Card` de `@/components/ui/card` o `rounded-card bg-app-surface border border-app`; tokens `app-*`, ningún color de
paleta de Tailwind, sin sombras de color. Botones con `Button` de `@/components/ui/button`. Cambio de estado con
fundido/altura corta de `motion` (ya instalado); con `prefers-reduced-motion`, instantáneo.

## No tocar

`ThreadMarkdown.tsx`, `ThreadThinking.tsx`, `AgentComposer.tsx`, `components/dev/*`, `components/ui/*`, herramientas
(UI.24.7), `OrchestDevWorkspace.tsx`. Backend solo lo de "Datos" punto 1. Selectores que siguen valiendo:
`div.prose`, `div.max-w-2xl`, `div.max-w-3xl`, `textarea`, `aria-label="Send message"`, `[data-thread-working]`,
"Approve & Run", "Commit & Run", "Retry", "Reject".

## Gates

Los flujos leen textos que esta tarjeta quita; actualizarlos **en este ítem**, apuntando a la tarjeta
(`[data-task-id="<id>"]` + `data-task-state`) en vez del texto del reporte:
- `chat-retry-report.mjs:136,163,214,236,262,315` ("Task ready to run", regex `✗ Task … failed · attempt 1/3`,
  `✓ Task … done`, "Uncommitted changes"). Añadir paso: tras el Retry exitoso hay **una** tarjeta para esa tarea
  (`[data-task-id="<id>"]` count = 1), en estado `done`, con "1 earlier attempts" (o el texto elegido) plegado.
- `chat-turn-details.mjs:275,292,341` (`getByText(heldTask.id)` → la tarjeta con `data-task-id` y el botón
  "Copy task id").
- `auto-flow.mjs:315,367`.
Paso nuevo en los tres donde aplique: `no uuid text` — el `innerText` de la tarjeta no contiene el id.

Ampliar `scripts/ui-gate/flows/thread-states.mjs` (lámina `ThreadStatesSheet.tsx`, sin LLM) con una tarjeta por
estado (`held`, `running`, `failed` con 1 intento anterior, `blocked`, `done` con 2 intentos anteriores), pasos:
`one card per task`, `state label`, `no uuid text`, `earlier attempts collapsed then open`, `actions inside card`,
`no palette in task card` (regex `PALETTE` de `shell-look.mjs:8`).
Contraprueba: con `OrchestChatView.tsx` de HEAD (método de arriba), `chat-retry-report` o `thread-states` falla en
`one card per task`; pegar la salida y restaurar.

## Verificación (pegar salida real)

    bun run typecheck
    bunx biome check <archivos tocados>
    bun run build:app
    bun run ui:fidelity:jsx
    bun test src/dashboard/app/src/components/thread src/dashboard/handlers/task-report.test.ts
    bun run ui:gate thread-states chat-retry-report chat-turn-details auto-flow chat-streaming smoke

Si un gate falla por Codex (`workspace routing discovery failed`, HTTP 502) y no por la tarjeta, decirlo con la línea
del log y seguir. Mirar las capturas de `chat-retry-report` (antes de Retry, después de Retry, árbol sucio) y
describir qué se ve.

Reportar: archivos tocados, cómo se derivó cada estado, texto elegido para intentos anteriores, rutas de las capturas,
y lo que no se pudo cumplir tal cual.

Antes de reportar: `bunx biome format --write <archivos tocados>` (el pre-push corre `lint` y el formato lo bloquea).
