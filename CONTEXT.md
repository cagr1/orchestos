# CONTEXT.md — orchestos

## Project
AGENTS.md — orchestos

### Memoria compartida
Las mejoras de proceso, hallazgos y decisiones que deban sobrevivir a una conversación se documentan
en el mismo turno: las cadenas activas y su evidencia viven en `PLAN.md`; las reglas transversales para
LLMs viven en `AGENTS.md` y `CLAUDE.md`; la arquitectura y el estado estable viven aquí. Ningún LLM debe
tratar el historial del chat como memoria persistente ni eliminar una regla histórica sin dejar registro.

### Invariante QA
Cuando una tarea tiene criterios de aceptación, `runQA` solo puede devolver `pass` si la respuesta del
proveedor contiene exactamente un resultado por criterio y cada criterio aprobado tiene evidencia literal
real en el archivo indicado. Una respuesta incompleta, malformada o con cardinalidad incorrecta debe
fallar de forma segura; una respuesta JSON que no sea un objeto también debe fallar de forma segura. No
se debe relajar esta regla para mejorar el mutation score.

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
- 2026-07-10 00:36:35 plan         Build a premium cryptocurrency market dashboard as a real Re [failed]
- 2026-07-09 22:37:40 chat         por ejemplo si vez en la tareas fallidas por que paso eso ? [done]
- 2026-07-09 22:37:11 chat         algo pasa con tus repsuesta [done]
- 2026-07-09 22:11:01 chat         realiza una pagina web sobre criptomoneda con gráficos 3D o  [done]
- 2026-07-09 21:23:08 chat         realiza una pagina web sobre criptomoneda con gráficos 3D o  [done]
