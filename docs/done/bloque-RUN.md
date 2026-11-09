# Cerrados de RUN

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
