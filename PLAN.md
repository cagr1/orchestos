---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: sprint-30-abierto--fiabilidad-del-recorrido-y-shell-chat-workspace
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Bloque S — El plan deja de ser prosa: DB como fuente, markdown como vista (ABIERTO 2026-09-09, GO de Carlos)

**Problema medido, no estimado.** `PLAN.md` pesa 309 KB / 3854 líneas. Para que un agente
sepa "qué sigue" hoy hay que reparsear el archivo entero, porque la fuente de verdad es prosa.
`.orchestos/feature-status.json` existe pero es *derivado*: no evita leer la fuente, la refleja.
Consecuencia: cada tab nuevo paga ~309 KB de contexto para averiguar un dato de 15 líneas.

**El segundo problema es de confianza, no de tamaño.** Un `.md` acepta cualquier afirmación sin
validarla: el `- [x]` es la opinión de un LLM, no un hecho. Ya costó dos veces — el pre-commit
desincronizado 11 días en silencio (CLAUDE.md § Regla cero) y la afirmación falsa de "lint rojo"
escrita en la sección R.6 de este mismo archivo, corregida el 2026-09-09. Una tabla con
constraints y un FK a un commit sha no admite eso; un párrafo sí.

**Decisión (Carlos, 2026-09-09): invertir la dirección de derivación.** La DB pasa a ser fuente
y el markdown pasa a ser vista generada. Requisito explícito de Carlos: **seguir "viéndolo"** —
`PLAN.md` y `DONE.md` se siguen leyendo igual que siempre, versionados en git y con diff por
commit; lo que cambia es que se imprimen, no se escriben a mano. Es el contrato que ya rige
`runs-summary.json` y `.orchestos/feature-status.json`, aplicado al plan.

**Precedente de la industria consultado:** Beads (`bd`), tracker git-native de issues para agentes
— grafo de dependencias consultable en vez de plan en prosa, dependencias como ciudadanos de
primera clase, consulta dirigida en vez de cargar el plan entero. **Se roba el diseño, no el
software:** Beads es Go + Dolt, y OrchestOS *ya es* un orquestador con DAG (`tasks.yaml`,
graph-runner) — adoptar un tracker externo competiría con su propio motor. Mismo criterio que se
aplicó con OmniRoute. Descartado en la misma pasada: `microsoft/tgrep` (índice de trigramas,
hasta 52x sobre ripgrep) — resuelve latencia de regex en monorepos de 100k+ archivos; este repo
tiene 624 y el problema no es buscar texto, es consultar un grafo.

**Cierre del bloque:** abrir un tab nuevo y saber qué sigue cuesta ~1 KB en vez de 309 KB, y
ningún LLM puede cerrar un ítem sin que exista el commit que lo respalda.

- [x] **S.1 — ⚡ Renombrar la etiqueta histórica a "Sprint N" en documentación y en el contrato de plan-status.**
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

- [ ] **S.2 — ⚡ Purgar de PLAN.md la evidencia de los ítems ya cerrados.**
  Medido: de las líneas 14–3619 (bloques abiertos), **52 ítems ya están `[x]`** con toda su
  evidencia dentro — la sección R.6 sola ocupa 52 líneas. Mover esa evidencia a `docs/done/`
  dejando en PLAN.md una línea por ítem con enlace. Las líneas 3620+ ya son solo punteros y no se
  tocan. **Regla nueva a escribir en AGENTS.md:** la evidencia de un ítem va a DONE.md en el mismo
  turno en que se cierra, no al cerrar el bloque — es la causa mecánica del crecimiento.
  **Fuera:** IDEAS.md no se toca (es el backlog de lo que falta, su tamaño es legítimo).
  **Gate:** ningún ítem pierde su evidencia — diff verificado ítem por ítem antes del commit.

- [ ] **S.3 — 🧠 Esquema `plan_items` y migración desde el parser existente.**
  Tabla en la SQLite que ya existe (`src/db/migrate.ts`):
  `id · sprint · title · delegation · status · depends_on[] · scope[] · commit_sha · closed_at`.
  Se siembra una sola vez con `scripts/plan-status.ts`, que ya sabe parsear PLAN.md.
  Lo que hoy no existe en ninguna parte es `depends_on`: "Orden de ataque propuesto: R.1 → R.2 → …"
  (PLAN.md § Bloque R) es texto que nadie hace cumplir — el mismo patrón del botón que no hace nada.
  **Constraint que da la garantía:** `status='done'` exige `commit_sha NOT NULL`. Un LLM no puede
  cerrar un ítem escribiendo prosa; tiene que existir el commit. Es `ledger:gate` aplicado al plan.

- [ ] **S.4 — 🧠 `plan:render` + gate de desincronización en pre-commit.**
  `bun run plan:render` regenera `PLAN.md` y `DONE.md` desde la DB. El pre-commit compara
  `PLAN.md` contra `render(DB)` y **aborta el commit si difieren** — idéntico al self-check que se
  agregó cuando el hook estuvo 11 días desincronizado en silencio. Si un LLM edita el markdown a
  mano, no pasa. Sin este gate, S.3 es decoración.

- [ ] **S.5 — ⚡ `bun run next` y arranque de sesión barato.**
  Consulta: ítems `open` cuyas dependencias están todas `done`. Salida ~15 líneas.
  El hook `SessionStart` pasa a inyectar esto en vez de `.orchestos/handoff.md`. Es el ítem que
  elimina el "vamos al siguiente en PLAN.md" y el reparseo de 309 KB por tab.

- [ ] **S.6 — 🔍 Pantalla Sprint Board en el dashboard.**
  Requisito de Carlos: poder *ver* el plan aunque viva en la DB. Board por sprint con el grafo de
  dependencias, sobre la misma tabla. Aplica `feedback-dashboard-no-solo-cli`: una feature que
  solo vive en el CLI no está hecha. **Gate 🔍: verificación en vivo contra el dashboard real
  corriendo, no mocks** — se abre el board, se cierra un ítem y se comprueba que `plan:render`
  produce el PLAN.md esperado.

**Consecuencia de producto, no solo de repo:** hoy el plan y la ejecución son dos grafos que no se
hablan — un ítem de PLAN.md hay que traducirlo a mano a una tarea. Con `plan_items` en la misma DB
que `tasks.yaml`, un ítem ejecutable se convierte en run sin traducción, y el `commit_sha` que
cierra el ítem es el que produjo el run. El plan deja de ser documentación *sobre* el sistema y
pasa a ser entrada *del* sistema.

## Bloque DOC — Fuentes vivas sincronizadas (2026-09-08)

- [x] **DOC.1 — ⚡ Reconciliar documentación viva con el estado verificable del plan.** (cerrado 2026-09-08) → [evidencia](docs/done/bloque-DOC.md#bloque-doc-doc-1)

## Bloque R — Fiabilidad del recorrido completo (auditoría 2026-09-06)

Carlos autorizó registrar estos hallazgos para atacarlos. Procedencia: revisión del código en
`c5eefae`, typecheck limpio y sondas en memoria del parser QA, parser de lecturas y cálculo de
costo; no fue una auditoría exhaustiva ni una ejecución de la suite completa. No es una promoción
de insights del vault. Esta pasada es documental: no implementa las correcciones.

**Objetivo de producto:** una persona puede pedir trabajo en un proyecto, entender qué va a
ejecutarse, obtener un resultado verificado y recuperar después conversación y evidencia. La
valoración conversacional (6/10 producto, 7,5/10 base técnica) fue provisional, no un benchmark ni
un techo: se reevalúa con recorridos reales, fiabilidad repetida y utilidad observada por usuarios.
Los meses invertidos se preservan aprovechando los contratos, executors y checks existentes;
este bloque no autoriza una reescritura general.

**Orden de ataque propuesto:** R.1 → R.2 → R.3 → R.4 → R.5 → R.6 → R.7 → R.8.
R.2 y R.5 son prerrequisitos de evidencia para H.9.4; su cierre exige el gate H.9.4 existente,
no uno duplicado. R.4 debe coordinarse con I.5 si hay edición concurrente de la misma superficie.
R.8 es requisito antes de presentar el recorrido como fiable para usuarios externos. Este orden
organiza los hallazgos; no autoriza adelantar otros ítems ni sustituye los gates del protocolo.

- [x] **R.1 — ⚡ Recuperar creación de tareas desde sesiones de proyecto.** (cerrado 2026-09-07) → [evidencia](docs/done/bloque-R.md#bloque-r-r-1)

- [x] **R.2 — 🧠 Auditoría que distingue lectura solicitada, ejecutada, rechazada y desconocida.** (cerrado 2026-09-07) → [evidencia](docs/done/bloque-R.md#bloque-r-r-2)

- [x] **R.2-bis — 🔍 Hallazgo bloqueante de R.2: la frontera de lectura no existe (evidencia).** (cerrado 2026-09-06) → [evidencia](docs/done/bloque-R.md#bloque-r-r-2-bis)

- [x] **R.2-ter — 🧠 Unificar frontera de los lectores fijos OpenRouter.** (cerrado 2026-09-07) → [evidencia](docs/done/bloque-R.md#bloque-r-r-2-ter)

- [x] **R.3 — ⚡ QA exige correspondencia uno a uno con los criterios originales.** (cerrado 2026-09-07) → [evidencia](docs/done/bloque-R.md#bloque-r-r-3)

- [x] **R.3-bis — ⚡ Validar el envelope completo de QA adversarial/refutador.** (cerrado 2026-09-07) → [evidencia](docs/done/bloque-R.md#bloque-r-r-3-bis)

- [x] **R.4 — ⚡ Aislar respuestas y restauración por conversación.** (cerrado 2026-09-07) → [evidencia](docs/done/bloque-R.md#bloque-r-r-4)

- [x] **R.5-ter — 🧠 Corregir concurrencia, reserva previa y confirmaciones restauradas.** (cerrado 2026-09-08) → [evidencia](docs/done/bloque-R.md#bloque-r-r-5-ter)

- [x] **R.5 — 🧠 Persistencia coherente de turno, run y fallos de chat.** (cerrado 2026-09-08) → [evidencia](docs/done/bloque-R.md#bloque-r-r-5)

- [x] **R.5-bis — 🧠 R.5: política de DELETE y reserva de tareas (decisiones 8 y 10).** → [evidencia](docs/done/bloque-R.md#bloque-r-r-5-bis)

- [x] **R.4-bis — 🧠 Seguimiento de R.4: restore no invalida epoch en todos los casos.** → [evidencia](docs/done/bloque-R.md#bloque-r-r-4-bis)

- [x] **R.6 — ⚡ Costo del chat separado de la etiqueta visual del modelo.** (cerrado 2026-09-09) → [evidencia](docs/done/bloque-R.md#bloque-r-r-6)

- [ ] **R.7 — 🧠 Escritura atómica y coordinación entre procesos para tasks.yaml.** Prioridad alta.
  Riesgo identificado, pendiente de reproducir: `loader.ts:25` comprueba un hash opcional y luego
  sobrescribe el archivo directamente; `tasks.ts:260` guarda antes del lock Git. Dos procesos
  pueden perder actualizaciones y una interrupción puede dejar un YAML incompleto. Diseñar
  exclusión/read-modify-write y reemplazo atómico con recuperación, cubriendo todos los writers;
  mantener tasks.yaml como fuente de verdad. No migrar la cola a SQLite dentro de este ítem.
  **Gate:** dos procesos actualizan tareas distintas sin pérdida; conflicto sobre una misma tarea
  se resuelve o rechaza explícitamente; interrupción en escritura conserva un documento válido;
  recuperación de lock y compatibilidad portable verificadas. Tests con procesos reales aislados.

- [ ] **R.8 — 🔍 Validación independiente del recorrido útil y corrección de evidencia de cierre.**
  Depende de R.1–R.7 y H.9.4. Revisar el recorrido completo: proyecto conectado → conversación →
  tarea/confirmación → ejecución → checks/QA → resultado → recarga y evidencia recuperada;
  incluir continuidad del historial hacia CLI, no solo su presencia en la pantalla. Repetir sobre
  un proyecto externo de prueba, declarar transporte/configuración y registrar resultados por
  intento. La utilidad debe contrastarse además con una tarea real de Carlos: resultado utilizado,
  intervención necesaria y bloqueos, no solo número de tests.
  **Corrección documental necesaria:** I.4 conserva abajo su cierre histórico del 2026-09-05,
  pero su evidencia declara «sin navegador/browser interactivo». No acredita el gate visual
  exigido por el protocolo. Su aceptación integral queda pendiente de este bloque; el `[x]`
  histórico no desbloquea por sí solo H.9.4. Adjuntar aquí evidencia nueva sin borrar el historial.
  **Gate:** navegador real y backend/persistencia observados; suite exacta de CI verde; pruebas
  negativas de privacidad y QA; informe de límites restantes. Cuando use home temporal con runs
  reales, ejecutar el wrapper gate:evidence y verificar conservación de la evidencia pertinente.

**Mantenibilidad (observación transversal):** en la revisión, cli.ts tenía 2923 líneas,
harness.ts 1203 y chat.ts 1237. La concentración de responsabilidades merece atención, pero
el tamaño no demuestra un bug. Extraer únicamente responsabilidades necesarias para los ítems
anteriores, con pruebas de comportamiento; no abrir un refactor masivo por conteo de líneas.

## BLOQUE H — Huecos de harness (ABIERTO 2026-09-01, PRIORIDAD SOBRE SPRINT 30)

> **Decisión de Carlos (2026-09-01):** este bloque va **primero**. Los ítems `UI.4`–`UI.7`
> del Sprint 30 siguen abiertos pero quedan detrás de H — el objetivo es cerrar los huecos que
> impiden presentar el producto como ingeniería seria.

### De dónde sale este bloque

Auditoría del 2026-09-01 contra el marco de harness engineering (5 subsistemas:
instrucciones, estado, verificación, alcance, ciclo de sesión), con fuentes primarias de
Anthropic, OpenAI, Thoughtworks/Fowler y LangChain. Informe completo en el vault:
`outputs/2026-09-01-harness-engineering-a-fondo.md` (repo `memories-vault`, commit `465368f`).

**Verificado ejecutando, no leyendo** (2026-09-01):

```
bun test              → 1174 pass / 0 fail (120 archivos, 2852 expects, 29.2s)
bun run test:coverage → verde: functions 73.96% (gate 69%), lines 62.91% (gate 57%)
bun run typecheck     → exit 0
gh run list           → CI y Secret Check verdes en los últimos 8 pushes
```

**Conclusión de la auditoría:** el harness de OrchestOS es sólido — preflight mecanizado,
tres gates que impiden declarar "listo" sin evidencia (`check-live-gate`, `check-ledger-gate`,
`run-evidence-gate`), mutation testing en 4 shards, divulgación progresiva real (raíz corta →
25 docs), y cada regla con post-mortem fechada. **Los huecos no son de ingeniería: son de
presentación, de una capa barata que falta, y de no poder medir mejoras.**

> Nota sobre `audit-harness.sh` del curso walkinglabs: se corrió sobre este repo y da **9/70**.
> Ese score es engañoso — busca nombres exactos (`PROGRESS.md`, `feature_list.json`,
> `Makefile`) y no reconoce los equivalentes de este repo; marcó "falta lockfile" cuando
> `bun.lock` (72 KB) está trackeado, porque no conoce Bun. Usarlo como lista de ideas, nunca
> como calificación. No abrir ítems solo para subir ese número.

### H.1 — Presentación: lo que descalifica al repo en 30 segundos

- [x] **H.1.1 — ⚡ README miente sobre el estado del proyecto.** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-1-1)

- [x] **H.1.2 — ⚡ `CONSTITUTION.md` está vacío (0 bytes).** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-1-2)

- [x] **H.1.3 — ⚡ No hay script `test` en `package.json`.** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-1-3)

- [x] **H.1.4 — ⚡ Artefactos de ejecución trackeados en git.** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-1-4)

### H.2 — La capa barata que falta

- [x] **H.2.1 — 🧠 No hay linter ni formatter.** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-2-1)

### H.3 — Estado: legible por humanos, ilegible por máquinas

- [x] **H.3.1 — 🧠 El estado del producto no es machine-readable.** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-3-1)

- [x] **H.3.2 — ⚡ `DONE.md` pesa 540 KB / 5969 líneas.** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-3-2)

### H.4 — Alcance y cierre: lo narrativo que debería ser mecánico

- [x] **H.4.1 — 🧠 El scope-lock es narrativo, no mecánico.** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-4-1)

- [x] **H.4.2 — 🧠 Hay clock-in mecanizado pero no hay clock-out.** (cerrado 2026-09-01) → [evidencia](docs/done/bloque-H.md#bloque-h-h-4-2)

### H.5 — Lo estratégico: no se puede medir si el harness mejora

> **El ítem original de la auditoría (`H.5`) se partió en 3 el 2026-09-01** tras revisar la
> propuesta de arranque. Motivo y hueco encontrado, que ninguna de las 3 sub-partes puede
> perder de vista: **si el grader son los `checks` de la Task, el eval mide lo mismo que ya
> mide el harness en producción** — eso dice si los checks pasan, NO si el harness mejoró. El
> valor de un eval está en medir **variación entre configuraciones** (modelo A vs B,
> `single-shot` vs `agentic`, con skill vs sin skill) contra un **baseline registrado**. Un
> `pass^k` suelto, sin un "antes" comparable, es un número sin significado: LangChain solo
> pudo afirmar 52.8 → 66.5 porque tenía el antes. La configuración es el eje, no la task.
>
> Contexto de la auditoría que sigue vigente para las 3: métrica **`pass^k`, no `pass@k`**
> (con 75% por trial y k=3, `pass^k ≈ 42%` — esa es la cifra honesta para algo que va a manos
> de un cliente). Anti-patrones a evitar desde el diseño: verificar secuencias exactas de tool
> calls (los agentes encuentran caminos válidos no anticipados), specs ambiguas (0% de
> pass@100 casi siempre significa task rota, no agente incapaz), y estado compartido entre
> runs. Agudizante multi-modelo: **el harness no es portable entre modelos** (Opus 4.6 rindió
> 59.6% con un harness afinado para GPT-5.2-Codex) — sin evals no se puede saber qué
> configuración conviene a cada motor de la cascada local→CLI→API.

- [x] **H.5.1 — ⚡ Andamiaje de evals: schema + verificador de tasks (cero costo de LLM).** → [evidencia](docs/done/bloque-H.md#bloque-h-h-5-1)

- [x] **H.5.2 — ⚡ El runner de evals: la configuración como eje + baseline comparable.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-5-2)

- [ ] **H.5.3 — 🔍 Primera corrida medida real (GATED por Carlos).**
  Requiere que Carlos indique modelo y presupuesto; no se abre por iniciativa de ningún LLM.
  Cuesta dinero real: 3 tasks × k=3 = 9
  llamadas completas al modelo, y el modelo lo decide Carlos en el momento
  ([[feedback-modelo-decision-final-carlos]], NO NEGOCIABLE — el incidente de $5.00 quemados
  del 2026-07-13 salió exactamente de un LLM eligiendo modelo por su cuenta). Produce el
  **primer baseline** del proyecto: el "antes" contra el que se medirá cualquier cambio
  futuro de harness. Hasta que exista este número, no se puede afirmar que ninguna versión
  del orquestador es mejor que otra — que es, textual, el hueco que abrió H.5.

### H.7 — El contexto se llena en silencio y nadie avisa (ABIERTO 2026-09-02)

> **Origen: dogfooding real, sesión del 2026-09-02.** Carlos pasó de 9% a 25% de contexto
> cambiando de Sonnet a Opus, y de 25% a 50% en un chat "prácticamente nuevo". El sistema
> nunca avisó. El síntoma se atribuye normalmente a "el modelo es verboso"; la medición dice
> otra cosa (ver abajo). Es el mismo patrón de fondo que la Regla Cero de `CLAUDE.md`: una
> regla escrita ("cortar a sesión nueva al 70%", [[feedback-limite-contexto-70]]) que ningún
> mecanismo hace cumplir, deja de existir en la práctica.
>
> **Mediciones de esta sesión (evidencia, no estimación).** Del transcript real
> `~/.claude/projects/<slug>/<session-id>.jsonl`, último mensaje `assistant`:
>
> ```
> used = input_tokens(2) + cache_creation_input_tokens(1465) + cache_read_input_tokens(82893)
>      = 84,360 tokens        model = claude-opus-5 (viene en la propia línea del JSONL)
> ```
>
> **Los dos ejes que la UI no separa, y que este ítem sí debe separar:**
> 1. **Ventana de contexto** — se llena dentro del tab, se resetea al abrir uno nuevo.
> 2. **Cupo/costo facturado** — NO se resetea al abrir tab; el tab nuevo re-lee archivos.
>
> **Por qué cambiar de modelo dispara el consumo (mecanismo, no anécdota):** cambiar de modelo
> **invalida el prompt cache**. Todo el historial se re-procesa como `cache_creation` (precio
> completo) en vez de `cache_read` (~10% del precio). En la medición de arriba, 82,893 de los
> 84,360 tokens fueron `cache_read` **porque no hubo cambio de modelo en la sesión**. Regla
> operativa que sale de esto y que vale para cualquier proyecto: **cambiar de modelo al abrir
> un tab, nunca a mitad de una sesión larga.**
>
> **Lo que ya existe y NO se rehace:** `scripts/handoff.ts` + `scripts/agent-handoff.ts`
> (H.4.2, commit `c1c6edc`) ya escriben `.orchestos/handoff.md`. Su propio comentario de
> cabecera declara el hueco: *"no es un gate: no existe un evento 'fin de sesión' universal
> entre Claude/Codex/DeepSeek/OpenCode para engancharlo mecánicamente"*. **El umbral de
> contexto ES ese evento.** H.7 es el disparador que a H.4.2 le faltaba, no un sistema nuevo.
>
> **Viabilidad verificada antes de escribir el ítem** (contra el binario 2.1.234, para que
> nadie la re-investigue): `strings claude.exe` confirma `transcript_path` (11 ocurrencias),
> `SessionStart` (117), `hookSpecificOutput` (124) y `additionalContext` (186). El payload
> que necesita el hook existe.
>
> **Restricciones duras del diseño, no negociables por quien implemente:**
> - **Nada de compactación automática** ([[feedback-no-compactar-contexto]]): se avisa y se le
>   pide a Carlos cerrar el tab. Nunca se comprime la conversación por cuenta propia.
> - **Nada de cambio automático de modelo** ([[feedback-modelo-decision-final-carlos]]).
> - **Costo cero por debajo del umbral**: el hook no imprime nada. Un aviso por turno sería
>   exactamente el mal que este ítem intenta curar.
> - **El handoff lo escribe un script determinista, no un LLM.** Carlos lo planteó explícito:
>   "guardar a cada momento también me consumiría tokens".
> - El umbral es un **porcentaje**, y la ventana se **deriva del modelo del turno** — no un
>   número fijo de tokens. Modelos distintos, ventanas distintas.

- [x] **H.7.1 — ⚡ `scripts/context-budget.ts`: medir el llenado de la ventana.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-7-1)

- [x] **H.7.2 — ⚡ Handoff con la intención, no solo con el estado.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-7-2)

- [x] **H.7.2b — 🧠 Reabrir la fuente del número: registro de adaptadores por CLI.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-7-2b)

- [ ] **H.7.2c — ⚡ Registro de adaptadores: falta OpenCode.** Hallazgo por código
  (2026-09-08, Claude, verificando el hook H.7.3 a pedido de Carlos — "verifica que esto se
  cumpla para cualquier modelo"). `DEFAULT_ADAPTERS` en `scripts/context-adapters.ts:267` solo
  trae `[claudeAdapter, codexAdapter]`. El diseño del registro sí es genérico por modelo dentro
  de cada CLI (`readTranscriptUsage()` lee el `model` real de la última línea del transcript en
  cada disparo, nunca uno fijo) — pero por CLI es una lista cerrada de 2. Carlos usa OpenCode en
  este mismo proyecto ([[codex-delegation-workflow]] / uso real observado en sesión); con ese
  CLI activo, `readContextBudget()` no encuentra adaptador y el fail-open documentado en
  `context-adapters.ts:117` ("un hook que rompe el turno es peor que un hook que no avisa")
  hace que el aviso de 60%/65% **no aparezca en absoluto, en silencio** — no es un bug, es la
  consecuencia no señalada de una decisión de diseño correcta.
  Aplicar la misma regla ya escrita para este registro (`context-adapters.ts:10`, cita de
  Carlos): "las soluciones no las hacemos una por modelo sino para los LLMs que vengan" —
  agregar `opencodeAdapter` como entrada de datos en `DEFAULT_ADAPTERS`, no un `if` nuevo.
  Antes de escribirlo: verificar contra un transcript real de OpenCode dónde publica
  modelo/tokens/ventana (mismo método que H.7.2b usó para Codex — contrato verificado en vivo,
  no asumido de la documentación). Si OpenCode no publica la ventana en su transcript, resolver
  por catálogo igual que hace `claudeAdapter`, no inventar un fallback por familia.
  **Gate:** sesión real con OpenCode como agente activo, cruzar el 60%, ver el aviso en vivo —
  mismo criterio que el gate 🔍 de H.7.3, no un test que mockee el adaptador.

- [ ] **H.7.3 — ⚡ El hook: avisar al 60% y volcar el handoff una sola vez.**
  Depende de H.7.1, H.7.2 y **H.7.2b** (la fuente del número se rehizo como registro de
  adaptadores — no re-cerrar H.7.3 leyendo el JSONL directo). El hook debe consumir
  `readContextBudget()` del registro, sin saber qué CLI está corriendo.
  `.claude/hooks/context-budget.js`, registrado como
  `UserPromptSubmit` en el `settings.json` **del proyecto** (no el global — el global es
  portable entre máquinas, ver `~/.claude/CLAUDE.md`). Comportamiento:
  - Lee `transcript_path` del JSON de stdin. Si falta o el archivo no existe: **salir 0 sin
    imprimir nada**. Fallar abierto: un hook que rompe el turno es peor que un hook que no
    avisa.
  - `level === 'ok'` → **no imprime nada**. Cero tokens.
  - `level === 'warn'` (≥60%) → dispara `bun run agent:handoff` **una sola vez por sesión**
    (flag `{ sessionId, firedAt }` en `.orchestos/context-budget.json`, gitignored) e imprime
    un aviso de ≤4 líneas: % actual, modelo, ventana, y la instrucción de cerrar el tab.
  - `level === 'critical'` (**≥65%**, bajado desde 75% por decisión de Carlos el 2026-09-03 —
    ver punto 6 de la investigación: el autocompact dispara a ~78% y no se puede desactivar de
    forma fiable, así que el margen debe absorber un turno pesado entero) → aviso corto en cada
    turno. **Este es el único nivel que avisa en cada turno**; en `warn` el aviso es una sola vez
    por sesión (ver BUG-H.7.3-a abajo — hoy el código no cumple esto). Los dos umbrales son
    **dato del registro de H.7.2b**, no constantes en el hook.
  - Presupuesto de tiempo: el hook debe terminar en <500ms; `timeout` de 5000 en la config.
  Gate 🔍 (no se cierra sin esto): correr una sesión real hasta cruzar el 60% y **ver el aviso
  en vivo**, con `.orchestos/handoff.md` escrito y su timestamp posterior al cruce. No vale un
  test que mockee el hook — es exactamente el fallo de "interfaz que no aporta" de la Regla
  Cero, y la razón de [[feedback-verificar-gates-en-vivo]].
  **Implementación lista; gate 🔍 pendiente:** hook de comando registrado en el `settings.json`
  del proyecto con timeout real de 5 segundos (=5000 ms). Lee stdin, falla abierto ante ausencia,
  corrupción, timeout, modelo no publicado o fallo de handoff; `warn`/`critical` genera el
  handoff solo si el `{sessionId, firedAt}` no coincide y `critical` avisa en cada turno. El aviso
  ocupa 3 líneas. La resolución proveedor-neutral de H.7.1 usa solo una coincidencia única del
  catálogo. Prueba end-to-end de ruta normal con transcript real: `claude-sonnet-5` → ventana
  publicada 1,000,000, 17.6%, silencioso, 110 ms. Falta una sesión real ≥60% para verificar el
  aviso visible y el `mtime`; no se suplanta con fixture.
  **Observaciones corregidas (2026-09-02, pedido explícito de Carlos):** el fixture de eval
  crea su commit base con identidad efímera pasada como `git -c`, sin escribir configuración local
  ni global; su test anula configuración global/sistema para reproducir GitHub Actions. El
  pre-push mantiene el comando exacto de CI, pero guarda la salida completa en un log temporal y
  muestra solo las 6 líneas finales al pasar (80 líneas al fallar). Corrida real ✅: 1219 pass /
  0 fail, funciones 74.20%, líneas 63.32%; el output visible quedó acotado y el log conserva el
  diagnóstico completo.

  **Gate 🔍 corrido por Claude el 2026-09-03 — primera pasada, NO PASÓ (bugs abajo). Ambos
  bugs se arreglaron después, dentro del trabajo de H.7.2b (commit `8a6ea80`) — ver
  "BUG-H.7.3-a arreglado y verificado en vivo" / "BUG-H.7.3-b cerrado" más arriba en este
  bloque. Se deja la tabla y el diagnóstico original como evidencia de por qué se reabrió
  H.7.2b. Lo que sigue sin cerrar el ítem: el gate estricto pide una sesión en vivo cruzando
  el 60% dentro de un turno; lo verificado hasta ahora es contra transcripts reales pero
  históricos — falta esa corrida en caliente.**
  Método: se invocó el hook real (`node .claude/hooks/context-budget.js`) con el JSON de stdin
  que le pasa Claude Code, contra **transcripts reales de Carlos** de
  `~/.claude/projects/<slug>/` que ya habían cruzado el umbral — no fixtures sintéticos.
  Medición previa con `bun run context:budget --` sobre 8 transcripts: 3 en `warn`
  (61.5% / 64.2% / 71.9%) y 1 en `critical` (78.0%).

  | Prueba | Transcript | Resultado |
  |---|---|---|
  | `ok` | sesión actual, 17.6% | silencio, exit 0, **103 ms** |
  | `warn` | `b1bb946b…` 71.9% | aviso 3 líneas + handoff regenerado, 237 ms ✅ |
  | `warn`, 2º turno misma sesión | `b1bb946b…` | handoff **no** se regenera ✅ / aviso **se repite** ❌ |
  | `critical` | `7c87bf0a…` 78.0% | "Contexto crítico", exit 0 ✅ |
  | transcript inexistente | — | silencio, exit 0 ✅ |
  | stdin no-JSON | — | silencio, exit 0 ✅ |

  **BUG-H.7.3-a — el aviso de `warn` se imprime en cada turno, no una sola vez.**
  En `.claude/hooks/context-budget.js:18-19` el guard de `sessionId` protege **solo** la
  escritura del handoff; `printWarning(budget)` queda fuera del `if` y corre siempre:

      if (readState()?.sessionId !== sessionId && !writeHandoff(...)) return
      printWarning(budget)   // ← sin guard

  Rompe tres cosas a la vez: (1) el spec de arriba, donde la **única** diferencia declarada
  entre `warn` y `critical` es la frecuencia del aviso — con este bug `critical` no tiene
  comportamiento propio; (2) la propia nota de evidencia de Codex ("`critical` avisa en cada
  turno", que implica que `warn` no); (3) la regla global de `~/.claude/CLAUDE.md` § Costo de
  contexto, punto 4, textual: *"un aviso por turno es el mismo mal que intenta curar"* — 3
  líneas por turno desde el 60% hasta cerrar el tab, en el mecanismo cuyo propósito es
  **ahorrar** contexto. Fix: mover `printWarning` dentro del guard para `warn`, dejando el
  camino de cada turno solo para `critical`.

  **BUG-H.7.3-b — el hook `.js` no tiene test propio.** `scripts/context-budget.test.ts` cubre
  el script `.ts` de H.7.1, no `.claude/hooks/context-budget.js`; grep de `context-budget` en
  los tests no devuelve ninguna referencia al hook. Sin test, BUG-a podía existir con la suite
  en verde — y de hecho existió. Mismo patrón que el hook `pre-commit` desincronizado de la
  Regla Cero de `CLAUDE.md`.

  **Límites declarados de esta verificación** (no se presentan como cubiertos): los transcripts
  usados son reales pero **históricos** — no es una sesión en vivo cruzando el 60% dentro de un
  turno, que es la letra del gate. Y no se pudo distinguir si el hook estaba cargado en la
  sesión activa, porque en `level === 'ok'` su comportamiento correcto es indistinguible de no
  estar registrado ([[reference-settings-json-requires-restart]]). Estado restaurado al terminar:
  `.orchestos/handoff.md` con su contenido original y `.orchestos/context-budget.json` borrado.

  **Fuera de scope declarado:** ninguno.

  **Aclaración 2026-09-03 (evitar falsa alarma repetida): Orca no mide esto.** Carlos vio 84%
  en el indicador de Orca y preguntó por qué el hook no avisaba. Verificado con evidencia:
  Orca muestra el `rate_limits` nativo de la statusLine de Claude Code (`used_percentage` de
  las ventanas de 5h/7 días — cupo de cuenta, ver `~/.claude/cache/changelog.md:3181`),
  reenviado sin cálculo propio por `~/.orca/agent-hooks/claude-statusline.sh` (filtra por
  `"rate_limits"` en el payload). Es el eje **cupo/costo**, no el eje **ventana de contexto**
  que mide H.7.3 (`~/.claude/CLAUDE.md` § Costo de contexto, punto 3). Corrida real en paralelo
  esa misma sesión: hook contra el transcript real dio `pct: 10.66%, level: ok` — correcto para
  esa sesión, el hook no debía avisar. Si esto se repite, **no es un bug del hook**: pedir el
  número que muestra el propio indicador, no asumir que es contexto.

- [x] **H.7.4 — ⚡ `SessionStart`: reanudar sin volver a explicar.** (cerrado 2026-09-03) → [evidencia](docs/done/bloque-H.md#bloque-h-h-7-4)

- [x] **H.7.5 — ⚡ Superficie en el dashboard.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-7-5)

- [x] **H.7.5a — 🧠 Corrección multi-CLI y paridad de métricas.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-7-5a)

### H.8 — `cli_effort` genérico por CLI, no solo Claude (ABIERTO 2026-09-02, GO de Carlos)

> **Origen:** Carlos preguntó por `stablyai/orca` (orquestador que corre "any CLI agent" en
> paralelo — precedente de industria para la arquitectura CLI-first ya presente en
> `engine-cascade.ts`) y notó que el efecto/"esfuerzo" del CLI no debería estar atado a un
> modelo/CLI en particular, sino resolverse de forma genérica para cualquier CLI que lo
> soporte. Investigado y confirmado, no supuesto:
> - **Claude Code**: flag dedicado `--effort {low,medium,high,xhigh,max}` (ya cableado hoy en
>   `external.ts`/`tasks/schema.ts`).
> - **Codex CLI**: sin flag dedicado — se fija vía `-c model_reasoning_effort=<valor>` (config
>   TOML override). Valores válidos confirmados contra la doc oficial de OpenAI
>   (`developers.openai.com/codex/config-reference`): `minimal | low | medium | high | xhigh`
>   (`xhigh` model-dependent). Set **distinto** al de Claude (Codex tiene `minimal`, no tiene
>   `max`).
> - **`--dangerously-bypass-approvals-and-sandbox`** verificado en `codex exec --help` de esta
>   máquina — equivalente exacto al `--dangerously-skip-permissions`/YOLO de Claude Code, ya
>   asumido implícitamente por el harness (corre sin confirmación interactiva por diseño).
>
> **GO explícito de Carlos (2026-09-02):** "realiza lo que más profesional sea" sobre el plan
> de abajo, presentado y no objetado.

- [x] **H.8.1 — ⚡ Registro de `cli_effort` por engine, no una lista única.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-8-1)

- [x] **H.8.2 — ⚡ Aplicar el effort en el executor de Codex.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-8-2)

- [x] **H.8.3' — ⚡ CERRADO-RECORTADO (2026-09-04): backend de effort genérico; draft visual congelado.** (cerrado 2026-09-04) → [evidencia](docs/done/bloque-H.md#bloque-h-h-8-3)

### H.9 — El chat del producto hereda la config personal de quien lo corre (ABIERTO 2026-09-03, GO de Carlos)

> **Origen — incidente real, no hipótesis (2026-09-03):** Carlos notó que el chat del dashboard
> le respondió citando su vault privado (`~/Documents/MemoriesMD`). Le pidió a Codex que buscara
> esa conversación guardada y Codex reportó que no había nada — lo que abrió la segunda pregunta:
> *"¿entonces qué está guardando el SQLite?"*. Ambas cosas resultaron ser síntomas de dos huecos
> distintos, verificados contra la DB real y el código, no supuestos.
>
> **Hueco 1 — el chat del producto no persiste.** `chat_sessions`/`chat_messages` y sus handlers
> existen completos desde CC.2, pero el front **nunca manda `sessionId`**
> (`src/dashboard/public/screens-core.js:592-613` arma el body con `history` desde
> `st.chatHistory`, memoria del navegador). Y `src/dashboard/handlers/chat.ts:899` abre con
> `if (!session) return`. Resultado medido en `~/.orchestos/db.sqlite`: `chat_messages` tiene 12
> filas, **todas del 2026-08-19**, sembradas por curl en el gate CC.1/CC.5. Los dos chats reales
> del 2026-09-03 quedaron solo en `runs` (`task_class='chat'`) y con **`result` vacío** — se
> guarda el prompt del usuario, nunca la respuesta. Es el patrón que la regla cero de
> `CLAUDE.md` prohíbe: backend construido, superficie nunca cableada
> ([[feedback-dashboard-no-solo-cli]]).
>
> **Hueco 2 — el spawn no aísla la config personal.** `src/run/executors/codex.ts:226` lanza
> `codex exec --sandbox read-only` y `src/run/executors/external.ts:264` lanza
> `claude -p --allowedTools Read,Glob,Grep`, ambos en el `cwd` del proyecto y **sin flags de
> aislamiento**. Cada CLI carga entonces la config del usuario que corre OrchestOS:
> `~/.codex/AGENTS.md:58` ("Activación del vault de conocimiento… `~/Documents/MemoriesMD`") en
> el caso de Codex; `~/.claude/CLAUDE.md` **más** el hook `UserPromptSubmit` →
> `~/.claude/hooks/detect-project.js:57` → `knowledge_radar.py` en el de Claude. El chat del
> 2026-09-03 gastó **26.656 `input_tokens`** por esa inyección que nadie pidió.
>
> **Por qué NO se limpia antes de entregar** (Carlos preguntó explícitamente). El acoplamiento no
> vive en el repo — `git grep carlosgallardo -- src/ scripts/` da **cero** rutas absolutas del
> home, y las menciones a `MemoriesMD` en `docs/` e `IDEAS.md` son procedencia documental, texto
> sin efecto. Vive en el **runtime del spawn**. Cuando otra persona clone OrchestOS no hereda el
> vault de Carlos: hereda **su propio** `~/.codex/AGENTS.md`, sus hooks y sus MCPs. El bug es
> idéntico y encima indebuggeable desde acá. Separar los dos planos: el tooling con el que se
> desarrolla (mi `~/.claude`, fuera del repo, no se entrega) es plano A; el producto spawneando
> CLIs es plano B y **se entrega tal cual**. El chat del incidente fue plano B — la fila de `runs`
> lleva el `project_id` de orchestos y `model = codex (cli default model) via Codex CLI`.
>
> **Cuál es el riesgo real, sin inflarlo.** Que un CLI lea el vault de su propio dueño en su
> propia máquina no es una brecha. Los riesgos reales son otros tres:
> 1. **Exfiltración** — lo que el CLI lee del vault sale de la máquina hacia OpenRouter/OpenAI.
> 2. **Reproducibilidad** — el producto se comporta distinto según los dotfiles de quien lo
>    instaló, o sea **no tiene comportamiento definido**. Este es el que decide la arquitectura.
> 3. **Costo y contexto** contaminados por inyección no solicitada.
>
> **Refutación de la primera propuesta (queda registrada para no repetirla).** La salida obvia
> era `CODEX_HOME`/`CLAUDE_CONFIG_DIR` y listo. Es insuficiente: aísla lo que el modelo *sabe*,
> no lo que *puede leer*. Con la config aislada, un `leé ~/Documents/MemoriesMD/...` escrito a
> mano sigue funcionando, porque `--sandbox read-only` y `Read,Glob,Grep` son read-only del
> **filesystem entero**. Y si un vendor renombra la env var, el aislamiento desaparece en
> silencio — el patrón exacto del `pre-commit` desincronizado 11 días. El aislamiento de config
> es defensa en profundidad, nunca la frontera.
>
> **Flags verificados en los binarios de esta máquina (2026-09-03), no leídos de la doc:**
> - `claude --help` → `--settings <file-or-json>` ✅, `--add-dir <directories...>` ✅. Con
>   `--settings` se puede pasar un `permissions.deny` propio: **Claude sí puede demostrar una
>   frontera de lectura por path.**
> - `codex exec --help` → `--sandbox` acepta solo `read-only | workspace-write |
>   danger-full-access` ✅ — **ninguno acota los paths de lectura**. Sí existen
>   `--ignore-user-config` ("Do not load `$CODEX_HOME/config.toml`; auth still uses `CODEX_HOME`")
>   ✅, `-C/--cd <DIR>` ✅ y la env var `CODEX_HOME` ✅. Conclusión honesta: **Codex NO puede
>   demostrar frontera de lectura hoy**; a lo sumo se le quita la config. Esa asimetría es
>   justamente lo que el diseño de abajo tiene que representar en vez de esconder.
>
> **Ubicación en la cola.** No se adelanta a H.8.2/H.8.3 (Codex está trabajando ahí). Pero va
> **antes de H.5.3**: medir la primera corrida real con el chat inyectando vault y con los
> `input_tokens` contaminados produce un número que no significa nada. Cola resultante:
> `H.8.2 → H.8.3 → H.9 → H.5.3`.
>
> **GO explícito de Carlos (2026-09-03):** "dale, arma el plan", después de pedir "lo profesional,
> no lo más fácil" y de recibir la refutación de la propuesta fácil.

- [~] **H.9.1 — ⚡ Trazabilidad primero: el chat se guarda entero o no se guarda.**
  **MOVIDO a `Bloque I` § I.4 (2026-09-03) — no se ejecuta acá.** Motivo técnico, no
  administrativo: este ítem y el rediseño del chat tocan el mismo archivo y el mismo flujo
  (`screens-core.js:592-613` + `handlers/chat.ts`). Cablear `sessionId` sobre un front que el
  Bloque I va a reescribir es hacer el trabajo dos veces. El alcance no cambió; cambió dónde se
  ejecuta. H.9.4 sigue dependiendo de él, por eso el Bloque I va antes que H.9.4.
  Alcance original, conservado como referencia:
  Es el instrumento de medición, no el arreglo — sin esto no se puede auditar qué leyó el agente
  ni verificar que H.9.2/H.9.3 funcionan. Un sandbox sin log de auditoría es media solución.
  Tres cosas, todas en el camino que hoy ya existe:
  1. El front manda `sessionId` en `/api/chat` (`screens-core.js:592-613`), creando la sesión al
     vuelo si no hay ninguna. `st.chatHistory` deja de ser la fuente de verdad — el backend ya
     ignora el `history` del cliente por diseño (CC.2), así que hoy la historia del navegador y
     la de la DB pueden divergir sin que nadie lo note.
  2. `runs.result` deja de guardarse vacío para `task_class='chat'`: la respuesta se persiste
     junto al prompt.
  3. **Qué archivos leyó el CLI.** Los eventos de tool ya vienen en el stream JSON que
     `runClaudeCode` (`external.ts:201-226`) parsea y descarta; `runCodex` tiene su equivalente.
     Se persisten como parte del run del chat. Sin este campo el gate de H.9.4 no tiene contra
     qué afirmar.

  Gate: reiniciar el dashboard ([[feedback-reiniciar-dashboard-tras-cambio]]), mandar un mensaje,
  recargar la página y confirmar que la conversación sigue ahí; verificar en
  `~/.orchestos/db.sqlite` que hay fila en `chat_messages` **y** que el `run` correspondiente
  tiene `result` no vacío y la lista de archivos leídos. Bajar el servidor al terminar
  ([[feedback-siempre-cerrar-servidor]]).

- [x] **H.9.2 — 🧠 La frontera de lectura es una capability declarada por CLI, verificada, no un prompt.** (cerrado 2026-09-06) → [evidencia](docs/done/bloque-H.md#bloque-h-h-9-2)

- [x] **H.9.3 — ⚡ Aislamiento de config-home como defensa en profundidad (tercera capa, no primera).** (cerrado 2026-09-04) → [evidencia](docs/done/bloque-H.md#bloque-h-h-9-3)

- [ ] **H.9.4 — 🔍 El gate que lo vuelve real: el chat intenta leer el vault y no puede.**
  **Dependencias actualizadas (auditoría 2026-09-06): R.2 y R.5.** El campo `files_read`
  entregado originalmente por I.4 registraba solicitudes sin confirmar resultados. R.2 lo
  corrigió el 2026-09-07 y añadió `read_audit_json` con evidencia real; R.5 sigue pendiente.
  Ver Bloque R para resultados, cobertura y límites; este gate no se cierra automáticamente.
  Sin este test, alguien cambia un flag en dos semanas y nadie se entera — literalmente lo que
  pasó con el `pre-commit`. Un gate ejecutable, con el dashboard real corriendo
  ([[feedback-verificar-gates-en-vivo]]), que para cada CLI con frontera declarada:
  1. Pide al chat leer un archivo fuera del root del proyecto (un fixture temporal, **nunca el
     vault real** — el test no debe depender de datos personales de nadie ni de que el vault
     exista).
  2. Afirma que la lectura no ocurrió, cruzando contra la lista de archivos leídos que persiste
     H.9.1 — no contra lo que el modelo *dice* que hizo.
  3. Para `codex` (frontera `none`), afirma lo contrario: que el sistema **reporta** el hueco en
     vez de prometer aislamiento. Un test que documenta la limitación real vale más que uno que
     la esconde.

  Escrito por Codex mientras Claude implementa H.9.2/H.9.3, que es el reparto que mejor ha
  funcionado ([[feedback-codex-escribe-el-gate]]); acotado a los archivos que él crea para no
  cruzarse con la edición en curso ([[feedback-codex-no-en-paralelo-con-claude]]).

**Fuera de scope declarado de H.9:** `opencode` (mismo criterio que H.8 — sin contrato
verificado); el sandbox de **escritura** de las tareas (worktrees ya lo cubren, es otro eje); la
frontera de red/SSRF (`src/dashboard/ssrf.ts` ya existe y no se toca); y cualquier cambio al
vault o a `~/.claude`/`~/.codex` de Carlos — el vault sigue alimentando el trabajo de desarrollo
igual que hoy, lo que se corta es que el **producto** lo herede por accidente.

### H.10 — El gate de evidencia acepta prosa, no el hecho (ABIERTO 2026-09-08, GO de Carlos)

> Por qué existe: incidente R.5 del 2026-09-08 ([[feedback-verificar-gates-en-vivo]],
> [[feedback-revisor-adversarial-cruzado]]). Claude cerró R.5 declarando "Gate en vivo: navegador
> real..." en PLAN.md con `check-live-gate.ts` en verde — pero el gate solo verifica que esa
> *frase* exista (regex sobre `Gate en vivo:.*(navegador|browser|Playwright)`), nunca que el
> hecho (dos procesos concurrentes, exigido por el propio texto del ítem) haya ocurrido de
> verdad. No ocurrió. Lo encontró Astra (GPT, revisión independiente) horas después, junto con 4
> bugs reales de concurrencia/ownership que 1335 tests en verde no habían tocado — el mismo día,
> mismo ítem.

- [x] **H.10.1 — 🧠 El gate de evidencia exige un artefacto versionado, no una frase.** → [evidencia](docs/done/bloque-H.md#bloque-h-h-10-1)

- [ ] **H.10.2 — 🧠 Revisor adversarial nocturno, de un modelo distinto al que implementó.**
  Reabierto 2026-09-08 por Carlos: corregir exclusivamente cinco fallos de H.10.1/H.10.2 antes de
  volver a declararlo cerrado: aislamiento efectivo (filesystem, credenciales, red y timeout) de
  tests generados; `test_path` canónico dentro de `review-evidence` sin traversal, absolutos,
  symlinks externos ni sobreescritura; clasificación de fallos que separa aserción de sintaxis,
  imports, infraestructura y timeout; fail-closed del estado `lastReviewedSha`; y evidencia del
  gate ligada al ítem que se cierra y presente en el contenido staged. Añadir regresiones
  adversariales, ejecutar los gates requeridos y documentar resultados/límites. No activar el
  LaunchAgent, no cambiar `gpt-5.6-sol` y dejar la revisión independiente pendiente: los tests de
  quien implementa no la sustituyen. **Scope declarado:** `scripts/adversarial-review.ts`,
  `scripts/adversarial-review.test.ts`, `scripts/agent-governance.ts`,
  `scripts/agent-governance.test.ts`, `scripts/check-live-gate.ts`, `PLAN.md` y, solo si hace
  falta para el sandbox verificable, el script mínimo versionado que aquel invoque. **Fuera de
  scope declarado:** LaunchAgent/launchd, `package.json`, prompt/modelo configurado, `REVIEW.md`,
  automatización nocturna y cualquier hallazgo ajeno. Estado previo: cerrado 2026-09-08 (Claude implementó + Codex `gpt-5.6-terra` escribió los tests unitarios
  sobre el contrato ya cerrado, delegación explícita de Carlos).
  1. `scripts/adversarial-review.ts` (funciones puras exportadas, `main()` orquesta): toma
     `git diff` desde el último sha revisado (`.orchestos/adversarial-review-state.json`) hasta
     `HEAD` — si ese sha ya no existe (rebase/force-push), cae a `HEAD~1..HEAD` en vez de asumir
     cuánto cubrir. Alcance acotado al diff, no barrido completo del repo (decisión de Carlos).
  2. Corre `codex exec -m gpt-5.6-sol --json --sandbox read-only --ignore-user-config`. El
     stream `--json` **no reporta el modelo usado** (verificado en vivo,
     [[reference-codex-modelo-real-rollout]]) — el script captura `thread_id` del stream
     (`extractThreadId`), busca `~/.codex/sessions/**/rollout-*-<thread_id>.jsonl`
     (`findRolloutPath`), lee el `model` real de la línea `type:"turn_context"`
     (`extractModelFromRollout` — path exacto verificado en el rollout real, no en memoria) y
     **aborta sin escribir nada** si no coincide con `gpt-5.6-sol` (`verifyModelUsed` +
     `main()`). El modelo de una corrida real no es una afirmación del LLM
     ([[feedback-modelo-decision-final-carlos]]).
  3. Prompt adversarial (`scripts/adversarial-review-prompt.md`) por los 4 dominios reales del
     incidente: concurrencia/ownership, frontera de seguridad, evidencia declarada vs.
     producida, contradicción comentario-vs-código. Contrato de salida: un único bloque
     ` ```json ` con un array (vacío si no hay nada real — explícitamente autorizado a no
     inventar).
  4. **Regla dura anti-ruido:** `runFindingTest()` escribe el `test_code` de cada hallazgo bajo
     `review-evidence/*.check.ts` (extensión deliberada, fuera del glob de descubrimiento de
     `bun test` — un hallazgo real no puede romper el CI del propio repo) y lo corre con
     `bun test <ruta explícita>`. Sobrevive solo si el proceso termina con código distinto de 0
     — si el test no falla, se descarta y el archivo se borra en el mismo `main()`, antes de
     tocar `REVIEW.md`.
  5. Hallazgos sobrevivientes → `REVIEW.md` (nuevo, en la raíz, mismo principio que `DREAMING.md`
     — nunca aplica cambios, Carlos decide qué promover a `PLAN.md`/`IDEAS.md`; entradas más
     recientes primero, sin duplicar el header entre corridas — `appendToReviewMd`). El script
     **nunca commitea** — deja el working tree con cambios locales para que Carlos los revise.
  6. `~/Library/LaunchAgents/dev.cagr1.orchestos.review.plist` (creado, **sin cargar todavía en
     launchd** — pendiente de que Carlos confirme activarlo) — mismo patrón que
     `dev.cagr1.memoriesmd.sync.plist` (ya en la máquina): `StartCalendarInterval` 3am, sin
     `pmset wake` (decisión explícita de Carlos: no vale el costo de forzar el despertar de la
     máquina por esto). `bun run review:nightly` (`package.json`) usa la suscripción de Codex ya
     pagada, no API key aparte — por eso no es GitHub Actions.
  **Gate:** `bun test scripts/adversarial-review.test.ts` — 10 pass / 0 fail / 35 expects
  (funciones puras: estado/rango, parseo de stream JSONL, verificación de modelo contra rollout,
  parseo de hallazgos, formato de `REVIEW.md`). Además, **corrida real contra `codex exec`**
  (no simulada) en dos repos git temporales — evidencia completa en
  `scripts/h10-gate-evidence.json`:
  (1) diff con un bug plantado de la misma forma que R.5 (comentario promete verificar el owner
  del lease, el código no lo hace) → el modelo lo encontró, escribió un test, ese test falló
  contra el código real, y la entrada quedó en `REVIEW.md` — texto y test verificados a mano;
  (2) diff limpio (trim de un string, sin nada en los 4 dominios) → cero hallazgos, cero ruido,
  no se crea ni `REVIEW.md` ni `review-evidence/`;
  (3) `expectedModel` deliberadamente distinto al real (`gpt-5.6-sol` corrió de verdad, se pidió
  verificar contra `"modelo-incorrecto-a-proposito"`) → abortó con exit code 1, no escribió
  nada, y **no actualizó el estado** (el sha revisado no avanza, así que la próxima corrida real
  vuelve a intentar ese mismo diff en vez de darlo por hecho).
  **Corrección en curso 2026-09-08 (Codex, no cerrar hasta gates pendientes):** los cinco
  hallazgos se corrigieron en el revisor y sus gates: las pruebas generadas corren bajo
  `sandbox-exec` de macOS con root temporal de escritura, repo solo lectura, `HOME`/
  `ORCHESTOS_HOME` limpios, red denegada y timeout de 30 s; si no existe ese sandbox, se rechaza
  la prueba sin fallback. `test_path` rechaza absolutos/traversal, comprueba ancestros canónicos
  (incluidos symlinks) y no pisa un destino existente. Solo una salida reconocible de aserción
  puede confirmar un hallazgo; sintaxis, import, infraestructura y timeout se registran en
  `*.result.json` con stdout/stderr y se descartan como prueba. El SHA queda inmóvil para spawn/
  timeout de Codex, respuesta ausente, JSON o hallazgos malformados. H.10.1 ahora exige que el
  artefacto sea un blob staged citado en la propia línea `Gate en vivo:` del mismo ítem cerrado.
  **Verificado:** `bunx tsc --noEmit`; `bun test scripts/adversarial-review.test.ts
  scripts/agent-governance.test.ts` — 19 pass / 0 fail / 80 expects; sandbox real adversarial
  comprobó lectura externa, escritura fuera del temporal, credencial inyectada y red local
  denegadas. `bunx biome check` sobre los cinco scripts tocados pasó. **Pendiente, no se
  reclama:** `security:gate`/`test:coverage` completos no terminaron antes del límite de 30 s del
  runner de esta sesión; revisión independiente sigue pendiente y estos tests propios no la
  reemplazan. No se activó el LaunchAgent ni se cambió modelo, prompt o `package.json`.

  **H.10.2-bis — revisión independiente (Claude, 2026-09-08): dos bugs bloqueantes que se
  anulaban entre sí y hacían que el revisor NO pudiera confirmar ningún hallazgo jamás.**
  Encontrados corriendo el recorrido completo, no leyendo el diff.
  1. **El sandbox impedía ejecutar cualquier cosa.** El perfil `(deny default)` solo permitía
     `process*` y unas rutas de lectura; macOS 26 exige además las clases `mach*`, `sysctl*`,
     `signal`, `ipc*` y `system*` para que un binario arranque. Verificado a mano: hasta
     `/bin/echo` moría con SIGABRT (exit 134) y stdout/stderr **vacíos**. Como
     `classifyFindingFailure` clasifica por patrones en la salida, una salida vacía caía en
     `non-assertion-failure` → **todo hallazgo se descartaba, siempre, en silencio**. El revisor
     nocturno habría corrido cada noche reportando cero hallazgos, y eso se habría leído como
     "no hay bugs". Es exactamente el botón que no hace nada de la regla cero de `CLAUDE.md`.
  2. **`bun test <ruta>` sin `./` no ejecuta nada.** Bun trata el argumento como *filtro de
     nombre*; como la evidencia usa `.check.ts` (deliberado, para no entrar al glob de la suite
     del repo), no matcheaba ningún test y no corría ninguna aserción — devolviendo exit≠0
     igual. Con la regla original ("sobrevive si exit≠0"), **cualquier** hallazgo quedaba
     "confirmado" sin haberse probado nada. Verificado: sin `./` → `0 expect() calls`; con `./`
     → `1 fail, 1 expect() calls`. **Esto invalida retroactivamente el gate declarado en la
     primera pasada de H.10.2**: aquel "bug plantado detectado" fue un falso positivo — el test
     nunca corrió. Queda registrado en `scripts/h10-gate-evidence.json` § `invalidatedFirstPass`
     en vez de borrarse.
  **Por qué ningún test los atrapó:** los tests del sandbox verificaban que nada ESCAPARA, pero
  ninguno verificaba que algo FUNCIONARA dentro. Tercera repetición del mismo patrón en el día
  ([[feedback-revisor-adversarial-cruzado]]): un test escrito contra el propio contrato del autor
  hereda su punto ciego. Se agregó la regresión que faltaba — un hallazgo legítimo debe sobrevivir
  con `reason: 'assertion-failed'` **y** con prueba de ejecución (`expect() calls` en la salida),
  no solo con un exit code distinto de 0.
  **Decisión de seguridad, explícita:** se permite `file-read*` amplio (acotarlo volvía a impedir
  el arranque: el dyld cache de macOS 26 vive detrás de firmlinks). La frontera que sí se
  sostiene y se verificó en vivo es **escritura solo al temporal + red denegada + credenciales
  conocidas (`~/.ssh`, `~/.aws`, `~/.codex`, `~/.claude`, `~/.gnupg`, `~/.config/gh`) denegadas**.
  Sin red, leer no permite exfiltrar; residuo aceptado: un test podría copiar lo leído al
  `.result.json` local. `classifyFindingFailure` además distingue ahora `test-passed` (exit 0)
  de un fallo raro, para que el `.result.json` sea legible.
  **Gate (recorrido real, con Codex real, después del fix):** ver
  `scripts/h10-gate-evidence.json`. (1) bug plantado con la forma de R.5 → hallazgo confirmado,
  `reason: assertion-failed`, `1 fail / 3 expect() calls` — la aserción **corrió**; (2) diff
  limpio → cero hallazgos, sin `REVIEW.md` ni `review-evidence/`; (3) mismatch de modelo → aborta
  sin escribir y sin avanzar el SHA. Fronteras del sandbox probadas en vivo con un test que
  intenta violarlas: escritura externa, red y credencial → las tres bloqueadas, `3 pass /
  3 expect() calls` (probando que corrió). `bunx tsc --noEmit` limpio; `bun test` de los dos
  archivos: 20 pass / 0 fail / 84 expects.
  **Además — CI estaba rojo por `lint`, no por los tests.** `bun run lint` (Biome) fallaba con 7
  errores de formato/`organizeImports`; el job venía en rojo desde antes de este bloque (19 de
  los últimos 25 runs). Corregido con `bun run lint:fix` → `bun run lint` exit 0. Causa raíz de
  por qué nadie lo veía: **`lint` no está en `pre-commit` ni en `pre-push`**, así que el único
  lugar donde aparece es CI, y un CI siempre rojo deja de dar señal (mismo corolario ya escrito
  en `CLAUDE.md`). Sumarlo al `pre-push` queda propuesto a Carlos, no hecho.
  **Sigue pendiente, no se reclama:** el LaunchAgent quedó cargado en la pasada anterior
  (`launchctl list` → `dev.cagr1.orchestos.review`) **antes** de que estos dos bugs se
  descubrieran; con el fix ya aplicado el revisor funciona, pero su primera corrida nocturna real
  todavía no ocurrió — hasta que ocurra, el recorrido en condiciones de cron sigue sin evidencia.
  **Portabilidad CI en curso (Codex, 2026-09-08):** Ubuntu no tiene `sandbox-exec`; por ello las
  dos integraciones que ejercitan el sandbox real se saltan únicamente si la sonda inyectable
  declara que no hay sandbox macOS. La sonda cubre de forma determinista Darwin+binario,
  Darwin+ausente y Linux+aun-con-ruta simulada; en Linux el camino productivo conserva
  `infrastructure-error` y `survived:false`, nunca ejecuta evidencia sin aislamiento. En macOS,
  ambas integraciones corrieron: `bun test scripts/adversarial-review.test.ts
  scripts/agent-governance.test.ts` → 21 pass / 0 fail / 87 expects; `bunx tsc --noEmit` y Biome
  de los dos archivos tocaron limpio. Límite explícito: CI acredita la selección portable y el
  fallo cerrado; la frontera real de sandbox se acredita solo en macOS. `test:coverage` y
  `security:gate` se iniciaron localmente pero esta terminal corta su proceso antes de resultado.
  **Evidencia remota:** commit `04e75bd` — CI
  [34285739231](https://github.com/cagr1/orchestos/actions/runs/34285739231) ✅: cobertura,
  typecheck y lint; Secret Check
  [34285739176](https://github.com/cagr1/orchestos/actions/runs/34285739176) ✅: typecheck y
  secretos tracked. No acredita el sandbox macOS, que quedó cubierto por la integración local.
  **Fuera de scope declarado:** `scripts/h10-gate-evidence.json` (el artefacto de evidencia del
  propio gate, exigido por H.10.1 — no estaba en el scope-lock que declaró la corrección) y
  `.orchestos/feature-status.json` (regenerado por el pre-commit desde este mismo PLAN.md).

### H.6 — Fuera de alcance de este bloque (anotado, no se toca)

- `src/cli.ts` tiene **2439 líneas y 63 edges** — god file evidente. Es lo segundo que critica
  un externo después del README, pero no es un hueco de harness. Va a `IDEAS.md` si Carlos lo
  aprueba; **no se refactoriza dentro del Bloque H**.
- Cobertura de líneas 62.91% y `src/skills/fetch.ts` en 0% de funciones. El trinquete ya sube
  solo; no abrir ítem salvo decisión explícita.
- Todo el gobierno del repo está en español con README en inglés. Decisión de producto, no
  defecto — no tocar sin que Carlos lo pida.

---

## BLOQUE I — El chat es la única entrada; Task deja de ser una pantalla (ABIERTO 2026-09-03, GO de Carlos)

> **Por qué existe este bloque y por qué es la cuarta vez.** Carlos ya decidió esto **tres veces**
> ([[feedback-tasks-solo-por-chat]], registrado literalmente como *"dicho 3 veces"*). Nunca se
> ejecutó porque **nunca se convirtió en ítem de `PLAN.md` con gate** — se quedó en memoria y en
> conversación. Es el patrón exacto de la regla cero de `CLAUDE.md`: el `pre-commit`
> desincronizado 11 días, el botón que no hace nada. *Una regla que nadie hace cumplir
> mecánicamente deja de existir en la práctica.* Mientras la interfaz manual siga en pantalla, la
> decisión no está tomada, por más veces que se diga. Palabras de Carlos el 2026-09-03:
> *"esto pasa porque AÚN SE CONSERVAN ESAS INTERFACES QUE LAS QUIERO DESAPARECER DE AHÍ"*.
> **Este bloque no se cierra hasta que la superficie manual no esté en la pantalla principal.**
>
> **Evidencia empírica, medida en `~/.orchestos/db.sqlite`, no intuición de UX.** La tabla
> `chat_task_bar_events` — el instrumento que el propio proyecto construyó en J.1/B.1.b para
> decidir esto con datos — dice:
>
>     74 eventos, todos kind='message'
>     bar_shown=1 → 55        bar_shown=0 → 19
>     kind='click'  →  0
>
> **La barra "Crear tarea" se mostró 55 veces y jamás fue clickeada.** El flujo manual no es
> "poco usado": está muerto. 55/0 es un veredicto, y cierra la discusión sobre si conviene
> quitarlo.
>
> **Qué NO es este bloque.** No es "eliminar Task". Carlos fue explícito: *"no eliminar task sino
> hacerlo inteligente"*. El modelo de datos de Task es lo más valioso del sistema y se conserva
> entero — `output[]` (el contrato que hace posible `files_blocked`), `depends_on` (el DAG, sin el
> cual no existe el dogfooding de carlosgallardo.dev), `checks[]` (INS-2026-011: sin verificador
> no se reporta éxito, se declara `blocked`), y `engine`/`model`/`cli_effort` (reproducibilidad,
> que es lo que H.5.3 va a medir). Lo que muere es **el formulario**, no la entidad. Ninguno de
> esos campos debe aparecer nunca en una pantalla de creación; todos deben persistirse.
>
> **Requisito nuevo declarado por Carlos (2026-09-03), que cambia la arquitectura:** *"al ser este
> un producto que va a tener varios proyectos con varios CLI o agentes, Task debe también saber
> dónde se va a correr"*. Hoy eso **no existe**: el agente se elige **global y uno a la vez** en
> Settings (`src/dashboard/public/screens-ops.js:1666`). El schema de tarea ya soporta un engine y
> un modelo por tarea (`src/tasks/schema.ts:22-45`) — el hueco está en que nada los asigna por
> tarea. Es exactamente el bloqueo que ya se documentó para el dogfooding de carlosgallardo.dev
> ([[project-dogfooding-clonar-carlosgallardo-dev]]), y es lo que convierte "Task inteligente" en
> un requisito real y no en una mejora cosmética.
>
> **Contradicción resuelta con Carlos antes de escribir esto.** Su paso 4 original decía
> *"selecciona agente, modelo y esfuerzo automáticamente"*, lo que choca de frente con
> [[feedback-modelo-decision-final-carlos]] (marcada NO NEGOCIABLE) y con el incidente del
> 2026-07-13 donde se quemaron **$5.00** por un modelo elegido de memoria. La línea queda escrita
> aquí para que nadie la cruce:
>
> > **"Automático" = el código lee una preferencia persistente (config/reglas de proyecto).
> > "Automático" ≠ un LLM infiere qué modelo conviene.**
>
> La cascada de E.16 ya funciona así por diseño ([[feedback-deteccion-no-decision-automatica]]:
> la detección detecta disponibilidad; la selección es preferencia del usuario, nunca cambiada en
> silencio). Cualquier implementación que ponga un LLM a elegir modelo viola una regla no
> negociable y quema cupo.
>
> **Fuera de alcance explícito, declarado por Carlos:** dónde viven la DB, `runs`, `specs` y demás
> vistas de datos (*"pueden vivir en otro lado, son solo datos para mostrar; de esa parte ya lo
> vamos a arreglar"*). Se anota, no se toca en este bloque.

### I.0 — El orden, que Carlos marcó como MUY IMPORTANTE

> *"no se puede hacer una cosa por que otra está dañada, por eso el orden es MUY IMPORTANTE"*.
> De acuerdo, y por eso el orden cambia respecto de lo que se propuso el mismo día. **Corrección
> honesta de una recomendación previa:** primero se dijo "H.9 entero antes del rediseño". Es
> incorrecto en un punto concreto, y el argumento en contra es técnico, no una concesión:
> **H.9.1 (persistir el chat) y el rediseño del chat tocan el mismo archivo y el mismo flujo**
> (`src/dashboard/public/screens-core.js:592-613` + `src/dashboard/handlers/chat.ts`). Cablear
> `sessionId` sobre un front que se va a reescribir es hacer el trabajo dos veces. Por eso H.9.1
> se **absorbe** en este bloque como I.4 y deja de ser un ítem suelto de H.9.
>
> **Tercera corrección de orden (2026-09-04, misma sesión, decisión final explícita de Carlos):**
> hubo una vuelta más. Primero se puso H.9.3/H.9.2 antes del Bloque I. Después, ante la pregunta de
> por qué H.5.3 nunca se corrió, se propuso posponerlos ("se atacan después, según se avance").
> Carlos revisó esa segunda versión y la revirtió: **H.9.x se cierran primero, el Bloque I espera.**
> Queda como el orden vigente; las dos versiones anteriores se conservan arriba solo como historial
> de por qué se llegó acá — no reabrir esta secuencia sin una razón nueva. Orden ejecutable:
>
>     1. H.8.3'  recortado a backend         ✅ cerrado 2026-09-04
>     2. H.9.3   aislamiento de config-home  ← que el bug no viaje; siguiente paso
>     3. H.9.2   frontera de lectura por CLI
>     4. H.9.4   gate de privacidad ejecutable
>     5. BLOQUE I (este)  ← el front se toca UNA sola vez, con I.4 adentro
>     6. H.5.3   primera corrida medida real
>
> El argumento de "medir/rediseñar sobre superficie temporal es desperdicio" sigue siendo válido
> para H.5.3 (por eso se queda al final, después de I) — lo que cambió es que H.9.x **no** cuenta
> como esa superficie temporal: son huecos de spawn/backend que no compiten por archivo con el
> Bloque I y no se vuelven a tocar cuando I lo reescriba.
>
> **Cuarta corrección de orden (2026-09-04, misma sesión, decisión explícita de Carlos):** Codex
> intentó H.9.4 y reportó, honestamente, que no puede cerrarse: el gate necesita evidencia real de
> "qué archivos leyó el CLI", y esa persistencia se absorbió en I.4 (arriba) — no existe en ningún
> otro lado todavía. Es una dependencia cruzada que el orden de arriba no contempló. Decisión de
> Carlos: **H.9.4 queda pendiente/bloqueado, se avanza a I.1 ahora, y H.9.4 se resuelve cuando se
> llegue a I.4** (no antes, no en paralelo). No se reabre esta secuencia otra vez sin razón nueva.

- [x] **I.1 — 🧠 Matar la puerta manual: el chat es la única entrada.** (cerrado 2026-09-04) → [evidencia](docs/done/bloque-I.md#bloque-i-i-1)

- [x] **I.2 — 🧠 El punto de confirmación: lo único que reemplaza la fricción que se quita.** (cerrado 2026-09-04) → [evidencia](docs/done/bloque-I.md#bloque-i-i-2)

- [x] **I.3 — 🧠 Task inteligente: saber DÓNDE corre, por tarea y no global.** (cerrado 2026-09-04) → [evidencia](docs/done/bloque-I.md#bloque-i-i-3)

- [x] **I.4 — ⚡ El chat se guarda entero (absorbe H.9.1, mismo archivo).** (cerrado 2026-09-05) → [evidencia](docs/done/bloque-I.md#bloque-i-i-4)

- [ ] **I.5 — 🧠 Rediseño del chat: sacar la implementación de la cara del usuario.**
  Carlos comparó contra Orca, Xirp, Hermes, ChatGPT y Claude: *"hay mucho texto, una interfaz poco
  amigable y moderna"*. Los textos ofensores están verificados en `src/dashboard/public/i18n.js`:
  - `:1003` — `"Sin cablear para el chat todavía — cae a OpenRouter"` ← una **nota de
    implementación** en la cara del usuario.
  - `:994-996` — `"Claude · tu suscripción"`, `"Codex · tu suscripción"`, `"OpenCode · tu
    suscripción"`.
  - `:984` — `"Esfuerzo de razonamiento"`; `:1005` — `"Restablecer a lo predeterminado"`.

  Objetivo: **una sola píldora compacta**, con todo lo demás dentro de un popover.

      ┌──────────────────────────────────────────────┐
      │  ¿Qué querés construir?                      │
      │                                              │
      │  [◈ Codex] GPT-5.4 · Medio        [↑ Enviar] │
      └──────────────────────────────────────────────┘

  Y el trabajo se reporta **inline en el hilo** — sin navegación, sin modal:

      ⏺ Voy a tocar 3 archivos en src/auth/          [Ver] [Cancelar]
      ⏵ Ejecutando · 1 de 3 · src/auth/login.ts             [Detener]
      ✓ Listo · 3 archivos · 47s                    [Ver cambios]

  Se hace en React sobre el design system existente ([[feedback-no-reinventar-ui-usar-libreria]] —
  decisión cerrada, no re-litigar) y con el estándar de acabado permanente
  ([[feedback-acabados-elegantes-siempre]]). Barra de usage por agente
  (`[icono] Claude 61%  [icono] Codex 34%`): **iterar sobre lo que H.7.5 ya entregó, verificando
  primero qué muestra hoy** — y sin confundir los dos ejes, porque ese % es **cupo de cuenta**, no
  ventana de contexto ([[reference-orca-rate-limit-no-contexto]], INS-2026-016).

  **5 defectos concretos ya reportados por Carlos en vivo (2026-09-04), verificados en el código,
  a corregir dentro de este mismo ítem — no antes, para no tocar `SessionStatusBar.tsx` dos veces
  (decisión explícita de Carlos: "esperar al Bloque I"):**
  1. Los íconos de marca (Claude/OpenAI/DeepSeek/...) se ven todos azules — `ui.css:141`
     (`.session-statusbar-cli-icon { color: var(--metric-color) }`) pensado para un glifo
     monocromo de estado, y los SVG nuevos heredan ese `currentColor` en vez de su color real de
     marca. Hay que separar "color de marca" de "color de estado" (el tono warn/critical/idle).
  2. El popover repite el nombre del agente dos veces — `SessionStatusBar.tsx:40`:
     `<strong>{cli.label}</strong>` + `<small>{cli.binary}</small>`, y para casi todos los CLIs
     `label` y `binary` son la misma palabra ("Codex" / "codex").
  3. El punto verde del popover (`ui.css:163`, `.session-statusbar-popover-dot`) no aporta —
     redundante con el color que ya comunica el ícono/barra.
  4. El popover queda pegado al borde izquierdo de la pantalla — falta separación
     (`sideOffset`/`alignOffset` o padding del contenedor, hoy `align="end"` sin margen).
  5. El refresh es `setInterval` fijo cada 5s (`SessionStatusBar.tsx:24`) sin disparo por evento.
     Debe refrescar también al montar el dashboard (ya lo hace) y **tras cada respuesta del
     chat** — hoy no hay ningún trigger ligado al flujo de chat.

- [ ] **I.6 — ⚡ "Actividad", no "Tasks": la vista secundaria.**
  El nombre importa y es parte del arreglo: *"Tasks"* invita a crear una, *"Actividad"* invita a
  mirar. Lista cronológica con estado; el detalle técnico (engine, modelo, effort, diff, checks,
  **archivos leídos**) solo al abrir un ítem. Es donde aterriza el draft manual que I.1 saca de la
  pantalla principal, y donde viven historial, pendientes, errores, reintentos y recuperación
  manual cuando algo falla.

- [ ] **I.7 — 🔍 Gate: la puerta manual no existe y el flujo automático se ve.**
  Contra el dashboard real corriendo, nunca mocks ([[feedback-verificar-gates-en-vivo]]):
  1. En la pantalla principal **no hay ningún camino** para crear una tarea a mano — es el
     criterio de cierre de I.1 y lo que faltó las tres veces anteriores.
  2. Un mensaje que es tarea → confirma (I.2) → ejecuta → reporta inline, y queda persistido en
     `chat_messages` **y** en `runs` con `result` no vacío (I.4).
  3. Un mensaje que **no** es tarea no dispara nada.
  4. Dos tareas del mismo DAG con agentes distintos (Claude/Codex) resuelven y **persisten**
     engine y modelo distintos (I.3).
  5. Ningún texto de implementación visible (I.5).

  Bajar el servidor al terminar ([[feedback-siempre-cerrar-servidor]]).

**Fuera de scope declarado del Bloque I:** dónde viven DB/`runs`/`specs` (Carlos lo pospuso
explícitamente); `opencode`; y el rediseño de las pantallas que no son Chat ni Actividad.

---

## SPRINT 30 — Dejar de reinventar la UI: React + Tailwind + shadcn/ui (ABIERTO 2026-08-21)

> **Sprint 29 cerrado (2026-08-21)** — ver resumen y link a DONE.md más abajo. Este bloque queda
> abierto: puede arrancar `UI.0`.

### Decisión y por qué (2026-08-18, NO RE-LITIGAR)

Carlos decide adoptar el estándar de facto de la industria para la UI del dashboard. La decisión
**está tomada y no se vuelve a discutir** — ningún LLM debe re-proponer "hacerlo a mano en vanilla",
pedir que se re-justifique, ni volver a plantear el trade-off. Si un LLM cree que hay un problema
técnico concreto en la *ejecución*, lo dice; la *dirección* no se re-abre.

**La evidencia que motivó la decisión sale de este mismo archivo:**

- v0.12 (Sprint 21) tuvo que **inventar 4 reglas de diseño propias desde cero** (anclaje de elementos
  fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS) — ver línea del cierre de
  v0.12 más abajo. Son problemas que Radix UI resuelve de fábrica hace años.
- Sprint 21 registró **13 ajustes "premium dashboard"** con causa raíz individual cada uno.
- El patrón `render()` → `innerHTML` → `wire()` (62 `innerHTML` + 186 `addEventListener`) **es** un
  mini-framework escrito a mano. La pregunta nunca fue "¿meto un framework?" sino "¿mantengo el mío
  o uso el que ya resolvió esto?".
- Costo real medido por Carlos: horas por un `<select>`. Meses de "hacerlo sencillo" salieron **más
  caros en tiempo** que adoptar la librería.

**Verificación externa (2026-08-18)**: Claude Desktop es Electron; el combo dominante en apps de
este tipo es React + Vite/Bun + Tailwind + shadcn/ui. Codex integra shadcn/ui vía MCP como registry
de referencia. shadcn/ui está construido sobre **Radix Primitives** (accesibilidad, foco, teclado,
overflow, z-index ya resueltos) + Tailwind. No hay equivalente igual de maduro para vanilla JS.

### Estado inicial medido (2026-08-18, no estimado)

| Pieza | Números reales |
|---|---|
| Pantallas en `window.SCREENS` | **11** — chat, runner, tasks, memory, project, instincts, runs, graph, settings, specs, skills |
| JS de frontend | **~8.300 líneas** — `app.js` 2612, `screens-ops.js` 2408, `screens-core.js` 1647, `i18n.js` 1618, `data.js` 184, `theme.js` 31 |
| CSS | **~2.043 líneas** — `screens.css` 1193, `styles.css` 850 |
| Framework casero | 62 `innerHTML` + 186 `addEventListener`, patrón `render()`/`wire()` |
| Build step | **Ninguno** — `<script src>` globales en `index.html`, sin módulos ES, sin bundler |
| Tests de frontend | **Cero** — los 13 de `src/dashboard/__tests__/` son de handlers/API |
| Tokens de diseño | **30 CSS vars** ya definidas (`--bg`, `--surface`, `--accent`, `--radius`, …) |
| Bun | 1.3.14 — **transpila TSX nativo y tiene bundler propio** |

### Stack elegido

**React 19 + TypeScript + Tailwind v4 + shadcn/ui (sobre Radix), bundleado con `bun build`.**

**No Vite, no Rollup, no webpack, no esbuild.** El punto no obvio que abarata toda la migración:
Bun 1.3.14 ya hace TSX nativo y bundlea. El build es una línea, en el runtime que el repo ya usa.
Tailwind v4 entra por `bun-plugin-tailwind` dentro del mismo `Bun.build()`.

### Costos reales — declarados ANTES, no descubiertos después

1. **Aparece un build step donde hoy no hay ninguno.** Hoy: editar `.js` → recargar. Después:
   `bun run build:ui` (o watch). Toca el flujo de desarrollo y probablemente `scripts/pre-commit.sh`.
   Es el precio real de la decisión y no es negociable.
   **Decisión de Carlos (2026-08-22): el bundle NO se commitea.** `src/dashboard/public/dist/`
   (ruta corregida al implementar UI.0 el 2026-08-25: la carpeta `public/` de la raíz no existe)
   va a `.gitignore` — versionar un artefacto generado es exactamente el patrón que ya explotó con
   `runs-summary.json` (conflictos de contenido en cada rebase, documentado en `pre-commit.sh`).
   Consecuencia obligatoria, no opcional: `install.sh`/`install.ps1`/`install.bat` y el README
   deben correr `build:ui`, o un clone fresco sirve un dashboard roto. Es entregable de `UI.0`.
2. **Coverage gate — el costo se midió y NO existe.** (Corregido 2026-08-22; la versión anterior
   de esta línea afirmaba que los umbrales miden `src/**/*.ts` y que "meter `.tsx` mueve el
   número". **Las dos mitades eran falsas.**) `scripts/check-coverage.ts` no tiene ningún filtro
   include/exclude y `bunfig.toml` solo declara `coverage = true`: Bun instrumenta **solo lo que
   los tests importan**. Verificado empíricamente — los ~8.500 líneas de `.js` en `public/` **no
   aparecen** en el reporte de cobertura hoy. Los `.tsx` tampoco lo harán mientras ningún test los
   importe. **Decisión de Carlos (2026-08-22): el Sprint 30 NO introduce tests de frontend** — se
   mantiene el estándar actual de verificación en vivo con navegador real
   (`feedback-verificar-gates-en-vivo`). Por lo tanto el ratchet **no se toca y no se recalibra**.
   Si algún Mes futuro agrega tests de componentes, ahí —y solo ahí— reaparece la decisión de
   aislarlos, calibrando **contra el log de CI, nunca contra el Mac** (regla "Verificar contra CI"
   en CLAUDE.md y `reference-ci-host-environment-drift`).
3. **i18n NO se migra, pero SÍ hay que puentearlo.** 223 llamadas a `t()` solo en `app.js`,
   sistema propio con `window.t`. React sigue llamando `window.t()`. Migrar i18n está **fuera de
   alcance de todo el Sprint 30**. **Lo que el plan daba por trivial y no lo es** (verificado
   2026-08-22): `setLang()` solo escribe en `localStorage` y el llamador hace `App.rerender()`
   (`screens-ops.js:1937-1938`), que repinta el DOM vanilla — **React no se entera**, y sus islas
   se quedan con el idioma viejo hasta desmontarse. `t()` lee el idioma en cada llamada, no hay
   estado reactivo del que React pueda colgarse. Decidir el puente en `UI.0` (contexto React con
   listener, o remount forzado de las islas desde `App.rerender()`), **no descubrirlo a mitad de
   UI.3**.
4. **Las 4 reglas de diseño de v0.12** se verifican una por una contra Radix, en vivo. Radix las
   resuelve — pero eso **se comprueba, no se asume** (regla cero de CLAUDE.md: nada se entrega sin
   verificar contra el dashboard real corriendo, no mocks).
5. **11 pantallas.** No es un fin de semana. Carlos asume ese costo explícitamente (2026-08-18).

**Un costo que el plan asumía y NO existe** (verificado 2026-08-22): servir el bundle **no
requiere tocar `server.ts` ni `http.ts`**. `STATIC_DIR` es `./public` (`types.ts:437`) y
`serveStatic()` sirve cualquier ruta bajo ese árbol con el guard de path traversal ya resuelto
(`http.ts:23-46`) — un `public/dist/bundle.js` queda servido solo, sin código nuevo. Esto mantiene
intacta la regla "no tocar nada de `src/dashboard/*.ts` que no sea servir el bundle": resulta que
ni eso hace falta.

### Ítems

- [x] **UI.0 — 🧠 Andamiaje (ninguna pantalla migrada).** (cerrado 2026-08-25) → [evidencia](docs/done/sprint-30.md#sprint-30-ui-0)

- [x] **UI.1 — 🔍 GATE DE ABORTAR: el combobox de modelo.** (cerrado 2026-08-28) → [evidencia](docs/done/sprint-30.md#sprint-30-ui-1)

- [x] **UI.1b — 🔍 Cerrar la brecha de evidencia de UI.1: los 2 call sites que faltaban.** → [evidencia](docs/done/sprint-30.md#sprint-30-ui-1b)

- [x] **UI.2 — 🧠 Design system: los 6 componentes que se repiten.** (cerrado 2026-08-28) → [evidencia](docs/done/sprint-30.md#sprint-30-ui-2)

- [x] **UI.3 — 🧠 Shell: sidebar + header + rightpanel + search.** (cerrado 2026-08-28) → [evidencia](docs/done/sprint-30.md#sprint-30-ui-3)

- [x] **CI.1 — 🔍 Mutation Shards en rojo: no era mutación, era el esquema de la DB.** → [evidencia](docs/done/sprint-30.md#sprint-30-ci-1)

- [ ] **UI.3.5 — 🧠 Sistema visual: que se sienta herramienta, no panel de administración.**
  (EN CURSO, abierto 2026-08-30 — decidido en sesión previa con Opus, retomado y confirmado
  aquí). **Pausa `UI.4`**: las 9 pantallas que faltan no se migran con paridad al look viejo
  para no tocarlas dos veces — nacen ya con el sistema nuevo cuando les toque.

  **Motivo, con Carlos preguntando directo:** "cuando dije cambiar la apariencia no era solo
  usar React sino que el dashboard se sienta como herramienta" — comparando con Claude Code,
  Codex, Orca, Hermes. Medido en el CSS, no opinado: 15 tamaños de fuente + 86 `font-size`
  inline (vs. 4–5 en una herramienta real), 10 radios de borde distintos, 253 `style="..."`
  inline, 33 `.card` (cada cosa en su caja). Eso es lo que lee como "panel de administración":
  no hay sistema, hay 253 excepciones.

  **Decisión (confirmada por Carlos, dos preguntas cerradas):**
  1. El sistema visual entra **ahora**, en una sola pasada — no se migran las 9 pantallas
     restantes con el look viejo para reajustarlas después.
  2. **UI.6** (capas de proyectos/carpetas, sidebar Chat|Code) se queda donde está en el
     roadmap; no se adelanta.
  3. El **carril de estado** (glifo + peso tipográfico en vez de badges de color) — confirmado
     como la pieza más visible del cambio.

  **Qué NO se toca:** los hex base y los 4 temas existentes. El problema medido no es la
  paleta (`#0d1117` + acento azul ya es la familia correcta, tipo GitHub Dark/Zed) sino cómo
  se usa — decorativa en vez de señal.

  **Tokens nuevos:**
  - Tipografía: de 15 tamaños a 5 (`11·12·13·15·19`, 13 = cuerpo, 19 = título de pantalla).
    Regla de reparto explícita: mono para todo dato (id, modelo, costo, fecha, ruta), sans solo
    para prosa y labels — hoy están mezclados sin criterio.
  - Radios: de 10 a 2 (4px controles, 8px contenedores). `999px` sobrevive solo para el pill
    de estado del header — único elemento que debe leerse como pill.
  - Color = señal, nunca decoración: reservado a error, en-ejecución, y acción primaria. Todo
    lo demás vive en la escala de grises.
  - Densidad: altura de fila fija y compacta; muere `.card` como contenedor por defecto — la
    jerarquía pasa a hacerse con línea de 1px + espaciado, no caja con borde+fondo+sombra.
  - Acciones que no compiten: en cards, los botones aparecen en hover (o en menú `⋯` para la
    acción destructiva), no los 5 siempre visibles que tiene `skills` hoy.
  - **Carril de estado** en vez de badges de colores en filas de tabla/lista: un glifo (`●`
    `✗` `○`) + peso tipográfico mono, separador de 1px sin caja. Ej.: `● spec-activa-1  draft
    ok` en vez de `[draft][PASS] sí` con 4 badges de color.

  **Alcance de esta pasada:** tokens en `ui.css`, componentes de `UI.2` reajustados, el shell
  de `UI.3`, y `specs`+`skills` (ya son React — barato reajustarlos). Matar los `style=` inline
  ya introducidos en ese React. **Fuera de alcance, explícito:** las 9 pantallas de `UI.4` que
  faltan (nacen con el sistema nuevo al migrarse) y `UI.6`.

  **Gate, invertido respecto del resto de la migración:** los gates existentes de
  `specs`/`skills` miden *paridad* contra el vanilla — hay que reescribirlos para que midan que
  el look **cambió** de forma consistente: 5 tamaños de fuente, 2 radios, cero `style=` inline
  en el React tocado, carril de estado presente donde antes había badges.

  **Progreso (2026-08-30):**
  - [x] Tokens en `ui.css`/`styles.css`: `--fs-1..5` (11/12/13/15/19), `--radius` 6→4,
    `--radius-lg` 8, `--radius-pill` 999px (única sobreviviente del pill de estado del
    header). Utilidades `.fs-1..5` para reemplazar `font-size` inline en React.
  - [x] **Carril de estado** en `SpecsScreen.tsx`: fusiona las columnas Estado+Lint en una
    (`● draft ok` / `✗ approved 3 findings` / `○ archived —`), clase `.status-rail` nueva en
    `styles.css`. `.badge` no se toca: lo siguen usando las 9 pantallas sin migrar.
    **Gate en vivo:** navegador real (Playwright) contra el dashboard corriendo en :4325 —
    capturas confirman el carril sin la línea de `border-left` que traía por colisión de
    nombre con `.detail` (el span interno se renombró a `.rail-detail` tras verlo en pantalla;
    `.detail` ya era una clase global del panel expandible).
  - [x] **Acciones que no compiten** en `SkillsScreen.tsx`: `.skill-card-actions` pasa a
    `opacity:0` con reveal en `:hover`/`:focus-within` (sin cambiar alto, sin salto de layout).
    **Gate en vivo:** navegador real (Playwright) — captura sin hover no muestra los 5 botones,
    captura con hover sí.
  - [x] `bunx tsc --noEmit` ✅ · `bun run test:coverage` ✅ (1174 pass / 0 fail, ratchet sin
    mover).
  - [ ] Pendiente de esta pasada: barrido de `font-size`/`border-radius` en el resto de
    `styles.css`/`screens.css` (vanilla compartido, ~80 sitios — se hará agrupado por pantalla
    para poder verificar en vivo cada tanda, no en un sólo sed masivo); reajuste de
    `Button`/`Input`/`Combobox`/`Dialog`/`Toast`/`Tabs` (`UI.2`) a los tokens nuevos; el shell
    (`UI.3`); reescribir `ui4-specs-screen.mjs`/`ui4-skills-screen.mjs` para medir el look
    nuevo en vez de paridad contra vanilla (quedaron en rojo en las 2 aserciones de paridad de
    columnas/badges — esperado, hay que reemplazarlas, no arreglarlas).

- [ ] **UI.4 — 🧠 Pantallas, en orden de valor.** (PAUSADO por `UI.3.5` — 2 de 11 migradas con
  el look viejo: `specs` ✅ `skills` ✅. Al retomar, reciben el sistema nuevo de `UI.3.5`; las 9
  que faltan nacen ya con él.)
  **Recolocado 2026-09-02 (UI.8):** las 9 pantallas restantes **no se migran hasta que exista el
  gate de `UI.8.1` y esté hecho `UI.8.3`**. Motivo medido: sin el gate, cada pantalla nueva
  reproduce el problema de UI.3.5 (tokens definidos, 4.5% de adopción); y migrarlas antes de
  `UI.8.3` las hace nacer dentro de la navegación que el documento de dirección declara
  anti-patrón.

  **Progreso**
  - [x] **`specs`** (2026-08-30) — la primera. **Gate en vivo:** navegador real (Playwright),
    **21/21 PASS** (`scripts/ui-gates/ui4-specs-screen.mjs`); `tsc` ✅; `test:coverage` ✅
    (1174 pass / 0 fail); sin regresión en los 4 gates anteriores (27+32+19+9, todos verdes).
  - [x] **`skills`** (2026-08-30) — **implementada por Codex, gate escrito por Claude en
    paralelo y sin ver su código** (roles invertidos respecto de UI.3, donde fue al revés).
    **Gate en vivo:** navegador real (Playwright), **22/22 PASS**
    (`scripts/ui-gates/ui4-skills-screen.mjs`); `tsc` ✅; `test:coverage` ✅; los 6 gates del
    mes en verde.
    Ejercita lo que `specs` no tenía: layout de cards en vez de tabla, confirmación de borrado
    **inline** dentro de la card (no un modal) y una segunda sección con las skills "pro"
    importables. Codex resolvió bien el punto delicado por su cuenta: `useState` **solo** para
    estado efímero de interacción (qué card pide confirmación, "copiado", botón ocupado) y los
    datos siempre desde `window.state` — que es exactamente la frontera correcta.
    **Lo que hubo que corregirle:** dejó las 260 líneas del render/wire viejos **comentadas**
    en vez de borrarlas. Es el código muerto que `UI.5` tendría que limpiar, y peor: código
    comentado que parece vigente y vuelve intocable el archivo. Se borraron; el historial de
    git ya las conserva.
    **Y tres fallos seguidos del gate, todos por lo mismo** — el elemento de referencia no era
    equivalente: primero comparó badges contra Runs (que solo tiene `.badge` pill, 999px),
    después contra Tasks (cuyo primer `.badge.square` lleva un `font-size` **inline** propio de
    esa fila). Se resolvió con la técnica del gate de UI.2: **crear un elemento limpio con las
    mismas clases** en vez de buscar uno existente. Es la forma robusta de medir paridad y
    conviene usarla desde el principio en las 9 pantallas que faltan.
  - [ ] `chat`, `tasks`, `runs`, `graph`, `settings`, y las de Observabilidad.

  **El mecanismo que hizo falta inventar acá, y que usan las 10 que faltan.** Una pantalla no
  se puede migrar como se migró el combobox. `App.rerender()` hace `main.innerHTML = …`, así
  que el registro de islas remontaría la pantalla entera **en cada poll de 30s**: se perderían
  el scroll de la tabla, la fila abierta y cualquier input a medio escribir. En un combo no se
  nota; en una pantalla la vuelve inusable. Solución: un flag `react: true` en el objeto de
  `SCREENS`. Para esas pantallas `rerender()` cambia de significado — ya no es "repintá el
  DOM" sino **"avisale a React que el estado cambió"**: el contenedor se escribe una sola vez
  al entrar y después se deja quieto. El gate lo verifica marcando el nodo del DOM y
  comprobando que la marca sobrevive al repintado.

  **El estado NO se copia a React** (`lib/app-state.ts`). Una pantalla lee cualquier cosa de
  `state` —`specs`, `specsStatus`, `openSpec`, `archOpen`, `bulkSelected`— y cada una un
  subconjunto distinto: enumerarlos en un store tipado sería mantener once copias del estado
  que ya existe. El componente lee `window.state` directamente, igual que hacía el `render(st)`
  al que reemplaza, y `useAppVersion()` solo le avisa cuándo releer. El acoplamiento es
  deliberado y temporal: mientras `app.js` sea el dueño de los fetch, duplicar los datos crea
  dos fuentes de verdad. Se invierte en `UI.5`.

  **Cómo se mide "no cambió el aspecto", ahora que no hay código viejo con qué comparar:** el
  gate compara el estilo computado de la tabla de Specs (React) contra la de **Runs, que sigue
  100% en vanilla** y usa las mismas clases. Padding, tipografía y borde dan idénticos. Cuando
  Runs se migre habrá que mover esa referencia a otra pantalla que siga en vanilla.

  **Dos hallazgos de la primera pasada:**
  1. **Un crash real, preexistente, que la migración expuso.** El handler de `lint` hacía
     `if (d.findings && d.findings.length === 0) … else d.findings.length` — o sea, una
     respuesta SIN `findings` (un 404, un error del servidor) caía al `else` y explotaba con
     *"Cannot read properties of undefined"*. Estaba igual en el vanilla. Se vio al correr el
     gate contra una spec inexistente. Arreglado con una guarda: un error de la API sale como
     aviso, no como crash. **No es rediseño** — un crash no es una funcionalidad que preservar.
  2. **Dos fallos del gate, no del código** (mismo patrón que en UI.3, y conviene reconocerlo
     rápido): la paridad visual comparaba contra **Skills, que no usa tabla** —su layout es de
     cards—, así que no medía nada; y el chequeo de "las activas no llevan checkbox" usaba el
     índice de card equivocado y medía justamente la tabla que sí debe llevarlo.

  **Refactor sin cambio de comportamiento:** `bulkDelete()` estaba inline dentro del listener
  de `wireBulkSelect()`; se extrajo tal cual para que las pantallas React lo invoquen sin
  duplicar la lógica ni el copy de confirmación.

  `specs` y `skills` primero (las más chicas — validan el patrón de migración de pantalla completa),
  después `chat` (la home, mayor valor visual), `tasks`, `runs`, `graph`, y `settings` al final
  (la más grande, ~900 líneas).
  **Una pantalla = un commit = verificación en vivo.** Sin acumular (regla de cadencia de commits).
  **Migrar ≠ rediseñar**: primero paridad funcional, las mejoras visuales vienen después.

- [ ] **UI.5 — 🧠 Limpieza.**
  Borrar el `render()`/`wire()` muerto; `screens.css`/`styles.css` reducidos a tokens;
  `index.html` con un solo `<script>`.

- [ ] **UI.6 — 🧠 Dos profundidades, una sola realidad: Chat | Workspace (backend ya listo por CC.2/CC.3).**
  Absorbida desde el Sprint 29 el 2026-08-18: CC.2 y CC.3 entregan schema + endpoints + tests, y toda
  su superficie visual se construye acá, en React, **nunca en vanilla**.
  Sidebar izquierdo: **Chat | Workspace** arriba (shadcn `Tabs`), y debajo el árbol de proyectos
  como carpetas colapsables (shadcn `Collapsible`/`Sidebar`) con sus sesiones. En `Workspace` se
  ven los proyectos con sus agentes; en `Chat` se ven las conversaciones — incluidas las
  "generales" (`project_id NULL`). Se reemplaza el nombre previo `Code`: OrchestOS no se limita a
  proyectos de software. Cada sesión muestra su agente (inmutable) y su modo (mutable).
  El picker de agente de CC.D2 se reconstruye acá apuntando a `PATCH /api/chat/sessions/:id`,
  ya no a `PUT /api/config`.

  **Dirección confirmada por Carlos (2026-09-02):** Chat es la entrada por defecto para usuario
  normal; Workspace es la profundidad operativa para trabajo serio. Ambos representan los mismos
  chats, proyectos, tareas y runs — nunca se duplican ni se migran entre dos productos. Cuando
  una conversación genera trabajo persistente, `Ver espacio de trabajo` abre el proyecto, agente
  y ejecución de origen. La fuente completa de investigación, reglas de componentes, seguridad y
  criterios de aceptación es `docs/dashboard-experience-direction.md`.
  **Fuera de scope declarado:** `.orchestos/feature-status.json` se regenera automáticamente desde
  `PLAN.md` por el pre-commit; no es una edición manual ni un cambio de producto adicional.

- [ ] **UI.7 — 🧠 Navegación progresiva: muere "modo avanzado".**
  Absorbe el ex-CC.4 y el ex-BB.3. Elimina `navModeBtn` y el flag
  `localStorage['orchestos-mode']` (`app.js:1593`, `2263`, `2286-2337`) — el eje deja de ser un
  modo etiquetado y pasa a ser profundidad contextual: Chat | Workspace.
  Observabilidad no compite como navegación primaria: Tasks, Runs, Graph, Specs, Skills, Memory e
  Instincts aparecen dentro del proyecto, agente o ejecución pertinente. `Activity` queda como la
  única vista transversal explícita para cruzar proyectos. Settings conserva sólo configuración
  global; Project/Memory/Instincts no se esconden allí si pertenecen a una entidad seleccionada.
  El inspector derecho pasa de riel siempre presente a detalle condicional de la entidad elegida.
  `SCREENS.runner` se borra (deuda CC.0-D5).
  **Gate 🔍 en vivo**: es el equivalente visual de CC.5 — dos proyectos, una sesión por proyecto,
  cada una con un CLI distinto, verificado con navegador real.

### UI.8 — El cambio real: mecanismo, datos y anatomía (ABIERTO 2026-09-02)

> **Origen: auditoría crítica pedida por Carlos el 2026-09-02**, con su veredicto textual:
> *"el cambio que está en UI no hay cambio real, OrchestOS sigue viéndose igual"* y *"si le
> estamos haciendo ya meses a esto, no solo que trabaje bien, también que se vea excelente"*.
>
> **Por qué UI.3.5 no produjo cambio visible — medido, no opinado (2026-09-02):**
>
> | UI.3.5 declaró | Medido hoy en `styles.css` + `screens.css` + los 3 `.js` |
> | --- | --- |
> | "de 15 tamaños de fuente a 5" | **8** usos de `var(--fs-*)` vs **~168** `font-size` hardcodeados → **4.5% de adopción**; siguen vivos `12.5px`, `11.5px`, `13.5px`, `10.5px`, `14.5px`, `0.84em` |
> | "de 10 radios a 2" | **15** valores distintos de `border-radius` (45 usos de token vs 52 crudos) |
> | "253 `style=` inline" como diagnóstico | **270** hoy (app.js 119 · screens-ops.js 80 · screens-core.js 54) — **subió 17** |
> | "muere `.card` como contenedor" | **33** usos, el mismo número del diagnóstico original |
>
> **Causa raíz, y no es de diseño:** UI.3.5 exigía textualmente un *gate invertido* que midiera
> que el look **cambió**. Nunca se escribió — `scripts/ui-gates/` va de `ui0` a `ui4`, no existe
> `ui35-*`. Es la Regla Cero de `CLAUDE.md` en su forma más pura: *una regla escrita que nadie
> hace cumplir mecánicamente deja de existir en la práctica*. Agregar más dirección visual sin
> ese gate reproduce el mismo resultado con más páginas de documento.
>
> **Segundo hallazgo, que convierte UI.6/UI.7 en trabajo de backend antes que de interfaz.** El
> documento de dirección afirma *"el chat, la tarea, el run y el proyecto son los mismos
> objetos"*. El schema no lo sostiene:
> - `runs.project_id TEXT` **sin FOREIGN KEY** (`src/db/migrate.ts:197-217`), mientras
>   `context_chunks` sí la tiene (línea 194). Un run puede apuntar a un proyecto inexistente.
> - `projects.id` es `TEXT PRIMARY KEY` (181) pero `files.project_id` (221) y
>   `code_edges.project_id` (233) son `INTEGER NOT NULL`, sin FK. Y
>   `src/graph/index.ts:172,180` (`upsertFile(projectId: string, …)`) **inserta un string en esa
>   columna INTEGER**: funciona sólo por la tipificación laxa de SQLite; el schema declarado
>   miente sobre lo que guarda. UI.7 exige "Graph dentro del proyecto" — ese join no está
>   garantizado.
> - **No existe entidad `agents`.** El groupbox de agente que la dirección pide no tiene de dónde
>   leer estado propio.
>
> **Carlos autorizó explícitamente el trabajo de backend (2026-09-02):** *"si por hacer esto toca
> agregar código en el back, pues que así sea"*.
>
> **Conflicto de decisiones resuelto.** `index.html:35-42` documenta el panel derecho como
> *"SIEMPRE presente… el toggle nunca cambia de posición"* — corrección de Carlos del 2026-07-13,
> ronda 4. La dirección del 2026-09-02 lo prohíbe (*"inspector condicional… no existe como riel
> vacío permanente"*). Carlos zanjó el 2026-09-02: *"el rumbo que quiero llevar es el mencionado,
> no el anterior"*. **Gana el inspector condicional; la decisión del 2026-07-13 queda revertida**
> — se conserva escrita, no se borra (memoria evolutiva).
>
> **Anatomía concreta: `docs/ui-reference-patterns.md`** (nuevo, 2026-09-02). Extraída de las
> capturas que Carlos tomó de Orca y Lightdash (`~/Documents/screens/`, fuera del repo por peso) y
> del README de `pi-agent-dashboard`. Ningún ítem de abajo se diseña por intuición: la anatomía ya
> está escrita ahí y se cita por sección.

- [ ] **UI.8.1 — ⚡ El gate visual, y Playwright como dependencia real.**
  Va **primero**: sin esto, todo lo demás se evapora igual que UI.3.5.
  `scripts/ui-gates/ui35-visual-system.mjs`, contra el dashboard real, falla si:
  - hay más de **5** valores distintos de `font-size` computado en la pantalla auditada;
  - hay más de **2** valores distintos de `border-radius` (más el pill del header);
  - queda un `<select>` nativo donde corresponde `Combobox` o chips;
  - el conteo de `style=` inline **subió** respecto del commit anterior — **trinquete, sólo baja**,
    mismo mecanismo que `scripts/check-coverage.ts`.
  Además: instalar Playwright como dependencia real de gates. Hoy los 7 gates existentes dicen
  *"Playwright no está en devDependencies, es un gate manual: cd \<dir con playwright\>"* — y no
  está instalado en esta máquina, así que **ninguno corre solo**. Ése es el mecanismo que faltó.
  Gate 🔍: correr el gate nuevo contra el dashboard real y verlo **fallar** con el CSS de hoy
  (si pasa a la primera, el gate está mal escrito). Bajar el servidor al terminar.

- [ ] **UI.8.2 — 🧠 Integridad de datos: una sola fuente de verdad, de verdad.**
  Backend, autorizado explícitamente. Habilita todo lo visual que viene después.
  - `FOREIGN KEY` de `runs.project_id` → `projects(id)`.
  - Unificar `project_id` a `TEXT` en `files` y `code_edges`, con FK real (hoy `INTEGER` sin FK,
    recibiendo strings).
  - Decidir y ejecutar: **`agents` como tabla propia** o proyección derivada de sesiones/tareas.
    Sin esta decisión el groupbox de A.2 no tiene fuente.
  Gate: `bun run db:migrate` sobre una DB preexistente **sin pérdida de datos** (mismo patrón de
  evidencia que H.5.2, con registro centinela) + `bun run test:coverage`.

- [ ] **UI.8.3 — 🧠 Matar la navegación vieja (absorbe UI.7, sube antes de UI.4).**
  Se adelanta a propósito: con el orden anterior, las 9 pantallas de UI.4 se migrarían **dentro**
  de la navegación que el propio documento de dirección declara anti-patrón.
  - Rail de 3 zonas según `ui-reference-patterns.md` §A.1: `Chat` · `Activity` arriba, árbol de
    proyectos en el medio, `Settings` abajo. Las 7 capacidades restantes
    (`tasks`, `runs`, `graph`, `memory`, `specs`, `skills`, `instincts`) pasan a tabs de la
    entidad seleccionada.
  - Borrar el modo avanzado en `app.js:512, 1922, 2733-2735` **y también en
    `Sidebar.tsx:43, 92`** — la migración a React copió el toggle que la dirección prohíbe, y hoy
    cada pantalla nueva lo hereda.
  - `SCREENS.runner` se borra (deuda CC.0-D5).
  Gate 🔍 en vivo: dos proyectos, una sesión por proyecto con CLIs distintos, navegador real.

- [ ] **UI.8.4 — 🧠 Shell Chat | Workspace (absorbe UI.6).**
  Inspector **condicional** (0px cerrado, no riel), con ancho persistido y una sola fuente de
  selección en el estado del shell. Árbol de proyectos con agentes como filas colapsables
  (§A.2), selección como único contenedor con borde (§A.3), anomalías inline (§A.4).
  **Contrato de la transición Chat → Workspace**, que hoy no está definido:
  1. Si la conversación **no** generó trabajo persistente, la acción **no aparece** (no aparece
     deshabilitada — un botón que a veces no lleva a ningún lado es el "botón que no hace nada"
     de la Regla Cero).
  2. Si lo generó: abre **proyecto + entidad de origen ya seleccionada**, misma pestaña, con el
     chat conservado y accesible en un gesto de vuelta.
  Gate 🔍 en vivo con los dos casos de (1) y (2).

- [ ] **UI.8.5 — 🧠 Composición visual: barra de estado, Settings y controles.**
  Recién acá entra "que se vea excelente", y con la anatomía ya escrita:
  - **Barra de estado inferior permanente** (§A.5): `% de contexto + tiempo de sesión` a la
    izquierda, avisos al centro, recursos a la derecha. **Es la superficie que `H.7.5` necesita**
    — el % de contexto no va en una card del home. Resuelve también dónde vive el costo en Chat.
  - **Settings agrupado por alcance** (§B.1): `Global` · `Proyecto` · `Agente`, con la anatomía de
    fila de §A.9 (label + descripción de una línea + control a la derecha, sin divisores).
    Corrige el reclamo textual de Carlos: *"Settings no parece usable, hay cosas que hay que
    desaparecer o darles sentido"*.
  - **Selector de agente como chips con icono** (§A.10), no `<select>`; `Combobox` se reserva para
    listas largas (`reference-model-combo-pattern`).
  - **Barra de uso de contexto** en la fila de sesión (§C.2).
  Gate 🔍: el de UI.8.1 en verde sobre estas pantallas, más navegador real.

- [ ] **UI.8.6 — 🧠 Permisos visibles (`INS-2026-014`).**
  Hoy **no existe** mecanismo de aprobación en el chat: el harness invoca los CLIs en modo no
  interactivo por diseño (`codex exec --sandbox workspace-write` en `src/run/executors/codex.ts`,
  equivalente en `external.ts`). El documento de dirección lo exige y sin este ítem queda como
  prosa incumplible — el mismo patrón que dejó a UI.3.5 sin efecto.
  Modelo tomado de Orca (§A.6, §A.11): tira permanente de una línea sobre el compositor
  declarando el estado real, más un segmented control honesto `Yolo | Manual` en Settings del
  agente. No un modal que se acepta una vez y se olvida.

**Decisiones pendientes de Carlos dentro de UI.8** (no las toma ningún LLM):
1. `agents` como tabla propia o proyección derivada (UI.8.2).
2. Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no.
3. Si UI.8.6 entra en este bloque o sale como bloque propio con backend separado.

### Fuera de alcance del Sprint 30 (explícito)

- Migrar i18n a una librería (el **puente** de `UI.0` sí entra; la librería no).
- Tocar handlers, endpoints o cualquier cosa de `src/dashboard/*.ts` — verificado el 2026-08-22:
  ni siquiera hace falta para servir el bundle.
- Cambiar navegación, rutas o comportamiento funcional durante la **migración** (`UI.0`–`UI.6`) —
  esa parte es puramente visual/estructural.
  **Excepción única y explícita: `UI.7`** (resuelto 2026-08-22 — el plan se contradecía a sí
  mismo: prohibía cambiar navegación y a la vez incluía un ítem titulado "Navegación nueva", que
  borra `SCREENS.runner`, elimina el flag `localStorage['orchestos-mode']` y mueve
  Memory/Instincts/Project dentro de Settings). `UI.7` es el **único** ítem autorizado a cambiar
  navegación y comportamiento, corre **al final** y absorbe los veredictos ya decididos en CC.0 y
  el ex-CC.4. Ningún otro ítem toca navegación: si aparece la tentación durante `UI.0`–`UI.6`, se
  anota para `UI.7` y se sigue.
- Rediseñar pantallas mientras se migran.

### Riesgo principal

No es React. Es que **a mitad de camino queden dos sistemas conviviendo indefinidamente.**
Por eso UI.1 es un gate de abortar real, y por eso el orden es shell→pantallas y no al revés.

---

## SPRINT 29 — Que "OrchestOS" deje de quedarle grande al sistema (abierto 2026-08-16, cerrado 2026-08-21) → [Sprint 29](docs/done/sprint-29.md)

Eje de Carlos: "para llamarlo orquestador debería poder abrir varios chats, cada uno con el CLI de
mi gusto, para varios proyectos — hoy solo funciona para 1". Diagnóstico verificado en código, no
opinión. CC.0 (auditoría de 11 tabs, veredictos vive/va-a-settings/se-borra). CC.1/CC.1b/CC.1c
(chat corre por el CLI elegido, no solo por API — 5 niveles reales de esfuerzo). CC.D1-D4
(`executor_mode`+`executorEngine` → un solo campo `agent`, guiado por el Agent Client Protocol de
Zed; picker de agente en el chat, 8 pasadas hasta el diseño final; nombres de modelo legibles;
gate en vivo con Playwright). CC.2/CC.2a/CC.3 (sesiones de chat persistentes por proyecto +
multi-proyecto real backend-puro — mata los 10 `resolve('.')`). **CC.5** (gate final: dos
proyectos reales, cada uno sobre un CLI distinto, verificado por API contra la SQLite real —
encontró y arregló 2 bugs de producto en el camino: resolución del path del CLI desde la
instalación en vez del proyecto orquestado, y una condición de carrera en `graph-runner.ts` que
hacía fallar SIEMPRE la segunda tarea de cualquier grafo). **CC.1-D1** (Carlos corrigió el diseño:
el 422 que bloqueaba chat con codex/opencode era una restricción de implementación no pedida — se
abrió a los tres CLIs, con la frontera de lectura/escritura puesta por el flag real de cada
binario, verificado en vivo incluso contra un prompt adversarial). **CC.0-D6** (evidencia de gates
en vivo ya no se pierde con el tmpdir — `bun run gate:evidence` la copia a la DB real marcada
`task_class=gate:*`). Detalle completo, evidencia y las 8 pasadas de CC.D2 → [Sprint 29](docs/done/sprint-29.md).

---

## SPRINT 28 — Backlog canónico, categoría Medio (abierto 2026-08-15, cerrado 2026-08-18) → [Sprint 28](docs/done/sprint-28.md)

Bloque BB (2026-08-16): un solo selector real de "cómo corre OrchestOS" (`executor_mode` unificado,
5 motores, artefactos del host filtrados, comparación medida de los 3 CLIs). Bloque AA: IDEAS `#6`
graduada (`design.md` condicional vía OpenSpec, con gate CLI+dashboard). **11/11 ítems cerrados** —
BB.6 (costo ficticio de `codex`) quedó abierto del 16 al 18 y se cerró con un guard antes del
spawn, sin fabricar el número ni tocar schema. La categoría Medio de IDEAS.md NO se agotó a
propósito (decisión de Carlos: idea por idea, no toda la categoría de una vez). Detalle completo,
diagnóstico de BB.6 y evidencia de los 11 ítems → [Sprint 28](docs/done/sprint-28.md).

---

## SPRINT 27 — Backlog canónico, categoría Bajo-medio (X–Z)

- [x] **SÍ — Sprint 27 cerrado (2026-08-13), parcial por diseño**
  Categoría **Bajo-medio** del backlog canónico: `#33` (Bloque X, refuter en el QA loop —
  segunda opinión barata que revierte falsos-negativos del juez antes de quemar un retry, mirror
  asimétrico de K.4b) y `#37` (Bloque Y, badge "Free" + preset "empezar gratis" para modelos
  `:free` de OpenRouter) cerrados completos. `#51` (Bloque Z, acciones por mensaje en el chat)
  cerrado **parcial a propósito**: copiar + timestamp implementados, "rebobinar" queda fuera
  porque la propia idea lo liga a `#50` (sesiones persistentes en SQLite, sin implementar) —
  rebobinar una conversación que solo vive en memoria JS no tiene el mismo sentido. `#4` y `#30`
  verificados y saltados antes de tocar código: ninguno cumple el gate de evidencia que su propio
  texto en IDEAS.md exige. Un bug real no pedido encontrado y arreglado al verificar Y en vivo: la
  selección de rol en Settings → Model routing se revertía en silencio (rerender post-selección
  recalculaba desde el config del servidor, no desde la elección recién hecha). 1122 tests · 0
  fail · `tsc --noEmit` limpio · `bun run test:coverage` verde en cada cierre.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 26 — Backlog canónico, categoría Bajo (Q–W)

- [x] **SÍ — Sprint 26 cerrado (2026-08-08)**
  Categoría **Bajo** completa del backlog canónico de IDEAS.md, 7 ideas (Q `#2` verification-before-completion, R `#3` requesting/receiving-code-review, S `#5` Ruby resolver, T `#19` symlink de node_modules en worktrees, U `#40` Guardar/Limpiar en Constitution, V `#46` spike de Graphify, W `#58` tool-policy.ts dead code). Tres de los siete destaparon bugs reales no pedidos al verificar antes de escribir contenido: **S** — `indexProject()` perdía todo edge cross-file en un pase único (universal, no solo Rust/C#, desde S21) más 2 bugs de resolver, arreglado antes de agregar Ruby (0% → 100% de resolución en los 5 lenguajes); **T** — el symlink de `node_modules` en worktrees se colaba al commit real sin un pathspec de exclusión (`.gitignore` con slash no matchea un symlink); **U** — quitar el autosave de Constitution expuso una pérdida de datos silenciosa contra el poll de 30s del dashboard (guard por foco no cubría el nuevo flujo de botones). **V** fue spike puro: Graphify instalado, comparado, revertido byte a byte — no se adopta el binario (dependencia de runtime de una startup en pivot a SaaS), se roban 2 patrones como IDEAS #59/#60. **W** decidido por Carlos explícitamente: borrar en vez de cablear. 1111 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` verde en cada cierre.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 25 — Pendientes heredados de los cierres 22–24 + backlog canónico (N, O, P)

- [x] **SÍ — Sprint 25 cerrado (2026-08-06)**
  Cerró los pendientes heredados de Sprint 22-24 (K.6.2-R7, L.5.7, L.6.2, M ×2) y abrió la ejecución del backlog canónico por esfuerzo de IDEAS.md (regla desde 2026-07-30: el orden de IDEAS.md es el único orden de ejecución). Tres bloques completos: **N** — endurecimiento de skills (Iron Law/Common Rationalizations/Red Flags) portado a `buildSections()`/al ejecutor propio (N.4.5, hallazgo real: el endurecimiento llegaba a Claude Code/Cursor pero nunca al runner de OrchestOS) y auditado contra las fuentes reales (`obra/superpowers`, `mattpocock/skills`) skill por skill, no por nombre — match nominal ≠ match semántico fue el hallazgo de método (N.7b/N.7c). **O** — las skills se activan solas: contrato de activación (`activation.mode/phases/triggers`, O.0), skills resueltas desde la instalación no desde `cwd` (O.1), el planner ve el catálogo y asigna skill por sub-tarea (O.2), gates transversales (`security-review`/`qa-structured`) que el mismo LLM ejecutor no puede descartar (O.3) — verificado en vivo con dinero real contra un proyecto scratch: código con SQL concatenada + credenciales hardcodeadas fue rechazado por el QA judge citando OWASP explícitamente, el checklist inyectado llegó al juez real (O.4). **P** — vigilancia de deriva de fuentes externas (`sources-drift`): registro por path exacto (no repo completo), detección mecánica vía `gh api`, y un paso opcional de resumen vía LLM que lee el diff real y redacta una propuesta para revisión humana (P.4), nunca aplica nada solo. Hallazgo real de hygiene durante O.3: `ctx.allowedTools` en `tool-policy.ts` es dead code (ningún ejecutor lo lee) — documentado y registrado como IDEAS.md #58 en vez de cablearlo sin plan. 1099 tests · 0 fail · `tsc --noEmit` limpio · `bun run test:coverage` (comando exacto de CI) verde.
  Ver historial completo → [DONE.md](DONE.md).

---

## v0.12 (SPRINT 21) — Producto estable: cerrar papercuts, higiene y paridad antes de features grandes

- [x] **SÍ — v0.12 cerrado (2026-07-14)**
  Higiene de datos (borrado masivo en 5 tablas + cero diálogos nativos, absorbe IDEAS #18), Chat con Markdown/sanitizador propio + chips de task/modelo clicables, visor de diff por run calculado por contenido (no `git diff` post-hoc), y auditoría real de paridad CLI↔dashboard con 3 gaps no-dev cerrados (`task init`, `constitution init`, `summary` PDF) y verificados independientemente contra código real ([[feedback-verificar-progreso-delegado]]). Nacen 4 reglas de diseño fijas para toda pantalla nueva (anclaje de elementos fijos, altura de toprow, overflow en el nivel correcto, hover-swap CSS). Cero features nuevas en el motor, disciplina del milestone respetada de punta a punta. 711 tests · 0 fail · `tsc --noEmit` limpio. Primer tag formal del proyecto: `v0.12`.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 20 — Que OrchestOS entregue de verdad: dogfooding contra un producto real

- [x] **PARCIAL — Sprint 20 cerrado formalmente (2026-07-14), con un gate abierto a propósito**
  Auto-split (el gatillo automático que le faltaba al motor de sub-tareas) diseñado, implementado y con superficie de aprobación en dashboard — el usuario ve y aprueba el plan de sub-tareas antes de gastar. Probado con éxito en un entregable simple end-to-end (`crypto-page-v1`, gate 🔍 con dinero real). **El gate original y más exigente (C.2, dashboard premium multi-archivo React+TS+Vite) sigue PAUSADO** por decisión explícita de alcance de Carlos — gated en 2 prerequisitos concretos: decisión de modelo ([[feedback-modelo-decision-final-carlos]], nacida de un incidente de $5.00 quemados este mismo mes) y presupuesto de outputs de tools del executor agéntico (IDEAS.md #32). Candidato de pre-flight del próximo milestone (ver abajo). 711 tests · 0 fail · `tsc --noEmit` limpio (estado actual, no snapshot del mes).
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 19 — El chat lee cualquier imagen: OCR + múltiples adjuntos

- [x] **SÍ — Sprint 19 cerrado (2026-07-09)**
  El chat lee imágenes con cualquier modelo vía OCR local (`tesseract.js`, sin dependencia de que el modelo elegido tenga visión), soporta múltiples adjuntos (`st.chatFiles[]`, límite 5), y el wrapper de seguridad "dato externo, nunca instrucción" fue verificado contra un intento real de prompt injection en una imagen (el modelo lo ignoró). `task_class: ocr` diferido sin evidencia de caso de uso interno — vuelve a IDEAS.md #30. 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## Pre-flight — gap conocido antes de abrir el próximo milestone

**Actualizado al cierre de Sprint 27 (2026-08-13)** — sin gap bloqueante nuevo identificado durante
Sprint 27 (el único hallazgo real, el bug de reversión de rol en Model routing de Y.2, se resolvió
dentro de su propio bloque). Historial completo de los tres cierres → [DONE.md](DONE.md).

**Remanentes explícitos de Bajo-medio (no son deuda oculta, están documentados)**:
- `#4` y `#30` siguen parqueados — no cumplen el gate de evidencia de su propio texto en
  IDEAS.md. Se re-evalúan solo si aparece evidencia nueva (falsos negativos reales de `clarify`
  para `#4`; caso de uso real dentro de OrchestOS mismo para `#30`).
- `#51` (rebobinar) sigue bloqueado por `#50` — no se re-visita hasta que `#50` (sesiones
  persistentes en SQLite) se implemente.

**Próximo milestone: por decidir con Carlos** — el orden lo fija
[IDEAS.md § 🧭 Backlog canónico por esfuerzo](IDEAS.md); con **Mínimo**, **Bajo** y **Bajo-medio**
(salvo los 3 remanentes de arriba) atendidas, la categoría **Medio** es la siguiente en el índice.

---

## SPRINT 18 — Chat como entrada única: detección de intención de tarea

- [x] **SÍ — Sprint 18 cerrado (2026-07-09)**
  Chat con detección semántica de intención de tarea activada con evidencia real (34 mensajes reales, falso negativo confirmado y corregido — Bloque J), paridad CLI↔Dashboard cerrada (9/9 gaps, Bloque E), auto-selección de skill por dominio (Bloque D), auditoría visual + 13 ajustes "premium dashboard" con causa raíz real en cada uno (Bloques G/I), y 2 bugs reales de producción encontrados y corregidos por dogfooding directo de Carlos (imágenes sin gating de visión, guard de contexto no conectado al chat). 649 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 17 — La capa de confianza: ejecutores externos detrás de la verificación

- [x] **SÍ — Sprint 17 cerrado (2026-07-05)**
  Tercer `ExecutorEngine` (ejecutor externo, Claude Code headless) diseñado (`docs/external-executor-design.md`), implementado (`executors/external.ts`, worktree obligatorio, diff completo sin filtrar), expuesto en dashboard+CLI (selector, bloque "Process", detección honesta de binario ausente), y verificado en vivo con dinero real (Bloque D) contra la misma tarea brownfield que motivó el mes anterior (G.5) — encontró y corrigió un bug real de parseo de `git status --porcelain` en el camino (mismo patrón de gates 🔍 con dinero real de G.5/Sprint 14/Sprint 13). Confirma la tesis: `enforceContract`/checks/QA funcionan idénticos sobre un motor que OrchestOS no controla, a costa de 25-70× el costo de single-shot. 617 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 15.F0 — Integridad: los instrumentos de medición deben decir la verdad antes de tocar el motor

- [x] **SÍ — F0 cerrado (2026-07-02)**
  Auditoría completa (arquitecto + debugger + QA + dev) antes de tocar el motor: suite determinista (0 `mock.module()`, inyección de dependencias en su lugar), `tasks.yaml` reconciliado (6 tareas non-done resueltas con decisión explícita), `maxTokens` ignorado en providers directos conectado, modelo retirado (`claude-3-haiku`) reemplazado, pricing con fallback $0 silencioso migrado al catálogo real. 524 tests · 0 fail al cerrar. Desbloqueó el Sprint 16.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 16 — El giro del timón: motor honesto + ejecutor agéntico

- [x] **SÍ — Sprint 16 cerrado (2026-07-02)**
  Origen: revisión estratégica externa (Fable 5, 2026-07-01) — 6 hallazgos reales del corazón del producto. F1-F4 corrigieron las fallas puntuales del ejecutor (retry ciego, QA autocalificado, evidencia incompleta, contrato sin normalizar paths), todos verificados en vivo. Bloque G ejecutó la decisión de arquitectura: capa de verificación desacoplada del ejecutor (`ExecutorEngine`), single-shot extraído sin cambio de comportamiento (G.2), ejecutor agéntico nuevo reusando `runToolLoop()` (G.3), superficie completa en dashboard+CLI (G.4), y un gate comparativo con dinero real (G.5) que encontró y corrigió 2 bugs reales de `maxTokens` hardcodeado en `tool-call.ts`/`harness.ts` — reverificado en vivo sin truncar. 585 tests · 0 fail · `tsc --noEmit` limpio.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 14 — Autonomía interna: el runner que conduce el grafo solo

- [x] **SÍ — Sprint 14 cerrado (2026-06-29)**
  `orchestos run --graph` recorre el DAG completo de `tasks.yaml` sin intervención humana en el happy path (Bloques 0/A/B); ante un fallo, bloquea solo la rama afectada y la decisión retry/bloqueo la toma `diagnoseTask()`, no el humano (A.R hardening). Superficie completa en CLI + dashboard (Bloque C). Verificado en vivo en el dashboard real y en un smoke e2e contra el `tasks.yaml` real de producción del propio proyecto — 2 bugs reales destapados y corregidos en el camino (falso positivo de QA sin checks deterministas, retry sin tope en fallos de check) (Bloque D). En paralelo: control de reasoning effort por modelo end-to-end (BLOQUE BACK/FRONT) y pulido visual del dashboard vía auditoría `impeccable` (10 fixes, incluido un loop de rerender que borraba inputs activos). 518 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 13 — OrchestOS conectado: del aislamiento al conocimiento externo

- [x] **SÍ — Sprint 13 cerrado (2026-06-23)**
  Pre-flight de UI (edición de skills real, ícono YAML, TTL+refresh de modelos). Web fetch real en el chat (`runToolLoop()` multi-turno + guard SSRF) — 2 bugs reales corregidos solo al verificar en vivo (falso positivo SSRF por `dns.resolve4()`, arity de `executeFetchUrl`). Registro de skills de la comunidad (217 reales, `idleTimeout` corregido) + prompt del curador ajustado para que `description` sea condición de disparo, no resumen. 468 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 12 — Endurecimiento: red de seguridad antes de la autonomía

- [x] **SÍ — Sprint 12 cerrado (2026-06-19)**
  Tests del motor crítico (`contract.ts`, `scheduler.ts`) con gate de mutación confirmado contra regresión real. CI en GitHub Actions bloqueando PRs rotos (verificado en vivo, PR #2) + pre-commit hook + `noUnusedLocals`. XSS cerrado con payload real probado en el dashboard corriendo. `server.ts` partido de 1727 a 159 líneas en 13 módulos, re-verificado línea por línea sin cambios de comportamiento. 421 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 11 — OrchestOS como experto: autoría de skills con curador

- [x] **SÍ — Sprint 11 cerrado (2026-06-10)**
  Curador LLM (`/api/skills/curate`, retry hasta 2 veces) + pantalla Skills con tres puertas (escribir · importar · exportar) + pack "pro" de 8 skills de ingeniería en `skills/pro/` importables con un click + paridad CLI (`skill curate`/`skill import`). 402 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 4 — Routing inteligente + skills que se adaptan al proyecto

- [x] **SÍ — Sprint 4 cerrado (2026-05-27)**
  Routing activo (`config show`), 11 skills, language_targets, CONSTITUTION.md en system prompt, `context compress` genera CONTEXT.md, `runs --detail` reporta tokens.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 5 — Confiabilidad para uso diario: e2e real + sandbox + spec-driven

- [x] **SÍ — Sprint 5 cerrado (2026-05-28)**
  Sandbox por git worktree (S19), Spec-Driven con gate en harness (S20), resolvers multi-lenguaje + autoskills fetch (S21), sub-agentes con context isolation + memoria persistente + tool policy (S22). 110 tests · 0 fail. Smoke real sub-agentes: write-greeting→write-response (44s, memory_entries escritas). selectMemories bug corregido (depIds ID→topic_key resolution).
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 6 — IA con ROI demostrable + observabilidad de sub-agentes

- [x] **SÍ — Sprint 6 cerrado (2026-05-28)**
  S23 function calling planner (elimina errores YAML estructuralmente), S24 embeddings semánticos (`embed_hits` en runs), S25 diagnóstico de fallos auto-trigger en `failed_permanent`, S26 BM25 conflict detection en memoria.
  `embed_hits > 0` en 12 runs reales · 212 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 7 — Observabilidad activa + calidad del pipeline

- [x] **SÍ — Sprint 7 cerrado (2026-06-02)**
  S27 context-monitor wired (warnings persistidos en DB + visibles en `runs --detail`), S28 WHEN/THEN acceptance criteria (`spec lint` + draft prompt + QA prompt), S29 spec archive (`spec archive` + `spec list --all`), S30 aprendizaje continuo v1 (`runs --analyze` + hook post-completion en `task run`). 256 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 8 — Pipeline robusto + aprendizaje activo

- [x] **SÍ — Sprint 8 cerrado (2026-06-02)**
  S31 middleware chain (10 middlewares de enrichment, harness refactorizado), S32 capabilities contract + delta headers en specs, S33 instincts con confidence scoring, S34 continuous learning v2 (runs→instincts loop cerrado), S35 cost tracker por sub-agente, S36 dashboard local Bun + vanilla JS (4 vistas desde SQLite).
  369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 9 — Dashboard usable: de observador a orquestador

- [x] **SÍ — Sprint 9 cerrado (2026-06-04)**
  Dashboard convertido en interfaz principal: 10 bloques (A–J), input natural con preview IA, i18n en/es, instalador de un solo archivo, chat panel + model selector shipeados fuera de plan. 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## SPRINT 10 — El producto que alguien que nunca programó puede usar

- [x] **SÍ — Sprint 10 cerrado (2026-06-04)**
  Wizard API key (3 proveedores, validación real, rollback en 401) · toggle humano/operador navegable con persistencia · diagnóstico de fallos en Tasks · archivos en Chat · Control Center con 5 bloques de salud · Ollama auto-detectado · 369 tests · 0 fail.
  Ver historial completo → [DONE.md](DONE.md).

---

## Knowledge promotions

<!-- knowledge-promotion:KP-20260817-102752-93e4d5 -->
### Planificar antes de cambios multi-módulo

- Insight: `INS-2026-005` (adopted/high)
- Razón: El incidente del hook desincronizado y las entregas de UI/configuración sin wiring demuestran que las reglas narrativas no bastan; se necesita un protocolo universal con gates mecánicos y evidencia en vivo para cualquier LLM.
- Acción propuesta: Agregar al Sprint 29 un bloque de gobernanza cross-LLM: orden obligatorio de preflight, verificación de scope y trabajo paralelo, doctor de hooks, gates de seguridad/typecheck/tests y prohibición de cerrar UI/configuración sin prueba real de navegador y backend.
- Regla: Si una modificación cambia arquitectura o atraviesa varias capas, presentar alcance, pasos, validación y exclusiones antes de editar.
- Evidencia en vault: projects/orchestos/decisions, projects/orchestos/aprendizajes
<!-- /knowledge-promotion:KP-20260817-102752-93e4d5 -->

- [x] **GOV.1 — 🧠 Protocolo universal y verificable para cualquier LLM.** (2026-08-17) Una sola fuente de
  verdad define el orden obligatorio antes de editar, los límites de alcance, los gates por tipo
  de cambio y qué hacer cuando falta evidencia. `AGENTS.md` y `CLAUDE.md` deben apuntar al mismo
  protocolo; un preflight debe validar ítem abierto + hooks sin drift; pre-commit debe impedir
  cerrar cambios de dashboard/configuración sin evidencia explícita de navegador real. El gate
  debe distinguir con honestidad lo mecánicamente verificable de lo que sigue requiriendo criterio.

  **Implementado:** `docs/agent-work-protocol.md` es la fuente común; `AGENTS.md`/`CLAUDE.md`
  obligan a ejecutar `bun run agent:preflight -- --item <ID> --agent <nombre>`; el preflight
  valida ítem abierto, muestra cambios ajenos y bloquea hooks ausentes/con drift usando
  `git rev-parse --git-path hooks` (portable a worktrees). `agent:live-gate` bloquea commits que
  toquen dashboard/config sin un `[x]` y una línea `Gate en vivo:` con navegador/browser/Playwright
  en el diff staged de `PLAN.md`. El protocolo declara honestamente que el hook verifica que la
  evidencia esté documentada, no que sea verdadera: observar el flujo sigue siendo gate humano/LLM.

  **Evidencia:** `bun run agent:preflight -- --item GOV.1 --agent codex` ✅; `bun run hooks:check`
  ✅; `bunx tsc --noEmit` ✅; `bun test scripts/agent-governance.test.ts` (3 pass) ✅;
  `bun run test:coverage` (1157 pass, 0 fail) ✅. `bun run security:gate` llegó al audit y bloqueó
  por dos vulnerabilidades transitivas preexistentes; quedan registradas en GOV.2, no ocultas ni
  corregidas fuera de alcance. Insight decisivo: `INS-2026-005`; `INS-2026-004` evitó confundir
  coverage con capacidad real de detectar regresiones.

- [x] **GOV.2 — 🔍 Resolver audit de dependencias high sin actualización ciega.** (2026-08-17) Hallazgo del gate
  GOV.1: `bun audit` reporta `fast-uri >=3.0.0 <3.1.5` vía Stryker/Ajv y
  `brace-expansion >=4.0.0 <5.0.9` vía Stryker/minimatch y glob/minimatch. Evaluar actualización
  compatible y correr suite + mutation shards relevantes; no usar `bun update --latest` a ciegas.

  **Resolución mínima:** no se actualizaron Stryker, Ajv, Glob ni Minimatch. `package.json` fija
  overrides de `fast-uri: 3.1.5` y `brace-expansion: 5.0.9`; ambos permanecen dentro de los rangos
  que sus padres ya aceptaban (`ajv@8.18.0` → `fast-uri ^3.0.1`; `minimatch@10.2.5` →
  `brace-expansion ^5.0.5`). `bun.lock` confirma únicamente esos dos saltos de parche. Advisories
  cerrados: `GHSA-7p8r-x3mc-p8w7` y `GHSA-rgw5-rvv9-x895`.

  **Evidencia:** `bun pm ls --all` → `fast-uri@3.1.5`/`brace-expansion@5.0.9`; `bun audit
  --audit-level high` ✅; `bunx tsc --noEmit` ✅; `bun run test:coverage` (1157 pass, 0 fail) ✅;
  `bun run security:gate` completo ✅; `bun run mutation:qa` arrancó Stryker, ejecutó 429 mutantes
  y terminó en 4m01s con score 46.79% ✅. La fuente primaria (GitHub Advisory Database) y el
  registry npm confirman las primeras versiones corregidas. Insight aplicado: `INS-2026-005` —
  cambio acotado, sin actualización multi-capa.

- [x] **GOV.3 — 🔍 Evaluar advisory moderate de `qs` sin mezclar alcance.** (2026-08-17) El audit total posterior
  a GOV.2 conserva `GHSA-q8mj-m7cp-5q26`: `qs@6.15.1` llega fijado exactamente por
  `typed-rest-client@2.3.1` dentro de Stryker. No bloquea `security:gate` (`high+`), pero debe
  evaluarse por separado antes de forzar un override sobre una dependencia con versión exacta.

  **Resolución mínima:** `package.json` añade `qs: 6.15.3` a los overrides existentes. Se conserva
  `@stryker-mutator/core@9.6.1` y `typed-rest-client@2.3.1`: actualizar este último a `3.x` rompería
  el rango `~2.3.0` declarado por Stryker y ampliaría el alcance. `bun.lock` cambia únicamente
  `qs 6.15.1 → 6.15.3`, sus dependencias internas (`side-channel ^1.1.1` y
  `es-define-property ^1.0.1`) y el registro del override. El override corrige la resolución de este
  repositorio, pero no modifica el manifest upstream de `typed-rest-client`; debe reevaluarse al
  actualizar Stryker o cuando ese cliente publique/adopte una versión compatible sin el pin vulnerable.

  **Evidencia:** `bun run agent:preflight -- --item GOV.3 --agent codex` ✅; baseline
  `bunx tsc --noEmit` ✅; `bun pm ls --all` → `typed-rest-client@2.3.1` y `qs@6.15.3`; `bun audit`
  → cero vulnerabilidades ✅; `bun run security:gate` completo (1157 pass, 0 fail, audit limpio) ✅;
  `bun run mutation:qa` ejecutó el consumidor real Stryker, 429 mutantes en 4m00s, score 46.79% ✅.
  Knowledge radar: sin insights aplicables; no se promovió ni inventó conocimiento.
