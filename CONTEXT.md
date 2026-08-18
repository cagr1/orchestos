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

### Estado estable — sesiones de chat CC.2 (2026-08-18)

- SQLite schema v2 añade `chat_sessions` y `chat_messages`; `agent` pertenece a la sesión y es
  inmutable, mientras `mode` (`chat|code`) y `title` son mutables.
- `POST /api/chat` sin `sessionId` conserva el chat efímero previo. Con `sessionId`, SQLite es la
  fuente de verdad de la historia y se persiste cada intercambio exitoso.
- `mode:chat` es una frontera read-only mecánica: nunca crea task/worktree. Una sesión sin proyecto
  tampoco recibe contexto/tools del repo; Claude se ejecuta desde un directorio temporal vacío.
- Codex/OpenCode se almacenan como agentes válidos, pero el transporte de chat responde 422 hasta
  que exista una vía read-only verificada; nunca degradar silenciosamente a API. CC.3 sigue siendo
  responsable de resolver el proyecto activo sin `resolve('.')`; no adelantar esa deuda aquí.
- No existe UI de sesiones en vanilla. La superficie visual está reservada para Mes 30 (`UI.6`/
  `UI.7`) por decisión explícita de Carlos.

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

### Estado de seguridad — Mes 23 (2026-07-29)

- L.0–L.6.1 están cerrados: threat model, secretos, CSRF/origen, filesystem/subprocesses, SSRF,
  SQLite/privacidad y gate reproducible.
- L.6.2 está en avance, no cerrado. La evidencia está en
  `docs/security-manual-review.md`; la revisión visual requiere una sesión con navegador.
- Límites permanentes: dashboard solo en `127.0.0.1`, usuario único, sin autenticación multiusuario;
  si se expone fuera de loopback debe abrirse otra revisión de seguridad.
- Hallazgos abiertos: `L62-001` (migraciones concurrentes pueden fallar con `duplicate column name`)
  y `L62-002` (provider key persistida antes de validar). No corregirlos fuera de un ítem explícito
  de `PLAN.md`.
