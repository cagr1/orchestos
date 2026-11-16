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

Orden de Carlos (2026-11-12): *"comenzemos con los que realmente afectarían a OrchestOS su uso normal para comenzar a
probarlo yo mismo y darme cuenta de mis errores y luego corregir esos huecos de Windows y por último pasar todo a
Tauri"*. Motivo: meses sin feedback de uso; de los últimos 200 commits, 94 eran de CI, auditoría, gates o tests y 46
`feat`. Lo que no está en una etapa no se abre sin GO de Carlos.

- **Etapa 1 — Lo que rompe el uso normal:** AUD.14 → AUD.17 → AUD.16 → SES.1. Cerrada 2026-11-13.
- **Etapa 2 — Uso real (en curso):** Carlos trabaja en OrchestOS en vez de Orca. Cada fallo o hueco que encuentre se abre como
  ítem con su evidencia y va antes que cualquier pendiente. Los huecos de la interfaz salen de ese uso, no de revisar
  pantallas.
- **Etapa 3 — Windows:** WIN.1 (§ "Etapa 3"). Primero la prueba de humo; después un ítem por fallo.
- **Etapa 4 — Tauri:** empaquetar como app de escritorio. Decidido Tauri y no Electron (Carlos, 2026-11-12: "pasar
  todo a Tauri"). Hoy vive en `IDEAS.md` #41 con sus prerrequisitos; se gradúa a este plan al abrir la etapa.
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
  Falta (cambio de varios motores, espera GO): prompt por stdin donde el CLI lo acepte, o resolver el shim `.cmd` de
  npm a `node script.js`/`.exe`; lanzar con `Bun.spawn` en `codex-app-server` y `generic-cli`; fixtures de test
  multiplataforma (PATH con `delimiter`, CLIs falsos `.cmd`).
- [ ] **WIN.7 — Scripts de desarrollo en Windows.** (WIN.1 fase 1, baja prioridad: no los usa el usuario final)
  `adversarial-review`, `mutation-test-shard`, `startup-guard`, `session-status`, `context-adapters`.

## Decisiones pendientes de Carlos

- Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no (anotado en UI.8;
  sin verificar si sigue vigente).
---

## Aparcados

→ [12 ítems fuera del plan desde el 2026-11-12: CI.19, CI.54, CI.55, CI.57, CI.69, CI.76, CI.81, AUD.8, AUD.9,
AUD.10, AUD.27, AUD.28](docs/done/aparcados-2026-11-12.md)

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
