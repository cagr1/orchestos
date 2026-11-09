---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: fase-2--solo-fiabilidad-abierta
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo

Orden de Carlos (2026-09-22): *"Terminar interfaz, luego producto mínimo para entrega y luego corregir"*. Lo que no
está en una fase no se abre sin GO de Carlos.

- **Fase 1 — Terminar la interfaz:** cerrada.
- **Fase 2 — Producto mínimo para entrega:** en curso. Sus bloques de producto están cerrados (el último, ADE, el
  2026-11-09); quedan abiertos solo los ítems de fiabilidad de abajo.
- **Fase 3 — Correr dentro de OrchestOS igual que el CLI directo:** todos sus ítems nombrados (AT.11, AT.13,
  AT.19–21, CX.6, ERP.5–7, H.7.2c, H.7.3) están cerrados.
- **Siguiente:** decide Carlos — otro bloque de producto o el mes de uso real.

Rumbo y notas anteriores: `docs/done/plan-historico-2026-11-09.md` (histórico).

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

## Abiertos — fiabilidad de los gates

Esperan su próximo fallo; el diagnóstico de cada uno está en su ítem.

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

## Decisiones pendientes de Carlos

- Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no (anotado en UI.8;
  sin verificar si sigue vigente).
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
→ [cerrados de ADE](docs/done/bloque-ADE.md)
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
