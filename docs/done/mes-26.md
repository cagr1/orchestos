## MES 26 — Backlog canónico, categoría **Bajo** (abierto 2026-08-06)

Mes 25 cerró los tres bloques que graduaron de la categoría **Mínimo** (vacía desde entonces).
Este Mes ejecuta la categoría **Bajo** del backlog canónico de [IDEAS.md](../../IDEAS.md), en el orden
del índice — que es el **único** orden de ejecución (regla desde 2026-07-30). Al graduar cada
idea se elimina de IDEAS.md en el mismo commit.

| Bloque | Idea de IDEAS.md | Estado |
| --- | --- | --- |
| **Q** | `#2` `verification-before-completion` (superpowers) | ✅ cerrado (2026-08-06) |
| R | `#3` `requesting-code-review` / `receiving-code-review` | ✅ cerrado (2026-08-06) |
| S | `#5` Resolver imports Ruby | ✅ cerrado (2026-08-06) |
| T | `#19` `engine: external` sin `checks:` | ✅ cerrado (2026-08-06) |
| U | `#40` Editor de Constitution con Guardar/Limpiar | ✅ cerrado (2026-08-07) |
| V | `#46` Spike de Graphify | ✅ cerrado (2026-08-08) |
| W | `#58` `tool-policy.ts` dead code | ✅ cerrado (2026-08-08) |

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
   ([agentic.ts:173-181](../../src/run/executors/agentic.ts)) dice hoy, textual:
   `Declared checks you can run to verify your work: …` (**"you can"** — opcional) y
   `When all declared output files are written and correct, stop calling tools` (**"and correct"**
   — autoevaluado, sin exigir evidencia). Es literalmente la invitación al modo de fallo que esta
   skill ataca. El harness re-corre los checks después y atrapa la mentira — **pero solo cuando
   hay checks declarados**: `defaultChecksFor()` ([checks.ts:64](../../src/run/checks.ts)) no genera
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
  [docs/sources-registry.yaml](../../docs/sources-registry.yaml) — **la entrada ya existe**
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
    corrida agéntica, así que vive en el prompt ([agentic.ts](../../src/run/executors/agentic.ts)) —
    `checks you can run` → *"Run them with run_check before you stop"*; y para el caso sin checks,
    donde antes no quedaba ninguna exigencia, → *"Read back what you wrote with read_file"*. La
    condición de parada pasó de *"written **and correct**"* (autoevaluado) a *"written AND you hold
    evidence it is correct"*. Redacción, cero maquinaria nueva — el límite del ítem se respetó.
  - **No se duplica contenido de la skill dentro del código** (sería el anti-patrón de N.4.5): el
    prompt exige evidencia, no recita el `iron_law`.
  - 3 tests nuevos ([agentic-engine.test.ts](../../src/__tests__/agentic-engine.test.ts)) que miran el
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
  [mergeWorktreeBack()](../../src/run/sandbox.ts:82) confirma que el harness de OrchestOS mergea al
  branch de sandbox automático tras un QA pass — **no hay gate de aprobación humana antes de
  mergear**, y crear uno sería motor nuevo (fuera de "Bajo", necesitaría plan corto). No se
  inventa ese gate acá.
- `receiving-code-review` es disciplina de **cómo procesar feedback humano antes de implementarlo**.
  Verificado en `dashboard/handlers/tasks.ts`: no existe un endpoint de "rechazar con comentario y
  reintentar" — todo `retry_reason` en el harness viene del veredicto **automático** de QA
  ([cli.ts](../../src/cli.ts), 8 sitios), nunca de texto libre de un humano. No hay bucle de feedback
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

- [x] **R.1 — ⚡ (2026-08-06) Importar las dos skills, verbatim, por la vía real.** Autoría de
  `skills/pro/requesting-code-review.yaml` y `skills/pro/receiving-code-review.yaml` portando
  fiel el contenido de `obra/superpowers/skills/requesting-code-review/SKILL.md` y
  `.../receiving-code-review/SKILL.md` (MIT). `requesting-code-review`: `common_rationalizations`
  (2 pares de "Common Rationalizations"), `red_flags` (la lista "Never:" de "Red Flags"),
  `instructions` con "When to Request Review" + "How to Request" + placeholders del template.
  `receiving-code-review`: sin tabla de rationalizations en la fuente — `instructions` con "The
  Response Pattern", "Forbidden Responses", "Source-Specific Handling", "YAGNI Check", "When To
  Push Back"; `anti_patterns` desde "Common Mistakes" (7 filas); `examples` desde "Real Examples".
  Registrar ambas en [docs/sources-registry.yaml](../../docs/sources-registry.yaml) como entradas
  nuevas (no hay entrada previa para ninguna de las dos). **Límite duro**: cero invención, mismo
  error que costó N.5.1. Delegable a Codex con las 2 fuentes literales a la vista.

  **Delegado a Codex (`codex exec --sandbox workspace-write`), verificado contra la fuente
  real antes de aceptarlo** ([[feedback-verificar-progreso-delegado]]): `requesting-code-review` —
  2/2 rationalizations verbatim (script de comparación par a par), 4/4 red flags verbatim
  confirmados a mano contra la sección "Never:" de la fuente. `receiving-code-review` —
  `common_rationalizations`/`red_flags` correctamente **ausentes** (la fuente no los tiene, cero
  invención) y 7/7 `anti_patterns` desde "Common Mistakes" verbatim; `instructions` cubre las 9
  secciones sustantivas de la fuente (Response Pattern, Forbidden Responses, Unclear Feedback,
  Source-Specific, YAGNI, Implementation Order, Push Back, Acknowledging, Pushback). Ninguna de
  las dos tiene `activation` — respetado. Tocó solo los 3 archivos autorizados, sin commit.
- [x] **R.2 — 🔍 (2026-08-06) Gate de fidelidad + integridad del catálogo**, más liviano que Q.3 a
  propósito — no hay comportamiento de runtime que gatear (R.1 lo estableció: sin motor nuevo,
  sin wiring). Verificar contra la fuente real (no el reporte de Codex): contenido de
  `common_rationalizations`/`red_flags`/`anti_patterns` coincide con las tablas de origen; **27
  skills** en el catálogo (eran 25 tras Q.1); ninguna de las dos aparece en `resolveGates()` en
  ninguna fase (correcto — no llevan `activation`); `tsc --noEmit` + `bun run test:coverage`.

  **27/27 skills en catálogo confirmado. Gate de deriva también verde**: los 2 `last_synced_sha`
  que Codex escribió en el registro son commits reales del path exacto (9 fuentes · 0 con deriva
  · 0 con error) — no inventó un SHA plausible. 1102 tests · 0 fail · `tsc --noEmit` limpio ·
  `bun run test:coverage` verde.

**Bloque R cerrado (R.1–R.2).**

### Bloque S — 🧠 IDEAS #5: resolver imports Ruby en el Graph

**Lo que pedía la idea**: *"un `rubyResolver` nuevo siguiendo el patrón de los 4 existentes... el
registry y el patrón ya existen, es un resolver más. Esfuerzo: bajo."*

**Hallazgo real al verificar el patrón antes de copiarlo (2026-08-06)** — no hipotético, reproducido
en vivo con los fixtures reales de `tests/fixtures/graph/`: **el patrón de los 4 resolvers
"existentes" estaba roto**, y agregar un `rubyResolver` sobre él habría producido exactamente lo
mismo — un resolver que funciona aislado pero cuyo resultado nunca llega a `code_edges`. Carlos
decidió (pregunta explícita, 2026-08-06) arreglar la raíz primero, Ruby después.

- [x] **S.1 — 🧠 (2026-08-06) Arreglar el bug de orden en `indexProject()` + los 2 bugs de
  resolver que destapó.** Tres fallos independientes, verificados con `to_file_id` real contra
  los fixtures del repo antes de tocar nada:
  1. **Bug de orden (universal, todos los lenguajes, desde S21)**:
     [indexProject()](../../src/graph/index.ts:69) resolvía los edges de un archivo **en el mismo
     instante** en que lo insertaba en `files` — un pase único. Si el archivo importado ordenaba
     alfabéticamente **después** en el glob, su fila todavía no existía cuando `resolveFileId()`
     lo buscaba: el resolver encontraba el path correcto, pero el lookup por id fallaba y el edge
     quedaba huérfano **para siempre** (un archivo sin cambios de `sha1` nunca vuelve a pasar por
     el cálculo). Medido antes del fix: **0/2 Rust, 0/3 C#, 0/1 Go, 1/3 Java, 0/1 JS/TS**
     resueltos con los fixtures reales — no era de un lenguaje, era el pase entero.
  2. **`rust.ts`/`csharp.ts` registrados bajo la clave equivocada**: `language: 'rust'`/`'csharp'`,
     pero `languageFor()` (la extensión del archivo) produce `'rs'`/`'cs'` — el registry nunca los
     encontraba. `csharp.ts` además filtraba internamente `f.language !== 'csharp'` en
     `buildNsMap()`, mismo mismatch una segunda vez.
  3. **`rust.ts` comparaba contra el string equivocado**: `resolveWithRegistry()` pasa
     `edge.specifier`, que `extractRustImports()` ya captura **sin** el prefijo `use ` (regex de
     captura). El resolver comparaba `importStr.startsWith('use crate::')` — nunca podía ser
     `true`, para ningún input. Este resolver **no había resuelto nada jamás**, independiente del
     bug de orden.

  **Fix**: `indexProject()` pasa a dos pasadas — (1) upsert de TODOS los archivos, `files` queda
  completa; (2) edges solo para los archivos que cambiaron, contra el estado final de `files`.
  Más las dos correcciones puntuales de clave/prefijo. Reverificado con los mismos 4 fixtures
  después del fix: **100% resuelto en los 4 lenguajes** (Rust 2/2, C# 3/3, Go 1/1, Java 3/3).
  Verificado también que el proyecto propio de OrchestOS nunca se había indexado (`0` archivos en
  `code_edges`) — no había datos viejos rotos que migrar.
  6 tests nuevos ([graph-resolver-e2e.test.ts](../../src/__tests__/graph-resolver-e2e.test.ts)): los 4
  fixtures reales end-to-end contra `indexProject()` completo (nunca se había testeado más allá de
  los extractores), más 2 tests de regresión causal del bug de orden con un proyecto sintético
  donde `a-first.ts` importa `z-second.ts` (el caso exacto que fallaba). 1108 tests · 0 fail ·
  `tsc --noEmit` limpio · `bun run test:coverage` verde.
- [x] **S.2 — 🧠 (2026-08-06) El `rubyResolver` en sí**, ahora sobre una base que sí funciona. Patrón
  `require_relative './foo'` (relativo al archivo, resoluble directo) vs `require 'foo/bar'`
  (basado en `$LOAD_PATH` — puede ser una gema externa, no siempre un archivo local; el resolver
  debe devolver `null` sin tratar de adivinar cuando no hay candidato real). Registrar en
  `graph/index.ts` siguiendo `registerResolver(...)`, con la clave correcta (`'rb'`, la que
  produce `languageFor()` — verificar, no asumir, dado lo encontrado en S.1). Tests contra
  `extractRubyImports()` (ya existe) + un fixture nuevo en `tests/fixtures/graph/ruby/` con
  `require_relative` cruzando archivos, mismo patrón que `graph-resolver-e2e.test.ts`.

  **Hallazgo adicional al implementar**: `Resolver.resolve(importStr, fromFile, repo)` nunca
  recibe `kind` — no hay forma de que el resolver distinga `require_relative` de `require` a
  partir del `specifier` solo, y ambas formas tienen resolución distinta (relativo al archivo vs.
  `$LOAD_PATH`). Resuelto en la **extracción**, no en el resolver:
  [extractRubyImports()](../../src/graph/index.ts:258) normaliza todo `require_relative` con `./` al
  frente si no lo trae (`require_relative 'foo'` y `require_relative './foo'` son el mismo require
  por semántica del lenguaje — no es un hack). [ruby.ts](../../src/graph/resolvers/ruby.ts) resuelve
  después por el prefijo: `.` → relativo a `fromFile` con extensión `.rb`; sin prefijo → intenta
  `<specifier>.rb` y `lib/<specifier>.rb` (las dos convenciones reales de `$LOAD_PATH` en un repo
  Ruby), `null` si ninguna existe — **verificado que `require 'json'` (stdlib) da `null` limpio,
  no un candidato inventado**.
  Registrado con `language: 'rb'` desde el inicio (S.1 destapó que `rust`/`csharp` no seguían este
  criterio).
  **Corrección de test drift encontrada de paso**: `graph-imports.test.ts` no importa los
  extractores reales de `graph/index.ts` (no están exportados) — tiene sus **propias copias
  reimplementadas** para no depender de la DB. La copia de Ruby estaba desincronizada del fix real;
  actualizada para no dejar una suite verde que no prueba el código que corre.
  6 tests nuevos (2 en `graph-imports.test.ts` sobre la extracción normalizada, 1 end-to-end en
  `graph-resolver-e2e.test.ts` contra el fixture real con las 4 formas: `require_relative` con y
  sin `./`, `require 'lib/...'`, y `require 'json'` confirmando `null`). 1111 tests · 0 fail ·
  `tsc --noEmit` limpio · `bun run test:coverage` verde.

**Bloque S cerrado (S.1–S.2).**

### Bloque T — 🧠 IDEAS #19: `engine: external` sin `checks:` pierde su única red determinista

**Origen**: gate D.1 (Mes 17). `defaultChecksFor()` gatea `tsc --noEmit`/`bun test` en
`existsSync(node_modules)`, y `git worktree add` (que `engine: external` exige sin excepción,
§5 de `docs/external-executor-design.md`) nunca trae `node_modules` — está siempre gitignored. Una
tarea `engine: external` **sin** `checks:` explícitos quedaba con el juez de QA-LLM como única red
— el mismo que D.1 mostró que puede dar falso negativo.

- [x] **T.1 — 🧠 (2026-08-06) Symlink de `node_modules` en `createWorktree()`** (la dirección que
  la propia idea marcaba como preferida: "arregla el gap de raíz", afecta los 3 engines por igual
  ya que cualquiera puede correr en modo worktree). [sandbox.ts](../../src/run/sandbox.ts): tras el
  `git worktree add`, si `node_modules` existe en `projectRoot` y no en el worktree, symlink
  (`fs.symlinkSync(..., 'dir')`), best-effort — un fallo (permisos, Windows sin modo dev) no tumba
  la creación del worktree, el gap simplemente vuelve a ser el de antes.

  **Efecto colateral real encontrado al verificar en vivo, no hipotético**: un `.gitignore` con
  `node_modules/` (con slash, la convención casi universal) **NO matchea un symlink** — el patrón
  con slash solo matchea directorios reales. Sin corregir esto, el symlink aparecía como `??
  node_modules` en `git status`, y **`mergeWorktreeBack()` lo habría commiteado al branch real**
  (`git add -A` + commit) — un side effect serio que la propia idea pedía verificar ("no rompa el
  aislamiento del sandbox") y que un fix ingenuo habría introducido. Corregido con pathspec
  `-- . ':!node_modules'` en los 3 sitios que hacen `git status`/`git add` sobre el worktree:
  [worktree-diff.ts](../../src/run/executors/worktree-diff.ts) (usado por `external.ts` y `opencode.ts`)
  y los dos call sites de [sandbox.ts](../../src/run/sandbox.ts) (`mergeWorktreeBackLocked`). Verificado
  con un repo git real: symlink presente y legible, `readWorktreeDiff()` reporta solo el archivo
  real escrito, `git show --stat`/`git ls-tree` tras el merge confirman que `node_modules` nunca
  entra al historial.

  **Gate en vivo con dinero real** ([[feedback-verificar-gates-en-vivo]]), con control causal —
  mismo patrón que A.4/O.4/Q.3: proyecto scratch con `node_modules` fake + `tsconfig.json`
  `strict`, tarea `engine: external` **sin `checks:` declarados** pidiendo un archivo `.ts` con un
  error de tipo intencional (`claude-sonnet-5` real). Antes del fix, `defaultChecksFor()` medido
  directo contra el mismo worktree devolvía `[]` — el error de tipo habría quedado solo a criterio
  del juez de QA-LLM. Con el fix: `tsc --noEmit` corrió de verdad y **atrapó el error
  determinísticamente** — `src/broken.ts(1,7): error TS2322: Type 'string' is not assignable to
  type 'number'.`, `QA fail — check failed: bunx tsc --noEmit exit 1`. El archivo se revirtió
  (contrato de checks fallidos), tal como debía. Runs de prueba borrados de la DB real.

  9 tests nuevos ([sandbox-node-modules.test.ts](../../src/__tests__/sandbox-node-modules.test.ts)) con
  repos git reales: symlink creado/ausente según corresponda, el gap real cerrado
  (`defaultChecksFor` con `tsc` presente), `readWorktreeDiff` sin contaminación, y 2 tests de
  `mergeWorktreeBack` confirmando que `node_modules` nunca llega al commit (con cambios reales y
  sin ellos). 1117 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde.

**Bloque T cerrado (T.1).**

### Bloque U — ⚡ IDEAS #40: editor de Constitution — Guardar/Limpiar explícitos

**Origen**: Carlos (2026-07-13) escribió "hola" para probar y se grabó a `CONSTITUTION.md` solo,
sin pedirlo — `#constitution-editor` tenía auto-save debounced a 1s en cada tecla, sin botón de
guardar ni de limpiar.

**Verificado antes de tocar código (2026-08-07)**: el `input` listener de auto-save sigue ahí
([screens-ops.js:161-189](../../src/dashboard/public/screens-ops.js)), sin cambios desde julio. El tab
Context, al lado, ya tiene botonera explícita (Regenerate/Detect/Index) — mismo patrón a copiar,
no a inventar. Grep de `addEventListener('input'...)` en las 3 pantallas del dashboard confirma
que **Constitution es el único editor con este patrón** — el punto 3 de la idea ("considerar el
mismo tratamiento para cualquier otro editor") no aplica a nada más, declarado y no silencio.

- [x] **U.1 — ⚡ (2026-08-07) Reemplazar el auto-save por Guardar/Limpiar explícitos.**
  - Quitado el `input` listener con `setTimeout` de 1s que hacía `PUT /api/project/constitution`
    solo. `Guardar` (`btn primary`, icono check) hace el mismo `PUT` que antes, ahora solo al
    click — mismo endpoint, mismo `st.projectSaveState`/`st.constitutionExists`, cero cambio de
    contrato con el backend.
  - `Limpiar` (`btn ghost`, icono trash) pide confirmación con `Modal.confirm()` (el mismo patrón
    que ya usan runs/instincts/specs) antes de vaciar el textarea. **Decisión sobre la ambigüedad
    que la idea dejaba abierta**: Limpiar vacía el editor **localmente**, nunca toca disco por sí
    solo — si el usuario quiere que el archivo quede vacío de verdad, tiene que confirmar la
    limpieza Y después click Guardar, dos acciones explícitas separadas. Nunca un DELETE
    silencioso.
  - Indicador de cambios sin guardar: al tipear, comparación directa contra `st.constitutionContent`
    (el último valor cargado/guardado) sin `App.rerender()` — igual disciplina que el código viejo
    (que tampoco rerenderizaba en cada tecla, solo al completar el save). Un rerender en cada tecla
    reconstruiría el `<textarea>` desde `st.constitutionContent` y **borraría lo que el usuario
    estaba escribiendo** — verificado leyendo el flujo antes de escribir el fix, no supuesto.
    `Guardar` queda deshabilitado mientras no hay cambios sin guardar.
  - 4 claves i18n nuevas en inglés y español
    ([i18n.js](../../src/dashboard/public/i18n.js)): `project.constitution.save`,
    `project.constitution.clear`, `project.constitution.clear.confirm`,
    `project.constitution.unsaved`.
  - **Segundo hallazgo real, encontrado verificando en vivo, no en `bun test`**: quitar el
    autosave expuso un bug de pérdida de datos que el autosave **enmascaraba sin querer**.
    `fetchAll()` sondea cada 30s ([app.js](../../src/dashboard/public/app.js), bug real de 2026-06-29/
    2026-07-08) y hace un rerender destructivo que reconstruye `#main` completo — ya tenía un
    guard (`typingInMain`) que lo salta mientras el foco sigue en un input/textarea/select. Pero
    con Guardar/Limpiar como botones explícitos, el usuario mueve el foco AL BOTÓN (o a
    `Modal.confirm()`) antes de guardar — si el poll de 30s aterriza en esa ventana, el guard por
    foco no protege y el rerender vuelve a pisar el cambio sin guardar, en silencio. Antes del
    fix esto no pasaba porque el autosave de 1s sincronizaba `st.constitutionContent` tan rápido
    que la ventana de riesgo casi no existía — al alargarla (el usuario ahora decide cuándo
    guardar) el bug latente se volvió real.
    **Reproducido y corregido**: agregado `state.constitutionDirty` (además del toggle del DOM),
    consultado por el guard de `fetchAll()` junto al chequeo de foco. Verificado en vivo con el
    escenario exacto: tipear, sacar el foco del textarea, esperar 35s reales (cruzando el poll) —
    el texto sobrevive. Bajado el flag al cambiar de tab (el textarea se reconstruye igual en ese
    caso, navegación explícita del usuario, no pérdida silenciosa).
  - **Tercer hallazgo, mismo patrón**: el handler de `Guardar` en un intento inicial llamaba
    `App.rerender()` **antes** de que el `fetch` terminara — eso reconstruye el textarea desde
    `st.constitutionContent`, que todavía tiene el valor viejo, y el usuario vería su texto
    desaparecer un instante mientras guarda. Corregido: solo deshabilitar el botón (DOM directo)
    durante el `PUT`, `App.rerender()` recién al final cuando `st.constitutionContent` ya
    coincide — misma disciplina que ya tenía el código de autosave original.
  - Verificado en vivo en el dashboard real ([[feedback-verificar-gates-en-vivo]]), con Playwright
    contra un servidor real, no solo `bun test`: tipear ya no dispara ningún `PUT` (mtime de
    `CONSTITUTION.md` sin cambios mientras se tipea), texto sobrevive el poll de 30s sin foco en
    el textarea, `Guardar` deshabilitado hasta que hay cambios y habilitado al tipear, click en
    `Guardar` sí hace el `PUT` (verificado leyendo el archivo real en disco) y el indicador pasa
    de "Unsaved changes" a "Saved", `Limpiar` pide confirmación real (`Modal.confirm()`), cancelar
    no toca el textarea, confirmar lo vacía localmente sin tocar el archivo en disco hasta el
    próximo `Guardar` explícito. `CONSTITUTION.md` restaurado a su estado original (vacío) al
    terminar. Servidor bajado al terminar ([[feedback-siempre-cerrar-servidor]]).

**Bloque U cerrado (U.1).**

### Bloque V — 🧠 IDEAS #46: spike de comparación Graphify vs. `graph/`/`context suggest` propios

**Lo que pedía la idea**: correr `graphify` sobre el propio repo, comparar contra `context suggest`
con las mismas preguntas, y decidir: ¿se adopta como engine de contexto, se expone como MCP a los
agentes, o solo se roba el patrón de etiquetado `EXTRACTED`/`INFERRED`? No adoptar sin ese A/B.

**Antes de instalar nada — chequeo de realidad (2026-08-08)**: el repo cambió sustancialmente
desde julio (ficha del vault desactualizada). Ya no es un CLI Python simple: paquete PyPI renombrado
a `graphifyy`, YC S26, y el flujo de instalación **registra un skill que modifica `CLAUDE.md` y
agrega hooks `PreToolUse`** a `.claude/settings.json` del proyecto — más invasivo que lo que la
idea original imaginaba. Los stars saltaron a 104K en 3 semanas (verifiqué que no es farming: 10.103
forks, 855 issues abiertas, 30+ contribuidores, releases diarias — señales reales). Confirmado con
Carlos antes de instalar: spike completo, con instalación real (`AskUserQuestion`, 2026-08-08).

- [x] **V.1 — 🧠 (2026-08-08) Spike ejecutado en vivo, con dinero cero (código local, sin API key).**
  `uv tool install graphifyy` + `graphify install --project` (scoped al repo, nunca global) +
  `graphify . --no-viz --code-only` (sin key de LLM — el pase semántico de docs/imágenes cuesta,
  el de código es AST local puro, gratis). Grafo real: **1941 nodos, 4654 edges, 165 comunidades**
  sobre los 336 archivos de código del repo.

  **Resultado del A/B — la comparación reveló algo más interesante que "cuál es mejor"**:
  `graphify explain "resolveGates"` y `graphify query "context suggest command definition"`
  ubicaron `resolveGates()` (O.3) y `suggestContext()` (S24) **exactos, con sus llamadas reales**
  (`resolveGates() --calls--> loadSkill()`, `--calls--> listSkillFiles()`), sin un solo grep manual.
  Pero `graph/` (S21, propio) y `graphify` **no resuelven el mismo problema**: el grafo propio
  indexa **imports a nivel de archivo** (`archivo A importa archivo B`); graphify indexa
  **funciones y llamadas dentro de los archivos**, vía tree-sitter real (~40 lenguajes) — un nivel
  de profundidad que `graph/` genuinamente no tiene hoy, no una versión "mejor" de lo mismo.

  **Decisión — no se adopta el binario, se anota el patrón real para más adelante:**
  1. **NO adoptar `graphifyy` como dependencia de runtime.** Es un producto de una startup en pleno
     pivot a SaaS hosteado ("eso es lo que construimos en graphify.com"), con un flujo de instalación
     que reescribe `CLAUDE.md`/hooks del proyecto sin pedir confirmación por archivo — comprometer
     una pieza central de la arquitectura de OrchestOS (cómo los agentes exploran código) a un
     binario externo de evolución rápida y ajena es el riesgo que el bloque P (`sources-drift`)
     existe justamente para vigilar, multiplicado: acá sería runtime, no solo contenido de skill.
  2. **Sí es robable, y queda como candidato nuevo, no ejecutado ahora**: extracción a nivel de
     función/símbolo vía tree-sitter (no solo imports de archivo) para `graph/` propio — la brecha
     real que este spike encontró. Y el etiquetado `EXTRACTED`/`INFERRED` en los edges (barato,
     mejora la confianza de cualquier respuesta del grafo propio). Ninguno de los dos se implementa
     en este ítem — es un spike de comparación, no de adopción; graduarlos a IDEAS.md si se retoman.
  3. **MCP server**: no se expone — no aplica si no se adopta el binario.

  **Limpieza completa verificada** (esto era un spike, no una adopción):
  `git checkout -- CLAUDE.md .claude/settings.json` restauró ambos archivos byte a byte;
  `.claude/skills/graphify/`, `.claude/CLAUDE.md`, `graphify-out/` borrados. `git status` limpio,
  cero rastro en el repo. `uv`/`graphify` quedan instalados en el entorno local (`~/.local/bin`) —
  no son parte del repo, Carlos decide si los desinstala.

**Bloque V cerrado (V.1).**

### Bloque W — 🧠 IDEAS #58: `tool-policy.ts` es dead code

**Lo que pedía la idea**: decidir entre cablear `ctx.allowedTools` de verdad en los ejecutores
(redefine el modelo de seguridad de 3+ engines) o borrar el dead code, ya que `SubTask.allowed_tools`
del planner cubre el enforcement real. Decisión de Carlos (pregunta explícita, 2026-08-08): borrar.

- [x] **W.1 — 🧠 (2026-08-08) Borrado completo.** [tool-policy.ts](../../src/run/middlewares/tool-policy.ts)
  eliminado; wiring quitado de [middlewares/index.ts](../../src/run/middlewares/index.ts) y de la cadena
  de enrichment en [harness.ts](../../src/run/harness.ts) (`.use(toolPolicy)`); campo `allowedTools` y su
  default quitados de `RunContext`/`createRunContext()` en
  [middleware.ts](../../src/run/middleware.ts), junto con su entrada en `ENRICHMENT_MIDDLEWARE_ORDER` y
  el comentario de orden canónico (de 10 a 9 middlewares). `README.md` actualizado (mismo diagrama
  de la cadena, desactualizado si no se tocaba).
  6 tests que probaban el middleware directamente (`tests/run/skill-middlewares.test.ts`, describe
  `toolPolicy middleware`) borrados con él — probaban código que ya no existe, no comportamiento
  del producto. 4 fixtures sueltos (`codex-engine.test.ts`, `external-engine.test.ts` ×2,
  `opencode-engine.test.ts`) que solo incluían `allowedTools: []` como campo del objeto `RunContext`
  de prueba, sin ejercitar lógica — actualizados para compilar contra el tipo nuevo, sin cambiar lo
  que cada test verifica de verdad. 1111 tests (eran 1117, -6 del middleware borrado) · 0 fail ·
  `tsc --noEmit` limpio · `bun run test:coverage` verde.

**Bloque W cerrado (W.1). Mes 26 cierra completo (Q–W) — el backlog canónico de categoría Bajo
queda en cero.**

---

