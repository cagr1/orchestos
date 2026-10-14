# E2E — Guía de ejecución real

Cómo configurar tu API key, correr el smoke test, leer los logs, y recuperar un worktree fallido.

---

## 1. Configurar API key

OrchestOS necesita una clave de al menos un proveedor. Anthropic es el executor del smoke test por defecto.

```bash
# En tu shell (o .env / secreto del sistema):
export ANTHROPIC_API_KEY=sk-ant-...
```

Proveedores alternativos:

```bash
export OPENROUTER_API_KEY=sk-or-...   # para tareas con executor: openrouter
export OPENAI_API_KEY=sk-...          # para tareas con executor: openai
```

---

## 2. Correr el smoke test

El smoke test ejecuta la tarea mínima en `examples/e2e/` contra la API real:

```bash
bun run e2e:smoke
```

Salida esperada (éxito):

```
[e2e:smoke] Starting smoke test...
  project: /path/to/orchestos/examples/e2e
[e2e:smoke] Calling LLM...

[e2e:smoke] Result: done
  QA:      pass — ...
  tokens:  123 in / 45 out
  cost:    $0.00012
  time:    2341ms

[e2e:smoke] PASS — hello.txt exists and contains "OK"
```

Salida de fallo:

```
[e2e:smoke] FAIL — task status is "retry", expected "done".
  Reason: QA detected missing content
```

---

## 3. Leer logs de una ejecución

Cada ejecución genera un log en `.orchestos/runs/<task-id>/<run-id>.log`:

```bash
# Ver el último log del task hello-world
ls examples/e2e/.orchestos/runs/hello-world/
cat examples/e2e/.orchestos/runs/hello-world/<run-id>.log
```

El log incluye: prompt enviado, respuesta cruda del LLM, resultado de checks, y veredicto QA.

Para ver desde la CLI:

```bash
cd examples/e2e
orchestos runs --detail <run-id>
```

---

## 4. Usar `--keep-worktree` para debugging

Si una tarea falla y quieres inspeccionar el estado del worktree antes de que se borre:

```bash
orchestos task run --id hello-world --keep-worktree
```

Con este flag, si la tarea falla el worktree **no se elimina**. Verás en los logs la ruta del worktree:

```
[sandbox] worktree created at .orchestos/worktrees/hello-world-1716820000000
[qa] verdict: fail — ...
[sandbox] keepWorktree=true — worktree preserved for debugging
```

Para inspeccionar:

```bash
ls .orchestos/worktrees/hello-world-*/
cat .orchestos/worktrees/hello-world-*/hello.txt
```

Para limpiar manualmente después:

```bash
git worktree remove --force .orchestos/worktrees/hello-world-<timestamp>
git branch -D orchestos/hello-world/<timestamp>
```

---

## 5. Sandbox modes

| Flag | Comportamiento |
|------|----------------|
| *(sin flag)* `--sandbox auto` | Worktree si es repo git, cwd si no lo es |
| `--sandbox worktree` | Siempre worktree (aborta si no hay repo git) |
| `--sandbox cwd` | Siempre escribe directamente en el directorio |
| `--keep-worktree` | Igual que `--sandbox worktree` + preserva worktree al fallar |

---

## 6. Bitácora de ejecuciones reales

| Fecha | Tarea | Proveedor | Resultado | Notas |
|-------|-------|-----------|-----------|-------|
| 2026-05-27 | hello-world | openrouter | PASS | 277/248 tokens · $0.00000 · 8762ms · QA pass |
| 2026-05-28 | S22 suite | — | PASS | 110 tests · 173 expect · 8 files · tsc 0 errors |
| 2026-05-28 | smoke-agents (write-greeting) | openrouter/claude-3-haiku | PASS | 428/269 tokens · $0.00000 · 16s · QA pass · memory smoke-greeting escrita |
| 2026-05-28 | smoke-agents (write-response) | openrouter/claude-3-haiku | PASS | 430/152 tokens · $0.00000 · 28s · QA pass · memory smoke-response escrita · depends_on resuelto |
| 2026-06-25 | run --graph (D2, gate sintético) | openrouter/deepseek-v4-flash + modelo inválido a propósito | PASS | Proyecto aislado, no el tasks.yaml real. 4 tareas: 1 ok, 1 falla a propósito, 1 independiente completa, 1 descendiente bloqueado. $0.000815 total · circuit breaker no se disparó · autonomy_metric 0.25. Confirma: el grafo no se detiene globalmente, la rama se bloquea, las independientes terminan. |
| 2026-06-25 | run --graph (D3, smoke real) | openrouter/deepseek-v4-flash | **MIXTO** — ver nota | $0.00200 · 25s · 0 retries · `[graph] ✓ done` · QA verdict del harness: "pass". **Pero el archivo generado no compila** (import de `vitest` en vez de `bun:test`, `tmpdir` importado de `'path'` en vez de `'os'`, objetos `Task` incompletos) — descubierto recién al correr `tsc`/`bun test` manualmente, fuera del loop del runner. Archivo eliminado, `tasks.yaml` revertido a su estado real (la tarea era sintética, solo para este smoke). |

**Hallazgo real de D3 (no cosmético, gaps reales del sistema):**
1. **QA gate insuficiente para tareas de código sin `checks:` explícito — ARREGLADO el mismo día.** Esta tarea no declaró `checks:` (comandos deterministas), así que la única validación fue el juicio del LLM QA (`qa.ts`), que aprobó código que ni siquiera parsea. Fix: `defaultChecksFor(output, effectiveRoot)` en `src/run/checks.ts` — si la tarea no declara `checks:` propios, agrega automáticamente `bunx tsc --noEmit` (si el output incluye `.ts`/`.tsx`) y `bun test <archivo>` por cada `*.test.ts` declarado. Se salta si `effectiveRoot` no tiene `node_modules` (worktree fresco) para no producir falsos negativos por dependencias no resueltas, no por el código generado. `checks:` explícitos siempre tienen precedencia. 6 tests nuevos (`src/__tests__/checks.test.ts`).
   **Verificado en vivo dos veces, real, sin mocks**: (a) con el fix activo, la misma tarea que antes aprobaba código roto ahora lo rechaza antes del QA — log real: `CHECK failed: bunx tsc --noEmit exit=2`, `CHECK failed: bun test ... exit=1`; (b) tras corregir también el bug de MAX_RETRIES (ver #2), la tarea termina en `failed_permanent` después de exactamente 3 intentos reales (`retry=3/3`), no 14.
2. **Bug descubierto por el fix #1 — ARREGLADO el mismo día.** El fallo de un *check* (a diferencia del fallo de QA) nunca respetaba `MAX_RETRIES`: devolvía `status: 'retry'` incondicionalmente. Con `defaultChecksFor` activo, una tarea que falla el check repetidamente entraba en loop indefinido (observado en vivo: `retry 7/3`, luego `retry 14/3`, solo detenido por el circuit breaker de wall-clock a los 6+ minutos y $0.037 reales). Fix en `src/run/harness.ts`: el branch de check-fail ahora chequea `ctx.task.retry_count + 1 >= MAX_RETRIES` igual que el branch de QA-fail, devolviendo `'failed'` cuando se agota — así el grafo lo marca `failed_permanent` y bloquea la rama normalmente, en vez de reintentar sin límite.
3. **Fallback silencioso de sandbox — pendiente, follow-up creado.** El log mostró `sandbox: worktree mode selected but no branch/task id — falling back to cwd` — pese a pedir `--keep-worktree` (que debería forzar modo worktree), el runner escribió directo en el working directory real, sin aislamiento. No hubo daño porque el archivo solo se agregaba (no sobreescribía nada), pero el aislamiento esperado no se cumplió. Fuera de alcance de este cierre — sigue como tarea de seguimiento separada.
