# Auditoría de autonomía — ¿por qué OrchestOS no desarrolla OrchestOS?

Fecha: 2026-09-09 · Autor: Claude Opus 5 · Pedido por Carlos.
**No es una promoción a PLAN.md.** Es un diagnóstico con evidencia; cualquier ítem
nuevo requiere GO explícito.

Procedencia: lectura de `PLAN.md` (1784 líneas), `CONTEXT.md`, `AGENTS.md`,
`docs/agent-work-protocol.md`, `src/run/graph-runner.ts`, `src/run/scheduler.ts`,
`src/tasks/loader.ts`, `src/run/git-lock.ts`, `src/run/harness.ts`,
`src/dashboard/handlers/run-graph.ts`, `src/db/chat-turns.ts`, `tasks.yaml`,
`README.md`, `docs/E2E.md`, `docs/graph-runner-design.md`, y consultas directas a
`~/.orchestos/db.sqlite`. No ejecuté la suite ni levanté el dashboard.

---

## 0. El hallazgo que reordena todo lo demás

**El `tasks.yaml` de este repo no contiene ni una sola tarea de OrchestOS, y ninguna
tarea del repo ha tenido nunca una dependencia.**

```
$ grep -n "^  - id:\|depends_on:\|status:" tasks.yaml
crypto-page-v1 · crypto-dashboard-v2 · crypto-dashboard-visual-iteration
crypto-terminal-v3 · v4 · coinmarketcap-v5 · apple-es-design-system
apple-es-storefront-hero-grid · design-test-premium-saas-a1 (×2)
→ 10 tareas · 10 × `depends_on: []` · 0 tareas de desarrollo de OrchestOS
```

```
$ sqlite ~/.orchestos/db.sqlite — runs por clase
chat 63 (última 2026-09-03) · implement 12 (última 2026-08-19) · doc 4 · plan 3 · review 1 · fix 1
→ 84 runs en toda la vida del proyecto; 21 no-chat; ninguna corrida `implement` en 21 días
```

Contra eso: 44 ítems de `PLAN.md` cerrados (`plan_items`, S.3), todos tecleados a mano
por Claude o Codex en una terminal.

El diagnóstico no es "el runner es secuencial". Es que **el grafo nunca se apuntó al
proyecto para el que se construyó.** El DAG, las dependencias, el circuit breaker y los
worktrees son infraestructura real (§4) que solo se ha ejercitado sobre demos de páginas
de criptomonedas de un solo nodo. Un DAG de 10 nodos aislados es una lista.

Corolario: la pregunta "¿por qué mis agentes trabajan en serie?" tiene una respuesta más
incómoda que el paralelismo — **no trabajan**. Lo que corre en serie son sesiones de CLI
manejadas por Carlos, que no pasan por OrchestOS en absoluto.

---

## 1. Respuestas directas (1–35)

Clasificación usada en todo el documento:
**[IMPL]** implementado y ejercitado · **[PARC]** parcial · **[DOC]** documentado sin prueba · **[AUS]** ausente.

### Proceso personal (1–12)

**1. ¿Cuál es exactamente la mala práctica?**
No es la secuencialidad. Es **usar dos sistemas de trabajo y solo mantener uno**: el
trabajo real ocurre en sesiones de CLI (Claude/Codex) gobernadas por `docs/agent-work-protocol.md`,
mientras el sistema que construyes (`tasks.yaml` → graph runner → QA → merge) recibe
juguetes. Cada ítem cerrado a mano es un ítem que no generó evidencia de producto.
Segunda mala práctica, derivada: **cierras el loop con tu propia atención**. Eres el bus
de mensajes entre agentes.

**2. ¿Confundes planificación, gobierno, revisión y ejecución?**
Sí, pero no en el diseño — en la práctica. El diseño las separa bien:
`agent-work-protocol.md` distingue *mecánico / verificado / narrativo*, que es
exactamente la frontera gobierno-vs-ejecución. El problema es que **tú personalmente
ejecutas los cuatro roles en la misma sesión**: escribes el spec (planificación), decides
si el ítem está abierto (gobierno), lees el diff (revisión) y tecleas el commit (ejecución).
Bloque S es el primer intento serio de sacar el *gobierno* de tu cabeza a una tabla con
constraints (`status='done'` exige `commit_sha`) — es el movimiento correcto.

**3. ¿El modelo fuerte es arquitecto o cuello de botella disfrazado?**
Ninguno de los dos: hoy es **mecanógrafo**. Verificable: S.1 y S.2 los ejecutó Codex y
Claude solo verificó (correcto); S.3 lo implementó Codex pero Claude re-corrió gates,
encontró bugs y commiteó (mixto); la mayoría del Bloque R y H la implementó Claude
directo (incorrecto). La regla `feedback-cerebro-piensa-planifica-delega` se escribió hoy
mismo — es decir, el problema está identificado hace horas, no resuelto.
El cuello de botella real eres tú, no el modelo: el modelo termina y **espera un mensaje tuyo**.

**4. ¿Qué decisiones tomas a mano que debería tomar el scheduler?**
- Cuál es el siguiente ítem ejecutable → es una query: `open` + deps `done`. **Es literalmente S.5** [AUS].
- Si dos ítems pueden ir a la vez → hoy no hay dato: `plan_item_deps` está **vacía a propósito** (S.3).
- Qué agente toma qué ítem → hoy lo asignas por chat; el eje `🧠/⚡/🔍` ya lo codifica.
- Cuándo reintentar tras rate-limit → **ya lo decide el runner** (`graph-runner.ts:325-331`); lo tomas a mano porque no usas el runner.
- Cuándo parar por costo → **ya existe** (`--max-cost`/`--max-minutes`, `graph-runner.ts:165-172`).

**5. ¿Qué debe seguir siendo tuyo?**
Objetivo y orden de bloques; modelo y presupuesto de cada corrida real
(`feedback-modelo-decision-final-carlos`, NO NEGOCIABLE); apertura/cierre de bloques;
decisiones irreversibles (force-push, wipe, exponer el dashboard fuera de loopback);
aceptar un ítem 🔍 con gate visual; y **declarar las dependencias entre ítems del plan** —
S.3 acertó al negarse a inferirlas de la prosa.

**6. ¿Qué estás deteniendo sin necesidad?**
El arranque de cada ítem ⚡ ya especificado; la re-verificación de gates que un script ya
corre; el "¿seguimos?" entre ítem e ítem; la traducción manual de un ítem de PLAN.md a un
prompt de CLI; y la ejecución de tareas independientes que no comparten archivos.

**7. ¿"Evitar conflictos" es excusa para no diseñar ownership?**
Parcialmente sí, y tu propio repo te contradice dos veces:
- `src/run/git-lock.ts` **[IMPL]** es un mutex real entre procesos, escrito porque el
  auto-commit de `tasks.yaml` y el merge-back de worktree se pisaban en vivo 3+ veces.
  Es decir: **ya diseñaste integración concurrente y funciona**.
- `src/db/chat-turns.ts` **[IMPL]** tiene claim, lease de 150 s, dueño, y rechazo de
  resultado tardío, bajo transacción SQLite inmediata (R.5-ter). **Ya diseñaste ownership
  con leases** — para turnos de chat, no para tareas.
La primitiva existe dos veces. Lo que falta es aplicarla a la cola de tareas. Eso es
exactamente R.7, y por eso R.7 es la piedra angular de todo esto (§5).
Pero hay un matiz a tu favor: `feedback-serial-por-decision-no-costumbre` registra que
elegiste serial con información completa. Esa decisión sigue siendo defendible **para
ítems 🧠 sobre archivos calientes** (`cli.ts` 2923 líneas, `harness.ts` 1203) y deja de
serlo para ⚡ con scope disjunto.

**8. ¿Colaboran tus agentes o reciben tareas aisladas?**
Tareas aisladas, con **una excepción real y muy buena**: `scripts/adversarial-review.ts`
**[PARC]** — un modelo distinto revisa el diff del día y un hallazgo solo cuenta si el
propio script ejecuta un test que **falla** contra el código actual. Eso *es* colaboración
entre agentes con árbitro mecánico. Está reabierto por 5 defectos y su LaunchAgent
**no está activado** (H.10.2). Es la pieza más cercana a autonomía real que tienes.

**9. ¿Existe el loop claim → execute → verify → integrate → unblock?**
Parcialmente, y partido en dos sistemas que no se tocan:
- claim **[AUS]** para tareas / **[IMPL]** para turnos de chat.
- execute **[IMPL]** (`harness.ts`, worktree por tarea, `harness.ts:254-269`).
- verify **[IMPL]** (checks + QA + adversarial + refuter; columnas en `runs`).
- integrate **[IMPL]** (`mergeWorktreeBack` bajo `withGitLock`).
- unblock **[IMPL]** (`graph-runner.ts:176-186` recomputa `ready` cada iteración).
Falta el claim, y falta que el loop **no termine**: hoy `runGraph` es una llamada con
principio y fin, no un proceso vivo.

**10–11. ¿Qué pasa si desapareces varias horas?**
Se detiene todo, salvo dos jobs de launchd: `dev.cagr1.orchestos.review.plist` y el
Dreaming de las 2am — y ninguno de los dos escribe código, ambos solo escriben propuestas.
Si estás a mitad de una corrida de grafo, esa corrida sí continúa hasta agotar `ready` o
el circuit breaker. Pero nadie la lanza sin ti y nadie lanza la siguiente.

**12. ¿Supervisor persistente o comando manual?**
Comando manual. `POST /api/run/graph` lanza `runGraph()` **in-process** en el server del
dashboard y guarda la fase en un `Map` en memoria (`run-graph.ts:32-39`). Si el server
reinicia, el estado de la corrida se pierde (las tareas no: viven en `tasks.yaml`
commiteado). Hay un guard de "una corrida por proyecto" (HTTP 409) — es un mutex, no un
supervisor. **[AUS]** un daemon.

### Mecánica del sistema (13–19)

**13. ¿El estado es durable y recuperable?**
El estado *de tarea* sí **[IMPL]** y bien: cada cambio de status escribe `tasks.yaml` y
hace commit inmediato (`graph-runner.ts:367-370`). El estado *de corrida* no **[AUS]**:
`Map` en memoria. El estado *de plan* pasó hoy a ser durable con `plan_items` (S.3).

**14. ¿Puede haber dos workers sin pisarse?**
No, hoy no. `saveTasks()` (`src/tasks/loader.ts:25-42`) compara un hash opcional y luego
hace `writeFileSync` directo — hay ventana TOCTOU entre `hashFile`, `loadTasks` y
`saveTasks` dentro de `updateTaskStatus` (`loader.ts:48-56`), y la escritura no es atómica
(sin temp+rename), así que una interrupción deja YAML truncado. Es R.7, **riesgo
identificado y todavía no reproducido**. Lo que sí está resuelto es la capa de *git*:
`withGitLock` serializa checkout/merge/commit sobre `master`. Es decir: **el pisón sería
en el YAML, no en el árbol de trabajo.**

**15. ¿Cómo se decide qué corre en paralelo?**
Hoy no se decide, porque no hay paralelo. El set `ready` se calcula bien
(`graph-runner.ts:178-186`: `pending` + todas las deps `done` + no descendiente de rama
fallida), pero se consume con `for (const task of ready) { await ... }`
(`graph-runner.ts:214`). Peor: la secuencialidad es una **suposición cargante**, no un
descuido. El comentario `AR.1` en `graph-runner.ts:194-197` dice textual *"el runner es
secuencial: nada fuera de este loop cambia tasks.yaml entre iteraciones"*, y sobre eso se
construye la detección de atasco (si no hay `ready` y hay `pending`, corta). Con dos
workers esa inferencia es **falsa** y el runner cortaría una corrida sana.
→ Paralelizar no es cambiar un `for` por `Promise.all`. Hay que reemplazar esa inferencia
por un contador de tareas en vuelo.

**16. ¿Qué artefactos y contratos produce cada agente?**
**[IMPL]** y es de lo más sólido del repo: fila en `runs` con 38 columnas (incluidos
`files_attempted/authorized/blocked`, `checks_json`, `qa_verdict`, `adversarial_verdict`,
`refuter_verdict`, `read_audit_json`, `file_diffs`, `snapshot_before/after`), `run_steps`,
worktree con rama propia, entrada en `memory_entries` por `topic_key`, y el commit.
Contratos: `src/run/contract.ts`, `allowed_outputs`, `src/run/path-policy.ts`.

**17. ¿Quién integra?**
`mergeWorktreeBack(worktree, 'commit'|'squash'|'discard')` bajo `withGitLock` **[IMPL]**.
En el scheduler de sub-tareas: merge si `completed`, discard si no (`scheduler.ts:165-172`).
Nadie resuelve conflictos semánticos — con worktrees desde la misma base y merge inmediato,
eso hoy no aparece porque solo hay un escritor a la vez.

**18–19. ¿Qué pasa cuando una tarea falla? ¿Se paraliza todo?**
**[IMPL] y verificado en vivo una vez**: `docs/E2E.md:130` (2026-06-25) — 4 tareas, 1
falla a propósito, la independiente completa, el descendiente queda `blocked`, coste
$0.000815, `autonomy_metric 0.25`. Falla la rama, no el grafo. Además: diagnóstico
automático, `rate_limit` → un requeue con backoff, resto → bloquear descendientes
(`graph-runner.ts:323-331`). **Esta parte de tu premisa era pesimista de más: aquí el
sistema ya hace lo correcto.**

### Autonomía y honestidad (20–25)

**20. ¿Qué significa "autonomía" aquí?**
Hoy, implícitamente, tres cosas distintas que conviene no mezclar:
(a) *no me preguntó nada durante la corrida*; (b) *terminó sin intervención y con evidencia*;
(c) *arrancó, siguió y decidió el siguiente paso sin mí*.
Solo (c) es autonomía. Lo que mides es (a). El vault ya tiene el criterio correcto:
**INS-2026-010** — algo es autónomo solo si la acción es reversible, su resultado es
demostrable, y esa categoría ya pasó al menos una vez por supervisión. Reversible lo
garantiza el worktree; demostrable lo garantizan checks+QA; **"ya pasó por supervisión"
es exactamente lo que te falta registrar por categoría de tarea.**

**21. ¿La métrica mide autonomía?**
No. `autonomy_metric = completadas / ejecutadas` (`graph-runner.ts:307`). Es una **tasa de
éxito dentro de una corrida que tú lanzaste**. No mide intervenciones, ni tiempo sin
humano, ni tareas arrancadas sin ti. Un grafo de 1 tarea que pasa da 1.0.
El nombre es el problema: induce a creer que ya se mide lo que no se mide.
Métricas honestas que sí lo medirían: *minutos de trabajo productivo sin mensaje humano*,
*tareas iniciadas sin intervención / total*, *intervenciones por tarea completada*.

**22. ¿Los tests "parallel" prueban concurrencia?**
No. `src/__tests__/graph-runner.test.ts:180` — `'happy path: parallel tasks (no deps) all
complete'` escribe 3 tareas sin dependencias y afirma que las 3 completan. Prueba
**independencia topológica**, no solapamiento temporal. No hay ninguna aserción de que dos
tareas estén activas a la vez, en ningún test del repo. La palabra "parallel" ahí es un
nombre desafortunado, no una afirmación falsa del código.

**23. ¿Qué documentación está más madura que la implementación?**
Menos de lo que temías. Este repo es notablemente honesto:
- `README.md:484` dice textual: *"this is a sequential, local, single-model CLI. It is not autonomous."*
- `docs/graph-runner-design.md:98,126` declara "secuencial, no paralelo" como límite explícito.
- `docs/sub-agents-flow.md:162` — "paralelismo prohibido, scheduler estrictamente secuencial".
Lo que sí desalinea:
- el nombre `autonomy_metric` (§21);
- el nombre del test `parallel` (§22);
- `PLAN.md § Bloque R`: *"Orden de ataque propuesto: R.1 → R.2 → …"* es texto que nadie
  hace cumplir — el propio S.3 lo señala como "el mismo patrón del botón que no hace nada";
- el `[x]` de I.4 cuyo gate visual no se cumplió — ya registrado como corrección pendiente en R.8.

**24. ¿Qué es infraestructura real y qué es andamiaje?**

| Real (ejercitado) | Parcial | Andamiaje / sin ejercitar |
|---|---|---|
| Worktree + merge-back + `git-lock` | `adversarial-review` (5 defectos, LaunchAgent apagado) | `plan_item_deps` (tabla vacía) |
| Checks + QA + adversarial + refuter | `plan_items` (fuente aún no entronizada — falta S.4) | `depends_on` en `tasks.yaml` (nunca usado: 10/10 vacíos) |
| Retry + diagnose + circuit breaker (E2E.md:130) | Evals (H.5.1/H.5.2 hechos, sin baseline: H.5.3) | `autonomy_metric` (mide otra cosa) |
| `runs`/`run_steps` como evidencia durable | tasks.yaml (falta atomicidad: R.7) | Grafo multi-nodo con dependencias reales |
| `chat_turns` con claim/lease | Dashboard (polling 30 s, sin stream) | Supervisor / daemon |
| Gates: preflight, ledger, live-gate, gate:evidence | | Claim/lease de tareas |

**25. ¿Qué falta para que OrchestOS desarrolle OrchestOS?**
En orden de dureza, no de esfuerzo:
1. **Que un ítem de PLAN.md sea ejecutable sin traducción.** S.3 lo empezó; el propio
   bloque S lo dice: *"hoy el plan y la ejecución son dos grafos que no se hablan"*. **[PARC]**
2. **Dependencias reales cargadas** (`plan_item_deps` vacía + 10/10 `depends_on: []`). **[AUS]**
3. **Escritura atómica + claim/lease de tarea** (R.7 ampliado). **[AUS]**
4. **Un proceso vivo** que haga claim→execute→verify→integrate→unblock en loop. **[AUS]**
5. **Presupuesto y permisos por corrida desatendida** — parcialmente existe (`--max-cost`,
   `--max-minutes`, `sandbox-policy`, `path-policy`, `security:gate`). **[PARC]**
6. **Un canal de eventos** para poder mirar sin interrumpir. **[AUS]**

**26. Mínimo experimento que probaría orquestación real.**
Ver §6 — resumen: 3 ítems ⚡ reales de OrchestOS en `tasks.yaml`, **con al menos una arista
de dependencia real**, corridos con `orchestos run --graph --max-cost <X>`, sin que toques
el teclado hasta el final. Cero código nuevo. Si eso funciona una vez, el diagnóstico de
"no puedo por arquitectura" queda refutado y lo que queda es paralelismo. Si falla,
falla con evidencia y te dice exactamente qué falta.

### Qué cambiar (27–35)

**27. Dejar de hacer inmediatamente.** Ver §G.
**28. Empezar inmediatamente.** Ver §H.
**29. Automatizar primero.** En este orden: (1) *qué sigue* → S.5; (2) *arrancar el
siguiente ítem ⚡ sin preguntarte* → requiere R.7; (3) *el reviewer nocturno* → H.10.2 ya
casi está; (4) paralelismo. **El paralelismo es el cuarto, no el primero.**
**30. Bajo control humano.** §5 de las respuestas.

**31. Arquitectura de transición sin reescritura.** Ver §E.

**32. Riesgos de seguridad al continuar sin ti.**
- El dashboard está en `127.0.0.1` **sin autenticación** (CONTEXT.md, límite permanente).
  Un proceso desatendido que acepte trabajo por HTTP amplía la superficie: cualquier
  proceso local puede lanzar corridas que gastan dinero y escriben código.
- `L62-001` (migraciones concurrentes → `duplicate column name`) pasa de teórico a probable
  en cuanto haya 2+ procesos: **es un bloqueante duro para workers paralelos**, no un
  hallazgo abierto cualquiera.
- `L62-002` (provider key persistida antes de validar).
- L.6.2 abierto: los flujos manuales de ejecución/worktree/exportación nunca se revisaron
  con navegador.
- Riesgo nuevo propio de la autonomía: **gasto sin testigo**. Un loop que reintenta puede
  quemar cupo mientras duermes — el incidente de los $5.00 del 2026-07-13 ocurrió con un
  humano mirando.
- Riesgo de identidad: un agente desatendido que toque `git config` rompería el mapa de
  contribuciones en silencio (ya pasó una vez). Debe ser un guard mecánico, no una regla.

**33. Límites obligatorios antes de soltar.**
- Costo: `--max-cost` **obligatorio** en toda corrida desatendida (hoy es opcional; el
  runner ya trata `0` correctamente tras AR.4). Además un techo diario acumulado. **[PARC]**
- Tiempo: `--max-minutes` obligatorio. **[IMPL, opcional]**
- Archivos: `allowed_outputs` + `path-policy` ya lo cubren por tarea **[IMPL]**; falta
  denylist dura desatendida: `.git/config`, `.git/hooks/`, `~/.claude/`, `~/.orchestos/`.
- Acciones: prohibido sin humano — `push --force`, borrado de ramas, `git config`,
  `--no-verify`, migraciones destructivas, exponer el server fuera de loopback.
- Modelo: nunca elegido por un LLM (`feedback-modelo-decision-final-carlos`).
- Y un límite que hoy no existe: **tope de tareas concurrentes**, con default 1.

**34. Eventos que el dashboard debería mostrar.**
Hoy el dashboard hace polling cada 30 s (`public/app.js:3152`) y lee `tasks.yaml`. Para
"ver agentes trabajando" hacen falta eventos, no fotos: `task.claimed{task,worker,lease_until}`,
`task.step{tool, file}`, `check.result`, `qa.verdict`, `worktree.merged{sha}`,
`task.blocked{by}`, `budget.consumed{usd, pct}`, `worker.heartbeat`, `lease.expired`,
`intervention.required{reason}`. `run_steps` ya guarda parte de esto — falta el canal (SSE),
no el dato.

**35. Evidencia en vivo de que es autónomo de verdad.**
Una sola prueba, difícil de falsificar: **una ventana de ≥4 h con cero mensajes tuyos en
la que el `git log` muestre ≥2 commits de ítems distintos, cada uno con su fila en `runs`
con `qa_verdict='pass'`, y `.orchestos/` mostrando un lease expirado y recuperado.**
Un timestamp de commit no se puede narrar.

---

## A. Diagnóstico de tu error personal

Construiste un orquestador y seguiste siendo el orquestador. Concretamente:

1. **Nunca apuntaste el producto a sí mismo.** 10 tareas de demo, 0 de OrchestOS, 0 aristas.
2. **Confundiste "no se pisan" con "no pueden pisarse".** Elegiste serialidad como política
   cuando ya tenías dos mecanismos de ownership funcionando (git-lock, chat-turns leases).
3. **Eres el bus de mensajes.** Cada transición entre agentes pasa por tu atención. Eso te
   convierte en el componente menos disponible del sistema.
4. **Optimizaste la disciplina del proceso en vez de la ejecución del sistema.** El harness
   (preflight, gates, ledger, scope-lock, handoff, adversarial review) es excelente y está
   diseñado para *un humano con un CLI*, no para *N workers*. Es un óptimo local muy bien
   construido.
5. **Mides lo cómodo.** `autonomy_metric` responde "¿pasaron las tareas?" y se lee como
   "¿fue autónomo?".

Lo que **no** es tu error: no es falta de arquitectura, no es que la documentación mienta,
y no es que el fallo de una tarea paralice el grafo (E2E.md:130 demuestra lo contrario).

## B. Carencias de OrchestOS

| Carencia | Estado | Ítem |
|---|---|---|
| Escritura atómica de `tasks.yaml` | **[AUS]** | R.7 |
| Claim/lease de tarea | **[AUS]** (existe para chat) | — |
| Loop persistente (daemon) | **[AUS]** | — |
| Ejecución concurrente | **[AUS]** — y `AR.1` la asume ausente | — |
| Aristas de dependencia reales | **[AUS]** (dato, no código) | S.3/S.6 |
| Plan ejecutable sin traducción | **[PARC]** | S.4/S.5 |
| Canal de eventos / SSE | **[AUS]** | — |
| Baseline de calidad | **[PARC]** | H.5.3 |
| Reviewer adversarial activo | **[PARC]** | H.10.2 |
| Migraciones seguras entre procesos | **[AUS]** — bloqueante para N workers | L62-001 |
| Métrica de autonomía honesta | **[AUS]** | — |

## C. Tu proceso vs. un proceso autónomo

| | Hoy | Autónomo |
|---|---|---|
| Quién elige el siguiente ítem | Carlos, leyendo PLAN.md | query `ready` sobre el grafo |
| Quién arranca | Carlos, tecleando | worker que hace claim |
| Unidad de trabajo | sesión de CLI | tarea con lease |
| Concurrencia | 1, por política | N, por scope disjunto |
| Fin de tarea | el agente lo afirma | checks+QA+commit lo demuestran |
| Integración | Carlos revisa el diff | merge-back bajo lock, humano revisa después |
| Si algo falla | Carlos se entera al volver | rama bloqueada, resto sigue, evento emitido |
| Si Carlos desaparece | se detiene | sigue hasta agotar `ready` o presupuesto |
| Coordinación | atención humana | ownership + leases + eventos |

## D. Modelo operativo recomendado para ti

Tus 8 reglas son correctas. Ajustes con lo que el código dice:

1. **Objetivo, límites, presupuesto e irreversibles: tuyos.** Sin cambio.
2. **El sistema divide el trabajo** → hoy no puede: `plan_item_deps` está vacía por diseño.
   La división la sigues haciendo tú, pero **escríbela como datos, no como prosa** — es
   media hora de cargar aristas, no un proyecto.
3. **Los agentes toman tareas** → bloqueado por R.7. Es el único prerequisito duro.
4. **Independientes en paralelo** → después de 3, y con tope 2 al principio.
5. **Nadie espera salvo dependencia formal.** Añade: *y salvo ítems 🧠 sobre archivos
   calientes* (`cli.ts`, `harness.ts`, `chat.ts`), que hoy sí se pisarían de verdad.
6. **Ownership e integración, no serialidad.** Ya tienes las dos primitivas; falta aplicarlas.
7. **Intervienes en decisiones, riesgos, ambigüedades.** Añade: y en el **gate 🔍 visual**,
   que no es delegable hasta que UI.8.1 (Playwright) exista.
8. **La evidencia decide.** Ya es la regla del repo; el problema es que la evidencia hoy la
   produce una sesión de CLI, no una fila en `runs`.

Regla de oro que te falta: **si tomas una decisión dos veces igual, es una query, no una decisión.**

## E. Arquitectura recomendada (sin reescritura)

Cuatro fases. Cada una es útil sola y ninguna invalida la anterior.

**Fase 0 — Dogfood, cero código.** Ítems reales en `tasks.yaml` con aristas reales.
El graph runner actual, secuencial, ya sirve. Produce lo que hoy no existe: evidencia de
que el recorrido funciona sobre trabajo propio.

**Fase 1 — Ownership (R.7 ampliado).** `tasks.yaml` sigue siendo la fuente. Añadir:
escritura atómica (temp+`rename`), read-modify-write bajo `withGitLock` (**el lock ya
existe, reusarlo**), y tres campos por tarea: `owner`, `lease_until`, `heartbeat_at`.
Semántica copiada de `src/db/chat-turns.ts`: claim transaccional, lease de N minutos,
resultado tardío rechazado, lease vencido reclamable. Con esto, dos workers ya no se pisan
aunque sigan corriendo de a uno.
*Prerequisito duro:* arreglar `L62-001` — dos procesos migrando la misma DB revientan.

**Fase 2 — Worker loop.** Un comando nuevo, `orchestos work`, proceso separado:
```
claim(ready ∩ no-owned) → run --id (código existente) → checks+QA (existente)
  → merge-back bajo git-lock (existente) → release + unblock → repeat
```
El graph runner deja de *ejecutar* y pasa a *despachar*. **Aquí hay que reemplazar la
inferencia de atasco `AR.1` (`graph-runner.ts:194-197`) por un contador de tareas en
vuelo**, o el despachador cortará corridas sanas. Con 1 worker el comportamiento es
idéntico al de hoy; con 2, hay paralelismo real sin tocar nada más.

**Fase 3 — Supervisor.** `orchestos daemon`: mantiene N workers, aplica presupuesto global,
recupera leases vencidos, escribe `run_steps`, y sobrevive al reinicio del dashboard
(hoy el estado vive en un `Map`, `run-graph.ts:32-39`). Un launchd, igual que los dos que
ya tienes.

**Fase 4 — Observabilidad.** SSE con los eventos de §34. El dashboard deja de hacer
polling de 30 s y pasa a mostrar trabajo en vuelo. Es el momento correcto para S.6.

Nada de esto reemplaza harness, executors, checks, QA, worktrees ni gates. Añade una capa
de coordinación **encima** de lo que ya funciona.

## F. Experimento de una semana

Presupuesto y modelo: los fijas tú antes de empezar (regla NO NEGOCIABLE).

**Día 1 — Dogfood mínimo (cero código).**
Meter 3 ítems ⚡ reales en `tasks.yaml` — sugeridos: `H.7.2c` (adaptador OpenCode),
`S.5` (`bun run next`) y un tercero que **dependa** de S.5 — con `depends_on` real,
`acceptance_criteria` y `checks`. Correr `orchestos run --graph --max-cost <X> --max-minutes <Y>`
y no tocar el teclado.
*Criterio:* ≥1 tarea `done` con `qa_verdict='pass'`, fila en `runs`, commit real, y el
descendiente ejecutándose **después** de su dependencia. Falla el criterio si tuviste que
intervenir; el motivo de la intervención es el resultado más valioso del día.

**Día 2 — Verdad de la métrica.**
Renombrar `autonomy_metric` → `completion_rate` y añadir `human_interventions` +
`unattended_minutes`. ~30 líneas. Sin esto, el resto de la semana no es medible.

**Día 3–4 — R.7 ampliado (Fase 1).**
Atomicidad + `owner`/`lease_until`/`heartbeat_at`. Test con **procesos reales**, como ya
exige el gate del ítem: dos procesos actualizan tareas distintas sin pérdida; sobre la
misma tarea, uno gana y el otro recibe rechazo explícito; `kill -9` a mitad de escritura
deja YAML válido; lease vencido reclamable.
*Criterio:* los 4 tests pasan con procesos reales, no mocks. Y `L62-001` cerrado o
mitigado (migración bajo lock).

**Día 5 — Worker loop con N=1 (Fase 2).**
`orchestos work` corriendo contra el mismo `tasks.yaml`. Comportamiento idéntico a hoy.
*Criterio:* cierra los mismos ítems que el graph runner, con la misma evidencia.

**Día 6 — N=2.**
Dos workers, dos ítems ⚡ con scope disjunto declarado.
*Criterio:* los timestamps de `runs.created_at` **se solapan**. Ese es el primer dato duro
de concurrencia que este proyecto habrá producido. Cero pérdidas en `tasks.yaml`.

**Día 7 — Prueba de ausencia.**
Presupuesto acotado, 4 h sin tocar nada.
*Criterio (§35):* ≥2 commits de ítems distintos, cada uno con `qa_verdict='pass'`, y al
menos un lease expirado y recuperado en el log.

**Criterio de fracaso honesto:** si al día 3 el día 1 no dio ni una tarea completada sin
intervención, **para la fase 1 y arregla el recorrido** — R.8 existe exactamente para eso.
Paralelizar un recorrido que no funciona multiplica el fallo.

## G. Hábitos a abandonar

1. Cerrar ítems de OrchestOS tecleando en un CLI cuando el ítem es ⚡ y especificable.
2. Ser el bus de mensajes entre agentes ("ya terminó Codex, ahora revisa Claude").
3. Escribir orden y dependencias como prosa (`"R.1 → R.2 → …"`) en vez de como datos.
4. Aceptar `[x]` sin fila en `runs` para ítems que el sistema podría haber ejecutado.
5. Usar `tasks.yaml` como demo de páginas de cripto.
6. Nombrar cosas por lo que quieres que sean (`autonomy_metric`, test `parallel`).
7. Preguntarte "¿qué sigue?" leyendo 140 KB de PLAN.md.
8. Tratar "evitar conflictos" como decisión cerrada cuando ya tienes lock y leases.

## H. Hábitos a adoptar

1. **Regla dura: todo ítem ⚡ entra por `tasks.yaml`.** Si no puedes especificarlo para el
   sistema, no está listo para delegarlo a nadie.
2. Cargar `depends_on` real al abrir cada bloque — es la mitad del trabajo del scheduler.
3. Una decisión repetida dos veces igual se convierte en query.
4. Toda corrida desatendida lleva `--max-cost` y `--max-minutes` obligatorios.
5. Medir intervenciones humanas por tarea; que baje esa curva es el objetivo real.
6. Empezar cada sesión con `bun run next` (cuando S.5 exista), no leyendo PLAN.md.
7. Al declarar un ítem, declarar su `scope` como glob — el guard de H.4.1 ya existe y es
   lo que después permite decidir si dos ítems pueden ir a la vez.
8. Reservar tu atención para 🧠 y 🔍. Si estás mirando un ⚡, algo falló antes.

## I. PLAN.md: mantener / modificar / reordenar

**Mantener sin cambios**
- `S.4` — sin el gate de desincronización, S.3 es decoración (lo dice el propio ítem).
- `S.5` — es literalmente la query `ready` aplicada al plan. Alto valor, bajo costo.
- `R.8` — validación independiente del recorrido. Es el criterio de fracaso del día 3.
- `H.5.3` — sigue gated por ti. Correcto.
- `UI.8.*`, `UI.4`, `I.5`, `I.6`, `I.7` — detrás. Ninguno bloquea autonomía.

**Modificar**
- **`R.7` — ampliar el alcance.** Hoy dice "no perder actualizaciones". Necesita además
  `owner`/`lease_until`/`heartbeat_at` y semántica de reclamo. Sin eso resuelve la corrupción
  pero no habilita workers. Mantener su propia restricción ("no migrar la cola a SQLite")
  — es correcta. Añadir a su gate: la migración concurrente (`L62-001`) no revienta.
- **`S.6` (Sprint Board)** — mantener el ítem, pero su valor se multiplica después de la
  Fase 2: un board de un sistema que no ejecuta muestra casillas; uno de un sistema con
  workers muestra trabajo. Sugerido: mover detrás del worker loop, o incluir eventos en vivo
  en su alcance desde ya.
- **`H.10.2`** — subir prioridad. Es tu único agente que trabaja sin ti; cerrar sus 5
  defectos y activar el LaunchAgent es la prueba más barata de "el sistema sigue sin Carlos".
- **`L62-001`** — hoy es un hallazgo en `docs/security-manual-review.md`. Pasa a bloqueante
  de la Fase 1 y merece ítem propio.

**Reordenar (propuesta, requiere tu GO)**
```
1. Día-1 dogfood (ítem nuevo, cero código)
2. R.7 ampliado + L62-001        ← desbloquea todo lo demás
3. S.4 → S.5
4. H.10.2 (cerrar + activar)
5. Worker loop (bloque nuevo)
6. S.6 con eventos en vivo
7. R.8
8. H.5.3 (baseline, ya con recorrido real)
9. UI.8.* / UI.4 / I.5–I.7
```

**Ítems nuevos que propongo (NO los agrego sin tu confirmación):**
`X.1` métrica honesta (renombrar + intervenciones); `X.2` worker loop `orchestos work`;
`X.3` supervisor/daemon; `X.4` canal de eventos SSE.

## J. Qué NO implementar todavía

- Paralelismo antes de R.7. Perderías actualizaciones de `tasks.yaml` y romperías la
  inferencia `AR.1` — un bug de datos, difícil de ver, en el archivo que es tu fuente de verdad.
- Migrar la cola a SQLite. R.7 ya lo excluye y tiene razón: `tasks.yaml` versionado es una
  ventaja (diff, historia, revisión), no una deuda.
- Un scheduler "inteligente" que decida prioridades con un LLM. La topología basta.
- Auto-asignación de agente por modelo/costo. `🧠/⚡/🔍` ya es esa señal, y
  `feedback-deteccion-no-decision-automatica` prohíbe cambiar el motor en silencio.
- Reintentos ilimitados o auto-merge de conflictos semánticos.
- Workers en otra máquina, colas distribuidas, contenedores.
- S.6 antes de tener eventos que mostrar.
- Refactor de `cli.ts`/`harness.ts` por tamaño (PLAN.md ya lo dice: el tamaño no demuestra un bug).

## K. Conclusión

**Lo que te bloquea no es la arquitectura de OrchestOS.** Es real donde importa: worktrees,
git-lock entre procesos, leases (para chat), checks, QA, adversarial, refuter, circuit
breakers, evidencia durable en `runs`, y una batería de gates que la mayoría de los proyectos
de este tamaño no tiene. Y la documentación es honesta: el README dice que no es autónomo.

Lo que te bloquea es que **nunca ejecutaste una sola tarea de OrchestOS a través de
OrchestOS**. 10 tareas de demo, 0 aristas de dependencia, 21 runs no-chat en toda la vida
del proyecto, ninguna `implement` desde el 19 de agosto, contra 44 ítems de plan cerrados a
mano. La serialidad es un síntoma; la causa es que el producto nunca se apuntó a sí mismo,
así que las carencias que lo impedirían (R.7, claim/lease, loop) nunca se volvieron urgentes
— nada las presionaba.

Tu pregunta raíz —*¿qué retengo por humano y qué por falta de mecanismo?*— tiene esta
respuesta medida:
- **Genuinamente humano:** objetivo, presupuesto, modelo, irreversibles, aceptación 🔍 visual,
  y declarar las dependencias del plan.
- **Retenido por falta de mecanismo:** cuál es el siguiente ítem (falta S.5), quién lo toma
  (falta claim/lease, R.7), cuándo arranca (falta el loop), si dos pueden ir a la vez (faltan
  las aristas, que son datos, no código).
- **Retenido por costumbre, sin ninguna barrera técnica:** arrancar cada ítem tú mismo.

**Siguiente paso concreto, hoy, sin escribir una línea de código:**
elegir 3 ítems ⚡ reales del PLAN.md, escribirlos en `tasks.yaml` con `depends_on`,
`acceptance_criteria` y `checks`, fijar modelo y `--max-cost`, correr
`orchestos run --graph`, y no tocar el teclado hasta que termine.

Ese experimento cuesta menos que esta auditoría y responde lo único que ninguna lectura de
código puede responder: **si el recorrido completo funciona sobre trabajo real.** Todo lo
demás —R.7, workers, daemon, eventos— es prematuro hasta tener ese dato.
