# UI.24.7 — Herramientas y movimiento

Rol: `criterio`. Fuente: `PLAN.md` § UI.24 (dirección y reglas visuales) / UI.24.7. GO de Carlos 2026-10-13.
Solo presentación del hilo de **Chat** (`components/chat/OrchestChatView.tsx`); Dev, Settings, barra lateral y
backend quedan fuera.

## Problema (verificado en HEAD ab50efe)
- Herramientas (`OrchestChatView.tsx:398-432`): rótulo "TOOL EXECUTIONS" en mayúsculas, una caja con borde por
  llamada, punto verde fijo aunque falle (`bg-app-success` siempre), `JSON.stringify(tool.args)` crudo y la duración
  en `ms`. Siempre abierto: un turno con 12 llamadas empuja la respuesta fuera de la pantalla.
- Movimiento: todo `ChatMessage` va con `initial={false}` y `layout={false}` (`:313-314, 366-367, 485-486`); los
  mensajes aparecen de golpe. Se apagó en UI.24.2 porque el hilo se re-monta muchas veces por turno (UI.24.6b midió
  ~16 re-montajes de la miniatura) y porque el mensaje optimista se reemplaza por la copia del servidor
  (`App.tsx:922-991`): con la entrada encendida, cada re-montaje o reemplazo volvería a animar.
- Estado vacío (`:288-296`): "Chat" + un párrafo de relleno ("Interactive session with X. Ask questions, run
  commands, or review architecture.").

## Qué cambiar
1. **Fila de herramientas** — componente nuevo `components/thread/ThreadTools.tsx`, con la familia
   (`ThinkingSteps`/`ThinkingStepsHeader`/`ThinkingStepsContent`/`ThinkingStep`, como `ThreadThinking.tsx`; no editar
   `components/ui/*`). Sustituye el bloque `:398-432`.
   - Plegada por defecto. Cabecera: `"<n> tool"`/`"<n> tools"` + ` · <duración total>` si alguna trae `durationMs`
     (formato `formatElapsed` o equivalente: `2.1s`, `850ms`, `1m 04s`). Si alguna falló: ` · <k> failed` en
     `--app-error`/`text-destructive`, el único color de la fila. Nada en mayúsculas.
   - Cada paso: nombre de la herramienta (mono) + objetivo legible (`args.target` o `args.command`, truncado a una
     línea con `title` completo; nunca `JSON.stringify`) + duración a la derecha (tabular). Estado por icono de la
     familia: `running` = activo, `success` = completo neutro (sin verde), `failed` = error.
   - `result`, si existe: debajo del paso, mono pequeño `text-muted-foreground`, máx. 4 líneas con corte limpio.
   - Atributos para los gates: contenedor `data-thread-tools`, `data-tool-count="<n>"`, `data-tool-failed="<k>"`;
     cada paso `data-tool-step` con `data-tool-status`.
   - El bloque de razonamiento y el de herramientas quedan con el mismo ritmo vertical (mismo margen, mismo `-mx`).
2. **Entrada de mensajes sin re-animar.**
   - Un mensaje anima su entrada (la de `ChatMessage`: opacidad + `y` + escala, `spring.moderate`) **una sola vez**,
     cuando aparece en un hilo ya abierto. No anima: el historial al abrir o cambiar de sesión, tras recargar la
     página, en un re-montaje, ni la copia del servidor que reemplaza al optimista (mismo rol y contenido), ni el
     mensaje final que sustituye a la respuesta en streaming.
   - El registro de "ya visto" debe sobrevivir a re-montajes de `OrchestChatView` (p. ej. módulo o ref en `App.tsx`,
     por sesión). Elegir y justificar en el reporte.
   - Cada `ChatMessage` del hilo lleva `data-entered="animate"` o `data-entered="static"` según lo decidido.
   - `layout` sigue apagado salvo que se demuestre en captura que no salta durante el streaming.
3. **Transición entre estados.**
   - Pensando → respuesta en streaming → mensaje final: sin parpadeo ni salto (el contenedor no se vacía entre
     estados); el indicador "pensando" sale con fundido corto.
   - `TaskCard` al cambiar `data-task-state`: cambio en su sitio con fundido corto, sin re-montar la tarjeta.
   - Envolver el hilo en `MotionConfig reducedMotion="user"` (de `motion/react`): con `prefers-reduced-motion` todo
     es instantáneo o fundido corto. `ThreadMarkdown` ya lo respeta; no duplicar.
4. **Estado vacío.** Fuera el párrafo de relleno. Título = nombre del proyecto (o "Chat" sin proyecto); debajo, una
   línea muted con `<CLI> · <modelo>` (`cliName` y `composerModel`/`initialModel` ya existen). Entra con fundido.
   Contenedor con `data-thread-empty`. Mismo ancho que el hilo (`max-w-3xl lg:max-w-4xl`).
5. **Lámina** (`ThreadStatesSheet.tsx`, `?view=thread-states`): sumar herramientas plegadas, abiertas, con una en
   curso, con una fallida (con `result`), y el estado vacío; con los mismos componentes que el hilo real.

## Gates (`scripts/ui-gate/flows/`)
- `rg -n "Tool executions|Interactive session" scripts/ui-gate/` y actualizar **todos** los usos
  (`chat-turn-details.mjs:174,428` hoy) a `[data-thread-tools]`; `chat-turn-details` además abre la fila y comprueba
  que hay ≥1 `[data-tool-step]`.
- `thread-states`: pasos nuevos para la fila (plegada por defecto, cabecera con número y duración, color solo en
  fallida, sin mayúsculas, sin `JSON`/`{` en el objetivo) y el estado vacío (sin el párrafo viejo).
- `chat-streaming`: tras enviar, el mensaje nuevo del usuario y la respuesta tienen `data-entered="animate"` y
  ningún mensaje lleva `animate` dos veces (MutationObserver por id/posición desde antes del envío hasta el final del
  turno); tras recargar la página, todos `static`; con `reducedMotion` emulado (`page.emulateMedia`), la respuesta
  llega con opacidad 1 sin transformación en ≤ 100 ms.
- Conservar lo que leen los gates de chat: `div.prose`, `textarea`, `aria-label="Send message"`,
  `title="Select model and reasoning effort"`, "Approve & Run", "Commit & Run", "Retry", `div.max-w-2xl`,
  `div.max-w-3xl`, `[data-task-id]`, `[data-task-state]`, `[data-thread-working]`, `[data-attachment-name]`.

## Verificación (el ejecutor la corre y pega salidas; el cerebro la repite)
- `bunx tsc --noEmit`, `cd src/dashboard/app && bunx tsc --noEmit`, `bun run lint`, `bun run build:app`,
  `bun run ui:fidelity:jsx`, `bun test src/dashboard/app`.
- `bun run ui:gate thread-states chat-streaming chat-turn-details codex-live smoke`.
- Contraprueba: `thread-states` y `chat-streaming` contra `OrchestChatView.tsx` de HEAD fallan en los pasos nuevos.
- Capturas para mirar: lámina (fila plegada/abierta/fallida, estado vacío) y un turno real con herramientas.

## No tocar
`components/ui/*` (familia, se compone con props), `OrchestDevWorkspace.tsx`, Settings, backend, `api/chat.ts`
(salvo que falte un dato, y entonces decirlo), `index.css` (no crece). No commitear ni tocar `PLAN.md`/`NEXT.md`.
No `git stash`.
