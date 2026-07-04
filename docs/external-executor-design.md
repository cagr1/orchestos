# Ejecutor externo — diseño (Mes 17, Bloque A.1)

Tercera implementación de `ExecutorEngine` (`src/run/executors/types.ts`, G.1/G.2):
en vez de generar archivos vía LLM directo (single-shot) o vía tool-loop propio
(agéntico), delega la edición completa a un proceso externo (Claude Code
headless) que corre dentro del worktree del sandbox. La capa de verificación
(contrato + checks + evidencia + QA) no cambia una línea — es la tesis del mes
(ver PLAN.md § MES 17).

**No se toca código en este ítem.** B implementa sobre esta interface.

## 0. Qué ya existe y se reusa

- `ExecutorEngine` (`src/run/executors/types.ts`) — interface universal,
  `run(ctx, opts) → ExecutorOutcome`. No se modifica su forma pública; ver §2
  sobre `opts`.
- `enforceContract()` (`src/run/contract.ts:75`) — hoy es **todo o nada**: si
  cualquier archivo en `response.files` cae fuera de `allowedPaths`, lanza
  `CONTRACT VIOLATION` y no escribe nada. Esto es clave para §4 — no hace
  falta reimplementar semántica de descarte parcial, se reusa tal cual.
- Ciclo de vida del worktree (`src/run/sandbox.ts`, `src/run/harness.ts:144-151,499-502`)
  — `runTask()` tiene un `finally` que llama `mergeWorktreeBack(worktree, 'discard')`
  para cualquier worktree que siga vivo al salir de la función, sin importar
  por qué return/throw se llegó ahí. Confirmado leyendo el código: el path de
  `CONTRACT VIOLATION` (línea 337) hace `return` sin merge explícito, y el
  `finally` lo cubre igual. Esto es lo que el PLAN llama "el sandbox actual ya
  resuelve el discard" — verificado, no asumido.
- `CostBreakdownEntry` (`src/run/transcript-parser.ts:3`) — mismo shape que ya
  usa `agentic.ts` para su entrada agregada única.
- `maxOutputTokensFor` / `calcCost` (`src/router/pricing.ts`) — catálogo de
  pricing existente; si el modelo no está en catálogo, el patrón ya establecido
  (F0.8) es reportar costo desconocido, nunca `$0` silencioso.
- Baseline de comparación (G.5, `DONE.md` §MES 16): tarea real — agregar una
  línea de JSDoc a `src/dashboard/handlers/skills.ts` (419 líneas), mismo
  modelo en los 3 engines. single-shot: $0.0032, perfecto. Agéntico (post-fix):
  `tsc` limpio, sin truncar. D.1 corre la misma tarea con el ejecutor externo.

## 1. Alcance del v1: Claude Code headless, no adaptador genérico

Se descarta construir una interfaz `external` con adaptadores por herramienta
(`claude-code` / `opencode`) desde el arranque — sería abstraer para un segundo
caso que todavía no existe (YAGNI). Decisión:

- `engine: 'external'` es un tercer valor único de `TaskEngine`
  (`src/tasks/schema.ts:3`), igual que `'single-shot'` y `'agentic'` hoy.
- `src/run/executors/external.ts` implementa `ExecutorEngine` shelleando
  **Claude Code CLI en modo headless** (`claude -p`) — ya instalado en la
  máquina de desarrollo, emite JSON estructurado con `usage` real (§3), y es
  la propuesta de partida que el propio PLAN.md sugiere.
- Si más adelante se agrega opencode, el punto de extensión es una opción de
  config (`orchestos.config.yaml: external.tool`, default y único valor
  soportado en v1: `'claude-code'`), no un nuevo valor de `TaskEngine` ni una
  reescritura de `external.ts`. No se construye ese branching ahora — se dejan
  el nombre del engine y el archivo lo bastante genéricos para no bloquearlo,
  sin implementarlo.

### 1.1 "Externo" es la herramienta de agente, no el LLM

Aclaración importante porque es fácil confundirlo: `engine: external` no es un
cuarto proveedor de LLM — single-shot y agéntico ya soportan cualquier
proveedor/modelo declarado en `tasks.yaml` (OpenAI, DeepSeek, Anthropic
directo, Ollama, etc.), esa elección es ortogonal al engine. `external` es
específicamente "delegar la tarea completa a un CLI de agente de código ya
existente" — v1 delega a Claude Code, que internamente usa modelos Claude
(no es intercambiable dentro de v1; eso es una decisión de Claude Code, no
nuestra).

**¿Qué pasa si el usuario no tiene Claude Code instalado?** Ese caso ya está
en el plan como C.2: detección honesta del binario al seleccionar el engine
— error claro y explicable en dashboard/CLI ("Claude Code no está instalado,
instálalo con `npm install -g @anthropic-ai/claude-code` o elige otro engine"),
nunca un fallo críptico a mitad de un run ya facturado. Si el usuario no tiene
ni Claude Code ni planea instalarlo, simplemente no usa `engine: external`
para esa tarea — sigue teniendo single-shot y agéntico disponibles con
cualquier LLM que ya tenga configurado. `external` es opt-in por tarea, igual
que agéntico lo es hoy (`ctx.task.engine ?? orcheConfig?.executorEngine ?? 'single-shot'`,
`harness.ts:279`) — nunca un requisito para usar el resto del producto.

## 2. (a) Cómo pasarle el contrato al ejecutor externo

Dos capas, igual que en el ejecutor agéntico (defensa en profundidad, F4) —
**ninguna es la frontera real de seguridad**:

1. **Prompt explícito**: el mensaje que recibe `claude -p` incluye una sección
   generada desde `ctx.task.output` — "Solo puedes crear/editar estos
   archivos: X, Y, Z. No toques ningún otro archivo del repositorio." — mismo
   texto que ya arma `toolInstructions` en `agentic.ts:168-176`, reusado.
2. **Mecanismo nativo de Claude Code**: `--allowedTools "Edit,Write,Read,Glob,Grep"`
   restringe qué *tipo* de herramienta puede usar (edición de archivos sí,
   ejecución de shell arbitraria no) — pero Claude Code no soporta restricción
   nativa *por path* a nivel de flag/settings con la granularidad que
   necesitamos, así que esta capa es coarse-grained (reduce superficie, no
   garantiza el contrato).

**La frontera real sigue siendo `enforceContract()` post-hoc** (§4), exactamente
como ya es cierto para single-shot y agéntico. El prompt y `--allowedTools` son
"mejor esfuerzo" para que el proceso externo coopere y no necesite corregirse
después — no son el control de seguridad.

## 3. (b) Cómo capturar costo/tokens de un proceso externo

`claude -p "<prompt>" --output-format json` emite un único JSON a stdout al
terminar con, entre otros campos: `usage.input_tokens`, `usage.output_tokens`,
`total_cost_usd`, `num_turns`, `duration_ms`. Es dato real de uso, no una
estimación nuestra — se parsea directo:

```ts
inputTokens: json.usage.input_tokens,
outputTokens: json.usage.output_tokens,
usd: json.total_cost_usd,        // reportado por Claude Code, no recalculado con calcCost()
iterations: json.num_turns,
costByIteration: [{               // una sola entrada agregada — mismo patrón honesto que agentic.ts:208-217:
  label: `external (claude-code, ${json.num_turns} turn${json.num_turns === 1 ? '' : 's'})`,
  model: ctx.model,
  inputTokens: json.usage.input_tokens,
  outputTokens: json.usage.output_tokens,
  costUsd: json.total_cost_usd,
}]
```

`--output-format stream-json` expondría costo por turno individual, pero eso es
complejidad que no se justifica en v1 (mismo argumento que ya usó G.1 para
agéntico: una entrada agregada honesta es preferible a N entradas falsas).

**Si el proceso termina sin emitir JSON válido** (crash, timeout matando el
proceso a mitad, versión de Claude Code sin soporte del flag): el costo se
reporta como **desconocido explícito**, nunca `$0` — misma lección de F0.8. En
la práctica esto significa: el `ExecutorOutcome`/evidencia debe poder cargar
`usd: null` o un flag `costUnknown: true` en vez de forzar `0`; B.1 decide el
mecanismo exacto de propagación (probablemente un nuevo tipo de error análogo
a `ExecutorLLMCallError`, capturado por el harness igual que hoy).

**Nota para un futuro adaptador opencode** (no se implementa en B, ver §1): si
opencode no expone usage estructurado confiable, aplica la misma regla —
costo desconocido, nunca cero. Esto es parte del contrato de cualquier
adaptador futuro, documentado acá para que no se repita la discusión.

## 4. (c) Timeout para garantizar terminación

Mismo rol que `maxIterations` en el agéntico: **garantía de terminación,
NO un tope de gasto** (decisión Carlos 2026-07-02, ver
`docs/executor-engine-design.md` §3 y el comentario en `agentic.ts:16-18`) —
OrchestOS no pone techos de dinero.

`ExecutorEngine.run(ctx, opts)` no cambia de forma pública para no romper
single-shot/agentic — se le agrega un campo **opcional** a `opts`:

```ts
opts: { maxTokens: number; maxIterations: number; timeoutMs?: number }
```

Campo opcional y aditivo: los otros dos engines simplemente lo ignoran (no hay
ripple). El external engine sí lo usa como wall-clock real (`spawn()` + timer
que envía `SIGTERM` y, si no responde, `SIGKILL`), porque "iteración" no es un
concepto de primera clase para un CLI externo que no controlamos turno a
turno como sí controlamos `runToolLoop()`.

Config nuevo en `orchestos.config.yaml` (sibling de `agentic.maxIterations`,
no lo reemplaza ni lo reinterpreta):

```yaml
external:
  timeoutMs: 1200000   # 20 min, default
```

Si el proceso excede `timeoutMs`: se mata, se trata como fallo de ejecución
(análogo a `ExecutorLLMCallError` — nunca respondió una salida usable), el
worktree se descarta vía el `finally` ya existente (§0), y el costo se reporta
según §3 (desconocido si no alcanzó a emitir JSON antes de morir).

## 5. (d) Qué pasa si el externo toca archivos fuera de `output[]`

Ya resuelto por composición de piezas existentes, verificado en el código
(§0) — no hace falta lógica nueva de revert:

1. El external engine, al terminar el proceso (o al matarlo por timeout),
   calcula el diff del worktree contra el snapshot pre-run: `git diff --name-only`
   (o `git status --porcelain`) sobre `ctx.effectiveRoot`, para **todos** los
   archivos tocados — no solo los declarados en `output[]`.
2. Para cada path tocado, lee el contenido completo post-cambio y arma
   `files: FileChange[]` con **el diff completo**, autorizado o no.
3. El harness aplica `enforceContract(ctx.effectiveRoot, { files }, ctx.task.output)`
   exactamente como ya hace para los otros dos engines (`harness.ts:331`) — sin
   cambios. Si hay algún archivo fuera de `output[]`, `enforceContract()` lanza
   `CONTRACT VIOLATION` (todo o nada, comportamiento actual sin modificar).
4. El `catch` de ese throw (`harness.ts:332-338`) retorna `status: 'blocked'`
   sin hacer merge. El `finally` de `runTask()` descarta el worktree completo
   (`mergeWorktreeBack(worktree, 'discard')`) — todo lo que el proceso externo
   escribió directo a disco, autorizado o no, desaparece con el worktree.

**Requisito nuevo que sí hay que declarar explícitamente** (no existía como
restricción dura para los otros dos engines, porque ellos nunca tocan disco
antes de que el harness decida): el external engine **requiere sandbox en
modo `worktree`** — si `resolveSandboxMode()` cae a `'cwd'` (ej. working tree
sucio), el external engine debe **rehusarse a correr** en vez de dejar que un
proceso que no controlamos edite el repo real directamente. single-shot y
agéntico toleran modo `cwd` porque nunca escriben fuera de la decisión del
harness; external no tiene esa garantía estructural, así que la garantía tiene
que venir de negarse a correr sin worktree. B.1 implementa este chequeo al
inicio de `run()`.

## 6. Resumen de decisiones (para A.2)

| # | Decisión | Resumen |
|---|---|---|
| 1 | Alcance v1 | Claude Code headless (`claude -p`) únicamente; `engine: 'external'` genérico, sin adaptador opencode todavía |
| a | Contrato al ejecutor | Prompt explícito + `--allowedTools` (coarse) — frontera real sigue siendo `enforceContract()` post-hoc |
| b | Costo/tokens | Parsear `--output-format json` (`usage`, `total_cost_usd`, `num_turns` reales); si no hay JSON válido, costo **desconocido explícito**, nunca `$0` |
| c | Timeout | `opts.timeoutMs` opcional y aditivo a `ExecutorEngine.run()`; wall-clock, config `external.timeoutMs` (default 20min), garantía de terminación — no tope de gasto |
| d | Archivos fuera de `output[]` | Diff completo del worktree → `enforceContract()` sin cambios (todo o nada) → `finally` existente descarta el worktree. Requisito nuevo: external exige modo `worktree`, se niega a correr en `cwd` |

Próximo paso: A.2, revisión de este documento con Carlos antes de abrir Bloque B.
