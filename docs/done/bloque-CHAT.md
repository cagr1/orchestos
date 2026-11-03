# Bloque CHAT — cerrados

## Archivado 2026-11-03 desde PLAN.md (DOC.5)

<a id="bloque-chat-seccion-abiertos---fiabilidad-de-los-gates-y-doc"></a>
### Abiertos — fiabilidad de los gates y documentación

- [x] **CHAT.3 — 🔍 Si el modelo no responde, el chat dice por qué, en el momento.** (cerrado 2026-10-25, pedido de
  Carlos tras CI.11) Hoy el aviso de reintento de Codex (`error` con `willRetry`) se descarta, la cuota agotada
  (`account/rateLimits/updated`) no se muestra, no hay clasificación de errores (cuota, auth, red, sobrecarga, modelo
  inválido) y al timeout el hilo enseña el texto crudo `Codex CLI: Codex timed out after 120000ms`. Capa común de
  avisos + adaptador por CLI (Codex, Claude).
  Hecho: paso `notice` tipado (`src/run/executors/cli-failure.ts`, clasificador + mapa directo de errores de Claude
  `api_retry`/`assistant.error`); Codex convierte `error` con `willRetry` y cuota al 100 % en avisos, y mientras calla
  lee su log nativo `logs_2.sqlite` (solo lectura) para decir "Codex got 429 Too Many Requests — retry 1/5 in 70 s":
  la causa medida de los silencios de CI.11 era un 429 con reintento a 70–245 s que Codex no emite por JSON-RPC. En el
  hilo: línea viva "Request sent to <modelo> — no response yet…" con contador; el fallo queda visible con mensaje
  clasificado y "Details", también tras recargar. Migración 32 (`chat_turn_steps.type` admite `notice`). Timeout del
  turno configurable solo para gates (`ORCHESTOS_CHAT_TURN_TIMEOUT_MS`); flujos nuevos `chat-timeout` y
  `chat-notices`. 5 rondas: la revisión del cerebro cazó que el mensaje del usuario contaba como respuesta, que el
  aviso no llegaba a pantalla y que "Codex reported no error" mentía. Cerebro: tsc, lint, `test:coverage` 2079/0.
  Gate en vivo: navegador real (Playwright), chat-streaming 27/27, codex-live 14/14, chat-notices 5/5, chat-timeout 9/9, `docs/done/evidence/CHAT.3-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CHAT.3.md
- [x] **CHAT.2 — 🔍 El prompt del chat no explica comandos, espera de tareas, checks ni reintentos.** Cerrado 2026-10-24.
  GO de Carlos 2026-10-24. Cuatro ajustes de texto: `Commands:` son de los ejecutores; `create_task` arranca o espera
  (manual / archivos existentes); qué son los checks automáticos; reintentar/cancelar/borrar van por la tarjeta.
  `Commands:` lleva "(for task executors and their checks, not this chat)"; `buildAutoTaskInstruction` recibe
  `permissionMode` del config: Manual → espera Run en la tarjeta; Yolo → arranca salvo output existente; "never claim a
  waiting task is running"; checks = outputs declarados + checks de tarea/proyecto, revisor LLM solo con criterios o
  gate de revisión (cerebro lo contrastó en `harness.ts:791`); reintentar/cancelar/borrar → la tarjeta. Cerebro:
  typecheck 0, unitarios 14/0; ejecutor `test:coverage` 2026/0.
  Gate en vivo: `docs/done/evidence/CHAT.2-chat-live.json` (chat-streaming 27/27, codex-live 14/14)
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CHAT.2.md (borrado)
- [x] **CHAT.1 — 🔍 El chat ofrece `rg` aunque no esté instalado.** Cerrado 2026-10-23. Reportado por el chat:
  `run_readonly` fallaba con "Executable not found". `readonlyPrograms()` sondea `rg --version` (sonda inyectable,
  cache por proceso); schema, descripción y prompt se arman de esa lista; sin `rg` la llamada responde
  `rg is not installed; use ["git","grep",…]`. Cerebro, sonda real en la Mac de Carlos: `[git, ls]`, la descripción
  no menciona `rg`, `rg` → error con alternativa, `git grep` → resultado. Ejecutor: 2025/0 en `test:coverage`.
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CHAT.1.md
- [x] **CHAT.4 — 🧠 Stop real: detener un turno en curso desde el chat y desde Dev.** Carlos 2026-11-02: GO a
  planificarlo. Hoy no hay cancelación de turno en el backend (el Stop de Dev era falso, UI.38.4). Plan antes de
  código: cómo se corta cada motor (Claude CLI, Codex app-server, API), qué queda en el hilo y en la DB, qué ve el
  usuario. Toca back y front → plan + GO de Carlos.
  GO de Carlos al plan 2026-11-02. Spec: docs/specs/CHAT.4.md (fases .1 back, .2 UI + gate en vivo).
  CHAT.4.1 back hecho: registro de turnos con `AbortController` (`chat-turn-registry.ts`), `POST
  /api/chat/sessions/:id/stop` (202/200/404), Codex `turn/interrupt` sin matar el app-server ni fallback, Claude
  SIGTERM→SIGKILL 2 s y sin `--resume` tras Stop, `signal` hasta cada fetch de API, migración 33 `cancelled`. Gates
  del cerebro: typecheck, lint, `test:coverage` 2182/0 (funciones 80,64 %, líneas 68,31 %); contraprueba de Sol 12
  fallos contra HEAD. Sin verificar en vivo: va en CHAT.4.2. Ejecutado por: codex gpt-6.1-sol (criterio) · revisión Opus.
  CHAT.4.2 UI: el botón de enviar pasa a "Detener" (cuadrado) y "Deteniendo…" mientras hay turno en curso, en Chat y
  Dev (`ComposerSubmitButton`, `useStopChatTurn`); el hilo marca "Respuesta detenida" en muted sin banner; fallo del
  stop silencioso. ui-gate nuevo `chat-stop` (Chat y Dev con el CLI real: Stop, parcial que no crece, `stopped` en
  la DB, segundo turno normal y sin `--resume` de Claude). Gates del cerebro: lint, `test:coverage` 2187/0,
  `ui:gate chat-stop` 22/22. Sol: `chat-stop` 22/22, `chat-streaming` 27/27, `codex-live` 15/15.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CHAT.4-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio, .1 y .2) · revisión Opus · Spec: docs/specs/CHAT.4.md
