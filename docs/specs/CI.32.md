# CI.32 — Cinco ui-gates en vivo rotos en master

Contexto: `bun run ui:gate <flujo>` levanta el dashboard real y maneja Playwright. Los 5 flujos fallan de forma
determinista en `master` (`93b32d72`). Correr siempre con
`bun run gate:evidence -- --label CI.32.<x>-live -- bun run ui:gate <flujos>` (fuera del sandbox: los gates dan
`listen EPERM` dentro). Cada flujo deja `dashboard.log`, `result.json` y capturas en `$TMPDIR/ui-gate-<pid>/`.

Regla común: el arreglo va en el producto, no en el flujo, salvo que se demuestre que el flujo afirma algo que el
producto ya no debe hacer (decirlo explícitamente en el reporte). No tocar el árbol `../orchestos-ui27`. No
commitear ni editar `PLAN.md`/`NEXT.md`.

## CI.32.a — OpenCode: no se puede crear su sesión

- Síntoma: `opencode-terminal` → `POST /api/chat/sessions {agent:'opencode', mode:'code'}` → 400 `chat no soportado`.
- Causa: `src/dashboard/handlers/chat-sessions.ts:265-270` (AT.11, `c6014ede`) exige `cliChatAdapterFor(agent)?.chat`
  para crear cualquier sesión. OpenCode es una ventana libre / terminal, no un chat (decisión de producto: no forzarlo a
  chat). Antes de AT.11 se aceptaba todo CLI conocido (`AGENTS.has`).
- Arreglo: aceptar la creación de la sesión para agentes registrados que no tienen chat pero sí sesión de terminal
  (OpenCode), sin habilitar `POST /api/chat` para ellos (el rechazo de `chat.ts:889-890` se queda). Mirar en
  `src/run/executors/chat-adapters.ts` cómo se marca OpenCode y si existe ya una capacidad "terminal"; si no existe,
  derivarla del registro (no meter un `if agent === 'opencode'`). Un agente desconocido sigue dando 400.
- Tests: ajustar/añadir en `src/dashboard/__tests__/chat-adapters.test.ts` (hoy afirma el 400 para el caso sin chat:
  distinguir "sin chat pero con terminal" de "desconocido/no soportado").
- Verifica: `ui:gate opencode-terminal` verde + `bun run test:coverage` verde.

## CI.32.b — `/api/chat` responde `Project not found`

- Síntoma: `chat-followup-task` y `chat-task-undo`: proyecto temporal creado con `orchestos init`, aparece en la
  barra de Dev, clic en él, clic en `Chat`, `startChat(page,'Codex')`, enviar mensaje → `/api/chat` 404
  `{"error":"Project not found"}`.
- Diagnóstico pendiente: qué `projectId` (cabecera `x-orchestos-project-id` o cuerpo) manda el frontend en ese
  `POST /api/chat`, y si es el del proyecto elegido. Candidatos por fecha: UI.27/.1/.2 (`1c852ab7`, `fcd20c17`,
  `c8a38542`, merge `263b3bdf`), LIMP.3 (`908127a8`), AT.11 (`c6014ede`/`214937b5`), WT.1 (`7927bb07`). Usar
  `git bisect` con el flujo como prueba si el diagnóstico estático no basta (en un worktree temporal bajo `$TMPDIR`,
  borrarlo al acabar).
- Verifica: `ui:gate chat-followup-task chat-task-undo` verde + `test:coverage` verde + test unitario que fije la causa.

## CI.32.c — Tarea Codex retenida por una aprobación que no debería pedirse

- Síntoma: `auto-flow`, tarea Codex en `auto-edit` "Crea codex-nota.md en la raíz…": tras `Approve & Run` arranca,
  luego `status=running`, `pendingApprovals=1` durante 10 min. El fixture se borra al acabar el flujo y el harness
  revienta en `src/run/logger.ts:49` (ENOENT) — consecuencia, no causa.
- Fase 1 (evidencia): que cada petición de aprobación de Codex deje en stderr (→ `dashboard.log`) una línea
  `[codex-approval] {method, itemFound, kind, files, withinProject, readOnly, decision}` desde
  `src/run/executors/codex-app-server.ts` (~:147-170). Correr `ui:gate auto-flow` y leer esa línea.
- Fase 2 (causa y arreglo) según lo que diga la línea. Hipótesis a confirmar o refutar: la petición
  `item/fileChange/requestApproval` llega antes de que `item/started` guarde el item (`:260`), así que
  `codexApprovalRequest` ve `item === undefined` → `changes=[]` → `withinProject=false` (`codex-approval.ts:28-44`) →
  `auto-edit` no la autoaprueba (`approvals.ts:50`). Si es eso: usar los `changes` que traiga la propia petición
  o esperar/correlacionar el item, sin abrir la puerta a rutas fuera del proyecto. Si es un comando (`printf > …`),
  decirlo con el payload: auto-edit debe retener comandos de escritura, y entonces el problema está en el flujo o en el
  prompt del ejecutor.
- Verifica: `ui:gate auto-flow` verde + `test:coverage` verde + test unitario con el orden de eventos real.

## CI.32.d — `chat-retry-report`

- Tras CI.32.c, correr `ui:gate chat-retry-report`. Si sigue en `running` con `retryCount=0`, diagnosticar con su
  `dashboard.log` (líneas `[codex-approval]` y `[task]`).
