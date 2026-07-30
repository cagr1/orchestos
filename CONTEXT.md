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

### Invariante roadmap (Bloque M, Mes 24)
`docs/roadmaps/` (universal → disciplina → lenguaje → project-profile) nunca marca `verified` sin
un comando real ejecutado y su salida citada; sin evidencia, el estado correcto es `known`
(conocimiento general) o `missing` (se buscó y no está) — nunca un `pass` implícito. `orchestos
roadmap check` es determinista y evidence-based: cero heurísticas que inventen `detected` sin una
señal real de filesystem/código. Gate M.5 (2026-07-29) probó el flujo completo contra 3 fixtures
(OrchestOS, `tests/fixtures/roadmap-onboarding/{rust-hello,go-hello}`) y confirmó dos límites
reales, no bugs a esconder: (1) no existe todavía un mecanismo que provisione `docs/roadmaps/`
dentro de un proyecto NUEVO que OrchestOS empiece a manejar — `orchestos init` no lo hace; los
fixtures del gate se armaron copiando manualmente los docs relevantes. (2) el presupuesto de
contexto de `loadRoadmapContext` (12k chars) ya no alcanza para las 6 disciplinas + lenguajes de
OrchestOS mismo — se recorta con `missing` visible, nunca en silencio, pero el recorte es real.
Ninguno de los dos se resuelve automáticamente; quedan como decisión pendiente de Carlos antes de
ampliarse a proyectos externos reales.

### Invariante contrato de skill (2026-07-30)
Un campo del YAML de una skill (`skills/*.yaml`) solo llega al LLM si está en los tres puntos:
`SkillDef` y `validateSkill()` (`src/skills/registry.ts`) y **`buildSections()`**
(`src/skills/targets/_shared.ts`) — este último es el ÚNICO renderer skill→prompt y lo comparten los
tres targets (`claude`/`cursor`/`openai`). `validateSkill()` **no rechaza campos desconocidos**: un
campo mal cableado carga sin error y se descarta en silencio, así que el modo de fallo es contenido
muerto, no una excepción. Si la skill además se crea o importa por el dashboard, el contrato descrito
al LLM curador (`src/dashboard/prompts/curator.ts`) debe incluirlo o toda skill importada nacerá sin
ese campo. El orden de las secciones dentro de `buildSections()` es parte del contrato, no un
detalle: es el orden en que el modelo lee la skill.

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
