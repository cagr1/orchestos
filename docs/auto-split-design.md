# Auto-split design — Mes 20 / Bloque A

**Estado:** borrador para revisión (A.1) — no tocar código hasta que Carlos apruebe (A.2).  
**Contexto completo:** [PLAN.md — Bloque A](../PLAN.md)

---

## El problema concreto

El harness ya computa `availableForOutput = contextWindow − promptTokens − SAFETY_MARGIN`
(harness.ts:254). Cuando una tarea pide escribir varios archivos, ese presupuesto se reparte
entre todos. Un LLM no sabe cuántos tokens va a generar antes de empezar: si se le acaba el
presupuesto a mitad del tercer archivo, se corta en seco sin aviso.

El motor de sub-tareas (`executePlan` + `generatePlan`) ya existe y funciona — el problema es
que nadie lo activa: `--expand` necesita 3 pasos manuales que nunca ocurren en la práctica
(ver PLAN.md, descripción del gatillo muerto).

El auto-split es un gatillo automático que, antes de correr una tarea, detecta si el output
estimado excede el presupuesto real y, si es así, llama al generador de planes existente y pide
aprobación antes de gastar.

---

## (a) Estimador de tamaño — `shouldSplit(task, budget)`

### Función pura, sin LLM

```ts
interface SplitBudget {
  availableForOutput: number  // ya computado en harness.ts:254
  maxTokens: number           // ya computado en harness.ts:272 (clampeado por providerMaxOutput)
}

function shouldSplit(task: Task, budget: SplitBudget): boolean
```

### Heurístico

```
AVG_TOKENS_PER_OUTPUT_FILE = 2048   // ~150 líneas de TS a 13 tokens/línea; conservador
SPLIT_THRESHOLD = 0.7               // el output estimado supera el 70% del presupuesto real

estimatedOutput = task.output.length × AVG_TOKENS_PER_OUTPUT_FILE
shouldSplit     = estimatedOutput > budget.maxTokens × SPLIT_THRESHOLD
```

**Por qué `maxTokens` y no `availableForOutput`:**  
`maxTokens` ya está clampeado por `providerMaxOutput` (el tope real del proveedor, cuando está
disponible). `availableForOutput` puede ser mucho mayor que lo que el proveedor realmente permite
(ej. gpt-4o-mini: `availableForOutput` ~122K pero el proveedor rechaza con tope de 16K). Usar el
número ya clampeado evita falsos negativos.

### Casos concretos con los valores propuestos

| `task.output.length` | Estimado (tokens) | `maxTokens` 8K  | `maxTokens` 16K | `maxTokens` 128K |
|---------------------:|------------------:|:---------------:|:---------------:|:----------------:|
| 1 archivo            | 2 048             | no split        | no split        | no split         |
| 3 archivos           | 6 144             | **SPLIT** (>5.6K) | no split      | no split         |
| 5 archivos           | 10 240            | **SPLIT**       | **SPLIT** (>11.2K) | no split    |
| 8 archivos           | 16 384            | **SPLIT**       | **SPLIT**       | no split         |
| 20 archivos          | 40 960            | **SPLIT**       | **SPLIT**       | **SPLIT** (>89.6K) |

Nota: los valores concretos de `AVG_TOKENS_PER_OUTPUT_FILE` y `SPLIT_THRESHOLD` son ajustables —
las constantes viven en un único lugar (`harness.ts`) para cambiarlas fácilmente después de probar
con casos reales. El diseño no los hardcodea en múltiples archivos.

### Exclusiones explícitas

- `engine: 'external'` — el executor es `claude -p`, no la API directa; no se puede interceptar
  el presupuesto de salida desde el harness. No aplica split.
- Tareas sin `output` declarado (`topic_key`-only) — no hay archivos que estimar. No aplica split.
- Tareas con `engine: 'single-shot'` y solo 1 archivo en output — casi nunca vale la pena; pero
  si el modelo tiene `maxTokens` muy bajo (ej. 2048 custom) podría activarse igual por la fórmula.
  Es correcto: el estimador no sabe de qué modelo se trata, solo del presupuesto real.

---

## (b) El gatillo — dónde y cuándo

### Punto de inserción en el harness

El harness ya tiene una secuencia clara:

```
1. construir prompt (system + userContent)   → harness.ts:170-220
2. calcular availableForOutput / maxTokens   → harness.ts:245-272
3. seleccionar engine                        → harness.ts:282-289
4. engine.run()                              → harness.ts:313
```

El gatillo va entre los pasos 2 y 3:

```
2. calcular availableForOutput / maxTokens
   ↓
2b. [NUEVO] shouldSplit(task, { availableForOutput, maxTokens }) ?
    → sí: generatePlan() → devolver { status: 'split_proposed', plan: SubTask[] }
    → no: continuar a paso 3 (behavior actual, sin cambios)
```

### Contrato de retorno — señal nueva, no cambio destructivo

`runTask()` hoy retorna `ExecutorResult` con `status: 'done' | 'failed' | 'pending' | 'blocked'`.
Se agrega `'split_proposed'` como nuevo valor:

```ts
interface SplitProposedResult extends ExecutorResultBase {
  status: 'split_proposed'
  plan: SubTask[]
  planYamlPath: string   // ruta donde se persistió el plan (ver §c)
}
```

El harness NO llama `executePlan()` — devuelve la señal y el plan. El caller (CLI o endpoint de
API) decide qué hacer: mostrar al usuario, esperar aprobación, ejecutar.

**Por qué no llamar `executePlan()` desde el harness:**
`executePlan()` es un motor de sub-tareas que crea worktrees Git, corre N subtareas en secuencia y
agrega costos. Es responsabilidad de la capa de orquestación (CLI / API), no del harness de una
sola tarea. Mezclarlos rompería la separación ya establecida (el mismo principio que separó
`graph-runner.ts` de `harness.ts`).

### Reusar `generatePlan()` tal cual

```ts
// planner.ts:272 — entry point auto-detect (function-calling o YAML fallback)
const subTasks = await generatePlan(task.description, task.id, {
  provider: ctx.providerName,
  model:    ctx.model,
})
```

No construir nada nuevo. El generador ya maneja su propio presupuesto de tokens
(`contextWindowFor(model) - promptTokens - PLANNER_SAFETY_MARGIN`, planner.ts:208).

---

## (c) Punto de control humano — aprobación antes de gastar

### Principio

Mismo contrato que el chat (Mes 18 B.1.b): nunca auto-run silencioso.
El usuario ve exactamente qué va a correr, cuánto cuesta estimado, y aprueba.

### Persistencia del plan — opción elegida: archivo `.plan.yaml`

El plan se escribe a disco en el mismo directorio de outputs de la tarea padre:

```
<project_root>/<parent_task_id>.plan.yaml
```

**Por qué archivo YAML y no BD / estado en memoria:**
1. **Durable:** sobrevive a un cierre de UI o interrupción del CLI.
2. **Transparente:** el usuario puede inspeccionar / editar el plan propuesto con su editor antes de aprobar.
3. **Reutiliza el pipeline existente:** `createPlan(yamlText)` ya valida y topo-ordena (planner.ts:70). La aprobación es solo "llamar `executePlan(createPlan(readFile(planYamlPath)), ...)`".
4. **Compatible con `--expand`:** el flag manual ya funciona exactamente así — el auto-split es simplemente `--expand` activado automáticamente, con un paso de aprobación antes.

### Lo que el usuario ve en CLI

```
[auto-split] La tarea "crypto-dashboard-premium" estima ~20 480 tokens de output
             pero el presupuesto real del modelo (claude-sonnet-5) es 8 192 tokens.
             
Plan propuesto (5 sub-tareas):
  1. setup-project     → vite.config.ts, package.json, tsconfig.json
  2. api-layer         → src/api/coingecko.ts
  3. components        → src/components/PriceCard.tsx, PriceChart.tsx
  4. layout            → src/App.tsx, src/main.tsx
  5. styles            → src/index.css
  
Costo estimado: ~$0.08 total (5 llamadas × ~$0.016 promedio)
Plan guardado en: crypto-dashboard-premium.plan.yaml

¿Aprobar y ejecutar? [y/N]
```

### Lo que el usuario ve en el dashboard (Bloque B.3, implementación posterior)

Un panel/modal con la misma información, con botones "Aprobar" / "Rechazar". El endpoint de API
recibe la señal `split_proposed` del harness y devuelve el plan al frontend. El frontend lo
renderiza. Al aprobar, un nuevo endpoint llama `executePlan()`.

No diseñar el dashboard aquí — es responsabilidad de B.3. Solo el contrato: el harness devuelve
`{ status: 'split_proposed', plan: SubTask[], planYamlPath: string }` y el dashboard lo trata.

### Si el usuario rechaza

La tarea sigue como `pending` con `retryReason: 'split propuesto rechazado por el usuario'`.
El usuario puede cambiar el modelo, reducir el scope del output, o aprobar más tarde leyendo el
`.plan.yaml` y corriendo `orchestos task run --expand <id>` a mano (el camino ya existente).

---

## (d) Fallback — qué pasa si una sub-tarea también excede presupuesto

### Decisión propuesta: no re-split recursivo (al menos en Bloque A-B)

**Razones:**
- Re-split recursivo aumenta la deuda de UX: el usuario tiene que aprobar N planes anidados.
- El caso real de "una sub-tarea sigue siendo demasiado grande" indica que el scope del output de
  esa sub-tarea está mal estimado por el LLM, no que falte más recursión.
- Profundidad 2 de DAGs de sub-tareas es difícil de depurar y no hay caso de uso comprobado.

**Comportamiento propuesto:**
Si `shouldSplit()` da `true` para una sub-tarea dentro de `executePlan()`, la sub-tarea se marca
`blocked` con `blocked_reason`:

```
"Output estimado (~N tokens) excede el presupuesto del modelo (M tokens).
 Reducí el scope del output (actualmente K archivos) o usá un modelo con mayor ventana de contexto."
```

Las sub-tareas que dependen de ella quedan `blocked` por cascada (ya funciona así en scheduler.ts:94).

**Por qué `blocked` y no `pending`:**
`pending` en el scheduler es "todavía no le toca correr" — el loop vuelve a intentarlo. `blocked`
es "necesita intervención humana explícita" (ya existe en TaskStatus). El usuario ve el motivo y
puede actuar: ajustar el YAML del plan y reejecutar, o dividir la sub-tarea a mano.

**Tope de re-intentos:**
El `shouldSplit` dentro de `executePlan` solo aplica al nivel 1 de sub-tareas (hijos directos del
task padre). No se activa dentro de otra corrida de `executePlan`. La profundidad máxima es 1.

---

## Cambios de código necesarios (resumen para B)

| Archivo | Cambio |
|---|---|
| `src/run/harness.ts` | Añadir `shouldSplit()` + lógica de gatillo entre paso 2 y 3. Nuevo `status: 'split_proposed'` en el tipo de retorno. |
| `src/run/scheduler.ts` | En `executePlan()`, verificar `shouldSplit()` para cada sub-tarea antes de correrla; marcar `blocked` si aplica. |
| `src/cli.ts` | En `runTask` call-site: manejar `split_proposed` — escribir `.plan.yaml`, mostrar plan, pedir aprobación, llamar `executePlan()`. |
| `src/dashboard/handlers/*.ts` | Manejar `split_proposed` desde el harness y devolver el plan al frontend (diseño detallado en B.3). |
| `src/tasks/schema.ts` | Agregar `'split_proposed'` al enum `TaskStatus` si el plan persiste en la BD. (Evaluar si hace falta.) |

**Archivos que NO se modifican:**
- `src/agents/planner.ts` — `generatePlan()` se reutiliza tal cual.
- `src/agents/executor.ts` / `executors/*.ts` — el harness no llama `executePlan`, no cambia el executor.
- Tests existentes de `execute-plan.test.ts` — el scheduler solo agrega una rama de early-return; los tests actuales siguen pasando.

---

## Preguntas abiertas para revisión con Carlos (A.2)

1. **`AVG_TOKENS_PER_OUTPUT_FILE = 2048`** — ¿suena razonable para el tipo de tareas que corren
   hoy (TS, Vue, Python)? ¿O prefiere empezar con un número más conservador (ej. 4096) para
   que el split se active antes y evitar cortes?

2. **`SPLIT_THRESHOLD = 0.7`** — el estimador es una aproximación (chars/4), no tokenización
   real. ¿Prefiere un threshold más agresivo (0.5 = split si el estimado supera la mitad del
   presupuesto) para compensar imprecisiones del estimador?

3. **Persistencia del plan:** ¿el `.plan.yaml` va en el directorio raíz del proyecto, en
   `.orchestos/splits/`, o en otro lugar? El directorio raíz es el más simple y visible; un
   subdirectorio mantiene el root limpio.

4. **Re-split recursivo:** ¿la decisión de "nunca re-split en Bloque A-B" es suficiente para el
   caso del crypto-dashboard (20 archivos), o hay un escenario donde el segundo nivel haría falta
   ya en este mes?

5. **Qué hacer si `generatePlan()` falla** (ej. proveedor no soporta function-calling Y el
   fallback YAML también falla): ¿devolver `pending` con aviso y dejar que el usuario decida, o
   intentar correr la tarea grande de todas formas?
