# IDEAS.md — OrchestOS

Sumidero de impulsos fuera de scope del Mes actual.
Cada vez que aparezca la tentación de agregar algo de la lista prohibida, va acá.
No se implementa hasta que el mes correspondiente esté cerrado y haya evidencia de necesidad real.

---

## Lista prohibida (Mes 1 y Mes 2 — ya cerrados)
- Graph DB (Graphiti / Neo4j) — ver "Code Graph" abajo, candidato Mes 3
- Restate / Temporal — overkill para single-user CLI
- Rust / napi-rs — no hay bottleneck demostrado
- Dashboard web — después del CLI
- Marketplace de skills — después de 10 skills en uso real
- Multi-agente con git worktrees — Mes 3+
- Paralelismo real de tareas — Mes 3+

---

## Ideas registradas

### [MES 3 — CANDIDATO PRIORITARIO] Code Graph — contexto estructural del repo

**Problema**: AGENTS.md le dice al LLM "usa Next.js + Prisma". Eso es casi inútil para
decidir qué archivos son relevantes para una tarea concreta.

**Propuesta**: tabla SQLite `code_edges(from_file, to_file, edge_type, symbol)`
construida con `tree-sitter` al hacer `orchestos init`.

```sql
-- edge_type: 'import' | 'calls' | 'extends' | 'uses'
SELECT to_file FROM code_edges WHERE from_file = 'src/components/Button.tsx'
```

**Qué resuelve**:
1. Auto-populate `input[]` en tasks.yaml — qué archivos necesita leer la tarea
2. Impact analysis antes de ejecutar — "modificar lib/db.ts afecta 12 archivos"
3. Contexto comprimido al LLM — subgrafo relevante en vez de archivos completos

**Cuándo escalar a graph DB real**: cuando el repo tenga 10K+ nodos y las queries
SQLite se vuelvan lentas. Candidato entonces: **KuzuDB** (embebible, sin servidor,
Cypher queries, escrito en Rust). No antes.

Refs: inspirado en la idea del propio usuario. Validar contra tree-sitter parsers
para TS/JS/Python antes de implementar.

---

### [MES 3 — CANDIDATO] Extracción de harness (`src/run/harness.ts`)

**Problema**: `executeTask` son ~250 líneas dentro de cli.ts. A medida que crecen
retry policies, QA modes, sandbox options → se vuelve inmanejable.

**Propuesta**: extraer a `src/run/harness.ts` con interfaz limpia:
```ts
runTask(task: Task, opts: HarnessOpts): Promise<TaskResult>
```
cli.ts solo orquesta, harness ejecuta.

**Referencia**: deer-flow (bytedance) hace esto bien — separa orchestrator de runner.
No necesitamos su complejidad (multi-agente, containers), solo la separación.

---

### [MES 3 — CANDIDATO] `acceptance_criteria[]` en tasks.yaml (spec-driven QA)

**Problema**: el QA actual evalúa en texto libre ("¿esto se ve bien?"). Falsos
pass/fail son frecuentes porque el criterio es ambiguo.

**Propuesta**: campo opcional en Task:
```yaml
- id: add-button
  description: "Create a Button component"
  acceptance_criteria:
    - "File exports a React component named Button"
    - "Component accepts props: label (string), onClick (function), disabled (boolean)"
    - "No TypeScript errors (no 'any' types)"
```

El prompt de QA cambia de "¿parece razonable?" a "¿se cumplen estos criterios exactos?".

**Referencia**: spec-kit (github/spec-kit) — Spec-Driven Development. Su flujo completo
(constitución → spec → clarificar → plan → validar → tareas → ejecutar) es el roadmap
natural de orchestos hacia Mes 4-5.

---

### [MES 3 — CANDIDATO] Skills ecosystem — 20+ skills reales

**Problema**: orchestos tiene el sistema de skills bien diseñado pero solo 3 skills
de ejemplo. El valor real viene del contenido.

**Propuesta**: portar las skills más útiles de mattpocock/skills al formato YAML:
- `tdd` — enforce red-green-refactor antes de implementar
- `diagnose` — debugging estructurado (hipótesis → verificar → siguiente)
- `improve-architecture` — identificar módulos con demasiadas responsabilidades
- `pre-task-alignment` — antes de ejecutar, verificar que la descripción es inequívoca
- `context-compression` — generar CONTEXT.md con jargon del proyecto (reduce tokens)

Ref: ECC (affaan-m/ECC) tiene 246 skills construidas en 10 meses de uso real.
No copiar — entender qué problemas resuelven y escribir las propias.

---

### [MES 4+] CONTEXT.md — jargon comprimido del proyecto

Idea de mattpocock/skills: en vez de mandar AGENTS.md completo en cada prompt,
mantener un `CONTEXT.md` con el vocabulario específico del proyecto
(nombres de módulos, convenciones propias, abreviaciones del equipo).
Reduce tokens y mejora consistencia entre runs.

Integración con orchestos: `orchestos context compress` → genera CONTEXT.md a partir
de AGENTS.md + runs history + código existente.

---

### [MES 4+] Sandbox por tarea (git worktree o tmp dir)

Cada tarea corre en un worktree aislado. Si QA falla, el worktree se descarta sin
tocar el árbol principal. Elimina la necesidad de `restoreContents`.

Prerequisito: harness separado (ver arriba).
Ref: deer-flow usa containers. Para orchestos alcanza con git worktrees.

---

### [MES 5+] Sub-agentes con contextos aislados

Una tarea "plan" genera sub-tareas. Cada sub-tarea tiene su propio contexto,
su propio contrato de archivos, su propio QA stage.

Prerequisito: harness separado + scheduler robusto + worktrees.
Ref: deer-flow architecture — el orquestador genera sub-agentes con contextos aislados.

---

---

### [PILAR CENTRAL — MES 3+] Two-tier LLM execution — planner fuerte + executor adaptativo

**Problema**: un modelo fuerte (Opus, Sonnet) tiene criterio para diseñar interfaces y
tomar decisiones arquitectónicas, pero es caro para tareas mecánicas. Un modelo ligero
(Haiku, Codex, GPT-4o-mini) puede ejecutar tareas específicas si el camino está bien
documentado. No todos los usuarios tienen acceso a un modelo fuerte.

**Idea central**:
- **Modelo fuerte** (Opus / Sonnet / lo mejor disponible) → genera PLAN.md con interfaces
  TypeScript, schemas SQL y decisiones sin ambigüedad. Deja el camino tan claro que
  cualquier LLM pueda ejecutar los sub-pasos sin necesitar criterio adicional.
- **Modelo de ejecución** (Codex, Haiku, modelo default del usuario) → lee PLAN.md,
  ejecuta los sub-pasos marcados como ⚡, reporta resultado.
- **Adaptativo**: si el usuario no tiene un modelo fuerte, orchestos usa el modelo
  configurado en `~/.orchestos/.env` para todo. La calidad del plan baja; la ejecución
  sigue funcionando.

**Convención en PLAN.md**:
- `⚡` al inicio del sub-paso = cualquier LLM puede ejecutarlo leyendo el plan
- `🧠` al inicio del sub-paso = requiere criterio arquitectónico (Claude Sonnet/Opus)

**Regla de escritura del plan**: si un sub-paso requiere más de 10 segundos de
razonamiento para entender qué hacer, está mal escrito. Agregar: interfaz exacta,
nombre de archivo, comportamiento esperado ante error.

**Implicación futura en tasks.yaml**:
```yaml
- id: add-button-component
  description: "Create Button component"
  planner_model: claude-opus-4-7       # genera el plan detallado
  executor_model: claude-haiku-4-5     # ejecuta el plan
  # Si solo hay un modelo disponible, ambos campos lo usan
```

Esto no va a Mes 3 en tasks.yaml (hay que validar el harness primero), pero el
patrón ⚡/🧠 en PLAN.md implementa la misma idea de forma manual desde ya.

Ref: patrón observado en deer-flow (planner-agent vs executor-agent), spec-kit
(clarify before execute), y en el workflow real de este proyecto (Opus diseña,
Codex ejecuta sub-pasos simples).

---

### [MES 4+] Spec-Driven flow completo (spec-kit)

El flujo completo de spec-kit: `constitución → spec → clarificar → plan → validar → tareas → ejecutar`.

En Mes 3 solo está el eslabón `validar` (`acceptance_criteria[]`).
Los eslabones que faltan para Mes 4:
- **Constitución**: qué puede/no puede modificar el agente en este proyecto (`CONSTITUTION.md`)
- **Spec**: descripción inequívoca de la tarea antes de empezar. `orchestos spec <id>` genera
  un documento de especificación que el usuario aprueba antes de que el harness ejecute.
- **Clarificar**: si la descripción tiene ambigüedad, el harness pregunta antes de gastar tokens.

Prerequisito: harness limpio (S9) + acceptance_criteria (S10).

---

## Feedback usuario 1
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_

## Feedback Mes 3
_(se llena al cerrar Mes 3)
