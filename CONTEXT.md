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

### Estado vigente (2026-10-14, DOC.1)

Fuente de lo activo: `PLAN.md` (§ Rumbo) y `NEXT.md`. Lo cerrado, con evidencia, en `docs/done/`. Este resumen
registra el estado del producto al 2026-10-14; las notas "Estado estable" de abajo conservan su fecha y donde una
frase quedó superada lo dice la línea "Superado:".

- **Recorrido útil (R.8).** R.8.1–R.8.6 cerrados 2026-10-05/12: auto-flow estricto, continuidad historial→CLI
  (`b9decaa`), QA negativo, reinicio a mitad de run, privacidad sin depender del modelo (`read-boundary`), pasos que
  no pueden fallar. R.8 sigue abierto solo por la contrastación con una tarea real de Carlos, que cubre ERP.4.
- **Piloto ERP.4 (repo `~/Projects/projects/erp-piloto`).** Corrió completo el 2026-10-13 (etapas 1-6, 25 tests en
  verde, revisión `qa` sin defectos). Veredicto de Carlos: "sirve, pero todavía no solo". Hallazgos arreglados:
  ERP.4.1–ERP.4.13 (p. ej. `b0ce9e4` primera tarea sin `tasks.yaml`, `867627d` respuesta del ejecutor en el run
  fallido, `e6efa62` borrador lee el hilo, `c476e68` ejecutor según el rol, `043770c` estado de `tasks.yaml`
  commiteado, `8ca4801` árbol sucio → `pending` + "Commit & Run"). Abiertos: ERP.4.14 (dentro de UI.24.6), 4.15, 4.16.
- **Interfaz.** UI.24 (hilo premium, familia Fluid Functionalism): 24.1–24.3 cerrados (`6c17cce`, `2627ac9`,
  `c4dfd5f`); faltan 24.4–24.7. UI.25 (Settings con la familia): cerrado, UI.25.2–25.4 absorbidos por UI.26
  (`f3648db`, `a4ccf9d`). UI.26 (la forma de Gr8r): 26.1–26.4a cerrados (`2474c20`, `dd9cbce`, `03b9cf3`, `e85f527`,
  `a9d5736`); faltan 26.5–26.7. El tema por defecto no cambia.
- **Fiabilidad de CI.** CI.12 cerrado (`844f3b3`: el candado de `tasks.yaml` se publica atómico con su token) y CI.24
  (`dff365d`: el historial del chat se presenta como la conversación propia). Abiertos: CI.11, CI.18, CI.19, CI.23
  (fase 1 hecha, `9a82ee8`), CI.25. Estado real de CI: `gh run list --workflow CI`.
- **Chat y transporte.** El chat usa el CLI del rol Orquestador (Claude, Codex por app-server, OpenCode en terminal
  de Dev); el contexto que se inyecta lo arma `buildChatSystemPrompt` (`src/chat/chat-context.ts`, MR.1.d2
  `3b8c9b2`). Roles: Orquestador, Ejecutor, Revisor y Auxiliar con {agente, modelo, esfuerzo} por proyecto (MR.1).
  El selector de proyecto y las sesiones tienen UI en React (UI.13).
- **Superado:** "Codex/OpenCode … el transporte de chat responde 422" (nota CC.2) y "No existe UI de sesiones en
  vanilla" / "selector … pertenece a UI.6" (notas CC.2/CC.3): el chat de Codex y Claude funciona por sus CLI y la UI
  es la plantilla React; la regla "nunca degradar silenciosamente a API" sigue vigente.
- **Abierto de seguridad:** L.6.2, `L62-001`, `L62-002` (ver "Estado de seguridad" al final).

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
- src/agents/planner.ts (13 edges)
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
- L.6.2 sigue abierto. La evidencia está en `docs/security-manual-review.md`; la revisión visual
  y los flujos manuales de ejecución/worktree/diagnóstico/exportación todavía requieren una sesión
  con navegador.
- Límites permanentes: dashboard solo en `127.0.0.1`, usuario único, sin autenticación multiusuario;
  si se expone fuera de loopback debe abrirse otra revisión de seguridad.
- Hallazgos abiertos: `L62-001` (migraciones concurrentes pueden fallar con `duplicate column name`)
  y `L62-002` (provider key persistida antes de validar). No corregirlos fuera de un ítem explícito
  de `PLAN.md`.
