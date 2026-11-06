<a id="plan-orden-erp-1"></a>
- [x] **ERP.1 — 🧠 Un CLI por chat; modelo y esfuerzo propios de la sesión.** (cerrado 2026-09-15)
  Ejecutado por: luna · Spec: docs/specs/ERP.1.md
  Mini-menú en "+ / Nuevo chat" (`screens-core.js`) gateado por `st.executorModes.modes[].detected`;
  elegir CLI crea sesión con `agent` explícito (`app.js: startNewChatSession(agent)`, sin fallback a
  config global); cancelar (click afuera/Escape) no crea sesión ni fetch. Composer perdió el nav
  "agent" — solo modelo/esfuerzo, el CLI queda como etiqueta fija (`buildChatModelFx`). Se borró el
  handler `data-modelfx-agent`/`PUT /api/config` desde el chat (el agente de sesión sigue inmutable
  por `chat-sessions.ts:227`). Gate en vivo: navegador real (Playwright), evidencia en `docs/done/evidence/ERP.1-live.json`
  — 5 CLIs listados, cancelar no cambia el conteo de sesiones,
  elegir crea+activa, Codex y OpenCode coexisten sin pisarse, recargar conserva el CLI. `bunx tsc
  --noEmit` y `bun run test:coverage` (1430 pass) verdes. Dashboard bajado al cierre.
  Complementa AT.10: su exclusión de modelo interno describe solo el arreglo inicial, no el mínimo
  de este piloto. El selector de CLI de AT.10 se ubica en **Nuevo chat**, no como cambio de agente
  dentro del composer. Usar sesiones existentes como fuente de filas, sin nueva tabla `agents`.
  **Aclaración explícita de Carlos (2026-09-15, referencia visual inspeccionada):** al pulsar
  `+ / Nuevo chat`, abrir primero un **mini menú de CLIs**, antes de crear la sesión o mostrar
  su compositor. Cada opción presenta icono y nombre del CLI; elegirla crea y abre el chat en
  el proyecto activo con ese CLI fijado. Cerrar/cancelar el menú no crea una conversación vacía
  ni lanza un proceso. Mostrar disponibilidad real; un CLI sin adaptador o no detectado no
  puede iniciar una sesión. Dentro del chat solo se seleccionan **modelo y esfuerzo** compatibles;
  el CLI se identifica como etiqueta, no como opción intercambiable del selector.
  Referencia: `/Users/carlosgallardo/Desktop/Screenshot 2026-09-15 at 9.20.19 AM.png`, menú de
  nueva pestaña de Orca con filas de agentes. Se adopta ese paso previo para **chats** de OrchestOS;
  la captura no amplía el alcance a terminal, navegador, emulador, Hermes ni Agent Teams.
  Dónde: `src/dashboard/public/app.js:2908`, `screens-core.js:965-1012`,
  `src/dashboard/handlers/chat-sessions.ts`, `chat.ts:1098`, adaptadores `src/run/executors/`.
  Gate: dos chats con CLIs distintos, cambiar modelo/esfuerzo en uno, enviar y recargar; comprobar
  argumentos efectivos, transporte, persistencia y que el otro no cambia. Opciones no soportadas
  se explican; cero fallback API silencioso. Gate AT.10 conserva sus dos CLIs requeridos.
  Añadir al gate en navegador: `Nuevo chat → menú → elegir CLI → chat`, cancelación sin sesión
  ni proceso nuevos, opción no disponible sin creación, y selector posterior limitado a modelo
  y esfuerzo. Recargar conserva el CLI elegido desde ese menú.

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

<a id="plan-orden-erp-2"></a>
- [x] **ERP.2 — 🧠 Alcance de proyecto real en navegación, memoria y capacidades.** (cerrado 2026-10-02)
  Ejecutado por: luna (4 rondas: r1, r1b, gate, gate-fix) · Spec: docs/specs/ERP.2*.md (borrados al cerrar)
  `src/dashboard/ownership.ts` (`requestScope`/`ownsRow`): runs, memoria (lista, `q`, delete, bulk, conflictos),
  instincts, tasks steps y toda ruta `/api/chat/sessions/:id/*` + `POST /api/chat|upload` con `sessionId` validan
  dueño; id ajeno = 404 idéntico al inexistente; bulk ignora ajenos; sin proyecto → solo filas sin dueño / `global`,
  nunca todo. Instincts por proyecto (migración 18, índice único `(COALESCE(project_id,''), trigger)`); históricos
  `NULL` rotulados "Sin proyecto (histórico)" y no aplicados (`listApplicable` solo del proyecto). Skills con
  `origin` Proyecto/Biblioteca; `usageRuns` por proyecto. Front: cada llamada por sesión manda el proyecto DE ESA
  sesión (r1 usaba el último proyecto de localStorage → chats generales daban 404; cazado en revisión). Archivados
  sin selector siguen listando todos. Hermanos: 9 flujos ui-gate consultaban rutas por id sin proyecto.
  Gate en vivo: navegador real con Playwright (`scripts/ui-gate/flows/project-isolation.mjs`) + `src/__tests__/project-isolation.test.ts` contra `route()` (A/B con centinelas, 17 casos 404, bulk mixto, migración 18,
  origin/usageRuns); `bun run test:coverage` 1594/0; `ui:gate project-isolation tasks chat-turn-details` 10/10,
  13/13, 27/27 (`ui-gate-85885`, capturas memoria/instincts/skills por proyecto). No cubierto: capturas "antes"
  (requería worktree de HEAD, no creado sin pedirlo); recorrido único proyecto→chat→tarea→resultado→memoria en un
  solo flujo (cubierto por tramos: tasks + chat-turn-details + project-isolation).
  Original:
  Completa UI.8.3–UI.8.5, no crea una segunda migración visual. Dónde: Sidebar citado arriba,
  estado del shell y `src/dashboard/handlers/memory.ts:7-24,58-90`; revisar los consumidores
  equivalentes de tasks/skills/specs/runs/graph y la selección de memoria para prompts.
  Implementar filtros y validación del proyecto también en lectura, búsqueda y mutaciones;
  datos históricos sin dueño quedan identificados, nunca reasignados o borrados por inferencia.
  Gate: proyectos A/B con centinelas, navegar/buscar/editar y reabrir; A no muestra ni utiliza datos
  de B, tampoco con ID ajeno enviado al endpoint. Biblioteca global y activación local distinguibles.
  Navegador real: proyecto → chat → tarea → resultado → memoria, con Settings separados y
  capturas antes/después contrastadas con las referencias. No cerrar con solo tokens CSS cambiados.

<a id="plan-orden-erp-3"></a>
- [x] **ERP.3 — 🧠 Orquestación opcional con freno efectivo de consumo.** (cerrado 2026-10-03)
  Ejecutado por: luna (r1b, r2, r3, r4) · Spec: docs/specs/ERP.3.md (borrado al cerrar)
  `orchestration: {enabled, maxConcurrent, maxTotal}` por proyecto; ausente = OFF; ON sin límites = rechazo del
  loader/PUT (sin defaults). Freno único `src/run/orchestration-budget.ts` (migración 19): run por ejecución
  (`sha256(root, padre, plan)` + `finished_at`; reanudar conserva total, terminar reinicia), concurrencia por leases
  con PID (proceso muerto libera su lease), `reserveChild` en `BEGIN IMMEDIATE` antes de crear worktree;
  `SchedulerOpts.orchestrationBudget` obligatorio. OFF: auto-split omitido (single-shot), `--expand` y approve-split
  (409) rechazan antes del spawn; Claude se lanza con `--disallowedTools Agent` (medido en vivo: `Task` sale de
  `tools`). Codex: `multi_agent` OFF no cambia nada observable (medido en vivo: mismos eventos) → **no garantizado**,
  igual que OpenCode; capability en `cli-registry.ts`. Settings: switch + límites + activos/total + consumo
  ("desconocida" sin dato) + llamadas adicionales (planner/QA/adversarial/refuter/retries) + garantía por adaptador.
  Gate en vivo: navegador real con Playwright (`scripts/ui-gate/flows/orchestration.mjs`) + `src/__tests__/orchestration-budget.test.ts` (procesos reales: OFF/ausente 0 hijos, N admite y N+1 rechaza, concurrencia
  entre procesos, SIGKILL con lease, reanudación, plan distinto) + handler/args; `bun run test:coverage` 1601/0;
  `ui:gate orchestration` 6/6 por la UI (`ui-gate-16806`), `tasks` 13/13, `project-isolation` 10/10.
  No cubierto: dreaming no existe en el código (no listado); paralelismo real (scheduler sigue serial); tope en USD.
  Original:
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

<a id="plan-orden-erp-3-1"></a>
- [x] **ERP.3.1 — 🧠 Settings no pide orquestación de un proyecto purgado.** (cerrado 2026-10-03)
  Ejecutado por: luna · Spec: docs/specs/ERP.3.1.md (borrado al cerrar)
  Settings omite la lectura de orquestación si el proyecto ya no está en la lista y cancela lecturas/guardados
  pendientes al purgar; guardados con la misma validación de proyecto.
  Gate en vivo: navegador real con Playwright (`src/dashboard/app/src/api/settings.ts`) — `ui:gate project-delete` 11/11
  (antes FAIL por 404 en consola) y `orchestration` 6/6.
  Original:
  Hermano de ERP.3 cazado por el pre-push: `ui:gate project-delete` → `HTTP 404 /api/orchestration` en consola tras
  purgar. Aplicar a la orquestación el mismo resguardo que las demás lecturas por proyecto de Settings.
  Gate: `ui:gate project-delete orchestration` en dashboard real.

<a id="plan-orden-erp-3-2"></a>
- [x] **ERP.3.2 — 🧠 Orquestación solo en la pestaña Tasks del proyecto.** (cerrado 2026-10-03)
  Ejecutado por: luna · Spec: docs/specs/ERP.3.2.md (borrado al cerrar)
  Gate en vivo: navegador real con Playwright (`scripts/ui-gate/flows/orchestration.mjs`, nuevo paso Plan oculta /
  Tasks muestra) — `ui:gate orchestration` 7/7, `plan-doc` 15/15 (antes FAIL, 4 checkboxes), `project-delete` 11/11.
  Original:
  Hermano de ERP.3 cazado por el pre-push: la sección se pinta en todas las pestañas (`OrchestSettingsView.tsx:2258`)
  y `ui:gate plan-doc` cuenta 4 checkboxes en Plan. Mostrarla solo con `activeProjectTab === 'tasks'`.
  Gate: `ui:gate plan-doc orchestration project-delete` en dashboard real.

## Archivado 2026-10-22 desde PLAN.md (DOC.4)

<a id="bloque-erp-erp-4"></a>
- [x] **ERP.4 — 🔍 Piloto de módulo ERP y decisión de utilidad.** (cerrado 2026-10-15)
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
  Decisiones de Carlos 2026-10-12 (GO): módulo = inventario mínimo (2 tablas: productos y movimientos; regla: el
  stock no queda negativo; permiso: solo `admin` registra salidas; API + pantalla: listar productos con stock y
  registrar un movimiento, sin editar ni borrar; tests de aceptación de la regla y el permiso). Repo nuevo de prueba
  fuera de OrchestOS (`~/Projects/projects/erp-piloto`, Bun + SQLite + React). Modelos = los del roster: ejecutor
  Codex `gpt-6-luna`, criterio Claude `sonnet`, revisor Codex `gpt-6.1-sol`; si Model routing difiere, ajustarlo
  solo en el proyecto de prueba y decir qué cambió. Presupuesto: una sesión; parar si la misma etapa falla 2 veces.
  Corrida 2026-10-12: **detenida en la etapa 1** (datos + migración) por la regla de presupuesto: 2 runs de Luna con
  el mismo fallo, "missing declared output(s): data/inventario.sqlite" (el borrador declaró como salida un archivo
  que el `.gitignore` del proyecto ignora; se revierten los 2 archivos correctos). Antes hubo 2 bloqueos sin run:
  proyecto sin `tasks.yaml` (arreglado, ERP.4.1) y mensaje de seguimiento que no crea tarea (el borrador solo lee el
  mensaje actual, `chat.ts:1111`). El fallo no aparece en el chat ni en Settings → Tasks. Model routing del proyecto
  verificado en la UI; el run usó `codex exec -m gpt-6-luna`. 9 hallazgos, tiempos y uso en
  `docs/done/evidence/ERP.4/piloto-2026-10-12.md`. Sin decisión de utilidad todavía: no se llegó a API, UI,
  reinicio a mitad de run ni corrección guardada.
  **Cierre 2026-10-15.** Veredicto de Carlos (2026-10-13): *sirve, pero todavía no solo*. El módulo de inventario
  está completo en `erp-piloto` (migración, regla de stock, permiso, API y pantalla, `bun test` 25/25 verificado hoy),
  con 6 tareas `done`. Las 3 tareas sobrantes se borraron por la API del dashboard (commit `6380641` del proyecto):
  ahora el árbol está limpio. Sub-ítems ERP.4.1–4.17 `[x]`. "No solo" quiere decir esto: llegar al resultado
  necesitó 17 arreglos de producto y la intervención del cerebro en cada etapa.
  Límites restantes: la concurrencia de dos salidas simultáneas no se comprobó. La pantalla no tiene estilos. El rol
  `qa` dio veredicto sin desglose por criterio. Las 6 tareas del piloto son anteriores a ERP.4.16 y no tienen entrada
  en Memory: la primera tarea nueva la dejará. Detalle: `docs/done/evidence/ERP.4/`.
  Sin delegación: ítem padre.

<a id="bloque-erp-erp-4-1"></a>
- [x] **ERP.4.1 — 🔍 El chat crea la primera tarea de un proyecto sin `tasks.yaml`.** (2026-10-12, bloqueo 1
  del piloto) En `erp-piloto` recién registrado, el primer pedido por chat respondió "⚠ Could not auto-create the
  task: tasks.yaml not found — run: orchestos task init" (captura `03-send-e1`): manda al usuario a la terminal y no
  hay puerta en la UI (`/api/tasks/init` existe en `server.ts:238` pero el frontend no lo llama, y además siembra 2
  tareas de ejemplo que nadie pidió). Arreglo: `createTaskRecord` (`src/dashboard/handlers/tasks.ts:257`) crea un
  `tasks.yaml` vacío cuando falta. Gate: test del handler + repetir el pedido en el chat real del piloto.
  Ejecutado por: gpt-6-luna (rol `mecanico`).
  Hecho: `ensureTasksYaml` (`src/tasks/init.ts`) crea `{version, project, tasks: []}` bajo el lock y
  `createTaskRecord` la llama en vez de devolver 404; sin tareas de ejemplo. Tests: `tasks-api-init.test.ts`
  (crea el archivo con solo la tarea pedida; conserva las previas), `test:coverage` 1678/0, `tsc` limpio.
  En vivo (navegador real, dashboard reiniciado): el chat del piloto creó `chat-ad9e193d…` y `erp-piloto` quedó con
  el commit `ed7774c chore(tasks): add …`. Registro: `docs/done/evidence/ERP.4/piloto-2026-10-12.md`.

<a id="bloque-erp-erp-4-2"></a>
- [x] **ERP.4.2 — 🔍 El intento fallido de una tarea se ve en el chat y en Tasks.** (2026-10-12, GO de Carlos;
  hallazgos 4 y 8 del piloto) El servidor ya escribe el reporte en el hilo, pero el chat no recarga mientras la tarea
  siga `pending` (`App.tsx:317`) y el reporte dice "retry scheduled" aunque nadie reintenta (el reintento es manual).
  Settings → Tasks no muestra motivo ni intento. Arreglo: el chat muestra el reporte del intento fallido, el reporte
  dice "failed · attempt N/3" con el motivo, y la tarjeta de Tasks muestra intento y motivo. Gate: tests + chat real
  del piloto.
  Ejecutado por: sonnet (rol `criterio`).
  Hecho: `buildTaskReport` escribe `✗ Task … failed · attempt N/3 · provider/model`; el polling del chat usa
  `isTaskStillRunning` (un `pending` con intento fallido ya no cuenta como en curso); la tarjeta de Tasks muestra
  `Attempt N/3 failed: motivo` con una clase que el archivo ya usaba. `test:coverage` 1683/0, `tsc`, lint, build y
  `ui:fidelity:jsx` limpios. En vivo: la tarjeta del piloto mostró "Attempt 2/3 failed: missing declared output(s):
  data/inventario.sqlite".
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.4.2-live.json` — `qa-negative` 23/23,
  `auto-flow` 31/31.
  Límite: el reporte de fallo apareciendo solo en el hilo sin recargar no se vio en vivo (no hubo otro fallo tras el
  arreglo); lo cubre el test de `isTaskStillRunning`. Fuera de alcance, sigue abierto: el check verde del hilo en
  Dev y la falta de una puerta de reintento en el chat.

<a id="bloque-erp-erp-4-3"></a>
- [x] **ERP.4.3 — 🔍 El borrador no declara como salida un archivo que el proyecto ignora.** (2026-10-12, GO de
  Carlos; hallazgos 3 y 9) El borrador declaró `data/inventario.sqlite` (ignorado por `.gitignore`, generado al
  ejecutar) y el contrato falló 2 veces por ese archivo. Arreglo: `buildNaturalDraft` descarta de `output` lo que
  `git check-ignore` marca como ignorado. Gate: test con repo git temporal + etapa 1 del piloto en vivo.
  Ejecutado por: gpt-6-luna (rol `mecanico`).
  Hecho: `dropIgnoredOutputs` en `project.ts`, aplicado al final del cálculo de `output` del borrador; test con
  repo git temporal y sin repo. En vivo: el mismo pedido de la etapa 1 (que menciona `data/inventario.sqlite`) creó
  la tarea `chat-3a77cb33…` con 2 salidas y terminó `done` en 45 s. Límite: el orquestador también dijo en su
  respuesta que excluía el `.sqlite`, así que la corrida en vivo no distingue si lo quitó el filtro o el modelo; el
  filtro lo prueba el test.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.4.2-live.json` — `auto-flow` 31/31 (crea
  tareas desde el chat con el borrador ya filtrado); registro del piloto en `docs/done/evidence/ERP.4/`.

<a id="bloque-erp-erp-4-4"></a>
- [x] **ERP.4.4 — 🔍 La corrección guardada del proyecto llega al prompt de la tarea.** (abierto 2026-10-12, hallazgo 10
  del piloto) Corrección registrada en Settings → Instincts (manual, verified, 100 %, proyecto `erp-piloto`); la
  tarea siguiente (etapa 3) no la aplicó y la UI dice "Injected into 0 agent prompts". Causa: `instinct-apply.ts:17`
  busca el proyecto por `ctx.effectiveRoot`, que con sandbox es la ruta del worktree (`harness.ts:231,239`) → sin
  proyecto → sin instincts. Gate: test del middleware con worktree + etapa 4 del piloto en vivo.
  Ejecutado por: sonnet (rol `criterio`).
  Hecho: `instinct-apply.ts` resuelve el proyecto por `ctx.opts.projectRoot`. Test nuevo
  `src/__tests__/instinct-apply-worktree.test.ts` (falla con el código viejo, según la contraprueba del ejecutor);
  `test:coverage` 1684/0, `tsc` y lint limpios. Sin hermanos del mismo patrón en `src/run/`.
  Gate en vivo: navegador real (Playwright), registro en `docs/done/evidence/ERP.4/piloto-2026-10-12.md` — la etapa 4
  del piloto aplicó la corrección registrada por la UI (`InventarioError` con `codigo` en mayúsculas en
  `erp-piloto/src/inventario/stock.ts`), que la etapa 3 había ignorado.
  Anotado sin corregir: `external.ts:514,589` leen `orchestos.config.yaml` desde el worktree como fallback.

<a id="bloque-erp-erp-4-5"></a>
- [x] **ERP.4.5 — 🔍 Una skill que es gate de revisión no se asigna ni se inyecta al ejecutor.** (abierto 2026-10-13,
  hallazgo 14 del piloto) Etapa 5: run `ac5c6ee6` falló en 19 s con "missing declared output(s)" de los 6 archivos.
  La sesión de Codex muestra que el ejecutor recibió "SKILL GUIDELINES: Structured QA Review" y respondió con un
  veredicto JSON sin escribir nada. Causa: `pickAutoSkill` (`chat.ts:784`) elige la primera skill `mode: automatic`,
  y las dos que hay (`qa-structured`, `security-review`) son gates de fase `review`. 4 de las 5 tareas del piloto
  llevan `skill: qa-structured`; las anteriores salieron bien por suerte. Spec: `docs/specs/ERP.4.5.md`.
  Gate: tests de `pickAutoSkill`, `buildPrompt` y `skillRoute` + reintento de la etapa 5 en vivo.
  Ejecutado por: gpt-6-luna (rol `mecanico`), 3 rondas.
  Hecho: `isReviewOnlyGate` en `src/skills/catalog.ts`; `pickAutoSkill` filtra esos gates antes del desempate;
  `skill-route.ts` y `prompt.ts` no los inyectan aunque la tarea ya guardada los lleve. Ronda 2: la ronda 1 llamaba
  `next()` dentro del `try` de `skillRoute` (un fallo posterior se tragaba y la cadena corría dos veces). Ronda 3: dos
  tests de O.2 (`planner-skill-catalog.test.ts:84-95`) afirmaban que el gate ganaba como skill principal; se
  invierten. **Esto revierte esa parte de O.2 (2026-08-03)**: un gate de review ya no es skill del ejecutor.
  Gates propios: `typecheck` limpio; `test:coverage` 1693/0, funciones 76.62 %, líneas 63.49 %; contraprueba con el
  código viejo: 3 fallos en los tests nuevos. Gate en vivo (navegador real, 2026-10-13 06:03-06:05): la misma tarea
  `chat-528621f9`, con `skill: qa-structured` aún guardado, relanzada desde la tarjeta del hilo → `done`, QA pass
  (gpt-6.1-sol), 6 archivos, 102 s; el rollout del ejecutor ya no contiene "SKILL GUIDELINES: Structured QA".
  Registro: `docs/done/evidence/ERP.4/piloto-2026-10-12.md` § Reanudación.
  Anotado sin corregir: el run sigue guardando `skill_id: qa-structured` (etiqueta de la tarea, no lo inyectado).

<a id="bloque-erp-erp-4-6"></a>
- [x] **ERP.4.6 — 🔍 El check por defecto de `tsc` solo se añade si el proyecto tiene `tsconfig.json`.** (abierto
  2026-10-13, hallazgo 20 del piloto) Etapa 6: run de `chat-f59db027` falló con "check failed: bunx tsc --noEmit
  exit 1". `erp-piloto` no tiene `tsconfig.json`; desde que la etapa 5 trajo `node_modules`, `defaultChecksFor`
  (`src/run/checks.ts:77`) añade `tsc`, que sin config imprime la ayuda y sale con 1: el check no puede pasar.
  Spec: `docs/specs/ERP.4.6.md`. Gate: tests de `defaultChecksFor` + etapa 6 del piloto en vivo.
  Ejecutado por: gpt-6-luna (rol `mecanico`).
  Hecho: `defaultChecksFor` exige `tsconfig.json` para el check de `tsc`; `bun test <archivo>` sigue dependiendo solo
  de `node_modules`. Fixtures de `checks.test.ts` y `sandbox-node-modules.test.ts` con `tsconfig.json`; test nuevo.
  Gates propios: `typecheck` y `lint` limpios; `test:coverage` 1694/0, funciones 76.62 %, líneas 63.49 %;
  contraprueba con el código viejo: falla el test nuevo. Gate en vivo (navegador real, 2026-10-13 06:21-06:22): etapa
  6 pedida por chat → `chat-e11d25a6` `done`, QA pass (gpt-6.1-sol), 39 s; `erp-piloto` 25 tests verdes.
  Registro: `docs/done/evidence/ERP.4/piloto-2026-10-12.md` § Etapa 6.

<a id="bloque-erp-erp-4-7"></a>
- [x] **ERP.4.7 — 🔍 Cada tarea `pending` o `failed` se puede lanzar desde su tarjeta en Settings → Tasks.** (abierto
  2026-10-13, GO de Carlos; hallazgos 18 y 19 del piloto) Settings → Tasks solo ofrece "Run Next Task", que toma la
  primera `pending` (en el piloto, un residuo de la primera corrida) y nunca una `failed`; relanzar la tarea que falló
  exigió repetir el pedido por chat. El endpoint por id ya existe (`POST /api/tasks/:id/run`,
  `handlers/tasks.ts:399`); falta el botón. Spec: `docs/specs/ERP.4.7.md`.
  Gate: test de `isTaskRunnable` + flujo `tasks` del ui-gate con una tarea `failed` relanzada desde su tarjeta.
  Ejecutado por: gpt-6-luna (rol `mecanico`), 2 rondas · Spec: docs/specs/ERP.4.7.md
  Hecho: `isTaskRunnable` (`app/src/api/tasks.ts`: `pending` o `failed` con dependencias `done`); botón `Run` por
  tarjeta en Settings → Tasks con el `className` del "Run Next Task", deshabilitado mientras corre otra tarea; un
  solo `handleRunTask` en `App.tsx` (ronda 2: el `onRunTask` inline que ya usaba la pestaña Plan duplicaba el
  handler nuevo, y la tarea de fixture del gate había salido sin `engine`/`executor_model`).
  Corrección del hallazgo 19: Settings → Plan ya tenía `Run` por tarea (`PlanBoardView.tsx:397,514`, toda tarea no
  `done`); lo que faltaba era en la pestaña Tasks, donde se lee el motivo del fallo. El de Plan no se probó en vivo.
  Gates propios: `typecheck`, `lint`, `build:app` y `ui:fidelity:jsx` limpios; `test:coverage` 1696/0, funciones
  76.66 %, líneas 63.50 %.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.4.7-live.json` — `tasks` 19/19 con
  `gate:evidence --label ERP.4.7-tasks-live` (2 runs exportados): `gate-failed-task` (`failed`, codex gpt-6-luna)
  lanzada desde su tarjeta → run `bc082a12` → `done`; `gate-dependent-task` sigue `pending` sin run y no ofrece `Run`.
  Límite: una tarea `failed_permanent` no ofrece `Run` (no se comprobó si el harness la admite tras 3 intentos).
  Entorno: `~/Library/Caches/ms-playwright` no existía al correr el gate (causa sin identificar); reinstalado con
  `bunx playwright install chromium`.
  **Fuera de scope declarado:** `PLAN.md` y `docs/done/evidence/**` (cierre y evidencia del propio ítem; el scope
  lo declaró el ejecutor solo para el código).

<a id="bloque-erp-erp-4-8"></a>
- [x] **ERP.4.8 — 🔍 El run fallido guarda y muestra lo que respondió el ejecutor.** (abierto 2026-10-13, GO de
  Carlos; hallazgo 15) `runs.result` solo trae el motivo del contrato y `ExecutorOutcome`
  (`src/run/executors/types.ts:18`) no lleva el texto final del CLI; además `runs.result` no sale por la API ni se ve
  en Runs (`handlers/runs.ts:80`). El diagnóstico de ERP.4.5 salió del rollout de Codex, no de OrchestOS.
  Gate: tests del ejecutor externo y del harness + run fallido visto en el dashboard real con la respuesta del ejecutor.
  Ejecutado por: sonnet (rol `criterio`), 2 rondas · Spec: docs/specs/ERP.4.8.md
  Hecho: `ExecutorOutcome.finalText` (Codex: último `agent_message` en `parseCodexStream`; Claude: `result` del
  evento final); columna `runs.executor_reply` (migración numerada 24, redactada con el mismo `scrub` que `result`,
  recortada a 4 000 caracteres), guardada solo en los 4 `insertRun` de fallo o bloqueo con outcome
  (`harness.ts`: contrato, salidas faltantes, check, QA); la API de runs expone `result` y `executorReply`; la
  pestaña Contract del run muestra el motivo y "Executor reply" cuando el run no terminó bien.
  Ronda 2: con `safeAddColumn` la columna se perdía en una base nueva — la migración 10 reconstruye `runs` con lista
  fija de columnas (`migrate.ts:390`) — y `test:coverage` dio 18 fallos ("no column named executor_reply"); pasó a
  migración numerada. Sin identificar: un `duplicate column name` que salió una vez en esa corrida.
  Gates propios: `typecheck`, `lint`, `build:app`, `ui:fidelity:jsx` limpios; `test:coverage` 1709/0, funciones
  76.79 %, líneas 63.62 %.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.4.8-live.json` — `qa-negative` 25/25 con
  `gate:evidence --label ERP.4.8-qa-negative-live` (3 runs exportados): el run rechazado por QA de `gate-qa-bad`
  (codex gpt-6-luna) trae `executorReply` de 185 caracteres ("Created [nota.txt](…") por `GET /api/runs/:id` y
  la pestaña Contract lo muestra bajo "Executor reply".
  Límites: los runs `done` y los engines `single-shot`/`agentic` no guardan respuesta; el bloque nuevo de Contract
  se comprobó por texto visible, no mirando una captura; la rama de Claude se probó con test, no en vivo.
  **Fuera de scope declarado:** `LEDGER.md` (entrada exigida por tocar `harness.ts`), `src/dashboard/types.ts` (tipo
  `RunRow` que consume `runRecordToRow`) y `src/dashboard/handlers/runs.test.ts` (su test).

<a id="bloque-erp-erp-4-9"></a>
- [x] **ERP.4.9 — 🔍 El hilo abierto muestra el fin de un reintento sin recargar.** (abierto 2026-10-13, GO de
  Carlos; hallazgo 17) Dos causas leídas en el código: `runProjectTask` espera 60 s como máximo
  (`app/src/api/chat.ts:464`) y, si el run tarda más, su error salta la recarga del hilo
  (`App.tsx:934-971`); y el polling del hilo solo espera tareas con exactamente un mensaje (`App.tsx:308`), así que
  tras un intento fallido (2 mensajes) ya no vuelve a mirar esa tarea. En el piloto el reintento tardó 102 s.
  Gate: test de la decisión de polling + ui-gate con una tarea que falla, se relanza desde el hilo y termina.
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, rondas 2-5) · Spec: docs/specs/ERP.4.9.md
  Hecho: el polling del hilo espera el reporte de cada intento (clave `hilo:tarea:nº de mensajes`; decisión en
  las funciones puras `decideTaskPollAction` y `resolveTaskReportPoll`, `app/src/api/tasks.ts`); `runProjectTask`
  espera 10 min; `handleApproveHeldTask` recarga el hilo en el `finally` y, al aprobar, reabre la espera de esa tarea.
  Rondas: 2 = quitar ruido de formato (el ejecutor corrió `prettier` por error); 3-4 = flujo nuevo
  `scripts/ui-gate/flows/chat-retry-report.mjs` (el spec pedía fallar por `tsc` con una tarea sobre `README.md`; ese
  check solo se añade con salida `.ts`, `checks.ts:79`); 5 = **el arreglo de la ronda 1 no bastaba**: al recargar, el
  polling daba por resuelta la tarea (2 mensajes, sin correr) antes del "Approve & Run". Defecto del diseño del spec,
  visto solo por el gate en vivo.
  Gates propios: `typecheck`, `lint`, `build:app`, `ui:fidelity:jsx` limpios; `test:coverage` 1701/0, funciones
  76.68 %, líneas 63.52 %; 5 tests nuevos (el del segundo intento falla con la lógica vieja, según el ejecutor).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.4.9-live.json` — `chat-retry-report` 12/12 con
  `gate:evidence --label ERP.4.9-chat-retry-live`: tarea retenida → intento 1 falla ("check failed: bunx tsc
  --noEmit exit 2") y su reporte aparece sin recargar → recarga → "Approve & Run" → `done` → "✓ Task … done" aparece
  en el hilo abierto (mensajes de la tarea 2 → 3). Contraprueba: la misma corrida con solo la ronda 1 falló en ese
  último paso (`docs/done/evidence/ERP.4.9-contraprueba.json`).
  Límites: `chat-retry-report` no está en la lista del pre-push (1 turno de chat + 2 runs reales); se corre a mano
  con `bun run ui:gate chat-retry-report`. El caso de un run de más de 60 s no se reprodujo en vivo (los runs del
  gate duran ~20-40 s); lo cubre el plazo de 10 min. Una tarea relanzada desde Settings no reabre la espera del hilo.
  **Fuera de scope declarado:** `PLAN.md`, `docs/done/evidence/**` y `scripts/ui-gate/flows/chat-retry-report.mjs`
  (cierre, evidencia y gate del propio ítem).

<a id="bloque-erp-erp-4-10"></a>
- [x] **ERP.4.10 — 🔍 El borrador de tarea lee el hilo y declara la clase de la tarea.** (cerrado 2026-10-13; abierto 2026-10-13, GO de
  Carlos; hallazgos 2 y 16) `buildNaturalDraft(message, root)` solo recibe el mensaje actual (`handlers/chat.ts:1128`,
  `handlers/project.ts:206`): un seguimiento ("crea la tarea tal como la describiste") no nombra archivos y no crea
  tarea. Y `runs.task_class` sale de palabras sueltas de la descripción (`router/classify.ts:15-31`,
  `run/harness.ts:242`): pedidos "Crear …" quedaron como `review` y `fix`. Spec: `docs/specs/ERP.4.10.md`.
  Gate: tests del borrador + ui-gate con un pedido en dos mensajes que crea y corre la tarea.
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, ronda 2) · Spec: docs/specs/ERP.4.10.md
  Hecho (2026-10-13): el borrador recibe los últimos 6 turnos del hilo (4 000 caracteres por turno) y la respuesta
  del orquestador de este turno; el respaldo de rutas mira el mensaje, esa respuesta y los turnos previos, y ya quita
  backticks y negritas de Markdown. El borrador declara `task_class` por la intención del pedido; se valida en el
  esquema de `tasks.yaml` y el harness la prefiere a `classifyTask(description)`, que queda como respaldo de tareas
  sin clase. Sin tocar: `classifyTask` de `evals/runner.ts:251` y `cli.ts:664` (texto libre, no tareas).
  Evidencia: `test:coverage` 1720/0 (funciones 76.86 %, líneas 63.69 %) · typecheck y lint exit 0 ·
  `docs/done/evidence/ERP.4.10-live.json` — `chat-followup-task` 8/8 en navegador real: el mensaje 1 no crea tarea,
  "Crea la tarea tal como la describiste." la crea con `output: [notas/seguimiento.md]` y `task_class: implement`,
  termina `done` y el archivo existe · `auto-flow` 31/31 como regresión.
  Límites: sin contraprueba en vivo contra HEAD (el fallo original está registrado en el piloto, hallazgo 2); en el
  gate la respuesta del orquestador al mensaje 2 repite la ruta, así que no prueba el caso en que solo la nombran
  turnos anteriores (lo cubren los tests de `fallbackDraftOutput` y `buildDraftMessages`). `chat-followup-task` no
  está en el pre-push. `POST /api/tasks` acepta ahora `task_class` (no pedido, inocuo: se valida igual).
  **Fuera de scope declarado:** `PLAN.md`, `LEDGER.md`, `NEXT.md` y `docs/done/evidence/**` (cierre y evidencia).

<a id="bloque-erp-erp-4-11"></a>
- [x] **ERP.4.11 — 🔍 La tarea muestra el ejecutor del rol Executor, no un proveedor elegido por el LLM.** (cerrado 2026-10-13; abierto
  2026-10-13, GO de Carlos; hallazgo 6) El prompt del borrador hace elegir entre `openrouter|anthropic|openai`
  (`handlers/project.ts:226,265`) y `createTaskRecord` cae a `openrouter` (`handlers/tasks.ts:239,275`); el run usa el
  rol Executor aparte (`router/auto-route.ts`). En el piloto: `executor: anthropic` con runs de `codex/gpt-6-luna`.
  Spec: `docs/specs/ERP.4.11.md`. Gate: tests + Settings → Tasks en vivo muestra el agente/modelo del rol.
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, rondas 2 y 3) · Spec: docs/specs/ERP.4.11.md
  Hecho (2026-10-13): `describeTaskExecutor` (`router/auto-route.ts`) resuelve agente y modelo con el mismo
  `autoRoute` que usa el run; la fila de `/api/tasks` trae `assignedAgent`/`assignedModel` en vez de `executor`, y
  `pendingRouting[].executor` y el CLI (`tasks`, `task show`) muestran el agente resuelto o `unassigned`. El prompt
  del borrador ya no pide proveedor (`buildDraftSystemPrompt`, función pura con test) y `createTaskRecord` no
  escribe `executor: openrouter` de respaldo. La tarjeta de Settings → Tasks muestra `unassigned` en vez de `claude`
  cuando no hay ruta.
  Evidencia: `test:coverage` 1730/0 (funciones 76.89 %, líneas 63.73 %) · typecheck y lint exit 0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.4.11-live.json` — `tasks` 21/21: una tarea
  creada sin modelo muestra `codex · gpt-6-luna` (rol Executor del fixture) y su entrada en `tasks.yaml` no lleva
  proveedor.
  Límites: sin contraprueba contra HEAD; el caso del piloto (YAML `executor: anthropic` + rol `codex/gpt-6-luna`)
  solo se prueba en `tasks-api-engine.test.ts`, no en vivo. El gate `tasks` se corrió antes de la ronda 3, que solo
  tocó `src/dashboard/app/src/api/tasks.test.ts` (fixtures con la fila vieja: 1 fallo de `test:coverage`). Las
  tareas ya guardadas conservan su `executor` en el YAML; se ignora al mostrar.
  **Fuera de scope declarado:** `PLAN.md`, `NEXT.md` y `docs/done/evidence/**` (cierre y evidencia).

<a id="bloque-erp-erp-4-12"></a>
- [x] **ERP.4.12 — 🔍 El estado que el run deja en `tasks.yaml` queda commiteado.** (cerrado 2026-10-13; abierto 2026-10-13, GO de
  Carlos; hallazgo 5) `updateTaskStatus` escribe `status`/`retry_count`/`qa_verdict` sin commit (`cli.ts:1281-1439`);
  solo se commitea al crear y al lanzar (`handlers/tasks.ts:287-347`). El proyecto queda con el árbol sucio tras cada run.
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, ronda 2) · Spec: docs/specs/ERP.4.12.md
  Hecho (2026-10-13): helper único `commitTasksYaml` (`src/run/commit-tasks-yaml.ts`) que commitea solo esa ruta
  (`git commit -- tasks.yaml`), bajo `withGitLock`, silencioso si no es repo, no hay cambios o el archivo está
  ignorado; lo usan los 4 commits del dashboard y el del grafo (antes hacían `git commit` sin ruta y se llevaban el
  índice del usuario). `commitFinalTaskState` commitea `chore(tasks): <id> <estado>` al salir de `executeTask`
  (`try/finally`, después del merge del worktree), de `task:clarify` y de `--expand` con plan ya aprobado; `running`
  nunca se commitea.
  Evidencia: `test:coverage` 1737/0 (funciones 76.95 %, líneas 63.71 %) · typecheck y lint exit 0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.4.12-live.json` — `tasks` 23/23: tras la
  primera tarea y tras la relanzada, `git status --porcelain` no lista `tasks.yaml` y el último commit es
  `chore(tasks): gate-first-task done` / `chore(tasks): gate-failed-task done`.
  Límites: en el gate las dos tareas terminan `done`; el commit de un estado `failed`/`pending` sale por el mismo
  `finally` pero no se observó en vivo. `executeTask` no tiene costura de test: lo cubren el helper (7 tests con
  repo git real) y el gate. El camino `--expand` no se ejerció en vivo. El commit usa la identidad y los hooks del
  repo del usuario: si su pre-commit falla, `tasks.yaml` queda sin commitear, en silencio. Sin contraprueba contra HEAD.
  **Fuera de scope declarado:** `PLAN.md`, `NEXT.md` y `docs/done/evidence/**` (cierre y evidencia).

<a id="bloque-erp-erp-4-13"></a>
- [x] **ERP.4.13 — 🔍 Árbol sucio: la tarea queda `pending` y el hilo ofrece "Commit & Run" y reintento.** (cerrado 2026-10-13; abierto
  2026-10-13; hallazgo 18 y decisión 4 de Carlos) El chequeo de árbol limpio solo exceptúa `runs-summary.json`
  (`run/sandbox-policy.ts:32-70`), el CLI marca `failed` (`cli.ts:1281-1296`) y el mensaje manda a la terminal. El
  hilo no ofrece relanzar una tarea fallida (`App.tsx:209-225`); `POST /api/tasks/:id/run` ya sirve.
  Decisión de Carlos 2026-10-13: se sigue bloqueando (el ejecutor trabaja sobre el último commit); la tarea queda
  `pending` y el hilo lista los archivos con un botón "Commit & Run" que los commitea y relanza.
  Ejecutado por: sonnet (rol `criterio`, ronda 1) y gpt-6-luna (rol `mecanico`, rondas 2 y 3) · Spec: docs/specs/ERP.4.13.md
  Hecho (2026-10-13): `resolveSandboxMode` lanza `DirtyTreeError` con la lista completa (`listDirtyFiles`,
  `git status --porcelain -z`); el CLI deja la tarea `pending` con `retry_reason: uncommitted changes: <archivos>`
  sin gastar reintento. Todo reporte de fin de tarea lleva datos (`chat_messages.task_report`, migración 25:
  `outcome` y, con árbol sucio, `dirtyFiles` leídos en vivo). `POST /api/tasks/:id/commit-run` commitea solo los
  archivos pedidos que sigan sucios (400 si no; 409 con el stderr si git rechaza) y relanza. En el hilo, el último
  reporte de una tarea muestra la tarjeta `Uncommitted changes` con `Commit & Run`, o `Retry` si quedó
  `pending`/`failed`; la tarjeta "Task ready to run" ya no reaparece al recargar una tarea ya lanzada (antes era la
  única forma de reintentar). Sin CSS ni UI de Settings nuevos.
  Evidencia: `test:coverage` 1746/0 (funciones 77.09 %, líneas 63.81 %) · typecheck y lint exit 0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.4.13-live.json` — `chat-retry-report` 21/21:
  `Retry` relanza sin recargar y desaparece del reporte anterior; con `sucio.txt` sin commitear la tarea queda
  `pending`, el hilo lista el archivo, `Commit & Run` crea `chore: commit pending changes before <id> (dashboard)` y
  la tarea termina `done`. Captura de la tarjeta revisada a ojo. Contraprueba: la ronda 1 falló ese mismo gate en
  `thread lists the uncommitted file without reload` (la recarga del hilo llegaba antes que el reporte y restauraba
  la tarjeta retenida).
  Límites: el 409 por commit rechazado y un `Retry` que vuelve a fallar no se ejercieron en vivo (el estado de la
  acción va por mensaje para que el error no se repita bajo el reporte nuevo: solo leído en el código). La
  restauración de tarjetas de `App.tsx` no tiene test unitario. `Commit & Run` commitea todo lo listado, incluido
  un archivo sensible no ignorado: el usuario ve la lista antes de pulsar. `chat-retry-report` no está en el
  pre-push. `test:coverage` dio una vez 1 fallo por timeout de 5 s en `CC.2 — chat sessions backend` dentro de la
  suite (pasa solo y en la corrida siguiente): ver CI.12.
  Ronda 3: el primer push se abortó en el pre-push (entorno sin identidad git, como CI): el fixture del test de
  `commit-run` no daba identidad al repo temporal y el commit de producción devolvía 409. Corregido el fixture y
  añadido el test del 409 sin identidad (la tarea no se lanza).
  **Fuera de scope declarado:** `PLAN.md`, `NEXT.md` y `docs/done/evidence/**` (cierre y evidencia).

<a id="bloque-erp-erp-4-14"></a>
- [x] **ERP.4.14 — 🔍 El composer distingue "cargando" de "Orchestrator unassigned".** (abierto 2026-10-13; hallazgo 7)
  **Pasa a UI.24.6** (composer y adjuntos; `NEXT.md`): se ejecuta ahí, no por separado, y cierra con él.
  (cerrado 2026-10-15 en UI.24.6b) `orchestrator` nace `undefined` (cargando): sin aviso y Send deshabilitado hasta
  leer la config; el aviso solo con `null`. Prop `orchestratorLoading` en `AgentComposer`.
  Sin delegación: se ejecutó dentro de UI.24.6b (spec y evidencia ahí).
  `orchestrator` nace `null` y el aviso se pinta hasta que llega la config (`OrchestChatView.tsx:66-94,500-507`,
  `AgentComposer.tsx:625-638`).

<a id="bloque-erp-erp-4-15"></a>
- [x] **ERP.4.15 — 🔍 Ningún test deja instincts en la base real.** (cerrado 2026-10-15; abierto 2026-10-13; hallazgo 12) Fila
  `block-e-test-pattern` / "do X instead" en `~/.orchestos`; candidato `src/__tests__/dashboard-parity-block-e.test.ts:97-119`
  (importa la `db` real), causa sin demostrar. Borrar la fila y cerrar la fuga.
  Sin delegación: diagnóstico y una fila borrada, sin código.
  Causa demostrada: la fila (`instincts` id `9ae4479a`, `created_at` 2026-07-16) es anterior al aislamiento de la
  suite (`63caed35`, 2026-08-31: `bunfig.toml` precarga `scripts/test-preload.ts`, que define `ORCHESTOS_HOME`
  temporal); `scripts/db-isolation.test.ts` pone CI en rojo si el preload falta. La fuga ya estaba cerrada; quedaba el
  residuo. Fila borrada de `~/.orchestos/db.sqlite` (respaldo en `~/.orchestos/backups/db.sqlite.pre-ERP.4.15-20261015`);
  las otras 2 filas de `instincts` son reales (2026-10-12/13).
  Evidencia: `db-isolation.test.ts` 3/3; `dashboard-parity-block-e.test.ts` 7/7 y después 0 filas `block-e` en la base real.

<a id="bloque-erp-erp-4-16"></a>
- [x] **ERP.4.16 — 🔍 Cada tarea terminada deja una entrada mecánica en Memory.** (abierto 2026-10-13; hallazgo 11)
  `memory_entries` solo se escribe al cerrar una subtarea con `topic_key` (`run/scheduler.ts:207-212`). Decisión de
  Carlos 2026-10-13: entrada mecánica sin LLM (qué hizo, archivos, veredicto de QA). Sin UI nueva en Settings: Carlos
  revisará Settings pestaña por pestaña tras este lote ("Settings es confuso; no mostrar todo").
  Ejecutado por: gpt-6-luna (rol `mecanico`, 2 rondas; 2 arranques frenados por huecos del spec: candado y fila de
  run ausente) · Spec: docs/specs/ERP.4.16.md (borrado)
  (cerrado 2026-10-15) `src/db/task-memory.ts` `recordTaskMemory`: `upsertMemory(project, task/<id>, …, 'project')`
  con texto plano (resultado, primera línea de la descripción, archivos, QA y motivo, `provider/model` del último run
  o solo `Attempts n`); sin proyecto no escribe; un error no cambia el resultado de la tarea. Lo llama `cli.ts` en las
  ramas `done` y `failed_permanent`.
  Evidencia (cerebro): `tsc`, biome, `task-memory.test.ts` 5/5, `test:coverage` 1815/1 (el único fallo es el test
  del 409 de ERP.4.13, ya anotado en `NEXT.md`). Gate en vivo: navegador real (Playwright),
  `docs/done/evidence/ERP.4.16-live.json` — `tasks` 31/31, con 2 pasos nuevos: la API devuelve `task/gate-first-task`
  con "QA: pass" y la pestaña Memory de Settings la muestra.
  Límites: la contraprueba con `cli.ts` de HEAD no se corrió, porque el hook del cerebro bloquea escribir en `src/`.
  El problema estaba verificado antes: Memory vacía en `erp-piloto`. La rama `failed_permanent` solo tiene
  prueba unitaria.

<a id="bloque-erp-erp-4-17"></a>
- [x] **ERP.4.17 — 🔍 El test del 409 de ERP.4.13 no depende de la identidad git del host.** (abierto 2026-10-15)
  `src/dashboard/handlers/tasks.test.ts:153-155` quita la identidad local y pone `useConfigOnly`. En el Mac, git cae
  en la identidad global, el commit pasa y el test recibe 200 en vez de 409: `bun test` a secas y `test:coverage`
  fallan. En el pre-push y en CI pasa porque no hay identidad global. Verificado: una identidad local vacía
  (`user.name ""`) hace que git rechace el commit ("empty ident name") aunque exista la global.
  Ejecutado por: gpt-6-luna (rol `mecanico`) · Spec: docs/specs/ERP.4.17.md (borrado)
  (cerrado 2026-10-15) `user.name ""` y `user.email ""` locales en lugar de `--unset`.
  Evidencia (cerebro, en el Mac con identidad global): `tasks.test.ts` 7/7; `test:coverage` exit 0, 1816 pass / 0 fail
  (antes, 1 fallo en este test).

<a id="bloque-erp-erp-5"></a>
- [x] **ERP.5 — 🔍 Revisar sobrecarga: qué quitar manteniendo fiabilidad y control humano.** (cerrado 2026-10-19)
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
  Veredicto: el peso por turno ya está bien (ERP.6); lo que sobra es código sin uso y ceremonia de proceso. En 573 runs,
  adversarial/refutador, embeddings/grafo, flotas y constitution tienen 0 uso; el revisor LLM de QA dio 0 fallos en
  82 revisiones reales y los 19 fallos reales los hallaron checks mecánicos y salidas declaradas; 60 % de los commits
  desde 2026-09-19 son solo documentos de proceso. 3 decisiones pendientes de Carlos, sin adoptar nada.
  Informe: → [evidencia](docs/done/ERP.5.md)
  Sin delegación: medición del cerebro; mapa de código por `leer` (gpt-6-luna).
  Decisiones de Carlos 2026-10-19: (1) revisor LLM solo con criterios de aceptación; (2) limpieza sí, un ítem por
  pieza; (3) un commit por ítem y `NEXT.md` por lote (regla en `AGENTS.md` § Reglas generales).

<a id="bloque-erp-erp-5-1"></a>
- [x] **ERP.5.1 — 🧠 El revisor LLM de QA corre solo si la tarea trae criterios de aceptación o un gate de revisión.** (cerrado 2026-10-19) Sin criterios, QA = checks + salidas declaradas, 0 tokens de revisor, `qa_model` NULL y motivo "QA LLM omitido" en el run. `create_task` acepta `acceptance_criteria` opcional (hoy 0 de 101 tareas reales los traen). `qa-structured` no cuenta como gate de revisión (se aplica a toda tarea; hallado por el ejecutor en la ronda 1).
  Ejecutado por: criterio (Sonnet), 2 rondas · Spec: docs/specs/ERP.5.1.md (borrado al cerrar)
  Evidencia: tsc y lint sin errores; `test:coverage` 1943/0 (funciones 78,35 %, líneas 64,82 %). En vivo:
  `gate:evidence --label ERP.5.1-tasks -- ui:gate tasks` 31/31, el revisor corre con criterios (`qa_model` gpt-6-luna).
  La ruta sin criterios solo tiene tests unitarios (`harness-evidence.test.ts`): ningún flow crea una tarea sin criterios.

<a id="bloque-erp-erp-5-2"></a>
- [x] **ERP.5.2 — 🧠 Quitar revisión adversarial y refutador.** (cerrado 2026-10-19) 0 de 573 runs; apagados por defecto. −1120 líneas; un YAML viejo con `adversarialQA`/`refuterQA` carga y las ignora; columnas de `runs` quedan como historia.
  Ejecutado por: criterio (Sonnet) · Spec: docs/specs/ERP.5.2.md
  Evidencia: tsc y lint sin errores; `test:coverage` 1917/0 (funciones 78,24 %, líneas 64,63 %). En vivo:
  `gate:evidence --label ERP.5.2-live` → tasks 31/31, qa-negative 25/25, model-routing 18/18, orchestration 11/11.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.5.2-live.json` (4 flows en verde).
  Incidente: el ejecutor corrió `git stash` (prohibido en el spec), lo revirtió y lo reportó; árbol verificado intacto.

<a id="bloque-erp-erp-5-6"></a>
- [x] **ERP.5.6 — ⚡ El plan gate acepta un spec que nunca se commiteó.** (cerrado 2026-10-19) Con la decisión 3 (un commit por ítem) el spec no entra a git; `checkProvenance` (`scripts/plan-gate.ts:157`) exige borrar un spec commiteado y bloquea todo cierre delegado.
  Ahora acepta `Spec: docs/specs/<id>.md` si ese archivo no está en HEAD, ni en el índice, ni en disco.
  Ejecutado por: mecanico (gpt-6-luna) · Spec: docs/specs/ERP.5.6.md
  Evidencia: tsc y lint sin errores; `bun test scripts/plan-gate.test.ts` 15/0 (2 casos nuevos: nunca commiteado y
  ausente pasa; nunca commiteado y presente falla).

<a id="bloque-erp-erp-5-3"></a>
- [x] **ERP.5.3 — 🧠 Quitar embeddings y grafo de código del camino de la tarea.** (cerrado 2026-10-19) `context_chunks`, `code_edges`, `files` en 0 filas; el middleware corre en cada tarea. Fuera `src/graph/`, `memory-fetch`, `providers/embeddings.ts`, `context-suggest`, CLI `index` y `context suggest`, la pestaña Code Graph y su botón, "Hot files" de `context compress` y el ítem de setup que recomendaba `orchestos index`. `/api/project/graph` → `/api/project/git` (rama y árbol limpio, datos reales). Destapó un bug previo: `isCleanWorktree` nunca era `true` (`gitValue` colapsaba la salida vacía a `null`); corregido con test.
  Ejecutado por: criterio (Sonnet, 3 rondas; la 2.ª cortada por límite de sesión) + mecanico (gpt-6-luna, setup y `isCleanWorktree`) · Spec: docs/specs/ERP.5.3.md
  Evidencia: tsc y lint sin errores; `test:coverage` 1852/0 (funciones 78,34 %, líneas 64,47 %).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.5.3-live.json`: runs-graph 14/14 (captura: "Branch: main · Clean tree", sin pestaña Code Graph), project-tabs 39/39, smoke 6/6, tasks 31/31.

<a id="bloque-erp-erp-5-7"></a>
- [x] **ERP.5.7 — 🧠 `git stash` bloqueado a todo ejecutor y QA inmediato ante el intento.** (cerrado 2026-10-19) Pedido de Carlos 2026-10-19 ("bloquéalo, porque si falla dará problemas después; enseguida llamar a QA para que verifique qué está sucediendo"). 3 incidentes pese al spec (UI.26.2, UI.26.3, ERP.5.2), dos modelos distintos. Causas: hábito de diagnóstico ("¿el fallo era previo?") sin alternativa dada en el spec, árbol con cambios ajenos, dilución de prohibiciones, regla sin diente. Arreglo en `method/bin/delegate` (vault): `git` intermedio en el PATH del ejecutor que niega `stash` y registra el intento; al terminar, `delegate` lanza `qa` sobre el diff con el incidente. Umbral (Carlos 2026-10-19): QA tras **3 intentos bloqueados** en la corrida; si `git stash list` cambió (bloqueo saltado), QA enseguida.
  Ejecutado por: criterio (Sonnet, rondas 1-3) + mecanico (rondas 4-6) · revisión qa (2 rondas) · Spec: docs/specs/ERP.5.7.md
  Evidencia: commit del vault `f72e9df` (main; antes `556de3a` en una rama de contenido) (`method/bin/guard/git`, `delegate`, `delegate.test.sh`). `delegate.test.sh` 33/33,
  también con el guard en el PATH. En vivo: `codex exec` (con `allow_login_shell=false`) y `claude -p` resuelven git al
  guard y bloquean `git -c alias.s='stash list' s`. QA halló y se corrigió: alias a stash, PATH reordenado por el shell de
  login, alias homónimo de comando nativo; el cerebro halló `<<<` que rompía todo git en el sandbox de claude y el
  respaldo de `delegate` pasando por el guard.

<a id="bloque-erp-erp-5-4"></a>
- [x] **ERP.5.4 — 🧠 Quitar la orquestación de flotas sin uso.** (cerrado 2026-10-19) `orchestration_runs` y `orchestration_leases` en 0 filas: el auto-split y `--expand` nunca corrieron. Es una feature entera (interruptor en Settings, CLI, presupuesto). GO de Carlos 2026-10-19: quitar.
  Ejecutado por: criterio (Sonnet, rondas 1-3) + mecanico (ronda 4) · revisión qa · Spec: docs/specs/ERP.5.4.md
  Alcance real (ampliado por el cerebro al ver las dependencias): todo el camino de sub-tareas — split, `--expand`,
  presupuesto, `scheduler.ts`, `agents/{planner,executor,sub-agent,context-isolation,sub-task-schema}.ts`,
  `approve-split`/`split-plan`/`hasSplitPlan`, interruptor de Settings, flow `orchestration`, shard de mutación. −4947 líneas.
  Se queda: rol Orquestador del routing; `blockSubagents` fijo en `true` (comportamiento previo); tablas en `migrate.ts`.
  Un YAML con `orchestration:` carga y se ignora (`config-legacy-orchestration.test.ts`).
  Evidencia: tsc OK, lint 0 errores, `test:coverage` 1784/0 (funciones 79,04 %, líneas 65,51 %), `build:app` OK. QA: solo
  README con `--expand` (corregido).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.5.4-live.json` — tasks 31/31, model-routing 18/18,
  qa-negative 25/25, smoke 6/6, project-tabs 39/39.

<a id="bloque-erp-erp-5-5"></a>
- [x] **ERP.5.5 — 🧠 Quitar `constitution_rules`.** (cerrado 2026-10-19) Corrección al informe: sí carga (10 reglas en este repo), pero ningún proyecto real de Carlos tiene `CONSTITUTION.md` (erp-piloto no) y los CLI ya leen `AGENTS.md`/`CLAUDE.md`. Tiene API, vista en Settings/Context y flow `project-tabs`. GO de Carlos 2026-10-19: quitar.
  Ejecutado por: criterio (Sonnet, ronda 1) + mecanico (ronda 2) · revisión qa · Spec: docs/specs/ERP.5.5.md
  Quitado: `CONSTITUTION.md`, `src/spec/constitution.ts`, carga/bloque en harness, middleware, prompt y 4 ejecutores,
  `orchestos constitution init/show`, API `/api/project/constitution`, pestaña de Context (queda `CONTEXT.md` como
  etiqueta fija), inyección en el borrador de spec. Se queda la columna `constitution_rules` (historia).
  Evidencia: tsc OK, lint 0 errores, `test:coverage` 1774/0 (funciones 79,02 %, líneas 65,53 %). QA: la cabecera de
  Context se había ido con el selector (`project-tabs` 38/39 en vivo); restaurada.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.5.5-live.json` — project-tabs 39/39, tasks 31/31,
  smoke 6/6; `runs-graph` 14/14 tras quitar su clic en el botón `CONTEXT.md` (lo tumbó el pre-push).

<a id="bloque-erp-erp-6"></a>
- [x] **ERP.6 — 🔍 Demostrar que OrchestOS no se siente más pesado que el CLI directo.** (abierto 2026-10-17, cerrado 2026-10-18; pedido de
  Carlos: "tenemos que demostrar que usar OrchestOS no se siente más pesado para el modelo, tiene reglas claras y no es
  costoso en tokens o uso") Mismo pedido directo al CLI y por OrchestOS (chat y tarea): tokens de contexto inyectado,
  tokens totales, cuota, latencia y calidad de respuesta, medidos y publicados; cada diferencia se explica o se corta.
  Va después de AT.19.1, AT.20, AT.21 y CX.6 (miden lo que se inyecta) y alimenta ERP.5.
  Veredicto: no pesa más. Chat: contexto inicial Claude 10,7 k contra 42,5 k directo, Codex 23,9 k contra 28,9 k;
  con herramientas, entrada total Claude 34 k contra 158 k, Codex 76 k contra 91 k (tras ERP.6.1). Tarea: el ejecutor
  usa 91 k contra 158 k directo; el sobrecosto es el turno del Orquestador (27,6 k, $0,117) y ~5,5 s de worktree y QA.
  Informe y método: → [evidencia](docs/done/ERP.6.md)
  Sin delegación: medición del cerebro (arnés `docs/done/evidence/ERP.6-bench.ts`).

<a id="bloque-erp-erp-6-2"></a>
- [x] **ERP.6.2 — 🔍 El desglose de costo de una tarea muestra al revisor.** (abierto 2026-10-18, hallado en ERP.6)
  `cost_breakdown_json` se arma antes de QA (`src/run/harness.ts:643`): solo trae la fila del ejecutor, aunque los
  totales del run sí suman al revisor (`harness.ts:1021-1027`). La caché del revisor no entra en `cache_read_tokens`.
  (cerrado 2026-10-20) Tras QA, el desglose agrega la fila `reviewer` al final (`breakdown[0]` sigue siendo el
  ejecutor) y suma igual a `usd_cost`, en éxito y en QA fail. El costo del revisor lo pone su adaptador:
  `ChatResponse.usd` (null = desconocido) pasa por `role-runner` y `runQA`; sin `usd`, `knownCost`. Antes el revisor
  Codex salía gratis (`gpt-6-luna` sin el prefijo `openai/` no tenía precio). Sin precio: `source: 'unknown'` y `—`.
  Back sin front: la pestaña Cost de Runs (`RunsEvidenceView.tsx`) no pintaba el desglose; ahora lista una fila por
  entrada. Caché del revisor fuera de alcance: `ChatResponse` no la trae. El resaltado de "Contract" en la primera
  captura era la transición de 150 ms (el gate ahora afirma la clase activa de Cost).
  Evidencia (cerebro): diffs leídos; tsc y lint verdes; `test:coverage` 1885/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.6.2-live.json` — `runs-graph` 15/15, tarea real
  Codex: ejecutor $0.0009 + revisor $0.0005, `costTabActive=true`.
  Ejecutado por: codex gpt-6-sol (criterio-alt) r1-r2, r4-r5; codex gpt-6-luna (mecanico) r3 · Spec: docs/specs/ERP.6.2.md

<a id="bloque-erp-erp-6-1"></a>
- [x] **ERP.6.1 — 🧠 Codex en el chat no gasta llamadas descubriendo y reintentando run_readonly.** (abierto y cerrado
  2026-10-18, hallado en ERP.6) Con herramientas, Codex por OrchestOS hacía 4,3 llamadas contra 2,7 directo (109 k
  contra 82 k de entrada): descubría la herramienta en `ALL_TOOLS`, probaba `sed` (no permitido) y pasaba `"-A 18"`
  como un solo argumento. El prompt ahora cita el nombre invocable (`mcp__orchestos__run_readonly`), la regla de argv
  y que el contenido de archivos se lee con la lectura propia del CLI. Lista permitida de AT.21 sin cambios.
  Ejecutado por: criterio (Sonnet) · Spec: docs/specs/ERP.6.1.md (borrado al cerrar)
  Evidencia: typecheck y lint (0 errores); `test:coverage` 1938/0. Medición repetida (3 rep., `gpt-6-luna` medium):
  Codex por OrchestOS con herramientas 2,7 llamadas, 75 820 de entrada, 6,7 s (antes 4,3 / 109 241 / 14,3 s; Codex
  directo 3 / 90 627 / 11,5 s). Crudo: `docs/done/evidence/ERP.6-chat-before.json`, `docs/done/evidence/ERP.6-chat-after.json`.

<a id="bloque-erp-erp-7"></a>
- [x] **ERP.7 — 🔍 Revisar T3 Code: dónde fallamos y cómo cubrir nuestras debilidades.** (abierto 2026-10-17, cerrado
  2026-10-19; pedido de Carlos tras leer buenas críticas y un tier list que lo pone arriba, con Orca en C) No es
  "adaptemos": comparar lado a lado (instalarlo y usarlo, no leerlo como texto) peso por turno, reglas, UX del chat y
  control humano, y abrir ítems por cada debilidad propia con evidencia. Después de ERP.6.
  Veredicto: en peso ganamos (T3 suma +1 055 tokens por llamada de Codex con sus herramientas MCP; OrchestOS resta
  5 001 contra el CLI directo). Perdemos en control por acción del chat (ERP.7.1) y en diff/deshacer por turno
  (ERP.7.2); proveedores por adaptador ya son AT.11 y H.7.2c. La tier list no apareció (sin URL no se da por real).
  Informe: → [evidencia](docs/done/ERP.7.md)
  Sin delegación: uso en vivo del cerebro (t3@0.1.0 en navegador real con Playwright); web por `investigar` (sonnet),
  código por `leer` (gpt-6-luna).

<a id="bloque-erp-erp-7-1"></a>
- [x] **ERP.7.1 — 🧠 El chat deja elegir el modo de permiso y aprobar o rechazar cada comando o edición del agente.**
  (abierto 2026-10-19, hallado en ERP.7) Hoy el composer solo muestra el modo y la aprobación inline es de tareas
  retenidas (`OrchestChatView.tsx:557`, `AgentComposer.tsx:684`). T3 trae 4 modos en el composer y Approve/Decline
  por acción, con aviso "Approval" en la barra lateral (`docs/done/evidence/ERP.7/permisos.png`). Lección en contra:
  Supervised pidió aprobación hasta para `cat` (6 aprobaciones en un arreglo de una línea); lo de solo lectura no se
  pregunta. Toca el chat central: plan corto y GO de Carlos antes de codear.
  **Plan con GO de Carlos (2026-10-20).** El chat ya es solo lectura en los 3 CLI; lo que edita y ejecuta son las
  **tareas**, que hoy corren sin preguntar (`codex exec --sandbox workspace-write`, `opencode run --auto`). ERP.7.1 =
  aprobar cada acción de una tarea mientras corre, desde su tarjeta en el hilo. Decisiones cerradas: **3 modos**, los
  niveles nativos de cada CLI con un nombre común — Supervisado (Claude `manual` / Codex `untrusted`), **Auto-edición
  por defecto** (`acceptEdits` / `workspace-write` + `on-request`: edita sin preguntar, pregunta los comandos que no son
  de lectura) y Total (`bypassPermissions` / `never`, lo de hoy). Lectura, búsqueda y listado no preguntan, según el tipo
  de acción que reporta el CLI. "Aprobar siempre en esta tarea" entra desde el primer corte. "Manual" (retener la tarea
  entera) queda aparte. Fuera: API/Ollama, recordar aprobaciones entre tareas, acceso remoto (IDEAS #73).
  **Cerrado 2026-10-20** con ERP.7.1a-d: aprobación por acción en tareas Codex, Claude y OpenCode, tarjeta con
  Approve/Reject/Always approve y aviso Approval, selector de modo en el composer (Auto-edit por defecto en tareas del chat).
  Sin delegación: ítem padre.

<a id="bloque-erp-erp-7-1a"></a>
- [x] **ERP.7.1a — 🧠 Capa común de aprobación por acción y adaptador Codex (app-server) para tareas.**
  El run emite `approval_requested {runId, id, tipo: comando|edición, detalle}` y espera `POST /api/runs/:id/approval`
  (`aprobar | rechazar | aprobar-siempre`); la tarea Codex corre por `codex app-server` con la política del modo. Gate en
  vivo: tarea real en Auto-edición que pide un comando no de lectura, se aprueba por la API y la tarea termina.
  **Cerrado 2026-10-20.** Codex 0.163 no tiene política nativa para Auto-edición (`on-request` corrió `mkdir` sin
  preguntar; `untrusted` pregunta también el patch): el modo vive en OrchestOS. La tarea Codex corre por app-server en
  `untrusted` y `decideApproval()` (`src/run/approvals.ts`) aprueba sola las ediciones dentro del proyecto y la lectura;
  lo demás emite `approval_requested` y espera `POST /api/runs/:id/approval`. `approve-always` = mismo comando completo
  exacto. Default sigue `full` hasta ERP.7.1c. Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.7.1a/round3-live-verified.log`:
  tarea real en `auto-edit`, el patch se aprobó solo, solo preguntó `mkdir`; `approve` lo ejecutó, `reject` lo impidió.
  QA adversarial halló un bloqueante (`approve-always` de `bun test` cubría `bun test; rm -rf x`), corregido con test.
  Cerebro: `tsc` verde, `test:coverage` 1824/0. Informe: `docs/done/ERP.7.1a.md`.
  Ejecutado por: criterio-alt (rondas 1-3) + mecanico (ronda 4) · revisión qa · Spec: docs/specs/ERP.7.1a.md

<a id="bloque-erp-erp-7-1b"></a>
- [x] **ERP.7.1b — ⚡ La tarjeta de tarea muestra la solicitud y la responde; aviso "Approval" en la barra lateral.**
  Comando o diff propuesto + Aprobar / Rechazar / Aprobar siempre; gate en vivo en el dashboard real (Playwright).
  **Cerrado 2026-10-20.** La lista de tareas trae `pendingApprovals` y `sessionId` (de `task_run_watch`,
  `handlers/tasks.ts:108`); el chat sondea cada 1 s las tareas del proyecto **del hilo** mientras alguna corre y pasa las
  solicitudes a `TaskCard` (comando + cwd o archivos + diff; `Approve` / `Reject` / `Always approve in this task`; una
  solicitud respondida queda deshabilitada hasta salir). `Approval` en la fila del hilo en Chat y en Dev (solo proyecto
  actual). QA adversarial (Sol) halló un bloqueante (chat de otro proyecto perdía reporte y aprobaciones) y dos menores
  (sin aviso en la lista de Chats, doble POST con error pegado), corregidos con test.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.7.1b-live.json`: Codex real en `auto-edit`, clic en cada botón; approve crea el
  directorio, reject lo impide, approve-always no vuelve a preguntar el mismo comando; capturas en
  `docs/done/evidence/ERP.7.1b/`. Cerebro: `tsc`, lint y `build:app` verdes, `test:coverage` 1838/0.
  Ejecutado por: criterio-alt (3 rondas; la 2.ª cortada por caída de DNS) · revisión qa · Spec: docs/specs/ERP.7.1b.md

<a id="bloque-erp-erp-7-1c"></a>
- [x] **ERP.7.1c — ⚡ Selector de modo en el composer (Supervisado / Auto-edición / Total), por defecto Auto-edición.**
  Reemplaza la etiqueta de `AgentComposer.tsx:684`; el valor viaja con la tarea creada desde el chat.
  **Cerrado 2026-10-20.** Selector `Supervised` / `Auto-edit` / `Full access` en la barra del composer (solo con
  proyecto; persiste en `localStorage`), default `Auto-edit`; el chat manda `approvalMode` y `create_task` lo guarda en la
  tarea (ausente → `auto-edit`; inválido → 400). La franja "Auto-run/Manual approval" se queda: es la retención de la tarea
  entera, otro concepto. Capacidad `supportsActionApproval` en `cli-registry.ts` (solo Codex): el harness corre `full` los
  motores sin ella y la tarjeta lo dice (`Full access: Claude Code can't ask per action yet`; motores API = `API`).
  Hallazgos: QA (Sol) vio el aviso ausente para motores API y que `startServer(0)` pasaba el puerto `0` al control de
  origen (todo POST daba 403; arreglado en `server.ts`, con test); el cerebro vio en la captura la ruta absoluta del
  worktree 3 veces y `+0 -0` en la solicitud de edición (rutas relativas, sin contador inventado).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.7.1c-live.json`: default `Auto-edit`, `Supervised`
  sobrevive a recargar, turno real de chat (Claude) crea la tarea con `approvalMode: supervised` en `tasks.yaml` y la
  tarea Codex pide aprobación de la edición en la tarjeta; 13/13. Cerebro: `tsc`, lint y `build:app` verdes,
  `test:coverage` 1851/0.
  Ejecutado por: criterio-alt (ronda 1) + mecanico (rondas 2-4) · revisión qa · Spec: docs/specs/ERP.7.1c.md

<a id="bloque-erp-erp-7-1d"></a>
- [x] **ERP.7.1d — 🧠 Adaptadores Claude (`--permission-prompt-tool`/`PreToolUse`) y OpenCode (`opencode serve` + API de permisos).**
  Uno por sub-ítem al abrirlo, con su gate en vivo; mismo contrato de ERP.7.1a, sin ramas por marca.
  **Cerrado 2026-10-20** con ERP.7.1d1 (Claude) y ERP.7.1d2 (OpenCode).
  Sin delegación: ítem padre.

<a id="bloque-erp-erp-7-1d1"></a>
- [x] **ERP.7.1d1 — 🧠 Adaptador de aprobación de Claude Code en tareas (`--permission-prompt-tool` vía el MCP de OrchestOS).**
  (abierto 2026-10-20) Hoy la tarea Claude corre con `--allowedTools` que preaprueba todo y sin MCP (`external.ts:185-203`).
  Con modo ≠ `full`: solo lectura preaprobada; el resto va a una herramienta MCP `approve_action` que crea la solicitud en
  SQLite (`approvals.ts`) y espera la decisión; `decideApproval()` aplica el modo igual que en Codex. Gate en vivo: tarea
  Claude real en `auto-edit`, la edición pasa sola, `mkdir` pide aprobación en la tarjeta; approve/reject.
  **Cerrado 2026-10-20.** Contrato verificado por el cerebro contra Claude Code 2.1.304: `--permission-prompt-tool
  mcp__orchestos__approve_action` recibe `{tool_name, input, tool_use_id}` y acepta `{"behavior":"allow","updatedInput"}` /
  `{"behavior":"deny","message"}`. Trampas halladas: `--restricted` quita Bash salvo que `--tools` lo nombre, y sin
  `--settings` propio + `--permission-mode manual` el `defaultMode: auto` del usuario aprueba `mkdir` sin preguntar. Con modo
  ≠ `full`: `--permission-mode manual --tools Bash,Read,Glob,Grep,Edit,Write,MultiEdit --allowedTools Read,Glob,Grep`, MCP
  propio con `--approval-run/--approval-mode` y `MCP_TOOL_TIMEOUT` 30 min; `full` = argumentos de antes. Capa común:
  `approvalAdapterFor(runId, mode)` reconecta el proceso MCP a la corrida del harness (`approvals.ts`); mapeo puro en
  `claude-approval.ts`. Claude `supportsActionApproval: true`. QA (Sol): el MCP del chat abría SQLite al arrancar (import
  diferido de `approvals.ts`, con test).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.7.1d1-live.json`: tarea Claude real (rol orchestrator,
  `claude-opus-5-5`) en `auto-edit`; la edición se aprobó sola y `mkdir -p command-marker` pidió aprobación en la tarjeta;
  approve lo creó, reject no. Cerebro: `tsc`, lint verdes, `test:coverage` 1861/0.
  Ejecutado por: criterio-alt (rondas 1-3) + mecanico (rondas 4-6) · revisión qa · Spec: docs/specs/ERP.7.1d1.md

<a id="bloque-erp-erp-7-1d2"></a>
- [x] **ERP.7.1d2 — 🧠 Adaptador de aprobación de OpenCode en tareas (`opencode serve` + API de permisos).**
  (abierto 2026-10-20) Hoy `opencode run … --auto` (`opencode.ts:82`). Mismo contrato y gate en vivo que ERP.7.1d1.
  **Cerrado 2026-10-20.** Contrato verificado por el cerebro contra OpenCode 1.19.0: `opencode run` sin `--auto` rechaza
  solo cada permiso (también con `--attach`), así que con modo ≠ `full` la tarea va por `opencode serve`
  (`opencode-server.ts`): sesión con `*`→`ask` y lectura→`allow`, `prompt_async`, sondeo de `GET /permission` y respuesta
  `POST /permission/{id}/reply`. El `always` de OpenCode es por patrón (`mkdir *`, `*` en edición): nunca se envía; el
  `approve-always` vive en OrchestOS y a OpenCode se le responde `once`. `full` = `run … --auto` de antes. OpenCode
  `supportsActionApproval: true`; solo los motores API quedan sin aprobación por acción. QA (Sol) halló dos bloqueantes:
  servidor sin contraseña (otro proceso local podía responder permisos; ahora contraseña aleatoria por servidor y Basic
  `opencode:<p>`, verificado: sin credenciales 401) y fin de turno con historial anterior (ahora se confirma `idle` antes de
  leer los mensajes); y un menor (pasos solo al final; ahora en vivo).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.7.1d2-live.json`: tarea OpenCode real
  (`deepseek-v4.1-flash-free`) en `auto-edit`; edición aprobada sola, `mkdir -p command-marker` preguntado en la tarjeta;
  approve lo creó, reject no; ningún `opencode serve` vivo al terminar. Cerebro: `tsc`, lint verdes, `test:coverage` 1877/0.
  Ejecutado por: criterio-alt (rondas 1-2) + mecanico (ronda 3) · revisión qa · Spec: docs/specs/ERP.7.1d2.md

<a id="bloque-erp-erp-7-2"></a>
- [x] **ERP.7.2 — 🧠 Cada turno del chat muestra su diff y se puede deshacer.** (abierto 2026-10-19, hallado en ERP.7)
  El chat no tiene diff por turno ni revert; el revert vive solo en el harness de tareas (`src/run/harness.ts:13`). T3
  cierra cada turno con "N changed files · Open diff" y guarda checkpoints en refs ocultas de git, sin ensuciar la
  rama (`docs/done/evidence/ERP.7/turno-con-diff.png`). Plan corto y GO de Carlos antes de codear.
  Reencuadre (2026-10-19): el chat no edita archivos por diseño (`chat.ts:117`); todo cambio es una tarea que entra
  como commit `orchestos(<id>): …` (`harness.ts:916`). "Por turno" = por tarea, en su tarjeta del hilo. GO de Carlos
  2026-10-19 al plan: ERP.7.2a (back) → ERP.7.2b (front + gate en vivo); confirmación de un clic en la tarjeta, sin
  modal. Fuera: modo `cwd`, deshacer en cadena, push automático, ERP.7.1.
  Cerrado 2026-10-19 con ERP.7.2a y ERP.7.2b.
  Sin delegación: padre; plan y verificación del cerebro, el código está en los sub-ítems.

<a id="bloque-erp-erp-7-2a"></a>
- [x] **ERP.7.2a — 🧠 Backend: SHA del commit de la tarea, `runId` en el reporte y `POST /api/runs/:id/revert`.**
  (abierto y cerrado 2026-10-19, parte de ERP.7.2) `runs.commit_sha/reverted_sha/reverted_at` en la migración 28
  (`safeAddColumn` no sirve: la 10 reconstruye `runs` y las descarta en BD nueva); `mergeWorktreeBack` devuelve el
  SHA tras ff/rebase; el revert es `git revert --no-commit` + `orchestos(<id>): deshacer` bajo `withGitLock`, con 409
  por árbol sucio, conflicto (abortado, sin `REVERT_HEAD`), ya deshecho o no ancestro.
  Ejecutado por: criterio (Sonnet), 1 ronda · Spec: docs/specs/ERP.7.2a.md
  Evidencia: tsc y lint sin errores; `run-revert.test.ts` 9 casos; `test:coverage` 1783/0 (funciones 79,03 %, líneas
  65,65 %). El `graph-runner` lento que vio el ejecutor pasa fuera de su sandbox (21/0).

<a id="bloque-erp-erp-7-2b"></a>
- [x] **ERP.7.2b — ⚡ La tarjeta de tarea muestra su diff y deshace con un clic, verificado en vivo.** (abierto y
  cerrado 2026-10-19, parte de ERP.7.2) La tarjeta `done` pide su run: `N file(s) +a −b · View diff` plegable (bloque
  copiado de `RunsEvidenceView`) y `Undo` → `Confirm undo`/`Cancel` → `Undone · <sha>`; 409 muestra el error y los
  archivos. Ronda 2 (hallada en la captura del gate): el server nunca mandaba `additions`/`deletions` (salía `+0 −0`;
  el mismo bug vivía en Dev › Runs) — `parseFileDiffs` los cuenta del unified diff. El ejecutor sumó
  `chat-task-undo` al pre-push sin pedirlo; revertido (flujo con modelo real, igual criterio que `chat-retry-report`).
  Ejecutado por: mecanico (gpt-6-luna), 2 rondas · Spec: docs/specs/ERP.7.2b.md
  Evidencia: tsc y lint sin errores; `test:coverage` 1785/0 (funciones 78,96 %, líneas 65,60 %).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ERP.7.2b-live.json` — `chat-task-undo` 16/16: tarea
  por chat con Codex, diff `+1 −0`, Undo, archivo borrado, commit `orchestos(<id>): deshacer`, sin `REVERT_HEAD`.
