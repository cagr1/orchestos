# Executor Engine — diseño (Mes 16, Bloque G.1)

Diseño de la interface que desacopla la capa de verificación (contrato + checks +
QA + evidencia) del ejecutor que genera los archivos. Hoy ambas cosas viven
entrelazadas en `runTask()` (`src/run/harness.ts`) — este documento decide cómo
separarlas para que un segundo ejecutor (agéntico) pueda envolverse con la misma
capa de verificación sin duplicarla.

**No se toca código en este ítem.** G.2 hace la extracción; G.3 implementa el
ejecutor agéntico sobre esta interface.

## 0. Qué ya existe y se reusa (no se reinventa)

- `runToolLoop()` / `callWithTools()` (`src/providers/tool-call.ts`, Mes 13) — loop
  multi-turno de tool-calling probado en producción en el chat (`fetch_url`,
  `search_memory`). El ejecutor agéntico reusa esta función tal cual, no una
  reimplementación.
- `enforceContract()` + `normalizeRelPath()` (`src/run/contract.ts`, F4) — ya
  normaliza paths y bloquea escrituras fuera de `output[]`. Se mantiene como
  segunda línea de defensa post-hoc (ver §4e).
- `runChecks()` / `defaultChecksFor()` (`src/run/checks.ts`) — checks
  determinísticos declarados en `Task.checks`. No cambian.
- `RunContext` (`src/run/middleware.ts`) — ya trae `effectiveRoot`, `task`
  (con `input[]`/`output[]` ya resueltos por `memory-fetch`), `model`,
  `provider`, `prompt` armado. El engine recibe este contexto ya enriquecido,
  no reconstruye nada de la cadena de enrichment.
- `supportsToolCalling(provider, model)` (`tool-call.ts`) — heurística por
  prefijo de modelo ya usada en el chat. Se reusa para la decisión de fallback
  (§4d) en vez de inventar una nueva fuente de verdad.

## 1. La interface `ExecutorEngine`

```ts
// src/run/executors/types.ts (nuevo)
import type { CostBreakdownEntry } from '../transcript-parser.ts'  // ya existe

export interface ExecutorOutcome {
  files: FileChange[]          // FileChange ya existe en contract.ts — {path, content}
  inputTokens: number          // total del engine (suma de todas las iteraciones)
  outputTokens: number
  usd: number
  iterations: number           // 1 para single-shot; N para agéntico
  costByIteration: CostBreakdownEntry[]  // desglose por vuelta — reusa la estructura ya existente
  log: string[]                // trazas legibles para runs --detail / dashboard
}

export interface ExecutorEngine {
  run(
    ctx: RunContext,
    opts: { maxTokens: number; maxIterations: number },
  ): Promise<ExecutorOutcome>
}
```

**Decisiones sobre la firma:**

- `run()` devuelve `files: FileChange[]`, NO escribe a disco. Escribir sigue
  siendo responsabilidad de `enforceContract()` en el harness — mismo punto de
  control único que hoy, un solo lugar que decide qué toca el filesystem.
- El engine NO llama `insertRun`, NO corre `checks`, NO llama `runQA`. Esas
  cuatro cosas (contrato, checks, QA, evidencia) son universales a cualquier
  engine y quedan en el harness — es literalmente el punto de este bloque.
- `usd`/`inputTokens`/`outputTokens` que devuelve el engine son el costo total
  del generador. El harness sigue sumando el costo del QA judge por separado
  (ya resuelto en F2), el breakdown total no cambia de forma.
- **`costByIteration: CostBreakdownEntry[]`** — la MEDICIÓN del gasto (no un
  límite). Reusa `CostBreakdownEntry { label, model, inputTokens, outputTokens,
  costUsd }` de `transcript-parser.ts` tal cual — la misma estructura que hoy
  desglosa el costo de los sub-agentes. El engine agéntico emite una entrada por
  vuelta del loop (`label: 'iteration 1'`, `'iteration 2'`…); el single-shot
  emite una sola entrada. El harness la guarda en la columna `cost_breakdown_json`
  (ya existe) y se pinta SOLA con la infra ya construida: la tabla `agent / model
  / in / out / cost` de `runs --detail` (`cli.ts`) y del dashboard
  (`screens-ops.js`, `runs.html`), que ya renderiza cuando hay más de una
  entrada. Es exactamente la vista estilo OpenRouter Activity — tokens y costo
  reales por iteración — sin construir nada nuevo, solo poblando la estructura.
- `iterations`, `costByIteration` y `log` son campos nuevos — sirven para que
  `runs --detail` y el dashboard (G.4) muestren "agéntico, 4 iteraciones,
  desglose de costo por vuelta" vs. "single-shot, 1 llamada" sin adivinar nada.
- Si el engine lanza (error de red, parse imposible), el harness lo captura en
  su try/catch existente — mismo camino que hoy captura errores de
  `ctx.provider.chat()`. El engine no necesita su propio manejo de "falla
  total", ya hay uno.

## 2. Set de tools del agéntico v1

Cuatro tools, todas con el gate DENTRO de la tool (no solo post-hoc):

| Tool | Alcance | Gate |
|---|---|---|
| `read_file` | Dentro de `effectiveRoot`. Si `task.input[]` está declarado (no vacío), solo esos paths; si `input[]` está vacío, cualquier archivo del repo (mismo comportamiento que hoy: `input: []` significa "sin restricción declarada", ver `buildPrompt` iterando `task.input`). | Rechaza rutas fuera de `effectiveRoot` (incluye protección `..` — reusa el mismo principio anti-escape de `normalizeRelPath`, sin resolver `..`, simplemente niega si el path normalizado se sale del root). |
| `write_file` | SOLO paths dentro de `task.output[]` (normalizados con `normalizeRelPath`, mismo que F4). | Si el modelo pide escribir fuera de `output[]`, la tool devuelve un **string de error al modelo** (no una excepción que tumbe el loop) — ej. `"[Error: '<path>' is not in the declared output contract: <output.join>]"`. El modelo ve el error y se autocorrige en la siguiente iteración. Esto es la diferencia clave vs. hoy: single-shot descubre la violación al final (quema un intento entero); agéntico la descubre en la iteración N y puede arreglarla en N+1 sin gastar el run completo. |
| `list_dir` | Dentro de `effectiveRoot`. | Igual que `read_file` — sin salir del root. |
| `run_check` | SOLO los `cmd` que ya están declarados en `task.checks[]`. No ejecuta comandos arbitrarios que el modelo invente. | Si el modelo pide un `cmd` no declarado, la tool responde con error y lista los `cmd` permitidos — no lo ejecuta. Reusa `runChecks()` de `checks.ts` para el `cmd` puntual solicitado (un check a la vez, no la lista completa cada vez — el modelo decide cuándo correr cuál). |

**Por qué el gate va en la tool y no solo post-hoc:** el punto entero de
agéntico es iterar sobre errores. Si `write_file` solo pudiera fallar
silenciosamente y enterarse recién al final (como hoy), no hay ninguna
ventaja sobre single-shot salvo poder leer archivos — la ventaja real viene de
que el modelo puede corregir su propio error de contrato en el mismo run.

`write_file` acumula los archivos escritos (en memoria, no en disco todavía)
en un `Map<string, string>` interno al engine — el engine solo aplica los
cambios a disco a través del `ExecutorOutcome.files` que devuelve al harness al
terminar. Esto mantiene la invariante de "un solo punto que toca el
filesystem" (`enforceContract`) intacta — la tool `write_file` del loop
agéntico es una escritura *virtual* al buffer del engine, el harness hace la
escritura real después.

## 3. Terminación del loop (NO es un tope de gasto)

**Decisión (Carlos, 2026-07-02):** OrchestOS **no pone techos de gasto**. El
costo se **anuncia** (tokens y precio reales post-run, ver §1 `costByIteration`),
no se **limita** — misma línea que F0.8. El diseño original de G.1 proponía un
`maxUsd`/`budget` que corta el loop al superar un monto; se **elimina**. Razón:
nadie sabe poner bien ese número, y el modelo trabaja hasta agotar el crédito de
la cuenta de todos modos. El loop se corta por una sola razón: garantizar que
**termina**.

- `maxIterations` default **15**. Cada iteración = una ronda de tool use
  (llamada a `runToolLoop()`). Es una **garantía de terminación**
  (anti-loop-infinito: un modelo que no converge — `read_file` → `write_file`
  → `read_file`… sin parar — necesita un corte duro de vueltas o nunca
  retorna), **NO un límite de dinero**. Como efecto secundario acota cuánto
  puede gastar una tarea, lo que hace innecesario un `maxUsd` explícito.
- Al llegar al tope sin que el modelo pare (deje de pedir tools), el engine
  corta y devuelve lo acumulado en el buffer de `write_file` hasta ese punto —
  no es un fallo silencioso, `log` incluye la línea `"maxIterations reached"` y
  el harness lo trata igual que "missing declared outputs" si faltan paths
  (mismo path F3 ya cubre evidencia — ningún estado nuevo).
- `maxIterations` viene del harness, no del engine — se resuelve de
  `orcheConfig.agentic?: { maxIterations?: number }` con default `15` si no hay
  config (mismo patrón opt-in que `models.qa` de F2).
- **No hay corte por costo.** La única función del costo en el loop agéntico es
  la MEDICIÓN (§1 `costByIteration`) — mostrarte la verdad de lo que gastó cada
  vuelta, no frenarlo.

## 4. Selección de engine y fallback

- Campo opcional `engine?: 'single-shot' | 'agentic'` en `Task`
  (`src/tasks/schema.ts`) + default global en `orchestos.config.yaml`
  (`orcheConfig.executorEngine?: 'single-shot' | 'agentic'`, mismo patrón que
  `models.qa`: ausencia → resolución, no hardcode). **Default absoluto:
  `single-shot`** — cero cambio de comportamiento para todo lo existente,
  agéntico es opt-in explícito (por tarea o por config de proyecto).
- **(d) Fallback de soporte de tool-calling:** antes de invocar el engine
  agéntico, el harness llama `supportsToolCalling(ctx.providerName, ctx.model)`
  (ya existe en `tool-call.ts`, reusado tal cual — no se inventa una nueva
  fuente de verdad para esto). Si devuelve `false` (ej. `codex`, o un modelo
  de OpenRouter que no matchea los prefijos conocidos), el harness cae a
  `single-shot` y registra `log.info('agentic requested but model does not
  support tool-calling — falling back to single-shot')`. Mismo patrón de "log
  y proceder" que F2.2 usa para el caso de colisión juez==ejecutor — no
  bloquea la tarea, degrada con aviso.
- **(e) `enforceContract` post-hoc se MANTIENE** aun con el gate dentro de la
  tool `write_file`. Razón: el gate en la tool depende de que el modelo
  respete la respuesta de error de la tool — es defensa en profundidad, no
  reemplazo. Un modelo que ignore el error de la tool y devuelva de todos
  modos un path fuera de contrato en su `ExecutorOutcome.files` final debe
  seguir bloqueado por la misma verificación que ya corre para single-shot.
  El harness llama `enforceContract()` exactamente igual para ambos engines —
  es la razón de ser de este bloque (una capa de verificación, cualquier
  ejecutor).

## 5. Qué queda fuera de G.1 (decisiones explícitamente diferidas)

- Ejecutores externos (Claude Code headless, opencode) — `IDEAS.md` #15,
  gated en que `ExecutorEngine` funcione con el agéntico interno primero.
- Extender `ModelInfo` (`model-catalog.ts`) con soporte de tools publicado
  por OpenRouter (`supported_parameters` incluye `"tools"`) en vez de la
  heurística de prefijo actual — mejora posible pero no bloqueante para G.1;
  la heurística ya está probada en producción en el chat.

## Revisión

Revisado con Carlos (2026-07-02): el diseño original de §3 proponía un tope
de gasto (`maxUsd`/`budget`) — se eliminó por decisión explícita (OrchestOS
no pone techos de dinero, ver §3 actualizado) y se añadió `costByIteration`
como medición en su lugar. Con ese ajuste, el diseño se implementó completo:
G.2 (extracción single-shot), G.3 (ejecutor agéntico), G.4 (superficie
dashboard+CLI) y G.5 (gate comparativo con dinero real) — los 4 cerrados y
verificados en PLAN.md. G.5 encontró y corrigió 2 bugs reales de `maxTokens`
hardcodeado en `tool-call.ts`/`harness.ts` no anticipados en este diseño
(ver PLAN.md § Bloque G, G.5).
