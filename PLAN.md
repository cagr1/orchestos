---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-4-pendiente
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**: ⚡ = cualquier LLM ejecuta leyendo este plan | 🧠 = requiere criterio Claude/Opus.

---

## MES 4 — Routing inteligente + skills que se adaptan al proyecto

### SEMANA 15 — Model roles config 🧠

**Módulos nuevos:**
- `src/config/schema.ts` — `OrcheConfig`: `models{planner, executor_heavy, executor_light, default}` + `config_version`
- `src/config/load.ts` — `loadOrcheConfig(projectPath)`: busca `orchestos.config.yaml` → fallback `~/.orchestos/config.yaml` → fallback defaults
- `src/router/auto-route.ts` — `autoRoute(task, config)`: usa `classifyTask` existente → `plan`→planner, `fix/refactor`→executor_heavy, `generate/edit/doc`→executor_light, sin match→default
- Extender `Task` schema: `planner_model?: string`, `executor_model?: string` (override por tarea, gana sobre config)
- Harness: si task no tiene `executor` explícito → `autoRoute(task, config)` determina provider+model

**Comandos nuevos:**
- `orchestos config init` — scaffold `orchestos.config.yaml` en directorio del proyecto
- `orchestos config show [--project <path>]` — config activo + columna "modelo que usaría" por cada tarea pendiente

- [x] S15.1 `src/config/schema.ts` + `src/config/load.ts` con fallback chain — 2026-05-27
- [x] S15.2 `src/router/auto-route.ts`: autoRoute(task, config) usando classifyTask existente — 2026-05-27
- [x] S15.3 Extender Task schema: planner_model?, executor_model? opcionales — 2026-05-27
- [x] S15.4 Harness integra autoRoute — executor explícito sigue ganando — 2026-05-27
- [x] S15.5 Comandos `config init` + `config show` — 2026-05-27
- [x] S15.6 Validación: plan-architecture → anthropic/claude-opus-4-7 [planner]; sin config.yaml → legacy path idéntico a Mes 3 — 2026-05-27
- [x] S15.7 Commit `71a05ae` — 2026-05-27

---

### SEMANA 16 — Language-aware skills ⚡

**Schema YAML extendido:**
```yaml
language_targets:
  typescript:
    verifiers: ["bun test", "npm test"]
    anti_patterns: ["skip describe blocks"]
  csharp:
    verifiers: ["dotnet test"]
    anti_patterns: ["[Ignore] sin razón"]
  default:
    verifiers: ["corre tu suite de tests"]
```

**Módulos afectados:**
- `src/skills/schema.ts` — `LanguageTarget` type + `language_targets?: Record<string, LanguageTarget>` en `Skill`
- `src/skills/compiler.ts` — recibe `detectedLanguage?`; selecciona sección correcta (o default); emite `## Language-specific guidance` solo si existe
- `src/detect/languages.ts` — exportar `detectPrimaryLanguage(projectPath): string`
- `orchestos skill build [--project <path>]` — con proyecto → detecta lenguaje y compila sección; sin proyecto → compila default

- [x] S16.1 `LanguageTarget` type + `language_targets` en schema + validateSkill retrocompatible — 2026-05-27
- [x] S16.2 `detectPrimaryLanguage()` exportado desde detect/languages.ts — 2026-05-27
- [x] S16.3 Compilador claude/cursor/openai reciben detectedLanguage, emiten sección correcta — 2026-05-27
- [x] S16.4 `skill build --project` detecta lenguaje del proyecto — 2026-05-27
- [x] S16.5 Actualizar `tdd-enforcer` con language_targets (TS/C#/Python/default) — 2026-05-27
- [x] S16.6 Validación: typecheck verde; build sin --project → idéntico a antes — 2026-05-27
- [x] S16.7 Commit + push — 2026-05-27

---

### SEMANA 17 — CONSTITUTION.md + modo clarify 🧠

**CONSTITUTION.md** — archivo en el directorio del proyecto:
```markdown
## ALLOWED
- Modify files under src/

## FORBIDDEN
- Modify .env files
- Delete files

## REQUIRE_CONFIRMATION
- Any change to src/db/schema.ts
```

**Módulos nuevos:**
- `src/spec/constitution.ts` — `loadConstitution(projectPath)` + `buildConstitutionBlock(constitution)` para system prompt
- `src/spec/clarify.ts` — `needsClarify(task)`: heurística v0 — palabras ambiguas ("optimize","improve","fix") sin archivo target en input[] → flag
- Harness: si CONSTITUTION.md existe → inyecta bloque en system prompt; flag `--clarify` o `task.clarify: true` → pregunta antes de gastar tokens

**Comandos nuevos:**
- `orchestos constitution init [--project <path>]` — scaffold CONSTITUTION.md
- `orchestos task run --clarify <id>` — activa modo clarify para esa ejecución

- [x] S17.1 `src/spec/constitution.ts`: loadConstitution + buildConstitutionBlock — 2026-05-27
- [x] S17.2 Harness inyecta constitution block en system prompt si CONSTITUTION.md existe — 2026-05-27
- [x] S17.3 `src/spec/clarify.ts`: needsClarify heurística v0 (verb ambiguo + sin input[]) — 2026-05-27
- [x] S17.4 Harness/cli: --clarify → readline pregunta + appende clarificación a description — 2026-05-27
- [x] S17.5 Comandos `constitution init` + `constitution show` + `task run --clarify` — 2026-05-27
- [x] S17.6 Validación: explain con CONSTITUTION.md → `loaded: 10 rules`; sin CONSTITUTION.md → `(none)`; typecheck verde — 2026-05-27
- [x] S17.7 Commit `e11cb2a` + push — 2026-05-27

---

### SEMANA 18 — 3 skills de ciclo de vida + CONTEXT.md ⚡

**Skills nuevas** (schema completo: when_to_use, inputs_required, verifiers, anti_patterns, examples, language_targets donde aplique):
- `security-review` — antes de mergear código que toca auth/inputs/SQL. OWASP Top 10 (5 más comunes). anti_patterns: secrets hardcodeados, concatenación SQL, eval() en user input.
- `qa-structured` — cómo evaluar después de implementar (≠ acceptance_criteria que define qué). anti_patterns: solo happy path, ignorar error handling, QA del propio output.
- `test-writer` — agregar tests a código existente (≠ tdd-enforcer que va antes). language_targets para verifiers por lenguaje.

**CONTEXT.md — compresión de contexto:**
- `src/context/compress.ts` — `buildContextMd(projectId)`: AGENTS.md + top 20 archivos del graph por frecuencia en runs + últimos 5 runs summary → CONTEXT.md (~500 tokens vs ~2000 AGENTS.md)
- Harness: si CONTEXT.md existe → usa en lugar de AGENTS.md; `runs --detail` reporta `context: CONTEXT.md (487 tokens)` vs `AGENTS.md (1843 tokens)`
- `orchestos context compress [--project <path>]` — genera/actualiza CONTEXT.md

- [x] S18.1 Skill `security-review` con schema completo — 2026-05-27
- [x] S18.2 Skill `qa-structured` con schema completo — 2026-05-27
- [x] S18.3 Skill `test-writer` con language_targets — 2026-05-27
- [x] S18.4 `src/context/compress.ts`: buildContextMd() — 2026-05-27
- [x] S18.5 `orchestos context compress` comando — 2026-05-27
- [x] S18.6 Harness usa CONTEXT.md si existe, reporta ahorro de tokens en runs --detail — 2026-05-27
- [x] S18.7 README: secciones ## Model routing, ## Constitution, ## Language-aware skills, ## Context compression — 2026-05-27
- [x] S18.8 LIMITATIONS.md: clarify es heurística v0, no semántico — 2026-05-27
- [x] S18.9 Validación: typecheck verde; skill list → 11 skills; context compress genera CONTEXT.md; harness usa CONTEXT.md — 2026-05-27
- [x] S18.10 Commit final Mes 4 — 2026-05-27

---

### Decisiones de diseño Mes 4

- **`orchestos.config.yaml` vive en el proyecto** — routing es por proyecto; config global como fallback
- **`autoRoute` usa `classifyTask` existente** — sin clasificador nuevo, deuda cero
- **`executor` por tarea sigue ganando sobre config** — compatibilidad total Mes 3
- **CONSTITUTION.md es Markdown parseado con regex** — sin DSL nuevo; Mes 5 puede formalizarlo
- **`clarify` es heurística de palabras clave** — semántica (LLM call extra) queda para Mes 5
- **CONTEXT.md sustituye AGENTS.md en el prompt** — AGENTS.md sigue siendo fuente de verdad para init

### Lista prohibida Mes 4

- Dashboard / UI de ningún tipo
- Sub-agentes con contextos aislados
- Sandbox por tarea (`git worktree add`) → Mes 5
- Spec-kit completo (`orchestos spec <id>`) → Mes 5
- KuzuDB / upgrade del graph → solo si proyecto llega a 10K nodos
- Paralelismo entre tareas — scheduler sigue secuencial
- `qa_executor` separado
- Más de 3 skills nuevas en S18
- Clasificador semántico para clarify

### Dependencias

```
S15 (config + autoRoute) ─────────────────────────────┐
S16 (language skills) ─────────────────────────────── │
S17 (constitution + clarify) ──────────────────────── │
S18 (skills + CONTEXT.md) ← requiere S16 + S17 + S15 ─┘
```

### Métrica única de éxito Mes 4

¿Un proyecto con `orchestos.config.yaml` enruta tareas al modelo correcto, las skills compiladas
incluyen solo instrucciones del lenguaje del proyecto, `CONSTITUTION.md` aparece en el prompt sin
configuración adicional, y `context compress` produce un CONTEXT.md que el harness usa con ahorro
de tokens visible en `runs --detail`?

- [ ] **SÍ** → Mes 4 cerrado. Abrir plan Mes 5.
- [ ] **NO** → identificar cuál eje (config/language-skills/constitution/compress) no resistió uso real.
