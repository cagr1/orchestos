# LEDGER.md — Responsabilidad de LLMs sobre este repo

Registro append-only. Gobernanza de CÓMO se desarrolla OrchestOS (varios LLMs, distintas
sesiones, tocando el mismo repo) — **no es un feature de OrchestOS-el-producto**, no vive en
`src/`, no tiene superficie en el dashboard. Mismo estatus que PLAN.md/IDEAS.md/DONE.md/CLAUDE.md:
texto plano, versionado en git, legible por humano.

**Propósito**: distinguir tres comportamientos para saber con qué modelo conviene trabajar —
obediencia ciega (aceptable), desviación razonada con argumento sólido (el más valioso), y
desviación silenciosa / regresión (el que rompe reglas sin avisar). No es para castigar, es para
que Carlos tenga su propia base de conocimiento de cómo actúa cada LLM en este proyecto.

Diseño completo, campos y ejemplo → [PLAN.md § Mes 22 Bloque F, F.1](PLAN.md).
Cuándo es obligatorio agregar una entrada → [PLAN.md § Mes 22 Bloque F, F.2](PLAN.md) — el gate de
`scripts/pre-commit.sh` lo exige automáticamente cuando el commit toca un archivo listado en
`.claude/protected-rules.json`.
Reporte agregado (tabla por modelo) → `bun run ledger:report` ([PLAN.md § F.3](PLAN.md), pendiente
de implementar).

---


## 2026-07-20 16:53 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio (Bloque G/G.5) no toca la derivación de `max_tokens`/contextWindow — solo
agrega el import de `opencodeEngine` y una rama `else if (requestedEngine === 'opencode')` a la
selección de executor, más un ajuste de comentario en `shouldSplit()` para excluir también el
nuevo engine 'opencode' del split (mismo motivo ya existente para 'external': el executor no es la
API LLM directa). Cero líneas tocadas en el cálculo de `maxTokens`.
**Reversibilidad/evidencia**: commit de G.5 (feat(Bloque G/G.5): executor opencode (batch), cierra
G.5) — revertible con `git revert`, sin side-effects en datos. 797 tests · 0 fail · `tsc --noEmit`
limpio antes del commit.

---

## 2026-07-27 10:19 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio (Bloque G/G.3.3) no toca `max_tokens`/contextWindow — agrega
`clearRunSteps(ctx.task.id)` antes de `engine.run()` y pasa `onStep: (event) => insertRunStep(...)`
en el objeto `opts` que ya se le pasaba al engine (junto a `maxTokens`/`maxIterations`, sin
modificar esos dos campos). Cero líneas tocadas en el cálculo de `maxTokens`.
**Reversibilidad/evidencia**: commit de G.3.3 (feat(Bloque G/G.3.3): transporte + UI de cards en
vivo — cierra Bloque G.3) — revertible con `git revert`, sin side-effects en datos (tabla
`run_steps` nueva, no toca `runs`). 813 tests · 0 fail · `tsc --noEmit` limpio antes del commit;
verificado además en vivo contra el dashboard real (ver PLAN.md § G.3.3).

---

## 2026-07-27 11:44 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio (Bloque G/G.4.2b, nuevo executor `codex.ts`) toca dos puntos de
`harness.ts`: (1) `import { codexEngine }` + una rama `else if (requestedEngine === 'codex')` en
la selección de executor, mismo patrón que ya tenían `external`/`opencode`; (2) `shouldSplit()`
gana `|| task.engine === 'codex'` en su exclusión — mismo motivo ya documentado ahí para
`external`/`opencode` (el executor es un CLI, no la API LLM directa, así que el split por tokens
no aplica). Cero líneas tocadas en la derivación de `maxTokens`/`contextWindow`.
**Reversibilidad/evidencia**: commit de G.4.2b (feat(Bloque G/G.4.2b): ExecutorEngine real para
Codex) — revertible con `git revert`, sin side-effects en datos. 843 tests · 0 fail ·
`tsc --noEmit` limpio antes del commit. Contrato de `codex exec --json` verificado con un probe
real contra un git repo temporal (2026-07-27) antes de codear el parser — no asumido.

---

## 2026-07-28 09:51 America/Guayaquil — codex-gpt-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio K.2 solo pasa el `checksResults` que el harness ya calculaba a `runQA()`;
no modifica `maxTokens`, `contextWindow` ni la selección del presupuesto de salida. La línea
tocada está en la llamada al QA, después de ejecutar los checks deterministas. Cero líneas tocadas
en la derivación de `maxTokens`.
**Reversibilidad/evidencia**: commit de K.2 (`feat(qa): expose check results to judge`) — revertible
con `git revert`, sin side-effects adicionales en datos. Suite completa: 875 tests · 0 fail ·
`tsc --noEmit` limpio.

---

## 2026-07-28 10:41 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio K.4b agrega el segundo juez adversarial (`runAdversarialQA()`) entre
`qa.verdict === 'pass'` y `mergeWorktreeBack()`, reusando `qaJudge.model`/`qaJudge.provider` ya
resueltos — no toca `maxTokens`, `contextWindow` ni la selección del presupuesto de salida en
ningún punto. Las líneas nuevas leen `orcheConfig?.adversarialQA`, acumulan tokens del segundo
call en `qa.inputTokens/outputTokens` (para que `qaCost`/`totalCost`, ya existentes, los incluyan)
y downgradean `qa.verdict`/`qa.reason` cuando `REFUTED` — todo aguas abajo de donde `maxTokens` ya
se calculó para el executor. Cero líneas tocadas en esa derivación.
**Reversibilidad/evidencia**: commit de K.4b (`feat(qa): opt-in adversarial second QA judge`) —
revertible con `git revert`; feature opt-in (`orcheConfig.adversarialQA`, default off), cero
side-effects en runs existentes (columnas nuevas `adversarial_verdict`/`adversarial_reason` vía
`safeAddColumn`, NULL para filas previas). 886 tests · 0 fail · `tsc --noEmit` limpio antes del
commit. Gate destrabado con evidencia sintética real (3 tests adversariales en `qa-judge.test.ts`
probando que K.4a deja pasar evidencia literal-pero-engañosa), no por decisión de saltarlo.

---

## 2026-07-29 16:20 America/Guayaquil — codex-gpt-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: M4 agrega el middleware de roadmaps, el bloqueo explícito de toolchains ausentes y la
selección de checks deterministas; todo ocurre antes o después de la derivación existente y no
modifica `maxTokens`, `contextWindow` ni el presupuesto de salida.
**Reversibilidad/evidencia**: commit M4 (`feat: integrate roadmaps into task execution`) — revertible
con `git revert`, sin cambios de datos. `bunx tsc --noEmit` limpio; tests específicos M4/M3/checks:
51 pass, 0 fail.
