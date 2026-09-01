## MES 25 — Pendientes heredados de los cierres 22–24

Este mes conserva pendientes reales que no se cierran por arrastre documental (cada uno mantiene su procedencia y evidencia completa en [DONE.md](../../DONE.md)) **y, desde 2026-07-30, abre la ejecución del backlog canónico por esfuerzo de [IDEAS.md](../../IDEAS.md)** — el orden ahí es el único orden de ejecución, y al graduar una idea se elimina de IDEAS.md en el mismo commit (regla de flujo IDEAS→PLAN→DONE).

**Tabla de estado del proyecto (2026-08-02)**

| Mes | Bloques | Estado |
| --- | --- | --- |
| Mes 22 / v0.13 | A–K | ✅ Cerrado formalmente, sin pendientes |
| Mes 23 | L | ✅ Cerrado — L.5.7 (2026-07-30) y **L.6.2 (2026-08-02)**, sin pendientes |
| Mes 24 | M | ✅ Cerrado formalmente, sin pendientes (resueltos 2026-07-30) |
| Mes 25 | Pendientes heredados + N, O, P | ⏳ Todos los bloques cerrados (N, O, P — P.4 el 2026-08-06); falta la ceremonia formal de cierre de mes ([[feedback-orden-desarrollo]]) |

**Desglose del Mes 25 (2026-08-02)** — se agrega porque la tabla anterior enterraba una semana
entera de trabajo dentro de "Pendientes heredados" sin decir qué había adentro; Carlos reportó
desorientación real por esto en la revisión del 2026-08-02.

| Bloque | Qué es | Estado |
| --- | --- | --- |
| Pendientes heredados | K.6.2-R7, L.5.7, L.6.2, M ×2 | ✅ **todos cerrados** (L.6.2 el 2026-08-02, era el más viejo) |
| **N** | Endurecimiento de skills (Iron Law / Rationalizations / Red Flags) | ✅ **N.1–N.7c cerrado completo** (N.7c el 2026-08-05) |
| **O** | Skills que se activan solas (el problema de fondo: no invocarlas por nombre) | ✅ **cerrado completo** (O.0–O.4, O.4 el 2026-08-05) |
| **P** | Vigilancia de deriva de fuentes externas (`sources-drift`) | ✅ **cerrado completo** (P.1–P.4, P.4 el 2026-08-06) |

**Estado de CI (2026-08-02)**: verde. Estuvo rojo en el **100%** de los pushes desde 2026-07-29
hasta 2026-08-01 14:01; verde desde 2026-08-01 14:03, 6 pushes seguidos. El hook `pre-push`
(`scripts/pre-push.sh`) corre el comando exacto de CI antes de cada push — ver CLAUDE.md.

### Pendientes explícitos

- [x] **K.6.2-R7 — Endurecimiento de comportamientos críticos (cerrado 2026-07-30).** Carlos aceptó `51.76%` como baseline funcional de `qa.ts`, re-verificado por Claude corriendo `mutation:qa` en limpio: confirma que ningún sobreviviente altera lógica de veredicto. Historial completo: [DONE.md § Mes 22](../../DONE.md).
- [x] **L.5.7 — Linaje versionado y rollback de migraciones (cerrado 2026-07-30).** L.5.7.1–L.5.7.7 estaban documentados y verificados; solo faltaba marcar el ítem contenedor. Historial completo: [DONE.md § Mes 23](../../DONE.md).
- [x] **L.6.2 — Gate manual de seguridad (cerrado 2026-08-02).** Procedía de Mes 23 y llevaba 4 días abierto. **El bloqueo era del entorno de la sesión del 2026-07-29, no del producto**: aquella sesión no tenía navegador controlable y el dashboard daba `EADDRINUSE` en los puertos probados. En esta sesión levantó sin problema (`PORT=4311`) y hubo navegador real (Playwright).
  - **Revisión visual en navegador real** (no `route()`/`Request` simulados): home = Chat sin auto-redirect ([[feedback-home-siempre-chat]]), Project con sus 3 pestañas, Runs (45 runs / 41 done / 4 failed, filtros y detalle expandible con ENGINE+PROCESS), Graph Runner con el DAG real, advanced mode. Sin errores de consola ni fallos de render. Servidor bajado al terminar ([[feedback-siempre-cerrar-servidor]]).
  - **Exportar**: `GET /api/project/summary` real → HTTP 200, PDF válido de 2 páginas, `strings` sobre el binario no encuentra `sk-or-*`/`sk-ant-*`/`*_API_KEY`.
  - **Diagnosticar**: la propiedad de seguridad (redacción, añadida 2026-07-30) verificada por test — prueba el prompt exacto que sale al proveedor, más riguroso que una llamada en vivo.
  - **Ejecutar tarea / worktree**: decisión de Carlos — cerrar con la cobertura existente (`contract` 18, `sandbox-policy` 8 + mutation testing, `path-policy` 5, `git-lock` 4, más engines externos) en vez de gastar dinero real; las propiedades de *seguridad* están cubiertas, lo que falta es confirmación e2e con dinero, que no es una propiedad de seguridad nueva. **Zona gris documentada explícitamente, no barrida bajo la alfombra.**
  - **Extra no pedido**: `GET /api/runs` sobre 45 runs reales → sin filtración de secretos; el listado ni expone `prompt`/`result` crudos.
  - **`L62-001` (migración concurrente) → ACEPTADO** por Carlos: local, un usuario, sin exfiltración. Documentado como limitación conocida. Si algún día se corrige, el patrón ya existe (`src/run/git-lock.ts`, [[reference-git-lock-worktree-pattern]]) — no hay que diseñarlo.
  - **`L62-002` (key persistida antes de validar) → MITIGADO** en el mismo turno: [setup.ts](../../src/dashboard/handlers/setup.ts) ahora **valida primero y persiste solo en el camino válido**; ningún camino de fallo escribe (antes, timeout/red/500 dejaban la key sin validar en texto plano y solo el 401 revertía).
  - **Hallazgo colateral corregido:** `settings-store.ts` era el **único** módulo que no honraba `ORCHESTOS_HOME` — apuntaba al `~/.orchestos/.env` REAL, lo que hacía intestable el camino de escritura sin arriesgar las keys de Carlos ([[reference-test-fixtures-leak-into-real-db]]). Alineado con `db/sqlite.ts`/`model-catalog.ts`/`opencode-catalog.ts`, resolviendo la ruta por llamada (no en un `const` de módulo, gotcha ya documentado en `model-catalog.ts:96-99`). `ENV_FILE` → `envFilePath()`.
  - 6 tests de regresión nuevos contra `ORCHESTOS_HOME` temporal; verificado que el `.env` real quedó **byte-idéntico** tras la suite. 1066 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde. Evidencia completa en [docs/security-manual-review.md](../../docs/security-manual-review.md).
- [x] **M — Provisioning de roadmaps para proyectos nuevos (cerrado 2026-07-30, decisión Carlos: centralizado, no copiado).** Carlos decidió que `docs/roadmaps/{engineering-baseline,disciplines,languages}` NO viaja copiado a cada proyecto — es conocimiento de OrchestOS, centralizado, y cualquier proyecto que gestione lo lee desde ahí. `project-profile.md` es la única excepción (describe el repo detectado, sigue siendo por proyecto, nunca cae al fallback). Implementado: `src/detect/roadmap-profile.ts` (`findLanguageDoc`/`docExists` ahora prueban `root` primero y caen a `ROADMAP_DOCS_ROOT`, la instalación de OrchestOS vía `import.meta.dir`) y `src/roadmaps/context.ts` (mismo fallback en `readBounded()` para el contenido, nunca para `profilePath`). Verificado en vivo con un proyecto Rust real sin `docs/roadmaps/` propio: `Lenguaje: Rust` pasa a `known`/`selected` con contenido real; `project-profile.md` correctamente ausente. Tests actualizados (2 nuevos, 2 reescritos con C# como caso "verdaderamente missing" ya que Rust/Go/TS ahora resuelven por fallback). 1013 tests · 0 fail · `tsc --noEmit` limpio.
- [x] **M — Presupuesto de contexto de roadmaps (cerrado 2026-07-30).** Verificado en vivo antes de tocar código: `loadRoadmapContext()` corrido contra este mismo repo confirmó que el presupuesto de 12.000 chars SÍ se agotaba en producción (11.781/12.000, omitiendo `architecture`, `ai-agents` y el lenguaje TypeScript — el principal de OrchestOS). El total real necesario sin truncar es ~22.800 chars; los archivos individuales más grandes (`backend.md` 3.407, `typescript-bun.md` 3.711) ya excedían el tope por-documento de 3.000. Subidos `MAX_TOTAL_CHARS` 12.000→26.000 y `MAX_DOC_CHARS` 3.000→4.000 en [src/roadmaps/context.ts](../../src/roadmaps/context.ts). Reverificado en vivo: 22.962 chars, cero truncado, las 6 disciplinas + TypeScript + Rust entran completos.

### Bloque N — 🧠 IDEAS #1: endurecimiento de skills (Iron Law / Common Rationalizations / Red Flags)

Primer ítem del backlog canónico de IDEAS.md (categoría **Mínimo**, graduado 2026-07-30). Origen:
delta pendiente de [obra/superpowers](https://github.com/obra/superpowers) y
[mattpocock/skills](https://github.com/mattpocock/skills) — el curador + pack "pro" ya está
shipeado (Mes 11). El objetivo real no es "más contenido": es que una skill **se respete bajo
presión** en vez de ignorarse cuando el agente encuentra una excusa para saltársela.

**Corrección de alcance sobre IDEAS #1 (verificada en código, 2026-07-30):** la idea afirmaba
*"Esfuerzo: mínimo — autoría + paso por la puerta importar. Sin código."* — **es falso**.
`buildSections()` ([src/skills/targets/_shared.ts:3](../../src/skills/targets/_shared.ts)) es el ÚNICO
renderer skill→prompt y solo conoce 6 campos (`instructions`, `when_to_use`, `inputs_required`,
`anti_patterns`, `verifiers`, `examples` + `language_targets`); `SkillDef`
([src/skills/registry.ts:18](../../src/skills/registry.ts)) tampoco declara los campos nuevos, y
`validateSkill()` no es strict — **un `iron_law:` en el YAML cargaría sin error y jamás llegaría al
LLM**. Autoría sin wiring = contenido muerto. Por eso el bloque arranca por el contrato, no por el
contenido. Sigue siendo un bloque chico, pero no es cero código.

- [x] **N.1 — 🧠** (2026-07-31) Extender el contrato de skill en
  [src/skills/registry.ts](../../src/skills/registry.ts): `iron_law?: string` (la regla innegociable, una
  sola), `common_rationalizations?: { excuse: string; refutation: string }[]` (la excusa que el
  agente se dice + su refutación — el par es el punto, una lista plana de excusas sin refutar sería
  darle munición), `red_flags?: string[]`. Añadir validación en `validateSkill()` con el mismo
  patrón de los campos existentes (tipos, arrays no vacíos, `excuse`/`refutation` ambos presentes) y
  un cap de longitud para `iron_law` (es una regla, no un párrafo). Tests de validación.
- [x] **N.2 — 🧠** (2026-07-31) Renderizar los 3 campos en `buildSections()`
  ([src/skills/targets/_shared.ts](../../src/skills/targets/_shared.ts)) con **orden deliberado, no
  append al final**: `iron_law` va **antes** de `instructions` (hoy `sections[0]` es
  `skill.instructions` — cambiarlo afecta el prompt de las 24 skills existentes, es el punto del
  ítem: la regla innegociable se lee primero, no sepultada); `common_rationalizations` y
  `red_flags` van **después** de `anti_patterns` (son su escalón siguiente: anti_patterns dice qué
  no hacer, rationalizations dice con qué excusa te lo vas a permitir). Verificar los 3 targets
  (`claude`/`cursor`/`openai`) — comparten `_shared.ts`, confirmar que ninguno reordene por su
  cuenta. Tests de render.
- [x] **N.3 — 🧠** (2026-07-31) Enseñar los campos nuevos a la **puerta importar del curador**
  ([src/dashboard/prompts/curator.ts](../../src/dashboard/prompts/curator.ts), líneas ~17 y ~45 describen
  el contrato al LLM): sin esto, toda skill importada de ahora en adelante nace sin `iron_law` y el
  endurecimiento solo aplicaría a lo ya existente — la puerta por la que IDEAS #1 decía que esto
  entra quedaría desalineada del contrato real.
- [x] **N.4 — ⚡** (2026-07-31) Superficie en dashboard (regla [[feedback-dashboard-no-solo-cli]]): los 3 campos
  en el detalle de skill y en el formulario de creación/edición
  ([src/dashboard/public/app.js](../../src/dashboard/public/app.js) ~936/949/1076/1131/1146/1250) +
  claves i18n **en inglés y español** ([src/dashboard/public/i18n.js](../../src/dashboard/public/i18n.js)
  ~499/544/1255/1300). `common_rationalizations` se edita como un par `excuse :: refutation`
  por línea (se separa solo en el primer delimitador), no como `listField` plano. La superficie
  también incluye esos campos en el preview de importación y en el preview YAML del formulario.
  Verificado: `bunx tsc --noEmit`, `git diff --check` y 42 tests relevantes pasan.
- [x] **N.4.5 — 🧠 BLOQUEANTE (hallazgo 2026-07-31, cerrado 2026-07-31).** N.1–N.3 endurecieron **solo la vía de
  exportación**. `buildSections()` lo llaman únicamente los 3 targets que OrchestOS *escribe para
  otras herramientas* ([claude.ts:12](../../src/skills/targets/claude.ts),
  [cursor.ts:12](../../src/skills/targets/cursor.ts), [openai.ts:10](../../src/skills/targets/openai.ts)). El
  runner propio **no lo usa**: inyecta `skill.instructions` crudo, duplicado en dos lugares
  ([prompt.ts:58](../../src/run/prompt.ts) y
  [skill-route.ts:8](../../src/run/middlewares/skill-route.ts)) — el mismo snippet copiado, divergente del
  renderer canónico. Consecuencia: el `iron_law` llega a Claude Code y a Cursor, **nunca al ejecutor
  de OrchestOS**. Es el mismo fallo de "autoría sin wiring = contenido muerto" que motivó la
  corrección de alcance de este bloque, una capa más abajo. Unificar ambos sitios sobre
  `buildSections()`. Va **antes** de N.5: sin esto el bloque cerraría con 5 skills endurecidas cuya
  regla innegociable no aplica en ninguna corrida real.
- [x] **N.5 — ⚡** Autoría piloto de **5 skills** (decisión Carlos 2026-07-31: las 5, no las 24):
  `tdd-enforcer`, `security-review`, `qa-structured`, `test-writer`, `frontend-design` — las que un
  ejecutor barato tiene más incentivo a esquivar (escribir el test después, "el linter ya lo cubre",
  "se ve bien así"); `test-writer`/`qa-structured` conectan directo con el antipatrón que persigue
  [IDEAS.md #54](../../IDEAS.md) (tests que pasan vacíamente).
  **Alcance corregido (2026-07-31):** el ítem NO es solo `iron_law` + `common_rationalizations` +
  `red_flags`. El clasificador de selección automática **no lee el `iron_law`** — lee `description`
  + `when_to_use` ([project.ts:143-145](../../src/dashboard/handlers/project.ts)). Esos dos campos **son
  el criterio de disparo**, y por lo tanto son la parte de este ítem que habilita el Bloque O.
  Verificado 2026-07-31: 21/24 skills tienen `when_to_use`; **sin él están `fix-typescript-errors`,
  `generate-prisma-migration` y `summarize-pr-diff`** — hoy prácticamente inelegibles de forma
  automática. Escribir `description` como condición de disparo ("Use when…"), no como resumen.
  Las 5 piloto deben escribirse ya con el contrato de activación de O.2 definido, para no volver a
  generar contenido que el motor no sabe interpretar.
  **Cerrado 2026-08-02.** Las 5 skills (`skills/*.yaml`) recibieron: `description` reescrita como
  condición de disparo ("Use when…", antes eran resúmenes); `iron_law` (una regla, ≤300 chars);
  3 `common_rationalizations` (excusa real que un ejecutor barato usaría + su refutación, no
  genéricas); 3 `red_flags` observables en el diff/output, no juicios subjetivos; y `activation`
  (O.0) — `security-review`/`qa-structured` en `mode: automatic` + `phases: [review]`
  (`security-review` además con `triggers:` deterministas: auth/secrets/user_input/file_upload/
  api_endpoint — es un gate, no debe depender del juicio semántico del mismo LLM que hace el
  trabajo); `tdd-enforcer`/`test-writer`/`frontend-design` en `mode: suggest` +
  `phases: [implement, fix]` (guían el trabajo, no lo bloquean). Verificado contra el registro real
  (`loadSkill()`/`validateSkill()`, no solo YAML a ojo) y contra `buildSections()`: el `iron_law` de
  `security-review` compila antes de las instrucciones — el gate de N.4.5 funciona con contenido
  real, no solo con el fixture de test. `tsc --noEmit` limpio, `bun run test:coverage` (comando
  exacto de CI): 1044 tests, 0 fail, cobertura sobre el umbral.
- [x] **N.5.1 — 🧠 Corrección de fidelidad contra la fuente real (2026-08-02).** Carlos pidió volver
  a la fuente antes de dar N.5 por bueno — patrón recurrente suyo en otros proyectos ("por escribir
  muy general a veces se pierden detalles"). Auditoría contra el código fuente real (`gh api`, no
  memoria ni suposición) de las 5 skills:
  - **`tdd-enforcer` — hallazgo confirmado, no hipótesis.** `obra/superpowers`
    (`skills/test-driven-development/SKILL.md`, MIT) es el origen literal del patrón "Iron Law /
    Common Rationalizations / Red Flags" que da nombre a este Bloque N — no una inspiración vaga, el
    vocabulario es idéntico. Su tabla real tiene **10** rationalizations con refutación específica y
    **13** red flags verificados en batalla; N.5 había escrito **3+3 genéricas, inventadas**. Corregido:
    las 10+13 ahora viven en [skills/tdd-enforcer.yaml](../../skills/tdd-enforcer.yaml) copiadas fieles al
    original (excuse/refutation ≈ Excuse/Reality de la fuente), con comentario de atribución en el
    YAML. Recargado contra `loadSkill()` real: 10 rationalizations, 13 red_flags, valida limpio.
  - **`security-review` y `test-writer` — sin fuente 1:1.** Revisada la lista completa de skills de
    `obra/superpowers` (`brainstorming`, `verification-before-completion`, `systematic-debugging`,
    `writing-plans`, etc.) — ninguna es de seguridad OWASP ni de "agregar tests a código existente".
    Según DONE.md (líneas 2263-2265) nacieron directo en S18 (2026-05-27) sin importación. No hay
    pérdida de fidelidad posible porque nunca fueron traducción de nada — contenido propio.
  - **`qa-structured` — prima, no copia.** `verification-before-completion` (superpowers) comparte
    el principio ("evidencia antes que afirmación") pero es una skill distinta (esa es "no digas que
    terminaste sin correr el comando"; la nuestra evalúa contra criterios de aceptación). Sin drift
    porque nunca fue traducción de esa skill.
  - **`frontend-design` — verificado contra `pbakaus/impeccable` (Apache 2.0), fiel.** El YAML ya
    citaba la fuente explícitamente. Se comparó contra el detector mecánico real del plugin
    (`scripts/detector/rules/checks.mjs`, 5580 líneas — el linter real, no solo prosa): contraste
    4.5:1/3:1 coincide exacto (`reference/colorize.md:59-61`), `gradient-text`
    (`background-clip:text`+gradient) coincide exacto (`checks.mjs:175-176`), `eyebrow chip` y
    `round-dot radius` coinciden en concepto. Veredicto: distilación fiel, no genérica — no requiere
    corrección.
  - **Hallazgo adicional, fuera de alcance de N.5, anotado para no perderlo:**
    `VoltAgent/awesome-design-md` (vault:
    `raw/ai/skills/VoltAgentawesome-design-md...md`) es una colección de `DESIGN.md` por marca
    (Stripe, Apple, Linear, etc. — formato Google Stitch) que un agente lee para clonar el lenguaje
    visual de una marca específica. **No es una corrección de `frontend-design`/`design-tokens`** —
    es una capacidad nueva que OrchestOS no tiene (importar un `DESIGN.md` externo para una tarea
    puntual). Candidato de IDEAS.md, no se toca en este ítem.
- [x] **N.6 — 🔍** (cerrado 2026-08-02) Gate: verificar contra el **prompt real compilado**, no
  contra el YAML. Tests nuevos ([src/__tests__/skill-compile-gate.test.ts](../../src/__tests__/skill-compile-gate.test.ts))
  contra los 3 compiladores reales (`compileClaude`/`compileCursor`/`compileOpenAI`, no solo
  `buildSections()`) usando skills reales del repo, no fixtures: `security-review` (endurecida) —
  `iron_law` antes de `instructions` en los 3 targets; `diagnose` (sin campos nuevos) — cero
  secciones de endurecimiento, cero regresión.
  **Verificación en vivo en el dashboard de N.4** ([[feedback-verificar-gates-en-vivo]]), no solo
  `bun test`: servidor real levantado (`PORT=4310 bun run src/dashboard/server.ts`),
  `POST /api/skills/security-review/build` (el botón Build real de N.4) escribió
  `dist/skills/{claude,cursor,openai}/security-review.{md,mdc,json}` — inspeccionados en disco,
  `## Iron law` aparece antes de la sección OWASP en los 3. Mismo build contra `diagnose`: cero
  secciones nuevas, `instructions` arranca igual que antes de N.1. `GET /api/skills/security-review`
  (el detalle que consume N.4) devuelve `iron_law`/`activation`/`common_rationalizations`/
  `red_flags` reales. Servidor bajado al terminar ([[feedback-siempre-cerrar-servidor]]).
  1060 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` (comando exacto de CI)
  verde, cobertura sobre el umbral. **Bloque N cerrado por completo.**

#### ⚠️ Aclaración obligatoria sobre "las 5 piloto" (Carlos, 2026-08-02) — leer antes de tocar skills

**"5 piloto" fue una decisión sobre CUÁNTO CONTENIDO ESCRIBIR, no sobre qué skills usa OrchestOS.**
Si algún LLM (o Carlos en 3 meses) lee N.5 y concluye "OrchestOS ahora usa 5 skills", está mal.
Palabras de Carlos: *"no usar las 24 no significa descartar, significa usar cuando sea el caso de
usar"*.

- **Las 24 siguen activas e instaladas.** 16 en `skills/` + 8 en `skills/pro/`. Ninguna fue
  deprecada, borrada ni despriorizada. Las 19 que no recibieron `iron_law` simplemente **todavía no
  tienen ese contenido escrito** — siguen cargando, compilando y aplicándose exactamente igual que
  antes (verificado en N.6: `diagnose` sin campos nuevos compila idéntico a como compilaba antes de
  N.1, cero regresión).
- **Por qué Carlos quiere muchas skills** (criterio de producto, no colección): que sirvan **tanto a
  un dev como a un no-dev**. No busca acumular — busca "las suficientes para que sea de ayuda para
  el usuario". Una skill de más que nunca se activa no molesta (el Bloque O decide cuál aplica); una
  skill que falta sí deja al usuario sin ayuda en ese caso.
- **Corrección de un número que se cruzó esta semana:** son **24 skills**, no 34. El 34 eran los
  CLIs de agente que detecta Orca (`agent-kind.ts`, investigación de IDEAS #39) — concepto
  distinto, se mezcló en la misma semana.
- **La fuente de skills NO se abandona.** `obra/superpowers`, `mattpocock/skills` y el resto siguen
  siendo fuentes vivas de las que traer skills nuevas cuando haga falta — ver Bloque P
  (`sources-drift`), que existe justamente para no perderlas de vista.

**N.7 — Extender la auditoría de fidelidad (N.5.1) a las 19 skills restantes.** Pedido
  explícito de Carlos (2026-08-02): *"si se hizo con las 5 debe hacerse con el resto en base a las
  repos originales donde viven realmente cada una"*. **Prerequisito real: hoy no existe un registro
  confiable de procedencia por skill** — lo que hay está disperso y en parte es contradictorio.

  **Partido en dos (decisión Carlos, 2026-08-03).** Motivo: la descripción original ("largo y
  mecánico") era imprecisa — N.7 es largo, pero mecánico **solo en parte**. Y hay una ironía a
  respetar: *N.7 existe porque se escribió contenido genérico en vez de ir a la fuente*; delegar la
  parte de fidelidad a un modelo barato corre exactamente el mismo riesgo de parafrasear. Por eso el
  corte deja a Codex **sin poder tocar contenido**.

  Evidencia recogida el 2026-08-02, sin inventar el resto:
  - `skills/pro/` (8) — [DONE.md:3529](../../DONE.md) dice *"curados desde mattpocock/skills y
    obra/superpowers"* pero **no dice cuál vino de cuál**: `code-review`, `refactor-guided`,
    `pr-description`, `bug-hypothesis`, `api-contract`, `db-migration-safe`, `perf-profile`,
    `doc-gen`. Mapeo probable pero **no verificado**: `code-review` ↔ mattpocock
    `engineering/code-review`; `bug-hypothesis` ↔ mattpocock `engineering/diagnosing-bugs`.
  - `skills/` (16) — [DONE.md:2208](../../DONE.md) declara nativas de S14.4–S14.8 (2026-05-27):
    `pre-task-alignment`, `diagnose`, `tdd-enforcer`, `context-compression`,
    `improve-architecture`; S18.1–S18.3 nativas: `security-review`, `qa-structured`, `test-writer`;
    [DONE.md:3151](../../DONE.md) declara 4 de diseño nativas: `frontend-design`, `ux-guidelines`,
    `design-brief-inference`, `design-tokens`.
  - **Contradicción real a resolver, no ignorar:** `improve-architecture` figura como *nativa* pero
    mattpocock tiene `engineering/improve-codebase-architecture` (nombre casi idéntico, y es una de
    las skills que Carlos tiene instaladas en su propio Claude Code). Igual `tdd-enforcer` (nativa)
    vs. mattpocock `engineering/tdd` **y** superpowers `test-driven-development` — de esta última
    sí se confirmó relación en N.5.1. "Nativa" en DONE.md puede significar "escrita acá" o "escrita
    acá inspirándose en X sin anotarlo" — hay que verificar caso por caso contra el upstream real,
    no confiar en la etiqueta.
  - Sin fuente externa conocida: `fix-typescript-errors`, `generate-prisma-migration`,
    `summarize-pr-diff` (además son las 3 sin `when_to_use`, ver N.5).
- [x] **N.7a — ⚡** (2026-08-03) Descubrimiento de procedencia (solo evidencia, NO toca contenido). Para cada una
  de las **24** skills (16 en `skills/` + 8 en `skills/pro/`), buscar en `obra/superpowers`
  (`skills/*/SKILL.md`) y `mattpocock/skills` (`skills/engineering/*`, y las otras categorías) si
  existe un archivo con nombre igual o parecido, vía `gh api`. Producir **una tabla de evidencia**
  en `docs/skills-provenance-audit.md` con, por fila: `skill local` · `candidato upstream (repo +
  path)` · `tamaño` · `primeras ~15 líneas del upstream` · `parecido del nombre (exacto / parcial /
  ninguno)`.
  Verificado contra los árboles completos de ambas repos en los commits consignados en el documento;
  24 skills auditadas, cero YAMLs modificados.
  **Límites duros de este ítem** — están para que la delegación no pueda reintroducir el error que
  motivó N.7: (a) **NO modificar ningún `.yaml` de `skills/`**; (b) **NO decidir** si un parecido es
  copia o coincidencia — solo reportar lo que existe; (c) **NO resumir ni parafrasear** el contenido
  upstream, pegar el fragmento literal; (d) si no hay candidato, escribir *"sin candidato"*, nunca
  inventar uno plausible. El entregable es un documento nuevo, cero cambios en skills.
- [x] **N.7b — 🧠 (2026-08-03) Decisión, porteo y registro para las 16 de `skills/` (sobre la tabla de N.7a).** (1) Decidir caso por caso
  si el parecido es copia derivada o trabajo independiente — es criterio, con el contexto del
  proyecto a la vista (ej. `improve-architecture` vs. mattpocock `improve-codebase-architecture`:
  DONE.md dice "nativa", el nombre dice otra cosa); (2) las que SÍ tengan fuente confirmada →
  portar **verbatim** el contenido rico perdido, como se hizo con `tdd-enforcer` (10
  rationalizations + 13 red flags en vez de 3+3 genéricas); (3) las genuinamente nativas → escribir
  contenido propio o dejarlas sin endurecer, pero **declarándolo**, no por omisión; (4) **cada
  fuente confirmada entra en [docs/sources-registry.yaml](../../docs/sources-registry.yaml)** (Bloque P)
  para que la deriva futura se detecte sola — hoy el registro solo tiene 5 entradas porque son las
  únicas verificadas; (5) `when_to_use` en las 3 que no lo tienen (`fix-typescript-errors`,
  `generate-prisma-migration`, `summarize-pr-diff`) — **esta parte es prerequisito de O.2**, sin ese
  campo son inelegibles para la selección automática, así que conviene adelantarla aunque el resto
  de N.7b espere.
  Al revisar lo que devuelva N.7a: **un `[x]` de una corrida delegada no es evidencia** — grepear lo
  concreto antes de confiar ([[feedback-verificar-progreso-delegado]]).

  **Resultado (evidencia completa en [docs/skills-provenance-audit.md](../../docs/skills-provenance-audit.md) § N.7b):**
  - **Verificada la entrega de Codex antes de usarla**: no tocó ningún YAML (commit `4b09004` toca
    solo 3 archivos, ninguno de `skills/`), usó "sin candidato" 14 veces (no inventó), y el
    spot-check de un fragmento contra el upstream real dio **byte-idéntico** (no parafraseó). 24/24
    cubiertas, con los SHA upstream declarados. Respetó los 4 límites duros.
  - **Las 16 de `skills/` son NATIVAS.** Los 4 candidatos con parecido de nombre resultaron
    coincidencias **solo léxicas**, verificado leyendo el contenido: `qa-structured` vs el `qa` de
    mattpocock (el upstream abre issues de GitHub conversando; el nuestro da un veredicto pass/fail
    contra criterios), `security-review` vs `code-review` (OWASP vs Standards+Spec),
    `frontend-design` vs `design-an-interface` (diseño de API de módulo, no visual — su fuente real
    es Impeccable, ya verificada en N.5.1), y `test-writer` vs TDD (opuesto: la implementación ya
    existe). **`improve-architecture` queda resuelto**: el upstream *rechaza explícitamente* las
    heurísticas rígidas que el nuestro usa (>300 líneas, >5 imports) y depende de primitivas de
    Claude Code que OrchestOS no tiene — la etiqueta "nativa" de DONE.md **era correcta**, la
    contradicción marcada en N.7 se cierra. **No había contenido perdido que portar en esta
    carpeta**: el riesgo que motivó N.7 no se materializó acá.
  - **Hallazgo de método — match nominal ≠ match semántico.** N.7a emparejó `diagnose` con
    mattpocock `diagnosing-bugs` por nombre, y esa **no tiene contenido portable**; el match real
    era `obra/superpowers/skills/systematic-debugging` (Iron Law + 8 rationalizations + red flags),
    que una búsqueda por nombre jamás encuentra. **Esto valida el corte N.7a/N.7b**: buscar es
    delegable, *decidir qué es la misma cosa* no.
  - **Porteo aplicado**: `diagnose` recibió `iron_law` + 8 `common_rationalizations` + 7
    `red_flags` casi verbatim de `systematic-debugging`, y la fuente quedó registrada en
    [sources-registry.yaml](../../docs/sources-registry.yaml) (6 entradas, `sources:drift` verde).
  - **`when_to_use` faltantes: resueltos.** Los 3 escritos y sus `description` reescritas como
    condición de disparo. **0 skills sin `when_to_use`** (eran 3) — **prerequisito de O.2 cerrado**.
  - **Fixture frágil corregido de paso**: el gate de N.6 tenía `diagnose` hardcodeada como "skill
    sin endurecer"; endurecerla puso 4 tests en rojo por un fixture obsoleto, no por una regresión.
    Ahora la elige dinámicamente (con fallback sintético si algún día todas están endurecidas), así
    cada avance de N.7c no vuelve a romperlo.
  - 1073 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde.
- [x] **N.7c — 🧠 (2026-08-05) Auditoría de las 8 de `skills/pro/` (sobre la tabla de N.7a).**
  Leído el contenido completo de los 4 candidatos con parecido nominal (`systematic-debugging`,
  `receiving-code-review`, `requesting-code-review` de `obra/superpowers`; `code-review` y
  `request-refactor-plan` de `mattpocock/skills`), no solo el nombre — mismo método que N.7b.

  **Decisiones:**
  - **`bug-hypothesis` vs `systematic-debugging`: coincidencia léxica, no copia.** El upstream
    (Fase 3, "Hypothesis and Testing") pide **una** hipótesis a la vez, root-cause primero; nuestro
    `bug-hypothesis` es lo opuesto a propósito: triage rápido que **rankea 3-5 candidatos** ANTES de
    tocar código, paso previo a un debugging profundo. Además su Iron Law/rationalizations ya están
    portados en `skills/diagnose.yaml` (N.7b) — duplicarlos acá sería redundante, no fidelidad.
    **Nativa, sin porteo.**
  - **`refactor-guided` vs `request-refactor-plan`: coincidencia léxica, no copia.** El upstream es
    una fase de **planificación** (entrevista al usuario, abre un issue de GitHub con plantilla);
    `refactor-guided` es la fase de **ejecución** (pasos chicos, tests verdes en cada uno). Ninguna
    superposición de contenido — el upstream ni siquiera tiene tabla de rationalizations/red_flags
    que portar (confirmado leyendo las 68 líneas completas, no solo el fragmento de N.7a).
    **Nativa, sin porteo.**
  - **`code-review` vs `receiving-code-review`/`requesting-code-review`: coincidencia léxica, no
    copia.** Ambas superpowers skills son sobre **recibir** feedback o **despachar** un subagente
    revisor — actores y mecánica distintos al nuestro (que **da** la revisión, 4 passes sobre un
    diff). `receiving-code-review` no tiene contraparte local (no existe una skill de "cómo
    responder a review" en `skills/pro/`). **Sin porteo de estas dos.**
  - **`code-review` vs mattpocock `engineering/code-review`: SÍ hay contenido portable**, a
    diferencia del veredicto de N.7b para `security-review` contra la misma fuente (ahí era
    coincidencia total). El diseño de 2 ejes con subagentes paralelos no es portable (depende de
    `docs/agents/issue-tracker.md` y de convocar Agent tool en paralelo, que nuestro Pass-based
    review no usa), **pero el catálogo de 12 code smells de Fowler** (*Refactoring* ch.3) que el
    upstream usa como baseline de la Standards axis es contenido genérico y real, no específico de
    su mecánica. Portado a la Pass 2 (Design) de
    [skills/pro/code-review.yaml](../../skills/pro/code-review.yaml): Mysterious Name, Duplicated Code,
    Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent
    Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest — cada uno con su
    fix de una línea, igual que el upstream. También un `anti_pattern` nuevo ("no saltar review por
    simple"), adaptado del Red Flags de `requesting-code-review`. Registrado en
    [sources-registry.yaml](../../docs/sources-registry.yaml) (`mattpocock-code-review-smells`).
  - **Las otras 5 (`api-contract`, `db-migration-safe`, `doc-gen`, `perf-profile`,
    `pr-description`): sin candidato en N.7a, confirmado sin overlap conceptual al releerlas.
    Nativas.**

  **Conclusión:** de 8 skills de `skills/pro/`, 7 son nativas y 1 (`code-review`) recibió un porteo
  real y acotado (un catálogo de smells, no una reescritura). Documentado en
  [docs/skills-provenance-audit.md § N.7c](../../docs/skills-provenance-audit.md). Cierra Bloque N por
  completo (N.1–N.7c).

### Bloque O — 🧠 Skills que se activan solas (decisión Carlos 2026-07-31)

**Problema de raíz, en palabras de Carlos:** *"tengo muchas skills pero tengo que llamarlas — yo,
incluso un usuario avanzado, no me voy a acordar de tantos comandos. Quería traer las skills a
cualquier proyecto como una 'armadura' para ciertas 'batallas', pero no por tenerlas debo usarlas
todas: debe haber un criterio. Y una tarea conlleva varias skills, no una."*

**Hallazgo que redujo el alcance (verificado en código 2026-07-31): el 90% ya existe.** La
intuición de "subdividir la tarea para que cada skill se aplique en su campo" **ya es cómo funciona
OrchestOS**: `planner.ts` descompone en un DAG de sub-tareas, `SubTask` **ya tiene su propio campo
`skill`** ([sub-task-schema.ts:248](../../src/agents/sub-task-schema.ts)), `subTaskToTask()` lo pasa a
`Task.skill` ([executor.ts:139](../../src/agents/executor.ts)) y de ahí va al harness → `skillRoute` →
prompt. El límite de "1 skill por tarea" **no es del modelo de datos** — es de la creación manual.
El cable suelto: **`planner.ts` menciona la palabra `skill` cero veces**; su schema JSON obliga
`id`/`description`/`acceptance`/`depends_on`/`allowed_tools` y nunca `skill`. El único componente
que decide cómo se reparte el trabajo es ciego al arsenal.

**Por eso este bloque REEMPLAZA la propuesta N-AUTO.1–5** (contrato de activación / descubrimiento /
activación por fases / evidencia / gate): mezclaba conceptos nuevos con mecanismos que ya existen.
Descartado explícitamente por sobreingeniería: embeddings (24 skills, un clasificador barato contra
lista cerrada alcanza — ver [docs/semantic-skill-selection-design.md](../../docs/semantic-skill-selection-design.md));
una máquina de fases nueva (`TaskClass = plan|implement|fix|review|doc` ya existe en
[classify.ts:7](../../src/router/classify.ts) y ya se persiste en `runs.task_class`); y migrar
`Task.skill` a `{primary, gates}` (el DAG ya da la multiplicidad; los gates son transversales, no
van en el `Task`).

Los tres mecanismos se separan a propósito — tratarlos como uno solo es lo que hacía parecer esto
un problema grande: **retrieval** (qué skills son relevantes), **binding** (dónde se engancha cada
una — ya existe, es el DAG) y **enforcement** (cuáles no son negociables).

- [x] **O.0 — 🧠 Contrato de activación mínimo (prerequisito de O.2 y O.3).** (cerrado 2026-08-02,
  adelantado como prerequisito real de N.5 — sin esto, escribir `activation:` en las 5 skills piloto
  habría sido el mismo "contenido muerto" que motivó N.1-N.3). Implementado en
  [src/skills/registry.ts](../../src/skills/registry.ts): `SkillActivation { mode, triggers?, phases? }`,
  `phases` tipado como `TaskClass[]` (import type de
  [router/classify.ts](../../src/router/classify.ts), sin taxonomía nueva) y validación en
  `validateSkill()` con el mismo patrón que los campos de N.1 (mode contra allowlist, triggers/phases
  no vacíos y tipados). 12 tests nuevos. `tsc --noEmit` limpio, 1044 tests, cobertura sobre el
  umbral de CI. Consumo real (O.2/O.3: el planner y los gates leyendo este campo) queda para cuando
  se ataque el resto del Bloque O — este ítem es solo el contrato, adelantado.

  Contexto original (2026-07-31), tras contrastar con el análisis de Codex: la primera versión de
  este bloque descartó el contrato
  de activación entero por sobreingeniería y **sobre-corrigió** — O.2 y O.3 dependían en silencio de
  una declaración que **no existe en ningún lado**. Verificado: `activation` / `mandatory` /
  `trigger` dan **cero resultados** en `src/skills/` y en las 24 YAML. Sin esto, "skill obligatoria
  por señal de riesgo" termina hardcodeado en el código y deja de ser portable a otros proyectos
  (contradice O.1). Es un artefacto verificable en el punto de decisión, no prosa (INS-2026-001).
  **Exactamente 3 campos, nada más:**
  - `activation.mode: automatic | suggest | explicit` — resuelve el segundo hueco: hoy **nadie
    construye el modo sugerir para el camino automático**. Ojo, el modo sugerir **ya existe en el
    camino manual**: `renderSkillSuggestion()`
    ([screens-core.js:165](../../src/dashboard/public/screens-core.js)) ya define la convención (0
    candidatas → sin campo; 1 → precargada; 2+ → "Ninguna" preseleccionada, *"nunca resolver el
    empate a ciegas"*). Esa filosofía conservadora es **la misma** que hace que `pickAutoSkill()`
    devuelva `undefined` con 2+ candidatas. **No es un bug: es una regla deliberada que servía
    cuando había un humano mirando el composer y que, desde que D.7 crea tareas sola, se traduce en
    "no se aplica ninguna skill nunca".** Es el origen concreto del dolor que reporta Carlos.
  - `activation.triggers: string[]` — **solo para gates**, y deterministas/observables (tocó
    archivos de auth, la tarea declara endpoints, hay secretos en el diff). **Distinción
    arquitectónica central del bloque:** una skill de implementación puede activarse por
    clasificador semántico (`when_to_use` en lenguaje natural, tolerante y flexible); **un gate de
    seguridad NO** — si se activa porque a un LLM le pareció que había autenticación, falla
    exactamente cuando el LLM se equivoca, o sea en los casos raros, que son los peligrosos. Un gate
    que depende del mismo juicio probabilístico que puede fallar **no es un gate, es una sugerencia
    con mejor nombre**.
  - Fase de aplicación: **reusar `TaskClass`** (`plan|implement|fix|review|doc`,
    [classify.ts:7](../../src/router/classify.ts), ya se persiste en `runs.task_class`) — **no** inventar
    un campo `phases`.

  **Descartado explícitamente de la propuesta de Codex** (evaluado con el código a la vista, no por
  capricho): `requires_confirmation` (redundante con `mode: suggest`); `composes_with`, conflictos y
  `confidence` (no hay consumidor — config que nadie lee); `phases` como campo nuevo (`TaskClass` ya
  existe); y la taxonomía de 6 tipos de skill (implementación/análisis/revisión/verificación/
  seguridad/diseño) — **dos categorías alcanzan**: *guía el trabajo* vs *lo bloquea*; seis tipos sin
  diferencia de comportamiento es config decorativa.
- [x] **O.1 — 🧠 (C) Las skills se resuelven desde la instalación, no desde `cwd`.**
  `getSkillsDir()` es `join(process.cwd(), 'skills')` **sin fallback**
  ([registry.ts:47](../../src/skills/registry.ts)). Cuando OrchestOS gestiona **otro** proyecto, `cwd` es
  ese proyecto, ahí no hay carpeta `skills/`, `listSkillFiles()` devuelve `[]` → cero candidatas →
  **no se activa ninguna skill, jamás**. Sin este ítem, todo el Bloque O funciona solo dentro de
  este repo y no entrega nada en CitasBot / Cisepro / cualquier otro. Aplicar el patrón **idéntico**
  ya decidido para roadmaps (decisión M, 2026-07-30, "centralizado, no copiado"): probar `root`
  primero y caer a la instalación vía `import.meta.dir` — ver `ROADMAP_DOCS_ROOT` en
  [roadmap-profile.ts:16](../../src/detect/roadmap-profile.ts) y [context.ts:17](../../src/roadmaps/context.ts).
  Las skills propias del proyecto siguen ganando sobre las centralizadas.

  **CERRADO 2026-08-03.** `SKILLS_INSTALL_ROOT = join(import.meta.dir, '..', '..')` en
  [registry.ts](../../src/skills/registry.ts), mismo patrón que roadmaps.
  **Lectura y escritura quedaron deliberadamente asimétricas** — es la decisión de diseño del ítem,
  no un detalle: leer cae al fallback (`resolveSkillPath`/`resolveProSkillPath`), pero **escribir
  apunta siempre al proyecto** (`getSkillPath`/`getProSkillPath`), porque crear o editar una skill
  mientras se gestiona otro repo no debe mutar la instalación de OrchestOS. Es la misma excepción
  que `project-profile.md` en la decisión M.
  - `listSkillFiles()`/`listProSkillFiles()` ahora **unen** proyecto + instalación con el proyecto
    ganando ante mismo id. Dedupe por nombre de archivo, no por ruta: cuando `cwd` **es** la
    instalación (OrchestOS trabajando sobre sí mismo) las dos carpetas son la misma y sin dedupe
    cada skill aparecería dos veces — cubierto por test.
  - **Editar** una skill centralizada desde otro proyecto hace **copy-on-write**: escribe una copia
    local que la pisa, nunca toca la central. **Borrar** una skill que solo existe centralmente se
    rechaza con `409` explícito en vez de fallar en silencio o borrarla para todos los proyectos.
  - **Hallazgo colateral — N.4.5 estaba incompleto.** [cli.ts:582](../../src/cli.ts) era una **tercera
    copia** del snippet que inyecta `skill.instructions` crudo; N.4.5 solo corrigió `prompt.ts` y
    `skill-route.ts`. Y como el CLI pasa `skillGuidelines` explícito a `buildPrompt()`, bypasseaba
    el fallback ya arreglado: **por el camino del CLI el `iron_law` seguía sin llegar al ejecutor**.
    Ahora usa `buildSections()`. Es el mismo fallo de N.4.5, encontrado un mes después en un tercer
    sitio — señal de que el snippet duplicado era el problema real.
  - 7 tests nuevos ([skill-central-resolution.test.ts](../../src/__tests__/skill-central-resolution.test.ts)),
    incluido el caso que antes era imposible de probar: proyecto ajeno sin `skills/` propia.
    Gotcha anotado: en macOS `tmpdir()` da `/var/...` pero `chdir()` resuelve a `/private/var/...`,
    hay que pasar por `realpathSync` o las comparaciones de ruta fallan.
  - **Verificación en vivo** (no solo tests): directorio vacío en `/tmp`, `chdir`, `listSkillFiles()`
    → **16 skills visibles donde antes eran 0**, y `security-review` resolviendo contra la
    instalación real. 1073 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde.
- [x] **O.2 — 🧠 (A) El planner ve el catálogo y asigna skill por sub-tarea.** Agregar `skill` al
  schema JSON de [planner.ts](../../src/agents/planner.ts) + pasarle la lista resumida (id + description
  + when_to_use, que ya arma `listAllSkillCandidates()`,
  [project.ts:68](../../src/dashboard/handlers/project.ts)). El resto del camino ya está cableado. Cubrir
  **los dos caminos**, no solo el planner: las tareas chicas que no se descomponen hoy dependen de
  `pickAutoSkill()` ([chat.ts:377-380](../../src/dashboard/handlers/chat.ts)), que son 3 líneas — si hay
  `frontend-design` gana, si no solo aplica cuando hay **exactamente una** candidata; con 3
  candidatas razonables devuelve `undefined` y la tarea corre **sin ninguna skill**. Es literalmente
  lo contrario del objetivo: hoy la ambigüedad se resuelve descartando todo en silencio — la
  ambigüedad pasa a resolverse según `activation.mode` (O.0), no descartando. Validar
  contra ids reales también en el camino de sub-tareas (`isKnownSkillId` hoy vive solo en el handler
  del dashboard, [tasks.ts:155](../../src/dashboard/handlers/tasks.ts)) — el planner no debe poder
  inventar un id.

  **CERRADO 2026-08-03.** `planner.ts` mencionaba la palabra "skill" **cero veces** — el único
  componente que decide cómo se reparte el trabajo era ciego al arsenal. Ahora:
  - **Módulo compartido nuevo** [src/skills/catalog.ts](../../src/skills/catalog.ts):
    `listAllSkillCandidates()` e `isKnownSkillId()` vivían dentro de la capa dashboard
    (`handlers/project.ts` y `handlers/tasks.ts`) y el planner (capa agents) las necesita —
    importar dashboard desde agents habría invertido las capas. Extraídas; los handlers re-exportan
    para no romper su API ni los tests existentes.
  - **El planner ve el catálogo**: `skill` agregado al schema JSON de `create_subtask` y al fallback
    YAML, y `withSkillCatalog()` inyecta el catálogo real en ambos system prompts. Verificado en
    vivo: **24 skills, 9.335 chars** — **solo metadata** (id + description + when_to_use), nunca el
    cuerpo; cargar las 24 completas inflaría el contexto y diluiría las instrucciones que importan.
    El cuerpo se sigue cargando después y solo el de la skill elegida. Sin skills instaladas el
    prompt queda idéntico al de antes (cero regresión).
  - **Fail-safe contra ids inventados en el camino de sub-tareas**: `dropUnknownSkills()` en los dos
    puntos de retorno de `createPlan`. Un id inventado se descarta en silencio y la sub-tarea corre
    sin skill — el comportamiento previo a O.2 — en vez de romper el plan entero.
  - **`pickAutoSkill()` deja de descartar ante ambigüedad** — era el origen concreto del dolor. Eran
    3 líneas: con 2+ candidatas y sin `frontend-design` devolvía `undefined` y **la tarea corría sin
    ninguna skill**. Esa regla venía del camino manual (`renderSkillSuggestion`, "nunca resolver el
    empate a ciegas"), correcta con un humano mirando el composer, pero desde que D.7 crea tareas
    sola se traducía en "no se aplica ninguna skill nunca". Ahora desempata por
    `activation.mode: automatic` (contrato O.0) → `frontend-design`
    ([[feedback-skill-autoselect-tiebreak]], conservado) → candidata única → sin asignar. **Acá
    `activation` deja de ser contenido inerte: es el primer consumidor real de O.0.**
  - 12 tests nuevos ([planner-skill-catalog.test.ts](../../src/__tests__/planner-skill-catalog.test.ts)),
    incluido el de regresión explícito (`security-review` + `test-writer` ya no devuelve `undefined`)
    y uno que verifica que el cuerpo de las skills **no** se filtra al prompt.
  - 1085 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde.
- [x] **O.3 — 🧠 (2026-08-05) (B) Gates transversales que no se pueden perder en silencio.** `security-review` y
  `qa-structured` **no son "una sub-tarea más"**: son transversales al output completo y **no deben
  ser elegibles por el mismo LLM que hace el trabajo** — se autoconvence de saltárselas. Esa es la
  razón de ser de `iron_law`/`common_rationalizations` (N.1–N.3): si el mismo criterio que elige la
  skill puede descartarla, el endurecimiento no sirve de nada. **La condición de gate se declara en
  `activation.mode: automatic` + `activation.triggers` del YAML de la skill (O.0), nunca en un `if`
  del código** — si vive en código no es portable a otros proyectos y contradice O.1. Aplicados
  post-hoc sobre el stage de QA/adversarial que **ya existe** en el harness (no inventar un stage
  nuevo). Si un gate no se ejecuta → `missing`/`blocked`, **nunca
  "listo"** (INS-2026-011). Registrar por corrida: candidatas, aplicadas, rechazadas, motivo de
  activación y resultado de cada gate — hoy `runs.skill_id` es un escalar nullable y **no permite
  distinguir "ninguna skill aplicaba" de "el selector falló en silencio"**; un gate saltado es
  indistinguible de uno que nunca se consideró.
  **Consecuencia de seguridad a resolver dentro de este ítem (INS-2026-014):**
  [tool-policy.ts:5](../../src/run/middlewares/tool-policy.ts) hace
  `ctx.allowedTools = skill.allowed_tools ?? []`. Hoy es inocuo porque la skill la elige Carlos; con
  selección automática, **elegir una skill pasa a cambiar solo los permisos de herramientas del
  agente** (puede restringirlos y hacer fallar la tarea de forma confusa, o ampliarlos). Debe quedar
  explícito y registrado, nunca silencioso.

  **CERRADO 2026-08-05.**
  - **`resolveGates(taskText, phase)`** nuevo en
    [src/skills/catalog.ts](../../src/skills/catalog.ts): busca skills con `activation.mode: automatic` +
    `phases` incluye la fase actual. Sin `triggers` → aplica siempre (`qa-structured`). Con
    `triggers` → requiere al menos una coincidencia case-insensitive contra el texto de la tarea
    (`security-review`; `_` también matchea con espacio). La decisión vive 100% en el YAML — cero
    `if` de código, portable a otros proyectos (O.1).
  - **Inyección en el stage existente** ([src/run/qa.ts](../../src/run/qa.ts)): `runQA()` acepta
    `gateSkills?: SkillDef[]` y agrega un bloque `## GATE: <nombre>` por cada gate aplicada, con el
    texto "this gate is mandatory — it was NOT chosen by you" para que el mismo LLM que revisa no
    se autoconvenza de saltarla. `qa-structured` se excluye a propósito de la inyección: su
    metodología YA es el branch `hasCriteria` que existía antes de O.3 — inyectarla de nuevo sería
    contenido duplicado, no una gate adicional. `runAdversarialQA()` (el segundo juez, opt-in) queda
    fuera a propósito: es una segunda opinión sobre un veredicto que ya pasó, no el punto donde el
    gate debe pesar.
  - **Registro por corrida**: columna nueva `runs.skill_gates_json` (`db/migrate.ts`,
    `db/runs.ts`) — JSON `[{id, candidate, applied, reason}]`, calculado una vez en `harness.ts`
    antes de invocar `runQA()` y persistido en los dos `insertRun()` posteriores al stage de QA.
    Las corridas que fallan ANTES de llegar a QA (checks, contrato) guardan `NULL` — distinto a
    distinguir de un array con `applied: false`, que sí llegó a evaluarse y no aplicaba. Expuesto
    también en el dashboard (`RunRow.skillGates`, `dashboard/handlers/runs.ts`) para que O.4 tenga
    el dato sin tener que releer JSON crudo — sin UI todavía, eso es O.4.
  - **INS-2026-014, hallazgo real al verificar antes de "arreglar"**: `ctx.allowedTools` (seteado
    por `tool-policy.ts`) **no lo lee ningún ejecutor** — `grep -rn ".allowedTools\b" src/` no
    devuelve nada fuera de ese propio middleware. El riesgo literal del ítem (una skill
    auto-elegida restringe permisos en silencio) **no se materializa hoy** porque el campo es dead
    code, no porque esté bien defendido. El mecanismo que sí enforcea de verdad es otro:
    `SubTask.allowed_tools` del planner, requerido y chequeado hard en `agents/executor.ts`.
    Cablear una enforcement real en `tool-policy.ts` redefiniría el modelo de seguridad de 3+
    ejecutores — cambio de comportamiento central, out of scope para este ítem (regla de
    planificar antes de cambios grandes). Documentado con un comentario largo en el archivo y
    registrado como [IDEAS.md #58](../../IDEAS.md) en vez de improvisar el cableado a mitad de O.3.
  - 8 tests nuevos ([skill-gates.test.ts](../../src/__tests__/skill-gates.test.ts)): `resolveGates()`
    contra las skills reales del repo (no mocks) — `qa-structured` siempre aplica en `review`,
    `security-review` requiere match de trigger, guión bajo↔espacio, ninguna gate fuera de fase
    `review`, skills sin `activation.mode: automatic` nunca son candidatas — y `runQA()` con
    provider mock que captura el `system` prompt real para confirmar la inyección (y la exclusión
    de `qa-structured`).
  - 1093 tests · 0 fail · `tsc --noEmit` limpio · gate de drift verde (7 fuentes, 0 deriva).
- [x] **O.4 — 🔍 (2026-08-05) CERRADO.** Gate con **casos reales**, no tests unitarios
  ([[feedback-verificar-gates-en-vivo]]): crear una pantalla → sugiere `frontend-design`; endpoint
  con input de usuario → activa `security-review`; feature nueva → sugiere/activa `tdd-enforcer`;
  bug sin tests → sugiere `test-writer`; tarea con criterios de aceptación → ejecuta
  `qa-structured`; tarea documental simple → **no carga ninguna skill de código**. Además: una skill
  irrelevante no aparece en el prompt; una obligatoria no desaparece en silencio; una sugerencia
  ambigua muestra opciones; el usuario puede rechazar una sugerencia; un gate de seguridad no se
  ignora sin evidencia explícita. **Criterio de éxito del bloque** (decisión Carlos): no es
  *"OrchestOS tiene muchas skills instaladas"* sino *"un usuario describe su objetivo normalmente y
  OrchestOS identifica, carga, aplica y verifica las skills pertinentes sin exigir que conozca sus
  nombres"*. Verificar en **un proyecto distinto de este repo** — es la prueba real de O.1.

  **Método**: proyecto scratch nuevo fuera de este repo (sin `skills/` ni `docs/roadmaps/`
  propios — package.json + `tasks.yaml`, git inicializado), `cd` real a ese directorio y llamadas
  reales (nada mockeado): `listAllSkillCandidates()`/`resolveGates()` con `cwd` = scratch,
  `buildNaturalDraft()` (LLM haiku real, el mismo clasificador que usa D.7) para los 6 escenarios
  del checklist, y **dos corridas end-to-end reales** vía `orchestos task run` contra ese
  proyecto (executor `gpt-4o-mini`, costo real ~$0.001 c/u).

  **Resultado — 6 escenarios, cero bugs encontrados:**
  | Escenario | Gates (`resolveGates`, determinista) | `skillOptions` del LLM | `pickAutoSkill()` |
  |---|---|---|---|
  | Crear pantalla nueva | `qa-structured` | ux-guidelines, design-brief-inference, **frontend-design**, design-tokens | **frontend-design** ✅ |
  | Endpoint con user input | `qa-structured`, **security-review** ✅ | pre-task-alignment, api-contract, **security-review** | **security-review** ✅ |
  | Feature nueva (TDD) | `qa-structured` | pre-task-alignment, test-writer, tdd-enforcer | *(sin asignar — 3 candidatas empatadas, ninguna automática/frontend-design)* |
  | Bug sin tests | `qa-structured` | diagnose, **test-writer**, tdd-enforcer, bug-hypothesis | *(sin asignar — mismo empate)* |
  | Con criterios de aceptación | `qa-structured` | qa-structured, ux-guidelines, tdd-enforcer | **qa-structured** ✅ |
  | Doc simple (README) | `qa-structured` | **doc-gen** | **doc-gen** ✅ (no es una skill de código) |

  El "sin asignar" de feature-nueva/bug-sin-tests **no es un bug** — es el desempate documentado en
  O.2 (`activation.mode: automatic` → `frontend-design` → candidata única → sin asignar) operando
  como se diseñó: la skill SÍ aparece en `skillOptions` ("sugiere" del checklist), y para el camino
  manual del composer (`renderSkillSuggestion()`, `screens-core.js`) 2+ candidatos muestran un
  `<select>` con "Ninguna" preseleccionada — el usuario elige o rechaza, nunca se resuelve el
  empate a ciegas ([[feedback-skill-autoselect-tiebreak]]). Cubre "sugerencia ambigua muestra
  opciones" y "usuario puede rechazar" sin tocar código, ya estaba correcto desde el Bloque D
  (Mes 18).

  **Prueba capstone — E2E real con vulnerabilidad de verdad, no simulada**: tarea
  `login-endpoint` ("SQL concatenada, credenciales hardcodeadas, sin input sanitizado") corrida de
  punta a punta. El executor escribió el código pedido (vulnerable, tal como se le pidió); el
  gate resolvió `security-review` aplicada (`trigger match: user_input`) y `qa-structured` siempre
  aplicada; el juez de QA **falló la tarea citando explícitamente OWASP**: *"Code contains multiple
  critical OWASP vulnerabilities: hardcoded credentials, SQL injection risk (concatenation pattern
  established), and lack of cryptographic protections for authentication"* — el checklist inyectado
  por O.3 llegó al juez real y las políticas se hicieron cumplir contra código real. `runs.
  skill_gates_json` quedó `[{"id":"security-review","applied":true,"reason":"trigger match:
  user_input"},{"id":"qa-structured","applied":true,...}]`, confirmando el registro end-to-end.
  **Control negativo**: tarea `docs-update` (README, sin triggers) corrida contra el mismo
  proyecto — `security-review` quedó `applied:false` con el motivo explícito, QA pasó limpio, sin
  ningún checklist de seguridad inyectado. Confirma "skill irrelevante no aparece en el prompt" y
  "obligatoria no desaparece en silencio" simultáneamente (`qa-structured` siempre presente en el
  log de ambas corridas).

  **Limpieza**: los 2 runs reales (`login-endpoint`, `docs-update`) borrados de
  `~/.orchestos/db.sqlite` tras verificar — no quedan filas fantasma en el dashboard real
  ([[feedback-verificar-progreso-delegado]] / precedente IDEAS.md #20). Proyecto scratch borrado.
  Cero código nuevo en este ítem — es puramente el gate de verificación de O.1–O.3, y no encontró
  nada que corregir.

  **Bloque O cierra completo (O.0–O.4).**

### Bloque P — 🧠 Vigilancia de deriva de fuentes externas (`sources-drift`)

**Origen — pregunta de Carlos (2026-08-02), tras el hallazgo real de N.5.1:** *"todas las repos
siempre se actualizan... mi idea es tener una función o agente que observe las repos y si tiene
algo interesante que mejoró justo en la pieza que ocupamos de ese repo, deberíamos aplicar esa
mejora — podría estar anotado en un update.md."* Verificado: **no existe nada así hoy.** Dreaming
(`DREAMING.md`) analiza telemetría propia (`runs-summary.json`), no repos externos — es un
mecanismo hermano, no el mismo.

**Las piezas, deliberadamente separadas** (tratarlas como una sola es lo que hace parecer esto un
proyecto grande):

1. **Qué se vigila no es "un repo completo"** — es un registro explícito de
   `fuente + path exacto + artefacto local que nació de ahí + último commit sincronizado`. Vigilar
   el repo entero genera ruido (un repo cambia por cosas que no importan); acotar por path es lo
   que hace esto barato y preciso.
2. **Detección es mecánica, sin LLM** — `gh api repos/{repo}/commits?path={path}` da el último SHA
   que tocó ese path exacto. Comparar contra el registrado es determinista.
3. **Relevancia SÍ requiere criterio** — que la fuente cambió no dice si el cambio importa. Mismo
   contrato que Dreaming: **propone, nunca aplica.** La primera versión del checker deja la lectura
   del diff a quien revisa `SOURCES_DRIFT.md` (Carlos o Claude en la siguiente sesión) — un paso
   de resumen automático vía LLM queda anotado como mejora futura, no bloqueante para la primera
   corrida real.
4. **Salida separada de `DREAMING.md`** — nombre propio (`SOURCES_DRIFT.md`) para no mezclar
   "cómo se comporta OrchestOS" (Dreaming, hacia adentro) con "cómo cambiaron las fuentes de las
   que robamos" (esto, hacia afuera).
5. **Cadencia baja** — semanal/mensual alcanza (fuentes de inspiración curada, no dependencias que
   rompen builds), muy distinto de los 2am nocturnos de Dreaming. Sin cron nuevo en este ítem —
   correr a mano o vía el mismo mecanismo externo que ya dispara Dreaming (fuera del repo, en la
   máquina de Carlos).

- [x] **P.1 — 🧠** (2026-08-02) Registro [docs/sources-registry.yaml](../../docs/sources-registry.yaml):
  `id`, `repo`, `path`, `license`, `local_artifact`, `last_synced_sha`, `last_synced_date`, `note`.
  Semilla con las 5 fuentes ya verificadas hoy: `obra/superpowers`
  (`test-driven-development` → `tdd-enforcer`, `verification-before-completion` → relación con
  `qa-structured`, sin ser traducción 1:1), `pbakaus/impeccable`
  (`scripts/detector/rules/checks.mjs` → `frontend-design`), `stablyai/orca`
  (`src/shared/agent-kind.ts` y `src/shared/tui-agent-config.ts` → IDEAS #39/Bloque O). Los
  `last_synced_sha` se fijan al SHA verificado **hoy**, no a un origen histórico desconocido — el
  registro establece línea base limpia desde este punto en adelante.
- [x] **P.2 — 🧠** (2026-08-02) [scripts/check-sources-drift.ts](../../scripts/check-sources-drift.ts):
  función pura `computeDrift(registry, latestShas)` (testeada, sin I/O) + wrapper que llama
  `gh api` por cada entrada y escribe `SOURCES_DRIFT.md` con lo que cambió desde el último sync
  (repo, path, SHA viejo→nuevo, link de comparación en GitHub). Nunca modifica `local_artifact` ni
  el registro — eso es una decisión humana explícita, mismo gate que rige toda esta conversación
  ("no promover sin propuesta, diff y confirmación explícita").
  `bun run scripts/check-sources-drift.ts` (alias `sources:drift` en `package.json`).
- [x] **P.3 — 🔍** (2026-08-02) **Primera corrida real**, no simulada — pedida explícitamente por
  Carlos en el mismo turno que P.1/P.2. Resultado y hallazgos anotados en el commit y en
  `SOURCES_DRIFT.md`.
- [x] **P.4 — ⚡ (2026-08-06) CERRADO.** Mejora futura, no bloqueante: paso de resumen vía LLM (reusar
  el patrón de `classifyAgainstOptions` de `docs/semantic-skill-selection-design.md` si aplica) que
  lea el diff real entre `last_synced_sha` y el HEAD actual del path y redacte la propuesta en
  `SOURCES_DRIFT.md`, en vez de solo listar "cambió, revisar a mano".

  **Implementado en [scripts/check-sources-drift.ts](../../scripts/check-sources-drift.ts)**:
  `fetchDiffPatch()` trae el patch real del path vía `gh api compare` (no el repo entero);
  `buildSummaryPrompt()` (pura, testeada) arma el prompt con el artefacto local, la nota del
  registro y el diff literal; `summarizeDrift()` llama un modelo barato (`claude-haiku-4-5`) con
  `chatFn` inyectable para test sin red. **Opt-in a propósito** — mismo patrón que
  `orcheConfig.adversarialQA`: el camino mecánico de P.1-P.3 sigue siendo el default sin costo ni
  LLM; `--summarize` (`bun run sources:drift:summarize`) lo activa. Sigue sin tocar
  `local_artifact` ni el registro — el LLM solo redacta la propuesta que ya requería revisión
  humana, la promoción real sigue pasando por `/knowledge-promote`.

  **Verificado en vivo, no solo con tests**: `last_synced_sha` de `superpowers-systematic-debugging`
  bajado a mano a un commit 2 versiones atrás, corrido `--summarize` de verdad contra el registro
  real. Resultado real del LLM: identificó que el upstream agregó una referencia a
  `verification-before-completion` y **removió la sección "Real-World Impact"** que menciona el
  framing de `iron_law` — exactamente la tabla que la nota del registro marca como portada,
  detectado sin que el prompt se lo dijera explícitamente. Registro restaurado al SHA correcto
  después de verificar, `SOURCES_DRIFT.md` regenerado limpio (0 deriva).
  8 tests nuevos (`check-sources-drift.test.ts`) — `buildSummaryPrompt` puro, `summarizeDrift` con
  `chatFn` fake, `renderReport` con/sin `summaries[]`. `tsc --noEmit` limpio.

  **Bloque P cierra completo (P.1–P.4).**

---

