# Graph Runner — diseño (Mes 14, Bloque A1)

Diseño de la política de decisión ante fallo para `orchestos run --graph`. Hallazgos de
pre-flight (PLAN.md § BLOQUE 0) que fundamentan este diseño:

- `TaskStatus` ya incluye `'blocked'` con la semántica "dependencia no resuelta"
  ([src/tasks/schema.ts:1](../src/tasks/schema.ts:1)), wired en el executor de una sola
  tarea ([cli.ts:826-834](../src/cli.ts:826)). **No se introduce ningún estado nuevo** —
  se extiende ese mismo significado a "dependencia ancestro permanentemente fallida".
- El retry por tarea (`MAX_RETRIES=3`, `src/run/qa.ts`) **ya vive dentro de
  `executeTask`/harness** — pending → failed → pending (retry) → failed_permanent. El
  graph-runner no reimplementa retry; solo decide qué hacer **una vez** que una tarea llega
  a `failed_permanent`.
- `executePlan()` (scheduler de sub-tareas, S22) ya demuestra en producción el patrón
  correcto: `for` sobre las tareas que **nunca hace `break` global** — marca dependientes y
  continúa el loop. El graph-runner porta ese patrón de `SubTask[]` a `Task[]`.
- `diagnoseTask()` (S25) ya devuelve `{pattern, confidence, suggestion, details}` sin
  ejecutar nada. El graph-runner es el primer consumidor que **actúa** sobre el resultado
  en vez de solo imprimirlo.

## 1. Distinción central: "dependencia aún no lista" vs. "rama permanentemente bloqueada"

Ambos casos usan `status: 'blocked'` — son el mismo concepto en distinto momento:

| Caso | Cuándo | Reversible |
|---|---|---|
| Dependencia no lista | el ancestro existe y aún puede llegar a `done` (está `pending`/`running`/`retry`) | sí — se reevalúa cada vuelta del loop |
| Rama permanentemente bloqueada | el ancestro llegó a `failed_permanent` (o fue marcado `blocked` transitivamente) | no — sin intervención humana o edición de `tasks.yaml` |

El graph-runner no necesita distinguirlos con un campo nuevo: basta con que, al marcar
`blocked`, escriba `retry_reason` explicando la causa raíz (`"blocked by failed_permanent
ancestor: <id> — <diagnose.suggestion>"`). Eso es información suficiente para el humano y
para el dashboard (Bloque C).

## 2. Mapa `FailurePattern` → estrategia

Se dispara **una sola vez**, cuando una tarea cruza a `failed_permanent` (mismo punto donde
hoy `cli.ts` ya llama a `diagnoseTask` para imprimir a stderr — S25.3). El graph-runner
añade una decisión de acción sobre ese resultado:

| `FailurePattern` | Estrategia | Razón |
|---|---|---|
| `rate_limit` | **Requeue una sola vez** con backoff (resetear a `pending`, `retry_count = 0`, esperar `RATE_LIMIT_REQUEUE_DELAY_MS` antes de la siguiente vuelta) | El rate limit es transitorio; `hardening.ts` (`withRateLimitRetry`) ya reintenta dentro de una llamada, pero si aun así agotó `MAX_RETRIES` puede ser una ventana de cuota agotada que se libera con tiempo. Un solo requeue extra — no infinito, para no enmascarar un fallo real. |
| `deterministic_check` | **Bloquea la rama**, no reintenta | Un check determinístico que falla 3 veces no se va a arreglar solo — es una condición real del código que requiere edición humana de la tarea o del repo. |
| `qa_specific_criterion` | **Bloquea la rama**, no reintenta | El criterio de aceptación específico no se cumple — reintentar con el mismo prompt produce el mismo resultado. |
| `parse_error` | **Bloquea la rama**, no reintenta | Si el modelo devuelve JSON inválido 3 veces, el problema es estructural (prompt/modelo), no aleatorio. |
| `scope_creep` | **Bloquea la rama + nota explícita** sugiriendo dividir la tarea | Mismo umbral que `context-monitor.ts` (`scope_creep` > 20 archivos) — la tarea es demasiado grande para que el reintento ayude. |
| `unknown` | **Bloquea la rama** (respeta `MAX_RETRIES` ya consumido — no añade reintentos) | Sin patrón claro, no hay base para decidir una estrategia distinta de la default. Conservador por diseño: ante la duda, no autorizar más gasto. |

Solo `rate_limit` autoriza un reintento adicional fuera de `MAX_RETRIES`, y como máximo uno
por tarea (`requeued_for_rate_limit: boolean` en memoria del runner, no persistido en
`tasks.yaml` — vive solo durante la ejecución de `--graph`). Si tras ese requeue vuelve a
fallar, se trata como cualquier otro patrón: bloquea.

## 3. Algoritmo del conductor (alto nivel)

```
runGraph(tasksFile):
  ready := tareas pending con todas sus depends_on en 'done'
  blockedAncestors := Set<taskId>   // failed_permanent o bloqueados transitivamente

  while ready.length > 0 OR hay pending que podría volverse ready:
    checkCircuitBreaker()           // costo acumulado, wall-clock, iteraciones — ver A4

    para cada tarea ready (en orden estable, una a la vez — el scheduler sigue secuencial,
                            igual que executePlan; paralelismo no es parte de este mes):
      resultado := executeTask(tarea.id)   // reusa el executeTask existente de cli.ts

      si resultado == 'done': continue
      si resultado == 'retry': continue     // vuelve a pending, MAX_RETRIES interno decide
      si resultado == 'blocked': continue   // dependencia aún no lista, normal
      si resultado == 'failed' (es decir, llegó a failed_permanent):
        diag := diagnoseTask(tarea.id)
        estrategia := mapPatternToStrategy(diag.pattern)   // tabla §2

        si estrategia == 'requeue_once' y !tarea.requeued_for_rate_limit:
          marcar requeued_for_rate_limit = true
          updateTaskStatus(tarea.id, { status: 'pending', retry_count: 0 })
          esperar RATE_LIMIT_REQUEUE_DELAY_MS
        si no:
          blockedAncestors.add(tarea.id)
          para cada descendiente transitivo de tarea.id (vía depends_on):
            updateTaskStatus(descendiente.id, {
              status: 'blocked',
              retry_reason: `blocked by failed_permanent ancestor: ${tarea.id}${diag.suggestion}`
            })
          // las ramas independientes NO se tocan — el loop las recoge en la siguiente vuelta

    recalcular ready a partir del tasks.yaml actualizado

  reportar outcome final (Bloque B): done / blocked / pending-sin-recursos (circuit breaker)
```

Puntos clave de diseño:

- **No hay `break` global en ningún punto** — la única condición de parada es "no queda
  nada ejecutable" o el circuit breaker (§4). Esto es la diferencia central con `--all`.
- **Secuencial, no paralelo** — mismo límite que `executePlan()` ya tiene hoy. Paralelismo
  entre ramas independientes queda fuera de alcance de este mes (lista prohibida).
- **El requeue por rate_limit es la única excepción al "no reintentar tras
  failed_permanent"** — y está acotado a una vez por tarea para que no se convierta en un
  loop infinito disfrazado de resiliencia.
- **`blockedAncestors` es conceptualmente el mismo `failedIds` de `scheduler.ts`** — el
  mismo patrón, otro nombre porque opera sobre `Task[]` no `SubTask[]`.

## 4. Circuit breaker (A4 — referenciado aquí, implementado en A4)

Tres topes independientes, cualquiera detiene el loop completo (esto sí es un `break`
global — un loop autónomo sin techo es el riesgo real, no la propagación de un fallo):

| Tope | Default | Flag |
|---|---|---|
| Costo acumulado de la sesión `--graph` | sin límite si no se pasa flag | `--max-cost <usd>` |
| Wall-clock de la sesión | sin límite si no se pasa flag | `--max-minutes <n>` |
| Iteraciones totales del loop (red de seguridad contra bugs de traversal) | 200 | no configurable — es un techo de seguridad, no una preferencia de usuario |

Al cruzar cualquier tope: detener inmediatamente, **no** marcar las tareas restantes como
`blocked` (su estado real es "no se llegó a ejecutar", distinto de "bloqueada por fallo") —
quedan en `pending`, listas para que una próxima invocación de `--graph` continúe donde
quedó. Reportar el motivo del corte en el resumen final (Bloque B2).

## 5. Qué NO hace este diseño (alcance explícito)

- No reordena tareas por prioridad/costo — respeta el orden topológico tal cual está en
  `tasks.yaml`, igual que el scheduler de sub-tareas.
- No ejecuta ramas en paralelo.
- No modifica `run --all` — es aditivo (`run --graph`), decisión ya registrada en BLOQUE 0.2.
- No toca el límite `MAX_RETRIES` interno del harness — la única excepción es el requeue
  único de `rate_limit`, y vive en memoria del proceso `--graph`, no en `tasks.yaml`.
- No introduce acciones outward-facing/destructivas — el runner solo recorre tareas
  internas (LLM → contract → QA → worktree), igual que hoy. Eso es territorio del cliente
  MCP, eje propio posterior (ver IDEAS.md #10).
