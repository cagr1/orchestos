# IDEAS.md — OrchestOS

Sumidero de ideas fuera de scope del mes activo.
Lo que ya se implementó → ver [DONE.md](DONE.md) Sección 2.
No se implementa nada de aquí hasta que el mes correspondiente esté cerrado.

---

## 🔄 EN PROGRESO — Mes 3 activo

### Skills ecosystem con estructura real (S14)
Schema extendido: `when_to_use`, `verifiers`, `anti_patterns`, `examples`.
5 skills a escribir: `pre-task-alignment`, `diagnose`, `tdd-enforcer`,
`context-compression`, `improve-architecture`.
Ver PLAN.md → SEMANA 14.

---

## 💡 Pendiente — Mes 4

### Language-aware skills

**Problema**: el detector de lenguaje ya existe (`src/detect/languages.ts`) pero las skills
lo ignoran. Una skill `tdd-enforcer` escrita para TypeScript le dice al LLM "corre `npm test`"
— inútil en un proyecto .NET. Cisepro.Web lo demostró: 0 files indexados = v0 solo cubre TS/JS/Python.

**Propuesta**: campo `language_targets` en el schema de skill:
```yaml
id: tdd-enforcer
language_targets:
  typescript:
    verifiers: ["npm test", "bun test"]
    anti_patterns: ["skip describe blocks", "use any to bypass types"]
  csharp:
    verifiers: ["dotnet test"]
    anti_patterns: ["[Ignore] attribute without reason"]
  python:
    verifiers: ["pytest", "python -m unittest"]
    anti_patterns: ["pass in test body"]
  default:
    verifiers: ["run your test suite"]
    anti_patterns: ["empty test body"]
```
El compiler inyecta solo la sección del lenguaje detectado.

**Prerequisito**: S14 (skills schema extendido).

---

### Model roles config — cerebro + ejecutor pesado + ejecutor ligero

**Problema**: el usuario quiere elegir al inicio del proyecto qué modelo actúa como
cerebro (planner) y qué modelos ejecutan tareas pesadas vs ligeras.

```yaml
# orchestos.config.yaml
models:
  planner:        claude-opus-4-7
  executor_heavy: codex
  executor_light: deepseek-v3
  default:        openrouter/deepseek
```

Mapping automático con `classifyTask` que ya existe:
- `plan` → planner
- `fix` / `refactor` → executor_heavy
- `generate` / `edit` → executor_light
- Sin config → default para todo

**Por qué es distinto**: nadie hace routing por **complejidad de tarea** mapeada a un
clasificador existente. LangChain/CrewAI asignan por rol semántico, no por complejidad.

**Prerequisito**: S11 ✅ (executor por tarea) + `orchestos init` que lea `orchestos.config.yaml`.

---

### Skills de ciclo de vida — security-review, qa-structured, test-writer

**`security-review`**
- Antes de mergear código que toca auth, inputs del usuario, queries SQL.
- `anti_patterns`: hardcoded secrets, SQL string concatenation, eval() en user input, sin validación de inputs.
- Inspirado en OWASP Top 10 — solo los errores más comunes.

**`qa-structured`**
- Guía al LLM en *cómo* evaluar después de implementar, antes de marcar done.
- Diferencia vs `acceptance_criteria[]`: esa define *qué* evaluar; esta define *cómo*.
- `anti_patterns`: test solo el happy path, ignorar error handling, hacer QA del propio output sin distancia.

**`test-writer`**
- Para agregar tests a código existente (distinto de `tdd-enforcer` que va antes de implementar).
- `when_to_use`: "When adding tests to existing code", "When coverage is below threshold".

**Prerequisito**: S14 (skills schema extendido).

---

## 💡 Pendiente — Mes 4+

### Multi-lenguaje en Code Graph

**Problema**: Code Graph v0 con regex solo cubre TS/JS/Python. Cisepro.Web (.NET/C#) = 0 files.

**Por lenguaje**:
- **C# / .NET**: regex `using\s+([\w.]+)` + `namespace\s+([\w.]+)`
- **Java**: regex `import\s+([\w.]+)`
- **Go**: regex `"([\w/.-]+)"` dentro de bloques `import(...)`

Cuando el grafo llegue a 10K+ nodos → migrar a **KuzuDB** (embebible, Cypher, Rust). No antes.

**Prerequisito**: language-aware skills funcionando (define qué lenguajes son prioritarios).

---

### CONTEXT.md — vocabulario comprimido del proyecto

En vez de mandar AGENTS.md completo en cada prompt, mantener un `CONTEXT.md` con
el vocabulario específico: nombres de módulos, convenciones, abreviaciones del equipo.
Reduce tokens y mejora consistencia entre runs.

`orchestos context compress` → genera CONTEXT.md a partir de AGENTS.md + runs history + código.

---

### Sandbox por tarea (git worktree)

Cada tarea corre en un worktree aislado. Si QA falla, el worktree se descarta.
Elimina la necesidad de `restoreContents`.

Prerequisito: harness separado ✅

---

## 💡 Pendiente — Mes 5+

### Spec-Driven flow completo (spec-kit)

`constitución → spec → clarificar → plan → validar → tareas → ejecutar`

En Mes 3 está `validar` (`acceptance_criteria[]` ✅).
Falta para Mes 4:
- **Constitución**: `CONSTITUTION.md` — qué puede/no puede modificar el agente
- **Spec**: `orchestos spec <id>` — descripción aprobada antes de ejecutar
- **Clarificar**: si hay ambigüedad, el harness pregunta antes de gastar tokens

Prerequisito: harness ✅ + acceptance_criteria ✅.

---

### Sub-agentes con contextos aislados

Una tarea "plan" genera sub-tareas. Cada sub-tarea tiene su propio contexto y QA stage.
Prerequisito: harness ✅ + scheduler robusto + worktrees.

---

## Feedback usuario 1
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_

## Feedback Mes 3
_(se llena al cerrar Mes 3)_
