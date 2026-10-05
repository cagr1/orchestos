# OrchestOS — Instrucciones para Codex / LLMs

## Regla cero — protocolo común obligatorio

Estas reglas aplican a Codex, Claude, DeepSeek, OpenCode y cualquier otro agente. Antes de editar,
leer [docs/agent-work-protocol.md](docs/agent-work-protocol.md) y ejecutar:

    bun run agent:preflight -- --item <ID> --agent <nombre>

El protocolo define el orden de trabajo, los gates por tipo de cambio y las condiciones de parada.
`AGENTS.md`, `CLAUDE.md`, `PLAN.md` y el protocolo son obligatorios; ninguna instrucción específica
del host puede relajar seguridad, scope-lock, evidencia en vivo ni la prohibición de `--no-verify`.

## Identidad git — PROHIBIDO modificar

El email y nombre de git ya están configurados globalmente y son correctos.
**Nunca ejecutes** ninguno de estos comandos, ni local ni global:

```
git config user.email  ...    # PROHIBIDO
git config user.name   ...    # PROHIBIDO
git config --local ...        # PROHIBIDO salvo que el usuario lo pida explícitamente
git config --global ...       # PROHIBIDO salvo que el usuario lo pida explícitamente
```

La configuración correcta es:
- `user.email = cagr_14@hotmail.com`
- `user.name  = cagr1`

Modificarla rompe el mapa de contribuciones de GitHub silenciosamente.
Si necesitas saber el email activo, usa `git config user.email` (solo lectura).

## Reglas generales

- No uses `--no-verify` en commits salvo que el usuario lo pida.
- No hagas `git push --force` salvo instrucción explícita.
- No crees ni borres ramas remotas sin confirmación del usuario.
- Al cerrar un ítem, su evidencia va al archivo de docs/done/ del bloque en el MISMO turno, y en PLAN.md queda solo la línea del ítem con el enlace. No acumular evidencia en PLAN.md hasta el cierre del bloque: esa es la causa mecánica de que el plan crezca sin techo (S.2).
- **Memoria evolutiva obligatoria:** toda mejora de proceso, hallazgo, decisión técnica o regla
  transversal descubierta durante el trabajo debe persistirse en el mismo turno. Usa `PLAN.md` para
  cadenas activas y evidencia de ejecución, `AGENTS.md`/`CLAUDE.md` para reglas que deben obedecer los
  LLM y `CONTEXT.md` para memoria estable de arquitectura/estado. Nunca dejes conocimiento operativo
  importante solo en la conversación; al actualizar una regla, conserva el historial y no la elimines
  silenciosamente.
- Cadencia de sincronización: después de 2–3 commits locales (o cuando la rama quede con 3
  commits de ventaja sobre `origin/master`), ejecuta `git push origin master` automáticamente.
  No acumules más commits sin subir; el push normal está autorizado. `--force` sigue prohibido
  salvo instrucción explícita.

## Protocolo de delegación permanente (2026-09-09; flujo liviano 2026-09-14, decisiones de Carlos)

Rige de aquí hasta el final del desarrollo, para **cualquier** LLM que trabaje en este repo.

**El modelo fuerte planifica y verifica. El chico ejecuta.** Diagrama de Carlos (2026-09-14):

    cerebro (Opus 5 / Astra, esfuerzo medio) ── planifica y delega bajo demanda
        └─ ejecutor (Luna): código + debugging, según el spec
    cerebro (esfuerzo medio) ── integra y verifica
        └─ solo si hace falta: cerebro en esfuerzo alto ── arquitectura + revisión final

**Flujo por ítem — cuatro pasos, sin más ceremonia:**

1. **Plan (cerebro).** Abre el ítem en `PLAN.md` (qué y gate, pocas líneas) y escribe
   `docs/specs/<ID>.md` corto: qué cambiar, dónde (`archivo:línea`), qué no tocar, cómo se
   verifica. Sin decisiones de diseño pendientes. `bun run plan:reconcile` y un commit.
2. **Ejecución (Luna).** `codex exec -m gpt-6-luna --approve-for-me "Ejecuta docs/specs/<ID>.md" < /dev/null`.
   Implementa, corre sus tests y `tsc`. **No commitea ni toca `PLAN.md`.**
   (2026-09-25, MR.1.c) Lanzarla con `ORCHESTOS_ROLE=executor` y decirle en el prompt que ella es la ejecutora y
   no delega: sin eso lee este protocolo como cerebro, intenta otro `codex exec` y su sandbox lo rechaza
   (`Operation not permitted`). Para sub-ítems (`MR.1.c`) su preflight va con el padre abierto (`--item MR.1`).
   (2026-09-28, UI.13.7) En su sandbox `bun test` da 3 fallos de entorno (`adversarial-review` ×2, `EADDRINUSE`)
   y el protocolo la hace parar por "baseline rojo" sin editar nada. El cerebro corre `bun test` fuera del sandbox
   antes de lanzarla y le pasa el resultado en el prompt. (Los 5 de `brain-no-code` que también salían eran un bug
   del test, que heredaba `ORCHESTOS_ROLE=executor`; corregido en AT.14.)
3. **Integrar y verificar (cerebro).** Lee el diff, corre los gates con comandos propios y prueba
   en vivo cuando aplica. El reporte del ejecutor y su `exit 0` no son evidencia
   (`reference-codex-exec-exit-0-con-error`). Si falla, corrige el spec y re-delega — o sube a
   Terra —; nunca teclea el arreglo.
4. **Cierre (cerebro), un solo commit:** código del ejecutor + `[x]` + evidencia con
   `Ejecutado por: … · Spec: docs/specs/<ID>.md` como primera línea indentada + `Gate en vivo:`
   si toca dashboard/config + borrado del spec. Es lo que ya exigen `scripts/plan-gate.ts` y
   `scripts/check-live-gate.ts`; por eso el ejecutor no commitea solo.

**Presupuesto de delegación (2026-09-14, incidente medido):** una sesión de Codex pasó de 54% a
71% de su ventana de 5 h mientras tres subagentes fuertes heredaban el historial completo. Desde
ahora hay un máximo de **dos subagentes activos simultáneos por sesión raíz**, sin contar al agente
raíz. Antes de delegar, consultar los agentes activos; no abrir un tercero hasta que uno termine.
En Codex, usar `gpt-6-luna` por defecto y `fork_turns: "none"` o el menor entero positivo que
alcance: `fork_turns: "all"` queda reservado para una necesidad explícita y documentada. Si el
cupo de 5 h ya está en 70% o más, no abrir subagentes salvo pedido explícito de Carlos; hacer la
lectura local directamente y dejar la ejecución para Luna después del reset. Esto es enforcement
narrativo en Codex porque el repo no puede interceptar la herramienta `spawn_agent` del host; el
ítem AT.8 agrega el diente mecánico equivalente donde Claude Code sí expone hooks de subagentes.

Historial: la versión del 2026-09-09 exigía commits del ejecutor, specs con árbol de decisiones
y verificación por checkout aun en fixes chicos; ese peso empujaba al cerebro a teclear
(evaluación 2026-09-14). Texto anterior en `git log -p AGENTS.md`.

**Sandbox de Codex y la DB del plan (2026-09-10, medido en S.8):** el sandbox `workspace-write`
solo deja escribir dentro del repo, y la DB de OrchestOS vive en `~/.orchestos`. Cualquier ítem
delegado a Codex que toque el plan se bloquea en el `bun run plan:reconcile` obligatorio con
`SQLiteError: attempt to write a readonly database`. Se resuelve acotando el permiso a esa sola
ruta — nunca con `danger-full-access`:

    codex exec -m <modelo> -s workspace-write \
      -c 'sandbox_workspace_write.writable_roots=["/Users/<user>/.orchestos"]' "<prompt>" < /dev/null

`--approve-for-me` y `-s` son mutuamente excluyentes: al usar `-s` se cae el primero.
Los ítems 🧠 los **diseña** el cerebro y los **ejecuta** un delegado siguiendo el spec.
Los gates 🔍 se verifican en vivo, contra el sistema real corriendo, nunca contra mocks.

### Roster de modelos (Carlos, 2026-09-09 — regla de hecho, no sugerencia)

| Rol | Modelos | Qué puede hacer |
|---|---|---|
| **Cerebro** | Opus 5 · Fable 5.1 · `gpt-5.6-sol` · `gpt-6-astra` | pensar, abrir el ítem en PLAN.md, escribir el spec, verificar con comandos. **Nunca escribe código de producto** |
| **Ejecutor por defecto** | `gpt-6-luna` (`codex exec`) | ⚡ y 🧠 ya especificados |
| **Ejecutor con criterio** | `gpt-5.6-terra` | 🧠 cuyo spec no logró eliminar todas las decisiones |
| **Excepción** | Sonnet, vía Claude CLI | solo si terra no alcanza |
| **Fuera por ahora** | opencode / DeepSeek | — |

**La regla no admite excepción por complejidad.** Un ítem 🧠 difícil no habilita al cerebro a
teclear: el cerebro deja la ruta anotada en el spec y **la dificultad cambia el ejecutor**
(luna → terra → Sonnet), nunca quién escribe. Si el ejecutor tiene que decidir algo, el defecto
está en el spec, no en el ejecutor — se reescribe el spec, no se toma el teclado.

Sí es trabajo de cerebro, y no cuenta como escribir código: editar `PLAN.md`, `AGENTS.md`,
`CLAUDE.md`, `CONTEXT.md`, `docs/specs/*` y `docs/*.md` de análisis; y ejecutar comandos de
lectura, consultas a la DB, gates y scripts ya existentes para verificar.

Transporte: los tres CLI (`claude` · `codex` · `opencode`), no la API.
El modelo de cada corrida real lo fija Carlos y ningún LLM lo hereda de memoria
(`feedback-modelo-decision-final-carlos`, NO NEGOCIABLE — incidente de $5.00 del 2026-07-13).
Nota de deuda separada: `orchestos.config.yaml` todavía declara `deepseek/deepseek-v4-flash` y
proveedor `openrouter`; ese archivo gobierna a OrchestOS-como-producto (qué modelo usa el harness
al correr una tarea de `tasks.yaml`), **no** al desarrollo de este repo, y se migra a los tres CLI
en su propio ítem.

**Diente mecánico (AT.1, 2026-09-14):** `.claude/hooks/brain-no-code.js` (`PreToolUse`) bloquea
en sesiones de Claude Code las ediciones sobre `src/`, `tests/`, `scripts/` y `.claude/hooks/`,
incluidas las escrituras por redirect/`tee`/`sed -i`. El Sonnet de excepción se lanza con
`ORCHESTOS_ROLE=executor`. Desde AT.14 también bloquea scripts inline de intérprete (`python -c`, `bun -e`,
heredoc) que escriben a una ruta de código escrita como literal (`hasInlineCodeWrite`). Límites declarados: no
aplica a sesiones de Codex (Astra como cerebro se rige por este texto) ni a rutas calculadas en runtime. Al cierre, el
gate de procedencia de S.4b sigue exigiendo `Ejecutado por:` y el borrado del spec.

**Ciclo de vida del spec:** `docs/specs/<ID>.md` nace al delegar y **se borra en el commit que
cierra el ítem** — para entonces su contenido vive en el código y su evidencia en `docs/done/`.
Un spec de un ítem cerrado es basura acumulada; es el patrón que S.2 vino a eliminar.

Mecánica del commit de cierre (medido en I.7.1, 2026-10-03; costó 6 intentos):
- El spec debe estar **commiteado antes** (con el delegado o en un `docs(<ID>): spec`): el gate exige verlo como
  borrado (`D`) en el diff de cierre; un spec nunca commiteado no cuenta.
- `plan:reconcile` marca el ítem `done` en la DB en la primera corrida; si luego editas su evidencia, el
  siguiente reconcile falla con `Could not prove a closing commit SHA`. Salida: volver el ítem a `[ ]`,
  reconcile, `[x]`, reconcile.
- El cierre de dashboard/config exige `Gate en vivo: navegador real (Playwright), \`docs/done/evidence/<ID>-live.json\``
  con ese archivo staged en el mismo commit.
- Un delegado que corre `agent:preflight --scope` deja `.orchestos/active-item.json` (ignorado por git) con su
  scope de ronda; el scope-lock del cierre lo usa. Revisarlo antes de commitear.

### Lecciones operativas de delegación y ui-gate (migradas de NEXT.md, 2026-10-05)

Medidas en los lotes L1–L4 y los ítems de Sprint 30/ERP/I/CX; cada una costó al menos una ronda perdida.

- **Preflight.** Solo reconoce ítems de **primer nivel** (`^- [ ] **ID`, `findOpenPlanItem`,
  `scripts/agent-governance.ts`): un sub-ítem con sangría lo bloquea; usar el padre (`--item MR.1`) o abrir el
  sub-ítem como línea propia antes de lanzar al ejecutor. `--scope` necesita globs (`src/dashboard/**`; un directorio
  pelado no cubre sus archivos) e incluir `NEXT.md` y `.orchestos/feature-status.json`. No se puede re-correr sobre un
  ítem ya `[x]`: si el scope quedó corto, añadir la línea `**Fuera de scope declarado:**` en el ítem.
- **Línea de procedencia.** `Ejecutado por: … · Spec: docs/specs/<ID>.md` debe terminar en la ruta (sin texto
  después) o el plan gate exige borrar el spec. Commitear el spec al lanzar al ejecutor, no al cerrar.
- **Prompt de Luna.** Añadir "No invoques `codex exec` ni delegues a otro agente" (se anidó sola) y lanzarla siempre
  con `< /dev/null` (sin eso queda colgada en "Reading additional input from stdin…"). Matar procesos por PID, nunca
  `pkill -f "<patrón>"` si una tarea en segundo plano lleva ese texto en su línea de comandos.
- **Luna afirma cosas falsas** ("DB aislada", "lint preexistente", "typecheck PASS" con solo el tsc raíz, "gate:all
  falló" por el sandbox): verificar siempre, exigir `bun run typecheck` completo (dos tsconfig), leer su diff completo,
  auditar los `step()` de cada flujo (un 14/14 puede traer pasos vacíos) y revisar `.orchestos/active-item.json`
  (re-corre el preflight y estrecha el scope) antes de commitear. Omite asserts que no se le exigen y puede inventar
  campos de API.
- **Flujos `scripts/ui-gate/flows/`.** `ui:gate` sin lista de flujos no corre nada (la del pre-push está en
  `scripts/pre-push.sh`). Tras tocar flujos: `bunx biome lint --only=correctness/noUndeclaredVariables
  scripts/ui-gate/flows`. Flujo nuevo = `page.reload` tras registrar el proyecto; `ctx.hidden()` para "desaparece"
  (`visible()` espera a que aparezca). Todo `api()` a rutas con scope (runs, memory, instincts, skills, tasks,
  chat/sessions) manda `x-orchestos-project-id` o `?project=none`; sin selector el back usa el cwd del servidor (y
  una reproducción por API sin el header escribe en el `tasks.yaml` de ESTE repo: buscar el proyecto por `realpath`).
  Fin de turno = respuesta de `POST /api/chat`, no composer vacío ni clic manual. La DB del gate es la real: todo
  flujo borra lo que siembra y el cerebro lo verifica por consulta.
- **Tareas de fixture.** `engine: codex` + `executor_model: openai/gpt-5.6-luna` (modelo de Luna al 2026-09-23; hoy `gpt-6-luna`), nunca `executor: codex` (exige
  `OS_ENABLE_EXEC_CODEX`); la tarea debe modificar su output o el QA la devuelve a `pending`. Un QA fallido no cambia
  el status: fin de run = status, `retryCount` o `runId` distintos.
- **Flakiness bajo carga.** `chat-sessions.test.ts` (timeout 5 s, subprocesos) y `context-adapters` fallan por carga
  si corre otro proceso pesado: repetir en frío antes de culpar al diff. `usage-bar` falla a veces porque
  `codex app-server` no responde `account/rateLimits/read` en 3 s (`scripts/context-adapters.ts`); los
  `rollout-*.jsonl` de `~/.codex/sessions` traen `rate_limits` y son candidato a fallback.

## Trabajo en equipo (Claude + Codex, en paralelo)

Carlos trabaja este repo con Claude y Codex a la vez, cada uno en su propia sesión (posiblemente
en un worktree/rama separada). No te va a decir "hacé el ítem X" cada vez — el punto de partida
SIEMPRE es `PLAN.md`. Antes de tocar código:

1. **Leé `PLAN.md` primero.** Es la fuente de verdad de qué falta y en qué orden. Cada ítem abierto
   (`- [ ]`) tiene una etiqueta: `🧠` (requiere criterio de diseño), `⚡` (mecánico, bien
   especificado), `🔍` (gate de revisión). **Agarrá SOLO ítems `⚡`** — los `🧠`/`🔍` son de Claude.
   Si un `⚡` te bloquea porque depende de un `🧠` sin cerrar, PARÁ y decilo, no lo hagas en caliente.
2. **Scope-lock**: ejecutá EXACTAMENTE el ítem que agarraste — nada adyacente, ningún "ya que
   estoy, aprovecho y arreglo esto otro también". Si ves algo fuera de scope que amerita
   arreglarse, anotalo, no lo toques en la misma pasada.
3. **Commit por ítem cerrado**, marcando `[x]` en `PLAN.md` en el mismo commit — así el otro agente
   (o Carlos) ve en `git log`/`PLAN.md` qué ya está tomado, sin necesitar coordinación en vivo.
   Excepción: si ejecutas un `docs/specs/<ID>.md` escrito por el cerebro, no commiteas; el cierre
   es suyo (§ Protocolo de delegación, paso 4).
4. **No pises lo que no es tuyo**: si un ítem `⚡` ya tiene evidencia de que otro agente lo está
   trabajando (branch activo, commit reciente sin mergear), no lo dupliques — avisá.
5. Antes de escribir código nuevo, correr `bunx tsc --noEmit` y la suite de tests relevante — igual
   criterio que ya pide el pre-commit hook, pero verificalo vos ANTES de terminar, no dejes que el
   hook sea la primera vez que se entera de un error de tipos.

## Estado tomable

La sección fechada “Qué está listo para tomar ahora (2026-07-30)” fue retirada el 2026-08-17 porque
había quedado obsoleta mientras `PLAN.md` ya estaba en Sprint 29. Desde ahora el estado se deriva en
cada preflight de los ítems abiertos de `PLAN.md`; nunca se duplica aquí un snapshot que pueda mentir.

## Estado activo: Bloques R, H y UI (2026-09-08)

`PLAN.md` está en Sprint 30. El Bloque R mantiene abiertos R.6–R.8; H mantiene H.10.2 abierto; y la
dirección visual activa está en UI.8.1–UI.8.6. Leer el bloque completo en `PLAN.md` antes de
agarrar un ítem: cada uno trae su gate y sus condiciones de parada propias.

Los huecos H.1 de documentación/configuración ya están cerrados. Sus advertencias históricas se
conservan en `PLAN.md`, pero no describen trabajo disponible actualmente.

Dos advertencias sobre ese bloque:

1. **`H.1.2` puede escalar a 🧠.** Si `src/spec/constitution.ts` no alcanza como fuente para
   redactar `CONSTITUTION.md`, PARAR y reportarlo en vez de inventar principios. Un archivo de
   gobierno con contenido improvisado es peor que uno vacío.
2. **`H.1.4` exige verificar antes de borrar.** Los artefactos (`demo/`, `runs/*.log`,
   `test-project/`) pueden estar referenciados por un test o por `tasks.yaml`. Comprobarlo
   primero; se sacan del índice de git, **no del disco**.

## Marco de harness engineering (referencia, 2026-09-01)

El repo se auditó contra los cinco subsistemas de un harness — **instrucciones, estado,
verificación, alcance, ciclo de sesión** — usando fuentes primarias de Anthropic, OpenAI,
Thoughtworks/Fowler y LangChain. Informe completo en el vault:
`outputs/2026-09-01-harness-engineering-a-fondo.md`.

Tres principios de ese marco que ya rigen acá y conviene nombrar:

- **`Agente = Modelo + Harness`** (Fowler). Cuando un agente falla de forma repetida en este
  repo, la causa más probable es el entorno, no el modelo. Auditar los cinco subsistemas antes
  de proponer cambiar de motor o subir de modelo (`INS-2026-015`).
- **Mover controles de inferencial a computacional siempre que se pueda.** Un linter que impide
  escribir el error vale más que un agente de review que lo detecta después: es determinista,
  barato y no consume contexto. Es la razón de ser de `H.2.1`.
- **Un harness se poda, no se acumula.** Anthropic eliminó sus propios sprints obligatorios y
  movió el evaluador a una sola pasada final cuando el modelo mejoró: *"cada componente de un
  harness codifica una suposición sobre lo que el modelo no puede hacer solo, y esas
  suposiciones vale la pena someterlas a prueba"*. Antes de agregar un gate nuevo, verificar
  que la suposición que codifica siga siendo cierta.

Anti-patrón relevante para el trabajo en equipo de este repo: **un agente que califica su
propio trabajo tiende a elogiarlo con confianza aunque la calidad sea obviamente mediocre**
(Anthropic). Por eso los 🔍 son de Claude aunque haya implementado Codex, y por eso la
evidencia de un gate no puede ser la afirmación del mismo agente que lo implementó.

## Hooks

Instalar o reparar ambos hooks con un único comando portable para repo principal y worktrees:

    bun run hooks:install

Validar sin modificar:

    bun run hooks:check

## Evidencia de gates reales del harness (CC.0-D6)

Todo gate en vivo que ejecute tareas reales con un `ORCHESTOS_HOME` temporal debe usar el wrapper
oficial; no crear y borrar el home temporal a mano:

    bun run gate:evidence -- --label <gate-id> -- <comando> [args...]

El wrapper mantiene aislada la ejecución y, antes del cleanup, copia los runs no-chat a la DB
durable con `task_class=gate:<gate-id>:<clase-original>`. Deduplica por `run.id` y pone
`project_id=NULL` para no filtrar registros de proyectos desechables. Si la exportación falla,
conserva el temporal y devuelve error: nunca borrar la única evidencia para hacer pasar un gate.
`ORCHESTOS_EVIDENCE_HOME` permite elegir explícitamente la DB durable; en su ausencia usa el
`ORCHESTOS_HOME` estable del proceso o el home del usuario. Tests unitarios/CI que no hacen una
corrida real del harness no se exportan ni cuentan como uso real.

## Estado operativo de seguridad (2026-07-29)

L.0–L.6.1 del baseline están cerrados. L.6.2 sigue abierto: la revisión CLI/HTTP inicial y sus
límites viven en `docs/security-manual-review.md`; falta una sesión con navegador para la revisión
visual y los flujos manuales de ejecución/worktree/diagnóstico/exportación. Hallazgos pendientes
`L62-001` (migración concurrente) y `L62-002` (provider key persistida antes de validación). No
corregirlos fuera de un ítem explícito de `PLAN.md`.

## Invariantes de arquitectura permanentes

Recuperados el 2026-08-17: vivían solo en `CONTEXT.md` y se perdieron en un regen manual. Portados
acá porque `CONTEXT.md` nunca es la fuente, solo un derivado — y porque `orchestos context update`
resultó tener un bug real (sobreescribe `AGENTS.md` con una plantilla autodetectada genérica en vez
de leerlo como fuente; ver PLAN.md, ítem de hallazgo 2026-08-17). No volver a correr ese comando
hasta que el bug esté arreglado.

**Invariante QA**: cuando una tarea tiene criterios de aceptación, `runQA` solo puede devolver
`pass` si la respuesta del proveedor contiene exactamente un resultado por criterio y cada
criterio aprobado tiene evidencia literal real en el archivo indicado. Una respuesta incompleta,
malformada o con cardinalidad incorrecta debe fallar de forma segura; una respuesta JSON que no
sea un objeto también debe fallar de forma segura. No relajar esta regla para mejorar el mutation
score.

**Invariante roadmap** (Bloque M, Sprint 24): `docs/roadmaps/` (universal → disciplina → lenguaje →
project-profile) nunca marca `verified` sin un comando real ejecutado y su salida citada; sin
evidencia, el estado correcto es `known` (conocimiento general) o `missing` (se buscó y no está)
— nunca un `pass` implícito. `orchestos roadmap check` es determinista y evidence-based: cero
heurísticas que inventen `detected` sin una señal real de filesystem/código. Límites conocidos, no
bugs a esconder: (1) no existe mecanismo que provisione `docs/roadmaps/` dentro de un proyecto
NUEVO — `orchestos init` no lo hace. (2) el presupuesto de contexto de `loadRoadmapContext` (12k
chars) no alcanza para las 6 disciplinas + lenguajes de OrchestOS mismo — se recorta con `missing`
visible, nunca en silencio, pero el recorte es real. Pendientes de decisión de Carlos antes de
ampliarse a proyectos externos reales.

**Invariante contrato de skill** (2026-07-30): un campo del YAML de una skill (`skills/*.yaml`)
solo llega al LLM si está en los tres puntos: `SkillDef` y `validateSkill()`
(`src/skills/registry.ts`) y **`buildSections()`** (`src/skills/targets/_shared.ts`) — este
último es el ÚNICO renderer skill→prompt, compartido por los tres targets
(`claude`/`cursor`/`openai`). `validateSkill()` **no rechaza campos desconocidos**: un campo mal
cableado carga sin error y se descarta en silencio — el modo de fallo es contenido muerto, no una
excepción. Si la skill se crea o importa por el dashboard, el contrato descrito al LLM curador
(`src/dashboard/prompts/curator.ts`) debe incluirlo o toda skill importada nace sin ese campo. El
orden de las secciones dentro de `buildSections()` es parte del contrato — es el orden en que el
modelo lee la skill.

## Roster de modelos y alias de Codex (2026-09-11)

Regla para CUALQUIER LLM que trabaje en este repo (Claude, Codex, DeepSeek, OpenCode) — no se
vuelve a preguntar por sesión ni por tab.

**Alias de Codex.** Cuando Carlos dice "Luna", "Terra", "Sol" o "Astra" se refiere a modelos de
Codex, no a agentes ni a personas. IDs confirmados el 2026-09-11 leyendo los rollouts de
`~/.codex/sessions`:

- Luna = `gpt-6-luna` (Luna 6; desde 2026-09-24 por decisión de Carlos — antes `gpt-5.6-luna`)
- Terra = `gpt-5.6-terra`
- Sol = `gpt-5.6-sol`
- Astra = `gpt-6-astra`

Se invocan con `codex exec -m <id>`.

**Roles y flujo:** una sola fuente, § "Protocolo de delegación permanente" arriba (unificado el
2026-09-14; esta sección repetía el roster con otra redacción). Motivo que se conserva: el cupo
de un CLI de suscripción se agota por gastar el modelo caro en tokens que uno barato produce
igual de bien.
