## Archivado 2026-10-22 desde PLAN.md (DOC.4)

<a id="bloque-ui-seccion-ui-24-el-hilo-del-chat-con-acabado-premi"></a>
### UI.24 — El hilo del chat con acabado premium (CERRADO 2026-10-15: UI.24.1–24.7; abierto 2026-10-13, GO de Carlos)

Pedido de Carlos 2026-10-13: *"quiero de verdad algo mucho mejor que MusicKind … no una combinación grosera de
componentes sino … profesional, limpio, intuitivo, pero sobre todo premium"*. Cómo se ve, cómo interactúa, cómo
responde, cómo piensa. Solo presentación del hilo y del composer; la función no cambia.

**Diagnóstico** (captura `chat-retry-report/dirty-tree-report.png` del gate de ERP.4.13 y `OrchestChatView.tsx`):
- Cuatro acentos compitiendo: celeste (marca), índigo en degradado (`:423,528`), esmeralda (botones), ámbar con
  `animate-ping`. MusicKind usa uno solo sobre superficies planas con borde fino.
- Todo va en caja y con el mismo peso: respuesta, aviso de tarea, fallo y éxito son la misma burbuja.
- Una tarea ocupa 3 burbujas y repite su UUID completo 2-3 veces.
- "Pensando" es `Loader2` + `…` (`:581-586`); el streaming entra sin transición (`:571-580`); cuerpo a 12 px.
- `reasoning` y `toolCalls` ya llegan del backend (`app/src/api/chat.ts:234-254`): falta dibujarlos bien, no pedirlos.

**Referencias revisadas 2026-10-13** (texto de las páginas; la animación no se pudo ver con la herramienta):
- Planes `chat-orb` (useplanes.com): lanzador flotante de soporte, Pro, $99 pago único. No aplica: OrchestOS es chat
  a pantalla completa. Su familia de IA (Thinking Loader, Reasoning Trace, Tool Call Card, Agent Plan, Approval Card)
  sirve como referencia de comportamiento. Licencia de uso sin verificar.
- Obsidian UI (obsidianui.dev): 12 componentes, ninguno de chat. Solo referencia de lenguaje visual. Licencia sin verificar.
- AI Elements (elements.ai-sdk.dev): Apache-2.0, registro shadcn, el código se copia al repo. Tiene las piezas que
  faltan: `attachments`, `reasoning`, `shimmer`, `tool`, `task`, `confirmation`, `conversation`, `message`. Corrige
  el descarte del handoff ("muchas dependencias"): las dependencias son por componente. Sin verificar: que el
  paquete `ai` sea solo de tipos en esos archivos.
- Streamdown 2.7.0: Apache-2.0 (verificado en npm); Shiki, KaTeX y Mermaid son plugins aparte.

- Fluid Functionalism (fluidfunctionalism.com, referencia de Carlos con el GO): MIT, registro shadcn, 1 053 estrellas.
  Una familia con un solo sistema de movimiento (tres velocidades de spring, salidas más rápidas, hover que sigue al
  cursor, cambio de peso tipográfico sin mover el layout) y escalera de superficies de 8 niveles. Trae
  `chat-message`, `input-message`, `thinking-indicator`, `thinking-steps`, `card`, `badge`, `banner`, `button`,
  `tooltip`. Dependencias: `motion` (ya instalado), `@radix-ui/react-collapsible|slot|tooltip`, `class-variance-authority`
  (ya instalado). Exige alias `@/`, tokens de shadcn e Inter variable (ejes `opsz` y `wght`): el repo no tiene ninguno.

**GO de Carlos 2026-10-13:** *"busco … algo que se vea como las apps que usa Apple, incluso algo tan sencillo como
MusicKind se ve muy bien … quedas a cargo … GO"*. Con el GO quedan tomadas las cuatro decisiones: el hilo y el
composer dejan de copiar el prototipo de AI Studio (el resto de la app no cambia); entran primitivos de Radix; un
acento, el celeste de marca; UI.24 va antes de ERP.4.14–4.16 y ERP.4 se cierra al final.

**Dirección:** una sola familia, Fluid Functionalism, más Streamdown para el markdown. AI Elements queda como
segunda opción solo para una pieza que la familia no tenga; fuera prompt-kit y motion-primitives; Planes no se
compra. Reglas visuales: un acento; verde/rojo/ámbar solo como estado, nunca decoración; sin degradados ni sombras de
color; la respuesta del asistente va sin caja; el identificador técnico se copia, no se lee; el movimiento informa
(entrada, cambio de estado) y respeta `prefers-reduced-motion`. Los componentes de la familia se componen con props y
`className`, no se editan.

- [x] **UI.24.1 — 🧠 Base de la familia y lámina de estados del hilo.** (cerrado 2026-10-13; abierto 2026-10-13, GO de Carlos) Alias `@/`, puente de tokens shadcn →
  `--app-*`, Inter variable servida en local y los componentes de la familia instalados. Encima, una vista de
  desarrollo (`?view=thread-states`) que dibuja con datos fijos las piezas de la familia; cada ítem siguiente le
  añade sus estados (pensando, razonamiento, herramientas, streaming, estados de tarea, árbol sucio, adjuntos, error
  de envío) con los mismos componentes que el hilo real.
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, rondas 2 a 4) · Spec: docs/specs/UI.24.1.md
  Hecho (2026-10-13): familia Fluid Functionalism (MIT, atribución en `THIRD_PARTY_NOTICES.md`) materializada desde
  su registro en `src/dashboard/app/src/components/ui`, `lib` y 2 hooks, excluida del lint (`biome.json`) porque no
  se edita; ediciones a terceros: rutas de import, `next/link` → `a` en `card.tsx`, y `file-thumbnail.tsx` sin
  `pdfjs` (un archivo que no es imagen es una ficha con icono). Alias `@/*` en el tsconfig del front. Puente de
  tokens al final de `index.css` (los `--app-*` no cambian). Inter variable con eje `opsz` cargada en `main.tsx`,
  aplicada solo bajo `[data-ff]`. Lámina en `components/thread/ThreadStatesSheet.tsx`, sin API, con `?theme=`.
  Dependencias nuevas: `@radix-ui/react-collapsible|slot|tooltip`, `@fontsource-variable/inter`. `main.js` 1 590 184 B.
  Evidencia: `tsc` raíz y del front, `lint`, `build:app` y `ui:fidelity:jsx` exit 0, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.24.1-live.json` — `thread-states` 71/71 (los
  12 estados visibles en 4 temas, Inter cargada, escalera de superficies monótona, burbuja del usuario a ΔL* 9.72 /
  10.08 / 9.32 / 6.60 del fondo, sin errores de consola), `smoke` 6/6, `text-sweep` 10/10, `composer-picker` 5/5.
  Contraprueba: con `--accent` en `--surface-2` el paso de la burbuja falla (ΔL* 1.35).
  Límites: la lámina prueba que las piezas se dibujan, no su interacción; el hilo real no usa todavía la familia; la
  `Card` no se distingue del fondo (se diseña en UI.24.5). `scripts/ui-gate/run.mjs`: `shot()` acepta opciones.
  Hallazgo: el build rebaja `color-mix()` dentro de propiedades personalizadas a su valor de respaldo (la escalera
  llegó plana al navegador); y un contraste WCAG ≥ 1.15 sobre fondo casi negro pasa con una diferencia invisible.
  Ambos a `AGENTS.md` § Lecciones.
- [x] **UI.24.2 — 🧠 Tokens y jerarquía.** (cerrado 2026-10-13) Un acento; fuera degradados índigo, sombras de color y `animate-ping`; cuerpo
  a 14 px; respuesta del asistente sin caja, mensaje del usuario en burbuja discreta. `index.css` solo crece por el
  puente de tokens de UI.24.1.
  Ejecutado por: gpt-6-luna (rol `mecanico`, rondas 1 a 3) · Spec: docs/specs/UI.24.2.md
  Hecho (2026-10-13): el hilo real usa `ChatMessage` de la familia (usuario en burbuja, asistente sin caja, 14 px,
  copiar y hora en la fila meta); fuera `Bot`/`User`, índigo, esmeralda, ámbar, zinc, degradados, sombras de color
  y `animate-ping` de `OrchestChatView.tsx`; tarjetas de tarea planas con tokens `--app-*`, botón principal en el
  acento. Inter es la fuente de toda la app vía `--font-sans` del `@theme`; fuera Plus Jakarta Sans (dependencia,
  `@font-face` y excepción de `.impeccable`). `index.css` neto −4 líneas. `main.js` 1 587 960 B.
  Evidencia: `tsc` raíz y del front, `lint`, `build:app` y `ui:fidelity:jsx` exit 0, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.24.2-live.json` — `chat-streaming` 22/22 (5
  pasos nuevos sobre el hilo recargado: Inter computada en `body`, cuerpo 14 px, respuesta sin fondo/borde/sombra,
  burbuja del usuario a ΔL* 12.98 del fondo, 0 degradados/`animate-ping`/iconos), `codex-live` 14/14, `auto-flow`
  31/31, `chat-retry-report` 21/21, `thread-states` 71/71, `smoke` 6/6, `text-sweep` 10/10, `composer-picker` 5/5.
  Contraprueba: la ronda 1 falló `thread-font-inter` (la utilidad `font-sans` tapaba a `body { font-family }`; la
  app nunca dibujó Plus Jakarta Sans). Capturas miradas: `thread-hierarchy`, `task-inline-report`, `dirty-tree-report`.
  Límites: entrada y `layout` de `ChatMessage` apagados (`initial={false}`, `layout={false}`) hasta UI.24.7; la
  tarjeta "Task ready to run" (Approve/Reject) no salió en ninguna captura, solo la de árbol sucio; tema claro sin
  mirar en el hilo real; razonamiento y herramientas solo cambiaron de color (UI.24.3 y UI.24.7).
  Hallazgo para UI.24.4: una respuesta pedida "uno por línea" se dibuja como un solo párrafo (markdown junta los
  saltos simples); ya estaba así antes de este ítem.
- [x] **UI.24.3 — 🧠 Pensando.** (cerrado 2026-10-13) Texto con shimmer que nombra la fase real (pensando, herramienta en curso) y el tiempo;
  al terminar se pliega a "Pensó 12 s" y se abre con un clic. Datos: `reasoning` de `chat.ts:234`.
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, rondas 2 y 3) · Spec: docs/specs/UI.24.3.md
  Hecho (2026-10-13): `components/thread/ThreadThinking.tsx` compone `ThinkingSteps` de la familia; funciones puras
  en `thread/thinking.ts` con test (`livePhase`, `formatElapsed`, `thoughtMs`, `parseDbTime`). Turno en curso: fila
  sin caja con shimmer que dice `Thinking`, `Running <tool>` o `Writing` y el tiempo (reloj local, 1 tick/s), con los
  pasos de razonamiento plegados si ya los hay. Turno terminado: `Thought for N s` plegado, se abre con un clic;
  pasos en color apagado. Fuera `Loader2`, `Sparkles`, el estado `expandedReasoning` y `ui/thinking-indicator.tsx`
  (rotaba palabras inventadas). `thoughtMs` va en el mensaje del asistente (`api/chat.ts`).
  Evidencia: `tsc` raíz y del front, `lint`, `ui:fidelity:jsx` exit 0 y `bun test` de `thinking.test.ts` +
  `api/chat.test.ts` 30/0, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.24.3-live.json` — `thread-states` 87/87 (por
  tema: el plegado se abre con clic, sin palabras inventadas, fase alineada a 0 px con el texto de la respuesta,
  pasos en `muted` y peso 400), `chat-streaming` 24/24 (la fila vista en turno real dice `Thinking 0 s` y desaparece
  258 ms tras terminar), `codex-live` 14/14, `chat-turn-details` 26/26, `smoke` 6/6, `text-sweep` 10/10.
  Contraprueba: la ronda 2 falló `thinking-aligned` (4 px) y `working-indicator-gone` (contaba en el mismo instante
  en que la API cerraba el turno; ahora sondea 5 s). `codex-live` contaba `.animate-spin` para probar que el
  indicador se iba: habría pasado en vacío; ahora cuenta `[data-thread-working]`.
  Límites: la fila va debajo del texto en vivo, no encima (queda junto al composer cuando la respuesta es larga);
  ningún gate produjo un turno real con razonamiento, así que `Thought for N s` solo se vio en la lámina; el tiempo
  se cuenta desde que la vista empieza a esperar, se reinicia si se recarga a mitad de turno; `Running <tool>` no se
  vio en un turno real.
- [x] **UI.24.4 — 🧠 Respuesta en streaming.** Streamdown en lugar de `react-markdown`: entrada por palabra, markdown
  incompleto sin parpadeo, altura suave, scroll pegado al final, bloque de código con copiar. Verifica: `chat-streaming`.
  Ejecutado por: sonnet (rol `criterio`, r1) y gpt-6-luna (rol `mecanico`, r2–r6) · Spec: docs/specs/UI.24.4.md (borrado)
  (cerrado 2026-10-14) `streamdown@2.7.0` + `remark-breaks` en `components/thread/ThreadMarkdown.tsx` (`animated`,
  `isAnimating`, `mode="streaming"`, `parseIncompleteMarkdown`, `controls.code.copy`, `lineNumbers={false}`; sin
  animación con `prefers-reduced-motion`), usado en el mensaje persistido y en el texto en vivo de
  `OrchestChatView.tsx`. La fila de fase sigue debajo del texto en vivo. `index.css` suma solo la línea `@source` de
  Streamdown (la pide su README para que Tailwind genere sus clases); los estilos del bloque van como variantes en
  `CLASS_NAME`. Excepción a `components/ui/*`: `chat-message.tsx` añade `w-full` al texto del asistente (sin eso el
  bloque de código se encogía al contenido, también en el chat real). `OrchestDevWorkspace.tsx` sigue con
  `react-markdown`. r2–r6 (cerebro, mirando capturas): bloque de código con 3 marcos anidados → 1; CSS a mano con
  `!important` en `index.css` → variantes en `CLASS_NAME`; bloque encogido (causa en `ChatMessage`, y el gate medía
  contra el `div` encogido); etiqueta "ts" desalineada con el código y con el botón de copiar.
  Coste: `main.js` 1 578 045 → 1 922 927 bytes (+22 %).
  Evidencia: `typecheck`, `ui:fidelity:jsx`, `bun test components/thread` (17/17), corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.24.4-live.json` — `thread-states` 123/123 (pasos
  nuevos por tema: `single-line-breaks`, `incomplete-markdown-clean`, `code-block-copy`, `code-block-copied`,
  `code-block-single-frame`, `code-header-aligned`, `no-palette-in-thread-markdown`), `chat-streaming` 24/24,
  `codex-live` 14/14, `chat-turn-details` 26/26, `text-sweep` 10/10, `smoke` 6/6. El cerebro miró las capturas de
  la lámina y del turno real (`thread-hierarchy`).
  Contraprueba (ejecutor): sin `remark-breaks` falla `single-line-breaks` ("paragraph 1 lines, 0 <br>"); con el
  estilo de r1, 3 marcos; con `chat-message.tsx` de HEAD, el bloque ocupa 22.5 %; con r4, delta vertical 8 px.
  Límites: no se probó con texto de un turno real que traiga bloque de código (solo en la lámina).
- [x] **UI.24.5 — 🧠 Una tarjeta por tarea.** La tarea es una sola tarjeta que cambia de estado en su sitio; nombre corto
  en vez de UUID (el UUID se copia); intento, modelo y acciones (Approve, Reject, Commit & Run, Retry) dentro de la
  tarjeta; intentos anteriores plegados. Verifica: `chat-retry-report`, `chat-turn-details`, `auto-flow`.
  Ejecutado por: sonnet (rol `criterio`, r1–r2) y gpt-6-luna (rol `mecanico`, r3) · Spec: docs/specs/UI.24.5.md (borrado)
  (cerrado 2026-10-15) `components/thread/taskCards.ts` agrupa por `taskId` (ancla = primer mensaje; reportes
  posteriores ocultos; estado `held|running|failed|blocked|pending|done`) y `TaskCard.tsx` la dibuja: nombre de la
  primera línea, detalle sin repetirla, UUID solo en botón "Copy task id" y `data-task-id`, intento y modelo del último
  reporte, acciones con los mismos textos, intentos anteriores plegados con `ThinkingSteps`. `TaskReportData` suma
  campos opcionales `attempt`, `maxAttempts`, `provider`, `model`, `summary` (el `content` del reporte no cambia;
  mensajes viejos caen al texto). `App.tsx` da `taskDescription` a todo mensaje de tarea y marca `taskDeleted` si la
  tarea ya no existe y nunca reportó (r2: tras recargar, una rechazada salía "Running" y una lanzada perdía el nombre).
  Botón primario con el color de la familia (`--foreground`), igual que Settings. Gates actualizados a
  `[data-task-id][data-task-state]` en `chat-retry-report`, `chat-turn-details`, `auto-flow`.
  Evidencia: `typecheck`, `biome check` (0 errores), `build:app`, `ui:fidelity:jsx`, `bun test` thread + task-report
  (36/36), corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.24.5-live.json` — `thread-states` 259/259,
  `chat-retry-report` 24/24 (una tarjeta tras Retry, `done`, "1 earlier attempt"; la tarjeta sucia pasa a `done` en su
  sitio tras Commit & Run), `chat-turn-details` 29/29 (`rejected task has no card after reload`, `launched task keeps
  its name after reload`), `auto-flow` 32/32, `chat-streaming` 24/24, `smoke` 6/6; r3: `UI.24.5-r3-live.json`
  `thread-states` 259/259. El cerebro miró las capturas de `chat-retry-report` y la lámina.
  Contraprueba (ejecutor, r1): con `OrchestChatView.tsx` de HEAD, `chat-retry-report` falla en `held task card visible`.
  Límites: la captura `dirty-tree-report` sale a media opacidad (se toma dentro del fundido de 150 ms; en la lámina
  la misma tarjeta se ve entera). Sin estado de tarea fuera del hilo si `/api/tasks` falla al hidratar.
- [x] **UI.24.5.1 — 🧠 Gates que aún leían el texto viejo de la tarea.** (cerrado 2026-10-15; abierto 2026-10-15) El pre-push de UI.24.5
  falló en `restart-mid-run` (A: "chat shows the report after reloading the page") y `chat-roles` ("Orchestrator
  marker creates a held task"): leen "Task ready to run" y "✓ Task … done" en `div.prose`, que la tarjeta quitó.
  Pasan a leer `[data-task-id]`/`[data-task-state]`. Verifica: `restart-mid-run`, `chat-roles`.
  Ejecutado por: gpt-6-luna (rol `mecanico`) · Spec: docs/specs/UI.24.5.1.md (borrado)
  `restart-mid-run.mjs` `showChat` lee el `innerText` de `[data-task-id="<id>"]`; `chat-roles.mjs:162`
  `heldTaskLabel` = `[data-task-state="held"]`. Lección: al cambiar un texto o selector del hilo, grepear **todos**
  los flujos de `scripts/ui-gate/flows/`, no solo los que nombra el ítem (UI.24.5 actualizó 3 y dejó 2).
  Gate en vivo (cerebro): `docs/done/evidence/UI.24.5.1-live.json` — `restart-mid-run` 28/28, `chat-roles` 11/11.
- [x] **UI.24.6 — 🧠 Composer y adjuntos.** Adjuntos como fichas con vista previa y quitar; miniaturas en el mensaje
  enviado. Incluye ERP.4.14. Verifica: `composer-picker`.
  Sin delegación: ítem padre; cierra con UI.24.6a y UI.24.6b (2026-10-15).
  **Hallazgo y GO de Carlos 2026-10-15 (opción 1, "que funcione"):** el clip no adjuntaba nada: el composer nunca
  llamaba a `POST /api/chat/upload` y mandaba ids locales `att_…` que el backend descartaba. El turno CLI ya mete en el
  prompt texto/PDF y OCR de imágenes (`handlers/chat.ts:1356-1381`); las imágenes no llegan nativas (`codex exec`
  acepta `-i/--image`, sin usar). Fuera: ruta API, OpenCode, persistir el archivo más allá del TTL de 30 min, carpetas.
  - [x] **UI.24.6a — 🧠 Imágenes nativas al CLI.** Imagen → archivo en tmp del turno fuera del proyecto (se borra al
    terminar); Codex `--image <ruta>`, Claude `--add-dir <tmp>` + ruta en el prompt (Read lee imágenes); si falla,
    OCR como hoy. Tests del armado de argumentos.
    Ejecutado por: sonnet (rol `criterio`) · Spec: docs/specs/UI.24.6a.md (borrado)
    (cerrado 2026-10-15) Antes, con modelo con visión la imagen se perdía en silencio en el CLI (iba a `imageParts`,
    que el CLI no recibe). `src/chat/attachment-files.ts` (`decodeImageDataUrl`, `writeChatImages` en
    `tmpdir()/orchestos-chat-att-*`, `cleanup()` en el `finally` de cada rama CLI y en el 422). Codex `exec`:
    `--image <ruta>` (`buildCodexChatArgs`); app-server: ítem `{type:'localImage', path}` en `turn/start` (esquema
    `UserInput` de `codex app-server generate-ts`). Claude: `--add-dir <tmp>` + `Attached image: <ruta>` al final
    del prompt. Si la escritura falla, OCR/422 como antes. Ruta API sin cambios.
    Evidencia: `typecheck`, `lint`, tests de `src/chat` + `claude-chat`/`codex-app-server`/`codex-engine` (53/53),
    corridos por el cerebro. Gate en vivo: `docs/done/evidence/UI.24.6a-live.json` — `chat-streaming` 24/24,
    `codex-live` 14/14, `read-boundary` 7/7.
    Límites: la lectura real de una imagen ("ZEBRA-4417" → Codex y Claude respondieron la palabra, sin OCR) la corrió
    solo el ejecutor con un flujo desechable; la prueba durable es el gate `chat-attachments` de UI.24.6b. El tmp se
    crea en todo turno CLI aunque no haya imágenes (vacío, se borra); una excepción no capturada entre la escritura
    y el `try` del CLI lo dejaría en `/tmp`. Preflight de un sub-ítem indentado falla
    (`scripts/agent-governance.ts:37` exige `- [ ]` en columna 0).
  - [x] **UI.24.6b — 🧠 Composer que sube de verdad + fichas.** Subida al elegir/pegar/arrastrar; ficha con miniatura
    (`file-thumbnail.tsx`) y estado subiendo/listo/error (reintentar, quitar); Send deshabilitado mientras sube;
    miniaturas en el mensaje enviado; ERP.4.14; sacar `AgentComposer.tsx` de `ui:fidelity:jsx`. Gate nuevo
    `chat-attachments` (Codex real: `.txt` con token aleatorio + imagen con texto → la respuesta trae ambos;
    contraprueba con el composer de HEAD) + `composer-picker` + gates de chat.
    Ejecutado por: sonnet (rol `criterio`), 3 rondas · Spec: docs/specs/UI.24.6b.md (borrado)
    (cerrado 2026-10-15) `uploadChatFile` (`api/chat.ts`); `sendMessage` manda solo `fileId` del servidor. Composer:
    `addFiles` único para clip/pegar/soltar, subida inmediata, tope 5, ficha `FileThumbnail` con subiendo/error/
    "Retry upload"/quitar (aborta), Send deshabilitado si sube algo o solo hay fichas en error. Mensaje enviado con
    miniaturas en Chat y Dev; `mergeAttachments.ts` + ref por sesión en `App.tsx` los devuelve tras cada recarga de
    mensajes (no se persisten: tras recargar la página no se ven). `file-thumbnail.tsx`: la revocación del blob se
    difiere 3 s; causa vista con traza: el hilo de Chat re-monta la miniatura ~16 veces por turno y cada ciclo revocaba
    la URL (spinner eterno en la captura de la ronda 2; el spinner permanente con el código viejo no se reprodujo de
    nuevo). Ronda 2 y 3 del cerebro: fusión en orden inverso, envío vacío con fichas en error, gate sin pasada Chat,
    gate que leía la respuesta a medio pintar.
    Evidencia (cerebro): `typecheck`, `lint` 0 errores, `bun test src/dashboard/app` 91/91, `build:app`,
    `ui:fidelity:jsx`. Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.24.6b-live.json` — `chat-attachments` 14/14 (Dev y Chat;
    Codex respondió `ATT-637E5833 — COMPASS GLACIER`), `composer-picker` 5/5, `chat-streaming` 24/24, `codex-live`
    14/14, `chat-continuity` 8/8. Capturas Dev/Chat miradas. Contraprueba: `chat-attachments` contra el composer de
    HEAD (worktree temporal, borrado) → `FAIL Dev: both attachments reach ready: []`.
    Límites: `chat-attachments` no entra al pre-push; prompt del gate dice "reference code" (Codex rehusó una vez
    "secret token").
- [x] **UI.24.7 — 🧠 Herramientas y movimiento.** (cerrado 2026-10-15) Llamadas a herramientas en una fila plegable ("3 herramientas · 2,1 s");
  entrada de mensajes y transición entre estados; estado vacío. Revisión final por `qa` sobre capturas contra esta
  dirección.
  Ejecutado por: sonnet (rol `criterio`, 3 rondas) · Spec: docs/specs/UI.24.7.md (borrado) · Revisión: `qa` (codex)
  Hecho: `ThreadTools.tsx` (fila plegada "3 tools · 3.1 s", color solo si falla, objetivo legible en vez de
  `JSON.stringify`, `result` a 4 líneas, `data-thread-tools`/`data-tool-step`); `entrance.ts` decide la entrada: un
  mensaje anima una vez al aparecer en un hilo abierto; historial, re-montaje, reemplazo optimista→servidor y final
  tras streaming quedan `static` (`data-entered`); registro de módulo por sesión, `enterSession` al volver, señal
  `ChatThread.messagesLoaded` para distinguir "cargando" de "vacío". `MotionConfig reducedMotion="user"`, "pensando"
  sale con fundido; `ThreadEmpty` (proyecto + `CLI · modelo`, fuera el párrafo). Duraciones con un solo formato
  (`<1 ms`, `2.1 s`, `1 m 04 s`).
  Evidencia (cerebro): `tsc` raíz y front, biome 0 errores, `bun test` app + codex-app-server 111/111, `build:app`,
  `ui:fidelity:jsx`. Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.24.7-live.json` —
  `thread-states` 311/311, `chat-streaming` 28/28 (entrada `animate` una sola vez, `static` tras recargar, reduced
  motion), `chat-turn-details` 29/29, `codex-live` 14/14, `smoke` 6/6, `chat-retry-report` 24/24, `auto-flow` 32/32,
  `chat-continuity` 8/8. Capturas miradas: lámina (herramientas) y turno real de Codex.
  Contraprueba (ejecutor): `chat-streaming` contra el `OrchestChatView.tsx` de HEAD → `FAIL new messages enter with
  data-entered=animate`; `thread-states` contra la lámina de HEAD → `FAIL state-tools-collapsed`.
  Revisión `qa` (otro proveedor): 3 fallos de `entrance.ts` (volver a sesión animaba, hilo vacío no animaba, reenvío
  tras error no animaba), corregidos en la ronda 3 con un test cada uno. La ronda 2 corrigió lo que vio el cerebro
  en las capturas: herramienta en curso con check y "0ms".
  Límites: `layout` de `ChatMessage` sigue apagado; la entrada no se probó con un reporte de tarea que llega solo
  en vivo (solo en el test unitario).
  - [x] **UI.24.7.1 — 🧠 Mensajes de Codex pegados.** (abierto 2026-10-15; visto en la captura `tool-and-reasoning`
    de UI.24.7) `codex-app-server.ts:185-187` concatena los deltas de todos los `agentMessage` del turno sin separador
    ("…por `ls`.Hay 8 entradas…"). Separar ítems con `\n\n`. Verifica: test + `codex-live`.
    Ejecutado por: sonnet (rol `criterio`) · (cerrado 2026-10-15) Separador `\n\n` cuando el delta cambia de `itemId` o
    tras `item/started` de `agentMessage`, igual en `onDelta`; `codex.ts` (exec) ya unía con `\n\n` (`:366`).
    Evidencia: `codex-app-server.test.ts` 7/7 (test nuevo con dos ítems), `codex-live` 14/14.

Fuera de esta pasada: Settings, modo Dev, barra lateral, backend, Chat Orb.


<a id="bloque-ui-seccion-ui-25-settings-con-la-familia-fluido-y-d"></a>
### UI.25 — Settings con la familia: fluido y definido (CERRADO 2026-10-13: UI.25.0 y UI.25.1; UI.25.2–25.4 pasan a UI.26)

Pedido de Carlos 2026-10-13: *"no busco tanto el color sino su comportamiento, su look … OrchestOS no tiene una UI
amigable o bien definida, hay colores dispersos, mira Settings, arregla que quede como dije, fluido y premium"*. El
tema por defecto **no cambia** (decisión de Carlos en el mismo mensaje). Con el GO, Settings deja de quedar "fuera de
esta pasada" de UI.24 y entra a la familia Fluid Functionalism; UI.25 va antes de UI.24.4.

**Diagnóstico** (dashboard real mirado por el cerebro en el navegador, 2026-10-13, y `OrchestSettingsView.tsx`):
- 2 838 líneas en un componente, 0 imports de `components/ui`: la familia instalada en UI.24.1 solo la usa el hilo.
- 9 familias de color de Tailwind escritas a mano (emerald 49, zinc 31, rose 28, sky 4, amber 3, teal, purple, indigo,
  blue); cada icono de la barra lateral tiene un color distinto sin significado.
- Tres botones distintos para guardar; `font-mono` 43 veces (etiquetas, campos, desplegables, badges).
- Cada fila es una tarjeta con borde; columna de ~720 px pegada a la izquierda; proyecto a ancho completo.
- Model routing: 3 desplegables apilados por rol sin etiqueta. Sin hover ni transiciones de la familia.
- "Loading live settings…" se dibuja encima del título (`:924-926`); en proyecto, cada tarea repite su texto y parte
  el UUID en 5 líneas.

**Referencias miradas en navegador 2026-10-13** (antes solo se leyeron como texto): fluidfunctionalism.com,
elements.ai-sdk.dev, onorca.dev y los tokens de MusicKind (`web/src/index.css`). Patrón común: separación por nivel
de superficie y no por línea, un acento escaso, color solo como estado, monoespaciada solo para lo técnico, filas
planas con hover. Planes y Obsidian UI no siguen el patrón y no guían.

**Reglas de UI.25:** una columna centrada de ancho único para todas las secciones; grupo = una superficie con filas
separadas por línea fina (etiqueta a la izquierda, control a la derecha); un botón primario por sección; verde, rojo y
ámbar solo como estado, por token `--app-*`, nunca por paleta de Tailwind; `font-mono` solo en rutas, claves, ids de
modelo y cifras; el movimiento es el de la familia y respeta `prefers-reduced-motion`. No cambia qué opciones
existen, ni la lógica, ni el backend, ni los `--app-*`.

- [x] **UI.25.1 — 🧠 Primitivos de Settings + piloto (General y Executor).** (cerrado 2026-10-13) `components/settings/primitives.tsx`
  compuesto con la familia; General y Executor migradas.
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, ronda 2) · Spec: docs/specs/UI.25.1.md
  Hecho (2026-10-13): `SettingsPage` (columna centrada `max-w-3xl`, `data-ff`, entrada con fundido de 150 ms),
  `SettingsGroup` (una superficie, filas con línea fina), `SettingsRow`, `SettingsSegmented` (radiogroup con indicador
  que se desliza), `SettingsStepper` y `SettingsPrimaryAction` (redefine `--foreground` a `--app-accent` para que el
  `Button` primario de la familia salga celeste sin editarlo). General: temas como `Card` con `selected`. Executor: un
  grupo con Timeout, Mode y Max iterations (fila condicional en modo agentic). "Loading live settings…" pasa a la
  esquina superior derecha y deja de tapar el título.
  Evidencia: `typecheck`, `lint` (0 errores), `build:app`, `ui:fidelity:jsx` exit 0 y 0 clases de paleta de Tailwind ni
  `font-mono` nuevas salvo el hex del tema, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.25.1-live.json` — `smoke` 6/6, `chat-roles`
  11/11, `model-routing` 18/18. Además el cerebro miró Executor y General en el dashboard real (tema por defecto) y
  probó los controles: + sube el timeout 20→25, Agentic revela la fila Max iterations.
  Contraprueba: la ronda 1 pasó los tres gates con tres defectos visibles que solo se vieron mirando la pantalla:
  botones − / + sin icono (`Button` de solo icono dibuja `children`, no `leadingIcon`), línea entre filas del color
  del texto (`[&>*+*]:border-app/40` no genera color) y primario blanco.
  Límites: solo se miró el tema por defecto (los otros 3 no); ningún gate automático afirma el look de Settings — la
  ronda 1 lo demuestra — así que UI.25.3 suma un flujo `settings-look` (iconos presentes, color de divisor, primario
  en acento, 0 paleta a mano). "Loading live settings…" tarda varios segundos en irse: sin diagnosticar.
- [x] **UI.25.0 — 🔍 Specs deja la app en negro si el proyecto no tiene specs.** (cerrado 2026-10-13; abierto 2026-10-13, visto por el
  cerebro en el dashboard real) `SpecsView.tsx:32` hace `useState(specs[0])` y `:128` lee `selectedSpec.title`: con
  `specs = []` lanza `Cannot read properties of undefined (reading 'title')` y React desmonta toda la app.
  `project-tabs` no lo ve porque siembra un spec antes de abrir la pestaña. Spec: docs/specs/UI.25.0.md
  Ejecutado por: gpt-6-luna (rol `mecanico`)
  Hecho (2026-10-13): la selección guarda el id y cae al primero; sin specs, el panel derecho es `EmptyState` "No specs
  yet". `project-tabs` abre Specs antes de sembrar el spec y afirma el estado vacío y 0 `pageerror`.
  Evidencia: `typecheck` exit 0, corrido por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.25.0-live.json` — `project-tabs` 26/26.
  Contraprueba: con `SpecsView.tsx` sin el arreglo, `project-tabs` falla en `specs empty state visible`.
UI.25.2 a UI.25.4 pasan a UI.26 (GO de Carlos 2026-10-13).

Fuera de esta pasada: tema y paleta, backend, modo Dev, shell principal (cabecera y barra lateral del chat).


<a id="bloque-ui-seccion-ui-26-la-forma-de-gr8r-en-toda-la-app-ab"></a>
### UI.26 — La forma de Gr8r en toda la app (ABIERTO 2026-10-13, GO de Carlos 2026-10-13)

Pedido de Carlos 2026-10-13, con gr8r-taskmanagement.vercel.app abierto: *"quiero que orchestos se vea así pero no
por los colores, hablo del diseño y forma"*. Señaló además: letra distinta al salir de General, texto repetido en
Tasks, Graph con otro color, Specs que no se ve (UI.25.0, cerrado), Memory vacía, colores combinados en Instincts y
Plan. Absorbe UI.25.2–25.4. El tema y sus `--app-*` no cambian.

**Medido en Gr8r por el cerebro (navegador, 2026-10-13):** una sola letra (Geist) — cuerpo 13,5 px, navegación
12,5 px/500, título 19 px/600, rótulo de sección 11 px/600 en muted; barra lateral de 252 px más oscura que el
contenido (#151514 contra #1d1d1c) y sin línea entre ambos; cabecera de 46 px con ruta, buscador ⌘K y "New"; filas
planas sin caja; color solo en el punto de estado; maestro-detalle con estado vacío.

**Medido en OrchestOS:** paleta de Tailwind a mano por vista (Plan 180 usos/5 familias, Instincts 83/7, Specs 74/5,
Memory 66/5, Skills 46/4, Graph `ContextView` 46/4 en zinc, por eso "otro color"); `font-mono` en la interfaz (39 en
Settings, 22 en Runs, 16 en Plan…); iconos de la barra de Settings en 7 colores; Tasks repite la descripción cuando
la tarea no tiene título (`OrchestSettingsView.tsx:2474,2493`); Memory vacía porque nada la escribe (ERP.4.16).

**Reglas:** las de UI.25 más: filas de 28 px sin borde ni sombra, activo = fondo `app-surface`; iconos en un tono
(muted, activo `app`); el contenido es un panel más claro que barra y cabecera, sin líneas entre ellos; ningún color
de paleta de Tailwind en lo migrado; `font-mono` solo en código, rutas, ids y cifras de tabla. Fuera: modo Dev y los
archivos fijados por `ui:fidelity:jsx` (`OrchestDevWorkspace`, `ShellStatusBar`, `AgentComposer`).

- [x] **UI.26.1 — 🧠 Marco: cabecera, barras laterales y panel.** (cerrado 2026-10-13) Spec: docs/specs/UI.26.1.md
  Ejecutado por: sonnet (rol `criterio`)
  Hecho (2026-10-13): columna principal como panel `bg-app-surface` con esquina redondeada; barra y cabecera en
  `bg-app-bg` sin líneas; filas de 28 px sin borde ni sombra, activo por fondo; iconos de navegación en un tono (solo
  el punto de Health en `app-success`); rótulos "Chats", "Projects", "Workspace"… sin mayúsculas forzadas; ruta de la
  cabecera en sans. 0 clases de paleta en cabecera y barras. Flujo nuevo `shell-look`.
  Evidencia: `typecheck`, `ui:fidelity:jsx` exit 0, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.1-live.json` — `shell-look` 12/12, `smoke` 6/6,
  `project-isolation` 14/14, `project-tabs` 26/26, `model-routing` 18/18, `chat-roles` 11/11, `thread-states` 87/87,
  `text-sweep` 10/10. El cerebro miró Chat/Dev y Settings en el dashboard real (tema por defecto).
  Contraprueba: con `ShellSidebar.tsx` sin el cambio, `shell-look` falla en `sidebar rows flat`.
  Límites: la cabecera interna del chat (`OrchestChatView.tsx:255`) sigue con `bg-app-bg` y `border-b` (banda oscura
  dentro del panel) → UI.26.2; el switch Chat|Dev copia las clases de `SettingsSegmented` sin reutilizarlo (los flujos
  lo buscan por rol `button`); solo tema por defecto mirado.
- [x] **UI.26.1a — 🔍 `chat-streaming` falla tras UI.26.1 (pre-push rojo).** (cerrado 2026-10-13; abierto 2026-10-13) El flujo toma
  `document.querySelector('[data-ff]')` como raíz del hilo (`chat-streaming.mjs:501`); UI.26.1 puso `data-ff` en la
  barra lateral, que va antes en el DOM, y `thread-body-14px` da `font-size=null`. UI.26.1 no corrió `chat-streaming`.
  Spec: docs/specs/UI.26.1a.md
  Ejecutado por: gpt-6-luna (rol `mecanico`)
  Hecho (2026-10-13): el hilo lleva `data-thread-root` y el flujo lo usa como raíz; no hay otros selectores `[data-ff]`
  en `scripts/ui-gate/`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.1a-live.json` — `chat-streaming` 24/24,
  `thread-states` 87/87, `shell-look` 12/12.
  Lección: un cambio de marco toca todas las pantallas; antes de cerrarlo correr la batería completa del pre-push, no
  una selección de flujos.
  El pre-push también lo frenó `lint` (formato del JSX): la verificación de un spec incluye `bun run lint`.
- [x] **UI.26.2 — 🧠 Plantilla de página.** (cerrado 2026-10-14) Encabezado, franja de cifras y estado vacío como
  primitivos de la familia; consumidores: cabecera y pestañas de proyecto, Runs y cabecera interna del chat. La fila de
  lista pasa a UI.26.3 con su primer consumidor. Spec: docs/specs/UI.26.2.md
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, rondas 2 y 3)
  Hecho (2026-10-14): `components/layout/page.tsx` con `PageHeader` y `StatStrip`; `SettingsPage` usa `PageHeader`;
  `EmptyState` sin caja, icono muted y primario de la familia (fuera `text-zinc-950`). Cabecera de proyecto plana con
  pestañas de 28 px sin borde; Runs con franja de cifras (pista "N/M evaluated" con tono solo si es estado), filtros
  con `SettingsSegmented`, filas de 40 px sin `font-mono` salvo ids y modelo; cabecera del chat sin banda.
  Evidencia: `lint` sin errores en lo tocado, `build:app`, `ui:fidelity:jsx` exit 0, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.2-live.json` — `shell-look` 16/16, `smoke` 6/6,
  `project-tabs` 26/26, `project-isolation` 14/14, `runs-graph` 16/16, `tasks` 23/23, `chat-streaming` 24/24,
  `thread-states` 87/87, `text-sweep` 10/10. El cerebro miró Runs y el chat en el dashboard real (tema por defecto).
  Contraprueba (repetida por el cerebro sin `git stash`, árbol limpio): con `RunsEvidenceView.tsx` de HEAD,
  `shell-look` falla esperando `[data-stat-strip]`; restaurado, 16/16.
  Ronda 3: mirando la pantalla, el UUID de Run ID se partía en 4 líneas dentro de la fila de 40 px y las filas se
  montaban; ningún gate lo veía. Celdas `whitespace-nowrap`, Run ID truncado con `title`.
  Límites: solo tema por defecto; la caja "Zona de peligro" al pie de la página de proyecto sigue con su forma vieja
  (→ UI.26.6).
- [x] **UI.26.3 — 🧠 Tasks en lista con detalle.** (cerrado 2026-10-14) Nombre corto, agente y hora por fila; detalle
  al pulsar; fuera el texto duplicado y el UUID partido. Spec: docs/specs/UI.26.3.md
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, ronda 2)
  Hecho (2026-10-14): `/api/tasks` gana `lastRunAt` (`created_at` del run de la tarea; una sola función de fila para
  `loadTaskRows` y `handleApiTasks`). `ListRow` en `layout/page.tsx`; cada tarea es una fila de 40 px con punto de
  estado (único color), id en mono de ancho fijo, título (o primera línea de la descripción), "agente · modelo · hora"
  y Run + etiqueta de estado sin píldora. `TaskDetailPanel`: panel fijo a la derecha como Gr8r (Esc o X cierran),
  propiedades, motivo del reintento, descripción solo si difiere del título, criterios. `statusLabel()` exportado de
  `StatusBadge`. Fuera la paleta en la pestaña (Orquestación y "Loading project data…").
  Evidencia: `typecheck`, biome sin errores en lo tocado, `build:app`, `ui:fidelity:jsx`, `tasks.test.ts` 7/7 con la
  identidad git del pre-push (1 fallo solo con la identidad global del Mac, el caso ERP.4.13 sin identidad), corridos
  por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.3-live.json` — `tasks` 28/28 (4 pasos nuevos:
  filas planas, sin paleta, detalle abre y cierra, descripción sin duplicar), `project-tabs` 26/26, `qa-negative`
  25/25, `shell-look` 16/16, `smoke` 6/6, `runs-graph` 16/16, `text-sweep` 10/10. El cerebro miró lista y detalle en el
  dashboard real (tema por defecto).
  Contraprueba: con `OrchestSettingsView.tsx` de HEAD, `tasks` falla esperando `[data-task-row]` (hecha por el ejecutor
  con copia en /tmp y `cmp`).
  Ronda 2: mirando la pantalla, la columna del id medía 93 o 112 px y los títulos no alineaban; ningún gate lo veía.
  Incidente: el ejecutor de la ronda 1 volvió a correr `git stash` (y `pop`) pese a la regla de AGENTS.md; no se perdió
  nada. La regla escrita no basta: va a NEXT.md como propuesta de bloqueo mecánico.
  Límites: solo tema por defecto; el panel no atrapa el foco.
- [x] **UI.26.4 — 🧠 Plan (tablero) e Instincts.** (cerrado 2026-10-14) Columnas y tarjetas sin color de decoración;
  incluye la Zona de peligro de la página de proyecto. Spec: docs/specs/UI.26.4.md
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, rondas 2-4)
  Hecho (2026-10-14): 0 clases de paleta en `PlanBoardView.tsx` (eran 180) e `InstinctsView.tsx` (83). Kanban con
  columnas sin caja (punto de estado + nombre + contador), tarjetas `bg-app-elevated` sin borde; Instincts con
  rótulos neutros, insignias como texto y confianza en acento. Raíces sin fondo propio. La pestaña abierta ocupa el
  alto visible y la Zona de peligro (`data-danger-zone`, tokens `app-error`) queda al final del scroll. Los selectores
  Kanban | PLAN.md | Table y Active | Review siguen siendo `<button>` con las clases del segmentado (los flujos los
  buscan por rol `button`).
  Evidencia: `typecheck`, biome sin errores en lo tocado, `build:app`, `ui:fidelity:jsx`, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.4-live.json` — `project-tabs` 30/30 (4 pasos
  nuevos), `project-delete` 11/11, `plan-doc` 15/15, `tasks` 28/28, `shell-look` 16/16, `smoke` 6/6, `text-sweep`
  10/10, `project-isolation` 14/14. El cerebro miró Plan e Instincts en el dashboard real (tema por defecto).
  Contraprueba: con `PlanBoardView.tsx` de HEAD, `project-tabs` falla en `plan no palette` (por la raíz sin
  `data-plan-view`, no por la paleta: contraprueba débil).
  Rondas 2-4: la aserción de "tablero ocupa la vista" comparaba con el viewport y no con el área con scroll; "Sin
  proyecto (histórico)" quedó fundida con el `·` y `project-isolation` no la encontraba; mirando la pantalla, "Add
  task", "Run", "Approve", "Reject" y el botón de `EmptyState` (de UI.26.2) apilaban el icono sobre el texto: el
  `Button` de la familia recibe `leadingIcon={Icono}` y el texto como hijo; solo el botón de solo icono lo lleva de hijo.
  Visto al cerrar: `tasks` intermitente en batería → CI.23, antes del siguiente ítem.
  Límites: solo tema por defecto; el punto "running" usa `app-accent` (no hay token de "en curso").
- [x] **UI.26.4a — 🔍 Líneas del marco y cabecera de Tasks (observación de Carlos 2026-10-14).** (cerrado 2026-10-14) Sin línea sobre el
  composer (Dev y Chat); la línea bajo las pestañas del aside derecho a la altura de la del header de Dev (h-11 vs
  h-10); la lista de Tasks con nombres de columna alineados a las celdas. Spec: docs/specs/UI.26.4a.md
  Ejecutado por: mecanico (delegate). Evidencia (cerebro): typecheck, biome 0 errores.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.4a-live.json` — `tasks` 29/29 (paso nuevo `task list header aligned`), `shell-look` 19/19 (`composer no top line`, `inspector line
  aligned`), `smoke` 6/6, `chat-streaming` 24/24, `project-tabs` 30/30. En vivo (dashboard 4242): header de Dev y
  pestañas del aside con `bottom` = 84 px ambos, composer `border-top` 0; cabecera ID/Task/Agent/Status alineada en
  `erp-piloto`. Contraprueba débil: con `page.tsx` de HEAD el build falla (falta `ListHeader`), no llega al paso.
- [x] **UI.26.4b — 🔍 `ui:fidelity:jsx` rojo desde UI.26.4a.** (abierto 2026-10-14) `a9d5736` quitó a propósito la
  línea sobre el composer (`border-t border-app`, `OrchestDevWorkspace.tsx`) sin registrar la excepción: el comparador
  da 2 faltantes (plantilla 187 y 392). Visto al verificar LIMP.1.
  Ejecutado por: mecanico (delegate) · Spec: docs/specs/UI.26.4b.md
  (cerrado 2026-10-14) Dos excepciones en `scripts/ui-fidelity/jsx-allow.json` con motivo UI.26.4a; ningún `.tsx`
  tocado. Evidencia (cerebro): `ui:fidelity:jsx` exit 0, lint verde.
- [x] **UI.26.5 — 🧠 Memory, Specs, Skills y Graph.** (cerrado 2026-10-14) Maestro-detalle con estado vacío; Memory se llena con ERP.4.16.
  Ejecutado por: sonnet (rol `criterio`, r1) y gpt-6-luna (rol `mecanico`, r2) · Spec: docs/specs/UI.26.5.md
  Hecho (2026-10-14): 0 clases de paleta en `ContextView.tsx` (eran 46), `MemoryView.tsx` (66), `SpecsView.tsx` (74) y
  `SkillsView.tsx` (46); `font-mono` 2/6/6/2 (eran 8/7/10/6), solo en ids, rutas y comandos. Raíces sin fondo propio
  (`data-view`). Memory y Skills en filas planas con `EmptyState` ("No memory yet", "No skills yet"); Skills conserva
  "Recompile" por fila (`data-skill-row`, `project-isolation.mjs:328` lo usa). Specs: lista + detalle a todo el alto.
  Graph: selector `<button>` con las clases de `SettingsSegmented` (`runs-graph.mjs:241` lo busca por rol `button`).
  r2 (cerebro, mirando las capturas): el contenido iba centrado en `mx-auto max-w-4xl` y no alineaba con la cabecera;
  ahora todo arranca en el mismo borde (paso `content aligned with header`).
  Evidencia: `typecheck`, `ui:fidelity:jsx`, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.5-live.json` — `project-tabs` 39/39 (pasos
  nuevos: `<vista> no palette`, `tab roots transparent`, `content aligned with header`), `runs-graph` 16/16,
  `project-isolation` 14/14, `shell-look` 19/19, `smoke` 6/6, `text-sweep` 10/10. El cerebro miró las capturas de las
  cuatro vistas (tema por defecto).
  Contraprueba: con `SpecsView.tsx` de HEAD falla `specs no palette` por la raíz sin `data-view` (débil, como en
  UI.26.4); con `MemoryView.tsx` de r1 falla `memory content aligned with header`.
  Límites: solo tema por defecto.
  Verificado en vivo 2026-10-14 (tema `light` real): la tarjeta de Graph sigue `bg-zinc-900/60` + `border-zinc-800`
  en los 4 temas; la paleta fija también está en `MemoryView` (27), `SpecsView` (26), `ContextView` (26) y
  `SkillsView` (17 clases). Pasan a tokens `app-*`.
  Lo que Carlos señala (tema `orchestos`, 2026-10-14): la raíz de `ContextView.tsx:20`, `SpecsView.tsx:45` y
  `SkillsView.tsx:52` es `bg-zinc-950` (casi negro neutro) sobre `bg-app-surface` (#0e1320, azul marino): toda el área
  de contenido se ve con otro fondo. La raíz debe ser transparente/`app-surface` como Tasks.
- [x] **UI.26.6 — 🧠 Resto de Settings.** (cerrado 2026-10-14) Health, API & Models, Model routing, Usage, Danger zone, Language con los
  primitivos de UI.25.1.
  Observación de Carlos 2026-10-14: Usage y Model routing (y las demás vistas con `max-w-3xl`,
  `OrchestSettingsView.tsx:1024,1155,1349,1930,2142,2175`) no ocupan el ancho disponible; deben llenarlo.
  Ejecutado por: sonnet (rol `criterio`, r1) y gpt-6-luna (rol `mecanico`, r2) · Spec: docs/specs/UI.26.6.md (borrado)
  Hecho (2026-10-14): `SettingsPage` sin `mx-auto max-w-3xl` (todas las secciones a todo el ancho); 0 clases de paleta
  en las 6 secciones; `font-mono` solo en claves, URL e ids/cifras de Usage. Fuera de los primitivos, con tokens:
  filas de clave y URL (input + botón en dos líneas), tarjetas de rol (2 columnas desde `lg`, `data-role-card`; el
  flujo `model-routing.mjs` pasó a ese selector), Task rules, KPI/heatmap/tabla de Usage. Save de Model routing pasó
  a `SettingsPrimaryAction`. r2 (cerebro, mirando la captura): los inputs de clave arrancaban 12 px más adentro que
  el de Ollama URL (el `span` enmascarado vacío + `gap-3`); ahora el `span` solo se pinta con clave y los 4 inputs
  son `w-full max-w-sm`.
  Evidencia: `typecheck`, `build:app`, `ui:fidelity:jsx`, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.6-live.json` — `shell-look` 27/27 (pasos
  nuevos: `settings <sección> no palette` ×6, `settings fills width` en Usage y Model routing), `model-routing`
  18/18, `usage-bar` 18/18, `smoke` 6/6, `project-delete` 11/11, `project-tabs` 39/39, `chat-roles` 11/11,
  `orchestration` 7/7. El cerebro miró las capturas de Usage, Model routing y API & Models (1440×900).
  Contraprueba (ejecutor): con `OrchestSettingsView.tsx` y `primitives.tsx` de HEAD fallan `no palette` en API, Model routing,
  Usage y Danger zone, y los 2 `fills width` (768 px de 1184 px).
  Límites: solo tema por defecto; el heatmap de Usage ocupa ~2/3 del ancho (celdas fijas) — se rehace en UI.26.6b
  (`activity-heatmap`).
- [x] **UI.26.6.1 — 🧠 Formato de UI.26.6.** (cerrado 2026-10-14) `biome format` de `OrchestSettingsView.tsx` y de las evidencias
  `UI.26.5-live.json`/`UI.26.6-live.json`: `12eae7f` llegó a remoto sin formatear porque el lint del pre-push lee el
  árbol, no el commit. Lección en `AGENTS.md` § "Lecciones operativas".
  Sin delegación: formato mecánico (`bunx biome format --write`), solo espacios; `bun run lint` sin errores.
  Gate en vivo: navegador real (Playwright), la misma de UI.26.6 (`docs/done/evidence/UI.26.6-live.json`); el
  formato no cambia comportamiento.
- [x] **UI.26.6b — 🧠 Movimiento de Arc UI en Settings.** `settings-command`, `api-keys` y `activity-heatmap` (ver
  "Movimiento" abajo), separados de UI.26.6 para que la forma se cierre y verifique sola.
  GO de Carlos 2026-10-21, en este orden, un sub-ítem cada uno; solo movimiento con `motion` (sin color ni estructura
  nueva); `prefers-reduced-motion` = instantáneo; cada uno con gate en vivo (Playwright + captura).
  (cerrado 2026-10-21) Sus tres sub-ítems cerrados.
  Sin delegación: padre; el trabajo y su evidencia están en UI.26.6b.1–3.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.6b.3-live.json` (`shell-look` 47/47, cubre los tres).
- [x] **UI.26.6b.1 — 🧠 Heatmap de Usage con movimiento y a todo el ancho.** Celdas que entran en ola, tooltip que se
  desliza entre celdas, total que cuenta hasta el valor nuevo; el heatmap ocupa todo el ancho (hoy ~2/3, celdas fijas).
  (cerrado 2026-10-21) Rejilla de 53 columnas `minmax(8px,1fr)`; un solo tooltip `motion` que se mueve entre celdas
  (sin `title`); total con `animate()`. r2 (gate del cerebro): con reduced motion el heatmap quedaba vacío
  (`useAnimationControls` → celdas declarativas) y las etiquetas de mes se desplazaban por parsear `YYYY-MM-DD` en UTC.
  r3: `useReducedMotion` de `motion` no ve el cambio de la media query en vivo → `hooks/use-prefers-reduced-motion.ts`
  (extraído de `ThreadMarkdown.tsx`, que ahora lo importa).
  Ejecutado por: gpt-6-sol (rol `criterio-alt`, r1–r2), gpt-6-luna (rol `mecanico`, r3) · Spec: docs/specs/UI.26.6b.1.md
  Evidencia (cerebro): typecheck raíz y app, lint, build; capturas `heatmap-usage` y `heatmap-reduced-motion` miradas.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.6b.1-live.json` (`shell-look` 31/31:
  `heatmap fills width` 1102/1102 px, `heatmap tooltip slides` mismo nodo, `heatmap total`, `heatmap reduced motion`).
  Límite: los datos del gate tienen 0 ejecuciones; las celdas con color no se ejercitaron en vivo.
- [x] **UI.26.6b.2 — 🧠 API keys con movimiento.** "Create key" se despliega en su formulario; la clave nueva entra
  deslizando; el secreto se muestra una sola vez.
  (cerrado 2026-10-21) Por proveedor, el botón ("Save key"/"Replace key") se despliega en su sitio en un formulario
  (Enter guarda, Escape cancela); la clave enmascarada entra deslizando. Fuera: el `<input>` suelto de cada fila, que no
  guardaba nada (`handleSaveKey` no tenía llamador), y el modal. "El secreto una vez" no aplica: las claves las pega el
  usuario. r3 (gate del cerebro): la carga inicial de Settings borraba la clave que se estaba escribiendo (`newKey: ''`
  al resolver chequeos lentos) → conserva `newKey` como `refreshSettings`.
  Ejecutado por: gpt-6-sol (rol `criterio-alt`, r1), gpt-6-luna (rol `mecanico`, r2–r3) · Spec: docs/specs/UI.26.6b.2.md
  Evidencia (cerebro): build y typecheck; captura `api-keys` mirada (clave conservada, toast de rechazo visible).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.6b.2-live.json` (`shell-look` 35/35:
  `api key form unfolds`, `api key rejected` con rechazo real del proveedor y la clave conservada 6 s después,
  `api key cancel`).
  Límite: el guardado con éxito (clave real) no se puede ejercitar en el gate: el servidor valida contra el proveedor.
- [x] **UI.26.6b.3 — 🧠 Buscador de Settings que crece a paleta.** Buscador → paleta (posición, tamaño y radio en un
  spring), al elegir lleva a la fila y la ilumina; resaltado de sección activa que se desliza; barra de cambios sin
  guardar que nace de una píldora, cuenta y pasa a "Settings saved".
  (cerrado 2026-10-21) El buscador del sidebar no filtraba nada (`searchQuery` sin uso): ahora un índice de filas por
  sección alimenta la paleta (⌘K, ↑/↓, Enter, Escape) y al elegir se navega a la fila `data-settings-anchor`, que se
  ilumina. Fondo de sección activa con `layoutId` y `aria-current="page"`. Barra de cambios sin guardar para Model
  routing y Executor (cuenta contra una línea base, Discard/Save, píldora "Settings saved"), que reemplaza sus botones
  Save. Fuera: el banner verde `savedBanner` (repetía el toast), el botón "View" de Health (solo decía "Saved"), los
  toasts de "aplicado" de Executor (contradecían la barra); los toasts de error ya no usan el punto verde. Rondas del
  cerebro: r2 `aria-current` para el chequeo de iconos; r3 el morph estiraba el texto y la paleta era translúcida (solo
  la superficie hace el morph; gate con muestras a 60/120/200 ms); r4 toasts.
  Ejecutado por: gpt-6-sol (rol `criterio-alt`, A, r3, B), gpt-6-luna (rol `mecanico`, r2, r4) · Spec: docs/specs/UI.26.6b.3.md
  Evidencia (cerebro): typecheck app, lint, build; capturas `settings-palette`, `settings-highlight`, `unsaved-bar` y
  `unsaved-saved` miradas.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.6b.3-live.json` (`shell-look` 47/47) y
  `docs/done/evidence/UI.26.6b.3-model-routing-live.json` (`model-routing` 18/18, guarda con la barra).
  Anotado: `components/common/CommandPalette.tsx` nunca se abre (`setIsCommandPaletteOpen` sin llamador); va a limpieza.
- [x] **UI.26.6b.4 — 🔍 El heatmap de Usage se corre un día desde las 19:00 (UTC−5).** (abierto y cerrado 2026-10-21, visto por
  `shell-look` "heatmap tooltip slides" a las 19:05) La clave del día es UTC en los tres sitios (front
  `OrchestSettingsView.tsx:952` `toISOString`, back `usage.ts:36` `strftime` sin `localtime`, `cli-transcripts.ts:31`)
  y la etiqueta es local: de noche las ejecuciones caen en el día siguiente. Arreglo: día local en los tres
  (`getFullYear/getMonth/getDate` en front y `dateOf`; `strftime(…, 'localtime')` en back). Tests en subproceso con
  `TZ=America/Guayaquil` y `UTC` (`usage-endpoint.test.ts`, `cli-transcripts.test.ts`) 9/9. Evidencia (cerebro, 19:xx −05):
  typecheck, biome.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.6b.4-live.json` (`shell-look` 49/49, `usage-bar` 18/18).
  Fuera de Usage siguen con día UTC, sin tocar:
  `spec-archive.test.ts`, `check-sources-drift.ts`, `adversarial-review.ts`. Spec: docs/specs/UI.26.6b.4.md (borrado)
  Ejecutado por: GPT (criterio-alt) · QA: GPT (qa), sin hallazgos en este ítem.
- [x] **UI.27.3 — 🔍 Títulos sin "Agente:", anillo de contexto en la barra superior, asides redimensionables.**
  (abierto 2026-10-21, Carlos: "volver a escribir el nombre del agente es ser repetitivo", "el window context está
  dentro del chat, ubiquémoslo más arriba", "quiero poder mover esas líneas")
  Estado 2026-10-21 (pausa de Carlos): implementado y visto en vivo (títulos sin prefijo, anillo en la barra
  superior, asides redimensionables); `shell-look` 73/73, `test:coverage` 1904/0. Bloquea el cierre una regresión:
  `ui:gate shell-look chat-streaming` falla 2/4 ("Dev renders text…": el primer mensaje de Dev entra en la sesión de
  Chat); en `c8a38542` pasa 3/3. Siguiente: delegar docs/specs/UI.27.3b.md a `criterio-alt` y exigir 4/4.
  Cierre 2026-10-22 (la sesión Desktop se cerró; Carlos: "sube tú esos cambios"): el diff staged del worktree
  `orchestos-ui27` se aplicó sobre master (`e05c27e2`, con CI.32–CI.35) sin conflictos. La regresión de UI.27.3b no se
  reproduce: `ui:gate shell-look chat-streaming` 4/4 (`UI.27.3-master-1..4`, shell-look 73/73, chat-streaming 27/27).
  Inferido, no instrumentado: la cubrió CI.34 (`merge-threads.ts`: una lectura de sesiones vieja ya no pisa el hilo
  local). UI.27.3b no se ejecutó. `chat-sessions.test.ts` 26/0, lint sin errores, `ui:fidelity:jsx` verde.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.27.3-live.json` (`shell-look`, `chat-streaming`).
  Seguimiento 2026-10-22: el pre-push cayó en `chat-turn-details` (buscaba `/^Codex: Ejecuta el comando ls/`; el título
  ya no lleva prefijo) → regex sin prefijo; `chat-turn-details` 29/29. Lección: al cambiar textos visibles, `rg` en
  `scripts/ui-gate/` antes de cerrar (trampa ya anotada; aquí no se hizo porque el cambio vino de otra sesión).
  Ejecutado por: GPT (criterio-alt), sesión Desktop `8b65b9f2` · Spec: docs/specs/UI.27.3.md
- [x] **UI.27.2 — 🔍 Anillo de contexto solo con la ventana, legible; header sin logo; OpenRouter sin logo ajeno.**
  (abierto 2026-10-21, Carlos: "solo debe darme el window context", "¿por qué sale 100K?") El popover decía
  `14661 de 1000000 tokens · claude (medido)`: número crudo que se lee como 100K y texto que el usuario ya sabe.
  `api` resolvía a `chatgpt.svg`. OpenCode fuera del chat: decisión vigente (2026-09-15/28), no se toca.
  (cerrado 2026-10-21) Ejecutado por: gpt-6.1-sol (rol `criterio-alt`) · Spec: docs/specs/UI.27.2.md (borrado).
  Revisión: Opus (diff + navegador en vivo: popover `15K / 1M · 1%`, sin `title`; OpenRouter con icono genérico).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.27.2-live.json` — `shell-look` 58/58,
  `chat-streaming` 27/27.
- [x] **UI.27.1 — 🔍 Modelos `gpt-*` muestran el logo real de ChatGPT.** (abierto 2026-10-21, Carlos: "eso no es el
  icono de codex") La fila de Dev pasa el modelo (`gpt-6.1-sol`) y `ProviderLogos.tsx:36-43` solo elige `chatgpt.svg`
  con `codex|chatgpt|openai|api`: cae al SVG dibujado a mano. (cerrado 2026-10-21) `gpt` resuelve a `chatgpt.svg`;
  fuera 6 fallbacks dibujados inalcanzables; hermano en Usage (`OrchestSettingsView.tsx:~2690`) corregido.
  Ejecutado por: gpt-6.1-sol (rol `criterio-alt`) · Spec: docs/specs/UI.27.1.md (borrado). Revisión: Opus (diff +
  navegador en vivo). Gates propios: typecheck, lint, `ui:fidelity:jsx` verdes.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.27.1-live.json` — `shell-look` 56/56.
- [x] **UI.27 — 🔍 Chat/Dev: icono del agente siempre, hilo y composer en un solo cuerpo, sin texto sobrante.** (abierto
  2026-10-21, pedido de Carlos con capturas) Logo del agente en filas de chat y de Dev (hoy `MessageSquare` / sustituido
  por el estado), línea `border-r` del aside (perdida en UI.26.1), composer dentro de la superficie del hilo, fuera la
  tira "Chat: read-only · …" y el título del header (se queda el anillo). Worktree `ui/UI.27` (otra sesión tiene el
  candado del árbol principal). (cerrado 2026-10-21)
  Ejecutado por: gpt-6.1-sol (rol `criterio-alt`) · Spec: docs/specs/UI.27.md (borrado). Revisión: Opus (diff completo
  + navegador en vivo, Chat y Dev). Gates propios: typecheck, lint, `ui:fidelity:jsx` verdes; `test:coverage` 1903/0;
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.27-live.json` — `shell-look` 55/55,
  `chat-permissions` 9/9, `chat-streaming` 27/27.
  Anotado: el header de Dev (`OrchestDevWorkspace`, fijado por `ui:fidelity:jsx`) sigue mostrando el título del hilo.
- [x] **UI.26.7 — 🔍 Pendiente de revisar: inputs de "Orquestación" en Tasks no aceptan texto.** (Carlos 2026-10-14)
  "Máximo concurrente" y "Tope total por ejecución" (`OrchestSettingsView.tsx:~2321`) se renderizan `disabled`
  (visto en `erp-piloto`): no se puede escribir. Revisar por qué están deshabilitados y si la sección aporta.
  Ejecutado por: gpt-6-luna (rol `mecanico`, r1–r3) · Spec: docs/specs/UI.26.7.md (borrado)
  (cerrado 2026-10-14) No era un fallo: los límites se habilitan con la casilla "Activada" y el scheduler los usa
  (`src/run/scheduler.ts:121`, `orchestration-budget.ts`). Ahora con la orquestación apagada los campos no se
  pintan, una línea dice qué limitan, y el bloque usa tokens (`bg-app-elevated`, `Button` en
  `SettingsPrimaryAction`). r2 (cerebro, captura): el contenido de Tasks arrancaba 8 px a la izquierda de la
  cabecera (`m-4`/`p-4` contra `px-6`). r3 (cerebro, captura `orchestration-on`): los inputs quedaban en línea con
  su etiqueta y "Consumo" flotaba junto a Guardar.
  Evidencia: `typecheck`, `ui:fidelity:jsx`, corridos por el cerebro.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.26.7-live.json` — `orchestration` 11/11 (pasos
  nuevos: `límites ocultos con la orquestación desactivada`, `dos límites visibles…`, `tasks content aligned with
  header`, `límites con la etiqueta encima`), `project-tabs` 39/39, `smoke` 6/6. El cerebro miró las capturas
  apagada y activada.
  Contraprueba (ejecutor): HEAD → falla `límites ocultos…` (inputs: 2); r1 → falla la alineación (272 vs 280);
  r2 → falla `etiqueta encima`.
  Límites: solo tema por defecto.

Cada paso: spec, delegación por rol, conteo de paleta = 0 en lo migrado, y el cerebro mira la pantalla real al lado de
Gr8r antes de cerrar.

**Movimiento — referencias de Arc UI (uiarc.dev), dadas por Carlos 2026-10-13, miradas en navegador:** *"estas
animaciones o estilos visuales es lo que quiero adaptar; no tomes en cuenta el color"*. Tres son bloques **Pro** de
pago (agent-run, settings-command, api-keys): sin código; se reconstruyen con la familia y `motion`, no se compran.
`activity-heatmap` es gratis en registro shadcn (`@uiarc/activity-heatmap`, licencia sin verificar).
- `settings-command` → UI.26.6 y UI.26.2: el buscador crece hasta paleta (posición, tamaño y radio en un spring) y al
  elegir lleva a la fila, que se ilumina; el resaltado de la sección activa se desliza; la barra de cambios sin
  guardar nace de una píldora, cuenta y se convierte en "Settings saved".
- `api-keys` → API & Models en UI.26.6: "Create key" se despliega en su formulario; la clave nueva entra deslizando;
  el secreto se muestra una vez.
- `activity-heatmap` → Usage en UI.26.6: celdas que entran en ola, tooltip que se desliza entre celdas, total que
  cuenta hasta el valor nuevo.
- `agent-run` → UI.24.5/UI.24.7: pasos que entran con altura por spring, título del paso activo con shimmer,
  detalle que se abre en su sitio, contador de tokens que rueda, diff que espera aprobación dentro del paso.
En todos: `prefers-reduced-motion` = cambios instantáneos o fundidos cortos.


<a id="bloque-ui-ui-28"></a>
- [x] **UI.28 — ⚡ Settings → Tasks no invita a crear tareas a mano.** (abierto y cerrado 2026-10-22, Carlos: "el
  Cerebro de OrchestOS es quien toma la decisión", 4.ª vez) Empty state con "Create First Task" y "tasks.yaml"
  (`OrchestSettingsView.tsx:2887`) → "Tasks appear here when the orchestrator creates them from Chat.", sin botón.
  Hermano (r2): pestaña Plan sin "Add task" (abría el chat, pero invitaba a crear) y fuera el modal de alta "Append to
  tasks.yaml" (código muerto: nada lo abría); contador "N tasks declared in tasks.yaml" → "N tasks". Gates: `auto-flow`
  y `project-tabs` afirman que no hay botón; `plan-doc` afirma el empty state nuevo en un proyecto sin tareas (r4).
  r2 quitó el import de `Button` aún en uso → Plan en pantalla negra; no lo vio `bunx tsc --noEmit` (la raíz excluye
  `src/dashboard/app`): el comando correcto en specs es `bun run typecheck`. Corregido en r3; contraprueba de
  `project-tabs` en HEAD 39/39. Evidencia: `auto-flow` 33/33, `project-tabs` 39/39, `plan-doc` 16/16; typecheck, lint,
  `ui:fidelity:jsx` y `bun test src/dashboard` 395/0.
  Sin tocar, para decidir: el selector de sprints de Plan tiene "Sprint 29/30/31" fijos en el JSX (`PlanBoardView.tsx`).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.28-live.json` (`auto-flow`, `project-tabs`, `plan-doc`).
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/UI.28.md

<a id="bloque-ui-ui-8-6"></a>
- [x] **UI.8.6 — 🧠 Permisos visibles (`INS-2026-014`).** (cerrado 2026-10-16)
  Hoy **no existe** mecanismo de aprobación en el chat: el harness invoca los CLIs en modo no
  interactivo por diseño (`codex exec --sandbox workspace-write` en `src/run/executors/codex.ts`,
  equivalente en `external.ts`). El documento de dirección lo exige y sin este ítem queda como
  prosa incumplible — el mismo patrón que dejó a UI.3.5 sin efecto.
  Modelo tomado de Orca (§A.6, §A.11): tira permanente de una línea sobre el compositor
  declarando el estado real, más un segmented control honesto `Yolo | Manual` en Settings del
  agente. No un modal que se acepta una vez y se olvida.
  **GO de Carlos 2026-10-16:** aprobación a nivel de tarea en este bloque (la de cada herramienta, bloque propio
  aparte); default `Yolo`; modo por proyecto.
  Hecho: `permissionMode` por proyecto (`OrcheConfig`, GET/PUT `/api/config`); `src/run/permissions.ts` describe el
  alcance desde las mismas constantes que usan los builders (`CLAUDE_TASK_ALLOWED_TOOLS`, `CODEX_TASK_SANDBOX`,
  `OPENCODE_TASK_AUTO_FLAG`); Manual retiene toda tarea del chat (`chat.ts`, mismo camino `held` → Approve & Run);
  tira de una línea sobre el compositor; `Yolo | Manual` en Settings → Model routing.
  Evidencia (cerebro): tsc raíz+app; `test:coverage` 1821/0.
  Gate en vivo: Playwright en navegador, dashboard real, `scripts/ui-gate/flows/chat-permissions.mjs` vía
  `gate:evidence --label UI.8.6-chat-permissions` → `PASS chat-permissions 9/9` (capturas 1-yolo, 2-manual, 3-held revisadas). Las 2 corridas previas fallaron en el
  turno de Codex (timeout 120 s; lease 150 s vencido) con Codex a 30–65 s por un "ok" trivial medido fuera de
  OrchestOS: latencia externa, misma familia que CI.11. `chat-permissions` no entra al pre-push (CLI real).
  Ejecutado por: claude sonnet (criterio).

<a id="bloque-ui-ui-8-6-1"></a>
- [x] **UI.8.6.1 — 🔍 El hilo sigue pegado al fondo cuando el contenido crece.** (abierto y cerrado 2026-10-16)
  `chat-roles` falló en el pre-push tras UI.8.6: `chat follows content that grows after render` (`atBottom:false`),
  primera vez, y 3/3 ese día. La hipótesis de la tira (monta tarde y achica el hilo) NO se sostuvo: con el contenedor
  observado y la tira con alto reservado falló igual. Medido con el paso instrumentado: `distanceBefore:0`,
  `distanceAfter:562` → el hook estaba despegado estando en el fondo. Causa: los eventos `scroll` se despachan antes
  que los callbacks de `ResizeObserver`; un scroll propio pendiente + contenido que crece en el mismo frame despegaba
  el hilo (con Codex lento el turno sigue creciendo durante el paso). Arreglo en `useStickToBottom.ts`: solo despega
  si el usuario sube (`scrollTop < lastTop`); también observa el contenedor; la tira reserva su alto mientras carga.
  El paso de `chat-roles` deja ahora distancias y medidas en su detalle.
  Evidencia (cerebro): tsc app, lint, `test:coverage` 1821/0.
  Gate en vivo: Playwright en navegador, `scripts/ui-gate/flows/chat-roles.mjs` + `chat-permissions` vía
  `gate:evidence --label UI.8.6.1-chat-roles` → `PASS chat-roles 11/11`, `PASS chat-permissions 9/9`.
  Ejecutado por: codex gpt-6-luna (mecanico, 3 rondas).
  Fuera de scope declarado: `useStickToBottom.ts` y `OrchestChatView.tsx` (la ronda 2 declaró solo `scripts/ui-gate/flows/**`;
  la ronda 3 es el arreglo de la causa medida).
