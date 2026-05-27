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
| — | — | — | — | *(actualizar tras cada ejecución real)* |
