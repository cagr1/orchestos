---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: etapa-2--uso-real
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo

Orden de Carlos (2026-11-12, actualizado el 2026-11-18): resolver lo que afecta el uso normal, probar OrchestOS en el
navegador, corregir los huecos de Windows y pasar a escritorio cuando todo funcione en el navegador.
Motivo original: meses sin feedback de uso; de los últimos 200 commits, 94 eran de CI, auditoría, gates o tests y 46
`feat`. Lo que no está en una etapa no se abre sin GO de Carlos.

- **Etapa 1 — Lo que rompe el uso normal:** AUD.14 → AUD.17 → AUD.16 → SES.1. Cerrada 2026-11-13.
- **Etapa 2 — Uso real (en curso):** Carlos trabaja en OrchestOS en vez de Orca. Cada fallo o hueco que encuentre se abre como
  ítem con su evidencia y va antes que cualquier pendiente. Los huecos de la interfaz salen de ese uso, no de revisar
  pantallas.
- **Etapa 3 — Windows:** WIN.1 (§ "Etapa 3"). Primero la prueba de humo; después un ítem por fallo.
- **Etapa 4 — Electron:** empaquetar como app de escritorio cuando Carlos confirme que OrchestOS ya funciona en el
  navegador. Decisión de Carlos del 2026-11-18, que sustituye la elección de Tauri del 2026-11-12.
  El diseño y sus prerrequisitos viven en `IDEAS.md` #41; se gradúa a este plan al abrir la etapa.
- **La auditoría no se reabre:** un ítem AUD o CI nuevo entra solo si sale de un fallo visto usando OrchestOS o deja el
  CI rojo. Lo que no rompe el uso normal quedó aparcado (§ "Aparcados").

Rumbos anteriores (histórico): "Terminar interfaz, luego producto mínimo para entrega y luego corregir" (Carlos,
2026-09-22), con sus Fases 1 a 3 cerradas y el lote de auditoría AUD.1–AUD.28 fuera de fase (2026-11-10), en
`docs/done/plan-historico-2026-11-09.md`.

## Restricción de producto: harness liviano — decisión de Carlos (2026-09-17)

**Pedido textual:** *"quiero un harness o orquestador light sin ahogar el trabajo de los agentes
cerebro"*. Origen: usando Orca, Carlos observa que consume ~2 GB de RAM y concluye que OrchestOS
no debe ir por ahí.

**Medición del 2026-09-17, no estimación** (`ps -o rss=`, ambos corriendo en la misma máquina):

| Proceso | RSS |
| --- | --- |
| OrchestOS (`bun run src/cli.ts dashboard`) | **121 MB** |
| Orca (suma de sus procesos, en ese momento) | **1,270 MB** |

OrchestOS ya es ~10× más liviano. **Eso deja de ser una casualidad y pasa a ser un invariante que
se defiende:** toda propuesta que agregue un runtime residente (swarms, memoria vectorial, índice
persistente, servidor extra) declara su costo en RAM antes de entrar, y se compara contra estos
121 MB. Es el mismo criterio con el que `IDEAS.md#64` deja a Serena MCP condicionada a medición
antes/después en vez de adoptarla por fe.

**"Sin ahogar al cerebro" es la otra mitad y limita lo anterior:** liviano no puede significar
recortarle contexto, herramientas o criterio al modelo que piensa. El ahorro sale de *dónde corre
el trabajo* (delegar al ejecutor, que gasta su propio contexto y su propio cupo — medido: 145,664
tokens de Luna que nunca entraron en el contexto del cerebro), no de podar al cerebro.

## Etapa 2 — Uso real

Lo que Carlos reporte usando OrchestOS se abre aquí con su evidencia y va primero. Cerrados de la etapa 1 y de
esta etapa: `docs/done/bloque-AUD.md` (AUD.16, AUD.17), `docs/done/bloque-SES.md`, `docs/done/bloque-USO.md`,
`docs/done/bloque-LRN.md`.

- [x] **USO.3 — Peticiones de sobra, modelos que no existen y borde del sidebar.** Gate en vivo: navegador contra el dashboard real, `docs/done/evidence/USO.3-live.json`: un cambio Chat→Dev bajó de ~40 a 28 llamadas `/api`; Dev quieto, de 20 a 4 en 20 s; los selectores ya no muestran `GPT-Reserve` ni el grupo `OLDER`; los bordes del sidebar y del inspector llegan hasta arriba. (reportado por Carlos 2026-11-13)
  Causas: `scripts/build-app.ts` no definía `NODE_ENV` y se servía React de desarrollo, cuyo StrictMode duplica cada
  carga; la línea de tiempo de Dev se pedía cada 1 s aunque estuviera quieta (ahora 5 s, 300 ms con turno en curso)
  y las tareas cada 1 s aunque ninguna corriera (ahora 5 s); nada se sondea con la pestaña oculta. Codex marca
  `gpt-reserve` con `visibility: "hide"` y el parser lo ignoraba; Claude sumaba un grupo `Older` y modelos del
  historial que Claude Code ya no ofrece (decisión de Carlos: una sola lista del catálogo). Tests en
  `chat-cli-models.test.ts`; `bun test src/dashboard` 737/737.
  Ejecutado por: claude-opus-5-5 (fix chico) · revisión qa: sin defectos
- [x] **USO.4 — Divisor bajo la barra superior en vez de bordes hasta arriba.** Gate en vivo: navegador contra el dashboard real, `docs/done/evidence/USO.4-live.json`. (pedido de Carlos 2026-11-13: los bordes hasta arriba de USO.3 se veían mal)
  `ShellHeader.tsx` lleva `border-b border-app`; se retira la prolongación con `--shell-aside-*` de USO.3.
  Ejecutado por: claude-opus-5-5 (fix chico)
- [x] **USO.5 — El hilo se desvanece arriba al desplazarse, en Chat y Dev.** Gate en vivo: navegador contra el dashboard real, `docs/done/evidence/USO.5-live.json`. (pedido de Carlos 2026-11-13: el texto chocaba con el divisor de la barra)
  `OrchestChatView.tsx` y `OrchestDevWorkspace.tsx`: `mask-image` de transparente a opaco en 32 px.
  Ejecutado por: claude-opus-5-5 (fix chico)
- [x] **USO.6 — "Thought" en Dev repetía la respuesta.** Gate en vivo: navegador contra el dashboard real, `docs/done/evidence/USO.6-live.json`. (reportado por Carlos 2026-11-13)
  `OrchestDevWorkspace.tsx` tomaba el primer paso `text` (la respuesta) como pensamiento; ahora junta los pasos
  `reasoning`, como el Chat, y sin ellos no hay fila Thought.
  Ejecutado por: claude-opus-5-5 (fix chico)
- [x] **ACT.1 — Vista de actividad del turno, como Claude Code, en Chat y Dev.** Gate en vivo: navegador contra el dashboard real con turnos reales de Codex y Claude, `docs/done/evidence/ACT.1-live.json`. (GO de Carlos 2026-11-13)
  `components/thread/activity.ts` (+ test) agrupa herramientas consecutivas ("Ran 3 commands, edited 2 files · +9 −2"),
  intercala el texto intermedio y separa la respuesta (`answerText`); `TurnActivity.tsx` lo pinta, en vivo con el paso
  en curso, "Thinking…"/"Writing…" y tiempo. Reemplaza `ThreadThinking`/`ThreadTools` del Chat y las filas planas de
  Dev (−370 líneas). Fuera: miniaturas de imágenes.
  Texto visible: "Failed" (tooltip y aria-label del ícono de fallo: el ícono solo no se anuncia al lector de pantalla)
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (ajustes tras gate y qa) · revisión qa: 4 P2 corregidos
- [x] **USO.8 — Al cargar, el dashboard pide la línea de tiempo de ~36 sesiones a la vez.** (visto 2026-11-13 en el
  gate de ACT.1: `performance` lista `/api/chat/sessions/<id>/timeline` para cada chat del historial) Medir quién lo
  dispara y pedirla solo para el hilo abierto. Gate en vivo: navegador contra el dashboard real, `docs/done/evidence/USO.8-live.json`.
  `reloadHistory` (31 archivadas) y la hidratación de hilos visibles leían mensajes + timeline + tareas por sesión;
  ahora leen solo mensajes (`loadThreadMessagesLight`, `detailsLoaded: false`) y el hilo abierto se completa al
  activarse. Al cargar: timeline 38 → 2, tasks 39 → 3. De paso, `data-tool-step` vuelve a `TurnActivity` (ACT.1).
  Ejecutado por: claude-opus-5-5 · revisión qa: 3 P2 corregidos
  Sin delegación: fix chico del cerebro
- [x] **USO.9 — El dashboard se cae si un transcript se borra mientras lee el estado de sesión.** (visto 2026-11-13
  verificando USO.8: `ENOENT stat …jsonl` en `scripts/session-status.ts:415`, rechazo sin `catch` en
  `handlers/session-status.ts`, el proceso sale con código 1) Gate en vivo: navegador, el dashboard real se cayó
  así; evidencia y tests en `docs/done/evidence/USO.9-live.json`. mtime tolerante (`transcriptMtime`) y
  `void refresh().catch`. Tests nuevos en `session-status.test.ts`.
  Ejecutado por: gpt-6-luna · Spec: docs/specs/USO.9.md
- [x] **USO.10 — El Chat no tiene proyecto: conversa, no toca Dev.** (Carlos 2026-11-13: escribió un pedido de cambios
  en el Chat y casi creó tareas sobre OrchestOS; GO al plan) New chat ligaba cada chat al proyecto activo en modo
  `code`. Hecho: chats del Chat sin proyecto (cwd aislado, config global, sin tareas), botón "Open in Dev" (tool
  `open_in_dev`, solo CLI), Dev pinta tarjetas de tarea; los 7 ui-gates de tareas migrados a Dev y verdes; arreglos
  hallados por gates (carrera de envío tras Launch Agent, modo de permisos en el composer de Dev). Evidencia:
  `docs/done/evidence/USO.10-live.json`. qa (gpt-6.1-sol): 3 pasadas, la última sin defectos.
  Gate en vivo: navegador y Playwright (7 ui-gates) — `docs/done/evidence/USO.10-live.json`.
  Texto visible: "Open in Dev" (botón de acción bajo la respuesta: un ícono solo no dice adónde lleva)
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/USO.10.md
- [x] **USO.11 — El Chat investiga en la web y entrega documentos, como Claude Desktop.** (Carlos 2026-11-13, GO) Carpeta
  propia por chat que se conserva y tarjeta de archivo en el hilo; búsqueda web en los CLI que la soporten. Va
  después de USO.10. Hecho: `~/.orchestos/chats/<id>/` como cwd del chat general (se borra con la sesión);
  Claude con Write/Edit/WebSearch/WebFetch confinados por `--restricted`; Codex `workspace-write` en esa carpeta y
  `web_search: live`; tarjetas de archivo con Download; sin la fila "Orchestrator unassigned". qa (gpt-6.1-sol): 2
  pasadas, la última sin defectos.
  Gate en vivo: navegador (Claude y Codex reales) — `docs/done/evidence/USO.11-live.json`.
  Texto visible: "Download" (botón de la tarjeta de archivo: un ícono solo no dice que descarga)
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/USO.11.md
- [x] **USO.12 — El borrador del composer se pierde al cambiar de pestaña.** (lo propuso el chat de Carlos como tarea,
  2026-11-13; sacada de `tasks.yaml` por USO.10) Hecho: borrador por hilo en `lib/composer-drafts.ts` (memoria +
  sessionStorage), sobrevive a cambiar de vista/pestaña y a recargar; lo escrito en "new" durante Launch Agent pasa
  a la sesión creada. Límite anotado: varias pestañas "new" del mismo proyecto comparten borrador. qa (gpt-6.1-sol).
  Gate en vivo: navegador y Playwright (`chat-roles`) — `docs/done/evidence/USO.12-live.json`.
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/USO.12.md
- [x] **MSG.1 — Una sesión propone un mensaje a otra del mismo proyecto.** (GO de Carlos 2026-11-13; venía como tarea
  del chat, sacada de `tasks.yaml`) Hecho: herramienta `message_session` (MCP y API), lista de sesiones del proyecto en
  el contexto, tabla `session_messages` (migración 43), tarjeta Approve/Discard en el origen, "Message from «…»" en el
  destino sin lanzar turno; al siguiente turno del destino entra antepuesto en `<untrusted-data>` y se marca
  consumido. Fuera de `chat_messages` para no romper la reanudación de Claude. qa (gpt-6.1-sol): escape de
  `<untrusted-data>` (arreglado en `untrustedContent` para todos sus usos) y origen archivado; corregidos por el cerebro.
  Gate en vivo: navegador (Claude y Codex reales en Dev) y Playwright (`session-message`) — `docs/done/evidence/MSG.1-live.json`.
  Texto visible: "Message to «…»", "Message from «…»", "Approve", "Discard", "Sent", "Discarded", "Show more" (la tarjeta pide una decisión explícita y nombra la sesión; un ícono no lo dice)
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/MSG.1.md
- [x] **USO.13 — Menús y tooltips flotantes no siguen el tema elegido.** (Carlos 2026-11-14, captura del menú "New
  session agent" en azul `#0e1320` con tema oscuro) Causa: `data-theme` solo va en el `<div>` de `App.tsx:1979`; lo
  montado en `body` por portal cae en `:root` = `orchestos` (`index.css:51-53`). Hecho: el efecto que guarda el tema
  también lo pone en `document.documentElement`; el menú sale `#121215` con `carbon`. qa (gpt-6.1-sol): sin defectos.
  Gate en vivo: navegador — `docs/done/evidence/USO.13-live.json`.
  Sin delegación: fix chico de dos líneas en `App.tsx`, revisado por qa de otro proveedor
- [x] **USO.14 — Tooltips con look de shadcn en toda la app.** (Carlos 2026-11-14, GO a migrar todos) Hecho: los
  `title=` nativos de `src/dashboard/app/src` pasan al `Tooltip` de `components/ui/tooltip.tsx` (Radix) bajo un solo
  `TooltipProvider`; `aria-label` solo en controles de ícono (qa: en botones con texto cambiaba su nombre accesible);
  quedan como `title` solo las props de encabezado de componentes. Gates al día: selectores por `aria-label`,
  `[data-theme]` → `div[data-theme]` (dos elementos desde USO.13), divisor de USO.4 en `shell-look`.
  qa (gpt-6.1-sol): 2 pasadas, hallazgos corregidos. 11 ui-gates rojos fallan igual sin USO.14 (`089e9ba7`): USO.15.
  Gate en vivo: navegador y Playwright (`thread-states` 311/311, 4 temas) — `docs/done/evidence/USO.14-live.json`.
  Texto visible: "Stop this agent?", "(diff)", "Unsaved", "Files", "Diff", "History", "Aa", "Approval", "Terminal", "Plan" (textos existentes que solo cambiaron de línea al envolverlos en Tooltip)
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/USO.14.md
- [x] **USO.15 — 11 ui-gates rojos previos a USO.14.** (visto 2026-11-14 al verificar USO.14; fallan igual en
  `089e9ba7`) `shell-look` (logos de filas de Chat), `chat-context`, `chat-continuity`, `chat-readonly-shell`,
  `chat-settings`, `chat-stop`, `chat-streaming`, `composer-picker`, `notifications`, `text-sweep`, `usage-bar`.
  Hecho: 9 gates desfasados por USO.10 (Chat sin proyecto: scope `?project=none`, lo de proyecto se prueba en Dev),
  `usage-bar` acepta `no-store` (USO.2) y abre tooltips Radix con `focus()`. Dos productos rotos por USO.10: en Chat
  las notificaciones nunca se activaban (`ready` comparaba `null` con el proyecto) y al cambiar de modo se perdían los
  hilos del otro scope (`lib/attention-threads.ts`, el hook sondea Chat general y proyecto); el Chat general no
  guardaba ni reanudaba la sesión nativa de Claude y reenviaba el transcript cada turno (`decideClaudeResume`).
  Gate en vivo: Playwright (11 ui-gates, `gate:evidence`, todos PASS) — `docs/done/evidence/USO.15-live.json`.
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/USO.15.md
- [x] **USO.17 — Hora y copia completa de las respuestas en Chat y Dev.** (Carlos, 2026-11-16)
  El navegador confirmó que el hover del asistente omite la hora. En Dev el botón puede copiar el texto persistido
  aunque la respuesta visible provenga de otra fuente o esté más completa. Mostrar la hora real cuando exista y copiar
  todo el Markdown de la respuesta visible. Verificar hora, hover y portapapeles en ambos modos.
  Texto visible: hora de la respuesta al pasar el cursor, con el formato que ya usa el mensaje del usuario.
  Hecho: `ChatMessage` muestra `time` también en el asistente; Chat y Dev copian el Markdown visible
  (`assistantCopyTarget` ya no prefiere el texto persistido) y ocultan Copy sin respuesta. Revisión: el cerebro.
  Gate en vivo: navegador interno en dashboard aislado (`gate:evidence uso17-uso18-final`), hora y portapapeles exacto en Chat y Dev — `docs/done/evidence/USO.17-live.json`.
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/USO.17.md
- [x] **USO.18 — Mostrar fallos de los modelos en Chat y Dev.** (Carlos, 2026-11-16)
  Claude devolvió `rate_limit` con `is_error: true` y texto de límite de cinco horas. Dev omite los avisos del turno
  y descarta errores de envío. Las excepciones de Ollama y API salen sin aviso estructurado. Mostrar el fallo real,
  persistirlo con el turno cuando exista y conservar el detalle redactado. Verificar cuota de Claude y fallo local/API.
  Texto visible: el aviso existente de límite o fallo del proveedor y sus detalles. Un icono no explica cómo proceder.
  Hecho: `claudeFailureKind` usa el texto del resultado (límite de 5 h → cuota); Chat API/Ollama persiste el
  fallo como aviso del turno con detalle redactado (`finishModelFailure`, `handlers/chat.ts`); Dev muestra los avisos
  del turno y el error de envío. Revisión: el cerebro.
  Gate en vivo: navegador interno en dashboard aislado (`gate:evidence uso17-uso18-final`), fallo de Ollama real, fallo previo a la ejecución de Claude y fixture de cuota con salida real del CLI — `docs/done/evidence/USO.18-live.json`.
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/USO.18.md
- [x] **USO.40 — Un solo selector para lanzar agentes, con búsqueda y colores del tema.** (Carlos, 2026-11-23)
  El modal "Launch Agent" del proyecto y el menú "+" de pestañas de Dev eran dos caminos; el modal fijaba colores
  fuera del tema (`bg-black/70`, `text-zinc-950`). Ahora ambos abren `components/common/AgentLauncher.tsx`: búsqueda
  con foco al abrir, lista con logo y nombre, no instalados atenuados con `Not installed`/`Setup required`,
  flechas/Enter/Esc y "Agent settings…" (Settings › Providers). La lista sale de `/api/system/executor-modes` +
  `/api/chat/cli-models` (`agent-launcher.ts`), sin listas fijas; solo tokens del tema. El arranque no cambia
  (`onCreateAgentInProject`, `devSessionAction`). El modal de nuevo chat sigue igual, con los dos colores pasados a
  tokens. 20 flujos `ui:gate` adaptados al clic en la opción; flujo nuevo `agent-launcher`.
  Gates del cerebro: typecheck 0, lint 0, `agent-launcher.test.ts` 4/0, `test:coverage` 3194/0;
  `ui:gate read-boundary` 7/7 y `composer-picker` 11/11. `dev-session-tabs` y `project-isolation` ya fallaban en
  `HEAD` cb5620de sin estos cambios (comprobado en worktree temporal): no son de este ítem.
  Texto visible: `Search agents…` (placeholder: dice qué filtra el campo), `Agent settings…` (destino del acceso;
  un engranaje solo se confunde con los Settings generales), `Not installed` y `Setup required` (por qué la fila
  está atenuada; un ícono no explica cómo proceder).
  Gate en vivo: navegador Playwright contra el dashboard real, `docs/done/evidence/USO.40-live.json` (`ui:gate agent-launcher` 21/21 bajo `gate:evidence`).
  Comprueba filtrado, teclado, fila no instalada inerte, Settings y fondo = `--app-surface` en `orchestos` y `light`,
  desde pestañas y sidebar. Capturas miradas.
  Ejecutado por: gpt-6.1-sol (criterio, 2 rondas) · Spec: docs/specs/USO.40.md
- [x] **USO.42 — En el selector de agentes, los instalados primero.** (Carlos, 2026-11-23, al aprobar USO.40)
  `buildLaunchOptions` (`components/common/agent-launcher.ts`) ordena instalados (incluye `Setup required`) antes que
  `Not installed`, con un segundo `sort` estable: se conservan el orden y el último usado dentro de cada grupo; un no
  instalado usado por última vez no sube. Test de orden en `agent-launcher.test.ts` (5/0). El flujo leía el
  placeholder del composer aún en `Loading models…` (medido en vivo) y ahora espera `Message <agente>`.
  Gates del cerebro: typecheck 0, `test:coverage` 3194/1 (`aud22-processes` por carga en paralelo; solo 10/0),
  revisión `qa`: sin defectos.
  Gate en vivo: navegador Playwright contra el dashboard real, `docs/done/evidence/USO.42-live.json` (`ui:gate agent-launcher` 21/21 bajo `gate:evidence`).
  Ejecutado por: claude-opus-5-5 (fix chico) + gpt-6-luna (mecanico, tests y flujo) · Spec: docs/specs/USO.42.md
- [x] **USO.43 — El dashboard sirve un bundle de UI viejo tras `git pull`.** (Carlos, 2026-11-23)
  `bun run src/dashboard/server.ts` servía `src/dashboard/app/dist` sin mirar si correspondía al código (bundle del
  21-11 tras traer USO.40/42); `orchestos dashboard` solo construía si faltaba. Al arrancar, ambos entrypoints
  reconstruyen si el bundle falta o es más viejo que `src/dashboard/app` o `scripts/build-app.ts`; si el build falla,
  aviso en terminal y banner en la página con el comando. `ui:gate` ya construye antes: no cambia.
  Hecho: `src/dashboard/ui-bundle.ts` (`ensureFreshUiBundle` compara mtimes de `dist/main.js` contra las fuentes,
  `withUiBundleWarning` inyecta el banner tras `<body>`), llamado desde `server.ts` (`import.meta.main`) y
  `cli.ts dashboard`. Tests con build inyectado: ausente, viejo, al día, `dist/` ignorado, fallo + banner (10/0).
  Gates del cerebro: typecheck 0, lint 0, `test:coverage` 3205/0.
  Gate en vivo: `bun run src/dashboard/server.ts` con fuente tocada, con build roto y al día — `docs/done/evidence/USO.43-live.log`.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/USO.43.md
- [x] **USO.49 — Una tarea rechazada por QA queda `pending` sin reintentarse ni botón.** (Carlos, 2026-11-23, uso real
  en `Agro`, `chat-88da5540` retry 1/3) Causa: el chat lanza `task run <root> --id <id>` (`tasks.ts:393`) y la rama
  `--id` de `src/cli.ts:1414` ejecuta un solo intento; el loop de reintentos solo existe en `--all` y en
  `graph-runner.ts:442`. La tarjeta muestra "attempt 1/3" pero el botón solo aparece si `interrupted`
  (`TaskCard.tsx:519`). Alcance: `--id` reintenta hasta `MAX_RETRIES`; botón Retry en tarjetas `failed` no
  interrumpidas; reintento manual de una tarea agotada reinicia `retry_count`.
  Hecho: `--id` repite `executeTask` mientras devuelva `retry` (tope `MAX_RETRIES + 1`); `launchTask` pone
  `retry_count: 0` si la tarea estaba `failed` o `failed_permanent`; TaskCard muestra `Retry` en tarjetas `failed` no
  interrumpidas (`Resume` sigue para las interrumpidas).
  Gates: tsc 0, lint 0, `aud21-task-execution` + `handlers/tasks` 26/0 (test nuevo: QA falla, reintenta y pasa en una
  sola invocación). Revisión `qa`: 1 P2 (`failed_permanent` no reiniciaba el contador), corregido.
  Gate en vivo: navegador (Playwright) `docs/done/evidence/USO.49-live.json` — `chat-retry-report` 30/30: agota
  3/3 solo, Retry reinicia el contador y termina done. Una corrida previa cayó en Commit & Run por
  `SQLITE_IOERR_VNODE` (no reproducido; anotado en NEXT.md).
  Ejecutado por: gpt-6-luna (mecanico) · Spec: docs/specs/USO.49.md
- [x] **USO.50 — QA rechaza un dato "no verificado" honesto.** (Carlos, 2026-11-23) Causa: `qa.ts:120-132` y
  `254-278` solo admiten pass/fail con evidencia literal. Alcance: criterio `unverified` con motivo, aceptado solo
  si depende de algo fuera de los archivos escritos; veredicto falla solo si un criterio queda contradicho; aprobado
  con aviso visible "N sin verificar".
  Hecho: criterio `unverified` (solo con `pass:true` y evidencia literal real; nunca salva un fallo); el juez lo usa
  para hechos externos marcados "no verificado" con motivo; reason `(N unverified)`, QA Assertions `Unverified — …`,
  titular del reporte `· N unverified`. Gate `qa-negative` actualizado al reintento automático de USO.49.
  Gates: tsc 0, biome 0, qa-core/projects/runs/task-report 77/0.
  Gate en vivo: navegador (Playwright) `docs/done/evidence/USO.50-live.json` — `qa-negative` 26/26; el caso
  `unverified` en vivo no se ejercitó (cubierto por unitarios).
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/USO.50.md
- [x] **USO.51 — El chat no puede leer una ruta que el usuario le da fuera del proyecto.** (Carlos, 2026-11-23, Agro
  no leyó `~/Projects/MemoriesMD`; aclarado 2026-11-27) Si el usuario escribe una ruta en el chat del proyecto, el
  agente la puede leer, nunca escribir; sin Settings ni lista de carpetas (en Orca funciona). Causa: Claude va con
  `--restricted` y un solo `--add-dir` (`external.ts:487-545`); el prompt aislado prohíbe "private vaults"
  (`cli-registry.ts:89`). Alcance: rutas del mensaje e historial → `--add-dir` (el chat solo tiene Read/Glob/Grep) y
  línea en el prompt; no en `/cut` ni sesión general. Gate: extender `ui:gate read-boundary` (la ruta nombrada se lee,
  otra no nombrada sigue bloqueada). Antes (2026-11-26): lista por proyecto en Settings + botón "Autorizar carpeta",
  descartado por Carlos.
  Hecho: `userReadDirsForTurn` (`src/run/user-read-paths.ts`) toma solo lo tecleado por el usuario (mensaje +
  historial; nunca adjuntos), carpeta del archivo, sin `/`, home ni el propio proyecto, máx. 10 → `--add-dir` en
  Claude (no `/cut` ni sesión general) y línea en el prompt; `cli-registry.ts:89` permite rutas nombradas, nunca
  modificarlas. Runner de ui:gate: escribe `result.json` aunque una espera huérfana rechace; 28 flujos usan el
  compositor visible. Gates: tsc 0, 55/0, biome 0.
  Gate en vivo: navegador (Playwright) `docs/done/evidence/USO.51-live.json` — Claude 7/7; turno de Codex no
  verificado (compositor vacío en pestaña nueva → USO.41).
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/USO.51.md
- [x] **USO.48 — En Dev, el effort elegido en el composer vuelve a `medium`.** (Carlos, 2026-11-23, uso real)
  Esperado: cambio el effort en una sesión, me voy a otra vista/sesión, regreso y sigue donde lo dejé.
  Causa: USO.44 hace que `defaultEffort` sea siempre el de routing y el `useEffect` de defaults
  (`AgentComposer.tsx`) lo reaplica en cada recarga de sesiones o remontaje; la elección manual no se guardaba.
  Hecho: effort manual por hilo en localStorage (`composer-drafts.ts` `read/write/moveComposerEffort`); el composer
  lo prefiere sobre el default y reacciona al cambio de hilo; la pestaña nueva lo pasa a la sesión que crea (lanzar
  agente o enviar directo, hallazgo de `qa`) y vuelve a routing. Sin elección manual, sigue el routing (USO.44 intacto).
  Gates: tsc 0, lint 0, tests composer/projects 45/0. Revisión `qa`: 1 P1 (envío directo desde pestaña nueva), corregido.
  Gate en vivo: navegador Playwright, `ui:gate dev-routing-effort` 9/9 — `docs/done/evidence/USO.48-live.json`
  (high se mantiene al ir a Chat y volver y tras recargar; pestaña nueva con high → sesión creada en high; la
  siguiente pestaña nueva vuelve a medium).
  Ejecutado por: claude-opus-5-5 (fix chico) + gpt-6-luna (mecanico, gate)
- [x] **USO.47 — Pedir una tarea desde el chat de un proyecto nuevo no arranca nada, sin aviso útil.** (Carlos,
  2026-11-23, uso real en `Agro`, proyecto sin git) Causa en la base: el turno de las 10:35 llamó `create_task`, el
  servidor MCP respondió "propuesta recibida" y al cerrar el turno `buildNaturalDraft` lanzó `RoleUnassignedError`
  (el proyecto no tiene `orchestos.config.yaml` ni hay config global: ningún rol asignado). El único rastro fue la
  línea `⚠ Could not auto-create the task…` al final del mensaje; el agente no la vio (el CLI reanuda su propio
  historial) y le dijo a Carlos que la tarea arrancaría. Segunda causa, vista en el gate en vivo con roles asignados:
  sin `.git` el run cae a `cwd` (`sandbox-policy.ts:95`) y los motores CLI se niegan a correr ahí (`codex engine
  requires worktree sandbox mode…`), así que la tarea se crea y falla al instante. Alcance: `create_task` falla en la
  llamada con el error real y qué hacer (roles faltantes; proyecto sin git con ejecutor CLI); aviso "Initialize git"
  en el chat de un proyecto sin git (`POST /api/projects/:id/git-init`, sin tocar `git config`); herramientas
  `list_tasks` y `get_task_status` de solo lectura (IDEAS `#77`); el prompt las nombra.
  Hecho: `taskCreationBlocker` (`src/config/load.ts`; roles, regla efectiva y git según el agente que correría la
  tarea) usado por `create_task` MCP/API y por `settleTaskIntent`; `src/mcp/task-status.ts` (runs solo del proyecto
  registrado); `POST /api/projects/:id/git-init` (sin `git config`; secretos a `.git/info/exclude` e informados; 422
  si ya hay secretos preparados); `ProjectGitNotice` en Chat y en el composer de Dev; flujo
  `scripts/ui-gate/flows/chat-task-roles.mjs`; `#77` sale de `IDEAS.md`.
  Gates del cerebro: typecheck 0, lint 0 errores, 565/0 en `src/mcp src/chat src/dashboard/__tests__` y componentes.
  Revisión `qa` (Sol), 4 rondas: runs de otros proyectos, Executor con reglas, regla `api` sin modelo y secretos en
  git-init — todos cerrados; la ronda 4 no deja defectos tras el último arreglo (revisado por el cerebro).
  Texto visible: "This folder is not a git repository. Agents need git to run tasks.", "Initialize git", "Git initialized. Not committed (may contain secrets):" (aviso y acción que ningún ícono explica: qué falta, qué hace el botón y qué archivos quedaron fuera del commit)
  Gate en vivo: navegador Playwright contra el dashboard real, `docs/done/evidence/USO.47-live.json`
  (`ui:gate chat-task-roles` bajo `gate:evidence`): sin roles → error real en el chat y sin tarea; oferta "Initialize git"
  visible; sin git → error real; tras inicializar, la tarea arranca, termina `done` y existe el archivo; el agente
  respondió con el estado real y el turno registró `get_task_status`. Dos aserciones del flujo (texto "Run requested"
  y el id en la respuesta) se relajaron después y no se re-corrió: por orden de Carlos, la prueba visual final la hace
  él. `chat-followup-task` pasó 9/9 en la primera corrida y luego falló 2 veces antes de enviar (hidratación de la
  pestaña, flujo existente, sin cambios de este ítem).
  Ejecutado por: gpt-6-luna (mecanico: herramientas, tests, flujo y arreglos) + gpt-6.1-sol (criterio: git) +
  claude-opus-5-5 (`taskCreationBlocker` inicial y montaje en Dev, fixes chicos) · Specs: docs/specs/USO.47*.md (borrados al cerrar)
- [x] **USO.44 — El composer de Dev no respeta el effort de Model routing.** (Carlos, 2026-11-23, uso real)
  Aclarado por Carlos: en Dev el effort vuelve a (o arranca en) `high` con `medium` en Model routing; no es el clic.
  Causa: sesión real de Agro con 4 turnos `effort: high`; el routing `medium` se guardó después. Sin routing el
  composer caía al `'high'` fijo (`AgentComposer.tsx`); con routing, `mapSessionToAgent` (`api/projects.ts`) solo lo
  aplicaba a sesiones sin `lastModel` y luego repetía `lastEffort`. Hecho: el effort de routing gana siempre para el
  agente del orquestador (el modelo conserva su regla); sin effort conocido el composer no envía ninguno y el
  servidor usa el de routing. Tests: `projects.test.ts`, `AgentComposer.test.ts`, `chat-queue.test.ts` (continuación
  con el effort de routing). `test:coverage` 3203/5: los 5 son timeouts por carga, sus archivos solos 34/0.
  Revisión: `qa` sin defectos; el cerebro leyó el diff de `criterio`.
  Gate en vivo: navegador Playwright, `ui:gate dev-routing-effort` 5/5 — `docs/done/evidence/USO.44-live.json`
  (sesión existente con turno `high` → composer `· medium`, clics fuera, POST y spawn `medium`, pestaña nueva `medium`).
  Ejecutado por: gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, test) · Spec: docs/specs/USO.44.md
- [x] **USO.45 — Copiar una respuesta no copia el markdown completo.** (Carlos, 2026-11-23, uso real)
  Causa: Copy copiaba `answerText` (solo lo posterior a la última herramienta). Mensaje real 735 (informe con
  títulos y listas → `propose_lesson` → cierre): 3084 chars guardados, Copy daba 639. Hecho: `answerCopyText`
  (`thread/activity.ts`) entrega el turno entero en Chat y Dev (lo visible si lo persistido es más corto; las
  tarjetas de tarea siguen copiando su texto). Test en `activity.test.ts`. Revisión `qa`: sin defectos.
  Gate en vivo: navegador Playwright, `ui:gate chat-answer-actions` 6/6 — `docs/done/evidence/USO.45-live.json`
  (bajo `gate:evidence uso45-uso46`; antes del fix: Copy 79/1242 chars).
  Ejecutado por: gpt-6-luna (mecanico) · Spec: docs/specs/USO.45.md
- [x] **USO.46 — El texto de las respuestas del chat no se puede seleccionar con el mouse.** (Carlos, 2026-11-23, uso real)
  Causa: en Dev, `TurnActivity` (texto intermedio del turno, p. ej. el informe del 735) cuelga de
  `main.select-none` sin `select-text`; la respuesta en vivo sin pasos del Chat tampoco. Hecho: `select-text`
  en la raíz de `TurnActivity` y en la respuesta en vivo. Test `TurnActivity.test.ts`. Revisión `qa`: sin defectos.
  Gate en vivo: navegador Playwright, `chat-answer-actions` — `docs/done/evidence/USO.45-live.json`
  (arrastre título → lista en Chat y Dev; antes del fix Dev seleccionaba `""`).
  Ejecutado por: gpt-6-luna (mecanico) + gpt-6.1-sol (criterio, test) · Spec: docs/specs/USO.45.md
- [x] **USO.41 — `ui:gate dev-session-tabs` y `project-isolation` rojos en `HEAD`.** (visto en USO.40, 2026-11-23)
  Ambos fallan en cb5620de sin cambios: `dev-session-tabs` espera `[data-thread-id]` en Chat (`reloadChat`,
  `flows/dev-session-tabs.mjs:149-153`) y desde USO.10 el Chat no lista sesiones de proyecto; `project-isolation`
  muere con `page.waitForResponse: Target page … closed`. Las nocturnas están en pausa (CI.85), por eso nadie lo vio.
  2026-11-27: el runner ya no pierde el error por la espera huérfana (USO.51) y los flujos usan el compositor
  visible. Nuevo síntoma en `read-boundary`: en la pestaña nueva de Codex el compositor visible queda vacío tras
  `fill` y Send sigue disabled (`ui-gate-81922/read-boundary/failure.png`) — ¿borrador que se resetea al crear la
  sesión (`composer-drafts.ts`, USO.48)? Diagnosticar si es producto antes de tocar el flujo.
  Hecho: era producto. Al lanzar una sesión, `App.tsx` activaba la pestaña antes de `listProjects()`; en ese hueco
  `activeAgent` era null y el compositor escribía en `new:<proyecto>`, y lo escrito se perdía. Ahora la lista llega
  antes de activar la pestaña (`handleCreateAgentInProject` y `handleDevSendMessage`). Gates: esperan la pestaña
  activa antes de escribir (8 flujos; los que no tienen el id de sesión quedan para la nocturna);
  `dev-session-tabs` ya no espera `[data-thread-id]` en Chat y espera el spinner por sondeo. Sin test unitario: no
  hay arnés de `App.tsx`. Revisión `qa`: sin defectos.
  Gate en vivo: navegador Playwright, `read-boundary` 9/9, `project-isolation` 14/14, `dev-session-tabs` 50/50 — `docs/done/evidence/USO.41-live.json`
  Ejecutado por: gpt-6.1-sol (criterio) + gpt-6-luna (mecanico) · Spec: docs/specs/USO.41.md
- [x] **CI.86 — Reanudar las nocturnas de ui-gates.** (GO de Carlos 2026-11-27, análisis de pi.dev) USO.49 rompió
  `qa-negative` y nadie lo vio: la pausa de CI.85 dejó sin red los cambios de comportamiento. Alcance: `paused:
  false`, `bun run nightly:install`, regla de la mañana vigente otra vez con triage (gate desfasado → se arregla el
  gate; producto roto → ítem). Mutación sigue en pausa hasta MUT.1 (shards de más de 3 h). Junto: al cerrar un
  cambio de comportamiento, grep de los flujos que lo asumen.
  Hecho: `scripts/nightly-pause.json` `paused: false`; `bun run nightly:install` → `launchctl list` muestra
  `dev.cagr1.orchestos.nightly-ui-gates` cargado, `StartCalendarInterval` 01:30; regla de la mañana con triage y grep
  de flujos al cerrar cambios de comportamiento en `AGENTS.md`. Riesgo abierto: si el Mac duerme a las 01:30 la
  corrida sale inválida (ya pasó antes de CI.85); lo dirá el startup-guard.
  Sin delegación: flag y regla, cambio del cerebro.
- [x] **GOV.5 — Cerrar un ítem cuesta más que hacerlo.** (GO de Carlos 2026-11-27) Evidencia de 2026-11-26: cerrar
  USO.49 tomó ~6 intentos de commit (`plan:render` exige `plan:reconcile`, y tras cerrar hay que reabrir/recerrar
  para cambiar texto; `agent:live-gate` exige ruta en la misma línea de "Gate en vivo:" con navegador/Playwright;
  provenance exige `Spec:` al final exacto de línea; preflight rechaza ítems fuera del plan; el hook niega al cerebro
  un fix de una línea en `scripts/`/`src/`). Alcance: `analizar` mide qué hook atrapó un error real y cuál solo frenó;
  propuesta a Carlos (un comando de cierre + poda) antes de tocar hooks.
  2026-11-27: análisis en `docs/specs/GOV.5-analisis.md`; GO de Carlos a la propuesta. Se ejecuta en GOV.5.1 (podas)
  y GOV.5.2 (`item:close`). Se quedan secretos, tsc, candado, evidencia real y `plan:render --check`.
  Sin delegación: padre; hijos GOV.5.1 y GOV.5.2 cerrados.
- [x] **GOV.5.1 — Podas de los controles de cierre.** (GO de Carlos 2026-11-27) Cierre pendiente idempotente (editar
  un ítem recién cerrado sin reabrir), `Spec:` en cualquier lugar de la línea de procedencia, evidencia en vivo por
  cada ítem cerrado (no `.some()`) y en cualquier línea del cierre, preflight sin ítem para diagnóstico, Biome
  formatea las rutas staged, `ledger:gate` fuera del pre-commit, hook del cerebro por líneas acumuladas.
  Hecho: los siete cambios, con test cada uno (67 pass en las 6 suites; `agent-preflight.test.ts` nuevo). Un SHA de
  cierre que git ya registra sigue probándose (test con SHA falsificado). Decisión del cerebro: un cierre sin "Gate en
  vivo" no exige evidencia propia (el padre que se cierra con su hijo); `qa` lo marcó P1 contra una lectura estricta
  del spec y se mantiene: el control nuevo atrapa dos cierres "en vivo" con un solo archivo. Reglas al día en
  `AGENTS.md`, `CLAUDE.md` y `NEXT.md`.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/GOV.5.1.md
- [x] **GOV.5.2 — `bun run item:close`.** (GO de Carlos 2026-11-27) Un comando cierra el ítem: valida todo junto
  antes de los checks caros, genera las líneas de cierre/evidencia/procedencia, reconcilia una vez y commitea por
  rutas explícitas. Va después de GOV.5.1.
  Hecho: `scripts/item-close.ts` (`bun run item:close`): valida ítem, candado, rutas, procedencia y evidencia y
  reporta todos los errores juntos; escribe las líneas de cierre sin duplicarlas; borra el spec; formatea con Biome
  antes del commit (el autoformato del pre-commit con `git commit -- <rutas>` dejaba el índice real sin formatear);
  reconcilia, commitea sin `--no-verify` y sube. 8 tests (`scripts/item-close.test.ts`). Este cierre lo hizo el
  propio comando.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/GOV.5.2.md
- [ ] **RUN.3 — Fin de turno explícito en chat y gates.** (GO de Carlos 2026-11-27; idea de pi: `success` = aceptado,
  fin = `agent_settled`) Evidencia: flujos que esperan una respuesta HTTP y mueren con la espera huérfana
  (`chat-retry-report` 2026-11-25, `read-boundary` 2026-11-27, `project-isolation` en USO.41). Alcance: verificar si
  el chat y las tareas exponen un evento/estado terminal único y si los flujos lo usan; diagnóstico antes de cambiar.
- [ ] **LRN.1 — OrchestOS aprende de los errores.** (abierto 2026-11-13; GO de Carlos a D1–D6; va después de SES.1 y
  no bloquea el uso real) Diseño: `docs/specs/LRN-1-opinion-fable.md`. Decisiones: D1 alcance por proyecto, global
  solo por promoción manual; D2 tope 1.000 tokens o 15 lecciones; D3 proponer ante firma repetida ≥2, par
  fallo→arreglo o corrección explícita en chat; D4 graduación a `AGENTS.md` manual con diff; D5 60 días sin uso →
  `review`, nunca borrado; D6 primer lote F0+F1 (cimientos sin LLM + chat recibe y propone).
  Hechos: F0 (LRN.1a), F1 (LRN.1b), F3 (LRN.1c), en `docs/done/bloque-LRN.md`. Falta F2 (propuesta automática desde
  tareas), que espera datos de uso de F0.
- [ ] **MUT.1 — Shards de mutación pasan de 3 h.** (nocturnas 2026-11-14 y 2026-11-15 rojas) `runtime-boundaries`
  (2h11 el 11-12), `executors-codex-engines` (2h30), `executors-codex-server-c` (2h35) y `-b` (2h53) crecieron con la
  suite hasta el `timeout-minutes: 180`; uno además perdió el runner. Hecho: reparto por mutantes ejecutables medidos
  en los reportes del 11-12: `runtime-boundaries` → `-sandbox` (467) y `-checks` (415); `codex-engines` → `codex.ts`
  (239) y `-b` `external.ts` (307); `codex-app-server.ts` 346-fin → b 346-492 (182), c 493-645 (203), d 646-882
  (159), e 883-fin (201). Los cortes en 492 y 882 no los cruza ningún mutante ejecutable (en 882 solo 2
  `CompileError`). Test nuevo: los rangos cubren el archivo sin huecos ni solapes (verificado que falla con un hueco).
  Falta: la nocturna del 2026-11-16 en verde con todos los shards bajo ~1h30.
  2026-11-18: nocturna del 11-17 (run 44075536272) 14/15 verdes; `executors-routing-b` cancelado al llegar a 3 h
  (antes 2h14–2h29; 793 mutantes, dry run de 49 s). Esa corrida arrancó antes de MUT.2 (`52c93ccb`), sin muestreo.
  Corte por mutantes ejecutables del reporte del 11-16: `routing-b` = `step-event.ts` (295); `routing-d` nuevo =
  `chat-adapters.ts` (96) + `task-engines.ts` (77). Test de particiones 11/0.
- [x] **CI.85 — Nocturnas en pausa durante la etapa 2.** (cerrado 2026-11-22; decisión de Carlos del mismo día) Sin
  `schedule` en `.github/workflows/mutation-nightly.yml` (queda `workflow_dispatch` con `shard`); LaunchAgent
  `dev.cagr1.orchestos.nightly-ui-gates` descargado con `launchctl bootout` (el plist sigue). Marca única:
  `scripts/nightly-pause.json` (`paused: true`); con ella `startup-guard.js` no avisa de ui-gates viejos ni inválidos
  y dice en una línea que están en pausa y cómo reanudar. Regla "lo rojo de la noche se resuelve a la mañana"
  suspendida en `AGENTS.md`. Reanudar: `paused: false`, restaurar el cron y `bun run nightly:install`.
  Evidencia: `bun test tests/hooks/startup-guard.test.ts` 23 pass (2 nuevos: pausa y `paused: false`), `tsc` y biome
  limpios. Guard en vivo antes: "corrida inválida en 6730e56 — el Mac durmió 30 veces…"; después: "nocturnas en pausa
  desde 2026-11-22 (CI.85) — reanudar: …". Revisión qa (gpt-6.1-sol): sin defectos en el código; solo marcó como fuera
  de alcance del spec el workflow y los docs, que edita el cerebro.
  Ejecutado por: gpt-6-luna (mecanico; workflow y docs: claude-opus-5-5) · Spec: docs/specs/CI-85.md
- [x] **CHK.1 — Las correcciones repetidas pasan a checks, no a texto.** (cerrado 2026-11-17) (Carlos, 2026-11-17; principio del equipo de
  Grok Bot: cada error de un agente se vuelve regla de lint o test en vez de otra instrucción en `AGENTS.md`). Hoy hay
  ~50 memorias `feedback-*` que el agente debe leer y obedecer, sin nada que las haga cumplir; los checks que ya lo
  hacen son `check-test-assertions`, `check-ui-text`, `check-scope-lock`, `lint-budget`, `check-secrets`. Pasos:
  (1) clasificar cada `feedback-*` y regla de `CLAUDE.md`/`AGENTS.md` en verificable mecánicamente (diff, test, lint)
  o de criterio; (2) las verificables → test o check en el pre-commit/pre-push, empezando por las que ya se rompieron
  (p. ej. "home siempre Chat", roto 3 veces); (3) la memoria se borra cuando su check existe y falla al violarla.
  Fuera: las de criterio siguen como texto. Hecho = conteo antes/después de memorias y un check por regla convertida.
  2026-11-17, lote 1 (reglas 3, 11, 5 del inventario de `NEXT.md`): `scripts/check-mock-module.ts` en el pre-commit
  (AST de `typescript`; presupuesto `{}`: los 17 tests con `mock.module` ya lo corren en subprocesos `-e`, ninguno
  nuevo en el proceso de test); `plan-gate` avisa padre abierto con todos sus hijos `[x]` (solo aviso: `WIN.6` lo es
  con razón); `src/dashboard/__tests__/home-chat.test.ts` falla si un efecto de `App.tsx` cambia de modo fuera de
  Chat. Contrapruebas A y C rojas, 24 tests. Memorias del índice 60 → 59; a `archive/`: home-Chat,
  mock.module y Tailwind sin preflight (regla del frontend vanilla retirado). La mitad "ID en IDEAS y PLAN" de (11)
  no es mecánica: queda como texto. Sigue: lote 2.
  Ejecutado por: gpt-6-luna (mecanico) · qa: gpt-6.1-sol, 3 hallazgos corregidos
  2026-11-17, lote 2 (reglas 1 y 15): `scripts/check-css-budget.ts` (el CSS rastreado no crece; `index.css` 455
  líneas) y `scripts/check-proper-name.ts` (sin nombre propio en `src/`; 33 comentarios pasaron a `User`), ambos en el
  pre-commit. Contrapruebas exit 1. Memorias sin cambio: las dos reglas guardan también criterio (copiar el
  prototipo; qué se limpia fuera de `src/`). (2) `check-jsx` no es mecanizable en CI: compara contra el prototipo fuera
  del repo. Sigue: lote 3 con (17) y las parciales. El live-gate ya no exige navegador si el diff de
  `src/dashboard`/`src/config` solo cambia comentarios (`onlyCommentChanges`, `scripts/agent-governance.ts`).
  Ejecutado por: gpt-6-luna (mecanico) y gpt-6.1-sol (criterio, live-gate) · qa: gpt-6.1-sol, sin defectos
  Cierre: 7 reglas del inventario pasaron a check (3, 11, 5, 1, 15, 13, 4); (14) pasa a CHK.2; (2), (6), (8), (9),
  (10), (17) y la mitad IDEAS de (11) quedan como texto (fuera del repo, parciales con tests propios o no mecánicas).
  Sin delegación: cierre de padre; los lotes llevan su propio "Ejecutado por" arriba y en CHK.1c.
- [x] **CHK.1c — Lote 3: sin `<select>` nativo para modelos y `maxOutputTokensFor` sin llamadores.** (cerrado 2026-11-17)
  Regla (13) se violaba: `OrchestSettingsView.tsx` tenía un `<select>` nativo "Default model (Executor)" en la
  tarjeta del CLI, duplicado del selector con búsqueda de «Model routing» (mismo `routingRoles.executor.model`);
  borrado. `src/dashboard/__tests__/no-native-model-select.test.ts` falla ante un `<select>` de modelos en la app;
  `src/__tests__/max-output-tokens-callers.test.ts` falla ante cualquier referencia a `maxOutputTokensFor` en
  producción, alias incluidos (hallazgo de qa). Contrapruebas A y B exit 1.
  Gate en vivo: navegador del panel, `docs/done/evidence/CHK.1c-live.json` (dashboard 4299 tras `build:app`):
  sin `<select>` en Providers, "Show in picker" intacto, el modelo del Ejecutor se elige con "Filter models…".
  Ejecutado por: gpt-6-luna (mecanico) · Spec: docs/specs/CHK.1c.md
- [x] **CHK.2 — El dashboard muestra con qué commit arrancó y avisa si quedó viejo.** (cerrado 2026-11-17) (regla (14) del inventario de
  CHK.1; memoria `feedback-reiniciar-dashboard-tras-cambio`: Bun no recarga en caliente y se probó más de una vez
  contra un dashboard viejo) Hecho: `GET /api/dashboard-build` → `{ startedAt, startCommit, headCommit }`
  (`src/dashboard/handlers/dashboard-build.ts`, sonda inyectable, `null` sin git); `App.tsx` lo consulta al cargar y
  cada 60 s y muestra un `Banner` fijo si `HEAD` cambió; descartado no vuelve para ese commit.
  Gate en vivo: navegador del panel, `docs/done/evidence/CHK.2-live.json` (sin aviso al arrancar; con `HEAD` movido
  por un commit vacío temporal, aviso a los 36 s; descartado no vuelve tras el sondeo). Revisión: claude-opus-5-5.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/CHK.2.md
- [x] **CMD.1 — Los comandos propios de cada CLI se usan desde el composer.** (cerrado 2026-11-17) (Carlos, 2026-11-17) Hoy el menú `/`
  del composer solo tiene 4 comandos de OrchestOS (`AgentComposer.tsx:181`) y cualquier otro `/x` va al CLI como
  texto. Paso 1: sonda real con Claude (`claude -p`), Codex (`app-server`) y OpenCode (servidor HTTP) de qué comandos
  se pueden listar y ejecutar en el modo en que OrchestOS los usa. Paso 2: decisión y spec (capa común + adaptador
  por CLI, `feedback-deteccion-generica-no-por-cli`).
  2026-11-17, paso 1 hecho (sonda de gpt-6.1-sol, `docs/done/evidence/CMD.1-probe.md`; el cerebro verificó con login
  real que `claude -p "/probe"` ejecuta un comando de `.claude/commands` → `PROBE-OK`, US$ 0,002 con Haiku):
  - Claude: `stream-json` publica en `system/init` `slash_commands`, `skills` y `terminal_slash_commands`; el
    `/nombre` va tal cual en el prompt. `/context` corre local sin costo.
  - Codex `app-server`: no hay catálogo de comandos ni `prompts/list`; `/review` como texto no es el contrato. Hay
    RPC `thread/compact/start` y `review/start`.
  - OpenCode: `GET /api/command` lista (`init`, `review`, `goal`…) y `POST /api/session/{id}/command` ejecuta;
    `POST /api/session/{id}/compact` compacta.
  Decisión (cerebro): capa común `CliCommand {name, description, cli, kind: prompt|rpc}` + adaptador por CLI;
  el menú `/` muestra los de OrchestOS y los del CLI activo, agrupados. Claude: descubre de `system/init` y manda
  el texto. Codex: solo `/compact` y `/review` mapeados a su RPC; los prompts guardados quedan fuera hasta tener
  contrato. OpenCode: descubre y ejecuta por su API. Los de terminal (`terminal_slash_commands`, `/login`) no se
  muestran; si un nombre choca con uno de OrchestOS (`/model`, `/usage`, `/rename`, `/archive`), gana OrchestOS.
  Hecho (paso 2): `GET /api/chat/cli-commands` (`src/dashboard/chat-cli-commands.ts`): Claude descubre con
  `claude -p /context --no-session-persistence` (local, sin costo; caché 5 min) y toma descripciones del frontmatter
  de comandos y skills (enlaces simbólicos incluidos) o de un mapa de internos; Codex: `/compact` →
  `thread/compact/start` por `POST /api/chat/sessions/<id>/cli-command`. Cambios frente a la decisión: OpenCode
  fuera (en Chat abre su propia ventana, donde sus comandos ya funcionan); `/review` de Codex fuera porque sus
  eventos no llegan al streaming del hilo. Pedido de Carlos: comandos del CLI solo en Dev (en Chat se bloquean con
  aviso), menú con altura máxima y descripción breve por comando. El aviso de resultado es efímero bajo el composer:
  persistir un aviso exige un turno activo.
  Texto visible: "Loading…" (grupo del CLI en el menú `/`: la primera carga de Claude tarda ~5 s y un spinner solo no dice qué grupo falta)
  Gate en vivo: navegador del panel, `docs/done/evidence/CMD.1-live.json` (Dev Codex `/compact`, Dev Claude menú y `/context`, Chat bloqueado).
  Ejecutado por: gpt-6.1-sol (criterio) y gpt-6-luna (mecanico) · Spec: docs/specs/CMD.1.md
- [x] **CMD.2 — Mostrar e invocar las skills de Codex desde Dev.** (cerrado 2026-11-17)
  El menú CODEX lista `/compact` y las skills habilitadas del proyecto mediante `skills/list`. El composer envía
  `/nombre argumentos` con la sintaxis de Codex `$nombre argumentos` y restaura el borrador si falla el envío.
  Gate en vivo: Playwright, `docs/done/evidence/CMD.2-live.json` (5/5, app-server real, envío interceptado antes de iniciar el turno).
  Typecheck, lint y 73 pruebas acotadas pasaron.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/CMD.2.md
- [x] **CMD.3 — `/cut` como comando propio de OrchestOS.** (Carlos, 2026-11-17: "agregar este comando a los
  comandos de OrchestOS"; desarrollar en macOS, probar luego en Windows) Hoy `/cut` es un comando de Claude Code del
  método (`~/.agent-method/commands/cut.md`): cierra el ítem en curso, reescribe `NEXT.md`, commitea por rutas,
  sube y suelta el candado. En OrchestOS debe estar en el menú `/` del composer para cualquier CLI (no solo Claude),
  como comando del producto, no del CLI. Antes del código: decidir si lo ejecuta el agente de la sesión con un prompt
  fijo (genérico para cualquier LLM) o el servidor de forma mecánica (commit/push/handoff sin tokens), y qué hace con
  `NEXT.md` en proyectos que no lo usan. Plan corto y GO de Carlos; probar en Windows dentro de la etapa 3.
  2026-11-19: GO de Carlos. Plan: `/cut` en el menú `/` de Dev (no en Chat). Mitad agente: un prompt fijo genérico
  (de `~/.agent-method/commands/cut.md`) cierra el ítem, escribe el handoff (`NEXT.md` solo si el proyecto ya lo usa;
  si no, el handoff es el último mensaje), commitea por rutas y sube. Mitad mecánica (servidor, sin tokens): comprueba
  `git status` sin cambios y rama igual al remoto, suelta el candado y muestra una tarjeta con el resultado y el botón
  "Continuar en sesión nueva" (pestaña Dev nueva que arranca desde el handoff). Spec: `docs/specs/CMD.3.md`.
  2026-11-19 cerrado: en vivo el cierre por tarea no funcionaba (árbol sucio, "Commit & Run" commitea con
  `chore(tasks)`); Carlos: el agente recibe git + NEXT.md solo en el turno `/cut` (Claude: `--allowedTools` git y
  `Edit/Write(NEXT.md)`; Codex: sandbox con gitdir escribible y red solo en ese turno). Tarjeta se recomprueba al
  cerrar una tarea; handoff contra el HEAD del inicio del turno; "Continue in new session" conserva modelo y esfuerzo.
  Gate en vivo: navegador del app, `docs/done/evidence/CMD.3-live.json` — Claude, Codex app-server y Codex exec
  cierran con commit+push y tarjeta "Session wrapped up". Gates: tsc, 201 tests, lint; `qa` 4 rondas; JSON.parse
  validados con Zod.
  Texto visible: "N uncommitted files" — la tarjeta reporta un estado de git que un ícono no cuenta.
  Texto visible: "Continue in new session" — acción única de la tarjeta; un ícono solo no dice adónde lleva.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec borrado.
- [x] **GOV.4 — El cerebro no gasta su cupo en trabajo que es de Codex.** (Carlos, 2026-11-19: "¿cómo evito que eso
  vuelva a pasar? ya sucedió una vez… quiero evidencia") Evidencia: la sesión de USO.21 (201 turnos de Opus, 36,3 M de
  contexto releído) gastó el 49 % en Bash del cerebro, 17 % en navegador, 8 % en sus Edit y solo 7 % en delegar;
  `cost-report` 19-11: Claude US$ 53 con 8 corridas de Codex frente a US$ 33 el 17-11 con 34. Causas en el método:
  `rules.md:124` mandaba `Explore` (corregido en MemoriesMD `14dc514`), `brain-no-code.js` permite fixes chicos sin
  tope, `subagent-budget.js` no mira el tipo de subagente y nada cuenta turnos. Plan con GO de Carlos ("go"): tres
  controles en hooks, spec `docs/specs/GOV.4.md`. Solo rigen en este repo (hooks del proyecto).
  Hecho: `subagent-budget.js` niega `Explore`/`general-purpose`/`Plan`/`fork`/sin tipo y manda a `delegate leer`
  (escape `ORCHESTOS_ALLOW_CLAUDE_SUBAGENT=1`); `brain-no-code.js` permite 2 Edit chicos del cerebro desde la última
  delegación de escritura y niega el 3.º; `context-budget.js` avisa una vez a los 80 turnos del cerebro. En vivo en
  esta sesión: el aviso de 80 turnos saltó solo, `Agent Explore` fue negado y el hook real negó el 3.er Edit y se
  reinició tras `delegate criterio`. Tests 59/59; la contraprueba contra HEAD falla 6.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/GOV.4.md
- [x] **USO.19 — En Chat, el primer mensaje de un chat nuevo se pierde.** (encontrado al verificar CMD.1, 2026-11-17)
  "New chat" → escribir → Enter: la sesión se crea con el título del mensaje pero con 0 mensajes y la vista queda
  vacía; en un chat que ya existe el envío funciona. Se reprodujo con texto normal y con el código de `master` sin
  CMD.1 (`git stash`), así que es previo. Evidencia: `docs/done/evidence/CMD.1-live.json` (`found_unrelated`).
  Causa: el diálogo New chat enfocaba su único campo ("Conversation Topic or Title", placeholder "ask a question");
  lo escrito era el título. Arreglo: en Chat el campo es el primer mensaje; `handleNewChat` lo deja en la cola del
  composer del hilo nuevo y el composer lo envía con su CLI, modelo y esfuerzo (un mensaje encolado sin `cli` toma
  la selección del composer). Enviarlo desde `App` sin modelo daba 400 "Orchestrator role is unassigned". Dev igual.
  qa (claude-sonnet, Codex sin cupo; excepción de Carlos solo esta vez): el composer no se remonta al cambiar de
  hilo y el drenaje usaba el CLI y modelo del hilo anterior; ahora un mensaje sin `cli` espera a que `activeCli` sea
  `lockedCli ?? defaultCli`. En vivo desde un chat Claude: New chat con Codex → POST con `agent: codex`.
  Gate en vivo: navegador (browser pane), dashboard 4242 — New chat → "USO19 prueba: di solo ok" → Enter → user + "ok", título del mensaje; campo vacío → chat sin mensajes; `docs/done/evidence/USO.19-live.json`
  Texto visible: "First message (optional)", "Ask anything" (etiqueta y placeholder del campo de New chat en Chat)
  Ejecutado por: claude-opus-5-5
  Sin delegación: fix chico con el contexto ya leído; el spec solo sirvió para la revisión qa.
- [x] **USO.20 — Dev no tiene navegador integrado para ver lo que construye el agente.** (Carlos, 2026-11-17, al
  empezar un e-commerce de demo para un cliente) Hoy no existe nada parecido: no hay iframe ni panel de vista previa
  en `src/dashboard/app/src/components/dev/` y el ítem no está en `PLAN.md` ni en `IDEAS.md`. Orca y los ADE de
  referencia lo traen. F1: panel "Preview" en Dev con barra de URL, recargar y abrir fuera, apuntando a
  `localhost:<puerto>` del proyecto (iframe; detectar el puerto del dev server desde la terminal o pedirlo). F2: que
  el agente lo lea (captura, consola, errores) con Playwright, para verificar sin pedirle nada a Carlos. Plan corto y
  GO de Carlos antes de código; F2 solo tras usar F1.
  2026-11-17: GO de Carlos para F1 ("hagamos de esta herramienta una maravilla"). Plan: pestaña Preview en Dev
  (como la terminal: una sola, sigue montada al cambiar de pestaña), URL por proyecto en localStorage, solo
  http/https, botón "Preview" en la barra de estado junto a Terminal. Fuera: servidor, MCP, Playwright y detección
  del puerto. Spec: `docs/specs/USO.20.md`.
  Texto visible: "Preview", "Reload", "Open in browser", "Enter an http:// or https:// URL", "Run your dev server in the terminal and enter its URL above"
  Hecho F1: `session-tabs.ts` (`preview`, `openPreviewTab`, no se persiste), `preview-url.ts` (solo http/https),
  `DevPreviewPanel.tsx`, pestaña con `Globe` en `DevSessionTabs.tsx`, botón en `ShellStatusBar.tsx`, montaje en
  `App.tsx`. Tests: `session-tabs.test.ts`, `preview-url.test.ts` (fallan sin el cambio). Diff de Sol leído por el
  cerebro (otro proveedor): acotado al spec, sin defectos. F2 pasa a USO.21. No probado: "Open in browser".
  Gate en vivo: navegador (browser pane), dashboard 4242 con servidor de prueba en 5199 — carga, URL inválida, estado al cambiar de pestaña, Reload y URL guardada; `docs/done/evidence/USO.20-live.json`
  Texto visible: "Preview" (pestaña y botón de la barra de estado, como "Terminal" al lado: un globo solo no dice que es la vista de la app), "http://localhost:3000" (placeholder: muestra el formato esperado), "Enter an http:// or https:// URL" y "Run your dev server in the terminal and enter its URL above" (error y estado vacío: un ícono no explica qué hacer)
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/USO.20.md
- [x] **USO.21 — El agente ve la app que construye (F2 de USO.20).** (Carlos, 2026-11-17) Herramientas Playwright
  en el MCP de OrchestOS (`src/mcp/server.ts`): captura, consola y clic sobre la URL de la pestaña Preview, con las
  capturas visibles en el hilo; funciona con cualquier CLI que hable MCP. Primero en la versión web: Playwright
  pasa a dependencia y descarga Chromium al primer uso para abrir la URL en una sesión local separada. En la etapa
  Electron se podrá evaluar el control de la vista embebida. Después de usar F1 en la demo; plan corto y GO antes de código.
  2026-11-19: GO de Carlos ("GO, en ese orden": USO.21 y luego CMD.3), antes de la demo para que el agente vea AgroTienda.
  Plan: herramientas MCP `preview_screenshot`, `preview_console`, `preview_click`, `preview_navigate` con Playwright y un
  Chromium headless que vive lo que la sesión del CLI; URL por defecto = la de la pestaña Preview, guardada también en el
  servidor por proyecto; solo `localhost`/`127.0.0.1`; capturas en la carpeta del chat y visibles en el hilo (tarjeta
  de imagen nueva). Fuera: control de la vista embebida (Electron) y URLs remotas. Spec: `docs/specs/USO.21.md`.
  Hecho: `src/mcp/preview.ts` (Playwright, Chromium headless por proceso MCP, `context.route`: la cadena de
  redirecciones se recorre entera y una pestaña nueva se cierra; nada no local se carga), `src/preview/` (regla de URL
  local y carpeta por proyecto), `PUT/GET /api/projects/:id/preview-url` y `GET …/previews/<png>`
  (`handlers/previews.ts`), oferta en Dev con Claude y Codex, instrucción en `buildChatSystemPrompt`. El resultado MCP
  ahora llega al paso en Codex (`codex-app-server.ts`, `step-event.ts`) y en Claude sin el base64
  (`toolResultText`). Captura visible bajo el grupo de herramientas. qa (gpt-6.1-sol) en tres pasadas: 3 P1 de fuga a
  hosts no locales (redirección, pestaña nueva, cadena de redirecciones) y 2 P2, todos corregidos; Chromium real:
  `docs/done/evidence/USO.21-chromium-check.txt` (sin peticiones al destino no local).
  Gate en vivo: navegador del panel, dashboard 4299, erp-piloto, Dev Claude y Codex → preview_screenshot/console/click sobre localhost:5199 con miniatura en el hilo; `docs/done/evidence/USO.21-live.json`
  Texto visible: "The agent can only open localhost URLs", "Preview screenshot"
  Ejecutado por: gpt-6.1-sol (criterio) y claude-opus-5-5 (fixes chicos tras qa) · Spec: docs/specs/USO.21.md
- [x] **USO.22 — El tooltip del menú `/` es oscuro como el menú.** (Carlos, 2026-11-19: "Oscuro") El tooltip de
  cada comando usaba los colores invertidos del `Tooltip` común (`bg-foreground`): blanco junto al menú oscuro. Ahora
  usa la superficie del menú (`bg-app-elevated text-app border border-app`, `AgentComposer.tsx:1107`): oscuro en los
  tres temas oscuros, claro solo en `light`. Los demás tooltips de la app no cambian.
  Gate en vivo: navegador del panel, Chat → `/` → tooltip de `/rename` con fondo rgb(21, 29, 48); `docs/done/evidence/USO.22-live.json`
  Texto visible: "Rename this conversation"
  Sin delegación: una línea de className, spec más largo que el diff.
- [x] **USO.23 — Dev con el contraste de Chat y el centro más ancho.** (Carlos, 2026-11-19) En Chat los laterales son
  oscuros y el centro claro; en Dev todo era `bg-app-bg`. Hecho: el centro de Dev, su compositor y la terminal usan la
  superficie clara (`OrchestDevWorkspace.tsx`, `OpenCodeTerminal.tsx` con `--app-surface`); el panel derecho arranca en
  300 px (antes 384) y el ancho solo se guarda si el usuario lo cambia (clave `-v2`: antes cada primera carga guardaba el
  valor por defecto y un `initial` nuevo nunca llegaba); el árbol de Files ya no muestra el peso de cada archivo.
  Gates: `shell-look` al día (ancho 300; la fila hora + Copy de USO.17 se mide por su borde, estaba rojo desde el 16-11)
  y `opencode-terminal` con los colores de superficie.
  Gate en vivo: navegador del panel, Dev en temas orchestos y carbon; `docs/done/evidence/USO.23-live.json`
  Texto visible: "Files"
  Sin delegación: cambios de className y una constante, verificados en vivo y con `shell-look` 75/75.
- [x] **USO.24 — OpenCode no crece al ensanchar la ventana.** (Carlos, 2026-11-19, probando OpenCode en Dev) xterm
  tenía 119 columnas y OpenCode dibujaba 80. `Bun.Terminal.resize` cambia el tamaño del PTY pero el proceso no recibía
  SIGWINCH: no tenía la PTY como terminal de control (corría en el grupo del dashboard) y `opencode --standalone` además
  se desprende de ella. Hecho (`src/dashboard/terminal.ts`): el proceso arranca en sesión propia (`treeSpawnOptions`,
  así `killTree` mata el grupo entero al cerrar) y `resize` le manda SIGWINCH directo. Test nuevo en
  `terminal.test.ts` (falla sin el arreglo). Gate `opencode-terminal` 13/13: además de los colores de USO.23, hace
  hover antes de "Launch new agent" y solo cuenta los OpenCode hijos de su propio dashboard (`ctx.dashboardPid`); antes
  contaba los de un dashboard abierto en paralelo.
  Gate en vivo: navegador del panel, OpenCode a 1500/1600/1000 px redibuja a 117/130 columnas y angosto; `docs/done/evidence/USO.24-live.json`
  Texto visible: "OpenCode"
  Sin delegación: diagnóstico en vivo y fix de pocas líneas con test que lo prueba.
- [x] **USO.25 — La pestaña de OpenCode es negra entera.** (Carlos, 2026-11-19) OpenCode pinta sus celdas con
  `#0a0a0a`; alrededor quedaba el marco y el fondo de xterm con el tono del tema. Ahora la sección y xterm de la pestaña
  OpenCode usan ese mismo negro en cualquier tema (`OPENCODE_BLACK`, `OpenCodeTerminal.tsx`); la terminal de shell
  sigue en la superficie del centro (USO.23).
  Gate en vivo: navegador del panel, pestaña OpenCode con sección y xterm en rgb(10, 10, 10); `docs/done/evidence/USO.25-live.json`
  Texto visible: "OpenCode"
  Sin delegación: una constante y dos estilos, verificados en vivo y con `opencode-terminal` 13/13.
- [x] **USO.26 — Browser y Terminal del pie solo como iconos; botón del panel derecho sin fondo.** (Carlos,
  2026-11-19) Los botones del pie dejan el texto: icono con `aria-label` y tooltip "Browser" / "Terminal (Ctrl+`)"
  (`ShellStatusBar.tsx`). Al probarlo en vivo, pasar de uno al otro dejaba abierto el primer tooltip y el segundo no
  salía: la zona de gracia de Radix (contenido "hoverable") entre botones contiguos. Los tooltips de la app son solo
  texto: `disableHoverableContent` en los dos Provider (`tooltip.tsx`). El botón "Toggle Right Workspace Panel" ya no
  pinta fondo cuando el panel está abierto: igual que los demás del header, estado en `aria-pressed`
  (`ShellHeader.tsx`). Gate `dev-terminal` con el paso nuevo (ambos órdenes de hover).
  Gate en vivo: navegador Chromium de ui-gate y navegador del panel, `dev-terminal` 18/18 y `shell-look` 75/75; `docs/done/evidence/USO.26-live.json`
  Texto visible: "Browser"
  Sin delegación: cambios de className y una prop, con el paso de gate que los prueba.
- [x] **USO.27 — Panel de uso tipo agentlytics en Settings → Usage.** (Carlos, 2026-11-21, GO a las 3 fases) El
  tooltip del heatmap solo decía "N runs". Parte A (datos): `/api/usage` suma `byHour` (día×hora×agente×modelo, con
  turnos y tiempo de agente: `elapsed_ms` en OrchestOS, deltas ≤ 5 min en transcripts de CLI); `byDayModel` se deriva
  de ahí y los runs de CLI cuentan sesiones por día (antes, 1 por día y por modelo). Parte B (UI):
  `UsageDashboard.tsx` + `lib/usage-stats.ts` (con test): rango 7/30/90/todo, 5 KPIs con variación, tokens por día,
  mapa día×hora, heatmap anual con tooltip de gasto/runs/tokens/modelos, tablas de modelos (franja por vendor) y de
  agentes con filtro por clic. Fuera: buscador de sesiones, relay y suscripciones de agentlytics; transcripts de
  OpenCode.
  Gate en vivo: navegador del panel contra el dashboard real y `shell-look` (pasos del heatmap) — `docs/done/evidence/USO.27-live.json`
  Texto visible: "Usage & Spend", "Input", "Output", "runs ·", "tokens" (etiquetas de datos y leyendas de gráfico: un número o una barra sin nombre no dice qué mide)
  Ejecutado por: gpt-6.1-sol (criterio, partes A y B) + claude-opus-5-5 (3 ajustes tras el gate en vivo) · Spec: docs/specs/USO.27-A.md, docs/specs/USO.27-B.md
- [x] **USO.28 — El aro de contexto del composer muestra "1.1M" para una ventana de 1M.** (visto 2026-11-21 en
  `shell-look` al cerrar USO.27: `context.window` 1000000, tooltip "15K / 1.1M"; el gate espera "15K / 1M 1%")
  `ContextRing.tsx:19` formatea `maxTokens`, que no es el `window` de `/context`. Diagnosticar de dónde sale ese
  valor (¿catálogo de Codex actualizado hoy?) antes de tocar. Va después de CLI.1.
  Causa (2026-11-21): el composer pide `/context?model=<selector>`; si difiere del run, la ventana sale del catálogo.
  GO de Carlos (a)+(b): ventana medida más reciente del mismo provider+modelo antes del catálogo
  (`getLatestMeasuredContextWindow`, `src/db/runs.ts`); `shell-look` compara el tooltip con la respuesta que recibió el
  composer.
  Gate en vivo: `shell-look` contra dashboard real con home temporal (pasos del aro) — `docs/done/evidence/USO.28-live.json`
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/USO.28.md
- [x] **USO.29 — Color propio por CLI en el panel de uso.** (Carlos, 2026-11-21: no distinguía a los agentes, todo
  usaba el acento) Solo en Settings → Usage: `agentColor`/`vendorColor` en `lib/usage-stats.ts` (Claude Code
  naranja #D97757, Codex con el color de texto del tema, DeepSeek morado, OpenRouter índigo, OpenCode turquesa,
  Gemini azul); barras de tokens por día apiladas por agente con leyenda; tablas y franja de vendors con color de
  marca. Los heatmaps siguen con el acento (miden intensidad).
  Gate en vivo: navegador del panel contra el dashboard real — `docs/done/evidence/USO.29-live.json`
  Texto visible: "▲ input · ▼ output" (leyenda del gráfico: sin ella no se sabe qué mitad es input y cuál output)
  Ejecutado por: gpt-6-luna (mecanico) · Spec: docs/specs/USO.29.md
- [x] **USO.30 — El panel de uso no se acopla al tema (carbon).** (Carlos, 2026-11-21, con el tema carbon) Visto en
  vivo: el hover card de los gráficos sale con fondo blanco sobre el tema oscuro, y los heatmaps/minigráficos usan
  `--app-accent` (#38bdf8 en carbon) que no casa con ese tema. Hacer que superficie del tooltip, intensidades y
  barras salgan de los tokens del tema activo (`--app-surface-elevated`, `--app-text`, acento del tema) y revisar
  los colores de marca de USO.29 contra cada tema (en temas claros Codex ya usa el color de texto). Verificar en
  vivo en todos los temas de Appearance.
  Causa: tooltip con `bg-foreground text-background` (invertido) y gráficos con `app-accent`. Arreglo: heatmaps y
  minigráficos con `in-data-[theme=carbon]:bg-zinc-300/*` (index.css no crece), y
  tooltip con `bg-app-elevated text-app-text border-app-border`. Colores de marca de USO.29 legibles en los 4 temas.
  Gate en vivo: navegador del panel contra el dashboard real, colores computados en los 4 temas — `docs/done/evidence/USO.30-live.json`
  Revisión: gpt-6.1-sol (qa) "sin defectos".
  Sin delegación: fix chico (1 archivo, 7 líneas), lo hizo el cerebro.
  Ejecutado por: claude-opus-5-5
- [x] **USO.31 — Icono del proveedor antes de cada modelo en Settings → Usage.** (Carlos, 2026-11-21, señalando
  la tabla Models) Cada fila de la tabla de modelos lleva el logo de su proveedor (`ProviderLogo` con
  `vendorOf(model)`) antes del nombre.
  Gate en vivo: navegador del panel contra el dashboard real (logo Claude/OpenAI por fila) — `docs/done/evidence/USO.31-live.json`
  Ejecutado por: gpt-6-luna (mecanico) · revisión: claude-opus-5-5 · Spec: docs/specs/USO.31.md (nunca commiteado, borrado)
- [x] **USO.32 — El mapa "When they work" no crece sin tope.** (Carlos, 2026-11-21: en pantallas anchas los
  cuadros quedaban demasiado grandes) Grilla y leyenda con `max-w-[640px]`: responsive hacia abajo, tope de ~22 px por
  cuadro hacia arriba.
  Gate en vivo: navegador del panel contra el dashboard real a 1800 px — `docs/done/evidence/USO.32-live.json`
  Sin delegación: fix chico (2 clases), lo hizo el cerebro.
  Ejecutado por: claude-opus-5-5
- [x] **USO.33 — La tabla Models muestra etiquetas y placeholders como modelos.** (Carlos, 2026-11-21: "<synthetic>",
  "default", "codex (cli default model) via Codex CLI") Runs viejos guardan etiquetas en `model`. La tabla normaliza
  "X via … CLI …" a X y descarta placeholders (`modelIdOf` en `lib/usage-stats.ts`). Mismo commit: el mapa "When
  they work" baja a `max-w-[480px]` centrado (Carlos: seguía grande y debía ir al centro; ~15 px por cuadro).
  Gate en vivo: navegador del panel contra el dashboard real (tabla Models expandida y mapa a 1800 px) — `docs/done/evidence/USO.33-live.json`
  Ejecutado por: gpt-6-luna (mecanico, normalización y test) + claude-opus-5-5 (mapa) · Spec: docs/specs/USO.33.md (nunca commiteado, borrado)
- [x] **USO.34 — Settings → Usage: gráficos que dicen lo que miden.** (Carlos, 2026-11-21) (1) Tokens per day: input y
  output tenían escalas distintas por mitad (50 M y 213 K del mismo alto) → selector Input/Cache/Output, una escala,
  eje Y rotulado; input sin caché aparte. (2) Las tres series de días mostraban el mismo tooltip completo → cada
  gráfico muestra solo lo suyo. (3) Yearly activity con tope de ancho centrado, como el mapa día×hora. (4) `shell-look`
  "settings usage no palette" en rojo por `zinc-300` de USO.30 → `app-text`. Spec: `docs/specs/USO.34.md`.
  Texto visible: "Input", "Cache", "Caché", "Output", "Total", "Token metric", "Métrica de tokens" (selector y tooltip de un gráfico de datos: sin nombre la barra no dice qué mide)
  Gate en vivo: `shell-look` (paso nuevo "heatmap capped and centered") + navegador del panel contra el dashboard real — `docs/done/evidence/USO.34-live.json`
  Ejecutado por: gpt-6.1-sol (criterio, partes 1-4) + mecanico (gate) · Spec: docs/specs/USO.34.md
- [x] **CLI.1 — Aviso de actualización de Codex/Claude y modelo de rol que ya no existe.** (Carlos, 2026-11-21, GO)
  Origen: `delegate criterio` falló con `model_not_found` para gpt-6.1-sol porque corría Codex 0.155.1; con 0.171.0
  funciona. (1) `cli-updates.ts`: última versión en npm (`@openai/codex`, `@anthropic-ai/claude-code`), validada con
  `src/boundary`, caché 24 h (1 h si falla); `ProviderSnapshot.latestVersion/updateAvailable`. (2)
  `POST /api/providers/:id/update` corre `codex update` / `claude update` con el binario que usa OrchestOS e invalida
  salud, providers y catálogo; en Providers, "0.171.0 → 0.172.0" + botón "Update" y punto en la navegación. (3)
  Model routing marca el rol cuyo modelo no está en el catálogo del CLI y ofrece "Use <más nuevo de la familia>"
  (conserva el esfuerzo); el aviso `invalid-model` suma la pista de actualizar o cambiar el modelo. (4) Fuera del
  repo: `method/bin/delegate` sale con 4 y mensaje claro ante `model_not_found` (MemoriesMD 56212e9).
  Gate en vivo: navegador del panel contra el dashboard real (versión publicada simulada para ver el botón) — `docs/done/evidence/CLI.1-live.json`
  Texto visible: "Update", "Update failed", "No está en el catálogo de", "Use" (acción y estado de actualización y de modelo ausente: un ícono no dice qué versión ni qué modelo)
  Ejecutado por: gpt-6.1-sol (criterio) + gpt-6-luna (ajuste boundary) + claude-opus-5-5 (idioma y esfuerzo) · Spec: docs/specs/CLI.1.md
- [x] **CLI.2 — Actualizaciones de CLI en la barra inferior, con OpenCode y método de instalación detectado.** (Carlos, 2026-11-22, GO)
  Como Orca: entrada "N CLI updates" en `ShellStatusBar` → popover con "actual → última", "Update" por CLI y
  "Update all". Sobre CLI.1 (solo Codex/Claude, solo en Settings › Providers, `<cli> update` sin mirar cómo se
  instaló). Suma: OpenCode (curl → última de GitHub releases; npm `latest` es la línea 1.x), detección del método por
  la ruta real del binario (`cli-install-method.ts`; desconocido → 409 sin ejecutar nada), negativa si una tarea o
  turno de chat usa ese CLI (falla cerrado), `GET /api/cli-updates` que nunca espera red (caché, refresco en fondo).
  Rondas: qa r1 (guarda de tareas abierta si `ps` no lee el comando; respuestas viejas del polling) y r2 (en vivo: la
  entrada seguía tras actualizar → el POST espera la instantánea nueva). Sin probar en Windows: los shims `.cmd` de npm
  caen en "método desconocido" (se niega, no rompe). Límite: la guarda de chat ve solo los turnos del mismo proceso
  de dashboard.
  Texto visible: "CLI update", "CLI updates", "Update all", "Updated to", "Update failed" (aviso y resultado de una acción con versión: un ícono no dice cuántos CLIs ni a qué versión quedó)
  Gate en vivo: navegador (Playwright) contra el dashboard real con el home real — Update de OpenCode 2.3.0 → 2.3.2 — `docs/done/evidence/CLI.2-live.json`
  Ejecutado por: gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, r1 y r2) + claude-opus-5-5 (test de ShellStatusBar); qa gpt-6.1-sol sin defectos en r2 · Spec: docs/specs/CLI.2.md
- [ ] **LRN.2 — Una lección probada se gradúa a check, no solo a `AGENTS.md`.** (Carlos, 2026-11-17; mismo principio
  que CHK.1, aplicado al producto) LRN.1 gradúa lecciones a texto de `AGENTS.md`
  (`docs/specs/LRN-1-opinion-fable.md:79`). Agregar un segundo destino: si la firma del fallo es detectable en el diff
  o en un test, la graduación propone un test o regla de lint en el repo del usuario, con aprobación humana igual que
  hoy. Va después de LRN.1 F2 (necesita firmas reales). Spec antes de código.
- [x] **USO.35 — El ejecutor recibe los criterios de aceptación.** (Carlos, 2026-11-22, de IDEAS.md #76) QA los
  recibe (`src/run/harness.ts:913`) pero el prompt del ejecutor no (`src/run/prompt.ts:42`,
  `src/run/executors/task-prompt.ts:11`): un requisito que solo está en `acceptance_criteria` falla en QA sin que el
  ejecutor lo haya visto. Bloque numerado en `userContent`, antes de los inputs. Spec: `docs/specs/USO.35.md`.
  Gate en vivo: proyecto temporal, Codex gpt-6-luna escribe `note.txt` con los dos requisitos que solo estaban en
  `acceptance_criteria` y el juez QA (claude-sonnet-5-5) pasa; prompt real leído del rollout de Codex —
  `docs/done/evidence/USO.35-live.json`
  Revisión qa (gpt-6.1-sol): sin hallazgos en USO.35.
  Ejecutado por: claude-sonnet-5-5 (criterio-alt) · Spec: docs/specs/USO.35.md
- [x] **USO.36 — El chat ve el diagnóstico de la tarea fallida.** (Carlos, 2026-11-22, de IDEAS.md #76) La tarjeta lleva
  `taskReport.diagnosis` (`src/dashboard/handlers/task-report.ts:75`), pero el historial que va al modelo es solo
  role+content (`src/dashboard/handlers/chat.ts:1354`): el modelo ve un resumen de 300 caracteres. Formateador puro que
  agrega el diagnóstico acotado al contenido del mensaje, marcado como evidencia no confiable. Spec:
  `docs/specs/USO.36.md`.
  `src/chat/task-diagnosis-context.ts`: diagnóstico redactado, tope 6000 caracteres y envuelto en
  `<untrusted-data source="task-report:diagnosis">`; la historia sigue saliendo solo de la sesión actual.
  Gate en vivo: dashboard aislado, dos proyectos con una tarea que falla en un check (marcas QUASAR-5521 y
  NEBULA-8842, fuera del resumen de 300); el chat de A (Codex gpt-6-luna) cita `QUASAR-5521` y `vault/ledger.bin`,
  no menciona la de B ni crea tarea; contraprueba con `HEAD` sin el arreglo: no la cita —
  `docs/done/evidence/USO.36-live.json`
  Revisión qa (gpt-6.1-sol): 1 hallazgo bajo (el sufijo de truncado pasaba el tope por 13 caracteres), corregido.
  Ejecutado por: claude-sonnet-5-5 (criterio-alt) + claude-opus-5-5 (fix del tope) · Spec: docs/specs/USO.36.md
- [x] **USO.37 — Un timeout del app-server de Codex ya no borra el cupo.** (Carlos, 2026-11-22: `[rate-limits] codex
  app-server sin respuesta … tras 8004 ms (tope 8000 ms)` en la terminal del dashboard) Medido (codex-cli 0.171.0, spawn
  en frío, 68 corridas, con el `CODEX_HOME` del dashboard y sin él, hasta 10 en paralelo, 0 fallos): spawn+`initialize`
  40–90 ms, `account/rateLimits/read` ~400–800 ms; total p50 516 ms, p95 685 ms, máx 893 ms (30 secuenciales). El tope
  de 8 s está a más de 9× el p95: lo que se ve es un atasco esporádico, no un tope corto, y subirlo no aporta (el
  handler ya corta la espera del usuario a 3 s, `src/dashboard/handlers/session-status.ts:17`). Arreglo:
  `rememberCodexLimits` (`scripts/session-status.ts`) conserva la última lectura buena hasta 15 min cuando la lectura
  en vivo vuelve vacía, con su `observedAt` original por ventana (la UI no la toma por posterior a un reset).
  Gate en vivo: dashboard del worktree en :4343 vía `gate:evidence`, proyecto sin transcripts, `/api/session/status`
  cada 11 s (API, sin navegador): 6/6 lecturas normales con el % de Codex y 0 avisos; con `app-server` colgado a
  propósito, 4/4 respuestas conservan 2 %/73 % con `observedAt` de la última lectura buena (antes: tarjeta sin cupo) —
  `docs/done/evidence/USO.37-live.json`
  Revisión qa (gpt-6.1-sol): 1 hallazgo medio (la lectura retenida sin fecha podía pasar por posterior al reset),
  corregido en r1; segunda revisión sin defectos.
  Ejecutado por: claude-opus-5-5 (fix chico) + mecanico (test, r1, r2) · Spec: docs/specs/USO.37.md
- [x] **USO.38 — Ctrl+C no detiene el dashboard.** (Carlos, 2026-11-23: `bun run src/dashboard/server.ts` en una
  terminal y Ctrl+C no lo para) Reproducido en una pty: tras arrancar, el grupo en primer plano de la terminal ya no es
  el del dashboard. Causa: `systemCliDiscoveryProbe.loginPath` (`src/run/executors/cli-discovery.ts:19`) lanza
  `$SHELL -lic` heredando la terminal; el shell interactivo se queda el primer plano y al salir lo deja en un grupo
  muerto, así que `^C` no llega a bun (`kill -INT` directo sí lo cierra). Arreglo: el shell corre en su propia sesión
  (`detached`); `src/dashboard/shutdown-signals.ts` hace la limpieza de SES.1c, sale con 130/143 con tope de 3 s y una
  segunda señal sale al instante; `CodexAppServer.kill()` usa `terminateTree` (grupo entero, espera pendiente
  compartida, resuelve si el arranque falló) y el apagado la espera.
  Gate en vivo: pty real vía `gate:evidence`, `bun run src/dashboard/server.ts` y `orchestos dashboard`, cada uno con
  un turno de chat de Claude en curso: una `^C` → sale en 0,1 s con 130, 0 descendientes vivos, turno `interrupted`;
  contraprueba en `HEAD` sin el arreglo: sigue vivo a los 10 s con el puerto escuchando —
  `docs/done/evidence/USO.38-live.json`
  Revisión qa (gpt-6.1-sol): r0 alto (el exit cortaba el SIGKILL de los app-servers), r1 dos altos (nietos del grupo,
  segunda llamada a `kill()`), r2 medio (`kill()` pendiente si el arranque falló); todos corregidos, r3 sin defectos.
  Ejecutado por: gpt-6-luna (mecanico, spec base) + gpt-6.1-sol (criterio, r1 y r2) + claude-opus-5-5 (fix chico r3) · Spec: docs/specs/USO.38.md
- [x] **USO.39 — El prompt del chat dice solo las herramientas que la sesión tiene.** (Carlos, 2026-11-23, GO; captura
  del gate de CLI.2) En un chat sin proyecto, Claude dijo que sus instrucciones nombran `create_task` (no lo tiene),
  reglas de `curl`/Python sin shell, un "Project state:" vacío y preguntas de tareas/runs sin forma de leerlas.
  Confirmado con el prompt real de `buildChatSystemPrompt` (`src/chat/chat-context.ts:267-297`) por caso: la frase
  de `create_task` va en todos los casos, también sin proyecto y en modo chat; las instrucciones de herramientas
  (`open_in_dev`, `propose_lesson`) se imprimen bajo "Project state:"; sin proyecto el rol promete proyecto, tareas y
  runs; las reglas de `curl`/Python las inyecta Claude Code 2.1.330 en su bloque de entorno aun con `--restricted` y
  con `--system-prompt` (probado en vivo), así que solo se pueden neutralizar desde nuestro texto. OpenCode no corre
  chat (`chat: false`, `src/run/executors/chat-adapters.ts:282`). No se suman herramientas (ideas en IDEAS.md).
  Arreglo (`src/chat/chat-context.ts`): `hasProject` explícito desde `chat.ts`; sin proyecto el rol dice que no ve
  archivos, tareas ni runs; `create_task` (guía de respuesta, destino de salida, reintento de rechazadas, entrevista del
  perfil) solo si se ofrece; las instrucciones de herramientas salen de "Project state:", que solo aparece con estado
  real; Claude recibe "las reglas de shell/curl/Python del host no aplican: no hay shell"; API sin `create_task` no
  menciona Tasks; `Read tasks.yaml` solo con tareas. Ideas aparte: `#77` (lectura de tareas/runs) y `#78` (conectores
  de Codex en modo chat).
  Gate en vivo: navegador Playwright, dashboard del worktree con `gate:evidence`, flujo temporal `uso38-live` 9/9 (nombre previo al renumerado): la
  misma pregunta en chat sin proyecto (Claude sonnet-5-5, Codex gpt-6.2-sol) y con proyecto (Claude modo code, Codex
  modo chat); el prompt capturado cumple cada caso y ningún modelo reporta ya `create_task` ausente, estado vacío ni
  tareas/runs sin datos; lo que citan es del prompt propio del CLI — `docs/done/evidence/USO.39-live.json`
  Revisión qa (gpt-6.1-sol): 1 hallazgo P2 (entrevista del perfil nombraba `create_task` sin ofrecerlo), corregido;
  segunda revisión sin defectos.
  Ejecutado por: mecanico (código, tests, flujo temporal, r2) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/USO.39.md

## Etapa 3 — Windows

- [ ] **WIN.1 — Prueba de humo en Windows: instalar, arrancar el dashboard, un turno de chat y una tarea.**
  (abierto 2026-11-12; Carlos: "no sé si funcione en Windows") Nunca se corrió en Windows: los 5 workflows de
  `.github/workflows/` usan `ubuntu-latest` y el desarrollo es en macOS. Sospechas por grep del 2026-11-12, sin probar:
  en `src/` (sin tests ni la app) solo `dashboard/handlers/projects.ts:142,164` consulta `process.platform`, y 16
  archivos usan construcciones POSIX (grupos de procesos, `SIGKILL`, modos de archivo, shell, `/dev/null`, `which`),
  entre ellos `run/process-tree.ts`, `dashboard/terminal.ts`, `dashboard/auth-token.ts`, `dashboard/settings-store.ts`,
  `run/sandbox.ts`, `mcp/readonly.ts` y los ejecutores `codex-app-server.ts`, `generic-cli.ts`, `opencode-server.ts`.
  Fase 1: en un Windows real (o `windows-latest`) instalar, correr `orchestos dashboard`, enviar un turno de chat con
  un CLI y correr una tarea; guardar la salida de cada paso que falle. Fase 2: un ítem `WIN.n` por fallo, primero lo
  que impide arrancar. Nada se arregla a ciegas antes de la fase 1. Si lo roto es mucho, publicar "macOS/Linux;
  Windows experimental" lo decide Carlos.
  2026-11-13: confirmado por lectura que la terminal integrada no abre en Windows: usa `$SHELL`, `/bin/zsh` o
  `/bin/sh` como respaldo (`dashboard/terminal.ts:36-39`). La detección de CLIs debería funcionar: arma el PATH con
  `delimiter` y omite el login shell si no hay `$SHELL` (`run/executors/cli-discovery.ts:31-43`). La fase 1 la corre
  Carlos con Claude en su máquina Windows; al cerrar, un job `windows-latest` con `bun run test:coverage` en CI.
  2026-11-15, fase 1 en CI (Carlos aún sin Windows; hará una VM): workflow manual `.github/workflows/windows-smoke.yml`
  (`gh workflow run windows-smoke.yml`, artefacto `win1-smoke`). Primera corrida: `install.ps1` no parseaba en
  PowerShell 5.1 (UTF-8 sin BOM), arreglado en `d834f2b0`. Segunda: el instalador levanta el dashboard, la API
  responde, typecheck y ui-gate `smoke` 7/7 pasan; `bun test` 2737 pass / 216 fail, agrupados en WIN.2–WIN.7.
  Evidencia: `docs/done/evidence/WIN.1-ci.json`. Falta lo que pide un CLI con sesión (turno de chat y tarea): en la VM.
  Unos 30 archivos más con 1–5 fallos sueltos sin ítem: se re-corre el workflow tras WIN.2–WIN.4 (muchos comparten
  esas causas) y lo que quede se reparte.
- [x] **WIN.2 — Specs y Skills rechazan rutas válidas en Windows.** (WIN.1 fase 1) 39 fallos "Spec path / Skill
  directory escapes project root" (`spec/store.ts:52,84`, `skills/registry.ts:336,341`, vía `realPathWithin` de
  `run/path-policy.ts:53`). Causa: `realRoot` resolvía la raíz al nombre largo y `canonical()` conservaba el corto 8.3
  (`RUNNER~1`); ahora canoniza cada segmento con `realpathSync.native` (`a0882d84`). Tests: `path-policy` compara con
  `.native`, `skill-library` usa `sep`. windows-latest (run 43733050121): 216 → 139 fallos, 0 "escapes project root";
  los 2 que quedan en `path-policy` son de comandos (WIN.5). macOS `test:coverage` 2956/0. qa (gpt-6.1-sol): sin defectos.
  Sin delegación: fix chico de una línea en `path-policy.ts` y tests, revisado por qa de otro proveedor
- [x] **WIN.3 — Terminal integrada no abre en Windows.** (WIN.1 fase 1) `uv_spawn ENOENT`: shell fijo POSIX
  (`dashboard/terminal.ts:36-39`). Hecho (`36531977`, `8ee1af17`): en win32 `resolveShellCommand` usa `pwsh`, luego
  `powershell`, luego `COMSPEC`/`cmd.exe`; `Bun.Terminal` (PTY) sí funciona en Windows. Test nuevo abre el shell real de
  la plataforma en el PTY y exige `exit 7` tras escribir (qa P2: la versión con `exit` y código 0 daba falso positivo).
  windows-latest run 43739021563: el test pasa con PowerShell, 0 fallos de terminal, 139 → 131 en total. El test del
  script `#!/bin/sh` que se reescribe se salta en Windows. macOS `test:coverage` 2958/0. Sin verificar en la VM: la
  terminal del dashboard con un usuario real.
  Sin delegación: fix chico de 7 líneas en `terminal.ts` y tests, revisado por qa de otro proveedor
- [x] **WIN.4 — La API devuelve rutas con `\`.** (WIN.1 fase 1) `git-changes` y `explorer-search` ya pasaban tras
  WIN.2. Hecho (`ef88ae9f`, `71717f55`): rutas relativas al proyecto con `/` en salidas de borrador
  (`fallbackDraftOutput`; el split por `/` era no-op y el chequeo de escape usaba `/`), `roadmap-profile`
  (servidor custom y `docPath`), `manifest` (csproj, `glob` con `posix: true`) y documentos del chat (qa P2, hermanos).
  Tests: nombre con `\n`, modo 0o755, `chmod 000` y `file:///opt` no aplican en Windows. windows-latest run
  43760228211: 0 fallos en el área, 131 → 119 en total. macOS `test:coverage` 2958/0.
  Sin delegación: fix chico de pocas líneas por archivo y tests, revisado por qa de otro proveedor
- [x] **WIN.5 — Shell de solo lectura (`run_readonly`) en Windows.** (WIN.1 fase 1) `mcp/readonly.test.ts` 14 fallos,
  `aud23-security` 5. Sin él, el Chat no puede consultar git ni el proyecto. Hecho (`8c228123`, `1b6ccfb0`):
  `readonly.ts` comparaba el toplevel de git (nombre largo) con `realpathSync` (nombre corto 8.3) y rechazaba todo git;
  ahora `.native`. Seguridad: `realPathWithin` partía solo por `\`, así que `inner/../x` o `broken/child` escritos con
  `/` saltaban la revisión de symlinks en Windows; ahora parte por ambos. `checks.ts` mezclaba nombres cortos y
  largos y usaba `/` fijo. Tests: rutas con `/` en configs de git y printf (`\U` es escape); FIFO, PATH con `:` y
  modo 0600 solo POSIX. windows-latest run 43765082382: 103 → 98 en total, 1 fallo restante en el área (el test de
  PATH, saltado después). macOS `test:coverage` 2958/0. qa (gpt-6.1-sol): sin defectos, revisión superficial.
  Sin delegación: fix chico de pocas líneas por archivo y tests, revisado por qa de otro proveedor
- [ ] **WIN.6 — CLIs y procesos en Windows.** (WIN.1 fase 1) `providers` 13, `aud22-processes` 10, `chat-sessions` 8,
  `chat-r5-reliability` 6, `aud21-task-execution` 6, `generic-cli`, `process-tree`, `opencode/claude-task-approvals`,
  `cli-health`, `cli-search-path` ("Executable not found in $PATH": `.cmd`/`.exe` de npm). Confirmar en la VM con un
  CLI real antes de arreglar lo que dependa del binario.
  Sonda en windows-latest (`.github/workflows/win-probe.yml`, temporal; runs 43792978378, 43793248008, 43793499256):
  `Bun.which`/`Bun.spawn` encuentran y lanzan `.cmd`; `node:child_process.spawn` de `.cmd` da `EINVAL` (rompe
  `codex-app-server.ts:124` y `generic-cli.ts`); `kill(-pid)` da ESRCH y `proc.kill` deja huérfano al nieto, `taskkill
  /T /F` mata el árbol; Bun **rechaza** (`ERR_INVALID_ARG_VALUE`) todo argumento con `" & % ^ !`, salto de línea, etc.
  hacia un `.cmd`. Consecuencia: con Codex, OpenCode o Claude instalados por npm (`.cmd`) ninguna tarea arranca en
  Windows, porque el prompt va en argv (`codex.ts:141`, `opencode.ts:75`, `external.ts`) y siempre trae esos
  caracteres; además argv de Windows tope 32 767 caracteres.
  Hecho (`09db2b15`): `killTree` usa `taskkill /T /F` en win32 y `codex-app-server` mata por `killTree`.
  2026-11-16, en el Chrome de Carlos tras WIN.6a y WIN.6c (dashboard reiniciado): Codex responde en Chat ("Hola" →
  "¡Hola! ¿En qué te ayudo?", `app-server`, turno 12,8 s) y en Dev (proyecto orchestos, GPT-6-Luna → "DEV-OK").
  El `app-server` con `node:child_process` ya arranca: el timeout de `initialize` venía de `detached` (WIN.6c), no
  hace falta pasarlo a `Bun.spawn` (WIN.6b descartado). Evidencia: `docs/done/evidence/WIN.6-live.json`.
  Falta (cambio de varios motores, espera GO): prompt por stdin donde el CLI lo acepte, o resolver el shim `.cmd` de
  npm a `node script.js`/`.exe`; lanzar con `Bun.spawn` en `codex-app-server` y `generic-cli`; fixtures de test
  multiplataforma (PATH con `delimiter`, CLIs falsos `.cmd`).
  Avance del 2026-11-18: el launcher del catálogo y `codex exec` usan la ruta que detecta el PATH en ejecución.
  Validado con shims de prueba en el clon Windows. Sigue pendiente Claude/OpenCode vía `.cmd`.
- [x] **WIN.6a — Codex recibe el prompt por stdin (`codex exec … -`), nunca por argv.** (WIN.6, PC Windows de
  Carlos, 2026-11-16) `cmd.exe` corta el prompt de `codex.cmd` en el primer salto de línea y pierde `--json`: "Hola"
  a Codex en Dev queda sin respuesta. Hecho: `buildCodexArgs`/`buildCodexChatArgs` llevan `-` en lugar del prompt,
  `runCodex` lo manda por stdin (tarea y chat), `providers/codex.ts` igual. En vivo con `codex.cmd` 0.160.1 y los
  args reales: prompt multilínea con `" & % ^ !` → 4 líneas JSON y la respuesta pedida
  (`docs/done/evidence/WIN.6a-live.json`). Suite del spec 59 pass / 2 fail (los 2 previos de Windows, ajenos a
  Codex). qa (gpt-6.1-sol): sin defectos. Sigue WIN.6b (`app-server` con `Bun.spawn`) y el "Hola" en Dev.
  Ejecutado por: gpt-6-luna · Spec: docs/specs/WIN.6a.md
- [x] **WIN.6c — Al escribir a Codex se abre una ventana de cmd.** (Carlos, PC Windows, 2026-11-16) `spawnTree`,
  `run_readonly` y `codex-app-server` lanzan con `detached: true`; en Windows eso arranca sin consola y el nieto del
  `.cmd` de npm (codex.cmd → node) crea una consola visible. Medido en vivo (el nieto consulta `GetConsoleWindow`
  + `IsWindowVisible`): `detached` → visible, también con `windowsHide`; sin `detached` → sin ventana. Hecho:
  `treeSpawnOptions()` en `process-tree.ts` (win32 `{ detached: false, windowsHide: true }`, POSIX `{ detached:
  true }` sin cambio) en los 3 sitios; el árbol en Windows ya se mataba con `taskkill /T`. En vivo con `spawnTree` y un
  shim `.cmd`: `visible=False`, `killTree` termina al instante. Suites 144 pass / 6 fail (los 6 previos: 4
  `process-tree` con fixtures `sh`, iguales en HEAD, y 2 de PATH/OpenCode). qa (gpt-6.1-sol): sin defectos. Falta
  verlo en Dev tras reiniciar el dashboard.
  Sin delegación: fix chico de 4 archivos con el diagnóstico ya en contexto; spec más largo que el diff.
- [ ] **WIN.7 — Scripts de desarrollo en Windows.** (WIN.1 fase 1, baja prioridad: no los usa el usuario final)
  `adversarial-review`, `mutation-test-shard`, `startup-guard`, `session-status`, `context-adapters`.
- [x] **WIN.8 — "Open folder" y "Clone from URL" solo funcionan en macOS.** (PC Windows de Carlos, 2026-11-16) El
  selector nativo es `osascript` (`dashboard/handlers/projects.ts:117`) y fuera de darwin responde 501 "Native folder
  selection is only available on macOS": en Windows no hay forma de añadir un proyecto desde la UI (solo
  `orchestos init <ruta>`). Hecho: en win32, `FolderBrowserDialog` por `powershell.exe -STA` con argv fijo (cancelar =
  exit 2 → `{cancelled: true}`); darwin sin cambios; Linux sigue en 501. Test de clone esperaba `/` como separador.
  En vivo en el PC de Carlos: Open folder → diálogo de Windows → proyecto registrado y visible en Dev. qa (Codex): sin
  defectos. Gate en vivo: `docs/done/evidence/WIN.8-live.json`
  Ejecutado por: claude-opus-5-5 · Spec: docs/specs/WIN.8.md
- [x] **WIN.10 — Un clon en Windows rompe lint, PLAN y runs-summary.** (PC Windows de Carlos, 2026-11-16) Git para
  Windows (`core.autocrlf=true`) dejaba el árbol en CRLF: Biome fallaba en todo el repo y `plan-status` no leía los
  `## ` (`.` no casa `\r`), así que el pre-commit regeneraba `feature-status.json` con `sprint: null`. Además el
  pre-commit exportaba `runs-summary.json` desde la DB local de Windows y reemplazaba los runs del Mac. Hecho:
  `.gitattributes` (`eol=lf`; `.bat`/`.cmd` CRLF; fixtures de lenguajes `-text`, ya eran CRLF en el repo) y el
  pre-commit omite el export en Windows (cada máquina tiene su DB). macOS sin cambios. En vivo: `bun run lint` del repo
  en verde en Windows; `feature-status` regenerado sin `sprint: null`.
  Ejecutado por: claude-opus-5-5
- [x] **WIN.9 — El reconcile de tareas usa `ps -o`, que no existe en Windows.** (PC Windows de Carlos, 2026-11-16)
  `psRunnerProbe` (`dashboard/handlers/task-run-reconcile.ts:24`) da `false` siempre en Windows: tras reiniciar el
  dashboard, un `task run` aún vivo se marca `failed: Interrupted`. Hecho: en win32 la línea de comando del PID sale de
  `Get-CimInstance Win32_Process` (PID validado como entero antes de interpolar); POSIX sin cambios; tope de 5 s a la
  sonda síncrona (señalado por qa). En vivo: runner falso en ruta con espacios → vivo `true`, otra tarea `false`,
  muerto `false`; ~0,5 s por sonda. qa (Codex): sin inyección. Gate en vivo: `docs/done/evidence/WIN.9-live.json`
  Sin delegación: fix chico de una función, revisado por qa de otro proveedor
- [ ] **WIN.11 — Probar OrchestOS con IA local (Ollama) en Windows.** (Carlos, 2026-11-16: "si tengo una AI local
  quiero ver qué tal funciona") En el PC Windows hay Ollama 0.9.0 con `qwen2.5-coder:7b`. OrchestOS ya tiene la sesión
  de Chat de agente `local`, que exige un modelo `ollama/*` (`dashboard/handlers/chat.ts:1465`, cliente
  `dashboard/llm/clients.ts`). Probar en vivo: (1) que el dashboard detecte Ollama y liste el modelo; (2) un turno de
  Chat local (respuesta, latencia, que se guarde en la sesión); (3) si el rol lo permite, una tarea con el modelo
  local. Anotar qué funciona y qué no (calidad de un 7B frente a Claude/Codex, tiempos); cada fallo, un ítem propio.
- [x] **WIN.12 — "Open folder" abre el selector detrás del navegador.** (Carlos, PC Windows, 2026-11-16) El
  dashboard es un proceso en segundo plano y el bloqueo de primer plano de Windows deja el `FolderBrowserDialog`
  detrás de Chrome; el formulario dueño `TopMost` de WIN.8 nunca se mostraba. Cada clic dejaba otro selector colgado
  (había 4). Medido lanzando desde el dashboard: primer plano = Chrome. Hecho (`dashboard/handlers/projects.ts`): el
  dueño se muestra invisible y `TopMost`, Alt simulado (`keybd_event`) levanta el bloqueo y `SetForegroundWindow`;
  el script va por `-EncodedCommand`. En vivo en el Chrome de Carlos (Dev → + → Open folder): primer plano =
  "Buscar carpeta". Tests de projects 8/0. qa (gpt-6.1-sol): sin defectos (ruta UTF-8 no ASCII comprobada).
  Gate en vivo: Chrome de Carlos — `GetForegroundWindow` = "Buscar carpeta" tras pulsar Open folder
  Sin delegación: fix chico de un archivo con el diagnóstico en contexto.
- [x] **WIN.13 — El Chat no deja usar la IA local (Ollama) aunque esté instalada.** (Carlos, PC Windows,
  2026-11-16) Ollama 0.9.0 con `qwen2.5-coder:7b` responde y `/api/providers/local` lo detecta, pero un chat
  "Local (Ollama)" mostraba Claude: `OrchestChatView` cambiaba el agente `local` por el predeterminado y
  `AgentComposer` nunca pedía los modelos locales. Hecho: el compositor añade "Local (Ollama)" con los `ollama/*`
  detectados (`localCliConfig`); `OrchestChatView` ya no reemplaza `local`; el backend, si un chat local llega sin
  modelo (primer mensaje tras New chat), usa el primero de Ollama (`firstOllamaModel`) antes de calcular la
  asignación, sin tocar `body` (la huella del reintento no cambia); sin Ollama, el compositor dice por qué. qa
  (gpt-6.1-sol): 1ª pasada, respaldo cortado por el guard "Orchestrator role is unassigned" y compositor mudo sin
  Ollama; 2ª, huella del reintento alterada y "modelo local del orquestador ignorado" (no aplica: la config no admite
  `local` como orquestador); 3ª, un chat local ya usado con el modelo B pasaba al primero de Ollama (ahora se
  conserva el último `ollama/*` de la sesión). Corregidos, con `chat-local.test.ts` (cada caso falla sin su
  arreglo; el 1º con 400); 4ª, al reabrir un chat local el compositor elegía el primer modelo y no el último
  (`OrchestChatView` ahora pasa `lastModel` también a `local`; sin probar en vivo: solo hay un modelo instalado);
  5ª, sin defectos. Suites de chat: los 10 fallos son los mismos en HEAD (Windows, previos).
  Gate en vivo: navegador de Carlos — chat Local nuevo, sin elegir modelo → "PRIMERO-OK"; `docs/done/evidence/WIN.13-live.json`
  Texto visible: "Ollama is not running or has no models. Start it and reload."
  Sin delegación: diagnóstico y cambio con el contexto ya leído; spec más largo que el diff.
- [x] **WIN.14 — Una tarea lanzada desde el dashboard no puede commitear: el candado la rechaza.** (revisión del
  cerebro, 2026-11-16) Tarea `chat-b9b3da84…` con Codex: el ejecutor tomó el candado del worktree
  (`.orchestos/worktrees/chat-b9b3da84…`, sesión `codex`) y el commit de OrchestOS en ese mismo worktree lo rechazó el
  pre-commit (`scripts/pre-commit.sh:28`, `writer-lock.mjs check`): "otra sesión (codex, codex) escribe … desde hace 2
  min". Quedó `failed`, `retry_count: 1` en `tasks.yaml`. Causa reproducida: el dashboard heredó
  `CLAUDE_CODE_SESSION_ID` de la sesión de Claude Code que lo lanzó; `check` la toma como identidad y, al no ser
  `codex`, rechaza (sin identidad pasa). No es solo Windows: pasa con cualquier dashboard lanzado desde Claude Code.
  Hecho: los dos commits de OrchestOS dentro del worktree de la tarea (`commit` y `squash` con la base no activa) usan
  `commitEnv` (`src/run/sandbox.ts`), sin `CLAUDE_CODE_SESSION_ID`/`AGENT_WRITER_*`; los del repo base siguen con el
  env heredado. `sandbox-commit-env.test.ts`: 3 tests con el hook real del candado; los de `commit` y `squash` fallan
  sin el arreglo con "otra sesión (codex, codex)". Suites de sandbox: los 2 rojos son los mismos en HEAD (WIN.15 y
  `run-revert`). qa (gpt-6.1-sol): 1ª, quitar la identidad en todo commit rompía los del repo base → acotado al
  worktree; 2ª, faltaba el commit `squash`; 3ª, sin defectos. Sin verificar en vivo: reintentar `chat-b9b3da84…`
  reescribiría `NEXT.md` con un estado viejo; queda para la tarea en vivo de WIN.1.
  Sin delegación: fix chico de un archivo con la causa reproducida en contexto.
- [x] **WIN.15 — El script de setup de worktrees usa `sh` fijo.** (revisión del cerebro, 2026-11-16)
  `run/sandbox.ts:160` lanza `sh -c`; en Windows sin Git Bash en el PATH da `Executable not found in $PATH: "sh"`
  (`sandbox-setup.test.ts`, 3 rojos). Un proyecto con setup script no puede preparar su worktree. Decidir: resolver el
  `sh` de Git for Windows (como `guard/git.cmd` del método) o shell de plataforma como en WIN.3; POSIX sin cambio.
  Hecho: `resolveSetupShell` (`src/run/sandbox.ts`) usa `sh.exe` del PATH o, si falta, el de Git for Windows
  (`git --exec-path` → `usr/bin/sh.exe`) y antepone su carpeta al PATH del script; sin ninguno, error que dice qué
  instalar. POSIX sigue con `sh`. `sandbox-setup.test.ts`: 14 pass / 0 fail en el PC de Carlos (antes 3 rojos).
  Revisión: el cerebro (otro proveedor) leyó el diff, sin defectos.
  Ejecutado por: gpt-6.1-sol · Spec: docs/specs/WIN.15.md
- [x] **WIN.16 — Rutas con espacios: el clon en `E:\Carlos\Development Tools\…` falla donde el CI no.** (revisión
  del cerebro, 2026-11-16) `checks.test.ts` da `Module not found "E:\Carlos\Development"`: algún comando parte la ruta
  por el espacio. Sin aislar si el corte está en el producto (`checks.ts`/`defaultChecksFor`) o en el fixture. El
  runner de CI no tiene espacios en la ruta, así que `windows-smoke` no lo ve. Primero aislar; si es producto, es
  prioridad (la carpeta de usuario de Windows suele llevar espacios).
  Hecho: era producto. `defaultChecksFor` armaba `bun run <checker> <ruta>` y `bun test <ruta>` sin comillas y
  `splitCommand` partía la ruta por el espacio; `commandArgument` (`src/run/checks.ts`) las entrecomilla (simples si
  la ruta trae comillas dobles). Fixtures de `checks.test.ts` sin `sleep`/`printf` y con ruta con espacio y
  apóstrofo: 35 pass / 0 fail en el PC de Carlos. Revisión: el cerebro (otro proveedor) leyó el diff, sin defectos.
  Ejecutado por: gpt-6.1-sol (3 rondas) · Spec: docs/specs/WIN.16.md
- [x] **WIN.17 — Rojos de Windows sin ítem.** (revisión del cerebro, 2026-11-16) `bun test` en el PC de Carlos, con
  WIN.13 aún sin commitear en el árbol: 2847 pass / 114 fail / 15 errores (CI decía 98; lista en
  `docs/done/evidence/WIN.17-local.txt`). Con dueño: WIN.6
  (`providers` 12, `aud22-processes` 9, `process-tree` 4, `generic-cli` 3, `aud21` 3) y WIN.7 (~19). Sin dueño:
  `worktree-contract` 7 y `commit-tasks-yaml` 7 (fixtures con `sh`/`chmod`; glob `out*.txt` sin expandir),
  `claude-statusline-tee` 6 (carpeta `C:-Users-…`: `:` inválido en Windows; es el script de la statusLine en uso),
  `chat-sessions` 6 (`EBUSY` al borrar la BD temporal; "Migration 10"), `checks` 4 (parte es WIN.16), `path-policy` 3
  y `terminal` 2 (áreas cerradas en WIN.2/WIN.5 y WIN.3: comprobar si es regresión o solo local), `LRN.1b` 3,
  `orchestos-home` 2, `db-backup`, `auth-token` (modo 600), `writer-lock`. Primero re-correr `windows-smoke.yml` para
  separar lo local (espacios, PATH sin `sh`) de lo de Windows; después repartir: producto roto → ítem propio, test
  POSIX → saltar o fixture.
  Hecho: `windows-smoke` en CI sobre `0bc21da7` (tras WIN.13–16 y USO.17–18): instalador, migración, typecheck y
  ui-gate smoke pasan; tests 2883 pass / 95 fail (antes 98). WIN.6 tiene 38 (`providers` 13, `aud22` 10, `aud21` 6,
  `generic-cli` 5, `process-tree` 4); WIN.7, 21 (sus 5 scripts + `nightly-ui-gates` y `writer-lock`). Solo locales
  (en CI pasan): `claude-statusline-tee`, `commit-tasks-yaml`, `path-policy`, `terminal`: espacios y PATH sin `sh` del
  PC de Carlos. `run-revert` es el flaky conocido. Los 35 restantes se reparten en WIN.18–WIN.20.
  Evidencia: `docs/done/evidence/WIN.17-ci.txt`.
  Sin delegación: corrida de CI y reparto, sin cambio de código.
- [x] **WIN.18 — Tests con supuestos POSIX en Windows.** → [evidencia](docs/done/bloque-WIN.md#win18)
  Sin delegación: ajustes chicos. QA con Codex sin hallazgos, sin revisión de otro proveedor.
- [x] **WIN.19 — CLIs falsos de los tests sin shim de Windows.** → [evidencia](docs/done/bloque-WIN.md#win19)
  Ejecutado por: gpt-6-luna y Codex · Spec: docs/specs/WIN.19.md
- [ ] **WIN.20 — Rojos de Windows que pueden ser producto.** (WIN.17, 2026-11-16) Aislar antes de arreglar:
  `context-update-safety` 3 (`--force` no reemplaza `AGENTS.md`), `action-approvals` 3 (clasificación de comandos y
  diffs de Codex), `worktree-contract` 3 (uno es fixture: `out*.txt` no es un nombre válido en Windows; los otros dos,
  merge con exclusiones y renombres), `contract` "attempts every rollback", `tasks-api-init` 1 (crear la primera
  tarea sin init) y `usage-endpoint` 1 (agrupar por día local). Producto roto → arreglo con test; test POSIX → WIN.18.
  Avance del 2026-11-18: fixtures de aprobación, worktree, rollback, primera tarea y zona horaria corregidos.
  `context --force` pasa aislado y falló durante la cobertura base con exit 0 y sin escribir.
  Falta reproducir esa diferencia. [Verificación focalizada](docs/done/evidence/WIN.18-21-local.md).
- [x] **WIN.21 — El menú de Claude pierde los metadatos de plugins en Windows.** → [evidencia](docs/done/bloque-WIN.md#win21)

## Decisiones pendientes de Carlos

- Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no (anotado en UI.8;
  sin verificar si sigue vigente).
---

## Aparcados

→ [12 ítems fuera del plan desde el 2026-11-12: CI.19, CI.54, CI.55, CI.57, CI.69, CI.76, CI.81, AUD.8, AUD.9,
AUD.10, AUD.27, AUD.28](docs/done/aparcados-2026-11-12.md)

→ [MUT.2 aparcado el 2026-11-23 (tope de memoria del kernel revertido; retomar al reanudar la mutación)](docs/done/aparcados-2026-11-23.md)

## Retirados

→ [11 ítems superados por UI.13/UI.14, retirados 2026-09-22](docs/done/retirados.md)

## Cerrados — evidencia archivada

→ [cerrados de AT](docs/done/bloque-AT.md)
→ [cerrados de DOC](docs/done/bloque-DOC.md)
→ [cerrados de H](docs/done/bloque-H.md)
→ [cerrados de I](docs/done/bloque-I.md)
→ [cerrados de R](docs/done/bloque-R.md)
→ [cerrados de S](docs/done/bloque-S.md)
→ [cerrados de ERP](docs/done/bloque-ERP.md)
→ [cerrados de CI](docs/done/bloque-CI.md)
→ [cerrados de CX](docs/done/bloque-CX.md)
→ [cerrados de MR](docs/done/bloque-MR.md)
→ [cerrados de GOV](docs/done/bloque-GOV.md)
→ [cerrados de UI](docs/done/bloque-UI.md)
→ [cerrados de CTX-GUARD](docs/done/bloque-CTX-GUARD.md)
→ [cerrados de SEC](docs/done/bloque-SEC.md)
→ [cerrados de OC](docs/done/bloque-OC.md)
→ [cerrados de ADE](docs/done/bloque-ADE.md)
→ [cerrados de AUD](docs/done/bloque-AUD.md)
→ [cerrados de SES](docs/done/bloque-SES.md)
→ [cerrados de USO](docs/done/bloque-USO.md)
→ [cerrados de LRN](docs/done/bloque-LRN.md)
→ [cerrados de DEV](docs/done/bloque-DEV.md)
→ [cerrados de ONB](docs/done/bloque-ONB.md)
→ [cerrados de RUN](docs/done/bloque-RUN.md)
→ [cerrados de UI / Sprint 30](docs/done/sprint-30.md)
→ [cerrados de Sprint 1](docs/done/sprint-01.md)
→ [cerrados de Sprint 2](docs/done/sprint-02.md)
→ [cerrados de Sprint 3](docs/done/sprint-03.md)
→ [cerrados de Sprint 4](docs/done/sprint-04.md)
→ [cerrados de Sprint 5](docs/done/sprint-05.md)
→ [cerrados de Sprint 6](docs/done/sprint-06.md)
→ [cerrados de Sprint 7](docs/done/sprint-07.md)
→ [cerrados de Sprint 8](docs/done/sprint-08.md)
→ [cerrados de Sprint 9](docs/done/sprint-09.md)
→ [cerrados de Sprint 10](docs/done/sprint-10.md)
→ [cerrados de Sprint 11](docs/done/sprint-11.md)
→ [cerrados de Sprint 12](docs/done/sprint-12.md)
→ [cerrados de Sprint 13](docs/done/sprint-13.md)
→ [cerrados de Sprint 14](docs/done/sprint-14.md)
→ [cerrados de Sprint 15](docs/done/sprint-15.md)
→ [cerrados de Sprint 16](docs/done/sprint-16.md)
→ [cerrados de Sprint 17](docs/done/sprint-17.md)
→ [cerrados de Sprint 18](docs/done/sprint-18.md)
→ [cerrados de Sprint 19](docs/done/sprint-19.md)
→ [cerrados de Sprint 20](docs/done/sprint-20.md)
→ [cerrados de Sprint 21](docs/done/sprint-21.md)
→ [cerrados de Sprint 22](docs/done/sprint-22.md)
→ [cerrados de Sprint 23](docs/done/sprint-23.md)
→ [cerrados de Sprint 24](docs/done/sprint-24.md)
→ [cerrados de Sprint 25](docs/done/sprint-25.md)
→ [cerrados de Sprint 26](docs/done/sprint-26.md)
→ [cerrados de Sprint 27](docs/done/sprint-27.md)
→ [cerrados de Sprint 28](docs/done/sprint-28.md)
→ [cerrados de Sprint 29](docs/done/sprint-29.md)
→ [cerrados de SET](docs/done/bloque-SET.md)
→ [cerrados de TRUST](docs/done/bloque-TRUST.md)
→ [cerrados de CHAT](docs/done/bloque-CHAT.md)
→ [cerrados de SKILLS](docs/done/bloque-SKILLS.md)
→ [cerrados de CFG](docs/done/bloque-CFG.md)
→ [cerrados de TCLI](docs/done/bloque-TCLI.md)
→ [decisiones de Carlos](docs/done/decisiones.md#entregable-rapido) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#ruta-erp) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#i-0-el-orden) — Fase 1
→ [decisiones de Carlos](docs/done/decisiones.md#sprint-30-decision) — Fase 1
