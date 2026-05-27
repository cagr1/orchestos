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

S9 ✅ S10 ✅ S11 ✅ S12 ✅ S13 ✅ S14 ✅

### Validaciones manuales pendientes (no bloqueantes para S14)

Estas requieren API key activa o usuario externo. No bloquean S14:
- ⚠️ `orchestos task run --all` en qa-test-project con API key real (S9.6)
- ⚠️ Tarea con `checks: ["bun run typecheck"]` + output roto → retry sin tokens QA (S10.7)
- ⚠️ Tarea con `executor: anthropic` → `runs --detail` muestra `provider: anthropic` (S11.8)
- ⚠️ Full API end-to-end: executor + checks + acceptance_criteria → done, evidencia en runs --detail (S13.6)
- ⚠️ Usuario externo corre el flujo y deja feedback en `IDEAS.md ## Feedback Mes 3` (métrica Mes 3)

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
