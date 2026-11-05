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

### Fase 1 — Terminar la interfaz (plantilla React de AI Studio, regla UI.13) — CERRADA
Todos sus ítems están archivados en `docs/done/` (UI.13.x, UI.9.8/9.9, UI.10.A, CI.2; el selector nativo de nuevo proyecto lo cerró UI.15).

### Fase 2 — Producto mínimo para entrega (ruta ERP) — EN CURSO
**Decisión de Carlos 2026-10-05:** *"primero lo primero, que funcione"* — ERP.4 no se abría hasta que R.8 dijera, con
evidencia, que el recorrido funciona. Cerrados y archivados: AT.10, R.7, ERP.2, ERP.3, I.7, H.5.3, H.9.4. R.8.1–R.8.6
están cerrados (2026-10-05/12); R.8 queda abierto solo por la contrastación con una tarea real de Carlos, que cubre
ERP.4. El piloto de ERP.4 corrió completo el 2026-10-13 (etapas 1-6; ERP.4.1–ERP.4.13 cerrados).

**Orden vigente** (GO de Carlos 2026-10-13 a UI.24, UI.25 y UI.26; "UI.24 primero, ERP.4 al final", `NEXT.md`):
1. UI.26.5 → UI.26.6 → UI.26.7 (UI.26 absorbió UI.25.2–25.4; UI.25 y UI.26.1–26.4a cerrados 2026-10-13/14).
2. UI.24.4 → UI.24.5 → UI.24.6 (incluye ERP.4.14) → UI.24.7 (UI.24.1–24.3 cerrados 2026-10-13).
3. ~~ERP.4.15 → ERP.4.16 → limpiar `erp-piloto` → veredicto de ERP.4 → cierre de R.8~~ (cerrado 2026-10-15).
4. ~~UI.8.6 (permisos visibles: aprobar en el chat lo que el CLI va a hacer)~~ (cerrado 2026-10-16). Sigue Fase 3.

Fiabilidad abierta, sin orden fijo (se atiende cuando el pre-push la tumba): CI.11, CI.18, CI.19, CI.23, CI.25.
Documentación y código muerto: DOC.1 y LIMP.1 (GO de Carlos 2026-10-14).

### Fase 3 — Correr dentro de OrchestOS igual que el CLI directo
AT.13 (el contexto inyectado dice la verdad y no pesa) → AT.19 (lo que Claude notó dentro del chat; AT.19.1, AT.19.2) → AT.20 → AT.21 → CX.6 → ERP.6 (demostrar que no pesa) → ERP.5 (qué quitar) → ERP.7 (T3 Code) → H.7.2c → H.7.3 (aviso de contexto)
→ AT.11 (adaptadores genéricos).

### Fuera de las tres fases (no se abren sin GO)
H.10.2 (H.9.4 entró a la Fase 2 el 2026-10-05). Los 11 superados por UI.13/UI.14 se retiraron el 2026-09-22 (`docs/done/retirados.md`).

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

Cerrada. Todos sus ítems están archivados en `docs/done/` (ver "Cerrados — evidencia archivada" al final).

## Fase 2 — Producto mínimo para entrega

### Abiertos — fiabilidad de los gates y documentación

- [x] **OC.1 — La terminal de Dev lanza OpenCode con `--standalone`.** (abierto 2026-11-03, GO de Carlos al plan
  OC.1–OC.4) Con OpenCode 2.2.5 y el servicio compartido desincronizado, la TUI sale a los ~20 s.
  Hecho: `resolveOpenCodeCommand` devuelve `[binary, '--standalone']` (servidor privado por pestaña).
  Gates del cerebro: tsc, tests 36/0, `ui:gate opencode-terminal` 13/13 con el servicio compartido aún roto.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/OC.1-OC.2-live.json`.
  Ejecutado por: codex gpt-6-luna (mecanico r1) · revisión Opus
- [x] **OC.2 — El catálogo de OpenCode usa `api --standalone model.list`.** (abierto 2026-11-03) 2.2.5 quitó
  `models --verbose`; catálogo vacío y `model-routing` rojo bloquean el push.
  Hecho: `parseOpencodeModels` lee `data[]` (`providerID/id`, esfuerzos = `variants[].id`); sale la llamada a
  `run --help`. En vivo (Sol): `/api/models/catalog` 361 modelos, 230 con esfuerzos y 131 sin.
  Gates del cerebro: tsc, tests 36/0, `ui:gate model-routing` 19/19.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/OC.1-OC.2-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio r1) · revisión Opus
- [x] **OC.2.1 — `opencode-engine.test.ts` simula el catálogo con el formato viejo.** (abierto 2026-11-03, regresión
  de OC.2 vista en el pre-push; el cerebro corrió 3 archivos en vez de `test:coverage`)
  Hecho: el mock responde a `model.list` con el JSON nuevo. Gate del cerebro: `test:coverage` 2240/0.
  Ejecutado por: codex gpt-6-luna (mecanico r1) · revisión Opus
- [x] **DOC.7 — Fuera los marcadores de delegación de los ítems del plan.** (abierto 2026-11-03, decisión de Carlos
  2026-10-13 reafirmada hoy) El rol sale del roster; el marcador era formato parseado (regex, columna con CHECK).
  Hecho: formato `- [ ] **ID — título.**`; `plan-status.ts` acepta el marcador legado pero nunca lo emite; migración 34
  quita `plan_items.delegation` (DB real migrada); `next`, `handoff`, `plan-doc`, tipos y tests sin el campo;
  `AGENTS.md` y `docs/agent-work-protocol.md` sin marcador; los 10 ítems de `PLAN.md` sin él. `docs/done/` intacto.
  Gates del cerebro: tsc, `test:coverage` 2243/0, `plan-render --check` 0, `next` lista `ID — título`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/DOC.7-live.json` (`plan-doc` 16/16).
  Ejecutado por: codex gpt-6.1-sol (criterio r1) · revisión Opus
- [x] **DOC.8 — Vuelven las reglas vivas que DOC.6 retiró.** (abierto 2026-11-03, GO de Carlos tras la auditoría de
  Sol: 36 reglas sin respaldo y 7 de significado cambiado) Hecho: `AGENTS.md` recupera las generales (no duplicar ítem
  tomado, no improvisar gobierno, control computable, lint completo, contrato CLI lo prueba el cerebro, evidencia solo
  `<ID>-live.json`, aviso de `criterio-alt`, fecha de caso de campo, limpieza comprobada por consulta, batería completa
  en cambio de marco, texto emitido, roadmap determinista, costo QA, `CONTEXT.md` derivado); 23 recetas en
  `docs/reference/gotchas.md` (no cargado); `NEXT.md` recupera seguimientos, alcance de Settings y "abrir solo si Carlos
  lo pide". `knownCost` sale de decisiones pendientes: solo entra con `usd` `undefined` (`harness.ts:835`).
  Ejecutado por: claude opus-5.5 (cerebro, solo docs)
- [x] **OC.3 — El ejecutor `opencode run` usa `--standalone` y `--model prov/modelo#variante`.** (abierto 2026-11-03)
  2.2.5 quitó `--variant`; sin `--standalone` depende del servicio. Hecho: tarea, display y chat pasan `--standalone` y
  `--model <modelo>#<variante>`; parser intacto (`part.type` sigue `step-finish`). Gates del cerebro: tsc, lint,
  `test:coverage` 2243/0. Gate en vivo: inferencia real con los args del chat, `docs/done/evidence/OC.3-live.json`.
  Revisión: Opus.
  Ejecutado por: codex gpt-6-luna (mecanico r1) · Spec: docs/specs/OC.3.md
- [x] **OC.4 — El adaptador HTTP de aprobaciones migra a la API v2 de OpenCode.** (abierto 2026-11-03) Cambiaron
  banner, `/api/session`, prompt, modelo y permisos (`src/run/executors/opencode-server.ts`). Hecho: rutas `/api`,
  envoltura `data`, reglas `{action,resource,effect}`, variante dentro de `model`, `decision` once/reject (nunca always),
  `session/active`, mensajes paginados y traducidos al NDJSON de siempre; permisos v2 en `opencode-approval.ts`.
  r1: el test del motor seguía simulando la API v1. Gates del cerebro: tsc, lint, `test:coverage` 2250/0.
  Gate en vivo: `opencode serve` real, edición aprobada crea el archivo con costo y tokens; shell rechazado falla la
  tarea; sin servidores huérfanos (`docs/done/evidence/OC.4-live.json`).
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico r1) · Spec: docs/specs/OC.4.md
- [x] **ONB.1 — El primer arranque usa una CLI instalada, no OpenRouter.** (abierto 2026-11-04, GO de Carlos) Clon
  limpio: `setup` exigía `OPENROUTER_API_KEY`, el chat nacía en `api` con `typesafe/jev-router` (precio -1 ordenado
  primero) rotulado "ChatGPT" y el primer mensaje fallaba.
  Texto visible: mensaje de error sin CLI ni clave (dice qué instalar; un ícono no lo explica) y la etiqueta
  "OpenRouter" (reemplaza "ChatGPT", que era falsa).
  Hecho: `default-chat-agent.ts` (config → primera CLI instalada, con chat y funcional en orden del registro →
  `api` con clave → nada); sesiones, `GET /api/chat/default-agent`, composer sin hilo y `setup` lo usan; catálogo
  sin precios negativos; clave de OpenRouter opcional. Gates del cerebro: tsc, lint, `test:coverage` 2264/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ONB.1-live.json` (`ORCHESTOS_HOME` vacío → "Message Claude…",
  primer mensaje respondido por la CLI en 2,4 s, sin error). Sin probar en vivo: el caso sin ninguna CLI (tests).
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio r1) · Spec: docs/specs/ONB.1.md
- [x] **ONB.2 — Model routing propone la CLI detectada para los roles vacíos.** (abierto 2026-11-04, GO de Carlos,
  opción 1) Clon limpio: los cuatro roles nacen sin asignar y la primera tarea falla con "Rol 'executor' sin asignar";
  el error no lleva a Settings. Detectar no es decidir: se propone, Carlos confirma con un clic y guarda.
  Texto visible: "Use <CLI> for unassigned roles" y "Model routing" junto al error de tarea; un ícono no dice
  qué CLI se detectó ni adónde lleva. El mensaje del rol sin asignar pasa al inglés, como el resto de la UI.
  Hecho: `routing-roles.ts` (filtros y modelo compartidos entre selector y botón); la sugerencia sale de
  `/api/chat/default-agent`; correr una tarea sin rol devuelve `code: 'role_unassigned'` y el error muestra el botón
  "Model routing"; `createSession` sin agente deja que el servidor lo resuelva (hermanos de ONB.1). r1: nombre visible
  "Claude" (como el selector) y botón compacto. Gates del cerebro: tsc, lint, `test:coverage` 2275/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/ONB.2-live.json`; `ui:gate model-routing` 24/24
  repetido por el cerebro (error 400 `role_unassigned` → botón → Model routing; "Use Claude for unassigned roles" →
  guardar → los 4 roles en `claude`/`claude-opus-5-5`; el botón desaparece). Captura mirada a ojo.
  Anotado: con una sola CLI el Reviewer queda igual que el Executor (la UI ya avisa "errors may correlate").
  Revisión: Opus (diff de Sol leído completo; r1 de Luna verificado en la captura).
  Ejecutado por: codex gpt-6.1-sol (criterio) + luna (mecanico r1) · Spec: docs/specs/ONB.2.md
- [x] **CI.61 — `Mutation Shards`: `executors-routing` vuelve a pasar las 3 h.** (abierto 2026-11-04) Corrida
  `41811181197`: shard cancelado a 180 min (11:09 → 14:10); los otros 9 verdes. Duración 77 min (2026-10-27) →
  151 (2026-11-03) → 180+. Muta `cli-registry.ts` (496 líneas, 46 tests) y otros 6 archivos (~506 líneas, hasta
  51 tests). Se parte en dos: `executors-routing` = `cli-registry.ts`; `executors-routing-c` = el resto.
  Hecho: `stryker.run-executors-routing-c.config.mjs`, exclusión en `-routing`, script en `package.json`, matriz del
  workflow y prueba de particiones. Gates del cerebro: `mutation-test-shard.test.ts` 9/0, lint, `test:coverage`
  2273/0 (los 6 fallos del ejecutor eran de su sandbox: EADDRINUSE y EPERM en `~/.ssh`). La duración real se ve en
  la próxima corrida nocturna; si `-routing` sigue sobre 150 min, se reabre.
  Revisión: Opus (diff leído completo).
  Ejecutado por: luna (mecanico) · Spec: docs/specs/CI.61.md
- [x] **UI.63 — El popover de cuotas muestra los créditos de reinicio de Codex.** (abierto 2026-11-04, GO de Carlos)
  `account/rateLimits/read` ya devuelve `rateLimitResetCredits {availableCount, credits[{status, expiresAt, title}]}`
  (en vivo hoy: 3 disponibles, "Full reset (Weekly + 5 hr)") y OrchestOS lo descarta. Solo se muestra; gastar un
  crédito (`account/rateLimitResetCredit/consume`) es irreversible y queda fuera.
  Texto visible: "Reset credits" en el popover (un número suelto no dice qué es) y la expiración del más próximo.
  Hecho: `parseCodexResetCredits` en `scripts/context-adapters.ts` (cuenta y vencimiento más próximo; sin `id` ni
  `description`); `rateLimits.resetCredits` en `/api/session/status` solo para Codex; fila "Reset credits N · expires
  in Nd" en el popover, solo con créditos > 0. r1: el número no hereda el color de la cuota semanal. Gates del cerebro:
  tsc, lint, `test:coverage` 2287/0.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.63-live.json`; `ui:gate usage-bar` 22/22 repetido
  por el cerebro con Codex real; captura mirada a ojo: "Reset credits 3 · expires in 1d".
  Revisión: Opus (diff de Sol leído completo; r1 de Luna verificado).
  Ejecutado por: codex gpt-6.1-sol (criterio) + luna (mecanico r1) · Spec: docs/specs/UI.63.md
- [x] **DOC.9 — `bun run readme:sync`: el README se actualiza solo con datos computables.** (GO de Carlos
  2026-11-05) Bloques marcados (CLIs, número de tests) reescritos sin LLM; un workflow de los viernes abre un PR.
  Hecho: `scripts/readme-sync.ts` (bloques `readme-sync:clis` desde `KNOWN_CLIS` y `readme-sync:tests` desde la salida
  de `test:coverage`, stdout+stderr; con fallos no escribe), `--check`, `--from-log`; workflow
  `.github/workflows/readme-sync.yml` (viernes 12:00 UTC + manual, PR si cambia, uno abierto a la vez). Gates del
  cerebro: `test:coverage` 2295/0, `readme:sync` real → 2296 (suma el test de r2), `--check` exit 0, lint y tsc.
  qa (Sol) r1: 2 P1 (resumen en stderr, `tee` sin stderr) confirmados y corregidos en r2. `actionlint` no instalado.
  Ejecutado por: codex gpt-6-luna (mecanico r1, r2) · revisión qa codex gpt-6.1-sol
- [x] **DOC.9.1 — El test de `readme-sync` no depende del `README.md` real.** (regresión de DOC.9, 2026-11-05) El
  pre-push de `52879bd5` falló: el test fija 2295 y lee el README real, que ya dice 2296.
  Hecho: `syncReadme` recibe la ruta del README; el test usa un README de fixture en `mkdtempSync`. Gates del
  cerebro: test 10/0 con el README real alterado a mano (restaurado), lint, tsc.
  Ejecutado por: codex gpt-6-luna (mecanico)
- [x] **RUN.2 — `run_steps` acepta el paso `notice` de Codex; persistir un paso nunca rompe la corrida.** (visto
  2026-11-05 en el gate de RUN.1) Desde CHAT.3 (`760982d9`) Codex emite `notice` y el CHECK de `run_steps` lo rechaza
  con `SQLITE_CONSTRAINT_CHECK` dentro del handler de `codex-app-server.ts:475`. En HEAD sin el arreglo,
  `chat-retry-report` deja la tarea "Interrupted: the task runner stopped" (el error tumba el runner).
  Hecho: migración 35 `run-step-notices` (CHECK con `notice`, filas copiadas); `insertRunStep` guarda el notice
  (`detail` = JSON del `CliNotice`); `harness.ts` registra y sigue si el insert lanza; consola de sesión pinta
  `[notice]`. Hermano `chat_turn_steps` ya lo admitía. No es la causa de CI.55 (reprodujo con el arreglo).
  Gates del cerebro: tsc, lint, `test:coverage` 2308/0, `tasks` 43/43 sin `SQLITE_CONSTRAINT` en `dashboard.log`.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/RUN.2-live.json`
  Revisión: Opus (diff de Sol leído completo).
  Ejecutado por: codex gpt-6.1-sol (criterio)
- [x] **RUN.1 — Una tarea fallida explica por qué falló en vez de reintentar a ciegas.** (pedido de Carlos
  2026-11-05) "No creo que el usuario deba hacer restart de una tarea fallida; si algo falló, es más valioso saber
  por qué que volver a intentar." Origen: `restart-mid-run` caso A ("failed · attempt 1/3" con reintento pendiente).
  Decisión (2026-11-05): el reintento automático con el motivo del fallo se mantiene; la tarjeta fallida del hilo
  muestra arriba el diagnóstico (check que falló con su salida, razones del QA, reporte del ejecutor, enlace a la
  evidencia) y se quita `Retry` (`TaskCard.tsx:432`); para seguir, se ajusta el pedido en el chat.
  Hecho: `task-report.ts` arma `diagnosis` (causa, check fallido con la cola de su salida, razones QA deduplicadas,
  reporte del ejecutor; rutas de worktree relativizadas; topes de bytes). La tarjeta lo muestra en `failed` con
  "View evidence" (abre ese run en Settings → Runs). Sin `Retry`. La interrupción (`failed` con
  `INTERRUPTED_REASON`) muestra solo "Resume". Gates del cerebro: tsc, lint, `test:coverage` 2308/0,
  `chat-retry-report` 23/23 y `restart-mid-run` 30/30. `chat-retry-report` falló 2 veces antes por timeout de 30 s
  del primer turno de Codex, que es previo a la tarea.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/RUN.1-live.json`
  Revisión: Opus (diff de Sol leído; capturas `failed-task-diagnosis.png` r1 y r2 mirados).
  Anotado: `pending` con reintento programado muestra el resumen, no el diagnóstico; "Interrupted" sale dos veces
  (en el estado y en la línea).
  Texto visible: "Interrupted — the task runner stopped before it finished" (un ícono no dice que no es un fallo)
  Texto visible: "Executor report (not verified)" (avisa que es lo que dijo el modelo, no un hecho)
  Texto visible: "Check output" (rótulo del desplegable de una salida larga) · "QA:" (de quién es la razón)
  Texto visible: "View evidence" · "Resume" (botones: una acción sin rótulo es ambigua)
  Ejecutado por: codex gpt-6.1-sol (criterio r1, r2)
- [ ] **UI.64 — El (+) de proyecto y el de adjuntar abren un menú, no una acción directa.** (pedido de Carlos
  2026-11-05) "+ Add project" ofrece clonar desde URL como Orca, T3 y MonoCode. Adjuntar archivo en Chat y Dev hoy
  abre directo el selector del sistema; debe abrir antes un menú.
  Decisión (2026-11-05): adjuntar = "Subir desde la computadora" + "Archivo del proyecto"; clonar = URL + carpeta de
  destino elegible (por defecto la que contiene los proyectos), registra y activa. Referencias leídas (bundle de Orca, código de T3): ambas abren directo el selector al
  adjuntar; el menú del clip es decisión propia. MonoCode sin verificar (binario Tauri).
  Spec: docs/specs/UI.64.md
- [ ] **CI.19 — El `git commit` del fixture falla a veces en el andamiaje de los ui-gates.** Visto 1 vez en
  `qa-negative` (2026-10-11, 1 de 9): `Command failed: git … commit -qm task fixture`, sin motivo porque el helper
  `run` usa `stdio: 'ignore'`. `qa-negative` ya reporta stdout/stderr y exit; los otros 20 flows con el mismo helper no.
  Al próximo fallo, leer el motivo en el `result.json` antes de arreglar; llevar el helper a `scripts/ui-gate/lib.mjs`.
  Fase 1 (2026-10-23): `run` vive en `scripts/ui-gate/lib.mjs` y los 27 flows lo importan; todo fallo dice
  `failed (exit N): <stdout+stderr>`. Gates (cerebro): `plan-doc` 16/16, `project-tabs` 39/39, `model-routing` 18/18;
  `test:coverage` 2012/0 (ejecutor). Sigue abierto hasta el próximo fallo: leer el motivo y escribir la fase 2.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.19-live.json`
  Ejecutado por: claude sonnet (criterio-alt; Sol sin cupo de 5 h) · Spec: docs/specs/CI.19.md
  Bucle aislado 2026-11-03 (en serie, sin carga): `qa-negative` 3/3 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.
- [ ] **CI.57 — `composer-picker`: a veces elegir otro modelo de Codex en Chat no queda aplicado.** (abierto
  2026-11-03) Falló 4 seguidas (pre-push del lote UI.57/58, 2 aisladas, una en worktree de `82820986`) en `Codex
  effort levels remain available` (`composer-picker.mjs:75-87`): tras clic en GPT-6.1-Sol el selector sigue en
  GPT-6-Luna. Luego pasó 11/11 en `50e087e2`, `a4beb111`, y 5 veces en HEAD (Sol 3, cerebro 2): intermitente, la
  bisección no prueba que sea UI.58. Sospecha (opinión de LLM): una actualización tardía del estado del chat pisa
  la selección. Fase 1: que el fallo deje evidencia (modelo del chat en API antes/después del clic, requests entre
  clic y reapertura, captura).
  Spec: docs/specs/CI.57.md
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
  Spec: docs/specs/CI.55.md
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
  (b) `waitForTaskFinished` (`tasks.mjs:39`) toma `pending` con reintento programado como fin. Falta spec.
- [ ] **CI.54 — `codex-live`: la burbuja del usuario a veces no aparece en 2 s.** (abierto 2026-11-02)
  Visto 1 de 3 (2026-11-02, "turn 1 user message appears before completion"); el pre-push reintenta y lo oculta.
  Fase 1: que el fallo deje evidencia (captura, DOM, composer, timeline, log); fase 2: causa con esa evidencia.
  Spec: docs/specs/CI.54.md
  Fase 1 hecha: si la burbuja falta a los 2 s, el paso guarda `turn1-bubble-missing.png` y un JSON con burbujas,
  cola del hilo, composer, botón, timeline, status del POST, `[chat-turn]` y a qué ms apareció (sigue hasta 15 s).
  Contraprueba forzada (filtro inexistente) con la evidencia completa; corrida normal 14/14 (Sol y cerebro). Abierto
  hasta el próximo fallo: leer ese JSON y escribir la fase 2. Fase 1 por codex gpt-6.1-sol (criterio r1, r2).
  Bucle aislado 2026-11-03 (en serie, sin carga): `codex-live` 5/5 verde, sin reproducir. Los fallos vistos fueron en
  el pre-push (con carga); próximo intento: repetir bajo carga.
  Bajo carga 2026-11-05 (secuencia del pre-push, 16 flows, con `test:coverage` en paralelo): verde, sin reproducir.
  Sigue esperando el fallo.

**Mantenibilidad (observación transversal):** en la revisión, cli.ts tenía 2923 líneas,
harness.ts 1203 y chat.ts 1237. La concentración de responsabilidades merece atención, pero
el tamaño no demuestra un bug. Extraer únicamente responsabilidades necesarias para los ítems
anteriores, con pruebas de comportamiento; no abrir un refactor masivo por conteo de líneas.

**Decisiones pendientes de Carlos dentro de UI.8** (no las toma ningún LLM):
1. `agents` como tabla propia o proyección derivada (UI.8.2).
2. Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no.
3. Si UI.8.6 entra en este bloque o sale como bloque propio con backend separado. — Decidido 2026-10-16: entra la aprobación por tarea; la de cada herramienta sale como bloque propio.

## Fase 3 — Correr dentro de OrchestOS igual que el CLI directo

**Después de iniciar:** AT.11 (registro extensible completo), migración visual de pantallas
secundarias, resume/fork avanzado, orquestación de flotas y mejoras de aprendizaje nocturno.
H.10.2 sigue abierto; no es condición de entrada si el piloto no usa ese proceso. UI.8.6 completo
puede entregarse después, pero el piloto debe mostrar permisos reales y los límites de H.9.4.
La corrida sobre carlosgallardo.dev citada en AT queda como smoke opcional, no criterio de éxito.
Revisión documental de esta ruta: preflight AT.10 válido; verificación por lectura, sin corrida
ERP ni prueba visual nueva. Los ítems permanecen abiertos hasta sus gates reales.

**AT.11 adelantado (GO de Carlos 2026-10-26):** "cualquier CLI" sin instalar nada ni escribir código por CLI. Hoy cada
motor es código a mano (`src/run/executors/task-engines.ts:37-51`) y el único PTY está fijo a `opencode`
(`src/dashboard/terminal.ts:19`). Modelo: capa común configurable (como Orca: cualquier CLI de terminal) + adaptadores
ricos por CLI solo para streaming/sesiones/cuotas (como T3 Code). Fuera: chat con CLI genérico (necesita streaming).

## Fuera de fase

**Fuera de scope declarado de H.9:** `opencode` (mismo criterio que H.8 — sin contrato
verificado); el sandbox de **escritura** de las tareas (worktrees ya lo cubren, es otro eje); la
frontera de red/SSRF (`src/dashboard/ssrf.ts` ya existe y no se toca); y cualquier cambio al
vault o a `~/.claude`/`~/.codex` de Carlos — el vault sigue alimentando el trabajo de desarrollo
igual que hoy, lo que se corta es que el **producto** lo herede por accidente.

### H.6 — Fuera de alcance de este bloque (anotado, no se toca)

- `src/cli.ts` tiene **2439 líneas y 63 edges** — god file evidente. Es lo segundo que critica
  un externo después del README, pero no es un hueco de harness. Va a `IDEAS.md` si Carlos lo
  aprueba; **no se refactoriza dentro del Bloque H**.
- Cobertura de líneas 62.91% y `src/skills/fetch.ts` en 0% de funciones. El trinquete ya sube
  solo; no abrir ítem salvo decisión explícita.
- Todo el gobierno del repo está en español con README en inglés. Decisión de producto, no
  defecto — no tocar sin que Carlos lo pida.

---

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
