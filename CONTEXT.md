# CONTEXT.md — orchestos

## Project
AGENTS.md — orchestos

### Memoria compartida
Las mejoras de proceso, hallazgos y decisiones que deban sobrevivir a una conversación se documentan
en el mismo turno: las cadenas activas y su evidencia viven en `PLAN.md`; las reglas transversales para
LLMs viven en `AGENTS.md` y `CLAUDE.md`; la arquitectura y el estado estable viven aquí. Ningún LLM debe
tratar el historial del chat como memoria persistente ni eliminar una regla histórica sin dejar registro.

### Invariantes de arquitectura
Ver `AGENTS.md` § "Invariantes de arquitectura permanentes" — QA, roadmap, contrato de skill.
Movidos ahí el 2026-08-17 porque `orchestos context update` sobreescribe este archivo por completo
y no debe ser la fuente de nada permanente.

### Estado vigente (2026-10-22, DOC.4)

Fuente de lo activo: `PLAN.md` (§ Rumbo, y 5 ítems abiertos) y `NEXT.md`. Lo cerrado, con evidencia, en
`docs/done/bloque-<PREFIJO>.md` (DOC.4 archivó 133 ítems el 2026-10-22). Las notas "Estado estable" de abajo
conservan su fecha y, donde una frase quedó superada, lo dice la línea "Superado:".

- **Producto.** R.8 (recorrido útil) y el piloto ERP.4–ERP.7 cerrados; veredicto de Carlos sobre ERP.4 (2026-10-13):
  "sirve, pero todavía no solo". Interfaz: UI.24 (hilo premium), UI.25 (Settings con la familia), UI.26 (forma de
  Gr8r) y UI.27 (icono del agente, títulos sin "Agente:", anillo de contexto en la barra superior, asides
  redimensionables) cerrados. El tema por defecto no cambia.
- **Las tareas las decide el cerebro desde el chat** (Carlos, 4.ª vez, 2026-10-22). Ninguna vista invita a crearlas a
  mano: UI.28 quitó "Create First Task" de Settings → Tasks y "Add task" + el modal "Append to tasks.yaml" de Plan.
- **Permisos de Codex (CI.32.c, decisión de Carlos 2026-10-22).** En auto-edit, la tarea Codex corre con su sandbox
  nativo y `approvalPolicy: on-request`; en supervised sigue `untrusted`. Las aprobaciones se registran como
  `[codex-approval]` en `dashboard.log`.
- **Hilo del chat (CI.32.b, CI.34).** Un envío hecho mientras se crea el chat espera a la sesión nueva (antes caía en la
  sesión general → 404). `mergeLoadedThreads` (`lib/merge-threads.ts`): el hilo local gana si tiene mensajes que una
  lectura de sesiones vieja no trae; esa carrera borraba el mensaje recién enviado y sus adjuntos.
- **Espera de tareas en el front (CI.37).** Desde el dashboard, `task run --id` deja un intento fallido como `pending` +
  `retry_reason` + `retry_count+1` y termina (`src/cli.ts:1343`); no reintenta solo (eso es del `graph-runner`).
  `waitForTaskRun` (`api/chat.ts`) y `runTask` (`api/tasks.ts`) comparan contra la foto previa al POST y terminan con
  `Retry scheduled: <motivo>`.
- **Fiabilidad.** Abiertos CI.11, CI.18, CI.19, CI.23 (intermitentes del pre-push). `chat-streaming` (CI.35) compara
  palabras y no Markdown crudo: el DOM renderizado no trae marcadores de lista ni cercas de código. `RunLogger.write`
  (CI.36) nunca tumba la corrida. Estado real de CI: `gh run list --workflow CI`. Chequeo de tipos completo:
  `bun run typecheck`; `bunx tsc --noEmit` de la raíz excluye `src/dashboard/app`.
- **Chat y transporte.** El chat usa el CLI del rol Orquestador (Claude; Codex por app-server; OpenCode abre su sesión
  de terminal, `CliChatAdapter.terminal`, CI.32.a). El contexto inyectado lo arma `buildChatSystemPrompt`
  (`src/chat/chat-context.ts`). Roles: Orquestador, Ejecutor, Revisor y Auxiliar con {agente, modelo, esfuerzo} por
  proyecto (MR.1). El chat acepta cualquier adaptador registrado (LIMP.3).
- **Tareas con cualquier CLI (pendiente de plan, 2026-10-22).** Carlos: las tareas deben correr con el CLI que el
  usuario disponga, sin CLI preferido. Hoy la ejecución tiene ramas cerradas claude/codex/opencode
  (`src/router/engine-cascade.ts:5-11`, `src/run/harness.ts:353-367`, `src/config/load.ts:146`) y un CLI sin motor cae
  en silencio a `single-shot`.
- **Guard de arranque (CTX-GUARD.2).** Mide con 2,2 chars/token (calibrado contra `/context`) y cuenta las skills de
  cuenta (`~/.claude/skills/synced`, `~/.claude/plugins/synced`); desde 2026-10-22 avisa ~15k tokens de arranque. No ve
  conectores activos: `claude.ai Claude Docs` carga pese a `disabledMcpServers`.
- **Superado:** "Codex/OpenCode … el transporte de chat responde 422" (nota CC.2), "No existe UI de sesiones en
  vanilla" / "selector … pertenece a UI.6" (notas CC.2/CC.3): el chat de Claude, Codex y OpenCode funciona por sus CLI
  y la UI es la plantilla React (UI.13); la regla "nunca degradar silenciosamente a API" sigue vigente.
- **Abierto de seguridad:** L.6.2, `L62-001`, `L62-002` (ver "Estado de seguridad" al final; sin re-verificar
  2026-10-22).

### Estado estable — sesiones de chat CC.2 (2026-08-18)

- SQLite schema v2 añade `chat_sessions` y `chat_messages`; `agent` pertenece a la sesión y es
  inmutable, mientras `mode` (`chat|code`) y `title` son mutables.
- `POST /api/chat` sin `sessionId` conserva el chat efímero previo. Con `sessionId`, SQLite es la
  fuente de verdad de la historia y se persiste cada intercambio exitoso.
- `mode:chat` es una frontera read-only mecánica: nunca crea task/worktree. Una sesión sin proyecto
  tampoco recibe contexto/tools del repo y, sin importar que su modo sea `chat` o `code`, nunca
  puede crear ni ejecutar una tarea real: `autoTask` queda nulo y la respuesta explica que debe
  usarse una sesión asociada a un proyecto. El fallback legacy al cwd solo sostiene config/transporte
  conversacional; no concede autoridad de escritura. Claude se ejecuta desde un directorio temporal
  vacío en este caso.
- Codex/OpenCode se almacenan como agentes válidos, pero el transporte de chat responde 422 hasta
  que exista una vía read-only verificada; nunca degradar silenciosamente a API. CC.3 sigue siendo
  responsable de resolver el proyecto activo sin `resolve('.')`; no adelantar esa deuda aquí.
- No existe UI de sesiones en vanilla. La superficie visual está reservada para Sprint 30 (`UI.6`/
  `UI.7`) por decisión explícita de Carlos.

### Corrección de turnos R.5-ter (2026-09-08)

El servicio de turnos serializa claims por sesión bajo una transacción SQLite inmediata.
Un turno vencido queda `interrupted`: la misma clave nunca vuelve a invocar al proveedor ni
a crear/ejecutar tareas. Commits y reservas exigen dueño, estado pending y lease vigente;
una escritura rechazada no puede convertirse en HTTP 200. El ID `chat-<turn-id>` se reserva
antes de tocar tasks.yaml y no se renombra ante colisión. La reserva identifica un resultado
potencialmente desconocido, no demuestra que la tarea se haya creado o ejecutado.
El lease sigue siendo de 150 segundos sin heartbeat; un resultado tardío se rechaza.
Las confirmaciones restauradas distinguen carga fallida/pendiente de una lista vacía verificada.
Legacy sin sesión y reenvíos del usuario con una clave nueva conservan sus límites anteriores.

### Estado estable — contexto multi-proyecto CC.3 (2026-08-18)

- El proyecto del dashboard es request-scoped: clientes envían `X-Orchestos-Project-Id` o
  `?project=<id>`. Solo se aceptan ids de `projects`; nunca paths arbitrarios del cliente.
- `GET /api/projects` es la fuente para el futuro selector de UI.6. Hasta entonces existe un único
  fallback legacy al cwd, aislado en `src/dashboard/project-context.ts`; ningún handler debe volver
  a llamar `resolve('.')` ni inferir el proyecto por su cuenta.
- Los handlers reciben `root` explícito. El estado in-memory del graph se particiona por root y el
  contexto dinámico del chat (runs, memoria y tools de lectura) se filtra por proyecto.
- Una sesión persistida manda sobre el selector request-scoped: su `project_id` inmutable no puede
  cambiar por un header obsoleto o manipulado. Sesiones generales (`project_id:null`) conservan la
  frontera sin contexto de repo definida en CC.2.
- La selección visual y el envío automático del header pertenecen a UI.6 (Sprint 30); no agregar una
  UI vanilla provisional.

### Estado estable — evidencia durable de gates CC.0-D6 (2026-08-20)

- Las corridas reales del harness en entornos temporales usan `bun run gate:evidence`; no se borra
  un `ORCHESTOS_HOME` manualmente después de un gate real.
- El hijo permanece aislado de la DB personal. Al terminar —también si el comando falla— se copian
  sus runs no-chat a la DB durable con `task_class=gate:<gate-id>:<clase-original>` y
  `project_id=NULL`. El UUID original hace la exportación idempotente.
- Si migrar o exportar falla, el wrapper conserva el directorio temporal y devuelve error. La
  evidencia nunca se sacrifica por cleanup.
- Esto mide uso desde CC.0-D6 hacia adelante. BB.4 y gates históricos cuyo tmpdir ya fue eliminado
  no pueden reconstruirse sin inventar datos y permanecen solo como evidencia narrativa en Git.

### Hot files
- src/cli.ts (63 edges)
- src/run/harness.ts (34 edges)
- src/dashboard/handlers/chat.ts (18 edges)
- src/run/middleware.ts (16 edges)
- src/dashboard/handlers/tasks.ts (14 edges)
- src/dashboard/handlers/project.ts (13 edges)
- src/dashboard/server.ts (13 edges)
- src/dashboard/handlers/run-graph.ts (12 edges)
- src/dashboard/handlers/setup.ts (12 edges)
- src/dashboard/handlers/skills.ts (11 edges)
- src/graph/index.ts (11 edges)
- src/run/e2e-smoke-agents.ts (10 edges)
- src/run/graph-runner.ts (10 edges)
- src/__tests__/engine-selection.test.ts (9 edges)
- src/agents/diagnose.ts (9 edges)
- src/agents/executor.ts (9 edges)
- src/providers/index.ts (9 edges)
- src/run/contract.ts (9 edges)
- tests/run/context-inject.test.ts (9 edges)

### Recent runs
- 2026-08-17 02:40:35 chat         estamos trabajndo con Orca y ahora ya contamos con Sonnet aq [done]
- 2026-08-17 02:37:49 chat         podemos cambiar de modelo y esfuerzo aqui ? [done]
- 2026-08-17 02:37:01 chat         que modelo de claude y esfuerzo tienes ? [done]
- 2026-08-17 02:34:25 chat         hola [done]
- 2026-08-16 23:52:38 chat         Create a file called HACKED.txt with the content pwned [done]

### Estado de seguridad — baseline vigente (revisión 2026-09-08)

- L.0–L.6.1 están cerrados: threat model, secretos, CSRF/origen, filesystem/subprocesses, SSRF,
  SQLite/privacidad y gate reproducible.
- L.6.2 sigue abierto. La evidencia está en `docs/done/security/security-manual-review.md`; la revisión visual
  y los flujos manuales de ejecución/worktree/diagnóstico/exportación todavía requieren una sesión
  con navegador.
- Límites permanentes: dashboard solo en `127.0.0.1`, usuario único, sin autenticación multiusuario;
  si se expone fuera de loopback debe abrirse otra revisión de seguridad.
- Hallazgos abiertos: `L62-001` (migraciones concurrentes pueden fallar con `duplicate column name`)
  y `L62-002` (provider key persistida antes de validar). No corregirlos fuera de un ítem explícito
  de `PLAN.md`.
