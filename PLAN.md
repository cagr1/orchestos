---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: mes-26-activo--backlog-canonico-categoria-bajo
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.

**Delegación — NO es una leyenda, son muros dirigidos a ti, el que ejecuta (endurecido 2026-07-15):**
- 🧠 = **Claude implementa** — requiere criterio arquitectural o decisión de diseño.
- ⚡ = **DeepSeek implementa** — tarea bien especificada. **Si eres Claude: NO la implementas, NO la
  adelantas porque sea trivial o esté adyacente a lo tuyo, NO te ofreces a hacerla.** Si un ⚡ está
  sin cerrar y bloquea tu 🔍, **PARA y repórtalo** — no lo absorbas.
- 🔍 = **revisión/gate obligatorio por Claude** — independiente de quién implementó.

**Regla de alcance (scope-lock, 2026-07-15):** ejecuta **EXACTAMENTE** el/los ítem(s) que el usuario
nombró — nada adyacente, ni el prerequisito, ni el siguiente, sin instrucción explícita. Si el ítem
nombrado tiene un prerequisito sin cerrar, **PARA y avísalo**; no lo hagas en silencio. Motivo real
(2026-07-15): con "continua con A.4" un LLM tocó A.3 (⚡, ajeno) y se ofreció a hacer A.5 (⚡, ajeno).

**Regla de commits (cadencia, 2026-07-15):** cada ítem cerrado (`[x]`) se commitea **en el mismo
turno** en que se cierra. Tras 2-3 commits locales, `git push origin master` **automáticamente**
(autorización permanente en CLAUDE.md) — **NO pidas permiso por lo ya autorizado, NO acumules** una
pila de cambios sin commitear. `--force` sigue requiriendo pedido explícito.

**Regla de documentación obligatoria (2026-07-02):** todo hallazgo — bug real, deuda técnica, feature huérfana, contradicción entre `tasks.yaml`/DONE.md y el código real — se convierte en un ítem de este archivo (o de IDEAS.md si es backlog no inmediato) ANTES de tocar código. Si no está escrito acá, no se corrige. Motivo: una auditoría completa (2026-07-02) encontró deuda documentada en prosa dentro de DONE.md ("anotado como deuda conocida") que nunca se tradujo a un ítem accionable y por eso nadie la persiguió durante 3 meses (ver Bloque F0).

**Regla de flujo IDEAS→PLAN→DONE (decisión Carlos, 2026-07-02):** cuando una idea pasa de IDEAS.md a PLAN.md (se convierte en el eje o en un bloque de un Mes), **se ELIMINA de IDEAS.md en el mismo commit** — no queda duplicada en ambos. La evidencia de que se realizó vive siempre en DONE.md (documentación extensa al cierre del Mes). IDEAS.md es solo backlog vivo: lo que está ahí es porque NADIE lo está haciendo todavía.

---

## MES 26 — Backlog canónico, categoría **Bajo** (abierto 2026-08-06)

Mes 25 cerró los tres bloques que graduaron de la categoría **Mínimo** (vacía desde entonces).
Este Mes ejecuta la categoría **Bajo** del backlog canónico de [IDEAS.md](IDEAS.md), en el orden
del índice — que es el **único** orden de ejecución (regla desde 2026-07-30). Al graduar cada
idea se elimina de IDEAS.md en el mismo commit.

| Bloque | Idea de IDEAS.md | Estado |
| --- | --- | --- |
| **Q** | `#2` `verification-before-completion` (superpowers) | ✅ cerrado (2026-08-06) |
| R | `#3` `requesting-code-review` / `receiving-code-review` | pendiente |
| S | `#5` Resolver imports Ruby | pendiente |
| T | `#19` `engine: external` sin `checks:` | pendiente |
| U | `#40` Editor de Constitution con Guardar/Limpiar | pendiente |
| V | `#46` Spike de Graphify | pendiente |
| W | `#58` `tool-policy.ts` dead code | pendiente |

### Bloque Q — ⚡🧠 IDEAS #2: `verification-before-completion`

**Lo que pedía la idea**: *"Checklist que confirma que el fix realmente funciona antes de declarar
`done`. Complementa el QA loop existente. Entra como skill vía la puerta importar. Esfuerzo: bajo
— skill nueva, sin motor nuevo."*

**Corrección de alcance (verificada en código antes de escribir contenido, 2026-08-06)** — misma
disciplina que forzó la corrección de alcance del Bloque N: la idea asumía "solo contenido", y hay
un hallazgo real que la idea no conocía.

1. **No duplica `qa-structured`** — confirmado en N.5.1 y revalidado: son **actores distintos**.
   `qa-structured` es el **juez** evaluando criterios de aceptación después del hecho;
   `verification-before-completion` es disciplina del **ejecutor** antes de afirmar que terminó.
   Que compartan el principio ("evidencia antes que afirmación") no las hace la misma skill.
2. **El hueco existe y es citable, no hipotético.** El prompt del ejecutor agéntico
   ([agentic.ts:173-181](src/run/executors/agentic.ts)) dice hoy, textual:
   `Declared checks you can run to verify your work: …` (**"you can"** — opcional) y
   `When all declared output files are written and correct, stop calling tools` (**"and correct"**
   — autoevaluado, sin exigir evidencia). Es literalmente la invitación al modo de fallo que esta
   skill ataca. El harness re-corre los checks después y atrapa la mentira — **pero solo cuando
   hay checks declarados**: `defaultChecksFor()` ([checks.ts:64](src/run/checks.ts)) no genera
   ninguno para Python/Rust/Go/C#/markdown, ni para nada si falta `node_modules`. En esos casos el
   único gate es el juez de QA leyendo archivos.
3. **Por eso el bloque se parte en contenido (⚡) y wiring (🧠)** — importar la skill sin mirar el
   punto 2 habría dejado el hueco real intacto y la skill como contenido decorativo.

- [x] **Q.1 — ⚡ (2026-08-06) Importar la skill, verbatim, por la vía real.** Autoría de
  `skills/verification-before-completion.yaml` portando **fiel** (no parafraseado) el contenido de
  `obra/superpowers/skills/verification-before-completion/SKILL.md` (MIT): `iron_law` ("NO
  COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE", ≤300 chars), la tabla
  *Rationalization Prevention* (8 pares) → `common_rationalizations`, *Red Flags - STOP* (8) →
  `red_flags`, la *Gate Function* de 5 pasos y la tabla *Common Failures* → `instructions`,
  `when_to_use` como condición de disparo. Registrar en
  [docs/sources-registry.yaml](docs/sources-registry.yaml) — **la entrada ya existe**
  (`superpowers-verification`) apuntando a `qa-structured` con la nota *"vigilar por si aparece
  contenido portable"*: ese momento llegó, así que la entrada se **actualiza** (nuevo
  `local_artifact`), no se duplica. **Límite duro**: contenido copiado fiel de la fuente, cero
  invención — es el error exacto que costó N.5.1 (3+3 rationalizations inventadas vs. las 10+13
  reales). Delegable a Codex con la fuente literal a la vista.

  **Cerrado 2026-08-06 — delegado a Codex (`codex exec --sandbox workspace-write`), verificado
  antes de aceptarlo** ([[feedback-verificar-progreso-delegado]]): la verificación no fue leer su
  reporte, fue un script que compara el YAML cargado por `loadSkill()` contra la tabla real de
  `/tmp/vbc-source.md` par por par. Resultado: `iron_law` **byte-idéntico** a la fuente, **8/8**
  `common_rationalizations` verbatim, **8/8** `red_flags` verbatim, cero invención. Respetó los 4
  límites duros: tocó solo los 2 archivos autorizados (`git status` lo confirma), **no** agregó
  `activation` (queda para Q.2), no commiteó. La entrada `superpowers-verification` del registro se
  **actualizó** (no duplicó): `local_artifact` ahora apunta a la skill nueva y la nota conserva el
  matiz de N.5.1 (`qa-structured` sigue siendo prima independiente, no traducción). **25 skills**
  en el catálogo (eran 24), 0 sin `when_to_use`. 1099 tests · 0 fail · `tsc --noEmit` limpio ·
  `bun run test:coverage` verde.
- [x] **Q.2 — 🧠 (2026-08-06) Decidir y cablear dónde aplica de verdad (el hallazgo del punto 2).** El
  `activation` de esta skill no es obvio y decidirlo mal la vuelve contenido muerto: con
  `mode: suggest` + `phases: [implement, fix]` sería la **4.ª** candidata de ese bucket, y el
  desempate de O.2 devuelve *sin asignar* con 3+ candidatas — se auto-anularía. Decidir con el
  contrato O.0 en la mano y **declarar el porqué**, no elegir por inercia. Incluye el arreglo del
  wording del prompt agéntico si la decisión es que la disciplina es transversal (no por-tarea) —
  **acotado a redacción de prompt existente, sin maquinaria nueva**; si crece más que eso, para y
  se registra como idea aparte en vez de expandir el bloque en caliente.

  **Decisión: `mode: explicit` + arreglar el prompt del ejecutor. Las dos mitades, y el porqué de
  cada una declarado en el propio YAML** (no por omisión, regla de N.7b):
  - **No `suggest`**: verificado ejecutando `pickAutoSkill()` con el escenario real de O.4
    (`pre-task-alignment` + `test-writer` + `tdd-enforcer`) — ya devuelve *sin asignar* con 3
    candidatas; sumar una 4.ª solo empeora el empate. Habría degradado la auto-selección.
  - **No `automatic` + `[review]`**: los gates automáticos corren en el stage de QA, donde el actor
    es el **juez** — y ese lado ya lo cubre `qa-structured` con su propio `iron_law`. Esta skill es
    disciplina del **ejecutor**, otro actor. Verificado con `resolveGates()` en las 5 fases: no
    aparece como gate en ninguna, que es lo correcto.
  - **La disciplina en el runner propio no depende de ganar un slot**: es transversal a toda
    corrida agéntica, así que vive en el prompt ([agentic.ts](src/run/executors/agentic.ts)) —
    `checks you can run` → *"Run them with run_check before you stop"*; y para el caso sin checks,
    donde antes no quedaba ninguna exigencia, → *"Read back what you wrote with read_file"*. La
    condición de parada pasó de *"written **and correct**"* (autoevaluado) a *"written AND you hold
    evidence it is correct"*. Redacción, cero maquinaria nueva — el límite del ítem se respetó.
  - **No se duplica contenido de la skill dentro del código** (sería el anti-patrón de N.4.5): el
    prompt exige evidencia, no recita el `iron_law`.
  - 3 tests nuevos ([agentic-engine.test.ts](src/__tests__/agentic-engine.test.ts)) que miran el
    system prompt **real capturado del body del request**, no la constante en el código, e incluyen
    guardas de regresión contra la redacción permisiva vieja.
- [x] **Q.3 — 🔍 (2026-08-06) Gate contra el prompt real compilado y una corrida real**
  ([[feedback-verificar-gates-en-vivo]]), no solo `bun test`: que el `iron_law` aparezca en el
  prompt que sale al ejecutor (no solo en el YAML), y una corrida real de una tarea **sin checks
  deterministas posibles** (el caso donde el hueco duele) confirmando el comportamiento decidido
  en Q.2. Runs de prueba borrados de la DB real al terminar
  ([[reference-test-fixtures-leak-into-real-db]]).

  **(a) Prompt compilado**: `compileClaude`/`compileCursor`/`compileOpenAI` sobre la skill real —
  `iron_law` presente en los 3, **antes** de `instructions`, con las 8 rationalizations. No es el
  YAML: es lo que se le entrega a la herramienta.

  **(b) Gate causal con dinero real, con control** — mismo patrón que A.4 (Mes 22). Proyecto
  scratch fuera del repo, tarea con output `.md` (`defaultChecksFor()` no genera **ningún** check
  — el caso exacto donde el harness no puede atrapar una afirmación falsa), `gpt-4o-mini`, y el
  `fetch` instrumentado para capturar los `tool_calls` reales:

  | | instrucción de evidencia en el prompt | tool calls reales | rondas |
  |---|---|---|---|
  | **control** (redacción vieja) | *(no llegó ninguna)* | `write_file` | 2 |
  | **con el fix** | *"Read back… with read_file"* + *"you hold evidence"* | `write_file` → **`read_file`** | 3 |

  Misma tarea, mismo modelo, mismo proyecto: con la redacción vieja el modelo **escribió y paró sin
  verificar nada**; con el fix leyó de vuelta lo que había escrito antes de parar. La evidencia es
  la traza de tool calls capturada del request, no el reporte del modelo — que es literalmente lo
  que enseña la skill importada en Q.1. Runs y proyecto scratch borrados; `SELECT` de residuos
  contra la DB real devuelve 0.

**Bloque Q cerrado (Q.1–Q.3).**

### Bloque R — ⚡ IDEAS #3: par `requesting-code-review` / `receiving-code-review`

**Lo que pedía la idea**: *"Validación estructurada antes de mergear y cómo procesar feedback. Dos
skills que entran por la puerta importar. Esfuerzo: bajo — dos skills, sin motor nuevo."*

**Verificación de alcance antes de escribir contenido (misma disciplina que N y Q, 2026-08-06)** —
a diferencia de `#2`, acá **no hay un hueco de wiring citable que corregir**, verificado, no
asumido:
- `requesting-code-review` es disciplina de **cuándo despachar un subagente revisor**.
  [mergeWorktreeBack()](src/run/sandbox.ts:82) confirma que el harness de OrchestOS mergea al
  branch de sandbox automático tras un QA pass — **no hay gate de aprobación humana antes de
  mergear**, y crear uno sería motor nuevo (fuera de "Bajo", necesitaría plan corto). No se
  inventa ese gate acá.
- `receiving-code-review` es disciplina de **cómo procesar feedback humano antes de implementarlo**.
  Verificado en `dashboard/handlers/tasks.ts`: no existe un endpoint de "rechazar con comentario y
  reintentar" — todo `retry_reason` en el harness viene del veredicto **automático** de QA
  ([cli.ts](src/cli.ts), 8 sitios), nunca de texto libre de un humano. No hay bucle de feedback
  humano al que atarle disciplina.
- **Conclusión: el reclamo original de la idea ("sin motor nuevo") es correcto para este par** —
  a diferencia de `#2`, donde "sin motor nuevo" resultó falso. Entran como contenido puro,
  igual que las 8 skills de `skills/pro/` ya existentes (ninguna de esas 8 tiene `activation:`
  tampoco — son catálogo importable, no automático).
- **Ubicación**: `skills/pro/`, no `skills/` — son import puro del pack de superpowers, sin skill
  nativa preexistente a la que fusionarse (a diferencia de `tdd-enforcer`/N.5.1). Mismo criterio
  documentado en DONE.md § Mes 11 para las 8 pro existentes.
- **Nota, no acción**: `N.7c` ya portó el Red Flag de `requesting-code-review` ("no saltar review
  por simple") como `anti_pattern` en `skills/pro/code-review.yaml`. Esa skill sigue siendo el
  **dador** de una revisión; estas dos son el **solicitante** y el **receptor** — actores
  distintos, sin duplicación real, ver punto 1 de la corrección de alcance del Bloque Q.

- [ ] **R.1 — ⚡ Importar las dos skills, verbatim, por la vía real.** Autoría de
  `skills/pro/requesting-code-review.yaml` y `skills/pro/receiving-code-review.yaml` portando
  fiel el contenido de `obra/superpowers/skills/requesting-code-review/SKILL.md` y
  `.../receiving-code-review/SKILL.md` (MIT). `requesting-code-review`: `common_rationalizations`
  (2 pares de "Common Rationalizations"), `red_flags` (la lista "Never:" de "Red Flags"),
  `instructions` con "When to Request Review" + "How to Request" + placeholders del template.
  `receiving-code-review`: sin tabla de rationalizations en la fuente — `instructions` con "The
  Response Pattern", "Forbidden Responses", "Source-Specific Handling", "YAGNI Check", "When To
  Push Back"; `anti_patterns` desde "Common Mistakes" (7 filas); `examples` desde "Real Examples".
  Registrar ambas en [docs/sources-registry.yaml](docs/sources-registry.yaml) como entradas
  nuevas (no hay entrada previa para ninguna de las dos). **Límite duro**: cero invención, mismo
  error que costó N.5.1. Delegable a Codex con las 2 fuentes literales a la vista.
- [ ] **R.2 — 🔍 Gate de fidelidad + integridad del catálogo**, más liviano que Q.3 a propósito —
  no hay comportamiento de runtime que gatear (R.1 lo estableció: sin motor nuevo, sin wiring).
  Verificar contra la fuente real (no el reporte de Codex): contenido de `common_rationalizations`/
  `red_flags`/`anti_patterns` coincide con las tablas de origen; **27 skills** en el catálogo
  (eran 25 tras Q.1); ninguna de las dos aparece en `resolveGates()` en ninguna fase (correcto —
  no llevan `activation`); `tsc --noEmit` + `bun run test:coverage`.

---

## MES 25 — Pendientes heredados de los cierres 22–24 + backlog canónico (N, O, P)

- [x] **SÍ — Mes 25 cerrado (2026-08-06)**
  Cerró los pendientes heredados de Mes 22-24 (K.6.2-R7, L.5.7, L.6.2, M ×2) y abrió la ejecución del backlog canónico por esfuerzo de IDEAS.md (regla desde 2026-07-30: el orden de IDEAS.md es el único orden de ejecución). Tres bloques completos: **N** — endurecimiento de skills (Iron Law/Common Rationalizations/Red Flags) portado a `buildSections()`/al ejecutor propio (N.4.5, hallazgo real: el endurecimiento llegaba a Claude Code/Cursor pero nunca al runner de OrchestOS) y auditado contra las fuentes reales (`obra/superpowers`, `mattpocock/skills`) skill por skill, no por nombre — match nominal ≠ match semántico fue el hallazgo de método (N.7b/N.7c). **O** — las skills se activan solas: contrato de activación (`activation.mode/phases/triggers`, O.0), skills resueltas desde la instalación no desde `cwd` (O.1), el planner ve el catálogo y asigna skill por sub-tarea (O.2), gates transversales (`security-review`/`qa-structured`) que el mismo LLM ejecutor no puede descartar (O.3) — verificado en vivo con dinero real contra un proyecto scratch: código con SQL concatenada + credenciales hardcodeadas fue rechazado por el QA judge citando OWASP explícitamente, el checklist inyectado llegó al juez real (O.4). **P** — vigilancia de deriva de fuentes externas (`sources-drift`): registro por path exacto (no repo completo), detección mecánica vía `gh api`, y un paso opcional de resumen vía LLM que lee el diff real y redacta una propuesta para revisión humana (P.4), nunca aplica nada solo. Hallazgo real de hygiene durante O.3: `ctx.allowedTools` en `tool-policy.ts` es dead code (ningún ejecutor lo lee) — documentado y registrado como IDEAS.md #58 en vez de cablearlo sin plan. 1099 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` (comando exacto de CI) verde.
  Ver historial completo → [DONE.md](DONE.md).

---

## v0.12 (MES 21) — Producto estable: cerrar papercuts, higiene y paridad antes de features grandes

- [x] **SÍ — v0.12 cerrado (2026-07-14)**
  Higiene de datos (borrado masivo en 5 tablas + cero diálogos nativos, absorbe IDEAS #18), Chat con Markdown/sanitizador propio + chips de task/modelo clicables, visor de diff por run calculado por contenido (no `git diff` post-hoc), y auditoría real de paridad CLI↔dashboard con 3 gaps no-dev cerrados (`task init`, `constitution init`, `summary` PDF) y verificados independientemente contra código real ([[feedback-verificar-progreso-delegado]]). Nacen 4 reglas de diseño fijas para toda pantalla nueva (anclaje de elementos fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS). Cero features nuevas en el motor, disciplina del milestone respetada de punta a punta. 711 tests · 0 fail · `tsc --noEmit` limpio. Primer tag formal del proyecto: `v0.12`.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 20 — Que OrchestOS entregue de verdad: dogfooding contra un producto real

- [x] **PARCIAL — Mes 20 cerrado formalmente (2026-07-14), con un gate abierto a propósito**
  Auto-split (el gatillo automático que le faltaba al motor de sub-tareas) diseñado, implementado y con superficie de aprobación en dashboard — el usuario ve y aprueba el plan de sub-tareas antes de gastar. Probado con éxito en un entregable simple end-to-end (`crypto-page-v1`, gate 🔍 con dinero real). **El gate original y más exigente (C.2, dashboard premium multi-archivo React+TS+Vite) sigue PAUSADO** por decisión explícita de alcance de Carlos — gated en 2 prerequisitos concretos: decisión de modelo ([[feedback-modelo-decision-final-carlos]], nacida de un incidente de $5.00 quemados este mismo mes) y presupuesto de outputs de tools del executor agéntico (IDEAS.md #32). Candidato de pre-flight del próximo milestone (ver abajo). 711 tests · 0 fail · `tsc --noEmit` limpio (estado actual, no snapshot del mes).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 19 — El chat lee cualquier imagen: OCR + múltiples adjuntos

- [x] **SÍ — Mes 19 cerrado (2026-07-09)**
  El chat lee imágenes con cualquier modelo vía OCR local (`tesseract.js`, sin dependencia de que el modelo elegido tenga visión), soporta múltiples adjuntos (`st.chatFiles[]`, límite 5), y el wrapper de seguridad "dato externo, nunca instrucción" fue verificado contra un intento real de prompt injection en una imagen (el modelo lo ignoró). `task_class: ocr` diferido sin evidencia de caso de uso interno — vuelve a IDEAS.md #30. 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## Pre-flight — gap conocido antes de abrir el próximo milestone

**Actualizado al cierre de Mes 25 (2026-08-06)** — la nota anterior sobre Mes 20/C.2 quedaba
huérfana: ese milestone cerró formalmente el 2026-07-14 y desde 2026-07-30 el orden de ejecución
lo fija el backlog canónico por esfuerzo de [IDEAS.md](IDEAS.md), no este bloque. Reemplazada para
no dejar un gap real sin registrar mientras el mecanismo que debía atraparlo (esta sección) estaba
desactualizado.

**Gap real encontrado durante Mes 25 (O.3, 2026-08-05), sin corregir todavía:** `ctx.allowedTools`
en [src/run/middlewares/tool-policy.ts](src/run/middlewares/tool-policy.ts) es dead code — ningún
ejecutor lo lee (verificado, no supuesto: `grep -rn ".allowedTools\b" src/` no devuelve nada fuera
de ese propio middleware). El enforcement real de herramientas por tarea vive en otro lado
(`SubTask.allowed_tools`, requerido y chequeado hard por el planner). No es bloqueante — no corrompe
ninguna corrida ni métrica hoy — pero si el próximo Mes toca seguridad de ejecutores o el camino de
tareas simples, resolver esto primero (cablear de verdad o borrar el middleware). Detalle completo
en [IDEAS.md #58](IDEAS.md).

**Próximo milestone: por decidir con Carlos** — el orden lo fija
[IDEAS.md § 🧭 Backlog canónico por esfuerzo](IDEAS.md); con Mínimo vaciado (graduado a Bloque N),
la categoría **Bajo** es la siguiente en el índice (`#2`, `#3`, `#5`, `#19`, `#40`, `#46`, `#58`).

---

## MES 18 — Chat como entrada única: detección de intención de tarea

- [x] **SÍ — Mes 18 cerrado (2026-07-09)**
  Chat con detección semántica de intención de tarea activada con evidencia real (34 mensajes reales, falso negativo confirmado y corregido — Bloque J), paridad CLI↔Dashboard cerrada (9/9 gaps, Bloque E), auto-selección de skill por dominio (Bloque D), auditoría visual + 13 ajustes "premium dashboard" con causa raíz real en cada uno (Bloques G/I), y 2 bugs reales de producción encontrados y corregidos por dogfooding directo de Carlos (imágenes sin gating de visión, guard de contexto no conectado al chat). 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 17 — La capa de confianza: ejecutores externos detrás de la verificación

- [x] **SÍ — Mes 17 cerrado (2026-07-05)**
  Tercer `ExecutorEngine` (ejecutor externo, Claude Code headless) diseñado (`docs/external-executor-design.md`), implementado (`executors/external.ts`, worktree obligatorio, diff completo sin filtrar), expuesto en dashboard+CLI (selector, bloque "Process", detección honesta de binario ausente), y verificado en vivo con dinero real (Bloque D) contra la misma tarea brownfield que motivó el mes anterior (G.5) — encontró y corrigió un bug real de parseo de `git status --porcelain` en el camino (mismo patrón de gates 🔍 con dinero real de G.5/Mes 14/Mes 13). Confirma la tesis: `enforceContract`/checks/QA funcionan idénticos sobre un motor que OrchestOS no controla, a costa de 25-70× el costo de single-shot. 617 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 15.F0 — Integridad: los instrumentos de medición deben decir la verdad antes de tocar el motor

- [x] **SÍ — F0 cerrado (2026-07-02)**
  Auditoría completa (arquitecto + debugger + QA + dev) antes de tocar el motor: suite determinista (0 `mock.module()`, inyección de dependencias en su lugar), `tasks.yaml` reconciliado (6 tareas non-done resueltas con decisión explícita), `maxTokens` ignorado en providers directos conectado, modelo retirado (`claude-3-haiku`) reemplazado, pricing con fallback $0 silencioso migrado al catálogo real. 524 tests · 0 fail al cerrar. Desbloqueó el Mes 16.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 16 — El giro del timón: motor honesto + ejecutor agéntico

- [x] **SÍ — Mes 16 cerrado (2026-07-02)**
  Origen: revisión estratégica externa (Fable 5, 2026-07-01) — 6 hallazgos reales del corazón del producto. F1-F4 corrigieron las fallas puntuales del ejecutor (retry ciego, QA autocalificado, evidencia incompleta, contrato sin normalizar paths), todos verificados en vivo. Bloque G ejecutó la decisión de arquitectura: capa de verificación desacoplada del ejecutor (`ExecutorEngine`), single-shot extraído sin cambio de comportamiento (G.2), ejecutor agéntico nuevo reusando `runToolLoop()` (G.3), superficie completa en dashboard+CLI (G.4), y un gate comparativo con dinero real (G.5) que encontró y corrigió 2 bugs reales de `maxTokens` hardcodeado en `tool-call.ts`/`harness.ts` — reverificado en vivo sin truncar. 585 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 14 — Autonomía interna: el runner que conduce el grafo solo

- [x] **SÍ — Mes 14 cerrado (2026-06-29)**
  `orchestos run --graph` recorre el DAG completo de `tasks.yaml` sin intervención humana en el happy path (Bloques 0/A/B); ante un fallo, bloquea solo la rama afectada y la decisión retry/bloqueo la toma `diagnoseTask()`, no el humano (A.R hardening). Superficie completa en CLI + dashboard (Bloque C). Verificado en vivo en el dashboard real y en un smoke e2e contra el `tasks.yaml` real de producción del propio proyecto — 2 bugs reales destapados y corregidos en el camino (falso positivo de QA sin checks deterministas, retry sin tope en fallos de check) (Bloque D). En paralelo: control de reasoning effort por modelo end-to-end (BLOQUE BACK/FRONT) y pulido visual del dashboard vía auditoría `impeccable` (10 fixes, incluido un loop de rerender que borraba inputs activos). 518 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 13 — OrchestOS conectado: del aislamiento al conocimiento externo

- [x] **SÍ — Mes 13 cerrado (2026-06-23)**
  Pre-flight de UI (edición de skills real, ícono YAML, TTL+refresh de modelos). Web fetch real en el chat (`runToolLoop()` multi-turno + guard SSRF) — 2 bugs reales corregidos solo al verificar en vivo (falso positivo SSRF por `dns.resolve4()`, arity de `executeFetchUrl`). Registro de skills de la comunidad (217 reales, `idleTimeout` corregido) + prompt del curador ajustado para que `description` sea condición de disparo, no resumen. 468 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 12 — Endurecimiento: red de seguridad antes de la autonomía

- [x] **SÍ — Mes 12 cerrado (2026-06-19)**
  Tests del motor crítico (`contract.ts`, `scheduler.ts`) con gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2) + pre-commit hook + `noUnusedLocals`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 11 — OrchestOS como experto: autoría de skills con curador

- [x] **SÍ — Mes 11 cerrado (2026-06-10)**
  Curador LLM (`/api/skills/curate`, retry hasta 2 veces) + pantalla Skills con tres puertas (escribir · importar · exportar) + pack "pro" de 8 skills de ingeniería en `skills/pro/` importables con un click + paridad CLI (`skill curate`/`skill import`). 402 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 4 — Routing inteligente + skills que se adaptan al proyecto

- [x] **SÍ — Mes 4 cerrado (2026-05-27)**
  Routing activo (`config show`), 11 skills, language_targets, CONSTITUTION.md en system prompt, `context compress` genera CONTEXT.md, `runs --detail` reporta tokens.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 5 — Confiabilidad para uso diario: e2e real + sandbox + spec-driven

- [x] **SÍ — Mes 5 cerrado (2026-05-28)**
  Sandbox por git worktree (S19), Spec-Driven con gate en harness (S20), resolvers multi-lenguaje + autoskills fetch (S21), sub-agentes con context isolation + memoria persistente + tool policy (S22). 110 tests · 0 fail. Smoke real sub-agentes: write-greeting→write-response (44s, memory_entries escritas). selectMemories bug corregido (depIds ID→topic_key resolution).
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 6 — IA con ROI demostrable + observabilidad de sub-agentes

- [x] **SÍ — Mes 6 cerrado (2026-05-28)**
  S23 function calling planner (elimina errores YAML estructuralmente), S24 embeddings semánticos (`embed_hits` en runs), S25 diagnóstico de fallos auto-trigger en `failed_permanent`, S26 BM25 conflict detection en memoria.
  `embed_hits > 0` en 12 runs reales · 212 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 7 — Observabilidad activa + calidad del pipeline

- [x] **SÍ — Mes 7 cerrado (2026-06-02)**
  S27 context-monitor wired (warnings persistidos en DB + visibles en `runs --detail`), S28 WHEN/THEN acceptance criteria (`spec lint` + draft prompt + QA prompt), S29 spec archive (`spec archive` + `spec list --all`), S30 aprendizaje continuo v1 (`runs --analyze` + hook post-completion en `task run`). 256 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 8 — Pipeline robusto + aprendizaje activo

- [x] **SÍ — Mes 8 cerrado (2026-06-02)**
  S31 middleware chain (10 middlewares de enrichment, harness refactorizado), S32 capabilities contract + delta headers en specs, S33 instincts con confidence scoring, S34 continuous learning v2 (runs→instincts loop cerrado), S35 cost tracker por sub-agente, S36 dashboard local Bun + vanilla JS (4 vistas desde SQLite).
  369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 9 — Dashboard usable: de observador a orquestador

- [x] **SÍ — Mes 9 cerrado (2026-06-04)**
  Dashboard convertido en interfaz principal: 10 bloques (A–J), input natural con preview IA, i18n en/es, instalador de un solo archivo, chat panel + model selector shipeados fuera de plan. 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## MES 10 — El producto que alguien que nunca programó puede usar

- [x] **SÍ — Mes 10 cerrado (2026-06-04)**
  Wizard API key (3 proveedores, validación real, rollback en 401) · toggle humano/operador navegable con persistencia · diagnóstico de fallos en Tasks · archivos en Chat · Control Center con 5 bloques de salud · Ollama auto-detectado · 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---
