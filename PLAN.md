---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: sprint-30-abierto--fiabilidad-del-recorrido-y-shell-chat-workspace
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo — orden cerrado por Carlos (2026-09-22)

*"Terminar interfaz, luego producto mínimo para entrega y luego corregir"* lo que Opus detectó corriendo dentro de
OrchestOS. Una fase a la vez; lo que no está en una fase no se abre sin GO de Carlos. Restricción que manda en las
tres: harness liviano (ver abajo) — la respuesta dentro de OrchestOS tiene que sentirse igual que el CLI directo,
sin peso extra y con reglas claras.

### Fase 1 — Terminar la interfaz (plantilla React de AI Studio, regla UI.13)
UI.13.4 (queda 4c: razonamiento/herramientas/tarea retenida en el chat) → UI.13 (pantallas restantes: Tasks/Runs/
Graph → Memory/Specs/Skills/Instincts/Plan → borrar vanilla) → UI.9.9 (opciones de proyecto al hover) → UI.9.8
(texto que no aporta) → UI.10.A (plan por proyecto) → CI.2 (ui-gates exigibles). Pendiente de UI.14: verificar en
vivo el selector nativo de nuevo proyecto.

### Fase 2 — Producto mínimo para entrega (ruta ERP)
AT.10 (tramo OpenCode) → R.7 (tasks.yaml atómico) → ERP.2 → ERP.3 → I.7 (gate del flujo automático) → H.5.3
(primera corrida medida, GATED por Carlos) → ERP.4 (piloto) → R.8 (validación independiente del recorrido).

### Fase 3 — Correr dentro de OrchestOS igual que el CLI directo
AT.13 (el contexto inyectado dice la verdad y no pesa) → ERP.5 (qué quitar) → H.7.2c → H.7.3 (aviso de contexto)
→ AT.11 (adaptadores genéricos).

### Fuera de las tres fases (no se abren sin GO)
H.9.4, H.10.2, y los reemplazados por UI.13 listados en "Reemplazados — esperan GO para retirarse".

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

## Fase 1 — Terminar la interfaz

- [ ] **UI.13.4 — 🧠 Comportamientos de la plantilla hechos reales.** (abierto 2026-09-22)
  - [x] **UI.13.4a** (cerrado 2026-09-22) — puntos 1, 2, 3 y 6. Ejecutado por: luna · Spec borrado al cerrar.
    Migración 12 `archived_at`; `POST /api/chat/sessions/:id/archive|restore`, `?archived=1`,
    `DELETE /api/projects/:id` (solo filas de DB). El cerebro corrigió el tiempo relativo (medía vida de la
    sesión, no tiempo desde la última actividad; +test). Gate en vivo: `docs/done/evidence/UI.13.4a-live.json`
    — cerrar→History→restaurar→borrar, quitar proyecto deja la carpeta en disco, 0 errores.
    `test:coverage` 1462 pass / 0 fail.
  - [x] **UI.13.4b** (cerrado 2026-09-22) — punto 4. Ejecutado por: luna · Spec: docs/specs/UI.13.4b.md (2 rondas; borrado al cerrar)
    Consola de Dev: `GET …/console` (turnos + pasos + comandos), `POST …/exec` sobre `runOneCheck` exportada,
    migración 13 `console_commands`. Frontera endurecida para runner y consola: argumentos con forma de ruta
    (incluido `--x=valor`) confinados a la raíz real del proyecto; checks internos `trusted`, no legible desde
    `tasks.yaml`. Ronda 1 reportó verde con 7 fallos de migraciones: corregido en ronda 2.
    Gate en vivo: `docs/done/evidence/UI.13.4b-live.json` — `ls` real, `ls | wc` sin pipe, `cat ../x` y `ls /`
    rechazados, historial tras recargar, Archive Session → History, 0 errores. Pasos reales sin datos en vivo
    (0 turnos con task_id en la DB): cubierto por test. `test:coverage` 1465 pass / 0 fail.
    Límite conocido, avisado a Carlos: `node -e`/`sh -c` esquivan el confinamiento por argumentos.
  Inventario (plantilla `~/Documents/screens/orchestos-ai-agent-dashboard` vs app, 2026-09-22); cada uno
  necesita backend que hoy no existe (`server.ts` no tiene ruta):
  1. Sidebar Dev: cerrar agente → pasa a History (`ShellSidebar.tsx:394` plantilla); falta archivar sesión.
  2. Inspector History (`OrcaRightInspector.tsx:399-560` plantilla): sesiones cerradas agrupadas por
     proyecto, Workspace|Project|All, búsqueda, detalle expandible, menú (restaurar/borrar).
  3. Borrar/quitar proyecto (`ShellSidebar.tsx:310`, `DeleteProjectModal`): falta endpoint para
     des-registrar un proyecto (no borra archivos).
  4. Dev: consola del agente con logs del turno en vivo (`OrchestDevWorkspace.tsx:120-185` plantilla) y
     controles de acción; entrada de comandos interactiva — decisión de Carlos pendiente (ejecuta shell).
  5. Chat: razonamiento y llamadas a herramientas reales en el mensaje del bot; tarjeta de tarea retenida
     con Aprobar/Rechazar contra la API real (el render ya existe, falta verificar que llegan los datos).
  6. Duración/tiempo relativo de agentes (`0m` casi siempre).
  **Decisiones de Carlos 2026-09-22:** consola = logs reales del turno + línea que ejecuta shell en la
  carpeta del proyecto con la misma frontera de permisos del runner; cerrar agente = archivar (History
  permite restaurar o borrar definitivo); borrar proyecto = solo des-registrarlo de OrchestOS con sus
  sesiones, nunca toca archivos del disco.
  **UI.13.4b (2026-09-22):** spec `docs/specs/UI.13.4b.md`. Carlos eligió: la consola reemplaza al chat en Dev
  (como la plantilla), la frontera es idéntica al runner (`runOneCheck`: sin shell, cwd confinado, env
  filtrado, timeout) y los comandos se guardan en DB. Luego, "hagamos lo mejor": la frontera se
  endurece en `runOneCheck` para ambos (argumentos con forma de ruta confinados al proyecto; los checks internos, `trusted`).
  Gate: cada comportamiento hecho en vivo contra la API, igual que en la plantilla.
- [ ] **UI.13 — 🧠 El prototipo de AI Studio ES el frontend: fuera el vanilla JS/CSS.** (abierto 2026-09-21)
  **Decisión de Carlos 2026-09-21, textual:** *"vanilla JS y el CSS ME ESTÁN DANDO PROBLEMAS QUE YA
  UN FRAMEWORK ME LO HIZO EN MINUTOS!!!! no quiero ver nada de ese código, solo tengamos de
  ejemplo"*. Reemplaza el resto de `UI.12` (2b, 3a–3d: trasplante pieza a pieza dentro del vanilla;
  UI.12.2 costó 7 rondas y UI.12.2b otras 5 solo afinando el spec, por choques con CSS viejo y
  gates de píxel). El diff de UI.12.2b quedó en `git stash` ("UI.12.2b de Luna…").
  **Regla de la cadena:** el código del prototipo (`~/Documents/screens/orchestos-ai-agent-dashboard/src`)
  se copia **tal cual**: componentes, className, animaciones, vistas. Lo único que se escribe es la
  capa que cambia sus mocks (`src/data/*.ts`) por la API real (`/api/*`, que no cambia). El vanilla
  (`src/dashboard/public/*.js`, `styles.css`, `screens.css`, islas) es solo **referencia** para saber
  qué endpoint y qué payload usa cada acción; no se edita ni se migra su markup. Gates: comportamiento
  real (acción → efecto en la API/DB) en el dashboard corriendo, no medidas en píxeles.
  1. `UI.13.1` Andamio: prototipo copiado a `src/dashboard/app/`, build con Bun, servido en `/`;
     el vanilla pasa a `/legacy` hasta que el último ítem lo borre.
     **Carlos 2026-09-22: cero trabajo sobre el vanilla** — `/legacy` es un cascarón de referencia que
     no se arregla ni se alimenta; look, animaciones, iconos, textura y comportamiento salen de la
     plantilla `~/Documents/screens/orchestos-ai-agent-dashboard`. Lo que se conserva del producto
     (ej. usage en la barra inferior) se porta con el look de la plantilla.
     **Carlos 2026-09-22 (2): los comportamientos de la plantilla se hacen reales, no se quitan.** Lo que en el
     prototipo es hardcodeado (terminal del agente, History, cerrar agente → historial, borrar proyecto,
     razonamiento/herramientas en el mensaje del bot, etc.) es la especificación de cómo debe comportarse
     OrchestOS. "Sin backend → se quita" queda reemplazado por "sin backend → ítem para construirlo" (UI.13.4).
     **Carlos 2026-09-22 (3), "SI go":** las pantallas de la plantilla sin backend se copian **ya, tal cual**,
     con sus datos de ejemplo visibles, en vez de esperar la API; se conectan después, una por una (sigue
     valiendo "sin backend → ítem para construirlo", pero la pantalla no espera). Pasada de fidelidad
     pantalla por pantalla con capturas lado a lado revisadas por el cerebro (la auditoría con haiku no sirvió).
     Detalles reportados por Carlos el mismo día (ítem UI.13.5):
     a) barra inferior: al hacer clic no pasa nada; clic en usage → solo cuota 5 h y semanal;
     b) input del chat: Claude/Codex/OpenCode/API parecen hardcodeados → deben salir de los CLI detectados;
        elegir Claude contestó "Opus 5.5": el selector debe dejar elegir modelo y esfuerzo por CLI
        (modelo = decisión de Carlos, nunca implícito);
     c) iconos propios de cada CLI (Claude, Codex/ChatGPT, OpenCode…) con colores vivos;
     d) Settings → Usage es un caos: rediseñar como la vista de uso de GitHub.
  2. `UI.13.2` Datos: capa `api.ts` que reemplaza los mocks, vista por vista — Chat, proyectos/Dev,
     Settings, Tasks/Runs/Graph, Memory/Specs/Skills/Instincts/Plan (un sub-ítem cada una).
  3. `UI.13.3` Borrar el vanilla, `/legacy`, sus islas, sus CSS y los ui-gates de píxel.
  **Tope de tiempo (Carlos, 2026-09-21): lo que falta de UI.13 cabe en 2 h de la sesión siguiente.**
  Para eso: un spec y una ronda por bloque grande (Settings; Tasks/Runs/Graph; Memory/Specs/Skills/
  Instincts/Plan), sin sub-ítems; el ejecutor recibe también la lista de lo que el gate va a medir para
  no enterarse en la ronda 2; gate del cerebro = smoke en vivo (carga con datos reales, 0 errores, una
  acción clave por vista), no inventario exhaustivo. Una vista que no cierre en su ronda queda con su
  ruta en `/legacy` y se anota; no se abre una tercera ronda dentro del tope.
- [ ] **UI.9.9 — 🧠 Opciones de proyecto al hover: `Project settings` y `Delete project`.** (abierto 2026-09-18)
  Pedido de Carlos del 2026-09-16 (anotado abajo) y repetido el 2026-09-18. Al pasar el cursor por
  la fila de un proyecto, botón de tres puntos a la derecha con acciones de proyecto. Incluir
  también un control claro de expandir/colapsar los agentes de ese proyecto.
  **Estado real leído en el código:** no existe en ninguna capa. `Sidebar.tsx:243-254` solo tiene
  el `+` de agregar agente; `SessionRow` sí tiene borrado (`Sidebar.tsx:441-451`), los proyectos
  no. **No hay endpoint de borrado de proyecto** en `server.ts` — es backend + front.
  **Semántica del borrado — respondida por Carlos el 2026-09-18, no volver a preguntarla.** Son
  **dos niveles distintos**, y `Delete project` es el suave:
  - **`Delete project` (menú de tres puntos) borra el ESPACIO DE TRABAJO, no los datos.** Textual:
    *"borrar el proyecto significa borrar ese espacio de trabajo"*. Sale de la lista; la data
    sobrevive. **No hay cascada acá**, así que tampoco hace falta un diálogo que enumere lo que se
    lleva puesto.
  - **Borrar la data definitivamente vive en `Project settings`**, dentro del proyecto, como acción
    aparte y explícita: *"para borrar la data definitivamente habría que ir al project settings y
    ahí borrar todo sobre el proyecto"*. Carlos lo da por sobreentendido — es el patrón habitual de
    "quitar de la lista" vs. "destruir".
  **Referencia de comportamiento, Orca (citada por Carlos):** si borra un workspace y lo vuelve a
  abrir, sigue viendo la barra lateral con `workspace | projects | all`, el **source control** y el
  **explorer** (el repo en sí). O sea: reabrir un proyecto borrado del espacio de trabajo lo
  restituye con su contenido, porque nunca se destruyó nada. Ese es el criterio de aceptación real
  del ítem, más que el botón.
  Al diseñarlo, volver a mirar las capturas de Orca (`docs/ui-reference-patterns.md` A.1-A.3).
  Gate: navegador real — borrar un proyecto del espacio de trabajo, **volver a agregarlo con
  "+ Add project"** y confirmar que sus chats/tasks/runs siguen ahí; y confirmar en SQLite que el
  borrado suave NO tocó esas tablas.
- [ ] **UI.9.8 — ⚡ Barrido de texto que no aporta, y el modelo elegible en Codex.** (abierto 2026-09-18)
  **Pedido textual de Carlos, 2026-09-18:** *"donde detectes que exista en la UI texto adicional
  que no aporta a nada debe DESAPARECER"*. Disparador: bajo cada respuesta del chat aparece
  `codex (cli default model) via Codex CLI` — *"esto está demás"*. Es la **tercera vez en el
  mismo día** que señala lo mismo: antes fueron `Model: Decided by Codex · your subscription` y la
  fila `Agent`, ambas cerradas en UI.9.7. El patrón se repite porque cada ítem arregla su
  instancia y no el criterio; por eso este ítem barre, no parchea.
  **Dónde vive el caso concreto:** `screens-core.js:415-416` pinta `.chat-model-tag` con el
  `resultLabel` que compone `chat.ts:1374,1426`. **El dato no se borra del backend** —
  `resultLabel` alimenta el costeo (`canonicalModel`, `chat.ts:1248`) y
  `rememberResolvedClaudeModel()` (`screens-core.js:760`) aprende de `data.model`. La regla es de
  superficie: se deja de renderizar, no se deja de calcular.
  **Alcance del barrido:** recorrer las pantallas que Carlos usa hoy (chat y el shell Dev) y
  listar cada texto que no habilita una decisión ni informa algo que el usuario no sepa.
  **Borrar, no acortar.** Traer la lista antes de borrar lo dudoso; lo evidente se borra.
  Cuidado con el modo de fallar de UI.9.7: sacar una etiqueta dejó alcanzable un fallback con el
  literal `'CLI default model'` — verificar lo **renderizado**, no el diff.
  **Segunda parte — elegir modelo en Codex** (*"en el chat Dev no puedo elegir el modelo"*).
  Es lo que UI.9.7 dejó fuera por no haber catálogo verificado. Investigar antes de diseñar:
  `~/.codex/config.toml` sí declara el modelo (`codex.ts:75-79` lo leyó: decía `gpt-5.6-luna`),
  y los alias reales están en `AGENTS.md:293-299` (Luna/Terra/Sol/Astra). Ninguna lista
  hardcodeada de catálogo frágil — ver `feedback-deteccion-generica-no-por-cli`. Si no hay fuente
  confiable, decirlo y no poner un selector decorativo.
  Gate: navegador real, cero texto de los listados sobreviviendo, y el modelo elegido llegando al
  binario con un mensaje real (como se hizo con el esfuerzo en UI.9.7).
- [ ] **UI.10.A — 🧠 El plan por proyecto: `plan_items` y `plan_doc_segments` con proyecto.** (abierto 2026-09-21)
  Sale de `UI.10`: el plan de la DB es uno solo, sin columna de proyecto, y `renderPlan(db)`
  (`handlers/plan.ts:22`) arma siempre el de OrchestOS. Hoy la pestaña Plan de cualquier otro
  proyecto muestra "not available yet" (`server.ts`, rutas `/api/plan*`). A diseñar: migración
  (`project_id` + PK compuesta), `plan-import`/`plan:reconcile`/`plan:render` y el pre-commit por
  proyecto, y quitar el corte por cwd de `server.ts`. Plan corto a Carlos antes de codear (toca
  varios módulos).
  **HALLAZGO QUE CAMBIA EL DISEÑO (2026-09-21, leído en el código y en el disco):** el `PLAN.md` de
  SalaDespecho es una checklist libre (`- [ ] Auditar…`, sin ID ni 🧠⚡🔍). El parser
  (`scripts/plan-status.ts:45`) exige `- [ ] **ID — 🧠 Título**`: sobre ese archivo devuelve **0
  ítems**. Y el modelo "la DB es la fuente, `PLAN.md` se renderiza" solo se sostiene porque el
  pre-commit de **este** repo corre `plan:render --check`; en otro repo nadie reconcilia, y a la
  primera edición a mano vuelve el 409 "out of sync". Migrar las tablas (`project_id` + PK
  compuesta) no alcanza para que el Plan de SalaDespecho muestre algo.
  **Opciones planteadas a Carlos:** (a) migración completa, y los proyectos adoptan el formato de
  OrchestOS y su hook; (b) sin migración: para un proyecto que no es OrchestOS, la pestaña Plan
  lee su `PLAN.md` en solo lectura (secciones `##` y checkboxes, sin dependencias ni cierre), un
  módulo nuevo más `server.ts`; (c) las dos. Recomendación del cerebro: (b). Pendiente de Carlos.
  **DECIDIDO POR CARLOS 2026-09-21: (b).** Cada proyecto usa su propio `PLAN.md`, en solo lectura;
  no se le impone el formato de OrchestOS. Sin migración de `plan_items`.

> **DECISIONES DE CARLOS 2026-09-21 — sidebar de proyectos, look nuevo y etiquetas del plan.**
> Contestadas en una sola ronda (memoria `feedback-preguntas-todas-juntas`). Pendientes de
> convertirse en ítems; no se implementan sueltas.
> 1. **Fila de proyecto:** icono `folder-closed` (lucide) en vez del libro actual. En hover, a la
>    derecha, tres iconos: chevron de expandir, `ellipsis` y `plus`; sin hover desaparecen. El
>    clic **solo expande/colapsa sus agentes**, no navega (hoy salta a Dev → Tasks,
>    `app.js:3410`). Sin nada elegido, el área principal queda vacía con el SVG de OrchestOS.
> 2. **Menú `ellipsis` del proyecto:** solo *Project settings* y *Delete project* (icono rojo).
>    *Project settings* lleva a Settings (la página de proyecto de `UI.10`). No existe hoy ni en
>    el front ni en el back (no hay endpoint para borrar un proyecto).
> 3. Tasks, Runs y Graph dejan de abrirse al clickear el proyecto; se ven solo desde su settings.
> 4. **Cerrar un agente = archivarlo** en un historial por proyecto, al estilo del panel "Agents"
>    de Orca en el lateral derecho. Hoy no hay forma de cerrarlos ni endpoint.
> 5. **Contador de agentes:** chip chico, siempre real, sin tener que expandir (hoy se carga
>    solo al expandir, `Sidebar.tsx:284-295`). La altura del chevron (hoy muy abajo) **no se
>    parchea con CSS suelto**: se arregla cuando se rehaga la cara del sidebar en React. Mismo
>    criterio para cualquier ajuste visual pedido antes de ese cambio: anotarlo, no gastar tokens.
> 6. **Adiós a 🧠⚡🔍:** reemplazar por etiquetas de texto propias que cualquier LLM entienda.
>    Toca parser (`scripts/plan-status.ts:45`), `CHECK` de `plan_items.delegation` y los ítems del
>    plan en un solo cambio.
> 7. = decisión (b) de arriba.
> 8. **Look nuevo pieza por pieza**, pero cada pieza tiene que verse como las referencias. Si una
>    referencia no está anotada con su fuente, preguntar en vez de suponer. Objetivo dicho por
>    Carlos: "CRM moderno".
> 9. **Referencia nueva:** Circle (https://circle.lndev.me/lndev-ui/team/DESIGN/overview, repo
>    `ln-dev7/circle`, Next.js + shadcn/ui, estilo Linear). La guía principal sigue siendo
>    `docs/ui-reference-patterns.md` + capturas en `~/Documents/screens/`.
> **Segunda ronda, mismo día:**
> - **Panel derecho = historial de agentes**, captura nueva `~/Documents/screens/rightside_agents.png`
>   (Orca): tabs de iconos arriba (archivos, agentes, source control, tasks) + toggle del panel;
>   título + "N shown", segmented `Workspace | Project | All`, buscador, grupo por proyecto con
>   contador, y por sesión: título, última línea, icono del CLI, mensajes, hace cuánto, modelo,
>   chevron y `ellipsis`. Cerrar un agente del sidebar lo manda acá. **No se llama "Agents"**: el
>   cerebro elige **"History"** (i18n "Historial").
> - **El botón que mostraba el panel derecho vuelve a ser permanente.** Hoy los botones de
>   Explorer/Diff/Terminal solo viven en la barra de tabs del workspace (arreglo de `UI.9.A`), y con
>   la decisión 1 (el clic en proyecto ya no abre el workspace) se vuelven a perder. Toggle fijo
>   arriba a la derecha, como en Orca. Esto reemplaza el criterio "inspector cerrado = 0px" de
>   `UI.9.5`.
> - **Quitar el pill `IDLE`/`RUNNING`** del header (`Header.tsx:18-21`).
> - **Estado del agente en la fila:** loader chico mientras trabaja, check chico al terminar.
> - **Delete project = quitar del espacio de trabajo**, sin borrar la carpeta, con confirmación;
>   coincide con lo que ya fijó `UI.9.9` el 2026-09-18 (ese ítem ya existía y es la pieza 2).
> - **Tema:** oscuro por defecto. Renombrar los temas: `claude` no puede llamarse así
>   (`theme.js:9`, `i18n.js:829,1742`).
> - Reparto de referencias no contestado explícitamente: se sigue la recomendación (estructura de
>   Orca, piel visual Circle/Linear, oscuro). Si Carlos lo corrige, manda lo suyo.
> **Orden aprobado ("GO"):** 0. `CI.2.A` (Luna, spec listo). 1. Sidebar de proyectos en React con
> la cara nueva (decisiones 1 y 5, loader/check, sin pill IDLE). 2. `UI.9.9` menú `ellipsis`
> (Project settings / Delete project) + back. 3. Panel derecho History + archivar agente + toggle
> permanente. 4. `UI.10.A` plan de cada proyecto en solo lectura. 5. Etiquetas de texto en vez de
> emojis. Temas renombrados entran en la pieza 1.
- [ ] **CI.2 — 🧠 Los 12 ui-gates no los corre nada: hacerlos exigibles.** (abierto 2026-09-18)
  **Medido el 2026-09-18, no estimado:** `ci.yml:15-19` corre `bun install`, `db:migrate`,
  `test:coverage`, `typecheck` y `lint`. `scripts/pre-commit.sh` corre `tsc`, `security:secrets`,
  `ledger:gate`, `plan:render`, `check-live-gate`, `check-ui-copy` y `check-scope-lock`.
  `scripts/pre-push.sh` corre `test:coverage`. **Ninguno toca `scripts/ui-gates/`**, donde hay
  **12 scripts** (`ui0`, `ui1`, `ui1b`, `ui2`, `ui3`, `ui4-specs`, `ui4-skills`, `ui81`, `ui97`,
  `at91`, `s6`, `s6a`). Se corren a mano el día que cierra su ítem y nunca más.
  **Consecuencia ya pagada, no hipotética:** el gate de `UI.9.4` pasó una vez y el botón
  "+ Add project" se pudrió **dos veces** —invisible por CSS con el sidebar colapsado, después
  borrado por `UI.9.1`— sin que nada se pusiera rojo, con el ítem en `[x]` todo el tiempo
  (`UI.9.7`). Es exactamente el patrón de la Regla cero de `CLAUDE.md`: una regla que nadie hace
  cumplir mecánicamente deja de existir.
  **Pregunta que Carlos hizo y que este ítem contesta** (2026-09-18): *"¿este cambio que se hizo
  se lo tomará en cuenta [al cambiar toda la interfaz]?"*. Hoy no. Lo que tiene que sobrevivir a
  `UI.4`/`UI.5` no es el CSS, es el gate — y hoy el gate tampoco se hace cumplir.
  **A resolver en el diseño, no asumir:** los ui-gates necesitan un dashboard corriendo y
  Playwright; medir cuánto tardan los 12 juntos antes de decidir si van a CI, a `pre-push` o a un
  workflow aparte. Si el costo es mayor que el beneficio, decirlo con el número y proponer un
  subconjunto — no meter 12 gates en cada push por principio.
  Relacionado: `bun run lint` está **rojo por 17 hallazgos preexistentes** (`check-coverage.ts`,
  `check-ledger-gate.ts`, `check-secrets.ts`, `check-test-assertions.ts`, `context-adapters.ts`,
  `eval-run.ts`, `check-sources-drift.test.ts`, `tests/run/*.test.ts`, `docs/done/evidence/*.json`),
  todos `FIXABLE`. CI lo ejecuta, así que CI sigue rojo por eso. Un CI que falla siempre deja de
  dar señal — mismo corolario que `CLAUDE.md` ya dejó escrito el 2026-08-01.
  **Hallazgo 2026-09-18 que amplía este ítem: correr los 12 gates NO basta.** El diagnóstico de
  `UI.9.A` mostró que `30ab117` reescribió `scripts/ui-gates/ui3-shell.mjs` en el **mismo commit**
  que cambió la pantalla, y el gate resultante abre el inspector con
  `page.evaluate(() => window.OrchestOS.openInspectorTool('terminal'))` (`ui3-shell.mjs:58`) en vez
  de clickear. Es estructuralmente incapaz de notar que no existe ningún botón: pasaría en verde con
  cero afordancias en pantalla. Los tres casos comparten forma —"+ Add project" invisible por CSS
  (el gate medía existencia en DOM, no visibilidad), "+ Add project" borrado por `UI.9.1` (el gate
  no se volvió a correr), inspector (el gate se reescribió para saltarse la UI)—: **los gates
  afirman sobre estado alcanzable desde JS, no sobre lo que un humano alcanza con el mouse desde un
  arranque en frío, y los escribe el mismo ítem que cambia la pantalla.**
  Dos propiedades que el diseño de `CI.2` tiene que resolver además de la frecuencia:
  1. **Camino clickeable desde frío:** toda función del producto se ejerce clickeando. Prohibido
     `window.OrchestOS`/`window.state` para *llegar* a una pantalla en un gate (sí para *afirmar*
     sobre el estado una vez ahí). Medir cuántos de los 12 gates violan esto hoy.
  2. **Inventario de afordancias:** algo tiene que comparar qué controles clickeables existían antes
     y cuáles después de un commit, y ponerse rojo cuando desaparece uno que nadie mandó quitar. Sin
     esto, un gate reescrito por el mismo ítem que rompe la pantalla nunca da señal.

  **MEDICIÓN EJECUTADA 2026-09-18 (números reales, un dashboard en :4323, `BASE`/`GATE_BASE`
  apuntando ahí; no estimaciones).** Son **13** gates, no 12 — `ui9a-inspector.mjs` se sumó ayer.

  | gate | runtime | tiempo | resultado hoy |
  |---|---|---|---|
  | `at91-format-smoke` | node | 15.4s | verde (formato JSON, sin líneas PASS/FAIL) |
  | `s6-sprint-board` | **bun** | 31.7s | **ROJO — podrido** |
  | `s6a-sprint-board` | **bun** | 31.6s | **ROJO — podrido** |
  | `ui0-islands` | node | 9.3s | ROJO (2 FAIL) |
  | `ui1-model-combo` | node | 15.0s | verde (27 PASS) |
  | `ui1b-remaining-callsites` | node | 8.5s | verde (9 PASS) |
  | `ui2-design-system` | node | 13.2s | ROJO (1 FAIL) |
  | `ui3-shell` | node | 10.0s | verde (20 PASS) |
  | `ui4-skills-screen` | node | 11.4s | verde (22 PASS) |
  | `ui4-specs-screen` | node | 14.4s | ROJO (2 FAIL) |
  | `ui81-visual-consistency` | node | 5.0s | ROJO (1 FAIL) |
  | `ui97-bugs` | node | 11.5s | verde (25 PASS) |
  | `ui9a-inspector` | node | 4.1s | verde (17 PASS) |

  **Serie completa: ~181s (3 min)** con el runtime correcto de cada uno. **6 de 13 están rojos hoy**,
  sin que nadie lo supiera.

  **Paralelizar no es opción — medido, no supuesto.** Los 11 gates de node lanzados a la vez contra
  el mismo dashboard: **98s** (apenas menos que en serie) y **resultados basura** — 9 de 11
  terminaron con 0 PASS / 0 FAIL por `TimeoutError` de contención. Los gates asumen un dashboard
  para ellos solos. Paralelizar exige un dashboard por gate, y ahí el ahorro se lo come el arranque.

  **Dos podridos que la medición destapó, y son la prueba del ítem:**
  - `s6`/`s6a` se importan con `bun:` y **fallan de entrada con `node`**
    (`ERR_UNSUPPORTED_ESM_URL_SCHEME`). Con `bun` sí arrancan, y ahí mueren en
    `click: Timeout 30000ms exceeded — waiting for locator('#navModeBtn')`: ese botón **ya no
    existe**, lo borró `UI.7` al eliminar el flag de modo. Es el mismo patrón que el "+ Add project":
    el gate quedó en `[x]` mientras la pantalla que medía desapareció.
  - Ni siquiera hay un runtime común: 11 gates son `node`, 2 son `bun`. Nada lo declara en ningún
    lado; se descubre corriéndolos.

  **Propiedad 1 medida (camino clickeable desde frío): 6 de 13 la violan hoy** —
  `ui3-shell.mjs:58` (`window.OrchestOS.openInspectorTool`), `ui1-model-combo.mjs:37`,
  `ui1b-remaining-callsites.mjs:54-118`, `ui4-specs-screen.mjs:58-212`,
  `ui4-skills-screen.mjs:47-204`, `ui81-visual-consistency.mjs:31` (todos siembran o navegan por
  `window.state` en vez de clickear). Los 7 restantes ya llegan clickeando.

  **Veredicto del número, antes de elegir dónde corren:** 3 min descarta `pre-push` (hoy tarda 20s;
  multiplicarlo por 10 lo vuelve un `--no-verify` garantizado) y descarta meterlos en el job de CI
  actual. Y con 6 de 13 rojos, engancharlos hoy a cualquier gate obligatorio los deja rojos
  permanentes — exactamente el corolario que `CLAUDE.md` ya dejó escrito el 2026-08-01 ("un CI que
  falla siempre deja de dar señal"). El orden obligado es: **primero verdes, después exigibles.**

  **DIAGNÓSTICO DE LOS 6 ROJOS (2026-09-18, leído en el código y probado en vivo).** Pedido por
  Carlos antes de decidir. El reparto importa: **5 de 6 son el gate podrido, 1 es un bug real
  del producto.** Eso es el ítem probándose a sí mismo.

  - **`ui2-design-system` — EL PRODUCTO, no el gate.** `.filter-tab` usa
    `border-radius: var(--radius-lg)` (`screens.css:100`) y ese token vale **8px**
    (`styles.css:44`). El componente React tiene `rounded-[20px]` **hardcodeado**
    (`tabs.tsx:35`), con un comentario encima que afirma "Espeja `.filter-tab`: … radio 20px".
    Alguien bajó el token de 20px a 8px y el React quedó atrás: hoy las pestañas React se ven
    distintas de las vanilla en pantalla. Arreglo: consumir el token, no repetir el número.
  - **`ui0-islands` — gate de una fase superada.** Afirma "sin `?island-probe` no se monta
    ninguna isla". Era la regla del Mes 30 mientras React era experimental. Hoy hay **4 islas
    permanentes en producción a propósito**: `model-combo` (`app.js:2675`), `screen-specs`,
    `screen-skills` y `screen-plan` (`screens-ops.js:2352-2388`). El producto está bien; la
    afirmación caducó con `UI.1`/`UI.4`.
  - **`ui4-specs-screen` — dos afirmaciones caducadas.** (a) Exige 5 `<th>` incondicionalmente,
    pero la 5ª columna es el checkbox de bulk y está detrás de `selectable`
    (`SpecsScreen.tsx:178`); el gate nunca entra en modo bulk. (b) Busca `.badge` amber/green,
    pero `UI.3.5` reemplazó los dos badges de color por `StatusRail` —glifo + mono—
    deliberadamente (`SpecsScreen.tsx:292-299`).
  - **`ui81-visual-consistency` — trinquete mal diseñado.** Los 5 `[style]` de Chat son:
    `display:none` del `#chat-file-input`, un `pointer-events:none`, y **3 barras
    `.session-statusbar-cli-fill` con `width:<pct>` dinámico — una por CLI**. El baseline de 4 se
    calibró con menos CLIs. Cuenta atributos `[style]` a ciegas, así que se pone rojo cuando
    cambian los **datos** (cuántos CLI hay configurados), no cuando empeora el código, y mete en
    la misma bolsa el `width` calculado —única forma correcta de pintar una barra— que un estilo
    de maquetación pegado a mano.
  - **`s6` / `s6a` — se reparan, no se borran.** Miden el sprint board y el ciclo `commitPending`,
    y **esa pantalla sigue viva**: es la isla `screen-plan` → `PlanBoardScreen` (`ui.tsx:47`). Lo
    que murió es el camino: `#navModeBtn`, el toggle humano/operador que ambos clickean
    (`s6:98,168`, `s6a:102,157,178,213,254`), lo borró `47b40c6` (`UI.8.3`, "muere el modo
    avanzado"). Mismo patrón que "+ Add project" y que el inspector de `UI.9.A`. Además hay que
    **declarar el runtime**: importan `bun:` y revientan con `node`
    (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); nada en el repo dice cuál usa cuál.

  **DECIDIDO POR CARLOS 2026-09-18 — dónde corren:** workflow de CI **aparte**, no `pre-push` ni
  el job de `ci.yml`. Levanta el dashboard, corre los 13 en serie (~3 min) y no toca la velocidad
  del push local ni contamina el job de tests. Pendiente de decisión: qué se repara primero.

  **PENDIENTE DE DECISIÓN DE CARLOS (planteado 2026-09-18, sin respuesta todavía):** son dos
  trabajos distintos. El de `ui2` es un fix de producto de una línea (token en vez de `20px`
  hardcodeado). Los otros 5 son reescribir afirmaciones de gates — y cuatro de ellos (`ui0`,
  `ui4-specs`, `s6`, `s6a`) hay que reescribirlos igual bajo la propiedad 1 (llegar clickeando,
  no por `window.state`), así que repararlos ahora por separado es hacer el trabajo dos veces.
  Opciones: (a) un solo ítem "despodrir + reescribir clickeando los 13"; (b) el fix de `ui2` ya,
  suelto, y el resto después. Nadie arranca a reparar hasta que esto se decida.
  **DECIDIDO POR CARLOS 2026-09-21:** `ui2` ya salió suelto (`UI.9.B`); los **5 restantes**
  (`ui0`, `ui4-specs`, `ui81`, `s6`, `s6a`) van en **un solo ítem**, `CI.2.A`: se despudren y se
  reescriben llegando clickeando en la misma pasada. Spec del cerebro, ejecuta Luna.
  **BLOQUEO HALLADO AL PREPARAR EL SPEC (2026-09-21, inventario de Luna, verificado por el
  cerebro en el código):** Specs, Skills y Plan board **no tienen camino clickeable desde frío**.
  `NAV` solo lista `chat` y `settings` (`app.js:144-149`), y el Sidebar solo pinta esos `data-nav`
  (`Sidebar.tsx:354-367`). En todo el front, el único `App.go` a una de esas tres pantallas es
  `App.go('skills')` desde el resultado de búsqueda de una skill en la paleta (`app.js:2335`).
  Specs y Plan board no se alcanzan de ninguna forma. Las islas `screen-specs`/`screen-skills`/
  `screen-plan` (`screens-ops.js:2349-2390`) montan bien, pero **ningún humano llega a ellas**:
  es el mismo patrón que "+ Add project" y el inspector, ahora en tres pantallas enteras, y los
  gates en verde lo tapaban justamente porque navegaban por `window.state`. Esto deja a 4 de los 5
  gates (`ui0`, `ui4-specs`, `s6`, `s6a`) sin camino que clickear. Solo `ui81` (Chat) se puede
  reescribir ya. **Decisión de producto pendiente de Carlos:** dónde vuelven a estar accesibles
  estas pantallas, o si se retiran (y con ellas sus islas y sus gates).

  **Efecto secundario descubierto al medir, a resolver en el diseño:** correr los gates **muta el
  working tree**. `at91-format-smoke` sobreescribió `docs/done/evidence/AT.9.1-live.json` —la
  evidencia de cierre commiteada el 2026-09-15— con la corrida de hoy (revertido a mano), y
  `ui0`/`ui1`/`ui1b`/`ui2`/`ui4-*` dejan PNGs sueltos en la raíz del repo. Un workflow que corre
  los 13 en cada push no puede ir pisando evidencia histórica: los artefactos van a un directorio
  temporal o a artifacts del job, nunca sobre archivos versionados.

  **Y lo más grave, descubierto al intentar commitear esta medición: `s6a` escribe en la DB real
  del usuario.** El pre-commit abortó con `render(DB): "# S.6a fixture"` — `~/.orchestos/db.sqlite`
  había quedado con los **3 ítems del fixture (A, B, C)** en lugar de los **113 de `PLAN.md`**, y
  `plan_doc_segments` con el documento del fixture. `src/db/sqlite.ts:12` congela `DB_PATH` en el
  primer import a partir de `ORCHESTOS_HOME`, y el fixture de `s6`/`s6a` no aísla esa parte. El
  resto de las tablas quedó intacto (projects 2, chat_sessions 11, runs 111, run_steps 45), así
  que el daño fue acotado a `plan_items`/`plan_doc_segments`. Reparado con `bun run plan:reconcile`
  (113 ítems reconciliados desde `PLAN.md`, 3 huérfanos A/B/C borrados; `plan:render --check`
  verde, `bun run next` vuelve a listar los 27 de siempre), con copia previa en
  `~/.orchestos/db.sqlite.pre-reconcile-*`. **Lo salvó que `PLAN.md` es la fuente versionada.**
  Requisito duro para el workflow de `CI.2`: ningún gate corre sin `ORCHESTOS_HOME` aislado, y eso
  se verifica en el propio gate, no se confía. Si esto hubiera pasado en una tabla sin respaldo en
  git —`runs`, `chat_messages`— no había vuelta atrás.
  **Aislamiento de `s6`/`s6a` HECHO 2026-09-21.** Causa: importan `src/db/sqlite.ts` en el mismo
  proceso (`s6a-sprint-board.mjs:79`) sin `ORCHESTOS_HOME`. Ahora cada uno crea un home temporal
  propio, lo fija antes de cualquier import y **aborta si `DB_PATH` no cae dentro** (el requisito
  de arriba, verificado en el gate). Evidencia en vivo: ambos corridos con `bun`; mueren en el
  `TimeoutError` de `#navModeBtn` —después de `importPlan`— y la DB real queda igual antes y
  después (114 `plan_items`, 0 de A/B/C, 225 `plan_doc_segments`). Los otros 11 gates no abren la
  DB: pegan a un dashboard externo (`BASE`), así que su aislamiento depende de cómo se levanta ese
  dashboard — lo resuelve el workflow.

## Fase 2 — Producto mínimo para entrega

- [ ] **AT.10 — 🧠 El chat usa de verdad el CLI elegido: Codex y OpenCode, sin caída silenciosa a OpenRouter.**
  **Progreso 2026-09-15 (backend, ejecutado por luna · spec en `docs/specs/AT.10.md`, sigue
  abierto):** `chat.ts:1098-1101` ya no pasa `deepseek/deepseek-v4-flash` como default a
  `runCodexChat`/`runOpencodeChat` cuando `body.model` no vino explícito (`cliModel`); OpenCode sin
  modelo se etiqueta `CLI default model`; el catch de OpenCode ya devolvía 502 `provider=opencode`
  sin retry. Tests en `chat-sessions.test.ts` (12 pass) y `bun run test:coverage` (1430 pass) verdes.
  Gate en vivo parcial — `docs/done/evidence/AT.10-live.json`: Codex cierra completo (sesión real,
  sin credencial de OpenRouter en el entorno, SQLite confirma `provider=codex`, respuesta correcta,
  sin fuga). OpenCode queda **bloqueado, no roto por este fix**: `opencode auth list` en esta
  máquina solo tiene una credencial OpenRouter y ningún modelo/provider default propio — sin
  `-m/--model` explícito el binario no tiene con qué correr (`opencode produced no step-finish
  event`), confirmado que no reintenta por OpenRouter (SQLite `provider=opencode`, `status=failed`).
  Fijar el modelo interno de OpenCode es explícitamente fuera de scope de este ítem — no cerrar
  AT.10 hasta repetir el gate con OpenCode configurado con su propio default en la máquina de
  prueba. El picker del composer y el mini-menú de "Nuevo chat" quedan para `ERP.1`
  (`docs/specs/ERP.1.md`, ver contrato vigente en `PLAN.md:30-45,63-84`), que reemplaza el texto
  original de abajo sobre `CHAT_UNSUPPORTED_AGENTS`/`PUT /api/config` como plan de UI.

  **Decisión de Carlos, 2026-09-15 — el gate de OpenCode queda "visto, a planificar con otro
  modelo" (Opus/Astra), no se fuerza ahora:** OpenCode conectado a OpenRouter con sus modelos
  gratuitos es su uso normal para Carlos — no es un caso a "arreglar" con un modelo default
  genérico. El punto real es más grande que este ítem: tratar OpenCode como CLI con reglas
  propias, no como un motor de chat más. Para OpenCode específicamente, la superficie de "chat"
  debería dejar de existir y convertirse en una **ventana de trabajo libre** donde OpenCode actúa
  con su propia configuración — el mismo patrón que usa Orca. Cierra el ítem AT.10 solo con el
  verdadero contrato mínimo (Codex ya lo cumple); el rediseño de la superficie de OpenCode se
  planifica aparte, no se resuelve ad-hoc dentro de este spec. Sin ítem propio todavía — abrir uno
  cuando se planifique.

  Bloqueo reproducido por Carlos el 2026-09-15 y confirmado leyendo el recorrido: AT.9 conectó
  las ramas backend de Codex/OpenCode, pero `src/dashboard/public/app.js:2908` todavía las incluye
  en `CHAT_UNSUPPORTED_AGENTS`; además, elegir un agente solo hace `PUT /api/config` y no reemplaza
  la sesión activa, cuyo `agent` quedó persistido al crearla. El proyecto sigue con `agent: api`,
  `app.js:108` conserva DeepSeek como modelo inicial y `chat.ts:1098` lo usa como fallback. En
  OpenCode ese id sí se traduce a `openrouter/deepseek/...`, por lo que hoy es posible seleccionar
  conceptualmente un CLI y seguir usando DeepSeek/OpenRouter. No presentar AT.9 como selección
  end-to-end hasta cerrar este ítem.

  **Contrato de esta pasada (Codex + OpenCode):**
  1. El picker del chat habilita `codex` y `opencode` solo cuando
     `GET /api/system/executor-modes` los detecta; si falta el binario, queda visible y deshabilitado
     con el error concreto. Quitar el comentario/allowlist obsoletos que todavía dicen que el
     backend no los soporta.
  2. Elegir un CLI persiste `agent` y crea/activa inmediatamente una **sesión nueva** con ese agente.
     La sesión anterior y su historial se conservan; nunca cambiar el agente de una conversación
     que ya recibió mensajes. El siguiente envío debe usar el CLI elegido sin reiniciar el servidor
     ni entrar a Settings.
  3. Separar selección de transporte y selección de modelo. Al entrar a Codex/OpenCode no enviar el
     fallback `deepseek/deepseek-v4-flash` ni ningún modelo de OpenRouter heredado: en la primera
     entrega el CLI corre sin `-m`/`--model` y decide con su propia configuración/autenticación. La
     preferencia de modelo API puede conservarse para volver a `agent: api`, pero no puede filtrarse
     a una sesión CLI. La UI debe decir `modelo configurado en el CLI` hasta disponer del modelo real;
     nunca rotular DeepSeek por un default del frontend que no fue pedido para esa sesión.
  4. Un error de spawn, autenticación, timeout o parseo del CLI devuelve y persiste el error real con
     `provider=codex|opencode`; está prohibido reintentar silenciosamente por OpenRouter/API. Codex
     reutiliza el enlace de autenticación aislada entregado por AT.9. Para OpenCode, verificar primero
     en vivo dónde lee su autenticación/configuración y conservar ese contrato; no asumirlo desde el
     comportamiento de Codex.
  5. La sesión, el turno y Recent Runs muestran el transporte ejecutado (`Codex CLI` u `OpenCode
     CLI`) y, cuando el stream permita conocerlo, el modelo **observado**. Un modelo no observado se
     etiqueta como `CLI default model`, no como DeepSeek ni como un modelo solicitado ficticio.

  **Dónde:** `src/dashboard/public/app.js` (`buildChatModelFx`, estado por agente),
  `src/dashboard/public/screens-core.js` (selección transaccional agente→sesión),
  `src/dashboard/handlers/chat-sessions.ts` (creación explícita),
  `src/dashboard/handlers/chat.ts` (modelo opcional y cero fallback API),
  `src/run/executors/codex.ts`, `src/run/executors/opencode.ts`, tests de chat/config/executors e
  i18n afectado. No cambiar `orchestos.config.yaml` como sustituto del arreglo: el flujo debe
  funcionar desde la UI para cualquier proyecto.

  **Gates:** tests deterministas que demuestren (a) picker habilitado según detección, (b) selección
  crea y activa sesión con el agente exacto, (c) el request CLI no recibe DeepSeek por defecto,
  (d) fallo del binario produce 502 sin llamar `fetch` de OpenRouter y (e) recarga conserva sesión,
  agente, mensajes y proveedor. `bunx tsc --noEmit`, tests relevantes y `bun run test:coverage`.
  Gate en vivo obligatorio con navegador real y ambos binarios reales: seleccionar Codex en el
  composer → sesión nueva → respuesta marcador → SQLite registra `agent/provider=codex`; repetir
  desde la UI con OpenCode y `agent/provider=opencode`. Ejecutar el gate sin credencial de
  OpenRouter disponible para OrchestOS, manteniendo únicamente la autenticación propia de cada CLI,
  para probar que no hubo fallback. Si uno de los binarios o su autenticación no está disponible,
  AT.10 queda abierto con ese error exacto; una prueba solo con Codex no cierra OpenCode. Evidencia:
  `docs/done/evidence/AT.10-live.json` y cierre en `docs/done/bloque-AT.md`.

  **Fuera de scope:** elegir un modelo interno específico de cada CLI, modificar el motor de tareas,
  y prometer soporte para los otros CLIs del registro antes de que tengan adaptador de chat real.
- [ ] **R.7 — 🧠 Escritura atómica y coordinación entre procesos para tasks.yaml.** Prioridad alta.
  Riesgo identificado, pendiente de reproducir: `loader.ts:25` comprueba un hash opcional y luego
  sobrescribe el archivo directamente; `tasks.ts:260` guarda antes del lock Git. Dos procesos
  pueden perder actualizaciones y una interrupción puede dejar un YAML incompleto. Diseñar
  exclusión/read-modify-write y reemplazo atómico con recuperación, cubriendo todos los writers;
  mantener tasks.yaml como fuente de verdad. No migrar la cola a SQLite dentro de este ítem.
  **Gate:** dos procesos actualizan tareas distintas sin pérdida; conflicto sobre una misma tarea
  se resuelve o rechaza explícitamente; interrupción en escritura conserva un documento válido;
  recuperación de lock y compatibilidad portable verificadas. Tests con procesos reales aislados.
- [ ] **ERP.2 — 🧠 Alcance de proyecto real en navegación, memoria y capacidades.**
  Completa UI.8.3–UI.8.5, no crea una segunda migración visual. Dónde: Sidebar citado arriba,
  estado del shell y `src/dashboard/handlers/memory.ts:7-24,58-90`; revisar los consumidores
  equivalentes de tasks/skills/specs/runs/graph y la selección de memoria para prompts.
  Implementar filtros y validación del proyecto también en lectura, búsqueda y mutaciones;
  datos históricos sin dueño quedan identificados, nunca reasignados o borrados por inferencia.
  Gate: proyectos A/B con centinelas, navegar/buscar/editar y reabrir; A no muestra ni utiliza datos
  de B, tampoco con ID ajeno enviado al endpoint. Biblioteca global y activación local distinguibles.
  Navegador real: proyecto → chat → tarea → resultado → memoria, con Settings separados y
  capturas antes/después contrastadas con las referencias. No cerrar con solo tokens CSS cambiados.
- [ ] **ERP.3 — 🧠 Orquestación opcional con freno efectivo de consumo.**
  Hueco nuevo: `src/config/schema.ts:72-103` tiene opciones de ejecutor y QA opt-in, pero no el
  contrato unificado OFF/límite solicitado. Dónde: schema/loader, handler de config, Settings,
  `src/agents/sub-agent.ts`, `src/run/scheduler.ts` y entradas de expansión desde CLI/dashboard.
  Config por proyecto: `enabled=false` si ausente; al activar, límites explícitos de simultáneos
  y total por ejecución (incluye descendientes y relanzamientos; solo limitar concurrencia no
  limita consumo acumulado). Validar antes de lanzar cada hijo, también al reanudar.
  OFF impide delegación/autoexpansión de OrchestOS y permite trabajo con un ejecutor. Inventariar
  además planner/QA/retries/dreaming: mostrar qué llamadas adicionales siguen activas y no
  confundirlas con subagentes. Conservar checks/QA requeridos, sin prometer costo cero.
  Verificar por CLI si puede impedirse su delegación interna: si no, mostrar límite no garantizado
  y no ofrecer ese adaptador como modo de cero subagentes. No basta una instrucción en el prompt.
  Gate: configuración ausente y OFF → cero hijos; ON → admite N y rechaza N+1 antes del spawn;
  recarga/reinicio mantienen política; intentos concurrentes no la saltan. Estado visible de
  activos/total y consumo observado; cuota no disponible se rotula desconocida.
- [ ] **I.7 — 🔍 Gate: la puerta manual no existe y el flujo automático se ve.**
  Contra el dashboard real corriendo, nunca mocks ([[feedback-verificar-gates-en-vivo]]):
  1. En la pantalla principal **no hay ningún camino** para crear una tarea a mano — es el
     criterio de cierre de I.1 y lo que faltó las tres veces anteriores.
  2. Un mensaje que es tarea → confirma (I.2) → ejecuta → reporta inline, y queda persistido en
     `chat_messages` **y** en `runs` con `result` no vacío (I.4).
  3. Un mensaje que **no** es tarea no dispara nada.
  4. Dos tareas del mismo DAG con agentes distintos (Claude/Codex) resuelven y **persisten**
     engine y modelo distintos (I.3).
  5. Ningún texto de implementación visible (I.5).

  Bajar el servidor al terminar ([[feedback-siempre-cerrar-servidor]]).

**Fuera de scope declarado del Bloque I:** dónde viven DB/`runs`/`specs` (Carlos lo pospuso
explícitamente); `opencode`; y el rediseño de las pantallas que no son Chat ni Actividad.

---
- [ ] **H.5.3 — 🔍 Primera corrida medida real (GATED por Carlos).**
  Requiere que Carlos indique modelo y presupuesto; no se abre por iniciativa de ningún LLM.
  Cuesta dinero real: 3 tasks × k=3 = 9
  llamadas completas al modelo, y el modelo lo decide Carlos en el momento
  ([[feedback-modelo-decision-final-carlos]], NO NEGOCIABLE — el incidente de $5.00 quemados
  del 2026-07-13 salió exactamente de un LLM eligiendo modelo por su cuenta). Produce el
  **primer baseline** del proyecto: el "antes" contra el que se medirá cualquier cambio
  futuro de harness. Hasta que exista este número, no se puede afirmar que ninguna versión
  del orquestador es mejor que otra — que es, textual, el hueco que abrió H.5.

### H.7 — El contexto se llena en silencio y nadie avisa (ABIERTO 2026-09-02)

> **Origen: dogfooding real, sesión del 2026-09-02.** Carlos pasó de 9% a 25% de contexto
> cambiando de Sonnet a Opus, y de 25% a 50% en un chat "prácticamente nuevo". El sistema
> nunca avisó. El síntoma se atribuye normalmente a "el modelo es verboso"; la medición dice
> otra cosa (ver abajo). Es el mismo patrón de fondo que la Regla Cero de `CLAUDE.md`: una
> regla escrita ("cortar a sesión nueva al 70%", [[feedback-limite-contexto-70]]) que ningún
> mecanismo hace cumplir, deja de existir en la práctica.
>
> **Mediciones de esta sesión (evidencia, no estimación).** Del transcript real
> `~/.claude/projects/<slug>/<session-id>.jsonl`, último mensaje `assistant`:
>
> ```
> used = input_tokens(2) + cache_creation_input_tokens(1465) + cache_read_input_tokens(82893)
>      = 84,360 tokens        model = claude-opus-5 (viene en la propia línea del JSONL)
> ```
>
> **Los dos ejes que la UI no separa, y que este ítem sí debe separar:**
> 1. **Ventana de contexto** — se llena dentro del tab, se resetea al abrir uno nuevo.
> 2. **Cupo/costo facturado** — NO se resetea al abrir tab; el tab nuevo re-lee archivos.
>
> **Por qué cambiar de modelo dispara el consumo (mecanismo, no anécdota):** cambiar de modelo
> **invalida el prompt cache**. Todo el historial se re-procesa como `cache_creation` (precio
> completo) en vez de `cache_read` (~10% del precio). En la medición de arriba, 82,893 de los
> 84,360 tokens fueron `cache_read` **porque no hubo cambio de modelo en la sesión**. Regla
> operativa que sale de esto y que vale para cualquier proyecto: **cambiar de modelo al abrir
> un tab, nunca a mitad de una sesión larga.**
>
> **Lo que ya existe y NO se rehace:** `scripts/handoff.ts` + `scripts/agent-handoff.ts`
> (H.4.2, commit `c1c6edc`) ya escriben `.orchestos/handoff.md`. Su propio comentario de
> cabecera declara el hueco: *"no es un gate: no existe un evento 'fin de sesión' universal
> entre Claude/Codex/DeepSeek/OpenCode para engancharlo mecánicamente"*. **El umbral de
> contexto ES ese evento.** H.7 es el disparador que a H.4.2 le faltaba, no un sistema nuevo.
>
> **Viabilidad verificada antes de escribir el ítem** (contra el binario 2.1.234, para que
> nadie la re-investigue): `strings claude.exe` confirma `transcript_path` (11 ocurrencias),
> `SessionStart` (117), `hookSpecificOutput` (124) y `additionalContext` (186). El payload
> que necesita el hook existe.
>
> **Restricciones duras del diseño, no negociables por quien implemente:**
> - **Nada de compactación automática** ([[feedback-no-compactar-contexto]]): se avisa y se le
>   pide a Carlos cerrar el tab. Nunca se comprime la conversación por cuenta propia.
> - **Nada de cambio automático de modelo** ([[feedback-modelo-decision-final-carlos]]).
> - **Costo cero por debajo del umbral**: el hook no imprime nada. Un aviso por turno sería
>   exactamente el mal que este ítem intenta curar.
> - **El handoff lo escribe un script determinista, no un LLM.** Carlos lo planteó explícito:
>   "guardar a cada momento también me consumiría tokens".
> - El umbral es un **porcentaje**, y la ventana se **deriva del modelo del turno** — no un
>   número fijo de tokens. Modelos distintos, ventanas distintas.
- [ ] **ERP.4 — 🔍 Piloto de módulo ERP y decisión de utilidad.**
  Entrada: entregas 1–4 anteriores verificadas para el recorrido real. Elegir con Carlos módulo,
  repo, stack, criterios funcionales, CLI/modelos y presupuesto antes de corridas que consuman uso.
  No asumir que conversar con un CLI demuestra que planificar/ejecutar/QA usan el mismo transporte:
  el gate previo debe registrar cada etapa y no usar proveedores/cuentas no elegidos.
  Recorrido mínimo del módulo: modelo de datos + migración, reglas de negocio y validaciones,
  permisos aplicables, API + UI, tests de aceptación y resultado utilizado por Carlos.
  Interrumpir/reabrir al menos una vez; recuperar siguiente tarea, decisiones, error aprendido y
  evidencia sin reconstruirlos a mano. Medir intervenciones, bloqueos, tiempo y uso disponible;
  verificar que una corrección guardada se recupera en el siguiente trabajo del mismo proyecto.
  Reutilizar R.8 para la revisión independiente; no afirmar aprendizaje por solo guardar memoria.
- [ ] **R.8 — 🔍 Validación independiente del recorrido útil y corrección de evidencia de cierre.**
  Depende de R.1–R.7 y H.9.4. Revisar el recorrido completo: proyecto conectado → conversación →
  tarea/confirmación → ejecución → checks/QA → resultado → recarga y evidencia recuperada;
  incluir continuidad del historial hacia CLI, no solo su presencia en la pantalla. Repetir sobre
  un proyecto externo de prueba, declarar transporte/configuración y registrar resultados por
  intento. La utilidad debe contrastarse además con una tarea real de Carlos: resultado utilizado,
  intervención necesaria y bloqueos, no solo número de tests.
  **Corrección documental necesaria:** I.4 conserva abajo su cierre histórico del 2026-09-05,
  pero su evidencia declara «sin navegador/browser interactivo». No acredita el gate visual
  exigido por el protocolo. Su aceptación integral queda pendiente de este bloque; el `[x]`
  histórico no desbloquea por sí solo H.9.4. Adjuntar aquí evidencia nueva sin borrar el historial.
  **Gate:** navegador real y backend/persistencia observados; suite exacta de CI verde; pruebas
  negativas de privacidad y QA; informe de límites restantes. Cuando use home temporal con runs
  reales, ejecutar el wrapper gate:evidence y verificar conservación de la evidencia pertinente.

**Mantenibilidad (observación transversal):** en la revisión, cli.ts tenía 2923 líneas,
harness.ts 1203 y chat.ts 1237. La concentración de responsabilidades merece atención, pero
el tamaño no demuestra un bug. Extraer únicamente responsabilidades necesarias para los ítems
anteriores, con pruebas de comportamiento; no abrir un refactor masivo por conteo de líneas.

## Fase 3 — Correr dentro de OrchestOS igual que el CLI directo

- [ ] **AT.13 — 🧠 El contexto que el chat inyecta al CLI dice la verdad.** (abierto 2026-09-22, pendiente)
  Origen: autoevaluación de Claude corriendo como CLI dentro de OrchestOS, contrastada contra el
  código por el cerebro. Es backend de `handlers/chat.ts`, independiente del cambio de interfaz de
  esta semana. Confirmado por lectura, sin corrida en vivo:
  1. **El prompt promete herramientas que no tiene.** `chat.ts:1247` dice "may run the CLI tools";
     `run/executors/external.ts:322` solo habilita `Read,Glob,Grep`. El texto se deriva de las
     herramientas reales del adaptador, no de una frase fija.
  2. **Costo desconocido vuelve a ser `$0`.** `chat.ts:1123,1130` hace `Number(r.usd_cost)` y
     `Number(null) === 0`: rompe F0.8 (`run/executors/codex.ts:378`). Mostrar `n/a` y excluirlo del
     total, que pasa a decir que es parcial. Falta ubicar qué ruta guarda runs Codex con costo nulo.
  3. **No escala.** `chat.ts:1115` inyecta la descripción completa de cada task en cada turno.
     Una línea por task (id, estado, qa) y el detalle solo bajo demanda.
  4. **QA falla sin motivo.** Inyectar la última razón de fallo en tasks con `qa:fail`.
  Menor, en la misma pasada si es barato: `detect/profile.ts:15` ignora `typecheck` y
  `test:coverage` (el gate real de CI); `detect/manifest.ts` solo lee el `package.json` raíz y no ve
  React en `src/dashboard/app`. Descartado tras verificar: "runs sin task_id" (ya se imprime,
  `chat.ts:1130`). **Gate:** turno real de chat con Claude CLI y Codex; el contexto capturado muestra
  herramientas reales, `n/a` en costos desconocidos y tasks en una línea.

  **Ampliado 2026-09-22 (Carlos: "que se sienta que está corriendo sin mucho peso y con reglas claras").** Hallazgos
  del turno de Opus dentro de OrchestOS (run `560e910f`, 02:42 UTC) que faltaban: (5) nombres de modelo
  inconsistentes en runs (`codex`, `codex (cli default model)`, `gpt-5.6-luna via Codex CLI`) — normalizar;
  (6) fechas UTC sin etiqueta frente a la hora local; (7) el rol dice memoria/specs pero no llega ni un índice;
  (8) prompt base del CLI y prompt de OrchestOS apilados (ruido y contradicciones). Objetivo medible: el mismo
  pedido, directo al CLI y por OrchestOS, da una respuesta equivalente, con tokens de contexto inyectado medidos
  antes/después.
- [ ] **ERP.5 — 🔍 Revisar sobrecarga: qué quitar manteniendo fiabilidad y control humano.**
  Pedido de Carlos (2026-09-15). Hacer después de iniciar ERP.4, con evidencia del trabajo real;
  no bloquear AT.10 ni el piloto con otra auditoría extensa. Alcance: reglas/documentos cargados,
  contexto repetido, delegación, planner/QA/retries/dreaming y pasos de planificación/revisión.
  Usar registros existentes; distinguir tokens, contexto, cuota CLI y costo API, sin convertir
  unos en otros por suposición. Cada hallazgo muestra costo observado, beneficio demostrado y
  propuesta concreta de eliminar, simplificar o conservar. Revisar también el propio proceso de
  desarrollo de OrchestOS: una auditoría que añade ceremonia puede agravar lo que intenta resolver.
  Comparar antes/después sobre la misma tarea, modelo, esfuerzo y criterios de aceptación;
  medir resultado útil, errores, intervenciones y consumo disponible. Pi es una hipótesis de
  referencia por investigar, no superioridad acreditada ni motivo para migrar; cualquier comparación
  requiere condiciones equivalentes y presupuesto elegido por Carlos.
  **Dirección de trabajo solicitada:** reglas claras y cortas, alcance y aceptación breves →
  implementación → checks relevantes → resultado revisable por Carlos (**human in the loop**).
  El agente prepara evidencia, límites y decisiones pendientes para que el humano pueda aceptar
  o corregir el resultado sin reconstruir todo el proceso ni aprobar cada paso reversible.
  Mantener confirmación previa para acciones destructivas/irreversibles; la revisión final no
  autoriza ejecutarlas antes. Conservar controles de pérdida de datos, aislamiento y QA honesto.
  Gate: informe corto con evidencia y simplificaciones propuestas; Carlos revisa utilidad y
  tradeoffs antes de adoptarlas. No añadir reglas, hooks o agentes como salida automática del estudio.

**Después de iniciar:** AT.11 (registro extensible completo), migración visual de pantallas
secundarias, resume/fork avanzado, orquestación de flotas y mejoras de aprendizaje nocturno.
H.10.2 sigue abierto; no es condición de entrada si el piloto no usa ese proceso. UI.8.6 completo
puede entregarse después, pero el piloto debe mostrar permisos reales y los límites de H.9.4.
La corrida sobre carlosgallardo.dev citada en AT queda como smoke opcional, no criterio de éxito.
Revisión documental de esta ruta: preflight AT.10 válido; verificación por lectura, sin corrida
ERP ni prueba visual nueva. Los ítems permanecen abiertos hasta sus gates reales.
- [ ] **H.7.2c — ⚡ Registro de adaptadores: falta OpenCode.** Hallazgo por código
  (2026-09-08, Claude, verificando el hook H.7.3 a pedido de Carlos — "verifica que esto se
  cumpla para cualquier modelo"). `DEFAULT_ADAPTERS` en `scripts/context-adapters.ts:267` solo
  trae `[claudeAdapter, codexAdapter]`. El diseño del registro sí es genérico por modelo dentro
  de cada CLI (`readTranscriptUsage()` lee el `model` real de la última línea del transcript en
  cada disparo, nunca uno fijo) — pero por CLI es una lista cerrada de 2. Carlos usa OpenCode en
  este mismo proyecto ([[codex-delegation-workflow]] / uso real observado en sesión); con ese
  CLI activo, `readContextBudget()` no encuentra adaptador y el fail-open documentado en
  `context-adapters.ts:117` ("un hook que rompe el turno es peor que un hook que no avisa")
  hace que el aviso de 60%/65% **no aparezca en absoluto, en silencio** — no es un bug, es la
  consecuencia no señalada de una decisión de diseño correcta.
  Aplicar la misma regla ya escrita para este registro (`context-adapters.ts:10`, cita de
  Carlos): "las soluciones no las hacemos una por modelo sino para los LLMs que vengan" —
  agregar `opencodeAdapter` como entrada de datos en `DEFAULT_ADAPTERS`, no un `if` nuevo.
  Antes de escribirlo: verificar contra un transcript real de OpenCode dónde publica
  modelo/tokens/ventana (mismo método que H.7.2b usó para Codex — contrato verificado en vivo,
  no asumido de la documentación). Si OpenCode no publica la ventana en su transcript, resolver
  por catálogo igual que hace `claudeAdapter`, no inventar un fallback por familia.
  **Gate:** sesión real con OpenCode como agente activo, cruzar el 60%, ver el aviso en vivo —
  mismo criterio que el gate 🔍 de H.7.3, no un test que mockee el adaptador.
- [ ] **H.7.3 — ⚡ El hook: avisar al 60% y volcar el handoff una sola vez.**
  Depende de H.7.1, H.7.2 y **H.7.2b** (la fuente del número se rehizo como registro de
  adaptadores — no re-cerrar H.7.3 leyendo el JSONL directo). El hook debe consumir
  `readContextBudget()` del registro, sin saber qué CLI está corriendo.
  `.claude/hooks/context-budget.js`, registrado como
  `UserPromptSubmit` en el `settings.json` **del proyecto** (no el global — el global es
  portable entre máquinas, ver `~/.claude/CLAUDE.md`). Comportamiento:
  - Lee `transcript_path` del JSON de stdin. Si falta o el archivo no existe: **salir 0 sin
    imprimir nada**. Fallar abierto: un hook que rompe el turno es peor que un hook que no
    avisa.
  - `level === 'ok'` → **no imprime nada**. Cero tokens.
  - `level === 'warn'` (≥60%) → dispara `bun run agent:handoff` **una sola vez por sesión**
    (flag `{ sessionId, firedAt }` en `.orchestos/context-budget.json`, gitignored) e imprime
    un aviso de ≤4 líneas: % actual, modelo, ventana, y la instrucción de cerrar el tab.
  - `level === 'critical'` (**≥65%**, bajado desde 75% por decisión de Carlos el 2026-09-03 —
    ver punto 6 de la investigación: el autocompact dispara a ~78% y no se puede desactivar de
    forma fiable, así que el margen debe absorber un turno pesado entero) → aviso corto en cada
    turno. **Este es el único nivel que avisa en cada turno**; en `warn` el aviso es una sola vez
    por sesión (ver BUG-H.7.3-a abajo — hoy el código no cumple esto). Los dos umbrales son
    **dato del registro de H.7.2b**, no constantes en el hook.
  - Presupuesto de tiempo: el hook debe terminar en <500ms; `timeout` de 5000 en la config.
  Gate 🔍 (no se cierra sin esto): correr una sesión real hasta cruzar el 60% y **ver el aviso
  en vivo**, con `.orchestos/handoff.md` escrito y su timestamp posterior al cruce. No vale un
  test que mockee el hook — es exactamente el fallo de "interfaz que no aporta" de la Regla
  Cero, y la razón de [[feedback-verificar-gates-en-vivo]].
  **Implementación lista; gate 🔍 pendiente:** hook de comando registrado en el `settings.json`
  del proyecto con timeout real de 5 segundos (=5000 ms). Lee stdin, falla abierto ante ausencia,
  corrupción, timeout, modelo no publicado o fallo de handoff; `warn`/`critical` genera el
  handoff solo si el `{sessionId, firedAt}` no coincide y `critical` avisa en cada turno. El aviso
  ocupa 3 líneas. La resolución proveedor-neutral de H.7.1 usa solo una coincidencia única del
  catálogo. Prueba end-to-end de ruta normal con transcript real: `claude-sonnet-5` → ventana
  publicada 1,000,000, 17.6%, silencioso, 110 ms. Falta una sesión real ≥60% para verificar el
  aviso visible y el `mtime`; no se suplanta con fixture.
  **Observaciones corregidas (2026-09-02, pedido explícito de Carlos):** el fixture de eval
  crea su commit base con identidad efímera pasada como `git -c`, sin escribir configuración local
  ni global; su test anula configuración global/sistema para reproducir GitHub Actions. El
  pre-push mantiene el comando exacto de CI, pero guarda la salida completa en un log temporal y
  muestra solo las 6 líneas finales al pasar (80 líneas al fallar). Corrida real ✅: 1219 pass /
  0 fail, funciones 74.20%, líneas 63.32%; el output visible quedó acotado y el log conserva el
  diagnóstico completo.

  **Gate 🔍 corrido por Claude el 2026-09-03 — primera pasada, NO PASÓ (bugs abajo). Ambos
  bugs se arreglaron después, dentro del trabajo de H.7.2b (commit `8a6ea80`) — ver
  "BUG-H.7.3-a arreglado y verificado en vivo" / "BUG-H.7.3-b cerrado" más arriba en este
  bloque. Se deja la tabla y el diagnóstico original como evidencia de por qué se reabrió
  H.7.2b. Lo que sigue sin cerrar el ítem: el gate estricto pide una sesión en vivo cruzando
  el 60% dentro de un turno; lo verificado hasta ahora es contra transcripts reales pero
  históricos — falta esa corrida en caliente.**
  Método: se invocó el hook real (`node .claude/hooks/context-budget.js`) con el JSON de stdin
  que le pasa Claude Code, contra **transcripts reales de Carlos** de
  `~/.claude/projects/<slug>/` que ya habían cruzado el umbral — no fixtures sintéticos.
  Medición previa con `bun run context:budget --` sobre 8 transcripts: 3 en `warn`
  (61.5% / 64.2% / 71.9%) y 1 en `critical` (78.0%).

  | Prueba | Transcript | Resultado |
  |---|---|---|
  | `ok` | sesión actual, 17.6% | silencio, exit 0, **103 ms** |
  | `warn` | `b1bb946b…` 71.9% | aviso 3 líneas + handoff regenerado, 237 ms ✅ |
  | `warn`, 2º turno misma sesión | `b1bb946b…` | handoff **no** se regenera ✅ / aviso **se repite** ❌ |
  | `critical` | `7c87bf0a…` 78.0% | "Contexto crítico", exit 0 ✅ |
  | transcript inexistente | — | silencio, exit 0 ✅ |
  | stdin no-JSON | — | silencio, exit 0 ✅ |

  **BUG-H.7.3-a — el aviso de `warn` se imprime en cada turno, no una sola vez.**
  En `.claude/hooks/context-budget.js:18-19` el guard de `sessionId` protege **solo** la
  escritura del handoff; `printWarning(budget)` queda fuera del `if` y corre siempre:

      if (readState()?.sessionId !== sessionId && !writeHandoff(...)) return
      printWarning(budget)   // ← sin guard

  Rompe tres cosas a la vez: (1) el spec de arriba, donde la **única** diferencia declarada
  entre `warn` y `critical` es la frecuencia del aviso — con este bug `critical` no tiene
  comportamiento propio; (2) la propia nota de evidencia de Codex ("`critical` avisa en cada
  turno", que implica que `warn` no); (3) la regla global de `~/.claude/CLAUDE.md` § Costo de
  contexto, punto 4, textual: *"un aviso por turno es el mismo mal que intenta curar"* — 3
  líneas por turno desde el 60% hasta cerrar el tab, en el mecanismo cuyo propósito es
  **ahorrar** contexto. Fix: mover `printWarning` dentro del guard para `warn`, dejando el
  camino de cada turno solo para `critical`.

  **BUG-H.7.3-b — el hook `.js` no tiene test propio.** `scripts/context-budget.test.ts` cubre
  el script `.ts` de H.7.1, no `.claude/hooks/context-budget.js`; grep de `context-budget` en
  los tests no devuelve ninguna referencia al hook. Sin test, BUG-a podía existir con la suite
  en verde — y de hecho existió. Mismo patrón que el hook `pre-commit` desincronizado de la
  Regla Cero de `CLAUDE.md`.

  **Límites declarados de esta verificación** (no se presentan como cubiertos): los transcripts
  usados son reales pero **históricos** — no es una sesión en vivo cruzando el 60% dentro de un
  turno, que es la letra del gate. Y no se pudo distinguir si el hook estaba cargado en la
  sesión activa, porque en `level === 'ok'` su comportamiento correcto es indistinguible de no
  estar registrado ([[reference-settings-json-requires-restart]]). Estado restaurado al terminar:
  `.orchestos/handoff.md` con su contenido original y `.orchestos/context-budget.json` borrado.

  **Fuera de scope declarado:** ninguno.

  **Aclaración 2026-09-03 (evitar falsa alarma repetida): Orca no mide esto.** Carlos vio 84%
  en el indicador de Orca y preguntó por qué el hook no avisaba. Verificado con evidencia:
  Orca muestra el `rate_limits` nativo de la statusLine de Claude Code (`used_percentage` de
  las ventanas de 5h/7 días — cupo de cuenta, ver `~/.claude/cache/changelog.md:3181`),
  reenviado sin cálculo propio por `~/.orca/agent-hooks/claude-statusline.sh` (filtra por
  `"rate_limits"` en el payload). Es el eje **cupo/costo**, no el eje **ventana de contexto**
  que mide H.7.3 (`~/.claude/CLAUDE.md` § Costo de contexto, punto 3). Corrida real en paralelo
  esa misma sesión: hook contra el transcript real dio `pct: 10.66%, level: ok` — correcto para
  esa sesión, el hook no debía avisar. Si esto se repite, **no es un bug del hook**: pedir el
  número que muestra el propio indicador, no asumir que es contexto.
- [ ] **AT.11 — 🧠 Chat CLI extensible: cualquier adaptador registrado, no ramas hardcodeadas por marca.**
  Depende de AT.10. Extraer las ramas `claude`/`codex`/`opencode` de `handlers/chat.ts` a un contrato
  de adaptador que declare detección, comando, stdin/args, env/home de autenticación, parser de
  stream, modelo observado, esfuerzo y capabilities de lectura/escritura. El picker se deriva de
  `chatCapable + detected` del mismo registro: añadir un CLI no puede requerir otro `if` en backend
  y otra allowlist manual en frontend. Gate de arquitectura: registrar un adaptador fixture y un
  tercer CLI real disponible, ejecutar sesión→turno→persistencia sin tocar el router del chat;
  los registros sin adaptador deben decir `chat no soportado`, nunca caer a API/OpenRouter.

## Fuera de fase

- [ ] **H.9.4 — 🔍 El gate que lo vuelve real: el chat intenta leer el vault y no puede.**
  **Dependencias actualizadas (auditoría 2026-09-06): R.2 y R.5.** El campo `files_read`
  entregado originalmente por I.4 registraba solicitudes sin confirmar resultados. R.2 lo
  corrigió el 2026-09-07 y añadió `read_audit_json` con evidencia real; R.5 sigue pendiente.
  Ver Bloque R para resultados, cobertura y límites; este gate no se cierra automáticamente.
  Sin este test, alguien cambia un flag en dos semanas y nadie se entera — literalmente lo que
  pasó con el `pre-commit`. Un gate ejecutable, con el dashboard real corriendo
  ([[feedback-verificar-gates-en-vivo]]), que para cada CLI con frontera declarada:
  1. Pide al chat leer un archivo fuera del root del proyecto (un fixture temporal, **nunca el
     vault real** — el test no debe depender de datos personales de nadie ni de que el vault
     exista).
  2. Afirma que la lectura no ocurrió, cruzando contra la lista de archivos leídos que persiste
     H.9.1 — no contra lo que el modelo *dice* que hizo.
  3. Para cualquier CLI con frontera `none` (incluido `codex`), afirma lo contrario: que el sistema
     **reporta** el hueco sin bloquear el chat, en vez de prometer aislamiento. Un test que
     documenta la limitación real vale más que uno que la esconde.

  Escrito por Codex mientras Claude implementa H.9.2/H.9.3, que es el reparto que mejor ha
  funcionado ([[feedback-codex-escribe-el-gate]]); acotado a los archivos que él crea para no
  cruzarse con la edición en curso ([[feedback-codex-no-en-paralelo-con-claude]]).

**Fuera de scope declarado de H.9:** `opencode` (mismo criterio que H.8 — sin contrato
verificado); el sandbox de **escritura** de las tareas (worktrees ya lo cubren, es otro eje); la
frontera de red/SSRF (`src/dashboard/ssrf.ts` ya existe y no se toca); y cualquier cambio al
vault o a `~/.claude`/`~/.codex` de Carlos — el vault sigue alimentando el trabajo de desarrollo
igual que hoy, lo que se corta es que el **producto** lo herede por accidente.

### H.10 — El gate de evidencia acepta prosa, no el hecho (ABIERTO 2026-09-08, GO de Carlos)

> Por qué existe: incidente R.5 del 2026-09-08 ([[feedback-verificar-gates-en-vivo]],
> [[feedback-revisor-adversarial-cruzado]]). Claude cerró R.5 declarando "Gate en vivo: navegador
> real..." en PLAN.md con `check-live-gate.ts` en verde — pero el gate solo verifica que esa
> *frase* exista (regex sobre `Gate en vivo:.*(navegador|browser|Playwright)`), nunca que el
> hecho (dos procesos concurrentes, exigido por el propio texto del ítem) haya ocurrido de
> verdad. No ocurrió. Lo encontró Astra (GPT, revisión independiente) horas después, junto con 4
> bugs reales de concurrencia/ownership que 1335 tests en verde no habían tocado — el mismo día,
> mismo ítem.
- [ ] **H.10.2 — 🧠 Revisor adversarial nocturno, de un modelo distinto al que implementó.**
  Reabierto 2026-09-08 por Carlos: corregir exclusivamente cinco fallos de H.10.1/H.10.2 antes de
  volver a declararlo cerrado: aislamiento efectivo (filesystem, credenciales, red y timeout) de
  tests generados; `test_path` canónico dentro de `review-evidence` sin traversal, absolutos,
  symlinks externos ni sobreescritura; clasificación de fallos que separa aserción de sintaxis,
  imports, infraestructura y timeout; fail-closed del estado `lastReviewedSha`; y evidencia del
  gate ligada al ítem que se cierra y presente en el contenido staged. Añadir regresiones
  adversariales, ejecutar los gates requeridos y documentar resultados/límites. No activar el
  LaunchAgent, no cambiar `gpt-5.6-sol` y dejar la revisión independiente pendiente: los tests de
  quien implementa no la sustituyen. **Scope declarado:** `scripts/adversarial-review.ts`,
  `scripts/adversarial-review.test.ts`, `scripts/agent-governance.ts`,
  `scripts/agent-governance.test.ts`, `scripts/check-live-gate.ts`, `PLAN.md` y, solo si hace
  falta para el sandbox verificable, el script mínimo versionado que aquel invoque. **Fuera de
  scope declarado:** LaunchAgent/launchd, `package.json`, prompt/modelo configurado, `REVIEW.md`,
  automatización nocturna y cualquier hallazgo ajeno. Estado previo: cerrado 2026-09-08 (Claude implementó + Codex `gpt-5.6-terra` escribió los tests unitarios
  sobre el contrato ya cerrado, delegación explícita de Carlos).
  1. `scripts/adversarial-review.ts` (funciones puras exportadas, `main()` orquesta): toma
     `git diff` desde el último sha revisado (`.orchestos/adversarial-review-state.json`) hasta
     `HEAD` — si ese sha ya no existe (rebase/force-push), cae a `HEAD~1..HEAD` en vez de asumir
     cuánto cubrir. Alcance acotado al diff, no barrido completo del repo (decisión de Carlos).
  2. Corre `codex exec -m gpt-5.6-sol --json --sandbox read-only --ignore-user-config`. El
     stream `--json` **no reporta el modelo usado** (verificado en vivo,
     [[reference-codex-modelo-real-rollout]]) — el script captura `thread_id` del stream
     (`extractThreadId`), busca `~/.codex/sessions/**/rollout-*-<thread_id>.jsonl`
     (`findRolloutPath`), lee el `model` real de la línea `type:"turn_context"`
     (`extractModelFromRollout` — path exacto verificado en el rollout real, no en memoria) y
     **aborta sin escribir nada** si no coincide con `gpt-5.6-sol` (`verifyModelUsed` +
     `main()`). El modelo de una corrida real no es una afirmación del LLM
     ([[feedback-modelo-decision-final-carlos]]).
  3. Prompt adversarial (`scripts/adversarial-review-prompt.md`) por los 4 dominios reales del
     incidente: concurrencia/ownership, frontera de seguridad, evidencia declarada vs.
     producida, contradicción comentario-vs-código. Contrato de salida: un único bloque
     ` ```json ` con un array (vacío si no hay nada real — explícitamente autorizado a no
     inventar).
  4. **Regla dura anti-ruido:** `runFindingTest()` escribe el `test_code` de cada hallazgo bajo
     `review-evidence/*.check.ts` (extensión deliberada, fuera del glob de descubrimiento de
     `bun test` — un hallazgo real no puede romper el CI del propio repo) y lo corre con
     `bun test <ruta explícita>`. Sobrevive solo si el proceso termina con código distinto de 0
     — si el test no falla, se descarta y el archivo se borra en el mismo `main()`, antes de
     tocar `REVIEW.md`.
  5. Hallazgos sobrevivientes → `REVIEW.md` (nuevo, en la raíz, mismo principio que `DREAMING.md`
     — nunca aplica cambios, Carlos decide qué promover a `PLAN.md`/`IDEAS.md`; entradas más
     recientes primero, sin duplicar el header entre corridas — `appendToReviewMd`). El script
     **nunca commitea** — deja el working tree con cambios locales para que Carlos los revise.
  6. `~/Library/LaunchAgents/dev.cagr1.orchestos.review.plist` (creado, **sin cargar todavía en
     launchd** — pendiente de que Carlos confirme activarlo) — mismo patrón que
     `dev.cagr1.memoriesmd.sync.plist` (ya en la máquina): `StartCalendarInterval` 3am, sin
     `pmset wake` (decisión explícita de Carlos: no vale el costo de forzar el despertar de la
     máquina por esto). `bun run review:nightly` (`package.json`) usa la suscripción de Codex ya
     pagada, no API key aparte — por eso no es GitHub Actions.
  **Gate:** `bun test scripts/adversarial-review.test.ts` — 10 pass / 0 fail / 35 expects
  (funciones puras: estado/rango, parseo de stream JSONL, verificación de modelo contra rollout,
  parseo de hallazgos, formato de `REVIEW.md`). Además, **corrida real contra `codex exec`**
  (no simulada) en dos repos git temporales — evidencia completa en
  `scripts/h10-gate-evidence.json`:
  (1) diff con un bug plantado de la misma forma que R.5 (comentario promete verificar el owner
  del lease, el código no lo hace) → el modelo lo encontró, escribió un test, ese test falló
  contra el código real, y la entrada quedó en `REVIEW.md` — texto y test verificados a mano;
  (2) diff limpio (trim de un string, sin nada en los 4 dominios) → cero hallazgos, cero ruido,
  no se crea ni `REVIEW.md` ni `review-evidence/`;
  (3) `expectedModel` deliberadamente distinto al real (`gpt-5.6-sol` corrió de verdad, se pidió
  verificar contra `"modelo-incorrecto-a-proposito"`) → abortó con exit code 1, no escribió
  nada, y **no actualizó el estado** (el sha revisado no avanza, así que la próxima corrida real
  vuelve a intentar ese mismo diff en vez de darlo por hecho).
  **Corrección en curso 2026-09-08 (Codex, no cerrar hasta gates pendientes):** los cinco
  hallazgos se corrigieron en el revisor y sus gates: las pruebas generadas corren bajo
  `sandbox-exec` de macOS con root temporal de escritura, repo solo lectura, `HOME`/
  `ORCHESTOS_HOME` limpios, red denegada y timeout de 30 s; si no existe ese sandbox, se rechaza
  la prueba sin fallback. `test_path` rechaza absolutos/traversal, comprueba ancestros canónicos
  (incluidos symlinks) y no pisa un destino existente. Solo una salida reconocible de aserción
  puede confirmar un hallazgo; sintaxis, import, infraestructura y timeout se registran en
  `*.result.json` con stdout/stderr y se descartan como prueba. El SHA queda inmóvil para spawn/
  timeout de Codex, respuesta ausente, JSON o hallazgos malformados. H.10.1 ahora exige que el
  artefacto sea un blob staged citado en la propia línea `Gate en vivo:` del mismo ítem cerrado.
  **Verificado:** `bunx tsc --noEmit`; `bun test scripts/adversarial-review.test.ts
  scripts/agent-governance.test.ts` — 19 pass / 0 fail / 80 expects; sandbox real adversarial
  comprobó lectura externa, escritura fuera del temporal, credencial inyectada y red local
  denegadas. `bunx biome check` sobre los cinco scripts tocados pasó. **Pendiente, no se
  reclama:** `security:gate`/`test:coverage` completos no terminaron antes del límite de 30 s del
  runner de esta sesión; revisión independiente sigue pendiente y estos tests propios no la
  reemplazan. No se activó el LaunchAgent ni se cambió modelo, prompt o `package.json`.

  **H.10.2-bis — revisión independiente (Claude, 2026-09-08): dos bugs bloqueantes que se
  anulaban entre sí y hacían que el revisor NO pudiera confirmar ningún hallazgo jamás.**
  Encontrados corriendo el recorrido completo, no leyendo el diff.
  1. **El sandbox impedía ejecutar cualquier cosa.** El perfil `(deny default)` solo permitía
     `process*` y unas rutas de lectura; macOS 26 exige además las clases `mach*`, `sysctl*`,
     `signal`, `ipc*` y `system*` para que un binario arranque. Verificado a mano: hasta
     `/bin/echo` moría con SIGABRT (exit 134) y stdout/stderr **vacíos**. Como
     `classifyFindingFailure` clasifica por patrones en la salida, una salida vacía caía en
     `non-assertion-failure` → **todo hallazgo se descartaba, siempre, en silencio**. El revisor
     nocturno habría corrido cada noche reportando cero hallazgos, y eso se habría leído como
     "no hay bugs". Es exactamente el botón que no hace nada de la regla cero de `CLAUDE.md`.
  2. **`bun test <ruta>` sin `./` no ejecuta nada.** Bun trata el argumento como *filtro de
     nombre*; como la evidencia usa `.check.ts` (deliberado, para no entrar al glob de la suite
     del repo), no matcheaba ningún test y no corría ninguna aserción — devolviendo exit≠0
     igual. Con la regla original ("sobrevive si exit≠0"), **cualquier** hallazgo quedaba
     "confirmado" sin haberse probado nada. Verificado: sin `./` → `0 expect() calls`; con `./`
     → `1 fail, 1 expect() calls`. **Esto invalida retroactivamente el gate declarado en la
     primera pasada de H.10.2**: aquel "bug plantado detectado" fue un falso positivo — el test
     nunca corrió. Queda registrado en `scripts/h10-gate-evidence.json` § `invalidatedFirstPass`
     en vez de borrarse.
  **Por qué ningún test los atrapó:** los tests del sandbox verificaban que nada ESCAPARA, pero
  ninguno verificaba que algo FUNCIONARA dentro. Tercera repetición del mismo patrón en el día
  ([[feedback-revisor-adversarial-cruzado]]): un test escrito contra el propio contrato del autor
  hereda su punto ciego. Se agregó la regresión que faltaba — un hallazgo legítimo debe sobrevivir
  con `reason: 'assertion-failed'` **y** con prueba de ejecución (`expect() calls` en la salida),
  no solo con un exit code distinto de 0.
  **Decisión de seguridad, explícita:** se permite `file-read*` amplio (acotarlo volvía a impedir
  el arranque: el dyld cache de macOS 26 vive detrás de firmlinks). La frontera que sí se
  sostiene y se verificó en vivo es **escritura solo al temporal + red denegada + credenciales
  conocidas (`~/.ssh`, `~/.aws`, `~/.codex`, `~/.claude`, `~/.gnupg`, `~/.config/gh`) denegadas**.
  Sin red, leer no permite exfiltrar; residuo aceptado: un test podría copiar lo leído al
  `.result.json` local. `classifyFindingFailure` además distingue ahora `test-passed` (exit 0)
  de un fallo raro, para que el `.result.json` sea legible.
  **Gate (recorrido real, con Codex real, después del fix):** ver
  `scripts/h10-gate-evidence.json`. (1) bug plantado con la forma de R.5 → hallazgo confirmado,
  `reason: assertion-failed`, `1 fail / 3 expect() calls` — la aserción **corrió**; (2) diff
  limpio → cero hallazgos, sin `REVIEW.md` ni `review-evidence/`; (3) mismatch de modelo → aborta
  sin escribir y sin avanzar el SHA. Fronteras del sandbox probadas en vivo con un test que
  intenta violarlas: escritura externa, red y credencial → las tres bloqueadas, `3 pass /
  3 expect() calls` (probando que corrió). `bunx tsc --noEmit` limpio; `bun test` de los dos
  archivos: 20 pass / 0 fail / 84 expects.
  **Además — CI estaba rojo por `lint`, no por los tests.** `bun run lint` (Biome) fallaba con 7
  errores de formato/`organizeImports`; el job venía en rojo desde antes de este bloque (19 de
  los últimos 25 runs). Corregido con `bun run lint:fix` → `bun run lint` exit 0. Causa raíz de
  por qué nadie lo veía: **`lint` no está en `pre-commit` ni en `pre-push`**, así que el único
  lugar donde aparece es CI, y un CI siempre rojo deja de dar señal (mismo corolario ya escrito
  en `CLAUDE.md`). Sumarlo al `pre-push` queda propuesto a Carlos, no hecho.
  **Sigue pendiente, no se reclama:** el LaunchAgent quedó cargado en la pasada anterior
  (`launchctl list` → `dev.cagr1.orchestos.review`) **antes** de que estos dos bugs se
  descubrieran; con el fix ya aplicado el revisor funciona, pero su primera corrida nocturna real
  todavía no ocurrió — hasta que ocurra, el recorrido en condiciones de cron sigue sin evidencia.
  **Portabilidad CI en curso (Codex, 2026-09-08):** Ubuntu no tiene `sandbox-exec`; por ello las
  dos integraciones que ejercitan el sandbox real se saltan únicamente si la sonda inyectable
  declara que no hay sandbox macOS. La sonda cubre de forma determinista Darwin+binario,
  Darwin+ausente y Linux+aun-con-ruta simulada; en Linux el camino productivo conserva
  `infrastructure-error` y `survived:false`, nunca ejecuta evidencia sin aislamiento. En macOS,
  ambas integraciones corrieron: `bun test scripts/adversarial-review.test.ts
  scripts/agent-governance.test.ts` → 21 pass / 0 fail / 87 expects; `bunx tsc --noEmit` y Biome
  de los dos archivos tocaron limpio. Límite explícito: CI acredita la selección portable y el
  fallo cerrado; la frontera real de sandbox se acredita solo en macOS. `test:coverage` y
  `security:gate` se iniciaron localmente pero esta terminal corta su proceso antes de resultado.
  **Evidencia remota:** commit `04e75bd` — CI
  [34285739231](https://github.com/cagr1/orchestos/actions/runs/34285739231) ✅: cobertura,
  typecheck y lint; Secret Check
  [34285739176](https://github.com/cagr1/orchestos/actions/runs/34285739176) ✅: typecheck y
  secretos tracked. No acredita el sandbox macOS, que quedó cubierto por la integración local.
  **Fuera de scope declarado:** `scripts/h10-gate-evidence.json` (el artefacto de evidencia del
  propio gate, exigido por H.10.1 — no estaba en el scope-lock que declaró la corrección) y
  `.orchestos/feature-status.json` (regenerado por el pre-commit desde este mismo PLAN.md).

### H.6 — Fuera de alcance de este bloque (anotado, no se toca)

- `src/cli.ts` tiene **2439 líneas y 63 edges** — god file evidente. Es lo segundo que critica
  un externo después del README, pero no es un hueco de harness. Va a `IDEAS.md` si Carlos lo
  aprueba; **no se refactoriza dentro del Bloque H**.
- Cobertura de líneas 62.91% y `src/skills/fetch.ts` en 0% de funciones. El trinquete ya sube
  solo; no abrir ítem salvo decisión explícita.
- Todo el gobierno del repo está en español con README en inglés. Decisión de producto, no
  defecto — no tocar sin que Carlos lo pida.

---

## Reemplazados — esperan GO para retirarse

Superados por UI.13 (el prototipo es el frontend) o por UI.14. Carlos decide si se retiran; no se cierran como hechos.

- [ ] **UI.3.5 — 🧠 Sistema visual: que se sienta herramienta, no panel de administración.**
  (EN CURSO, abierto 2026-08-30 — decidido en sesión previa con Opus, retomado y confirmado
  aquí). **Pausa `UI.4`**: las 9 pantallas que faltan no se migran con paridad al look viejo
  para no tocarlas dos veces — nacen ya con el sistema nuevo cuando les toque.

  **Motivo, con Carlos preguntando directo:** "cuando dije cambiar la apariencia no era solo
  usar React sino que el dashboard se sienta como herramienta" — comparando con Claude Code,
  Codex, Orca, Hermes. Medido en el CSS, no opinado: 15 tamaños de fuente + 86 `font-size`
  inline (vs. 4–5 en una herramienta real), 10 radios de borde distintos, 253 `style="..."`
  inline, 33 `.card` (cada cosa en su caja). Eso es lo que lee como "panel de administración":
  no hay sistema, hay 253 excepciones.

  **Decisión (confirmada por Carlos, dos preguntas cerradas):**
  1. El sistema visual entra **ahora**, en una sola pasada — no se migran las 9 pantallas
     restantes con el look viejo para reajustarlas después.
  2. **UI.6** (capas de proyectos/carpetas, sidebar Chat|Code) se queda donde está en el
     roadmap; no se adelanta.
  3. El **carril de estado** (glifo + peso tipográfico en vez de badges de color) — confirmado
     como la pieza más visible del cambio.

  **Qué NO se toca:** los hex base y los 4 temas existentes. El problema medido no es la
  paleta (`#0d1117` + acento azul ya es la familia correcta, tipo GitHub Dark/Zed) sino cómo
  se usa — decorativa en vez de señal.

  **Tokens nuevos:**
  - Tipografía: de 15 tamaños a 5 (`11·12·13·15·19`, 13 = cuerpo, 19 = título de pantalla).
    Regla de reparto explícita: mono para todo dato (id, modelo, costo, fecha, ruta), sans solo
    para prosa y labels — hoy están mezclados sin criterio.
  - Radios: de 10 a 2 (4px controles, 8px contenedores). `999px` sobrevive solo para el pill
    de estado del header — único elemento que debe leerse como pill.
  - Color = señal, nunca decoración: reservado a error, en-ejecución, y acción primaria. Todo
    lo demás vive en la escala de grises.
  - Densidad: altura de fila fija y compacta; muere `.card` como contenedor por defecto — la
    jerarquía pasa a hacerse con línea de 1px + espaciado, no caja con borde+fondo+sombra.
  - Acciones que no compiten: en cards, los botones aparecen en hover (o en menú `⋯` para la
    acción destructiva), no los 5 siempre visibles que tiene `skills` hoy.
  - **Carril de estado** en vez de badges de colores en filas de tabla/lista: un glifo (`●`
    `✗` `○`) + peso tipográfico mono, separador de 1px sin caja. Ej.: `● spec-activa-1  draft
    ok` en vez de `[draft][PASS] sí` con 4 badges de color.

  **Alcance de esta pasada:** tokens en `ui.css`, componentes de `UI.2` reajustados, el shell
  de `UI.3`, y `specs`+`skills` (ya son React — barato reajustarlos). Matar los `style=` inline
  ya introducidos en ese React. **Fuera de alcance, explícito:** las 9 pantallas de `UI.4` que
  faltan (nacen con el sistema nuevo al migrarse) y `UI.6`.

  **Gate, invertido respecto del resto de la migración:** los gates existentes de
  `specs`/`skills` miden *paridad* contra el vanilla — hay que reescribirlos para que midan que
  el look **cambió** de forma consistente: 5 tamaños de fuente, 2 radios, cero `style=` inline
  en el React tocado, carril de estado presente donde antes había badges.

  **Progreso (2026-08-30):**
  - [x] Tokens en `ui.css`/`styles.css`: `--fs-1..5` (11/12/13/15/19), `--radius` 6→4,
    `--radius-lg` 8, `--radius-pill` 999px (única sobreviviente del pill de estado del
    header). Utilidades `.fs-1..5` para reemplazar `font-size` inline en React.
  - [x] **Carril de estado** en `SpecsScreen.tsx`: fusiona las columnas Estado+Lint en una
    (`● draft ok` / `✗ approved 3 findings` / `○ archived —`), clase `.status-rail` nueva en
    `styles.css`. `.badge` no se toca: lo siguen usando las 9 pantallas sin migrar.
    **Gate en vivo:** navegador real (Playwright) contra el dashboard corriendo en :4325 —
    capturas confirman el carril sin la línea de `border-left` que traía por colisión de
    nombre con `.detail` (el span interno se renombró a `.rail-detail` tras verlo en pantalla;
    `.detail` ya era una clase global del panel expandible).
  - [x] **Acciones que no compiten** en `SkillsScreen.tsx`: `.skill-card-actions` pasa a
    `opacity:0` con reveal en `:hover`/`:focus-within` (sin cambiar alto, sin salto de layout).
    **Gate en vivo:** navegador real (Playwright) — captura sin hover no muestra los 5 botones,
    captura con hover sí.
  - [x] `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, ratchet sin
    mover).
  - [ ] Pendiente de esta pasada: barrido de `font-size`/`border-radius` en el resto de
    `styles.css`/`screens.css` (vanilla compartido, ~80 sitios — se hará agrupado por pantalla
    para poder verificar en vivo cada tanda, no en un sólo sed masivo); reajuste de
    `Button`/`Input`/`Combobox`/`Dialog`/`Toast`/`Tabs` (`UI.2`) a los tokens nuevos; el shell
    (`UI.3`); reescribir `ui4-specs-screen.mjs`/`ui4-skills-screen.mjs` para medir el look
    nuevo en vez de paridad contra vanilla (quedaron en rojo en las 2 aserciones de paridad de
    columnas/badges — esperado, hay que reemplazarlas, no arreglarlas).
- [ ] **UI.4 — 🧠 Pantallas, en orden de valor.** (PAUSADO por `UI.3.5` — 2 de 11 migradas con
  el look viejo: `specs` ✅ `skills` ✅. Al retomar, reciben el sistema nuevo de `UI.3.5`; las 9
  que faltan nacen ya con él.)
  **Recolocado 2026-09-02 (UI.8):** las 9 pantallas restantes **no se migran hasta que exista el
  gate de `UI.8.1` y esté hecho `UI.8.3`**. Motivo medido: sin el gate, cada pantalla nueva
  reproduce el problema de UI.3.5 (tokens definidos, 4.5% de adopción); y migrarlas antes de
  `UI.8.3` las hace nacer dentro de la navegación que el documento de dirección declara
  anti-patrón.

  **Progreso**
  - [x] **`specs`** (2026-08-30) — la primera. **Gate en vivo:** navegador real (Playwright),
    **21/21 PASS** (`scripts/ui-gates/ui4-specs-screen.mjs`); `tsc` ✅; `test:coverage` ✅
    (1174 pass / 0 fail); sin regresión en los 4 gates anteriores (27+32+19+9, todos verdes).
  - [x] **`skills`** (2026-08-30) — **implementada por Codex, gate escrito por Claude en
    paralelo y sin ver su código** (roles invertidos respecto de UI.3, donde fue al revés).
    **Gate en vivo:** navegador real (Playwright), **22/22 PASS**
    (`scripts/ui-gates/ui4-skills-screen.mjs`); `tsc` ✅; `test:coverage` ✅; los 6 gates del
    mes en verde.
    Ejercita lo que `specs` no tenía: layout de cards en vez de tabla, confirmación de borrado
    **inline** dentro de la card (no un modal) y una segunda sección con las skills "pro"
    importables. Codex resolvió bien el punto delicado por su cuenta: `useState` **solo** para
    estado efímero de interacción (qué card pide confirmación, "copiado", botón ocupado) y los
    datos siempre desde `window.state` — que es exactamente la frontera correcta.
    **Lo que hubo que corregirle:** dejó las 260 líneas del render/wire viejos **comentadas**
    en vez de borrarlas. Es el código muerto que `UI.5` tendría que limpiar, y peor: código
    comentado que parece vigente y vuelve intocable el archivo. Se borraron; el historial de
    git ya las conserva.
    **Y tres fallos seguidos del gate, todos por lo mismo** — el elemento de referencia no era
    equivalente: primero comparó badges contra Runs (que solo tiene `.badge` pill, 999px),
    después contra Tasks (cuyo primer `.badge.square` lleva un `font-size` **inline** propio de
    esa fila). Se resolvió con la técnica del gate de UI.2: **crear un elemento limpio con las
    mismas clases** en vez de buscar uno existente. Es la forma robusta de medir paridad y
    conviene usarla desde el principio en las 9 pantallas que faltan.
  - [ ] `chat`, `tasks`, `runs`, `graph`, `settings`, y las de Observabilidad.

  **El mecanismo que hizo falta inventar acá, y que usan las 10 que faltan.** Una pantalla no
  se puede migrar como se migró el combobox. `App.rerender()` hace `main.innerHTML = …`, así
  que el registro de islas remontaría la pantalla entera **en cada poll de 30s**: se perderían
  el scroll de la tabla, la fila abierta y cualquier input a medio escribir. En un combo no se
  nota; en una pantalla la vuelve inusable. Solución: un flag `react: true` en el objeto de
  `SCREENS`. Para esas pantallas `rerender()` cambia de significado — ya no es "repintá el
  DOM" sino **"avisale a React que el estado cambió"**: el contenedor se escribe una sola vez
  al entrar y después se deja quieto. El gate lo verifica marcando el nodo del DOM y
  comprobando que la marca sobrevive al repintado.

  **El estado NO se copia a React** (`lib/app-state.ts`). Una pantalla lee cualquier cosa de
  `state` —`specs`, `specsStatus`, `openSpec`, `archOpen`, `bulkSelected`— y cada una un
  subconjunto distinto: enumerarlos en un store tipado sería mantener once copias del estado
  que ya existe. El componente lee `window.state` directamente, igual que hacía el `render(st)`
  al que reemplaza, y `useAppVersion()` solo le avisa cuándo releer. El acoplamiento es
  deliberado y temporal: mientras `app.js` sea el dueño de los fetch, duplicar los datos crea
  dos fuentes de verdad. Se invierte en `UI.5`.

  **Cómo se mide "no cambió el aspecto", ahora que no hay código viejo con qué comparar:** el
  gate compara el estilo computado de la tabla de Specs (React) contra la de **Runs, que sigue
  100% en vanilla** y usa las mismas clases. Padding, tipografía y borde dan idénticos. Cuando
  Runs se migre habrá que mover esa referencia a otra pantalla que siga en vanilla.

  **Dos hallazgos de la primera pasada:**
  1. **Un crash real, preexistente, que la migración expuso.** El handler de `lint` hacía
     `if (d.findings && d.findings.length === 0) … else d.findings.length` — o sea, una
     respuesta SIN `findings` (un 404, un error del servidor) caía al `else` y explotaba con
     *"Cannot read properties of undefined"*. Estaba igual en el vanilla. Se vio al correr el
     gate contra una spec inexistente. Arreglado con una guarda: un error de la API sale como
     aviso, no como crash. **No es rediseño** — un crash no es una funcionalidad que preservar.
  2. **Dos fallos del gate, no del código** (mismo patrón que en UI.3, y conviene reconocerlo
     rápido): la paridad visual comparaba contra **Skills, que no usa tabla** —su layout es de
     cards—, así que no medía nada; y el chequeo de "las activas no llevan checkbox" usaba el
     índice de card equivocado y medía justamente la tabla que sí debe llevarlo.

  **Refactor sin cambio de comportamiento:** `bulkDelete()` estaba inline dentro del listener
  de `wireBulkSelect()`; se extrajo tal cual para que las pantallas React lo invoquen sin
  duplicar la lógica ni el copy de confirmación.

  `specs` y `skills` primero (las más chicas — validan el patrón de migración de pantalla completa),
  después `chat` (la home, mayor valor visual), `tasks`, `runs`, `graph`, y `settings` al final
  (la más grande, ~900 líneas).
  **Una pantalla = un commit = verificación en vivo.** Sin acumular (regla de cadencia de commits).
  **Migrar ≠ rediseñar**: primero paridad funcional, las mejoras visuales vienen después.
- [ ] **UI.5 — 🧠 Limpieza.**
  Borrar el `render()`/`wire()` muerto; `screens.css`/`styles.css` reducidos a tokens;
  `index.html` con un solo `<script>`.
- [ ] **UI.6 — 🧠 Dos profundidades, una sola realidad: Chat | Workspace (backend ya listo por CC.2/CC.3).**
  Absorbida desde el Sprint 29 el 2026-08-18: CC.2 y CC.3 entregan schema + endpoints + tests, y toda
  su superficie visual se construye acá, en React, **nunca en vanilla**.
  Sidebar izquierdo: **Chat | Workspace** arriba (shadcn `Tabs`), y debajo el árbol de proyectos
  como carpetas colapsables (shadcn `Collapsible`/`Sidebar`) con sus sesiones. En `Workspace` se
  ven los proyectos con sus agentes; en `Chat` se ven las conversaciones — incluidas las
  "generales" (`project_id NULL`). Se reemplaza el nombre previo `Code`: OrchestOS no se limita a
  proyectos de software. Cada sesión muestra su agente (inmutable) y su modo (mutable).
  El picker de agente de CC.D2 se reconstruye acá apuntando a `PATCH /api/chat/sessions/:id`,
  ya no a `PUT /api/config`.

  **Dirección confirmada por Carlos (2026-09-02):** Chat es la entrada por defecto para usuario
  normal; Workspace es la profundidad operativa para trabajo serio. Ambos representan los mismos
  chats, proyectos, tareas y runs — nunca se duplican ni se migran entre dos productos. Cuando
  una conversación genera trabajo persistente, `Ver espacio de trabajo` abre el proyecto, agente
  y ejecución de origen. La fuente completa de investigación, reglas de componentes, seguridad y
  criterios de aceptación es `docs/dashboard-experience-direction.md`.
  **Fuera de scope declarado:** `.orchestos/feature-status.json` se regenera automáticamente desde
  `PLAN.md` por el pre-commit; no es una edición manual ni un cambio de producto adicional.
- [ ] **UI.7 — 🧠 Navegación progresiva: muere "modo avanzado".**
  Absorbe el ex-CC.4 y el ex-BB.3. Elimina `navModeBtn` y el flag
  `localStorage['orchestos-mode']` (`app.js:1593`, `2263`, `2286-2337`) — el eje deja de ser un
  modo etiquetado y pasa a ser profundidad contextual: Chat | Workspace.
  Observabilidad no compite como navegación primaria: Tasks, Runs, Graph, Specs, Skills, Memory e
  Instincts aparecen dentro del proyecto, agente o ejecución pertinente. `Activity` queda como la
  única vista transversal explícita para cruzar proyectos. Settings conserva sólo configuración
  global; Project/Memory/Instincts no se esconden allí si pertenecen a una entidad seleccionada.
  El inspector derecho pasa de riel siempre presente a detalle condicional de la entidad elegida.
  `SCREENS.runner` se borra (deuda CC.0-D5).
  **Gate 🔍 en vivo**: es el equivalente visual de CC.5 — dos proyectos, una sesión por proyecto,
  cada una con un CLI distinto, verificado con navegador real.

### UI.8 — El cambio real: mecanismo, datos y anatomía (ABIERTO 2026-09-02)

> **Origen: auditoría crítica pedida por Carlos el 2026-09-02**, con su veredicto textual:
> *"el cambio que está en UI no hay cambio real, OrchestOS sigue viéndose igual"* y *"si le
> estamos haciendo ya meses a esto, no solo que trabaje bien, también que se vea excelente"*.
>
> **Por qué UI.3.5 no produjo cambio visible — medido, no opinado (2026-09-02):**
>
> | UI.3.5 declaró | Medido hoy en `styles.css` + `screens.css` + los 3 `.js` |
> | --- | --- |
> | "de 15 tamaños de fuente a 5" | **8** usos de `var(--fs-*)` vs **~168** `font-size` hardcodeados → **4.5% de adopción**; siguen vivos `12.5px`, `11.5px`, `13.5px`, `10.5px`, `14.5px`, `0.84em` |
> | "de 10 radios a 2" | **15** valores distintos de `border-radius` (45 usos de token vs 52 crudos) |
> | "253 `style=` inline" como diagnóstico | **270** hoy (app.js 119 · screens-ops.js 80 · screens-core.js 54) — **subió 17** |
> | "muere `.card` como contenedor" | **33** usos, el mismo número del diagnóstico original |
>
> **Causa raíz, y no es de diseño:** UI.3.5 exigía textualmente un *gate invertido* que midiera
> que el look **cambió**. Nunca se escribió — `scripts/ui-gates/` va de `ui0` a `ui4`, no existe
> `ui35-*`. Es la Regla Cero de `CLAUDE.md` en su forma más pura: *una regla escrita que nadie
> hace cumplir mecánicamente deja de existir en la práctica*. Agregar más dirección visual sin
> ese gate reproduce el mismo resultado con más páginas de documento.
>
> **Segundo hallazgo, que convierte UI.6/UI.7 en trabajo de backend antes que de interfaz.** El
> documento de dirección afirma *"el chat, la tarea, el run y el proyecto son los mismos
> objetos"*. El schema no lo sostiene:
> - `runs.project_id TEXT` **sin FOREIGN KEY** (`src/db/migrate.ts:197-217`), mientras
>   `context_chunks` sí la tiene (línea 194). Un run puede apuntar a un proyecto inexistente.
> - `projects.id` es `TEXT PRIMARY KEY` (181) pero `files.project_id` (221) y
>   `code_edges.project_id` (233) son `INTEGER NOT NULL`, sin FK. Y
>   `src/graph/index.ts:172,180` (`upsertFile(projectId: string, …)`) **inserta un string en esa
>   columna INTEGER**: funciona sólo por la tipificación laxa de SQLite; el schema declarado
>   miente sobre lo que guarda. UI.7 exige "Graph dentro del proyecto" — ese join no está
>   garantizado.
> - **No existe entidad `agents`.** El groupbox de agente que la dirección pide no tiene de dónde
>   leer estado propio.
>
> **Carlos autorizó explícitamente el trabajo de backend (2026-09-02):** *"si por hacer esto toca
> agregar código en el back, pues que así sea"*.
>
> **Conflicto de decisiones resuelto.** `index.html:35-42` documenta el panel derecho como
> *"SIEMPRE presente… el toggle nunca cambia de posición"* — corrección de Carlos del 2026-07-13,
> ronda 4. La dirección del 2026-09-02 lo prohíbe (*"inspector condicional… no existe como riel
> vacío permanente"*). Carlos zanjó el 2026-09-02: *"el rumbo que quiero llevar es el mencionado,
> no el anterior"*. **Gana el inspector condicional; la decisión del 2026-07-13 queda revertida**
> — se conserva escrita, no se borra (memoria evolutiva).
>
> **Anatomía concreta: `docs/ui-reference-patterns.md`** (nuevo, 2026-09-02). Extraída de las
> capturas que Carlos tomó de Orca y Lightdash (`~/Documents/screens/`, fuera del repo por peso) y
> del README de `pi-agent-dashboard`. Ningún ítem de abajo se diseña por intuición: la anatomía ya
> está escrita ahí y se cita por sección.
- [ ] **UI.8.4 — 🧠 Shell Chat | Workspace (absorbe UI.6).**
  Inspector **condicional** (0px cerrado, no riel), con ancho persistido y una sola fuente de
  selección en el estado del shell. Árbol de proyectos con agentes como filas colapsables
  (§A.2), selección como único contenedor con borde (§A.3), anomalías inline (§A.4).
  **Contrato de la transición Chat → Workspace**, que hoy no está definido:
  1. Si la conversación **no** generó trabajo persistente, la acción **no aparece** (no aparece
     deshabilitada — un botón que a veces no lleva a ningún lado es el "botón que no hace nada"
     de la Regla Cero).
  2. Si lo generó: abre **proyecto + entidad de origen ya seleccionada**, misma pestaña, con el
     chat conservado y accesible en un gesto de vuelta.
  Gate 🔍 en vivo con los dos casos de (1) y (2).
  **Progreso — 3 piezas (árbol de agentes, contrato Chat→Workspace, inspector condicional); UI.8.4c/UI.9.5 cerradas, padre pendiente del gate agregado:**
  - [x] **UI.8.4a — agentes como filas colapsables** (cerrada 2026-09-15)
    Ejecutado por: luna · Spec: docs/specs/UI.8.4-agents.md
    Header `N agents ⌄` por proyecto en `Sidebar.tsx`, filas = sesiones de `chat_sessions`
    (icono+título+tiempo relativo, sin borde/caja), click abre esa sesión en Chat, fila activa
    marcada con borde (§A.3). Sesiones de un proyecto no-cwd se listan con `?project=<id>`
    puntual (el backend ya lo soportaba) — no es ERP.2, ningún otro endpoint quedó filtrado por
    proyecto. Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/UI.8.4-agents-live.json` — dos proyectos reales, sesiones no se mezclan.
    Límite menor conocido: el contador muestra `0 agents` hasta el primer expand (carga
    perezosa a propósito, no dato falso).
  - [x] **UI.8.4b — contrato Chat→Workspace** (cerrada 2026-09-15)
    Ejecutado por: luna · Spec: docs/specs/UI.8.4-workspace.md
    `sessionHasPersistentWork`/`getLastPersistentTaskId` (`src/db/chat-turns.ts`) leen
    `chat_turns.task_id`; `toSessionRow` expone `hasPersistentWork`/`lastPersistentTaskId`.
    Botón "Open in Workspace" en `SCREENS.chat` solo existe en el DOM si la sesión activa
    generó una tarea — nunca deshabilitado. Click navega a `workspace` con el proyecto de la
    sesión, tab `tasks` activo, y abre `SidePanel.openTask` con la tarea real. Volver a `Chat`
    desde el riel conserva la sesión sin tocar nada nuevo.
    Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/UI.8.4b-live.json`
    — caso 1 (sin trabajo persistente) confirma el botón ausente del DOM; caso 2, con un turno
    real apuntando a una tarea real (`crypto-page-v1`), confirma workspace+tab+SidePanel
    correctos y la sesión preservada al volver. `bunx tsc --noEmit`, `bunx biome check` (0
    errores) y `bun run test:coverage` (1431 pass) verdes.
  - [x] **UI.8.4c — inspector condicional** (0px cerrado, ancho persistido), retomada por UI.9.5
    tras UI.9.1–9.4; spec re-leído y actualizado contra el shell Chat | Dev actual
    (`docs/specs/UI.8.4c.md`).
    Ejecutado por: luna · Spec: docs/specs/UI.8.4c.md
    Gate en vivo: navegador real (Playwright/dashboard), evidencia en `docs/done/evidence/UI.9.5-live.json`; el flujo UI.9.2 Open in Workspace no fue observable porque no había sesiones persistentes elegibles en la base real, y queda documentado en la evidencia junto al error preexistente de Sidebar al cambiar Dev→Chat.

  **Anotado por Carlos (2026-09-15), pendiente de planificar, no implementado todavía:** donde
  hoy dice "Projects" en el riel debería tener un ícono `+`/carpeta-con-agregar para dar de alta
  un proyecto nuevo desde la UI (hoy solo se registra vía `orchestos index`/CLI o
  `POST /api/project/index`, nunca desde el dashboard). Al agregarlo, tiene que poder verse y
  editarse las opciones de ESE proyecto — esto viviría en Settings, en una sección de proyectos
  (encaja con `UI.8.5` § Settings agrupado por alcance: `Global · Proyecto · Agente`, ver
  `PLAN.md` línea ~1780). Carlos también notó que el tab `Runs` se siente duplicado con
  `Activity` (que hoy reusa literalmente `SCREENS.runs` — ver decisión de UI.8.3 arriba); a
  revisar si `Activity` debe ser una vista distinta (cruzando proyectos, per
  `dashboard-experience-direction.md` línea 84) en vez de un alias del mismo contenido que ya
  vive dentro del workspace de cada proyecto.
- [ ] **UI.8.5 — 🧠 Composición visual: barra de estado, Settings y controles.**
  Recién acá entra "que se vea excelente", y con la anatomía ya escrita:
  - **Barra de estado inferior permanente** (§A.5): `% de contexto + tiempo de sesión` a la
    izquierda, avisos al centro, recursos a la derecha. **Es la superficie que `H.7.5` necesita**
    — el % de contexto no va en una card del home. Resuelve también dónde vive el costo en Chat.
  - **Settings agrupado por alcance** (§B.1): `Global` · `Proyecto` · `Agente`, con la anatomía de
    fila de §A.9 (label + descripción de una línea + control a la derecha, sin divisores).
    Corrige el reclamo textual de Carlos: *"Settings no parece usable, hay cosas que hay que
    desaparecer o darles sentido"*.
  - **Selector de agente como chips con icono** (§A.10), no `<select>`; `Combobox` se reserva para
    listas largas (`reference-model-combo-pattern`).
  - **Barra de uso de contexto** en la fila de sesión (§C.2).
  Gate 🔍: el de UI.8.1 en verde sobre estas pantallas, más navegador real.
- [ ] **UI.8.6 — 🧠 Permisos visibles (`INS-2026-014`).**
  Hoy **no existe** mecanismo de aprobación en el chat: el harness invoca los CLIs en modo no
  interactivo por diseño (`codex exec --sandbox workspace-write` en `src/run/executors/codex.ts`,
  equivalente en `external.ts`). El documento de dirección lo exige y sin este ítem queda como
  prosa incumplible — el mismo patrón que dejó a UI.3.5 sin efecto.
  Modelo tomado de Orca (§A.6, §A.11): tira permanente de una línea sobre el compositor
  declarando el estado real, más un segmented control honesto `Yolo | Manual` en Settings del
  agente. No un modal que se acepta una vez y se olvida.

**Decisiones pendientes de Carlos dentro de UI.8** (no las toma ningún LLM):
1. `agents` como tabla propia o proyección derivada (UI.8.2).
2. Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no.
3. Si UI.8.6 entra en este bloque o sale como bloque propio con backend separado.

### UI.9 — Shell de dos modos: Chat | Dev (ABIERTO 2026-09-15)

> **Revierte una decisión, sin borrarla.** El 2026-09-02 (UI.7/UI.8.3) se decidió que Chat |
> Workspace fuera profundidad contextual y no un modo etiquetado, y se borró el "modo avanzado".
> El 2026-09-15 Carlos pidió textualmente un switch explícito arriba a la izquierda, como Claude
> Desktop: *"poner el switch en la parte de arriba para hacer un chat normal donde ahí sí se puede
> seleccionar cualquier modelo… y los chats se van acumulando en ese mismo lado izquierdo"* y
> *"si quiero dev entonces ahí se activa el 'modo orca' donde puedo abrir proyectos (carpetas) y
> así mismo los agentes se verán del lado del aside debajo del proyecto"*. **Gana el switch
> explícito.** El texto de UI.7/UI.8.3 queda como historial.
>
> **Motivo medido (auditoría en vivo 2026-09-15):** la lista de sesiones aparece dos veces
> (sidebar `Sidebar.tsx:111-179` rotulada "N agents" + aside del chat `screens-core.js:474-529`);
> las "agents" del sidebar son `chat_sessions`; el rail colapsado amontona "Projects" y
> "0 agents". Referencias: Dev = `~/Documents/screens/Orca1_main.png` (`docs/ui-reference-patterns.md`
> A.1–A.7); Chat = captura de Claude Desktop de Carlos (2026-09-15).
>
> **Decisiones de Carlos (2026-09-15):** (1) cada modo muestra lo suyo — Chat lista sesiones
> `project_id NULL`, Dev las de cada proyecto; (2) "agente" en Dev = sesión de chat con CLI dentro
> del proyecto, tareas/runs siguen en Workspace/Activity; (3) agregar proyecto = diálogo nativo de
> macOS abierto por el servidor; (4) el switch cambia sidebar **y** canvas (último chat general o
> vacío ↔ último proyecto/agente). Plan completo: absorbido en este PLAN.md el 2026-09-17 al borrar `NEXT.md`; sus dos requisitos huérfanos (datos sembrados y pantalla legacy `tasks`) viven ahora en § Entregable rápido.

> **Orden (Carlos, 2026-09-15): UI.9.4 va primero.** OrchestOS se prueba desde la interfaz: *"si
> funciona ya en back se lo debe mostrar en el front, sino no existe"*. El gate de UI.9.1 necesita
> ≥2 proyectos y registrar un proyecto hoy solo existe por CLI — ningún gate puede exigirle un
> comando a Carlos.
- [ ] **UI.11 — 🧠 Sidebar de proyectos con la cara nueva (pieza 1 del orden de arriba).** (abierto 2026-09-21)
  Decisiones 1, 3 y 5 de Carlos + loader/check, sin pill `IDLE`, temas renombrados y botón fijo
  del panel derecho. **Ajuste del cerebro al orden:** si el clic en el proyecto deja de abrir el
  workspace, Tasks/Runs/Graph/Memory/Instincts quedan sin camino hasta la pieza 2, y los botones
  Explorer/Diff/Terminal también (viven en la barra del workspace desde `UI.9.A`). Por eso esta
  pieza suma esas pestañas a la página del proyecto en Settings (`UI.10`), el ítem *Project
  settings* del menú `…` y el toggle `#rpToggle`. *Delete project* sigue en `UI.9.9`.
  Spec: `docs/specs/UI.11.md`. Ejecuta Luna después de `CI.2.A`; gate
  `scripts/ui-gates/ui11-sidebar-projects.mjs`, 3 corridas verdes, captura revisada contra Orca y
  Circle.
  **PAUSADO 2026-09-21 (Luna detenida con SIGSTOP a mitad de ejecución, diff sin commitear en el
  working tree).** Carlos trajo una **guía visual nueva**: un prototipo hecho en Google AI Studio,
  `~/Documents/screens/orchestos-ai-agent-dashboard` (Vite + React 19 + Tailwind v4 +
  lucide-react, solo datos mock). Palabras de Carlos: *"esta va a ser la guía visual que vamos a
  tener para este proyecto… es solo un ejemplo, algunos botones no valen, otros están repetidos,
  pero la intención de cómo luce está ahí"*. Pidió auditar el código y darle un prompt para
  completarlo en AI Studio. UI.11 se re-especifica contra esa guía antes de reanudar.
  **Aclaración de Carlos (mismo día), regla para todo el rediseño:** el prototipo es la **esencia
  del look**, no el default funcional: *"me gusta como se ve pero no necesariamente vamos a
  aplicarlo al pie de la letra sino ordenado a como ya lo tenemos aquí"*. Si una pantalla del
  prototipo contradice una decisión ya tomada, gana la decisión; si no queda claro, se pregunta.
  Pestaña "Props" del panel derecho: **se elimina** (vino de la captura de Orca). Ronda 2 del
  prototipo verificada en vivo; ronda 2 del prompt en `docs/ui-aistudio-prompt.md`.
  **2026-09-21, cierre del prototipo:** Carlos da por terminado el prototipo (3 rondas de prompt) y
  pide implementar. `UI.11` queda **reemplazado por `UI.12`**; el diff parcial de Luna (medidas de
  Circle) se guardó en `git stash` ("UI.11 parcial de Luna…"), sin commitear.
- [ ] **UI.12 — 🧠 Look nuevo sobre el producto real, desde el prototipo de AI Studio.** (abierto 2026-09-21)
  **2026-09-21: reemplazado por `UI.13`** (decisión de Carlos: el prototipo es el frontend, no se trasplanta al vanilla).
  Guía: `~/Documents/screens/orchestos-ai-agent-dashboard` (esencia del look, no spec funcional;
  memoria `feedback-prototipo-es-esencia-no-spec`). **Dos cosas que NO se copian (Carlos):** el
  uso de los CLI se queda **como está hoy** en el producto (no las barras "CLI QUOTAS" del sidebar
  ni la barra "SESSION CONTEXT" del prototipo); y en la página del proyecto en Settings, *Delete
  project* **no** va al pie de cada pestaña sino como **una pestaña más** del proyecto.
  **Por qué empieza por tokens:** todo el producto (vanilla + islas) lee un solo juego de
  variables (`styles.css:6-80`, mapeado a Tailwind en `ui.css:32-64`). Cambiar sus valores a los del
  prototipo reviste la app entera en un solo paso barato; el resto es estructura, pantalla a
  pantalla. Fases, una por ítem, en orden:
  1. `UI.12.1` Tokens, temas, fuentes, radios y escala tipográfica del prototipo.
  2. `UI.12.2` Shell: header, sidebar de proyectos (decisiones 1 y 5, loader/check), estado vacío
     con logo, panel derecho Files | Diff | History con toggle único.
  3. `UI.12.3` Settings: navegación con los grupos del producto, un ítem por proyecto, página del
     proyecto con pestañas + pestaña de borrado, Executor como un solo *Default agent*.
  4. `UI.12.4` Chat: mensajes, filas de herramientas, compositor con agente/modelo/esfuerzo.
  5. `UI.12.5+` Pestañas del proyecto (Tasks, Runs, Graph, Memory, Specs, Skills, Instincts, Plan),
     una por ítem.
  Fuera: History con archivo real de agentes y *Delete project* con su back (`UI.9.9`) son ítems de
  producto aparte; esta cadena es el look.
- [ ] **I.5 — 🧠 Rediseño del chat: sacar la implementación de la cara del usuario.**
  Carlos comparó contra Orca, Xirp, Hermes, ChatGPT y Claude: *"hay mucho texto, una interfaz poco
  amigable y moderna"*. Los textos ofensores están verificados en `src/dashboard/public/i18n.js`:
  - `:1003` — `"Sin cablear para el chat todavía — cae a OpenRouter"` ← una **nota de
    implementación** en la cara del usuario.
  - `:994-996` — `"Claude · tu suscripción"`, `"Codex · tu suscripción"`, `"OpenCode · tu
    suscripción"`.
  - `:984` — `"Esfuerzo de razonamiento"`; `:1005` — `"Restablecer a lo predeterminado"`.

  Objetivo: **una sola píldora compacta**, con todo lo demás dentro de un popover.

      ┌──────────────────────────────────────────────┐
      │  ¿Qué querés construir?                      │
      │                                              │
      │  [◈ Codex] GPT-5.4 · Medio        [↑ Enviar] │
      └──────────────────────────────────────────────┘

  Y el trabajo se reporta **inline en el hilo** — sin navegación, sin modal:

      ⏺ Voy a tocar 3 archivos en src/auth/          [Ver] [Cancelar]
      ⏵ Ejecutando · 1 de 3 · src/auth/login.ts             [Detener]
      ✓ Listo · 3 archivos · 47s                    [Ver cambios]

  Se hace en React sobre el design system existente ([[feedback-no-reinventar-ui-usar-libreria]] —
  decisión cerrada, no re-litigar) y con el estándar de acabado permanente
  ([[feedback-acabados-elegantes-siempre]]). Barra de usage por agente
  (`[icono] Claude 61%  [icono] Codex 34%`): **iterar sobre lo que H.7.5 ya entregó, verificando
  primero qué muestra hoy** — y sin confundir los dos ejes, porque ese % es **cupo de cuenta**, no
  ventana de contexto ([[reference-orca-rate-limit-no-contexto]], INS-2026-016).

  **5 defectos concretos ya reportados por Carlos en vivo (2026-09-04), verificados en el código,
  a corregir dentro de este mismo ítem — no antes, para no tocar `SessionStatusBar.tsx` dos veces
  (decisión explícita de Carlos: "esperar al Bloque I"):**
  1. Los íconos de marca (Claude/OpenAI/DeepSeek/...) se ven todos azules — `ui.css:141`
     (`.session-statusbar-cli-icon { color: var(--metric-color) }`) pensado para un glifo
     monocromo de estado, y los SVG nuevos heredan ese `currentColor` en vez de su color real de
     marca. Hay que separar "color de marca" de "color de estado" (el tono warn/critical/idle).
  2. El popover repite el nombre del agente dos veces — `SessionStatusBar.tsx:40`:
     `<strong>{cli.label}</strong>` + `<small>{cli.binary}</small>`, y para casi todos los CLIs
     `label` y `binary` son la misma palabra ("Codex" / "codex").
  3. El punto verde del popover (`ui.css:163`, `.session-statusbar-popover-dot`) no aporta —
     redundante con el color que ya comunica el ícono/barra.
  4. El popover queda pegado al borde izquierdo de la pantalla — falta separación
     (`sideOffset`/`alignOffset` o padding del contenedor, hoy `align="end"` sin margen).
  5. El refresh es `setInterval` fijo cada 5s (`SessionStatusBar.tsx:24`) sin disparo por evento.
     Debe refrescar también al montar el dashboard (ya lo hace) y **tras cada respuesta del
     chat** — hoy no hay ningún trigger ligado al flujo de chat.
- [ ] **I.6 — ⚡ "Actividad", no "Tasks": la vista secundaria.**
  El nombre importa y es parte del arreglo: *"Tasks"* invita a crear una, *"Actividad"* invita a
  mirar. Lista cronológica con estado; el detalle técnico (engine, modelo, effort, diff, checks,
  **archivos leídos**) solo al abrir un ítem. Es donde aterriza el draft manual que I.1 saca de la
  pantalla principal, y donde viven historial, pendientes, errores, reintentos y recuperación
  manual cuando algo falla.

## Cerrados — evidencia archivada

→ [cerrados de AT](docs/done/bloque-AT.md)
→ [cerrados de DOC](docs/done/bloque-DOC.md)
→ [cerrados de H](docs/done/bloque-H.md)
→ [cerrados de I](docs/done/bloque-I.md)
→ [cerrados de R](docs/done/bloque-R.md)
→ [cerrados de S](docs/done/bloque-S.md)
→ [cerrados de ERP](docs/done/bloque-ERP.md)
→ [cerrados de CI](docs/done/bloque-CI.md)
→ [cerrados de GOV](docs/done/bloque-GOV.md)
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
→ [decisiones de Carlos](docs/done/decisiones.md#entregable-rapido) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#ruta-erp) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#i-0-el-orden) — Fase 1
→ [decisiones de Carlos](docs/done/decisiones.md#sprint-30-decision) — Fase 1
