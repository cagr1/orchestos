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

## Ronda 2 (cerebro, sobre capturas de la ronda 1)
1. `ThreadTools.tsx`: un paso `running` muestra check (`icon='check'` siempre). En curso → sin `icon` (el punto por
   defecto de la familia) y el título con shimmer como `ThreadThinking`; `success` = check, `failed` = x.
2. Turno real de Codex (`ls`): cabecera "1 tool · 0ms". `durationMs` 0 → `<1 ms`; nunca `0ms`.
3. Un solo formato de duración en el hilo: el de `formatElapsed` ("Thought for 8 s", con espacio). `formatDuration`
   sigue el mismo estilo: `850 ms`, `2.1 s`, `1 m 04 s`. Actualizar tests y el gate `thread-states` si lo lee.
4. **UI.24.7.1 (ítem aparte, mismo lote):** `src/run/executors/codex-app-server.ts:185-187` concatena los deltas de
   todos los `agentMessage` del turno sin separador: un turno con dos mensajes sale "…por `ls`.Hay 8 entradas…". Cuando
   el delta pertenece a un ítem distinto del anterior (`params.itemId`; si no viene, usar `item/started` de tipo
   `agentMessage`) y ya hay texto, insertar `\n\n` antes (también en `onDelta`, para que el streaming coincida).
   Test en `codex-app-server` con dos ítems. Revisar si `codex.ts` (exec) tiene el mismo defecto y arreglarlo igual.
   Verifica: test + `codex-live`.
Gates: los de la ronda 1 + `codex-live`; capturas de la lámina (herramientas) y de `chat-turn-details/tool-and-reasoning`.

## Ronda 3 (revisión `qa`, verificada con llamadas directas al registro)
Los tres fallos están en `components/thread/entrance.ts`. Cada uno lleva su test en `entrance.test.ts`, y ese test
debe fallar con el código de la ronda 2.
1. **Volver a una sesión anima el historial (`:64`).** Pasos: abrir A, cambiar a B, llega una respuesta en A, volver a
   A. Hoy `baselined` sigue en `true` y el mensaje nuevo anima. Corrección: al entrar en una sesión (cuando cambia
   `decidedSession` en `OrchestChatView`), la primera lista cargada cuenta como historial (`static`).
2. **Un hilo abierto vacío no anima su primer mensaje (`:83`).** `markEntered(s, [])` sale antes de tiempo y no
   registra que el hilo ya estaba abierto, así que el primer reporte que llega queda `static`. Corrección: separar
   "cargando" de "cargado y vacío". Buscar si `ChatThread`/`App.tsx` ya saben cuándo terminaron de cargar los
   mensajes de la sesión; si no lo saben, decir qué señal se usó. Un hilo vacío ya cargado queda con línea base.
3. **Reenviar el mismo texto tras un error no anima (`:85`).** `seen` guarda el máximo histórico, así que el
   optimista retirado sigue contando. Corrección: `seen` refleja las ocurrencias de la última lista no vacía, no un
   máximo. El reemplazo optimista → servidor ocurre en la misma actualización y sigue `static`.
Gates: los de la ronda 1, más `bun test src/dashboard/app`.
