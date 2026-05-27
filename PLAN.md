---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-3-en-curso
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**: ⚡ = cualquier LLM ejecuta leyendo este plan | 🧠 = requiere criterio Claude/Opus.

---

## MES 3 — Estado actual

S9 ✅ S10 ✅ S11 ✅ S12 ✅ S13 ✅ — **S14 pendiente**

### Validaciones manuales pendientes (no bloqueantes para S14)

Estas requieren API key activa o usuario externo. No bloquean S14:
- ⚠️ `orchestos task run --all` en qa-test-project con API key real (S9.6)
- ⚠️ Tarea con `checks: ["bun run typecheck"]` + output roto → retry sin tokens QA (S10.7)
- ⚠️ Tarea con `executor: anthropic` → `runs --detail` muestra `provider: anthropic` (S11.8)
- ⚠️ Full API end-to-end: executor + checks + acceptance_criteria → done, evidencia en runs --detail (S13.6)
- ⚠️ Usuario externo corre el flujo y deja feedback en `IDEAS.md ## Feedback Mes 3` (métrica Mes 3)

---

### SEMANA 14 — Skills con estructura real

Objetivo medible: `orchestos skill list` muestra 5 skills con `when_to_use`, `verifiers`, `anti_patterns`.
Al compilar con `--target claude`, cada skill genera un SKILL.md que un LLM puede seguir como política.

#### Delegación S14

| Sub-paso | Actor | Por qué |
|----------|-------|---------|
| S14.1 | ⚡ Codex | Extender schema YAML — interfaz TypeScript definida abajo |
| S14.2 | ⚡ Codex | Actualizar validateSkill — reglas explícitas, sin criterio nuevo |
| S14.3 | ⚡ Codex | Actualizar compiler targets — formato definido abajo |
| S14.4–S14.8 | 🧠 Claude | Escribir contenido de las 5 skills — criterio de producto |
| S14.9 | 🧠 Claude | Validación — juicio sobre si las skills son usables |
| S14.10 | ⚡ Codex | Commit |

---

- [ ] **S14.1** ⚡ Extender schema YAML de skill en `src/skills/registry.ts`:
  ```ts
  interface Skill {
    // campos existentes: id, version, name, description, targets, instructions
    when_to_use?: string[]       // "When TypeScript errors block build"
    inputs_required?: string[]   // "tsc output", "file with errors"
    verifiers?: string[]         // "bun run typecheck" — correr después de aplicar
    anti_patterns?: string[]     // "Do not silence errors with any"
    examples?: SkillExample[]
  }
  interface SkillExample {
    title: string
    input: string
    output: string
  }
  ```

- [ ] **S14.2** ⚡ Actualizar `validateSkill`: permitir (no requerir) los campos nuevos.
  Skills existentes sin ellos siguen siendo válidas — retrocompatibilidad total.

- [ ] **S14.3** ⚡ Actualizar compiler targets (`src/skills/targets/claude.ts`, `cursor.ts`, `openai.ts`).
  Solo incluir secciones si el campo está presente. Formato para claude.ts:
  ```markdown
  ## When to use
  - When TypeScript errors block build

  ## Anti-patterns
  - Do not silence errors with `any`

  ## Verifiers
  Run after applying: `bun run typecheck`

  ## Examples
  ### Fix null pointer
  **Input:** `Cannot read properties of undefined (reading 'id')`
  **Output:** `const id = user?.id ?? throwError('user.id required')`
  ```

- [ ] **S14.4** 🧠 Skill: `pre-task-alignment`
  Antes de ejecutar cualquier tarea, verificar que la descripción es inequívoca.
  Si hay ambigüedad → devuelve preguntas, no código.
  `when_to_use`: ["Before any implementation task", "When description has multiple interpretations"]
  `anti_patterns`: ["Assume what the user meant", "Start coding before clarifying scope"]
  `verifiers`: ["Task description has been confirmed by user"]
  Inspirado en spec-kit clarify phase.

- [ ] **S14.5** 🧠 Skill: `diagnose`
  Debugging estructurado: hipótesis → verificar → siguiente hipótesis.
  `when_to_use`: ["When a bug is reported", "When tests fail without obvious cause"]
  `anti_patterns`: ["Write code before reproducing the error", "Fix symptoms not causes", "Skip hypothesis step"]
  `verifiers`: ["Bug is reproducible", "Root cause identified before fix written"]

- [ ] **S14.6** 🧠 Skill: `tdd-enforcer`
  Red-green-refactor. Test primero, implementación después.
  `when_to_use`: ["When adding a new function or class", "When fixing a bug (write test that reproduces it first)"]
  `anti_patterns`: ["Implement before writing the test", "Write tests after the fact to hit coverage", "Test implementation details not behavior"]
  `verifiers`: ["Test fails before implementation (red)", "Test passes after implementation (green)", "No test deleted to make suite pass"]

- [ ] **S14.7** 🧠 Skill: `context-compression`
  Genera `CONTEXT.md` con vocabulario del proyecto — reduce tokens por run.
  Input: AGENTS.md + últimos 10 runs. Output: CONTEXT.md < 500 tokens.
  `when_to_use`: ["Before starting a long multi-task session", "When AGENTS.md exceeds 2000 tokens"]
  `anti_patterns`: ["Include full file contents", "Copy paste from AGENTS.md without compression"]
  `verifiers`: ["CONTEXT.md generated", "Token count < 500", "Key module names present"]

- [ ] **S14.8** 🧠 Skill: `improve-architecture`
  Identifica módulos con demasiadas responsabilidades. Sugiere extracción, no la implementa.
  Señales: > 300 líneas, > 5 imports de dominios distintos, > 3 responsabilidades en el nombre del módulo.
  `when_to_use`: ["Before a major refactor", "When a file keeps getting touched in every PR"]
  `anti_patterns`: ["Extract before understanding the contract", "Split without defining the new interface first", "Refactor and add features simultaneously"]

- [ ] **S14.9 — Validación**
  - [ ] `orchestos skill list` muestra 5 skills con columna `when_to_use` visible.
  - [ ] `orchestos skill build --target claude --id pre-task-alignment` → SKILL.md con secciones `When to use`, `Anti-patterns`, `Verifiers`.
  - [ ] Skill sin campos nuevos (las 3 existentes: fix-typescript-errors, summarize-pr-diff, generate-prisma-migration) compila sin error.
  - [ ] `bun run typecheck` verde.

- [ ] **S14.10** ⚡ Commit `feat(skills): structured skills schema + 5 real skills`.

---

## Métrica única de éxito Mes 3

¿Una tarea con `executor`, `checks` y `acceptance_criteria` corre end-to-end, los checks
deterministas atajan antes del QA cuando deben, el graph sugiere contexto razonable,
`cli.ts` ya no contiene lógica de ejecución, y hay 5 skills con `verifiers` + `anti_patterns`?

- [ ] **SÍ** → Mes 3 cerrado. Abrir plan Mes 4.
- [ ] **NO** → identificar cuál eje (harness/checks/executor/graph/skills) no resistió uso real.

---

## Lista prohibida Mes 3

- Symbols/calls en el graph — solo imports.
- Paralelismo entre tareas — scheduler sigue secuencial.
- `qa_executor` separado del `executor`.
- Worktrees reales (`git worktree add`).
- Reescribir el scheduler a archivo separado.
- `executor` como string libre — enum cerrado.
- `planner_model` / `executor_model` en tasks.yaml — vive en IDEAS.md hasta Mes 4.
- Más de 5 skills en S14 — calidad sobre cantidad.

---

## Decisiones de diseño activas (Mes 3)

- **Checks ANTES del QA** — si TS no compila, no tiene sentido el LLM de QA.
- **Checks usan exit code, no parseo de stdout** — wrapper script si necesitas stdout.
- **Graph v0 con regex, no tree-sitter** — schema ya soporta más kinds para Mes 4.
- **Harness nunca lanza** — toda excepción → `TaskResult{status:'failed'}`.
- **Codex executor detrás de flag** `OS_ENABLE_EXEC_CODEX=1` hasta evidencia real.
- **legacy `orchestos run` no migrado al harness** — flujo distinto, se depreca si nadie lo usa.
- **Two-tier LLM como convención (⚡/🧠), no en tasks.yaml** — hasta Mes 4 con evidencia.
