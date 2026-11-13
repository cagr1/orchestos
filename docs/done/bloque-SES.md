# Cerrados de SES — cerrar una sesión de verdad (etapa 1, 2026-11-12/13)

Movidos desde `PLAN.md` el 2026-11-13.

- [x] **SES.1 — Cerrar una sesión de verdad.** (abierto 2026-11-12; Carlos: va justo después del lote AUD) La X del
  tab (`App.tsx:172`, `closeDevTab`) solo quita el tab de la UI: la sesión sigue activa y su turno corriendo. Archivar
  (`handlers/chat-sessions.ts:551`, `handleApiChatSessionArchive`) marca `archived` sin detener el turno en curso: el
  CLI queda vivo y la sesión desaparece del sidebar. Borrar ya rechaza con turno activo (409). Diseño (patrón de
  JetBrains "Terminate / Disconnect", VS Code `confirmOnKill`, tmux detach/kill): **tab = vista, sesión = proceso**.
  (1) Cerrar un tab ocioso: se cierra sin preguntar. (2) Cerrar un tab con turno en curso: diálogo "Detener y cerrar"
  / "Dejar corriendo" / "Cancelar", con "recordar" en Settings. (3) Sesiones en segundo plano: punto de "corriendo"
  en el sidebar y contador en la barra; al terminar, aviso. (4) Archivar = detener turno (`stopChatTurn`, grupo de
  procesos completo vía AUD.6) + archivar, nunca sin detener. (5) Cerrar la app o el dashboard con turnos vivos:
  aviso con la lista. (6) Al arrancar, turnos huérfanos (proceso muerto, turno `pending`) se marcan y se ofrecen
  reanudar. Verificación: test que archiva con turno en curso y comprueba que no queda proceso; test del diálogo
  por estado del tab; prueba en vivo en el dashboard de los tres caminos (ocioso, detener, dejar corriendo).
  Sin delegación: padre cerrado por sus hijos SES.1a–c, cada uno con su spec y evidencia.
  GO de Carlos 2026-11-13 al plan a/b/c, en este orden:

- [x] **SES.1a — Archivar detiene el turno vivo.**
  Archivar aborta el turno registrado (`stopActiveChatTurn`); `codex exec` (sin sesión y fallback por error de
  protocolo) ya recibe la señal y mata el grupo de procesos. Tests: chat-stop + aud22-processes + codex-engine 44/44
  dos veces. Revisión qa (Sol) halló el hermano de Codex. Ejecutado por: gpt-6-luna (mecanico)
  Fuera de scope declarado: `src/run/executors/codex.ts` y `src/__tests__/aud22-processes.test.ts` (hermano hallado por qa).

- [x] **SES.1b — X del tab con turno vivo: diálogo Detener y cerrar / Dejar corriendo / Cancelar.** Gate en vivo: navegador Playwright, `dev-tab-close-running` 10/10 (ocioso, cancelar, dejar corriendo, detener en 636 ms), `docs/done/evidence/SES.1b-live.json`.
  Ocioso cierra; con turno, diálogo con "no volver a preguntar" y ajuste en Settings (`closeRunningTab`). `POST /stop`
  sin `turnId` detiene el turno activo. El gate halló que el sidebar seguía en "Working" tras detener: el estado del
  agente ahora sale de `runningSessionIds` (servidor). Sin contador nuevo: spinner del sidebar y notificación ya
  cubren el punto 3.
  Ejecutado por: gpt-6-luna (mecanico) + gpt-6.1-sol (criterio, gate y fix del sidebar) · Spec: docs/specs/SES.1b.md
  Texto visible: "Stop this agent?", "It's still working. Keep it running and find it in the sidebar.", "Stop and close", "Keep running", "Closing a working agent's tab", "Ask", "Stop it" — una decisión con tres salidas necesita palabras; un ícono no distingue detener de dejar corriendo.
  Fuera de scope declarado: `scripts/ui-gate/flows/dev-tab-close-running.mjs` y `docs/done/evidence/SES.1b-live.json` (gate en vivo).

- [x] **SES.1c — Aviso al cerrar con turnos vivos y turnos huérfanos al arrancar.** Gate en vivo: navegador Playwright, `chat-restart-interrupted` 6/6 (turno real → SIGTERM → `interrupted` en 1.091 ms → aviso y Resume crean turno nuevo), `docs/done/evidence/SES.1c-live.json`.
  Ctrl+C del dashboard marca `interrupted` los turnos vivos y lista en la terminal cuáles detuvo; al arrancar,
  `reconcileChatTurns` marca los `pending` con lease vencido (owner es UUID, sin pid: tras un crash tardan ≤150 s).
  El texto del usuario se guarda en `chat_turns.user_content` (+ `has_attachments`); el composer ofrece Resume, o
  Restore message si había adjuntos; turnos históricos sin texto, solo aviso. Cerrar el navegador no avisa: el turno
  sigue en el servidor y no se pierde nada. Tests de procesos con esperas de 4 s (el pre-push de SES.1b falló por
  `process-tree.test.ts:27`, mismo defecto que SES.1a).
  Ejecutado por: gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, esperas) · Spec: docs/specs/SES.1c.md
  Texto visible: "The last turn was interrupted.", "Resume", "Restore message", "Attach the files again before sending." — el estado y la acción no se infieren de un ícono; Resume reenvía y Restore solo rellena.
  Fuera de scope declarado: `scripts/ui-gate/flows/chat-restart-interrupted.mjs`, `docs/done/evidence/SES.1c-live.json`, `src/run/process-tree.test.ts`, `src/__tests__/codex-task-approvals.test.ts` (gate en vivo y esperas que tumbaron el pre-push).
