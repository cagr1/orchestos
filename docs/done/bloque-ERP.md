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
