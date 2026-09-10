# Bloque S — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.8; PLAN.md conserva el índice.

<a id="bloque-s-s-1"></a>
### S.1 — ⚡ Renombrar la etiqueta histórica a "Sprint N" en documentación y en el contrato de plan-status.
  Los antiguos "Mes N" nunca fueron meses calendario, son bloques de trabajo (ver memoria
  `project-real-timeline`). Se renombran a "Sprint N" conservando EXACTAMENTE la numeración
  (Mes 22 = Sprint 22).
  **Alcance:** todos los `.md` versionados; `git mv` de los 29 archivos de `docs/done/` a
  `sprint-NN.md` y sus enlaces entrantes; el campo `month` → `sprint` en `scripts/plan-status.ts`,
  `scripts/generate-feature-status.ts`, `scripts/handoff.ts`, `scripts/agent-handoff.ts` y sus tests;
  regenerar `.orchestos/feature-status.json`; nota de equivalencia al inicio de DONE.md.
  **Fuera (decisión de Carlos, opción A):** las ~281 ocurrencias de procedencia histórica en `.ts/.js/.json/.yaml`
  referencian cierres ocurridos con el nombre anterior; tocarlas son 110
  archivos de código sin cambio funcional, ruido en `git blame` y riesgo sobre un CI recién estabilizado.
  **Gate:** `bunx tsc --noEmit`, `bun run test:coverage` (comando exacto de CI), `bun run lint`,
  `git diff --check`.
  **Evidencia 2026-09-09 (Codex `gpt-5.6-luna`, commit `63072ba`):** 450 sustituciones textuales,
  29 archivos renombrados, enlaces entrantes actualizados, `.orchestos/feature-status.json`
  regenerado; gates reportados: tsc=0, coverage=0, lint=0, diff-check=0.
  **Verificación independiente (Claude) — 4 defectos encontrados y corregidos aparte:** el `sed` del
  rename pasó sobre los textos que describían el propio rename y los dejó sin sentido.
  (1) La nota de equivalencia de DONE.md decía «los antiguos «Sprint N» se renombraron a «Sprint N»»
  y colgaba bajo `## Apéndice` en vez del inicio. (2) Este mismo ítem S.1 afirmaba «los "Sprint N"
  nunca fueron meses calendario». (3) El frontmatter `status: mes-30-abierto` de PLAN.md quedó sin
  renombrar. (4) «particionado por mes» en DONE.md.
  **Comprobado por separado:** 0 enlaces rotos a `docs/done/`; 0 residuos de `month` en `scripts/`
  y `src/`; 269 comentarios de procedencia en código intactos como se declaró. Los 12 cambios
  restantes en `evals/*.yaml` y `src/evals/schema.test.ts` eran punteros `origin:` a archivos
  renombrados que habrían quedado rotos — ampliación correcta del scope por parte de Codex.
  **Lección de proceso:** un rename global de una etiqueta corrompe en silencio los textos que
  hablan de esa etiqueta. Revisar siempre la documentación *del propio cambio* después de un `sed`
  masivo — el gate verde (tsc/coverage/lint) no ve nada de esto.


<a id="bloque-s-s-2"></a>
### S.2 — ⚡ Purgar de PLAN.md la evidencia de los ítems ya cerrados.
  Medido: de las líneas 14–3619 (bloques abiertos), **52 ítems ya están `[x]`** con toda su
  evidencia dentro — la sección R.6 sola ocupa 52 líneas. Mover esa evidencia a `docs/done/`
  dejando en PLAN.md una línea por ítem con enlace. Las líneas 3620+ ya son solo punteros y no se
  tocan. **Regla nueva a escribir en AGENTS.md:** la evidencia de un ítem va a DONE.md en el mismo
  turno en que se cierra, no al cerrar el bloque — es la causa mecánica del crecimiento.
  **Fuera:** IDEAS.md no se toca (es el backlog de lo que falta, su tamaño es legítimo).
  **Gate:** ningún ítem pierde su evidencia — diff verificado ítem por ítem antes del commit.
  **Cerrado 2026-09-09 (Codex `gpt-5.6-luna`, commit `e021269`).** PLAN.md 4026 → 1741 líneas.
  46 ítems movidos (DOC 1, R 12, H 23, I 4, Sprint 30 6) a `docs/done/bloque-{DOC,R,H,I}.md` y
  `docs/done/sprint-30.md` (2468 líneas; delta +183 por encabezados y anclas). Regla añadida a
  AGENTS.md:38.
  **Verificación independiente (Claude), sin defectos:** los 69 IDs y sus 69 estados son idénticos
  antes/después (`feature-status.json` de `4d6d102` vs actual: 0 faltantes, 0 nuevos, 0 estados
  cambiados). R.6 — el ítem más largo — mide 50 líneas en origen y 50 en destino, con su texto
  clave íntegro. **El md5 del conjunto de ítems abiertos no cambió** (`cd48e9e4…`): la purga no
  tocó una coma de trabajo pendiente. 0 enlaces rotos a `docs/done/` (`sprint-NN.md` es un
  placeholder textual de S.1, no un enlace). Las anclas son `<a id>` explícitas, no derivadas del
  encabezado, así que no se rompen si se edita un título.
  **Efecto medido:** el objetivo del bloque era el costo de contexto por tab. PLAN.md pasó de
  309 KB a ~140 KB con esta pasada sola; el resto lo elimina S.5, cuando dejar de leerlo sea lo normal.


<a id="bloque-s-s-3"></a>
### S.3 — 🧠 Esquema `plan_items` y migración desde el parser existente. (2026-09-09)
  Implementado por Codex (`codex exec`, spec `docs/specs/S3.md`, ya borrado) — commit `d866f92`.
  **Verificación independiente (Claude, no re-implementación):**
  - Migración v7 en `src/db/migrate.ts:232` con el `CHECK (status='open' OR commit_sha IS NOT NULL)`
    tal cual el spec; se aplica de verdad porque `runMigrations()` termina en `applyMigrationSteps()`
    con `FUTURE_MIGRATIONS` por defecto (`src/db/migrate.ts:584`). `PRAGMA foreign_keys = ON` ya
    estaba en `src/db/sqlite.ts:19`, así que el `ON DELETE RESTRICT` de `plan_item_deps` no es adorno.
  - Fidelidad, corrida por mí en `ORCHESTOS_HOME` temporal (no la DB real): import → 69 ítems
    (44 `done` / 25 `open`); contra `.orchestos/feature-status.json` (69 ítems):
    `{missing:[], extra:[], diff:[]}` — cero diferencias de ID y de status.
  - Ningún ítem `done` quedó con `body` vacío ni `commit_sha` NULL (query directa: `[]`).
  - El `CHECK` bloquea de verdad: `INSERT` de un `done` sin `commit_sha` →
    `CHECK constraint failed: status = 'open' OR commit_sha IS NOT NULL`.
  - `plan_item_deps` queda vacía a propósito (el spec lo exige): las dependencias las carga Carlos
    en el board de S.6, no se infieren de frases como "Orden de ataque propuesto".
  - Gates: `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1362 pass / 0 fail) ·
    `git diff --check` ✅ · `bun run lint` ✅ **exit 0**.
  **Falso rojo que reportó Codex:** dio `lint` por fallado leyendo "Found 879 warnings" como error.
  Comprobado con `git stash -u`: master sin estos cambios da los **mismos** 879 warnings y **exit 0**;
  los archivos de S.3 no agregan ninguno. Biome sale 0 con warnings — el criterio es el exit code,
  no el conteo. Por eso el ítem estuvo implementado pero sin commitear hasta esta verificación.
  PLAN.md sigue siendo la fuente hasta que S.4 esté verde: esto **añade** la tabla, no la entroniza.
  **Dos bugs del test que Codex escribió, encontrados al pushear (commits `8fd2e3f`, `5c45ed0`):**
  (1) `plan-import.test.ts` importaba el **PLAN.md vivo** y asserteaba contra su texto literal, así
  que se rompió con el propio commit que cerró S.3 — ahora corre contra un repo-fixture en tmpdir.
  (2) Ese fixture hacía `git commit` sin identidad: verde en el Mac, rojo en `ubuntu-latest` con
  `actions/checkout`, que no tiene `user.email` — resuelto con `GIT_AUTHOR_*`/`GIT_COMMITTER_*` y
  `-c commit.gpgsign=false -c core.hooksPath=/dev/null` en el spawn, sin tocar `git config`.
  Verificado simulando CI: `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null` → 1 pass.
  Misma familia que `reference-ci-host-environment-drift`: un test que asserta sobre el estado
  del host o sobre un archivo vivo del repo no prueba el código, prueba la máquina.
  Tabla en la SQLite que ya existe (`src/db/migrate.ts`):
  `id · sprint · title · delegation · status · depends_on[] · scope[] · commit_sha · closed_at`.
  Se siembra una sola vez con `scripts/plan-status.ts`, que ya sabe parsear PLAN.md.
  Lo que hoy no existe en ninguna parte es `depends_on`: "Orden de ataque propuesto: R.1 → R.2 → …"
  (PLAN.md § Bloque R) es texto que nadie hace cumplir — el mismo patrón del botón que no hace nada.
  **Constraint que da la garantía:** `status='done'` exige `commit_sha NOT NULL`. Un LLM no puede
  cerrar un ítem escribiendo prosa; tiene que existir el commit. Es `ledger:gate` aplicado al plan.

> **S.4 se partió en dos el 2026-09-09** (mismo movimiento que H.5 → H.5.1/2/3), por un hallazgo
> del cerebro al preparar su spec: **el índice está incompleto y S.4 tal como estaba escrito lo
> habría certificado así.** `plan-status.ts:37` captura el ID con
> `([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)`, que **no admite `-` ni `'`**, así que 7 ítems cerrados son
> invisibles para el parser: `R.2-bis`, `R.2-ter`, `R.3-bis`, `R.4-bis`, `R.5-bis`, `R.5-ter` y
> `H.8.3'`. Consecuencias medidas: `plan_items` tiene 69 filas donde PLAN.md tiene 76 ítems;
> `.orchestos/feature-status.json` arrastra el mismo hueco y alimenta el handoff y el hook de
> `SessionStart`, así que el arranque de sesión viene mostrando un plan incompleto.
>
> **Ningún dato se perdió** — verificado, no supuesto: los 7 conservan su evidencia íntegra y con
> ancla en `docs/done/bloque-R.md` (614 líneas) y `docs/done/bloque-H.md` (1204), enlazada desde
> PLAN.md y versionada en git. Falta índice, no historia. Pero si `plan:render` generase PLAN.md
> desde una DB a la que le faltan esos 7, **los borraría del plan y el gate declararía sincronizado
> el resultado mutilado**: el gate certificaría la pérdida.
>
> **Por qué la verificación de S.3 no lo vio:** comparó `plan_items` contra
> `feature-status.json` y dio `{missing:[], extra:[], diff:[]}`. Ambos derivan **del mismo parser
> roto**, así que coincidían perfectamente. Misma familia que
> `reference-ci-host-environment-drift`: contrastar contra algo que hereda tu propio defecto no
> prueba nada. Regla que queda: una verificación de fidelidad debe contrastar contra la **fuente**
> (PLAN.md), nunca contra otro derivado.


<a id="bloque-s-s-4a"></a>
### S.4a — ⚡ Recuperar al índice los 7 ítems invisibles y dar vía de reconciliación. (cerrado 2026-09-09)
  Prerequisito duro de S.4b: sin esto, renderizar desde la DB borra historia.
  Ejecutado por: gpt-5.6-luna · Spec: docs/specs/S4a.md
  **Commit de implementación:** `219ea8a`. Primer ítem del roster nuevo: el cerebro (Opus 5) pensó,
  escribió el spec y verificó; no tecleó código.
  **Verificación independiente del cerebro — invariantes de datos, no el reporte del ejecutor:**
  - `PLAN.md` 77 ítems · `plan_items` 77 filas · `feature-status.json` 77 ítems.
  - Conjunto de ids **idéntico en ambas direcciones** (`en DB no en MD: ninguno`,
    `en MD no en DB: ninguno`) y **0 status divergentes**. Contrastado contra la **fuente**
    (`PLAN.md`), no contra otro derivado — que es exactamente el error que dejó pasar esto en S.3.
  - Los 7 recuperados tienen cuerpo real extraído por su ancla de `docs/done/`, no un stub:
    `R.2-bis` 5833B · `R.2-ter` 1653B · `R.3-bis` 1417B · `R.4-bis` 3351B · `R.5-bis` 2743B ·
    `R.5-ter` 3948B · `H.8.3'` 5603B. Siete `commit_sha` **distintos**, y los muestreados
    (`e90b83c`, `6d5653a`, `ec668c2`) tocan `PLAN.md` en su `--stat`.
  - **0 ítems `done` con el sha de HEAD** y 0 sin sha: nadie cayó al fallback de `commitShaFor()`.
  - `S.3` → `done`, `4d019b68edd25c8c…`.
  - `plan_item_deps` sigue en **0 filas**: la reconciliación no la tocó.
  - Guard one-shot intacto: `bun run plan:import` sin flag sigue abortando con
    `plan_items is already seeded; plan import runs once`.
  - `bunx tsc --noEmit` exit 0 (corrido por el cerebro). Gates del ejecutor:
    `bun run test:coverage` exit 0 con 1363 tests / 0 fallos · `bun run lint` exit 0 ·
    `git diff --check` limpio · pre-commit completo en verde.
  **Tres defectos encontrados en esta pasada, y de quién eran:**
  1. El spec decía `76`; el número real era **77** (`ccf3a79` partió `S.4` en dos). **Error del
     cerebro.** Luna detectó la contradicción, **paró sin decidir** y dejó los cambios sin
     commitear para no ocultarla — el comportamiento que el spec pedía. Se corrigió el spec.
  2. El spec fijaba `d866f92` como sha de `S.3`; el correcto es **`4d019b6`**, el commit que marcó
     `[x]`, no el que trajo el código. **Error del cerebro**; `commitShaFor()` ya hacía lo bueno.
  3. `--reconcile` hacía upsert pero **no borraba**: `plan_items` quedó con 78 filas para 77 ítems,
     sobrando la fila `S.4` cuyo ítem ya no existe. **Defecto del código**, encontrado por la
     verificación del cerebro y no por la suite del ejecutor, porque ningún test lo miraba. Sin
     esto, `plan:render` (S.4b) habría resucitado un `S.4` fantasma y el gate lo habría declarado
     sincronizado. Corregido: el borrado va en la **misma transacción** y aborta si una FK de
     `plan_item_deps` lo impide, en vez de cascadear. Salida real: `1 orphan plan items deleted: S.4`.
  **Lección transversal (extiende `reference-ci-host-environment-drift`):** los tres defectos son
  la misma familia — un índice derivado validado contra sí mismo o contra otro derivado. La regla
  que queda: **una verificación de fidelidad se contrasta siempre contra la fuente**, y un `upsert`
  no es una reconciliación mientras no borre lo que la fuente ya no tiene.
  **Alcance (tres cambios, ninguno de diseño):**
  1. `scripts/plan-status.ts:37` — el grupo del ID admite `-` y `'` además de `.`. `H.8.3'` lleva
     el apóstrofe al final, así que no basta tratarlos como separadores internos. El resto del
     regex **no se toca**: el discriminador de "esto es un ítem" sigue siendo el emoji de
     delegación tras el guión largo, que es lo que excluye solas las líneas de cierre de sprint.
  2. `scripts/plan-import.ts:49-50` — hoy aborta con `plan_items is already seeded; plan import
     runs once`, así que no existe vía de resincronización. Añadir un modo de reconciliación que
     haga `upsertPlanItem` de todos los ítems sin ese guard. **No tocar `plan_item_deps`**: está
     vacía a propósito (S.3) y las dependencias las carga Carlos en S.6.
  3. Regenerar `.orchestos/feature-status.json` y reconciliar `plan_items`.
  **Fuera de alcance:** `plan:render`, el gate de pre-commit, `plan_item_deps`, y cualquier otro
  ítem del Bloque S. No editar la evidencia de `docs/done/`.
  **Gate — números exactos, no "pasa":**
  - Test de regresión **contra un fixture en tmpdir, nunca contra el PLAN.md vivo** (lección de
    S.3, commit `8fd2e3f`): un PLAN.md sintético con `R.2-bis`, `H.8.3'` y un ID normal parsea 3
    ítems. Hoy parsea 1 — el test debe **fallar** contra el código actual antes del fix.
  - `plan_items` = 76 filas · `feature-status.json` = 76 ítems · los 7 recuperados presentes.
  - `S.3` queda `status='done'` con su `commit_sha` real (`d866f92`), no el de fallback.
  - **`commitShaFor()` cae a `git rev-parse HEAD` cuando su `git log -S` no encuentra nada
    (`plan-import.ts:33-42`).** Ningún ítem `done` puede quedar con el sha de HEAD: para cada uno,
    `git show --stat <sha>` debe mencionar `PLAN.md`. Si alguno cae al fallback, se **reporta y se
    para** — un sha inventado hace que el índice mienta con el `CHECK` satisfecho, que es peor que
    la fila ausente.
  - `bunx tsc --noEmit` · `bun run test:coverage` (comando exacto de CI) · `bun run lint` (juzgar
    por **exit code**, no por el conteo de warnings heredados —
    `reference-biome-warnings-no-son-rojo`) · `git diff --check`.


<a id="bloque-s-s-4b"></a>
### S.4b — 🧠 `plan:render` híbrido + gate de desincronización y de procedencia en pre-commit.
  Ejecutado por: gpt-5.6-luna · Spec: docs/specs/S.4b.md
  Depende de S.4a (cerrado). El pre-commit compara `PLAN.md` contra `render(DB)` y **aborta el
  commit si difieren** — idéntico al self-check que se agregó cuando el hook estuvo 11 días
  desincronizado en silencio. Si un LLM edita el markdown a mano, no pasa. Sin este gate, S.3 es
  decoración.

  **Decisión de Carlos (2026-09-09): modelo híbrido, tras evaluar las tres opciones.**
  La DB es fuente de los campos **estructurados** (id, estado, orden, dependencias, delegación,
  `commit_sha`, título, `body` del ítem). El markdown se sigue leyendo y versionando igual que
  siempre. `plan:render` regenera **las líneas de ítem y la tabla de estado**; no reescribe la
  prosa. El gate valida **solo esos campos**.
  *Por qué no la opción "regenerar todo desde la DB":* verificado en `plan-status.ts` —
  `parsePlanItemSources` construye el `body` filtrando `/^\s+/`, o sea **solo las líneas indentadas
  bajo un ítem**. Los párrafos de bloque (preámbulos, notas de auditoría, las citas `>` con
  decisiones de Carlos) hoy no están en `plan_items`: un render total los borraría. Es el fantasma
  de S.4a a mayor escala.
  *Por qué no la opción "solo validar":* no escala. Cuando N proyectos crezcan, saber qué se está
  haciendo no puede depender de releer prosa.

  **Requisito explícito de Carlos: el markdown debe ser reconstruible al 100% desde la DB**
  ("si quiero después puedo borrar los `.md` sabiendo que todo quedó guardado"). Eso obliga a
  persistir también la **narrativa de bloque**, que hoy no vive en ninguna tabla. Sin esa pieza el
  híbrido no cumple lo prometido y borrar un `.md` perdería los preámbulos.

  **Alcance:**
  1. Persistir la prosa de bloque (encabezado de sprint/bloque + párrafos no indentados + citas,
     con su posición) de modo que `render(DB)` reproduzca `PLAN.md` **byte a byte**.
  2. `bun run plan:render` — imprime el markdown desde la DB; con `--check`, sale ≠0 si difiere.
  3. Gate en `scripts/pre-commit.sh`: aborta si `PLAN.md` staged ≠ `render(DB)`.
  4. **Gate de procedencia** (aprobado por Carlos): en el commit que marca `[x]` un ítem, exigir
     (a) que ese commit **borre** `docs/specs/<ID>.md` — ciclo de vida ya definido en
     `AGENTS.md:74-76`, sin spec borrado no hubo delegación; y (b) la línea
     `Ejecutado por: <modelo> · Spec: docs/specs/<ID>.md` en la evidencia. Es el diente mecánico
     del roster de modelos, que hoy es narrativo: la Regla Cero de `CLAUDE.md` dice que una regla
     que nadie hace cumplir deja de existir, y el hook desincronizado 11 días es el precedente.
     Límite aceptado: el hook comprueba **presencia**, no veracidad, igual que el gate en vivo.
  **Fuera:** `plan_item_deps` (S.6), el board (S.6), `DONE.md` y `docs/done/` (esta pasada no los
  regenera; su render se decide después de que el de `PLAN.md` sea byte-exacto).
  **Gate:** ida y vuelta byte a byte sobre el `PLAN.md` real (77 ítems, todos los bloques, las
  citas `>` y el frontmatter); un ítem editado a mano en el markdown hace fallar el pre-commit;
  un commit que cierra un ítem sin borrar su spec falla; `bunx tsc --noEmit`, `bun run
  test:coverage`, `bun run lint` por exit code, `git diff --check`.
  **Ampliación aprobada por Carlos (2026-09-09) — gate de procedencia.** El mismo hook exige, en el
  commit que marca `[x]` un ítem: (a) que ese commit **borre** `docs/specs/<ID>.md`, cuyo ciclo de
  vida ya está definido en `AGENTS.md:74-76` — sin spec borrado no hubo delegación; y (b) una línea
  `Ejecutado por: <modelo> · Spec: docs/specs/<ID>.md` en la evidencia. Motivo: el roster de modelos
  (`AGENTS.md` § Protocolo de delegación permanente) es hoy una regla narrativa, y la Regla Cero de
  `CLAUDE.md` dice que una regla que nadie hace cumplir deja de existir — el hook desincronizado 11
  días es el precedente. Se acepta el límite conocido: el hook comprueba **presencia**, no
  veracidad, igual que el gate en vivo.

  **Commit de implementación:** `5e20e0e` (migración v8 `plan_doc_segments`, `plan:render`,
  `scripts/plan-gate.ts`, gates en `pre-commit.sh`).
  **Verificación independiente del cerebro — los gates se probaron mordiendo, no en verde:**
  - **Round-trip byte a byte sobre el `PLAN.md` real:** `diff <(bun run plan:render) PLAN.md` sin
    salida, 148 580 bytes idénticos; `plan:render --check` exit 0. Segmentos: **155 filas =
    77 `item` + 78 `prose`**, con los 77 `item_id` coincidiendo con `plan_items` en ambas
    direcciones (0 huérfanos, 0 faltantes).
  - **Prueba negativa 1 — desincronización:** edité `# OrchestOS — Plan activo` a mano, stageé sin
    reconciliar e intenté commitear. El hook **abortó** e imprimió el primer punto de divergencia
    (`render(DB)` vs `disk`) y el remedio exacto. `HEAD` no se movió.
  - **Prueba negativa 2 — procedencia:** marqué `[x]` un ítem sin borrar su spec.
    El hook **abortó**: `✗ plan gate: Procedencia S.5: commit must delete docs/specs/S.5.md
    (or use Sin delegación: <motivo>)`. `HEAD` no se movió. La válvula de escape aparece en el
    propio mensaje, como excepción nombrada y no como opción cómoda.
  - Hook instalado **sincronizado** con `scripts/pre-commit.sh` (el self-check de la Regla cero).
  - `bunx tsc --noEmit` exit 0 · `bun run test:coverage` exit 0, **1365 pass / 0 fail**,
    functions 74.55 % (gate 69 %), lines 63.22 % (gate 57 %) · `bun run lint` **exit 0** ·
    `git diff --check` limpio.
  **Falso rojo del ejecutor, por segunda vez:** luna reportó que «`lint` y `test:coverage` siguen
  afectados por fallos heredados de infraestructura/sandbox». **Es falso**: ambos dan exit 0, y los
  879 warnings de Biome son los mismos que ya tiene master. Es el mismo error que cometió en S.3
  (`reference-biome-warnings-no-son-rojo`), esta vez **pese a que el spec decía explícitamente
  "juzga por el exit code, no por el conteo"**. Conclusión de proceso: escribirlo en el spec no
  basta; el veredicto de gates de un ejecutor se re-ejecuta siempre, porque el modo de fallo es
  recurrente y sesga hacia el falso negativo.
  **Defecto de convención encontrado al cerrar:** `scripts/plan-gate.ts:64` deriva la ruta del spec
  del ID (`docs/specs/${id}.md` → `docs/specs/S.4b.md`), pero el cerebro había nombrado los
  archivos `S4a.md`/`S4b.md`, sin el punto. El gate estaba bien y el nombre mal:
  `AGENTS.md:74` dice `docs/specs/<ID>.md` literal. Renombrado a `docs/specs/S.4b.md`; la
  convención queda fijada por el gate, que es lo que la vuelve real.
  **Este cierre es la primera prueba en producción del gate de procedencia:** el commit que marca
  este `[x]` es el que borra `docs/specs/S.4b.md`. Si el gate estuviera mal escrito, no dejaría
  cerrarse a sí mismo.


<a id="bloque-s-s-5"></a>
### S.5 — ⚡ `bun run next` y arranque de sesión barato.
  Sin delegación: Carlos autorizó ejecución directa con “go con S.5”; no existió spec entregado a
  otro ejecutor.
  Consulta: ítems `open` cuyas dependencias están todas `done`. Salida ~15 líneas.
  El hook `SessionStart` pasa a inyectar esto en vez de `.orchestos/handoff.md`. Es el ítem que
  elimina el "vamos al siguiente en PLAN.md" y el reparseo de 309 KB por tab.
  Implementado en `scripts/next.ts`: consulta `readyItems()` y muestra como máximo 12 ítems más
  el contador de restantes. `.claude/hooks/session-resume.js` ejecuta `bun run --silent next` y
  falla abierto si no obtiene contexto.
  Verificado: `bun test scripts/next.test.ts scripts/session-resume-hook.test.ts` (7 pass),
  `bun run next` contra la DB real (23 ítems, 14 líneas de salida) y `node
  .claude/hooks/session-resume.js` (JSON `SessionStart` con el mismo contexto); `bunx tsc
  --noEmit`, `bun run test:coverage` y `bun run lint` exit 0. Lint conserva los 879 warnings
  heredados, sin errores nuevos.


<a id="bloque-s-s-6"></a>
### S.6 — 🔍 Pantalla Sprint Board en el dashboard.
  Ejecutado por: gpt-5.6-terra · Spec: docs/specs/S.6.md
  Requisito de Carlos: poder *ver* el plan aunque viva en la DB. Board por sprint con el grafo de
  dependencias, sobre la misma tabla. Aplica `feedback-dashboard-no-solo-cli`: una feature que
  solo vive en el CLI no está hecha. **Gate 🔍: verificación en vivo contra el dashboard real
  corriendo, no mocks** — se abre el board, se cierra un ítem y se comprueba que `plan:render`
  produce el PLAN.md esperado.
  Pantalla `Plan` como isla React (`PlanBoardScreen.tsx`) sobre el shell vanilla; tres columnas por
  sprint (listos / bloqueados / cerrados) y las aristas como chips `DEP → ITEM`, ámbar si la
  dependencia sigue abierta. Sin canvas ni librería de grafos. Rutas nuevas en
  `src/dashboard/handlers/plan.ts`: `GET /api/plan`, `PUT /api/plan/items/:id/dependencies`,
  `POST /api/plan/items/:id/prepare-close`. Los tres responden 409 si el `PLAN.md` del proyecto no
  coincide byte a byte con `renderPlan(db)` — nunca se muta una DB que podría ser de otro checkout.
  `preparePlanItemClose()` es la transición recuperable: transacción + escritura por temporal y
  `rename`, y restauración del markdown original si la transacción falla. Usa `git rev-parse HEAD`
  solo como SHA provisional (el `CHECK` de SQLite exige uno y el commit de cierre todavía no
  existe); la UI dice “cierre preparado, falta el commit y `plan:reconcile`”, nunca “cerrado”.
  El endpoint no ejecuta `git add`, `commit`, hooks ni borra specs.
  Cambio en superficie compartida, no pedido por el spec pero necesario y revisado: `TASK_ID_RE`
  (`src/dashboard/http.ts`) pasó a aceptar `'` porque existe el ítem real `H.8.3'` en `plan_items`
  y sin eso el board no podía direccionarlo. El mismo validador lo usan `specs.ts` y `tasks.ts`;
  el `'` no habilita traversal (`/` sigue fuera del charset) y el único consumidor que llega a un
  proceso externo es `Bun.spawn` con argv en array, sin shell, con el id tras `--`.
  **Gate en vivo: verificado con Playwright** (Chromium real) — evidencia en `scripts/s6-live-evidence.json`, producida por `scripts/ui-gates/s6-sprint-board.mjs`.
  Comando: `bun run gate:evidence -- --label s.6 -- bun run scripts/ui-gates/s6-sprint-board.mjs`
  → `✓ S.6 sprint board gate passed`. Corre contra el dashboard real en un repo-fixture con
  `ORCHESTOS_HOME` aislado: se abre Plan desde el sidebar, se crea la arista `A → B`, se recarga y
  persiste desde SQLite, se prepara el cierre de A, B pasa a listo sin recarga, se crea el commit
  del fixture y `plan:reconcile` reemplaza el SHA provisional por el real. Blobs staged de la
  evidencia: `scripts/ui-gates/s6-sprint-board.mjs` = `1b8b3d5c5acc9e2c1083148685b03ce262a6c444`,
  `scripts/s6-live-evidence.json` = `5721738a216ed194d4676f5d42ff14ef5dc024ed` (`byteExact: true`,
  `consoleErrors: []`, negativos `cycle: 409` y `blockedClose: 409`),
  `scripts/s6-sprint-board.png` = `8e0dec0f0b5ef30622e3e6e4871246073a1d2798`.
  Remate del cerebro tras revisar el diff: faltaba cobertura de la capa API y `bunx biome check .`
  salía 1 por el formato del JSON de evidencia. Delegado a gpt-5.6-terra con addendum
  (`.orchestos/specs/S.6-remate.md`, borrado al cerrar): `src/dashboard/__tests__/plan-api.test.ts`
  ejercita `route()` en subproceso con `ORCHESTOS_HOME` temporal — el singleton `db` resuelve su
  ruta al importar el módulo, así que un test in-process escribiría en la DB real (mismo patrón que
  `chat-r5-reliability.test.ts`) — y cubre 400 de JSON/array/duplicados/id inválido, 404 de ítem y
  de dependencia, 409 de autorreferencia, ciclo transitivo, ítem `done`, cierre bloqueado y
  `PLAN.md` desincronizado, más la comprobación de que el cierre cambia exactamente una línea del
  markdown. El gate ahora formatea su propio JSON con Biome, así que es idempotente.
  **Fuera de scope declarado:** el scope-lock de S.6 se declaró antes de empezar y omitió `PLAN.md`
  y sus derivados (`.orchestos/feature-status.json`, `runs-summary.json`), que todo cierre toca por
  definición. No se pudo ampliar con `agent:preflight --scope` porque ese comando exige que el ítem
  siga abierto y el cierre ya está escrito. Ningún archivo de producto quedó fuera del scope.
  Verificado por el cerebro, no por el reporte del ejecutor: `bunx tsc --noEmit` exit 0;
  `bun run test:coverage` 1370 pass / 0 fail (functions 74.36% ≥ 69, lines 63.28% ≥ 57);
  `bunx biome check .` exit 0 con los 879 warnings heredados; `bun run build:ui` reproducible
  (mismo MD5 de `ui.js`/`ui.css` antes y después); `git diff --check` limpio; gate en vivo corrido
  dos veces seguidas sin ensuciar el formato. Prueba de mutación del test nuevo: neutralizar
  `wouldCreateDependencyCycle()` en el handler hace fallar la suite con `transitive cycle must be
  409` — el test muerde, no solo pasa.


<a id="bloque-s-s-6a"></a>
### S.6a — ⚡ Remate verificable del Bloque S antes de archivarlo.
  Ejecutado por: claude-sonnet-5 · Spec: docs/specs/S.6a.md
  Autorizado por Carlos: convertir la revisión de S.6 en un encargo delegable, sin implementar.
  Depende de S.6 (cerrado).
  **Alcance:** integridad entre campos de plan_items y segmentos; procedencia desde evidencia
  staged en docs/done/; cierre pendiente verificable tras recarga; validación del body HTTP.
  **Fuera:** inferir/cargar dependencias reales, ejecutar tareas desde el board, rediseñar UI,
  migraciones SQLite y archivar el bloque completo antes de la revisión independiente.
  Cierre inline (sin `evidenceHref`), igual que S.5/S.6: `docs/done/bloque-S.md` no existe
  todavía — el spec difiere el archivado completo de S.1–S.6 a una operación separada.
  **A — integridad DB/documento:** `validatePlanDocumentIntegrity()` (`src/db/plan-doc.ts`),
  llamada desde `renderPlan()`, compara el documento parseado contra `plan_items` (conjunto de
  IDs, duplicados, item_id vs texto del segmento, y status/title/delegation/sprint/block/position)
  y rechaza en vez de renderizar una sincronización falsa.
  **B — procedencia con evidencia archivada:** `checkProvenance()` (`scripts/plan-gate.ts`) ahora
  resuelve `→ [evidencia](docs/done/x.md#ancla)` desde el índice Git (nunca el disco), exige que
  `Ejecutado por: ... · Spec: docs/specs/<ID>.md` se AÑADA en ese commit (compara contra la
  sección en `HEAD`) y rechaza ruta fuera de `docs/done/`, ancla ausente/duplicada, blob no
  staged y symlinks. El camino inline histórico (sin `evidenceHref`) sigue intacto.
  `scripts/check-live-gate.ts` gana la misma resolución (`hasArchivedLiveGateEvidence`,
  reutilizando `closedPlanItemIds`/`evidenceSectionFromIndex` exportados de `plan-gate.ts`): un
  cierre que deja la evidencia en `docs/done/` con solo un enlace en PLAN.md ya no da falso
  negativo en el gate de dashboard/config.
  **C — cierre pendiente durable por Git:** `findPlanCloseCommit()`/`isConfirmedPlanCloseCommit()`
  (`src/db/plan-items.ts`) prueban que un SHA es ancestro de HEAD y que ESE commit (no uno
  posterior) flip'ea el ítem a `done` respecto de su padre. `commitShaFor()` (`plan-import.ts`)
  usa esto y ya no cae a `HEAD` en silencio: si no hay prueba, `importAll` aborta la transacción
  completa. `GET /api/plan` expone `commitPending` vía `listPlanItemsWithCommitStatus()`; la
  tarjeta `done` muestra el aviso de forma durable (server-derived, no memoria de
  `planMutation`) hasta que un commit real lo confirme.
  **D — contrato HTTP estricto:** `PUT .../dependencies` exige objeto no nulo, no array, con
  exactamente `dependsOn`; JSON malformado, `null`, array, primitivo o propiedad extra → 400 sin
  mutar. `itemIdFromPath()` atrapa `decodeURIComponent` inválido → 400 en vez de 500.
  Cambio de superficie compartida no pedido por el spec pero necesario (de S.6, revisado ahí):
  `TASK_ID_RE` acepta `'` por el ítem real `H.8.3'`.
  **Gate:** `bun run gate:evidence -- --label S.6a -- bun run scripts/ui-gates/s6a-sprint-board.mjs`
  → `✓ S.6a sprint board gate passed`, corrido dos veces seguidas sin ensuciar el formato del
  JSON. Extiende el fixture de S.6 (sin tocar su evidencia): prepara el cierre de A, recarga y
  confirma el aviso + `commitPending:true` por DOM y API, muta B (servidor real) y confirma que
  el aviso persiste, crea el commit real + `plan:reconcile`, recarga y confirma `false` y
  ausencia del aviso — más los negativos de ciclo/cierre bloqueado ya existentes.
  **Gate en vivo: verificado con Playwright** (Chromium real) — evidencia en
  `scripts/s6a-live-evidence.json`, producida por `scripts/ui-gates/s6a-sprint-board.mjs`, más
  `scripts/s6a-sprint-board.png`.
  Tests nuevos con fixtures Git reales (no mocks): `scripts/plan-gate.test.ts` (9 casos de la
  parte B), `scripts/check-live-gate.test.ts` (5 casos, inline + archivado), extensión de
  `src/dashboard/__tests__/plan-api.test.ts` (parte C/D: 6 negativos de body + percent-encoding
  inválido, persistencia de `commitPending` tras recarga/mutación ajena/commit real), y
  `scripts/plan-render.test.ts` (integridad A).
  Verificado por el cerebro: `bunx tsc --noEmit` exit 0; `bun run test:coverage` 1388 pass / 0
  fail (functions 74.39% ≥ 69, lines 63.22% ≥ 57); `bunx biome check .` exit 0 con los 879
  warnings heredados; `bun run build:ui` reproducible (mismo MD5 de `ui.js`/`ui.css` antes y
  después de rebuildear con el código nuevo); `git diff --check` limpio. Prueba de mutación:
  forzar `confirmed = true` en `listPlanItemsWithCommitStatus()` hace fallar el test de
  `plan-api.test.ts` que exige `commitPending` tras recarga; forzar `archived = false` en
  `check-live-gate.ts` hace fallar el test del camino archivado — ambos tests muerden, no solo
  pasan.
  **Dos hallazgos reales descubiertos AL VERIFICAR, no previstos por el spec ni por el ejecutor
  (Terra nunca llegó al gate en vivo real, solo a fixtures diminutos):**
  1. `findPlanCloseCommit()` original recorría el historial COMPLETO de `PLAN.md` (438 commits)
     por cada ítem `done` en cada reconcile — O(ítems × historial). Contra la DB real (77 ítems)
     colgó varios minutos y tuvo que matarse. Reemplazado por `findAllPlanCloseCommits()`
     (`src/db/plan-items.ts`): una sola pasada `--first-parent` sobre el historial, parseando el
     `PLAN.md` de cada commit UNA vez, resolviendo todos los IDs a la vez. `plan:reconcile` pasó
     de colgarse a ~8s reales.
  2. La regla "abortar si no hay prueba" del spec (parte C) es incompatible con el flujo real de
     cierre manual: el pre-commit hook exige `plan:render --check` contra `PLAN.md` STAGED, o sea
     `plan:reconcile` debe correr ANTES del commit de cierre — pero a esa altura el commit que
     probaría la transición todavía no existe. `commitShaFor()` ahora distingue: un ítem que
     recién pasa a `done` EN ESTA pasada de reconcile (y solo con `--reconcile`, nunca en el
     import inicial) recibe el mismo SHA provisional (`git rev-parse HEAD`) que ya usa
     `preparePlanItemClose()` para el board — corregido por el reconcile siguiente, ya con el
     commit real. Un ítem que YA estaba `done` en la DB sigue sin excepción: si no prueba su
     commit, todo el reconcile aborta. Ese es el filo real del fix — nunca inventar HEAD para un
     cierre histórico, sí tolerarlo como provisional para uno en curso. Regresión cubierta en
     `scripts/plan-import.test.ts` (SHA provisional aceptado; segundo reconcile sin commit real
     falla porque el ítem ya es `done`; commit real reemplaza el provisional).
  **Fuera de scope declarado:** el scope-lock de S.6a omitía `PLAN.md`/`.orchestos/feature-status.json`
  (mismo defecto de protocolo ya anotado al cerrar S.6: todo cierre los toca por definición) y
  `scripts/check-live-gate.test.ts` (el glob declarado cubre `scripts/check-live-gate.ts` pero no
  su test, un descuido puntual al declarar el scope). Ningún archivo de producto quedó fuera.
  Incidente durante la depuración del hallazgo 2: corrí `scripts/ui-gates/s6a-sprint-board.mjs`
  directo (sin `bun run gate:evidence --`) para diagnosticar un timeout, sin `ORCHESTOS_HOME`
  aislado — el fixture de 3 ítems se escribió sobre la DB real (`~/.orchestos`) porque
  `src/db/sqlite.ts` resuelve su home global al importar el módulo, no por argumento. Recuperado
  reconciliando contra el `PLAN.md` real (con el ítem S.6a temporalmente revertido a abierto vía
  `git stash` para no chocar con el hallazgo 2 mismo) y limpiando a mano las filas huérfanas de
  `plan_item_deps` que un `DELETE` con `FOREIGN KEY` bloqueaba. Cero pérdida: `PLAN.md` en disco
  nunca se tocó, solo la proyección derivada. Recordatorio para cualquier LLM: un gate UI nunca
  se corre suelto contra este repo — siempre `bun run gate:evidence -- --label <id> --`.

**Consecuencia de producto, no solo de repo:** hoy el plan y la ejecución son dos grafos que no se
hablan — un ítem de PLAN.md hay que traducirlo a mano a una tarea. Con `plan_items` en la misma DB
que `tasks.yaml`, un ítem ejecutable se convierte en run sin traducción, y el `commit_sha` que
cierra el ítem es el que produjo el run. El plan deja de ser documentación *sobre* el sistema y
pasa a ser entrada *del* sistema.

**S.7 — auditoría independiente del mecanismo de cierre (2026-09-10).** Carlos pidió una revisión
independiente del Bloque S ya cerrado (S.1–S.6a). El resultado, `bunx tsc --noEmit` y los tests
en verde no incluidos, encontró tres defectos reales de comportamiento en la lógica de
procedencia y estado de cierre — documentados en
`docs/audits/2026-09-10-block-s-review.md`. Ninguno tenía ítem abierto; se abren acá como S.7a–c,
cada uno con spec propio en `docs/specs/`, sin implementación todavía.


<a id="bloque-s-s-7a"></a>
### S.7a — ⚡ Escape de regex roto en el gate de procedencia de specs. (cerrado 2026-09-10)
  Ejecutado por: claude-opus-5 · Spec: docs/specs/S.7a.md
  Cierre inline (sin `evidenceHref`), igual que S.5/S.6/S.6a: `docs/done/bloque-S.md` sigue sin
  existir. Implementado en `bd7425a`; el cierre lo hace una verificación independiente distinta
  del ejecutor, como exige el spec §6-7 — el propio commit se negó a marcar `[x]`.
  **Defecto:** `scripts/plan-gate.ts:138` construía el `RegExp` de comparación interpolando el ID
  sin escapar sus metacaracteres — el patrón `/[.*+?^${}()|[\\]\\\\]/g` cerraba la clase de
  caracteres en `[\\]` y dejaba `\\\\]` como literales fuera de ella, por lo que nunca matcheaba
  nada y `id.replace()` era un no-op sobre IDs reales (`F.1`, `S.7a`...). El `.` del ID quedaba
  actuando como wildcard.
  **Corrección:** `id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` — clase de caracteres estándar y
  correcta. No se relajó la comprobación: sigue siendo match exacto de línea completa, y no se
  tocó `evidenceSectionFromIndex`, `sectionAtHead`, la ruta inline ni `Sin delegación:`.
  **Test de regresión:** `scripts/plan-gate.test.ts`, caso `rejects an evidence spec where a
  wildcard char stands in for the id's literal dot` — fixture git real con item `F.1`, evidencia
  declarando `docs/specs/Fx1.md` y `git rm --cached docs/specs/F.1.md`; espera el throw `must
  declare its executor and exact spec`. El test existente con `OTHER.md` (~línea 129) sigue ahí.
  **Verificación independiente (2026-09-10, sesión distinta a la del ejecutor):** el diferencial
  del patrón se reprodujo de forma aislada, sin confiar en el reporte del ejecutor — patrón viejo
  compila a `docs\/specs\/F.1\.md` (punto sin escapar) y acepta el exploit `Fx1.md` (`true`);
  patrón nuevo compila a `docs\/specs\/F\.1\.md`, rechaza `Fx1.md` (`false`) y sigue aceptando el
  legítimo `F.1.md` (`true`).
  **Gates:** `bunx tsc --noEmit` ✅ · `bun test ./scripts/plan-gate.test.ts` ✅ (10 pass / 0 fail) ·
  `bun run test:coverage` ✅ (1389 pass / 0 fail, 3484 expects, 150 archivos; funciones 74.39% ≥ 69%,
  líneas 63.22% ≥ 57%) · `bun run lint` exit 0 (warnings heredados, no errores) ·
  `git diff --check` limpio.


<a id="bloque-s-s-7b"></a>
### S.7b — ⚡ SHA de un cierre anterior aceptado tras reabrir un ítem. (cerrado 2026-09-10)
  Ejecutado por: gpt-5.6-terra · Spec: docs/specs/S.7b.md
  Cierre inline (sin `evidenceHref`), igual que S.5/S.6/S.6a/S.7a: `docs/done/bloque-S.md` sigue
  sin existir. Implementado en `766227b` por Codex-terra bajo spec; el cierre lo hace la
  verificación independiente, no el ejecutor.
  **Defecto:** `commitShaFor` (`scripts/plan-import.ts`) devolvía el SHA de `closeCommits` antes
  de considerar si hubo una reapertura posterior a ese cierre, así que un ítem
  `open → done (commit A) → open (commit B) → done (sin commit)` heredaba `A` y salía con
  `commitPending: false` sin prueba del cierre vigente.
  **Corrección:** `findAllPlanCloseCommits` se generalizó a `findAllPlanTransitionCommits`
  (`src/db/plan-items.ts`), que en la misma pasada `--first-parent` devuelve `closeCommits`,
  `reopenCommits` y el set `reopenedAfterLatestClose` (comparando la posición de ambos SHAs en el
  walk newest-first). `commitShaFor` ahora es `if (sha && !reopenedAfterLatestClose.has(id))
  return sha`: el SHA inválido se descarta y cae al camino que ya existía — `allowProvisional` →
  `gitHead()`, o el `throw`. No se agregó ninguna rama nueva ni se tocó la semántica de
  `allowProvisional`. `findAllPlanCloseCommits` se conserva como wrapper para sus otros llamadores.
  No se tocó `listPlanItemsWithCommitStatus` (es S.7c).
  **Test de regresión:** `scripts/plan-import.test.ts`, `reconcile keeps a reclosed item pending
  instead of reviving its pre-reopen close SHA` — fixture git real con `ORCHESTOS_HOME` temporal,
  recorre `open → close A → reopen → reclose sin commit` y además cubre el segundo requisito del
  spec: una reconciliación repetida falla con `Could not prove a closing commit SHA for F.1` y el
  `commitSha` resultante nunca vuelve a ser `A`.
  **Verificación independiente (2026-09-10, cerebro ≠ ejecutor):** no se confió en el reporte de
  Codex. Se revirtieron `src/db/plan-items.ts` y `scripts/plan-import.ts` a `1ac8494` dejando el
  test nuevo en su lugar, y el test **falla** contra el código pre-fix
  (`plan-import.test.ts:320`, el `commitPending: true` del recierre); restaurado el árbol, pasa.
  **Efecto en vivo sobre el repo real, no solo en fixture:** `findAllPlanTransitionCommits`
  detecta que **H.10.2** tiene una reapertura posterior a su último cierre en la historia real de
  este repo — hoy está `open`, así que no llega a `commitShaFor` y `bun run plan:reconcile` pasa
  limpio (81 ítems, 58 `done`, ninguno con `commitPending` espurio, S.7a conserva `f2c37c2`).
  Era el ítem que habría heredado un SHA falso al recerrarse: el defecto era real acá, no teórico.
  **Gates:** `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1390 pass / 0 fail, 3503 expects;
  funciones 74.34% ≥ 69%, líneas 63.18% ≥ 57%) · `bun run lint` exit 0 (warnings heredados) ·
  `git diff --check` limpio · `bun run plan:render -- --check` y `scripts/plan-gate.ts` verdes.


<a id="bloque-s-s-7c"></a>
### S.7c — ⚡ Historial shallow hace pasar un commit de prosa como commit de cierre. (cerrado 2026-09-10)
  Ejecutado por: sonnet · Spec: docs/specs/S.7c.md
  Cierre inline (sin `evidenceHref`), igual que S.5/S.6/S.6a/S.7a/S.7b. Implementado en `e6ac009`
  por el ejecutor bajo spec cerrado; el cierre lo hace la verificación independiente.
  **Defecto:** `listPlanItemsWithCommitStatus` (`src/db/plan-items.ts`) trataba el fallo de
  `git rev-parse --verify <sha>^` como `before = mapa vacío`, sin distinguir la raíz real de un
  historial completo (legítimo) de la raíz local de un clon `--depth=1` (el padre existe en el
  remoto, no localmente). Con `before` vacío, `state.before.get(id) !== 'done'` es siempre `true`,
  así que cualquier commit que ya trajera el ítem `done` — incluido uno de solo prosa — salía
  `commitPending: false`.
  **Corrección:** cuando el padre no resuelve se consulta `git rev-parse --is-shallow-repository`:
  `false` → raíz real, se conserva el comportamiento previo (`before` vacío, cierre confirmable);
  `true` o salida no parseable → `states.set(sha, null)`, con lo que `confirmed` es `false` y el
  ítem queda `commitPending: true`. No se introdujo ningún estado nuevo (decisión del spec §3): el
  booleano existente ya significa "no puedo probar el cierre vigente", y un tercer estado habría
  obligado a tocar tipos, UI y esquema. No se tocó `findAllPlanCloseCommits`,
  `findAllPlanTransitionCommits`, `scripts/plan-gate.ts` ni `scripts/plan-import.ts`.
  **Tests de regresión** (`src/db/plan-items.test.ts`, describe `— shallow history (S.7c)`):
  (1) clon shallow **real** — `git clone --depth=1 file://<origin>`, con aserción previa de que
  `is-shallow-repository` es `true` y de que HEAD es el commit de prosa — cuyo ítem registrado con
  ese SHA debe dar `commitPending: true`; (2) guardia del caso legítimo: repo de historia completa
  con el ítem nacido ya cerrado en el commit raíz sigue dando `commitPending: false`.
  Nota del ejecutor que evitó un falso positivo: `git clone --depth=1` sobre una ruta local es
  ignorado en silencio ("--depth is ignored in local clones"); el fixture usa `file://` para que
  el clon sea shallow de verdad.
  **Verificación independiente (2026-09-10, cerebro ≠ ejecutor):** no se confió en el reporte. Se
  revirtió `src/db/plan-items.ts` a `HEAD~1` dejando los tests nuevos en su lugar: el test shallow
  **falla** (`plan-items.test.ts:254`, `Expected: true / Received: false`) y el de raíz legítima
  **pasa** — o sea, es guardia real de regresión, no un test que pase por construcción. Árbol
  restaurado con `git checkout HEAD --`, working tree limpio.
  **Gates (corridos por el verificador, no copiados del ejecutor):** `bunx tsc --noEmit` ✅ ·
  `bun run test:coverage` ✅ (1392 pass / 0 fail, 3519 expects, 150 archivos; funciones 74.48% ≥
  69%, líneas 63.35% ≥ 57%) · `bun run lint` exit 0 (warnings heredados) · `git diff --check`
  limpio.

