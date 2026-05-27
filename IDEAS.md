# IDEAS.md — OrchestOS

Sumidero de impulsos fuera de scope del Mes actual.
Cada vez que aparezca la tentación de agregar algo de la lista prohibida, va acá.
No se implementa hasta que el mes correspondiente esté cerrado y haya evidencia de necesidad real.

**Leyenda de estado**:
- ✅ IMPLEMENTADO — en producción, funciona
- 🔄 EN PROGRESO — en el mes activo (Mes 3)
- 💡 PENDIENTE — registrado, no iniciado

---

## Lista prohibida (Mes 1 y Mes 2 — ya cerrados)
- Graph DB (Graphiti / Neo4j) → ✅ reemplazado por SQLite `files + code_edges` (S12)
- Restate / Temporal — overkill para single-user CLI
- Rust / napi-rs — no hay bottleneck demostrado
- Dashboard web — después del CLI
- Marketplace de skills — después de 10 skills en uso real
- Multi-agente con git worktrees — Mes 3+
- Paralelismo real de tareas — Mes 3+

---

## Ideas registradas

---

### ✅ IMPLEMENTADO — Code Graph v0 (S12, 2026-05-27)

`files` + `code_edges` en SQLite. Regex import extraction para TS/JS/Python.
`orchestos index` + `orchestos context suggest`. SHA1 dedup. 1-hop neighbor ranking.
Ver `src/graph/index.ts` y `src/graph/suggest.ts`.

**Limitación conocida**: solo TS/JS/Python. C#/.NET/Go/Java = 0 files (by design v0).
Expandir en Mes 4 → ver "Multi-lenguaje en Code Graph" abajo.

---

### ✅ IMPLEMENTADO — Extracción de harness (S9, 2026-05-27)

`src/run/harness.ts` con `runTask(HarnessOpts): Promise<TaskResult>`.
cli.ts solo orquesta. Flujo: classify → model → prompt → LLM → parse → contract → checks → QA → insertRun.

---

### ✅ IMPLEMENTADO — `acceptance_criteria[]` + `checks[]` (S10, 2026-05-27)

`checks[]` = comandos deterministas (exit code) que corren ANTES del QA LLM.
`acceptance_criteria[]` = criterios evaluados per-item por el LLM de QA.
Si check falla → revert + retry sin gastar tokens de QA.

---

### ✅ IMPLEMENTADO — Multi-provider executor (S11, 2026-05-27)

Campo `executor: openrouter | anthropic | openai | codex` por tarea.
`ProviderClient` interface. `getProvider(name)` en `src/providers/index.ts`.

---

### 🔄 EN PROGRESO — Skills ecosystem con estructura real (S14, Mes 3)

Schema extendido: `when_to_use`, `verifiers`, `anti_patterns`, `examples`.
5 skills a escribir: `pre-task-alignment`, `diagnose`, `tdd-enforcer`,
`context-compression`, `improve-architecture`.

---

### ✅ ADOPTADO — Two-tier LLM: planner fuerte + executor adaptativo

Convención activa en PLAN.md: `⚡` = cualquier LLM, `🧠` = requiere criterio Claude/Opus.
Implementación en tasks.yaml (`planner_model` / `executor_model`) → Mes 4.

---

### 💡 [MES 4 — CANDIDATO FUERTE] Language-aware skills — un LLM no sabe igual de C# que de TypeScript

**Problema**: orchestos detecta el lenguaje del proyecto (`src/detect/languages.ts` ya lo hace
desde Mes 1), pero las skills ignoran esa información. Una skill `tdd-enforcer` escrita
para TypeScript le dice al LLM "corre `npm test`" — inútil en un proyecto .NET.

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
  default:                       # fallback si el lenguaje no está mapeado
    verifiers: ["run your test suite"]
    anti_patterns: ["empty test body"]
```

El compiler (`src/skills/targets/claude.ts`) inyecta solo la sección del lenguaje detectado.

**Por qué importa**: orchestos no puede ser una herramienta solo para proyectos TypeScript.
Cisepro.Web es .NET. Otros usuarios pueden tener Python, Go, Java.
El detector de lenguaje ya existe — hay que conectarlo con las skills.

**Prerequisito**: S14 (skills schema extendido) + S11 (executor ya rutea por lenguaje si es necesario).

---

### 💡 [MES 4+] Multi-lenguaje en Code Graph — C#, Java, Go, Python profundo

**Problema**: Code Graph v0 usa regex y solo cubre TS/JS/Python imports básicos.
Proyectos .NET (Cisepro.Web), Java, Go quedan con 0 files indexados.

**Propuesta por lenguaje**:
- **C# / .NET**: regex `using\s+([\w.]+)` + `namespace\s+([\w.]+)` → edges de namespace
- **Java**: regex `import\s+([\w.]+)` → edges de package
- **Go**: regex `"([\w/.-]+)"` dentro de bloques `import(...)` → edges de module path
- **Python profundo**: ya está, extender con `from package.module import X` resolution

Cuando el grafo crece a 10K+ nodos → migrar a **KuzuDB** (embebible, Cypher, Rust).
No antes de tener evidencia de lentitud en SQLite.

**Prerequisito**: language-aware skills funcionando (así sabemos qué lenguajes son prioritarios).

---

### 💡 [MES 4 — CANDIDATO] Skills de ciclo de vida del desarrollo

**Problema**: orchestos tiene skills para ejecutar código pero ninguna que guíe
las etapas críticas del desarrollo: seguridad, QA estructurado, testing.
Un LLM sin estas guías toma atajos que en producción cuestan caro.

**Tres skills prioritarias**:

#### `security-review`
- **Cuándo**: antes de mergear código que toca auth, inputs del usuario, queries SQL, archivos.
- `when_to_use`: ["Before any commit touching auth", "When handling user input", "Before DB query changes"]
- `verifiers`: depende del lenguaje (ver language-aware skills)
- `anti_patterns`: ["hardcoded secrets", "SQL string concatenation", "eval() on user input", "no input validation"]
- Inspirado en OWASP Top 10 — no necesita ser exhaustivo, solo los errores más comunes.

#### `qa-structured`
- **Cuándo**: después de implementar un feature, antes de marcar la tarea como done.
- Diferencia vs `acceptance_criteria[]`: esta skill guía al LLM en *cómo* evaluar, no *qué* evaluar.
- Flujo: ¿el output hace lo que dice la descripción? → ¿hay edge cases no cubiertos? → ¿el código es legible?
- `anti_patterns`: ["test only the happy path", "ignore error handling", "QA own output without distance"]

#### `test-writer`
- **Cuándo**: después de implementar, antes de QA.
- Diferente de `tdd-enforcer` (que fuerza red-green-refactor antes de implementar).
- Esta skill es para cuando ya existe código y hay que agregarle tests retroactivamente.
- `when_to_use`: ["When adding tests to existing code", "When coverage is below threshold"]
- `verifiers`: test suite pasa, cobertura no baja

**Prerequisito**: S14 (skills schema extendido).

---

### 💡 [MES 4 — CANDIDATO FUERTE] Model roles config — cerebro + ejecutor pesado + ejecutor ligero

**Idea**: al iniciar un proyecto, el usuario define qué modelo cumple cada rol. El harness
elige automáticamente basado en la complejidad clasificada de la tarea.

```yaml
# orchestos.config.yaml (en la raíz del proyecto)
models:
  planner:        claude-opus-4-7      # arquitectura, diseño, decisiones ambiguas
  executor_heavy: codex                # código complejo, refactors grandes
  executor_light: deepseek-v3          # tareas mecánicas, stubs, edits simples
  default:        openrouter/deepseek  # fallback si no hay config o sin API key
```

**Mapping automático** (usa `classifyTask` que ya existe):
- `plan` → `planner`
- `fix` / `refactor` → `executor_heavy`
- `generate` / `edit` → `executor_light`
- Sin config → `default` para todo

**Por qué es distinto**: LangChain/CrewAI asignan agentes por rol semántico ("researcher", "writer").
Nadie lo hace por **complejidad de tarea** mapeada a un clasificador ya existente.

**Prerequisito**: S11 ✅ (executor por tarea) + `orchestos init` que lea `orchestos.config.yaml`.

---

### 💡 [MES 4+] CONTEXT.md — jargon comprimido del proyecto

En vez de mandar AGENTS.md completo en cada prompt, mantener un `CONTEXT.md` con
el vocabulario específico del proyecto (nombres de módulos, convenciones, abreviaciones).
Reduce tokens y mejora consistencia entre runs.

`orchestos context compress` → genera CONTEXT.md a partir de AGENTS.md + runs history + código.

---

### 💡 [MES 4+] Sandbox por tarea (git worktree o tmp dir)

Cada tarea corre en un worktree aislado. Si QA falla, el worktree se descarta sin
tocar el árbol principal. Elimina la necesidad de `restoreContents`.

Prerequisito: harness separado ✅ (S9).
Ref: deer-flow usa containers. Para orchestos alcanza con git worktrees.

---

### 💡 [MES 4+] Spec-Driven flow completo (spec-kit)

`constitución → spec → clarificar → plan → validar → tareas → ejecutar`

En Mes 3 está el eslabón `validar` (`acceptance_criteria[]` ✅).
Falta para Mes 4:
- **Constitución**: `CONSTITUTION.md` — qué puede/no puede modificar el agente
- **Spec**: `orchestos spec <id>` — descripción inequívoca aprobada antes de ejecutar
- **Clarificar**: si hay ambigüedad, el harness pregunta antes de gastar tokens

Prerequisito: harness ✅ + acceptance_criteria ✅.

---

### 💡 [MES 5+] Sub-agentes con contextos aislados

Una tarea "plan" genera sub-tareas. Cada sub-tarea tiene su propio contexto,
su propio contrato de archivos, su propio QA stage.

Prerequisito: harness ✅ + scheduler robusto + worktrees.

---

## Feedback usuario 1
_(se llena cuando haya un usuario externo real usando orchestos en su proyecto)_

## Feedback Mes 3
_(se llena al cerrar Mes 3)_
