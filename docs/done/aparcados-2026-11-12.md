# Aparcados el 2026-11-12 — fuera del plan hasta que el uso real los pida

Carlos, 2026-11-12: *"comenzemos con los que realmente afectarían a OrchestOS su uso normal para comenzar a
probarlo yo mismo"*. Estos ítems salieron de `PLAN.md` sin hacerse: ninguno rompe el uso normal. Texto original
intacto abajo. Uno vuelve a `PLAN.md` con su mismo ID solo si un fallo visto usando OrchestOS lo señala, si deja el
CI rojo, o si Carlos lo pide; no se toman por orden de lista.

## Fiabilidad de los gates — esperaban su próximo fallo

- [ ] **CI.19 — El `git commit` del fixture falla a veces en el andamiaje de los ui-gates.** Visto 1 vez en
  `qa-negative` (2026-10-11, 1 de 9): `Command failed: git … commit -qm task fixture`, sin motivo porque el helper
  `run` usa `stdio: 'ignore'`. `qa-negative` ya reporta stdout/stderr y exit; los otros 20 flows con el mismo helper no.
  Al próximo fallo, leer el motivo en el `result.json` antes de arreglar; llevar el helper a `scripts/ui-gate/lib.mjs`.
  Fase 1 (2026-10-23): `run` vive en `scripts/ui-gate/lib.mjs` y los 27 flows lo importan; todo fallo dice
  `failed (exit N): <stdout+stderr>`. Gates (cerebro): `plan-doc` 16/16, `project-tabs` 39/39, `model-routing` 18/18;
  `test:coverage` 2012/0 (ejecutor). Sigue abierto hasta el próximo fallo: leer el motivo y escribir la fase 2.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.19-live.json`
  Ejecutado por: claude sonnet (criterio-alt; Sol sin cupo de 5 h)
  Bucle aislado 2026-11-03 (en serie, sin carga): `qa-negative` 3/3 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.

- [ ] **CI.76 — `notifications`: a veces el diálogo "Launch Agent" no lista Claude.** (abierto 2026-11-09) En la
  corrida de CI.75 el paso que abre un agente en Dev esperó 30 s `getByRole('dialog').getByRole('button', { name:
  /Claude/ })` (`notifications.mjs:303`): el diálogo mostraba solo Codex y opencode, aunque Claude había respondido
  3 turnos de chat segundos antes en la misma corrida. La lista sale de `GET /api/system/executor-modes`
  (`NewAgentSelectorModal.tsx:48`, `server.ts:561`). Al repetir pasó 10/10. Evidencia:
  `docs/done/evidence/CI.76-notifications-claude-missing.json`. Fase 1: que el fallo deje la respuesta de
  `executor-modes` y la razón por la que Claude salió no disponible.

- [ ] **CI.69 — `usage-bar`: a veces el Enter del composer no envía el turno.** (abierto 2026-11-08) Falló en el
  pre-push de ADE.7/8 (`2e9aae2d`, `1355590c`): `page.waitForResponse` 180 s sin `POST /api/chat`
  (`usage-bar.mjs:309`). Captura: picker de modelo abierto (Luna · medium) y el texto sigue en la caja, así que
  `handleSend` (`AgentComposer.tsx:468`) salió temprano (`orchestratorLoading`, `isLoadingModels` →
  `sendWhenReadyRef`, o catálogo vacío) o el Enter no llegó. Aislado pasó 2/2. Corrió en paralelo con los gates del
  ejecutor de ADE.9 (carga). Mismo terreno que CI.57 (elegir modelo de Codex). Fase 1: que el fallo deje evidencia
  (valor del textarea, picker abierto, `isLoadingModels`/catálogo, requests tras Enter).

- [ ] **CI.57 — `composer-picker`: a veces elegir otro modelo de Codex en Chat no queda aplicado.** (abierto
  2026-11-03) Falló 4 seguidas (pre-push del lote UI.57/58, 2 aisladas, una en worktree de `82820986`) en `Codex
  effort levels remain available` (`composer-picker.mjs:75-87`): tras clic en GPT-6.1-Sol el selector sigue en
  GPT-6-Luna. Luego pasó 11/11 en `50e087e2`, `a4beb111`, y 5 veces en HEAD (Sol 3, cerebro 2): intermitente, la
  bisección no prueba que sea UI.58. Sospecha (opinión de LLM): una actualización tardía del estado del chat pisa
  la selección. Fase 1: que el fallo deje evidencia (modelo del chat en API antes/después del clic, requests entre
  clic y reapertura, captura).
  Fase 1 hecha: si el paso falla, guarda `composer-picker-model-missing.json` y su captura en el `runDir` (red
  `/api/chat*` y `/api/config*` con ms desde el clic, sesión antes/después/al reabrir, botones marcados, esfuerzos
  visibles, estado del botón). Contraprueba forzada con todas las partes (Sol; `lastModel` de la sesión es `null` antes
  de enviar, la red es la evidencia útil); corrida normal 11/11 (Sol y cerebro, `gate:evidence`
  `CI.57-composer-picker`). Abierto hasta el próximo fallo. Fase 1 por codex gpt-6.1-sol (criterio r1).
  Bucle aislado 2026-11-03 (en serie, sin carga): `composer-picker` 15/15 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.

- [ ] **CI.55 — `tasks`: la tarea real `gate-role-task` a veces no deja `ROLE.md` en el primer intento.** (abierto 2026-11-02)
  Visto 1 vez (pre-push del lote UI.49–55, 2026-11-02): el gate corre Codex real (`gpt-6-luna`); la corrida
  terminó con `retryReason: "missing declared output(s): ROLE.md"`, `retryCount: 1`, `runId: null`, `qaVerdict: fail`, y
  `waitForTaskFinished` (`tasks.mjs:39`) lo toma como fin. Aislado pasa 43/43 justo después. El lote no tocó tareas.
  Evidencia: `docs/done/evidence/CI.55-prepush-fail.log`. Falta: que el próximo fallo deje la salida del CLI de esa
  corrida (stdout/stderr o el log del run) para distinguir modelo, cuota o sandbox.
  Fase 1 hecha: si el paso falla, guarda `role-task-missing-output.json` en el `runDir` del gate con la tarea, las
  filas de run con su detalle (`result`, `executorReply` completo, archivos, checks), las líneas `[cli-spawn]` del
  `dashboard.log` y el estado git/worktrees con `ROLE.md`; el detalle del paso lleva un resumen y la ruta. Contraprueba
  forzada con las 4 partes (Sol); corrida normal 43/43 (Sol y cerebro, `gate:evidence` `CI.55-tasks`). Abierto hasta
  el próximo fallo: leer ese JSON y escribir la fase 2. Fase 1 por codex gpt-6.1-sol (criterio r1).
  Bucle aislado 2026-11-03 (en serie, sin carga): `tasks` 5/5 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Reproducido 2026-11-05 (ejecutor de RUN.1 r2, `tasks` 38/43, con RUN.2 aplicado: no es el bug de `notice`).
  Evidencia `$TMPDIR/ui-gate-88246/role-task-missing-output.json`: run `codex exec --sandbox workspace-write`
  `gpt-6-luna`, 1 iteración, 30 tokens de salida, `executorReply` "I can't make or verify this change because no
  file-editing tool is available in this session"; `retryCount 1`, tarea `pending` (reintento programado). Fase 2,
  dos hallazgos: (a) Codex a veces dice no tener herramienta de edición con `workspace-write` (causa sin aislar);
  (b) `waitForTaskFinished` (`tasks.mjs:39`) toma `pending` con reintento programado como fin.
  Fase 2 hecha: (b) `gate-role-task` sigue el reintento del producto como `gate-first-task` (hasta 3 intentos, cada
  uno con nota `gate-role-task retried` en el resumen); (a) cada intento fallido guarda
  `role-task-missing-output-attempt-<n>.json` con `codexRollouts` (primera línea y últimas 60 del rollout de Codex
  del proyecto temporal). Contraprueba forzada del ejecutor: rollout de 21 líneas capturado. Gates del cerebro: tsc,
  biome, `tasks` 43/43 (`gate:evidence` `CI.55-fase2-tasks`). Abierto hasta el próximo fallo: leer `codexRollouts`
  para aislar (a). Anotado: la escritura del JSON por intento no va envuelta en `capture`.
  Fase 2 por codex gpt-6-luna (mecanico).

- [ ] **CI.54 — `codex-live`: la burbuja del usuario a veces no aparece en 2 s.** (abierto 2026-11-02)
  Visto 1 de 3 (2026-11-02, "turn 1 user message appears before completion"); el pre-push reintenta y lo oculta.
  Fase 1: que el fallo deje evidencia (captura, DOM, composer, timeline, log); fase 2: causa con esa evidencia.
  Fase 1 hecha: si la burbuja falta a los 2 s, el paso guarda `turn1-bubble-missing.png` y un JSON con burbujas,
  cola del hilo, composer, botón, timeline, status del POST, `[chat-turn]` y a qué ms apareció (sigue hasta 15 s).
  Contraprueba forzada (filtro inexistente) con la evidencia completa; corrida normal 14/14 (Sol y cerebro). Abierto
  hasta el próximo fallo: leer ese JSON y escribir la fase 2. Fase 1 por codex gpt-6.1-sol (criterio r1, r2).
  Bucle aislado 2026-11-03 (en serie, sin carga): `codex-live` 5/5 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.

- [ ] **CI.81 — La corrida nocturna de ui-gates registró sus proyectos de prueba en el `~/.orchestos` real.**
  (abierto 2026-11-09) El dashboard de Carlos tenía 80 proyectos: 78 eran fixtures `orchestos-ui-*` en carpetas
  temporales; 61 nacieron entre las 02:33 y las 08:33 del 2026-11-09 (`last_updated` 12:11Z, misma hora que la
  corrida nocturna sobre `d32a935`), 16 apuntaban a carpetas ya borradas y cada carga de la UI pedía
  `/api/config` por proyecto (149 peticiones, 410 por cada carpeta inexistente). Uno (14:21) lo dejó el runner de
  diagnóstico de CI.78 corrido sin `ORCHESTOS_HOME`. Las corridas manuales de `ui:gate` del mismo día no dejaron
  nada. Limpieza hecha con `POST /api/projects/<id>/purge` (copia previa de la DB en `/tmp/ci78/`); quedan 2
  proyectos. Falta: ver si la corrida nocturna con el código actual (después de CI.72) sigue filtrando — contar
  proyectos `orchestos-ui-*` en `~/.orchestos/db.sqlite` tras la corrida del 2026-11-10 — y, si filtra, cortar la
  causa en `scripts/nightly-ui-gates.ts`/`scripts/ui-gate/run.mjs`.
  Ampliado 2026-11-10 (auditoría, sin causa probada): `run.mjs:391` propaga el home temporal mutando
  `process.env.ORCHESTOS_HOME` del proceso del runner; el hijo del dashboard sí recibe `ORCHESTOS_HOME` explícito
  (`run.mjs:68`), pero `run` de `scripts/ui-gate/lib.mjs:79-81` usa `execFileSync` sin `env` y hereda lo que tenga el
  proceso en ese momento. Cualquier subproceso lanzado antes de la línea 391, o por un camino que no pase `env`
  (p. ej. el runner de diagnóstico de CI.78 que no llevaba `ORCHESTOS_HOME`, ver arriba), cae en el `~/.orchestos`
  real. Hipótesis, no verificada como causa de la fuga del 2026-11-09. Verificación del arreglo: tras la corrida
  nocturna, 0 proyectos `orchestos-ui-*` nuevos en `~/.orchestos/db.sqlite`; y que `run` pase `env` explícito.
  Visto 2026-11-10: tras la corrida nocturna sobre `a3c6648` (50 flows), `~/.orchestos/db.sqlite` tiene 5 proyectos;
  los 2 `orchestos-ui-*` son del 2026-09-24. 0 nuevos. Falta solo que `run` pase `env` explícito.

## Código sin uso, cobertura de gates y refactor

AUD.9: la parte (a) quedó hecha en AUD.26; falta verla verde en una nocturna válida y la decisión de WebKit, que
vuelve a importar en la etapa de Tauri. AUD.28 no tiene GO de Carlos.

- [ ] **AUD.8 — Código y endpoints sin uso.** (abierto 2026-11-10) Módulos que nada importa fuera de `src/__tests__/`
  (grep del 2026-11-10 en `src/`, `scripts/`, `package.json`): `src/db/backup.ts` (`db-backup.test.ts`),
  `src/db/retention.ts` (`retention.test.ts`; `LIMITATIONS.md` ya lo decía) y `src/agents/hardening.ts` (ni siquiera
  un test lo importa). Endpoints servidos por `server.ts` que nada de `src/dashboard/app/src` llama: `/api/run/graph`
  (`server.ts:296`), `/api/instincts/propose` (`320`), `/api/runs/analyze` (`211`), `/api/skills/curate` (`377`),
  `/api/skills/pro` (`356`), `/api/project/context/regenerate` (`412`), `/api/tasks/init` (`261`); además
  `scripts/ui-gate/flows/project-tabs.mjs:207` sí llama `/api/instincts/propose`. Verificación: por cada pieza, o se
  cablea a una interfaz, o se borra con su test y el grep queda vacío.

- [ ] **AUD.27 — Código sin uso (amplía AUD.8).** (abierto 2026-11-11) `src/index.ts` y `"module"` de `package.json`;
  `app/src/data/orcaProjectData.ts`; 5 scripts sin invocador; 77 exports y 104 tipos sin importador (`knip`); bloque
  `{false && …}` en `AgentComposer.tsx:1042`; tablas `orchestration_*` y `planner_model` sin consumidor;
  `buildCodexPrompt` duplicado; rama `/legacy` de `http.ts:58`. Verificación: `knip` con la config del informe baja a
  0 archivos y exports de backend sin uso; `tsc` y suite verdes.

- [ ] **AUD.9 — ui-gates: `chat-timeout` rojo permanente en la nocturna y cobertura solo en Chromium.**
  (abierto 2026-11-10) (a) `chat-timeout.mjs:5-6` lanza error si `ORCHESTOS_CHAT_TURN_TIMEOUT_MS !== '4000'`; ninguna
  parte del repo la fija (grep: solo el flow y `handlers/chat.ts:1669`); `nightly-ui-gates.ts` ejecuta todos los flows
  de `scripts/ui-gate/flows` (`:238-246`) con `env` sin esa variable (`:165`) y `run.mjs:62-68` solo hereda
  `process.env`. Inferido por lectura, no confirmado en el resultado de una corrida nocturna. (b) Todos los gates usan
  `chromium.launch()` (`run.mjs:222`); Safari/WebKit no se prueba (relevante para IDEAS #41, Tauri). (c) Lo del home
  temporal está en CI.81 (ampliado). Verificación: la nocturna deja `chat-timeout` verde sin intervención (el flow o
  el runner fijan el valor); decisión de Carlos sobre añadir WebKit.
  2026-11-12: (a) hecho en AUD.26 (`run.mjs` fija la variable; `chat-timeout` 9/9 en vivo). Falta confirmarlo en la
  próxima nocturna válida y (b) WebKit, decisión de Carlos.

- [ ] **AUD.10 — Mutación: `harness.ts` y `contract.ts` no están en ningún shard de la nocturna.** (abierto 2026-11-10)
  `.github/workflows/mutation-nightly.yml:20-40` corre 11 shards (`executors-engines`, `-engines-b`, `-routing`,
  `-routing-b`, `-routing-c`, `-codex-server`, `-codex-server-b`, `-codex-server-c`, `-codex-engines`,
  `runtime-boundaries`, `context-routing`) y ninguna de sus configs nombra `harness.ts` ni `contract.ts` (grep en
  `stryker*.config.mjs`). Solo `stryker.run.config.mjs` los cubre con el glob `src/run/**/*.ts`, y el workflow no la
  usa. Configs en la raíz que el workflow no ejecuta: `stryker.config.mjs` (`qa.ts`), `stryker.checks.config.mjs`,
  `stryker.sandbox-policy.config.mjs`, `stryker.graph-runner.config.mjs`, `stryker.run.config.mjs`,
  `stryker.run-executors.config.mjs`, `stryker.run-executors-codex.config.mjs` (los scripts `mutation:*` existen en
  `package.json:54-71`). No verificado: si alguna se corre a mano o desde otro workflow (`ci.yml` no menciona
  mutación). Verificación: un shard nuevo para `harness.ts`/`contract.ts` en el workflow, o la decisión escrita de
  dejarlos fuera con su motivo.

- [ ] **AUD.28 — Funciones que mezclan responsabilidades: cortar las cinco más grandes.** (abierto 2026-11-11)
  `runTask`, `handleApiChat`, `route`, `App` y `OrchestSettingsView`: 1045, 1122, 430, 1982 y 3843 líneas; cortes con nombres y rangos en el
  informe. Mover sin cambiar comportamiento, un corte por commit. Necesita GO de Carlos (cambio grande; en los
  componentes del prototipo choca con la comparación 1:1). Verificación: ninguna función de `src/run` ni de
  `handlers/` sobre 300 líneas; suite y ui-gates del área verdes antes y después.
