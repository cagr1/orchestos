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

## Feedback usuario 1
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_
