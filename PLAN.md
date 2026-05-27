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
