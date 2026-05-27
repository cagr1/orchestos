---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-5-activo
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.
**Delegación**: ⚡ = cualquier LLM ejecuta leyendo este plan | 🧠 = requiere criterio Claude/Opus.

---

## MES 4 — Routing inteligente + skills que se adaptan al proyecto

- [x] **SÍ — Mes 4 cerrado (2026-05-27)**
  Routing activo (`config show`), 11 skills, language_targets, CONSTITUTION.md en system prompt, `context compress` genera CONTEXT.md, `runs --detail` reporta tokens.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 5 — Confiabilidad para uso diario: end-to-end real + sandbox aislado + spec-driven

**Objetivo**: Convertir OrchestOS en una herramienta confiable para uso personal diario, ejecutando tareas reales contra APIs vivas, aisladas en worktrees, con el flujo Spec-Driven completo cerrado.

---

### SEMANA 19 — End-to-end real + sandbox por worktree ⚡

La semana más crítica del mes: primera ejecución real contra API viva, cada tarea en worktree aislado en lugar de snapshot/restore.

**Módulos nuevos:**
- `src/run/sandbox.ts` — wrapper sobre `git worktree add/remove`
- `src/run/sandbox-policy.ts` — decide cuándo usar worktree vs cwd directo
- `src/run/e2e-smoke.ts` — script reproducible para validar flujo real
- `tests/run/sandbox.test.ts` + `tests/run/sandbox-policy.test.ts`
- `examples/e2e/` — tarea mínima reproducible (escribir hello.txt)
- `docs/E2E.md` — guía paso a paso para correr una tarea real

**Módulos modificados:**
- `src/run/harness.ts` — reemplazar `restoreContents()` por flujo sandbox
- `src/run/qa.ts` — QA fail → marcar worktree para descarte; QA pass → merge al branch base
- `src/cli.ts` — flags `--sandbox=worktree|cwd|auto`, `--keep-worktree`

- [x] S19.1 ⚡ (2026-05-27) `createWorktree(taskId, baseBranch)` en `src/run/sandbox.ts` con cleanup garantizado — devuelve `{ path, branch, cleanup() }`
- [x] S19.2 ⚡ (2026-05-27) `mergeWorktreeBack(worktree, strategy)` — estrategias `commit`, `squash`, `discard`
- [x] S19.3 ⚡ (2026-05-27) `sandbox-policy.ts` — si no es repo git → fallback a cwd con warning; si hay cambios uncommitted → abortar con mensaje claro
- [ ] S19.4 ⚡ harness integra sandbox: cwd del provider = `worktree.path`; eliminar rama `restoreContents()`
- [ ] S19.5 🧠 QA→worktree: QA fail → `git worktree remove --force` + log; QA pass → commit en worktree y merge fast-forward al branch base
- [ ] S19.6 ⚡ flag `--keep-worktree` para debugging post-mortem (no auto-remove al fallar)
- [ ] S19.7 ⚡ `examples/e2e/` con tarea mínima: "crea hello.txt con la palabra OK" + check `[test -f hello.txt]`
- [ ] S19.8 🧠 `e2e-smoke.ts` — `bun run e2e:smoke` ejecuta la tarea ejemplo contra `ANTHROPIC_API_KEY` real y assertea éxito
- [ ] S19.9 ⚡ `docs/E2E.md`: cómo configurar API key, correr smoke, leer logs, recuperar worktree con `--keep-worktree`
- [ ] S19.10 🧠 ejecutar smoke real con API key propia (anthropic + openrouter) — registrar resultado en `docs/E2E.md` como bitácora
- [ ] S19.11 ⚡ tests unitarios de `sandbox.ts` con repo git temporal (sin red): create/cleanup/merge/discard
- [ ] S19.12 ⚡ Validación: `bun test` verde + `bun run e2e:smoke` verde + worktree siempre se limpia
- [ ] S19.13 ⚡ Commit `feat(run): sandbox por git worktree + e2e real verificado`

---

### SEMANA 20 — Spec-Driven flow: `orchestos spec` ⚡

Cierra el flujo: `constitución ✅ → spec → clarify ✅ → plan → validar ✅ → tareas → ejecutar`

**Módulos nuevos:**
- `src/spec/store.ts` — persistencia en `.orchestos/specs/<task-id>.md` + frontmatter YAML
- `src/spec/validate.ts` — checks de completitud (descripción, aceptación, criterios)
- `docs/SPEC.md`

**Módulos modificados:**
- `src/run/harness.ts` — gate: si `requireSpec: true` en config y sin spec aprobado → abortar
- `src/cli.ts` — subcomando `orchestos spec create/show/list/approve/draft`
- `src/config/schema.ts` — flag `requireSpec?: boolean`

- [ ] S20.1 ⚡ `orchestos spec create <task-id>` — genera plantilla `.orchestos/specs/<id>.md` con secciones: Contexto, Descripción, Criterios de aceptación, Notas
- [ ] S20.2 ⚡ `orchestos spec show <task-id>` + `orchestos spec list`
- [ ] S20.3 ⚡ `orchestos spec approve <task-id>` — marca `status: approved` + `approvedAt` en frontmatter
- [ ] S20.4 🧠 `orchestos spec draft <task-id>` — invoca LLM con contexto de la tarea + CONSTITUTION.md y propone borrador (no aprueba automáticamente)
- [ ] S20.5 ⚡ integración con clarify: si spec tiene `clarify: pending` → bloquear approve hasta resolverlas
- [ ] S20.6 ⚡ harness gate: si `requireSpec: true` y status ≠ approved → error claro con el comando para arreglarlo
- [ ] S20.7 ⚡ `validate.ts` — verifica que acceptance criteria existan y no estén vacíos
- [ ] S20.8 ⚡ `docs/SPEC.md` con flujo completo y ejemplo end-to-end (spec → approve → run)
- [ ] S20.9 ⚡ tests: create/approve/reject/gate en harness
- [ ] S20.10 ⚡ Validación: tarea sin spec falla con `requireSpec: true`; con spec approved corre en worktree y produce resultado
- [ ] S20.11 ⚡ Commit `feat(spec): flujo Spec-Driven con gate en harness`

---

### SEMANA 21 — Graph multi-lenguaje + autoskills fetch 🧠

Resolver imports para lenguajes no-JS + descarga de skills curadas.

**Módulos nuevos:**
- `src/graph/resolvers/csharp.ts` — `using X.Y` → archivos del repo por namespace declarado
- `src/graph/resolvers/rust.ts` — `mod`/`use crate::` → estructura de carpetas
- `src/graph/resolvers/go.ts` — imports por `go.mod` module path
- `src/graph/resolvers/java.ts` — `import x.y.Z` → carpeta package
- `src/graph/resolver-registry.ts` — registro pluggable por lenguaje
- `src/skills/fetch.ts` — HTTP fetch al registry autoskills
- `tests/graph/resolvers/*.test.ts` + `tests/skills/fetch.test.ts`

**Módulos modificados:**
- `src/graph/index.ts` — invocar resolver registry al poblar `to_file_id`
- `src/cli.ts` — `orchestos skill fetch --language <lang> [--name <name>]`

- [ ] S21.1 ⚡ `resolver-registry.ts` con interfaz `Resolver { language, resolve(importStr, fromFile, repoIndex) }`
- [ ] S21.2 🧠 resolver C#: parsear `namespace X.Y` por archivo, mapear `using X.Y` → archivo más cercano
- [ ] S21.3 🧠 resolver Rust: estructura `src/foo/mod.rs` o `src/foo.rs` para resolver `use crate::foo`
- [ ] S21.4 🧠 resolver Go: leer `go.mod` para module path, resolver imports que empiezan con ese path
- [ ] S21.5 🧠 resolver Java: mapear `package x.y` declarado → resolver `import x.y.Z`
- [ ] S21.6 ⚡ integrar resolvers en `graph/index.ts`: `to_file_id` ahora se llena para C#/Rust/Go/Java
- [ ] S21.7 ⚡ test fixtures por lenguaje en `tests/fixtures/graph/<lang>/` con 3-4 archivos cada uno
- [ ] S21.8 ⚡ `skills/fetch.ts` — fetch de `https://raw.githubusercontent.com/midudev/autoskills/main/skills/<lang>/<name>.yaml` con cache local en `.orchestos/cache/skills/`
- [ ] S21.9 ⚡ `orchestos skill fetch --language rust [--name testing]` — descarga, valida YAML, guarda en `skills/`
- [ ] S21.10 ⚡ `orchestos skill fetch --list` — lista skills disponibles del registry (parseando índice del repo)
- [ ] S21.11 ⚡ Validación: `bun test` verde + `context suggest` muestra dependencias resueltas en proyecto C#/Go ejemplo + `skill fetch` descarga skill real
- [ ] S21.12 ⚡ Commit `feat(graph,skills): resolvers multi-lenguaje + autoskills fetch`

---

### SEMANA 22 — Sub-agentes con contextos aislados + hardening final 🧠

Solo si S19 (sandbox) está sólido. Tareas "plan" generan sub-tareas, cada una con contexto propio, worktree y QA.

**Módulos nuevos:**
- `src/agents/sub-agent.ts` — `SubTask` + orquestador
- `src/agents/context-isolation.ts` — cada sub-agente recibe slice de CONTEXT.md + spec propio
- `src/agents/planner.ts` — convierte tarea "plan" en array de sub-tareas con `depends_on`
- `tests/agents/sub-agent.test.ts`
- `docs/AGENTS.md`

**Módulos modificados:**
- `src/run/scheduler.ts` — sub-tareas con prefijo de id padre
- `src/run/harness.ts` — cada sub-tarea = nuevo worktree hijo del padre

- [ ] S22.1 🧠 contrato de salida de tarea "plan": YAML con `subtasks: [{id, description, acceptance}]`
- [ ] S22.2 ⚡ `planner.ts` — parser robusto de la salida + validación del schema
- [ ] S22.3 🧠 `context-isolation.ts` — cada sub-agente recibe solo la porción relevante de CONTEXT.md (heurística por keywords del spec)
- [ ] S22.4 ⚡ scheduler: sub-tareas heredan provider/model del padre salvo override; cada una en su worktree hijo
- [ ] S22.5 ⚡ QA en cascada: si un sub-task falla → padre a failed, no merge nada
- [ ] S22.6 ⚡ `orchestos task run --expand <plan-task-id>` — ejecuta plan + sub-tareas en una pasada
- [ ] S22.7 ⚡ tests: plan de 3 sub-tareas, una falla, verificar rollback completo
- [ ] S22.8 🧠 hardening: rate limit, timeout, worktree colisión → retries con backoff donde aplique
- [ ] S22.9 ⚡ `docs/AGENTS.md` con flujo completo y ejemplo real
- [ ] S22.10 🧠 smoke real: tarea "plan" → 2 sub-tareas → ambas pasan → resultado en branch base
- [ ] S22.11 ⚡ README + CHANGELOG con resumen Mes 5
- [ ] S22.12 ⚡ Validación: `bun test` verde + smoke S22 verde + 5 tareas reales ejecutadas durante el mes (bitácora en `docs/E2E.md`)
- [ ] S22.13 ⚡ Commit `feat(agents): sub-agentes con contextos aislados + cierre Mes 5`

---

### Decisiones de diseño Mes 5

1. **Worktrees reemplazan snapshot/restore** — `restoreContents()` se elimina. Si el repo no es git → fallback a cwd con warning, no se inventa un VFS.
2. **Spec es opcional por defecto, obligatorio por config** — `requireSpec: true` en `orchestos.config.yaml`. Permite adopción gradual sin romper tareas existentes.
3. **autoskills es solo HTTP fetch al raw de GitHub** — sin `npx`, sin runtime externo, sin autenticación. Si el registry cambia de formato → falla con mensaje claro.
4. **Resolvers de imports son best-effort** — si un import no se resuelve, `to_file_id = null` sigue siendo válido. El graph no es ground truth, es ayuda para contexto.
5. **Sub-agentes solo si S19 cierra limpio** — si sandbox arrastra problemas, S22 se reduce a hardening puro. Worktrees sólidos son prerequisito no negociable.
6. **Dogfooding obligatorio** — Mes 5 se valida con al menos 5 tareas reales propias ejecutadas durante el mes, no solo con tests sintéticos.

### Lista prohibida Mes 5

- Dashboard web, UI gráfica, TUI interactiva
- Servidor HTTP, modo daemon, SaaS
- Autenticación, multi-usuario, RBAC
- Integración con plataformas externas (Linear, Jira, GitHub Issues)
- Nuevos providers de LLM — mantener anthropic/openai/openrouter/codex
- Reescritura del code graph — solo añadir resolvers
- Telemetría, analytics, observability stack
- Plugin system, extensiones de terceros
- Paralelismo entre tareas — scheduler sigue secuencial

### Dependencias

```
S19 (sandbox + e2e real) ────────────────────────────────────────────┐
S20 (spec-driven) ───────────────────────────── (requiere S19 para smoke)
S21 (graph resolvers + autoskills) ──── independiente, puede ir en paralelo
S22 (sub-agentes) ← requiere S19 (worktrees) + S20 (spec por sub-tarea) ─┘
```

### Métrica única de éxito Mes 5

**¿Pude ejecutar al menos 5 tareas reales propias durante el mes, cada una con spec aprobado, en su worktree aislado, con QA pasando, y mergeadas a mi branch base sin intervención manual?**

- [ ] **SÍ** → Mes 5 cerrado. Abrir plan Mes 6.
- [ ] **NO** → S19 o S20 quedaron débiles y bloquean adopción. Identificar cuál eje falló.
