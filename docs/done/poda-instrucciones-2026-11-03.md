# HISTÓRICO — AGENTS.md y NEXT.md antes de la poda del 2026-11-03 (DOC.6)

> No es orden vigente. Copia íntegra de los dos archivos tal como estaban en `7df5ee18` (encabezados bajados un nivel). Las reglas vigentes
> están en `AGENTS.md`; el lote actual, en `NEXT.md`. Auditoría de la poda: Sol (`analizar`), 2026-11-03.

## AGENTS.md (original)

## OrchestOS — Instrucciones para Codex / LLMs

### Regla cero — protocolo común obligatorio

Estas reglas aplican a Codex, Claude, DeepSeek, OpenCode y cualquier otro agente. Antes de editar,
leer [docs/agent-work-protocol.md](docs/agent-work-protocol.md) y ejecutar:

    bun run agent:preflight -- --item <ID> --agent <nombre>

El protocolo define el orden de trabajo, los gates por tipo de cambio y las condiciones de parada.
`AGENTS.md`, `CLAUDE.md`, `PLAN.md` y el protocolo son obligatorios; ninguna instrucción específica
del host puede relajar seguridad, scope-lock, evidencia en vivo ni la prohibición de `--no-verify`.

### Identidad git — PROHIBIDO modificar

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

### Reglas generales

- Todo texto visible nuevo de UI debe declararse en `Texto visible:` del ítem de `PLAN.md`, con por qué no basta un ícono; `bun run ui:text-gate` lo exige en pre-commit (UI.59).

- No uses `--no-verify` en commits salvo que el usuario lo pida.
- No hagas `git push --force` salvo instrucción explícita.
- No crees ni borres ramas remotas sin confirmación del usuario.
- Al cerrar un ítem, su evidencia va al archivo de docs/done/ del bloque en el MISMO turno, y en PLAN.md queda solo la línea del ítem con el enlace. No acumular evidencia en PLAN.md hasta el cierre del bloque: esa es la causa mecánica de que el plan crezca sin techo (S.2).
- **Un commit por ítem, `NEXT.md` por lote (Carlos, ERP.5, 2026-10-19).** Spec, código, evidencia, marca en `PLAN.md`
  y borrado del spec van en UN commit; el spec no se commitea aparte (reemplaza "commitear el spec al lanzar al
  ejecutor"). `NEXT.md` se toca solo al cerrar o cortar un lote, y guarda orden y trampas vivas, no historia de
  cerrados (eso vive en `PLAN.md` y git). Motivo medido: 266 de 447 commits desde 2026-09-19 solo tocaban
  documentos de proceso (`docs/done/ERP.5.md`).
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

### Protocolo de delegación permanente (2026-09-09; flujo liviano 2026-09-14, decisiones de Carlos)

Rige de aquí hasta el final del desarrollo, para **cualquier** LLM que trabaje en este repo.

**El modelo fuerte planifica y verifica. El chico ejecuta.** Diagrama de Carlos (2026-09-14):

    cerebro (sesión principal, esfuerzo medio) ── planifica y delega bajo demanda
        └─ ejecutor (rol `mecanico`): código + debugging, según el spec
    cerebro (esfuerzo medio) ── integra y verifica
        └─ solo si hace falta: cerebro en esfuerzo alto ── arquitectura + revisión final

**Flujo por ítem — cuatro pasos, sin más ceremonia:**

1. **Plan (cerebro).** Abre el ítem en `PLAN.md` (qué y gate, pocas líneas) y escribe
   `docs/specs/<ID>.md` corto: qué cambiar, dónde (`archivo:línea`), qué no tocar, cómo se
   verifica. Sin decisiones de diseño pendientes. `bun run plan:reconcile` y un commit.
2. **Ejecución (rol `mecanico`).** `~/.agent-method/bin/delegate mecanico docs/specs/<ID>.md` (AT.15, 2026-10-11:
   el script pone modelo, esfuerzo, sandbox, `< /dev/null`, el prompt de ejecutor y `ORCHESTOS_ROLE=executor`).
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
   (`reference-codex-exec-exit-0-con-error`). Si falla, corrige el spec y re-delega — o sube al
   rol `criterio` —; nunca teclea el arreglo.
4. **Cierre (cerebro), un solo commit:** código del ejecutor + `[x]` + evidencia con
   `Ejecutado por: … · Spec: docs/specs/<ID>.md` como primera línea indentada + `Gate en vivo:`
   si toca dashboard/config + borrado del spec. Es lo que ya exigen `scripts/plan-gate.ts` y
   `scripts/check-live-gate.ts`; por eso el ejecutor no commitea solo.

**Presupuesto de delegación (2026-09-14, incidente medido):** una sesión de Codex pasó de 54% a
71% de su ventana de 5 h mientras tres subagentes fuertes heredaban el historial completo. Desde
ahora hay un máximo de **dos subagentes activos simultáneos por sesión raíz**, sin contar al agente
raíz. Antes de delegar, consultar los agentes activos; no abrir un tercero hasta que uno termine.
En Codex, usar el modelo del rol `mecanico` por defecto y `fork_turns: "none"` o el menor entero positivo que
alcance: `fork_turns: "all"` queda reservado para una necesidad explícita y documentada. Si el
cupo de 5 h ya está en 70% o más, no abrir subagentes salvo pedido explícito de Carlos; hacer la
lectura local directamente y dejar la ejecución para el rol `mecanico` después del reset. Esto es enforcement
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

#### Roster de modelos (Carlos, 2026-09-09 — regla de hecho, no sugerencia)

**Desde AT.15 (2026-10-11) este repo no nombra modelos.** Qué modelo hace cada rol vive en un solo
archivo, `~/.agent-method/roster.conf`, y se delega con `~/.agent-method/bin/delegate <rol> <spec>`:

| Rol | Cuándo |
|---|---|
| **Cerebro** (sesión principal) | pensar, abrir el ítem en PLAN.md, escribir el spec, verificar con comandos y corregir. **Nunca escribe código de producto** |
| `mecanico` | ⚡ y 🧠 ya especificados |
| `criterio` | 🧠 cuyo spec no logró eliminar todas las decisiones, o una corrección reveló un fallo de razonamiento |
| `criterio-alt` | `criterio` falló dos veces o el cupo de Claude aprieta; lo revisa el cerebro, no `qa` |
| `qa` | revisión independiente, de otro proveedor que quien produjo |
| `investigar` | buscar en internet o leer a fondo, con spec de qué se necesita; no edita |
| `astra` | solo por pedido explícito de Carlos |

Historial: la tabla del 2026-09-09 nombraba modelos (Terra como ejecutor con criterio, Sonnet como
excepción) y convivía con otras tres que la contradecían. Texto anterior en `git log -p AGENTS.md`.

**La regla no admite excepción por complejidad.** Un ítem 🧠 difícil no habilita al cerebro a
teclear: el cerebro deja la ruta anotada en el spec y **la dificultad cambia el ejecutor**
(`mecanico` → `criterio` → `criterio-alt`), nunca quién escribe. Si el ejecutor tiene que decidir algo, el defecto
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
incluidas las escrituras por redirect/`tee`/`sed -i`. Todo ejecutor se lanza con
`ORCHESTOS_ROLE=executor`, que `bin/delegate` pone solo; un subagente del Agent tool no lo hereda y queda bloqueado. Desde AT.14 también bloquea scripts inline de intérprete (`python -c`, `bun -e`,
heredoc) que escriben a una ruta de código escrita como literal (`hasInlineCodeWrite`). Límites declarados: no
aplica a sesiones de Codex (su cerebro se rige por este texto) ni a rutas calculadas en runtime. Al cierre, el
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

#### Lecciones operativas de delegación y ui-gate (migradas de NEXT.md, 2026-10-05)

Medidas en los lotes L1–L4 y los ítems de Sprint 30/ERP/I/CX; cada una costó al menos una ronda perdida.

- **(2026-10-15)** (1) El spec que va a `mecanico` (Codex) dice qué hacer cuando falta un dato (p. ej. "sin fila de
  run, omitir la línea"): ante un hueco, Codex se detiene sin editar, dos veces en ERP.4.16. (2) La contraprueba que
  cambia un archivo de `src/` por el de HEAD la corre el ejecutor dentro de su ronda: el hook del cerebro bloquea toda
  escritura del cerebro en `src/`, aunque sea temporal. (3) El preflight del ejecutor puede dejar
  `.orchestos/active-item.json` con un scope estrecho, y el commit del cierre falla en `scope:check`: borrarlo al
  cerrar el ítem. (4) Un caso de campo se fecha contra el commit del arreglo antes de usarlo como evidencia
  (CI.23: el `tasks.yaml` sin commitear era anterior a ERP.4.12).
- **Fronteras de seguridad: revisión `qa` antes de cerrar (AT.21, 2026-10-17).** Con la suite verde y el gate en vivo
  pasando, `run_readonly` tenía 9 agujeros reales (ejecución de código por `git grep -O`, config hostil del repo,
  submódulos, `core.worktree`, config truncada, timeout sin matar hijos). Los encontraron el cerebro probando el binario
  real y 3 rondas de `delegate qa` con reproducciones. Todo ítem que toca una frontera (sandbox, permisos, rutas,
  ejecución) se cierra solo tras una revisión `qa` sin hallazgos altos. Preferir defensas estructurales (fallar cerrado,
  comprobar el estado real) a listas de prohibidos: cada lista nueva dejó otro hueco. Dos ejecutores en paralelo: el
  `mecanico` tocó tests fuera de su alcance mientras `criterio` editaba el mismo módulo; acotar archivos en el spec.
- **Formato antes de commitear (UI.26.6, 2026-10-14).** El pre-commit no corre `lint`; el pre-push sí. Un
  `result.json` copiado a `docs/done/evidence/` o un `.tsx` retocado tras el `biome check` del ejecutor bloquean el
  push. Antes del commit de cierre: `bunx biome format --write <archivos del commit>`.
  (AT.20, 2026-10-17) Biome **sí** revisa los `.mjs` de `scripts/ui-gate/` (el ejecutor afirmó lo contrario) y
  `bun run lint` del repo entero da 0 errores (solo warnings/infos): el spec pide `bun run lint` con exit 0, no
  "biome de lo tocado".

- **CSS del front (UI.24.1, 2026-10-13).** El build (`bun-plugin-tailwind`) rebaja `color-mix()` dentro de una
  propiedad personalizada a su valor de respaldo: `--x: color-mix(...)` llega al navegador como el primer color.
  Los tokens derivados se escriben como literales por tema; verificar en `dist/main.css`, no en `index.css`.
- **Fuente de la app (UI.24.2, 2026-10-13).** `body` y la raíz de `App.tsx` llevan `font-sans`: la fuente se cambia
  en `--font-sans` del `@theme` de `index.css`, no en `body { font-family }` (la utilidad gana). Plus Jakarta Sans
  estuvo cargada meses sin dibujarse nunca. Un gate de tipografía lee el `font-family` computado, no el CSS fuente.
- **Gates de color.** Un contraste de luminancia WCAG sobre fondo casi negro pasa con diferencias invisibles: medir
  diferencia de claridad `L*` (CIELAB) contra el fondo efectivo del ancestro, no contra `body`, y acompañar con una
  contraprueba que falle. Una captura mirada por el cerebro sigue siendo obligatoria: el gate pasó 71/71 con la
  burbuja invisible.
- **Contraprueba sin `git stash` (UI.26.2, 2026-10-14).** Para revertir un archivo: copiarlo a `/tmp`,
  `git show HEAD:<ruta> > <ruta>`, correr el gate y restaurar la copia con `trap ... EXIT`; `cmp` confirma la
  restauración. En este árbol hay stashes viejos: un `git stash push` que falla sin avisar hace que el `pop` saque
  otro ajeno (sacó "UI.12.2b de Luna", 5 archivos en conflicto, typecheck rojo y commit bloqueado). Un spec no
  indica `git stash` al ejecutor.
- **Specs y ejecutor (migradas de NEXT.md, DOC.1 2026-10-14).** (1) El ejecutor de Codex para si ve `writer-lock
  status: ocupado: claude`: el spec dice que escribe bajo el candado del cerebro (`AGENT_WRITER_TOKEN`). (2) Prohibir en
  el spec `prettier` y `git stash`; formatear con `bunx biome format --write` sobre lo tocado antes del lint (`delegate
  mecanico` no formatea), también todo JSON de evidencia y los archivos propios bajo `docs/`. (3) Si hay cambios sin
  commitear de una ronda previa, el spec los nombra y se corre `bun run agent:handoff` antes (un `.orchestos/handoff.md`
  viejo hace que `mecanico` se detenga); el preflight rechaza un ítem `[x]`: reabrir (`[ ]` + reconcile) antes de una
  ronda de corrección. (4) Una ronda de corrección = un spec en archivo propio. (5) El scope del preflight incluye
  `PLAN.md`, `LEDGER.md` y `docs/**` o el cierre exige `**Fuera de scope declarado:**`. (6) macOS no tiene `timeout`:
  `perl -e 'alarm N; exec @ARGV' …`; y una corrida de Luna se colgó >12 h: vigilar con un Monitor de 20 min.
  (7) El spec dice "NO correr `test:coverage` ni detenerse por el baseline": en el sandbox de Codex dan fallos falsos
  (`csrf-origin` por puertos, `adversarial-review` por sandbox anidado, `EADDRINUSE`). (8) El hook `brain-no-code` bloquea
  un heredoc de Bash que nombre rutas `src/…` (specs con Write) y el cerebro no edita `scripts/` ni una palabra; un
  subagente Sonnet del Agent tool hereda ese hook y no edita `src/`. (9) `delegate qa` exige archivo de spec y responde
  solo "sin defectos" aunque se pida desglose; `delegate leer` devuelve la respuesta duplicada y con el log de hooks
  delante (leer desde la línea `codex`); `delegate investigar` y todo rol `claude` con `--tools` fallan ("Input must
  be provided…", `--tools` se traga el prompt; esquive: `claude -p … --tools … < pregunta.txt`; arreglo pendiente en
  `method/` del vault).
- **Código y gates (migradas de NEXT.md, DOC.1 2026-10-14).** (1) Un cambio en la forma de una respuesta de API
  exige grepear los fixtures `JSON.stringify` del front (`app/src/api/*.test.ts`): no están tipados y `typecheck` no
  los ve; al envolver un punto de salida, grepear todos los llamadores de las funciones que escriben estado.
  (2) Un test que pasa por un commit de producción necesita identidad **local** en el repo temporal (`git config
  user.name/email`), no solo `-c`. (3) Una columna nueva de `runs` va como migración numerada, no `safeAddColumn` (la
  migración 10 reconstruye la tabla, `migrate.ts:390`). (4) Tocar `src/run/harness.ts` exige entrada en `LEDGER.md`.
  (5) Un test que llega al QA fija `OPENROUTER_API_KEY` o lee `~/.orchestos/.env` del host; un literal con forma de
  clave frena `security:secrets`: construirlo con `.join('')`. (6) El check de `tsc` solo se añade si la tarea
  declara salida `.ts` (`checks.ts:79`); `bunx tsc` en un repo sin typescript reescribe el lockfile (revisar
  `git status`). (7) Un paso de gate que comprueba "ya no está" justo al cerrar el turno por API sondea, no cuenta una
  vez; gates de chat leen el texto final de `POST /api/chat`, no solo el DOM. (8) Un cambio de marco se cierra con la
  batería completa del pre-push, no con una selección de flujos; el pre-commit exige la línea `Gate en vivo:` con
  la evidencia entre backticks. (9) Primitivos de la familia: `Button` de solo icono recibe el icono como hijo; con
  texto, `leadingIcon={Icono}` (icono hijo + texto = icono apilado); las `border-app/NN` no aceptan variante (usar
  `color-mix` arbitrario). (10) Antes de afirmar "no existe en la UI", grepear el handler en todas las pestañas; si
  falta el navegador: `bunx playwright install chromium`; diagnosticar un run de Codex sin texto → rollout en
  `<proyecto>/.orchestos/agent-home/codex/sessions/`. (11) Antes de abrir un ítem, `grep "\*\*<ID> —" PLAN.md` (CI.20
  ya existía).

- **Preflight.** Solo reconoce ítems de **primer nivel** (`^- [ ] **ID`, `findOpenPlanItem`,
  `scripts/agent-governance.ts`): un sub-ítem con sangría lo bloquea; usar el padre (`--item MR.1`) o abrir el
  sub-ítem como línea propia antes de lanzar al ejecutor. `--scope` necesita globs (`src/dashboard/**`; un directorio
  pelado no cubre sus archivos) e incluir `NEXT.md` y `.orchestos/feature-status.json`. No se puede re-correr sobre un
  ítem ya `[x]`: si el scope quedó corto, añadir la línea `**Fuera de scope declarado:**` en el ítem.
- **Línea de procedencia.** `Ejecutado por: … · Spec: docs/specs/<ID>.md` debe terminar en la ruta (sin texto
  después) o el plan gate exige borrar el spec. ~~Commitear el spec al lanzar al ejecutor, no al cerrar.~~ Reemplazado
  2026-10-19: un commit por ítem (§ Reglas generales).
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
  `codex app-server` no responde `account/rateLimits/read` en 8 s (`scripts/context-adapters.ts`); deja una línea de log
  al vencer. Los
  `rollout-*.jsonl` de `~/.codex/sessions` traen `rate_limits` y son candidato a fallback.
- **Cambiar un texto o selector del hilo = grepear todos los flujos** (2026-10-15). `rg "<texto viejo>"
  scripts/ui-gate/` antes de cerrar, no solo los flujos que nombra el ítem: UI.24.5 actualizó 3 y el pre-push cayó en
  otros 2 (`restart-mid-run`, `chat-roles`; UI.24.5.1). Copias de evidencia a `docs/done/evidence/` van formateadas
  (`biome format --write`): el `lint` del pre-push las revisa.

### Un árbol, un escritor (AT.18, 2026-10-20)

En un mismo árbol de git escribe una sola sesión. Incidente 2026-10-11: dos sesiones de Claude en el mismo árbol y el
commit de AT.15 arrastró del índice compartido el spec y la línea de `PLAN.md` de CI.17. Dos dientes mecánicos, ambos
de `~/.agent-method/hooks/writer-lock.js` (fuente en `method/` del vault):
- Claude Code: hook `PreToolUse` en `~/.claude/settings.json`; la primera sesión que edita toma el candado y a las
  demás se les niegan ediciones y comandos git de escritura.
- Cualquier escritor (Codex interactivo, humano, otra herramienta): `scripts/pre-commit.sh` corre
  `writer-lock.js check` y rechaza el commit si el candado es de otro. Codex interactivo reclama antes de editar con
  `node ~/.agent-method/hooks/writer-lock.js claim codex`. Un ejecutor de `delegate` hereda el candado de quien lo lanzó.
- Sin el método instalado (CI, otra máquina) el pre-commit no lo comprueba. Candado de una sesión ya cerrada:
  `node ~/.agent-method/hooks/writer-lock.js release`. Vence solo tras 45 min sin escrituras.
- El dashboard también es un escritor: su "deshacer" (`src/dashboard/handlers/runs.ts:264`) sobre este mismo repo
  falla con 500 y el motivo del candado mientras otra sesión lo tiene; `git revert --abort` deja el árbol limpio.

### Trabajo en equipo (Claude + Codex, en paralelo)

Carlos trabaja este repo con Claude y Codex a la vez, cada uno en su propia sesión (posiblemente
en un worktree/rama separada). No te va a decir "hacé el ítem X" cada vez — el punto de partida
SIEMPRE es `PLAN.md`. Antes de tocar código:

1. **Leé `PLAN.md` primero.** Es la fuente de verdad de qué falta y en qué orden. Cada ítem abierto
   (`- [ ]`) tiene una etiqueta: `🧠` (requiere criterio de diseño), `⚡` (mecánico, bien
   especificado), `🔍` (gate de revisión). **Agarrá SOLO ítems `⚡`** — los `🧠`/`🔍` son de Claude.
   Si un `⚡` te bloquea porque depende de un `🧠` sin cerrar, PARÁ y decilo, no lo hagas en caliente.
2. **Scope-lock**: ejecutá EXACTAMENTE el ítem que agarraste — nada adyacente, ningún "ya que
   estoy, aprovecho y arreglo esto otro también". Si ves algo fuera de scope que amerita
   arreglarse, no lo mezcles en la misma pasada: abrile su ítem. Si daña el sistema (regresión, gate rojo), ese
   ítem va **antes** del siguiente y sin preguntar; si no, se anota para el reporte del lote (2026-10-11).
3. **Commit por ítem cerrado**, marcando `[x]` en `PLAN.md` en el mismo commit — así el otro agente
   (o Carlos) ve en `git log`/`PLAN.md` qué ya está tomado, sin necesitar coordinación en vivo.
   Excepción: si ejecutas un `docs/specs/<ID>.md` escrito por el cerebro, no commiteas; el cierre
   es suyo (§ Protocolo de delegación, paso 4).
4. **No pises lo que no es tuyo**: si un ítem `⚡` ya tiene evidencia de que otro agente lo está
   trabajando (branch activo, commit reciente sin mergear), no lo dupliques — avisá.
5. Antes de escribir código nuevo, correr `bunx tsc --noEmit` y la suite de tests relevante — igual
   criterio que ya pide el pre-commit hook, pero verificalo vos ANTES de terminar, no dejes que el
   hook sea la primera vez que se entera de un error de tipos.

### Estado tomable

La sección fechada “Qué está listo para tomar ahora (2026-07-30)” fue retirada el 2026-08-17 porque
había quedado obsoleta mientras `PLAN.md` ya estaba en Sprint 29. Desde ahora el estado se deriva en
cada preflight de los ítems abiertos de `PLAN.md`; nunca se duplica aquí un snapshot que pueda mentir.

### Estado activo: Bloques R, H y UI (2026-09-08)

`PLAN.md` está en Sprint 30. El Bloque R mantiene abiertos R.6–R.8; H mantiene H.10.2 abierto; y la
dirección visual activa está en UI.8.1–UI.8.6. Leer el bloque completo en `PLAN.md` antes de
agarrar un ítem: cada uno trae su gate y sus condiciones de parada propias.

Los huecos H.1 de documentación/configuración ya están cerrados. Sus advertencias históricas se
conservan en `PLAN.md`, pero no describen trabajo disponible actualmente.

Dos advertencias sobre ese bloque:

1. **`H.1.2` (histórico).** La constitución (`CONSTITUTION.md`, `src/spec/constitution.ts`) se quitó
   en ERP.5.5 (2026-10-19): los CLI ya leen `AGENTS.md`/`CLAUDE.md`. El principio sigue: un archivo
   de gobierno con contenido improvisado es peor que uno vacío.
2. **`H.1.4` exige verificar antes de borrar.** Los artefactos (`demo/`, `runs/*.log`,
   `test-project/`) pueden estar referenciados por un test o por `tasks.yaml`. Comprobarlo
   primero; se sacan del índice de git, **no del disco**.

### Marco de harness engineering (referencia, 2026-09-01)

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

### Hooks

Instalar o reparar ambos hooks con un único comando portable para repo principal y worktrees:

    bun run hooks:install

Validar sin modificar:

    bun run hooks:check

### Evidencia de gates reales del harness (CC.0-D6)

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

### Estado operativo de seguridad (2026-07-29)

L.0–L.6.1 del baseline están cerrados. L.6.2 sigue abierto: la revisión CLI/HTTP inicial y sus
límites viven en `docs/done/security/security-manual-review.md`; falta una sesión con navegador para la revisión
visual y los flujos manuales de ejecución/worktree/diagnóstico/exportación. Hallazgos pendientes
`L62-001` (migración concurrente) y `L62-002` (provider key persistida antes de validación). No
corregirlos fuera de un ítem explícito de `PLAN.md`.

### Invariantes de arquitectura permanentes

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

### Roster de modelos y alias de Codex (2026-09-11)

Regla para CUALQUIER LLM que trabaje en este repo (Claude, Codex, DeepSeek, OpenCode) — no se
vuelve a preguntar por sesión ni por tab.

**Alias de Codex.** Cuando Carlos dice "Luna", "Terra", "Sol" o "Astra" se refiere a modelos de
Codex, no a agentes ni a personas. IDs confirmados el 2026-09-11 leyendo los rollouts de
`~/.codex/sessions`.

IDs vigentes y qué rol cumple cada alias: `~/.agent-method/roster.conf` (AT.15, 2026-10-11). La lista
que había aquí (Sol = `gpt-5.6-sol`, Terra = `gpt-5.6-terra`) quedó vieja; está en `git log -p AGENTS.md`.

**Roles y flujo:** una sola fuente, § "Protocolo de delegación permanente" arriba (unificado el
2026-09-14; esta sección repetía el roster con otra redacción). Motivo que se conserva: el cupo
de un CLI de suscripción se agota por gastar el modelo caro en tokens que uno barato produce
igual de bien.

## NEXT.md (original)

## NEXT — handoff 2026-11-03 (UI.56–60 y CI.56 cerrados; CI.19, CI.54, CI.55, CI.57 esperan fallo)

Un solo presente: orden y trampas vivas. Lo cerrado vive en `docs/done/bloque-*.md`, `PLAN.md` y git (regla `AGENTS.md`
§ Reglas generales, 2026-10-19: `NEXT.md` se toca solo al cerrar o cortar un lote). Arranque:
`bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`. Roster normal (`roster.conf`).

### Reglas de Carlos vigentes
- 2026-10-22, modo estricto: nada se reintenta, cierra ni muestra sin evidencia medida que el usuario vea; opinión de
  LLM marcada como tal. Memoria `feedback-evidencia-antes-de-actuar`. Método: `docs/specs/TRUST.md`.
- 2026-10-23, repartir cupo: Sol 6.1 es el acompañante de confianza de Opus — diagnóstico, auditoría y revisión fuerte
  van a Sol (`criterio` escribe, `analizar` audita solo lectura; `qa` solo revisa el diff sin commitear). Opus escribe
  specs, decide con Carlos, revisa lo de Sol y cierra. Memoria `feedback-subagentes-modelo-barato`.
- 2026-10-29, pruebas largas no se esperan: el pre-push (~13 min con ui-gates) y la mutación se lanzan en segundo
  plano o de noche y se verifican al terminar. Memoria `feedback-push-largo-no-se-espera`.

### Cerrado
- Antes del 2026-10-27 (lotes SET, AT.11.2/.3, CI.44/45 y anteriores): `PLAN.md` y `git log`.
- 2026-10-27/28 (este lote, todo empujado, CI verde, nocturna de mutación `40661058704` verde entera):
  - CI.46 `74ac5097`: `codex-app-server.ts` en 3 shards por rango de líneas cortado entre métodos (41/63/76 min).
  - CI.47 `7c482813`: `executors-routing` y `-engines` en dos shards cada uno por archivos enteros (57/81/77/69 min);
    el glob mutaba `cli-search-path.test.ts`. Tiempos en `24cbd9f3`.
  - UI.31 `8fe4bd0c`: el popover de cuotas muestra lo consumido, sin "CLI Quotas", semanal como `5D 14h`.
  - UI.32 `d03804a0`: la pestaña Diff lista los cambios del working tree de git (como VS Code), solo lectura.
  - UI.33 `95d6f06e` (+ `b3cd5ad8`): color por consumo, verde < 60 %, naranja 60–80 %, rojo > 80 %.
  - UI.34 `67c2f904`: las corridas propias de Claude guardan su `rate_limit_event` como cuota.
  - UI.35 `b60b0317` + `ac5239ee`: la cuota de Claude sale del endpoint de `/usage` (`api/oauth/usage`, 0 tokens)
    con la sesión del llavero (sin guardarla ni refrescarla), cada 60 s como mucho; los ui-gates lo apagan.
- 2026-10-29 (empujado hasta `5823c084`, pre-push verde): UI.36 carpetas de Files; UI.37 anillo de contexto en el
  composer junto a enviar (+ UI.37.1 `shell-look` verde de nuevo); UI.38 Dev como MonoCode: una fila de pestañas que
  mezcla sesiones y archivos, el archivo a todo el centro (vista previa en cursiva, doble clic fija; Markdown
  Preview/Source; código con highlight.js), "+" = pestaña New session con el modelo del rol, entrar a Dev abre la
  última sesión, la app inicia siempre en Chat (UI.38.1 lo había roto: tercera vez), sin la cabecera de sesión
  (UI.38.4; su Stop era falso). CI.48: `codex-live` mide ráfaga e hilo; sesión con historial conserva su modelo, sin
  historial usa el del rol.

- 2026-11-02 (todo empujado hasta `9e63f1f5`, pre-push verde con los 19 ui-gates; sesión del 2 de noviembre; commits fechados 30-oct a 2-nov a pedido de Carlos, 5 por día, para el mapa
  de contribuciones): UI.39 favicon en línea; UI.40 Health no cuenta la API key de OpenRouter como requisito (5/5);
  UI.41 el chat colorea código con el highlight.js de Dev (`lib/highlight.ts`, plugin `code` de Streamdown, +1,2 KB);
  UI.42 permisos del chat sin parpadeo; UI.43 `hljs-built_in` con color (`String.raw`); CI.49 `chat-sessions` no
  espera al `opencode` real; CI.50 listado de modelos de un CLI con límite de 10 s; CI.51 biome sobre lo staged en el
  pre-commit; CI.52 ninguna lectura del proyecto sale durante su borrado (`project-delete`). Memoria podada (arranque
  bajo 9k).
- 2026-11-02, tarde (empujado hasta `21f51e67`, pre-push verde): UI.44 `1bebddd3` pestañas de Dev flotantes como
  MonoCode (píldoras, fila de 40 px alineada con el inspector); UI.45 `21f51e67` "+" en Dev abre un menú con los
  agentes de chat (último usado preseleccionado); modelo = primer rol del agente (orchestrator → executor → reviewer →
  auxiliary) o default del CLI (`new-session-agent.ts`).

- 2026-11-02, noche: CHAT.4 Stop real. `5e5251bc` back (registro con `AbortController`, `POST
  /api/chat/sessions/:id/stop`, Codex `turn/interrupt`, Claude SIGTERM→SIGKILL sin `--resume` después, migración 33
  `cancelled`); `f1a8df7f` UI (botón Detener/Deteniendo… en Chat y Dev, "Respuesta detenida"), ui-gate nuevo
  `chat-stop` 22/22 corrido por el cerebro. Fuera: opencode (espera a que termine), tareas ya lanzadas.

- 2026-11-02, noche (2): CI.53 `7ceebbb5` timeout real en `chat-stop.test.ts` (caché de Bun fría con HOME
  temporal); CI.54 fase 1 `85bbb985` (`codex-live` deja captura+JSON si la burbuja no aparece); TCLI.3 `c24519c2`
  detección común (instalado → versión → sesión, `cli-health.ts`); UI.46 `ccfbb675` barra de cuotas solo con CLIs
  funcionales con cuota (Claude, Codex); UI.48 `d9e9c5bd` diff al centro como Files; UI.47 `be9f0e5b` OpenCode en el
  "+" como terminal (+ bug: el scroll de la fila de pestañas cerraba el menú). Memoria nueva: lo obvio de un ADE se
  agrega sin preguntar.

- 2026-11-02, noche (3): auditoría de ADE (OrchestOS vs MonoCode/Orca, capturas `/tmp/ade/`). UI.49 `c21c65f5` modo
  de permisos en el composer de Dev; UI.50 `381d3520` spinner en la pestaña de la sesión que corre (`running` en
  `/api/chat/sessions`); UI.51 `d8779774` tiempo al reinicio junto al % de cuota; UI.52 `0ab1fe9e` Dev pinta con
  `ThreadMarkdown` como Chat (sin `react-markdown`); UI.53 `c1a42acd` + `5dc86638` Files atenúa lo ignorado por git;
  UI.54 `1f4816cf` "@" referencia archivos (Chat y Dev); UI.55 `7a97bdf1` terminal del proyecto en panel inferior
  de Dev (botón en la barra, Ctrl+`). Todo empujado hasta `949847d2`, pre-push verde al segundo intento (CI.55). Visto de paso: Orca mostraba Codex 39 % y el `app-server` oficial 49 %
  (OrchestOS correcto). Codex tiene 3 créditos de reinicio de cuota disponibles (`rateLimitResetCredits`), sin UI.

### Orden
0. Nada en curso. Cerrado 2026-11-02/03 (todo empujado, pre-push verde en `e4534111`): UI.56 `487d2d52` anillo de
   contexto como sector relleno; UI.57 `a4beb111` OpenCode con el tema elegido, sin cabecera ni texto; UI.58
   `82820986` Terminal como pestaña central, PTY vivo entre pestañas; UI.59 `06d6ec92` pre-commit `ui:text-gate`
   (todo texto JSX nuevo se declara en `Texto visible:` del ítem); UI.60 `20ddb8ee` "+" de Dev siempre a la vista;
   CI.56 `5ad28377` palabra de `codex-live` sin relación con el tema. Descartados con evidencia: Stop de OpenCode (su
   chat está desactivado; las tareas ya cancelan, `opencode-server.ts:67`); "pestaña desaparecida" (navegador limpio
   → Dev abre la sesión más reciente).
1. **Esperan su próximo fallo** (leer la evidencia y escribir la fase 2): CI.55 `4b8ca91d` deja
   `role-task-missing-output.json`; CI.57 `fa2d65c6` deja `composer-picker-model-missing.json` (falló 4 seguidas y
   luego 6/6 verde; mi bisección que culpaba a UI.58 era falsa); CI.54 deja `turn1-bubble-missing.json`; CI.19.
   Todos en el `runDir` del gate (`/var/folders/.../ui-gate-<pid>/`, ruta en el detalle del paso).
   **Anotado, sin ítem**: `chat-continuity` cayó 1 vez por timeout de 180 s esperando al modelo (pasó al reintento);
   `chat-streaming` falló 1 vez en el scroll con la cobertura en paralelo (aislado pasa).
2. **Decisiones de Carlos pendientes**: mostrar los créditos de reinicio de Codex (recomendación: en el popover de
   cuotas); comentarios de Settings (mostrado 2026-11-02, sin pedidos). Sin reproducir: "Loading project data…".
3. Cualquier CLI ya corre tareas sin código (AT.11.2/AT.11.3): se declara en Settings → Providers → "CLIs propios".
   Un adaptador rico (streaming, sesiones, cuotas) para un CLI nuevo sigue siendo `KNOWN_CLIS` + `registerTaskEngine`
   y lo instala el cerebro para probarlo, no Carlos. Fuera hoy: CLI genérico en el chat (necesita streaming).
- Trampa: `plan:reconcile` dos veces con un ítem `[x]` sin commitear falla ("Could not prove a closing commit SHA"):
  reabrir `[ ]`, reconcile, volver a `[x]`, reconcile. El live-gate exige citar un `.json`/`.log`, no `.png`; el plan-gate exige
  `Ejecutado por: … · Spec: docs/specs/<ID>.md` si el spec nunca se commiteó.
- Trampa: `delegate <rol>` exige una ruta a un archivo de spec, no texto libre (falla con "spec no existe"); `leer` e
  `investigar` sí aceptan la pregunta directa.
- Trampa: antes de abrir un ítem, grepear que el ID no exista ya cerrado (`grep -n "\*\*TCLI\.2" PLAN.md`): el
  gate falla con "item … is duplicated". Y no marcar `[x]` antes de que el ejecutor termine: su preflight exige el
  ítem abierto.
- Trampa: dos ítems sin commitear en el mismo archivo (SET.3/4/6 en `OrchestSettingsView.tsx`): guardar el parche de
  cada ítem antes de delegar el siguiente y commitear con `git apply --cached` + `git commit` SIN rutas; `git commit --
  <ruta>` toma el archivo del árbol y mezcla los ítems.
- Trampa: el título en negrita de un ítem de `PLAN.md` debe cerrar `**` en la primera línea; partido en dos, el
  parser no lo ve y el gate dice "Closed item … is missing from staged PLAN.md" (AT.11.2).
- Trampa: al cerrar un ítem, `plan:reconcile` una sola vez antes del commit. Un segundo reconcile ve el ítem ya
  `done` sin commit que lo pruebe y falla ("Could not prove a closing commit SHA"); se arregla volviendo a reconciliar
  desde `git show HEAD:PLAN.md` y luego el PLAN.md nuevo.
- Anotado, sin ítem: `pickAutoSkill` elige una skill `explicit` si es candidata única (`chat.ts:791`,
  `verification-before-completion`) y `src/tasks/init.ts:71` genera `skill_id` `doc`/`implement` sin YAML — Carlos no
  los priorizó (2026-10-24); el revisor elige su ventana cortando en el primer tramo que no cabe; `permissions` parpadea a
  `null` al re-dispararse el efecto de config del chat (`OrchestChatView.tsx:108`, CI.41); TRUST.7.1 sin verificar en
  vivo el caso de residuos.
- Decidido 2026-10-26: el peso de `main.js` tras UI.24.4 (~1,9 MB, +22 % por `streamdown`) se acepta como precio de
  la UI moderna; no se reabre sin síntoma medido (arranque lento o servir fuera de localhost). El push del vault se
  decide en el vault, no aquí; la tarea `chat-4a0d93a2…` era de prueba, sin urgencia.

### Trampas vivas
- Commits con fecha pasada: `GIT_COMMITTER_DATE="$D" git commit --date="$D" …` en orden cronológico; `--amend` solo
  sobre lo no empujado. El pre-push valida el commit empujado, no el árbol: un rebase cambiaría fechas de committer.
- Evidencia `docs/done/evidence/*.json` copiada de `result.json` → `bunx biome format --write` antes del commit (el
  pre-commit ya lo exige desde CI.51).
- Tailwind lee la fuente, no el runtime: un `\_` dentro de una variante arbitraria va en `String.raw` (UI.43).
- Nunca `git stash` con un ejecutor trabajando en el árbol (2026-11-02 se guardó un instante el trabajo de Sol).
- Todo arnés que levante un dashboard de prueba debe poner `ORCHESTOS_CLAUDE_USAGE_LIVE=0` (como
  `scripts/ui-gate/run.mjs`): si no, lee el llavero real y la cuota real tapa el fixture (UI.35, `usage-bar` 39 %).
- `~/.claude/.credentials.json` de Carlos está vencido (julio); el llavero es la fuente buena en macOS.
- Corregir un ítem ya `[x]` con un ejecutor: reabrirlo `[ ]` solo para el preflight y volver a `[x]`. Deja
  `.orchestos/active-item.json` con su scope; el siguiente commit del cerebro falla en `scope:check` → borrar el archivo
  (estado de sesión de un ítem cerrado).
- `security:secrets` marca `token|secret|password… = '<16+ caracteres>'` aunque sea un fixture: valores cortos.
- Stryker: un glob `dir/**/*.ts` en `mutate` toma también los `.test.ts` co-ubicados; excluir `!…/*.test.ts`. Partir
  un shard: por archivos enteros si se puede; por rango, solo entre métodos (un mutante que cruza el corte se pierde).
- Los ui-gates recompilan `src/dashboard/app/dist/` compartido: el dashboard real de Carlos (4242) sirve ese `dist`
  y le muestra trabajo de un ejecutor a medias (pasó con SET.1). Hallazgo sin ítem; avisar a Carlos antes de que mire.
- Spec de guardado instantáneo: definir qué pasa con estados intermedios que el backend rechaza (SET.1 r1 paró por
  agente sin modelo y regla sin `match`).
- `codex-live` corre con proyecto: para probar el chat SIN proyecto con Codex real usar `chat-notices` o
  `chat-timeout`. La línea `Gate en vivo:` del ítem debe nombrar "navegador"/"Playwright" o `agent:live-gate` rechaza.
- `mecanico` (Luna) puede parar por "cambios ajenos" que `git status` no muestra: escribir en el spec el estado del
  árbol al delegar. Sus fallos de `test:coverage` por `~/.ssh` o `EADDRINUSE` son de su sandbox; el cerebro re-corre.
- Spec nunca commiteado: el pre-commit imprime `docs/specs/<ID>.md does not exist in HEAD`; no bloquea.
- `gate:evidence` migra la DB durable (`scripts/run-evidence-gate.ts:116`) antes de exportar: una migración sin
  commitear se aplica a `~/.orchestos/db.sqlite` de Carlos (pasó con la 32 de CHAT.3, 2026-10-25; DB íntegra).
- Silencio de Codex sin eventos = casi siempre 429 con reintento largo; el motivo está en `$CODEX_HOME/logs_2.sqlite`
  (CHAT.3 lo muestra en el chat). No es un fallo de OrchestOS.
- Cierre de ítem (gates de `PLAN.md`, 2026-10-23): (1) el ítem debe existir `[ ]` en HEAD antes del commit que lo
  marca `[x]` (`closedPlanItemIds`); (2) `plan:reconcile` una sola vez por cierre: si ya quedó `done` en la DB sin
  commit, reabrir `[ ]` → reconcile → `[x]` → reconcile; (3) la ruta de evidencia entre backticks va en la MISMA
  línea que `Gate en vivo:`; (4) `Ejecutado por: … · Spec: docs/specs/<ID>.md` exacto, spec borrado en el commit;
  (5) `git commit -- <ruta>` no acepta archivos sin seguir: `git add` antes.
- Bun 1.3.14 no tiene `bun audit fix` (lo sugiere y no hace nada): fijar en `overrides` de `package.json`.
- Probar el dashboard sin tocar el de Carlos: `ORCHESTOS_HOME=<tmp>` con el `sqlite3 .backup` en `<tmp>/.orchestos/db.sqlite` (si va en `<tmp>/db.sqlite` sale
  "no such table: projects") + `PORT=4343 bun
  src/dashboard/server.ts` + Playwright `channel: 'chrome'` (el chromium de Playwright no está instalado).
- Sol/Codex sin cupo de 5 h → `criterio-alt` (Sonnet); su diff no tiene revisor de otro proveedor: decirlo al cerrar.
  Sin Codex, los gates en vivo de chat y `qa-negative` no sirven: elegir flujos sin Codex (`plan-doc`,
  `project-tabs`, `model-routing`).
- Un registro que importa todos los motores (`task-engines.ts`) agranda la selección de cada shard de mutación: al
  sumar un hub así, medir `scripts/mutation-test-shard.ts` por shard (CI.42).
- Cambio de un texto que el producto emite: `grep -rn` del texto viejo en tests y flows, y correr la suite completa
  (`test:coverage`), no la acotada (TRUST.6.1 y TRUST.8 lo rompieron así).
- Fixture que escribe un hook de git: `mkdirSync(.git/hooks, recursive)` antes; con HOME temporal `git init` no la
  crea (TRUST.7.2).
- `method/bin/delegate.test.sh` "sin temporales" falla si hay otro `delegate` corriendo (mira `/tmp` global).
- Peso de arranque 9117 est., sobre el tope de 9k (`MEMORY.md` 4057): podar `MEMORY.md` lo baja.
  `/reload-plugins` mostró "1 error during load" (detalle en `/plugin`, sin revisar).
- Luna (`mecanico`) inventó "cambios ajenos" en un archivo limpio (TRUST.4, dos veces con causas distintas): si un
  ejecutor para por solapamiento, comprobar con `git diff --quiet HEAD -- <ruta>` y escribir el estado real en el spec.
- `shot` de ui-gate espera 300 ms (TRUST.5): una captura dentro de una transición mentía sobre la pestaña activa.
- Selectores de flujos acotados al componente: `getByText('67%')` en toda la página chocó con la cuota real de Codex
  (CI.39). Datos reales del usuario aparecen en la barra durante los gates.
- `qa-negative` puede fallar porque el modelo real no escribe la premisa ("premisa no cumplida… []"): el flujo lo dice;
  reintentar una vez antes de diagnosticar.
- Spec de recorte de texto: definir el algoritmo completo (primera línea larga, sin saltos); Sol para en cada caso no
  definido (TRUST.1, dos paradas).
- Contraprueba de un test de `~/.agent-method`: el test resuelve el hook desde el cwd (`path.resolve('method/hooks/…')`);
  copiar a `<tmp>/method/hooks/` y correr desde `<tmp>`.
- Evidencia de ejecutor: solo `docs/done/evidence/<ID>-live.json`; Sol deja carpetas `<ID>/` con logs → borrarlas.
- Ítems de `PLAN.md` llevan emoji de delegación (`🧠 ⚡ 🔍`) tras el "—": sin él el parser
  (`scripts/plan-status.ts:45`) no los ve, ni `bun run next` ni el gate. Si un ítem ya quedó `done` en la DB sin commit que
  lo pruebe, `plan:reconcile` aborta "Could not prove a closing commit SHA": volverlo a `open` en
  `~/.orchestos/db.sqlite` (`plan_items`) y reconciliar. La línea `Ejecutado por: … · Spec: docs/specs/<ID>.md` va en UNA
  línea; un cierre que toca dashboard lleva `Gate en vivo: navegador real (Playwright), `docs/done/evidence/<ID>-live.json``.
- `criterio` = Sol 6.1 (Codex) desde 2026-10-22, pedido de Carlos: repartir cupo; Sonnet es `criterio-alt`. El "Codex no
  ve el token" era falso: lo recibía, pero leía `writer-lock.js status` "ocupado" y no escribía. Arreglado en el vault
  `5134b27` (`status` dice si el token coincide; el prompt manda correr `check`). Si Codex vuelve a fallar por entorno,
  se arregla la herramienta, no se rodea con Claude.
- Chequeo de tipos en specs: `bun run typecheck`. `bunx tsc --noEmit` de la raíz excluye `src/dashboard/app`: no vio un
  import borrado de `Button` y Plan quedó en pantalla negra (UI.28 r2).
- `delegate` prohíbe al ejecutor editar `PLAN.md`: archivar o reestructurar el plan lo hace el cerebro (DOC.4).
- Cambio de texto visible que viene de otra sesión: `rg` en `scripts/ui-gate/` antes de cerrar (UI.27.3 rompió
  `chat-turn-details` por el prefijo "Codex: " del título).
- `~/.claude/settings.json` `statusLine` = tee de OrchestOS → script de Orca (restaurado a mano 2026-10-21, respaldo
  `.bak.20261021-statusline`). Si Orca lo vuelve a pisar, lo avisan la barra y el startup-guard (CUOTA.1).
- El sandbox de `delegate` no tiene red: `git push` lo hace el cerebro. Los gates en vivo dan `listen EPERM` dentro del
  sandbox: el ejecutor los repite con permisos ampliados.
- `plan:reconcile` no re-cierra un ítem ya `[x]` editado antes de commitear ("Could not prove a closing commit SHA"):
  reabrir `[ ]`, reconcile, `[x]`, reconcile.
- `agent:live-gate` solo cuenta "Gate en vivo: navegador real (Playwright), `docs/done/evidence/…`" si esa línea cambia
  en el mismo commit; la procedencia exige `Ejecutado por: … · Spec: docs/specs/<ID>.md` al final de la línea. La
  evidencia JSON copiada de `result.json` necesita `biome format --write` (salto de línea final) o el lint del pre-push
  la tumba.
- Los gates en vivo de chat usan Codex: sin cupo de Codex el pre-push falla en ~10 flujos sin defecto de código.
- Desde CI.30 el pre-push verifica el commit empujado en un árbol aparte: push en fondo + seguir delegando funcionó el
  2026-10-22 (3 pushes). Con cambios en `src/dashboard` o `src/run` tarda ~13 min (15 ui-gates + chat-gate).
- El pre-commit NO corre lint; el pre-push sí. Correr `bun run lint` antes de commitear (el push de `2008db91` se
  rechazó por formato).
- El hook `brain-no-code` toma una redirección a una ruta de código dentro del texto de un heredoc como escritura del
  cerebro (bloqueó un spec y este mismo `NEXT.md`): escribir specs y docs con Write/Edit, no con `cat <<EOF`.
- Preflight del ejecutor: el ítem tiene que estar **abierto** en `PLAN.md` (no un sub-ítem, no un padre ya `[x]`).
- `src/run/logger.ts` ENOENT al limpiar el fixture de un flujo que agotó su espera: consecuencia, no causa (visto otra
  vez el 22 en `auto-flow`).
- El plan gate parte el segmento de un ítem en su primera línea en blanco: `Ejecutado por: … · Spec:` va **antes** de
  ella o el gate dice "Procedencia … must delete docs/specs/<ID>.md" (pasó en H.10.2, ítem largo con párrafos).
- `qa` vía `delegate` solo acepta un archivo de spec y revisa el diff sin commitear: para auditar o diagnosticar
  sin editar usar `analizar` (2026-10-23, `qa` devolvió "sin defectos" sobre `runs-summary.json`).
- En los ui-gates, `visible(locator)` espera 15 s si el elemento no existe: para afirmar ausencia usar `count() === 0`,
  o la captura sale tarde y esconde fallos (UI.26.6b.2).
- Claves de prueba en flujos: sin prefijo `sk-` (`security:secrets`, `src/security/secrets.ts:31`, bloquea el commit).
- En esta terminal `CODEX_HOME` apunta a la cuenta de Orca: los rollouts de `codex exec` van ahí, no a `~/.codex`.
- Pre-commit con candado (AT.18): rechaza el commit si otra sesión tiene el candado del árbol. El "deshacer" del
  dashboard sobre este repo falla con 500 mientras tanto (límite declarado en `AGENTS.md` § Un árbol, un escritor).
- El cerebro no puede crear flujos de prueba en `scripts/` (hook `brain-no-code`): un gate de fallo forzado se delega.
- Trabajo de `criterio-alt` (Sol) lo revisa el cerebro, no `qa` (también Sol: mismo proveedor).
- Costo del revisor: lo reporta el adaptador en `ChatResponse.usd` (null = sin precio → `—`); nunca resolver precios
  con ramas por marca en `harness.ts` (r4 de ERP.6.2 lo hizo y se revirtió).
- `delegate` (rol de escritura) inyecta "No hagas commit ni edites el plan": commit y push los hace el cerebro (Carlos
  eligió eso el 2026-10-20). El sandbox de los ejecutores GPT no tiene red (`bun install`/`bun audit` los corre el cerebro)
  y a veces lee el candado del cerebro como ajeno: el spec dice "el candado es del cerebro que te lanzó; escribe".
- `delegate` inyecta "No invoques codex exec ni claude": un spec que exija probar un contrato de CLI en vivo para al ejecutor.
  El cerebro prueba el contrato (como en ERP.7.1d1/d2) y lo pega en el spec como "verificado; no invoques".
- Ronda de corrección = spec propio (`docs/specs/<ID>-rN.md`), no un anexo: con anexo, `mecanico` re-aplicó el spec entero
  y pisó la evidencia en vivo con un fallo de su sandbox (ERP.7.1c r4).
- Contratos de permisos verificados 2026-10-20: Claude 2.1.304 `--permission-prompt-tool` (ojo `--restricted` quita Bash y
  el `defaultMode: auto` del usuario aprueba sin preguntar si no hay `--settings` propio); OpenCode 1.19.0 `opencode serve`
  (`run` sin `--auto` rechaza solo; `always` es por patrón; Basic `opencode:<OPENCODE_SERVER_PASSWORD>`). Detalle en PLAN.md
  § ERP.7.1d1/d2.
- Codex 0.163: `commandActions` es aproximado; nunca derivar de ahí una identidad o una clasificación sin mirar el comando
  completo (bloqueante de QA en ERP.7.1a).
- `plan:reconcile` "Could not prove a closing commit SHA": reabrir (`[ ]`), reconciliar, `[x]`, reconciliar, commitear.
  Salió en cada cierre de ERP.5.2 y en el padre ERP.7.2; candidato a arreglo en el gate.
- `delegate` con rol `claude` en `leer`/`investigar` fallaba (`--tools` variádico se comía el prompt); arreglado en
  el vault `12c683b`. Si vuelve "Input must be provided", mirar el orden de argumentos.
- El spec ya no se commitea (ERP.5.6): la línea `Ejecutado por: … · Spec: docs/specs/<ID>.md` termina en la ruta y el
  spec se borra del disco antes del commit.
- Cambio de dashboard/config: el ítem cerrado necesita `Gate en vivo: navegador real (Playwright), `docs/done/evidence/<ID>-live.json``
  con el `result.json` del ui-gate copiado ahí (lo exige `agent:live-gate`).
- Ítem nuevo: emoji de delegación tras `— ` y título en negrita en una sola línea, o el plan gate no lo parsea.
- Preflight de sub-ítem indentado falla (`scripts/agent-governance.ts:37`): ítems de primer nivel.
- Spec para Codex (`mecanico`/`leer`): decir "no te detengas por el baseline; `csrf-origin.test.ts` da `EADDRINUSE`
  falso en tu sandbox" y "`git stash` prohibido incluso para diagnosticar".
- Al cambiar texto/selector del hilo: `rg` en todo `scripts/ui-gate/` (vale para cualquier vista: ERP.5.5 dejó
  `runs-graph` haciendo clic en un botón borrado y solo lo vio el pre-push).
- Evidencia `docs/done/evidence/*.json` copiada del ui-gate: `bunx biome format --write` antes del commit (sin salto
  final, el lint del pre-push la rechaza).
- Spec para ejecutor: nombrar el ítem (`Ítem: **<ID>**`) y decir que los cambios en vuelo del mismo ítem no son ajenos;
  si no, el ejecutor deduce el ID del nombre del archivo y para. Corrección de un ítem ya `[x]`: reabrirlo antes.
- `delegate` ya bloquea `git stash` (ERP.5.7): 1-2 intentos = aviso, 3 = QA. Spec en `/tmp` no lo puede leer un rol
  `claude` (permiso denegado): dejarlo en `docs/specs/`. En el vault, `claude -p` no puede correr Bash (gates los corre
  el cerebro).

### Decisiones de Carlos vigentes
- 2026-10-13: veredicto de utilidad de ERP.4 = "sirve, pero todavía no solo"; ERP.4 se cierra al terminar su lote.
- 2026-10-13: sin regla de presupuesto: un fallo se diagnostica y se arregla en el producto ("si aplico una regla de
  presupuesto no mejoro, solo limito").
- 2026-10-13: árbol sucio = seguir bloqueando + tarea `pending` + "Commit & Run" en el hilo (ERP.4.13); reintento desde
  el hilo (GO); `chat-retry-report` NO entra al pre-push.
- 2026-10-13: Memory = entrada mecánica por tarea terminada, sin LLM (ERP.4.16). Sin UI nueva en Settings para ese
  lote: Carlos revisará Settings pestaña por pestaña (dashboard real) y dirá qué sirve y qué sobra.
- 2026-10-13: nada hardcodeado en el ejecutor que muestra la tarea: dice quién la hizo según la config (ERP.4.11).
- 2026-10-13/14: UI.24 primero, ERP.4 al final. Referencias vivas: gr8r-taskmanagement.vercel.app (medidas en
  `PLAN.md` § UI.26), Arc UI (uiarc.dev; los bloques Pro no se compran), MusicKind
  (`~/Projects/projects/portfolio/dist/projects/musickind-screen@1x.webp`).
- 2026-10-14: DOC.1 y LIMP.1 (GO).

### Decisiones de Carlos 2026-10-14 (respuesta a AT.19 y `readBoundaryWarning`)
- (a) `create_task` en lugar del marcador: GO, implementar sin presentar plan → AT.20.
- (b) Shell de solo lectura: sí, para todos los LLM, nunca solo para uno → AT.21 (mismo servidor MCP que AT.20).
- Le interesa ver la ventana de contexto real en Chat y en Dev → CX.6. `readBoundaryWarning` (aviso de privacidad,
  no un número) sigue sin mostrarse; la frontera de lectura está verificada por el gate `read-boundary`.

### Pendientes sin ítem (una sola lista; abrir ítem solo si Carlos lo pide)
Verificados el 2026-10-14 contra el código salvo "(sin re-verificar)".
- Herramienta: `delegate investigar` y todo rol `claude` con `--tools` fallan (`~/.agent-method/bin/delegate:147,167-171`);
  esquive en `AGENTS.md`; el arreglo va en `method/` del vault.
- `readBoundaryWarning` sin consumidor (`src/dashboard/types.ts:90`, `app/src/api/chat.ts:14,77`; decisión de Carlos:
  sin aviso) → LIMP.1 comprobó que sí tiene consumidores (`chat.ts`, `chat-sessions.ts`, `api/chat.ts`): quitarlo cambia lógica, decide Carlos. Cuando el CLI se queda sin cupo ("out of usage credits") el chat lo muestra como
  respuesta normal, no como error (sin re-verificar).
- Intermitentes vistos una vez, sin ítem (si se repiten, abrir):
  `chat-streaming` "Dev renders text during generation … t_first=null" (ejecutor de AT.19.1, 2026-10-17);
  `restart-mid-run` caso A, reporte "failed · attempt 1/3" con
  reintento pendiente cuando el gate exige coincidir con el estado final (2026-10-13; decidir si un intento fallido con
  reintento pendiente debe decir "failed"); `chat-context` `locator.click` timeout al pasar de Codex a Claude (pre-push de `e1d3b12`; desde CI.27 deja locator y `failure.png`);
  `chat-context`, diálogo de nuevo chat sin Claude (sonda de CI.10 en
  negativo bajo carga, 2026-10-05).
- Settings → Tasks: "Loading live settings…" fijo en la cabecera (2026-10-03, sin re-verificar). Settings → Skills: la pestaña
  "Instincts" aparece resaltada además de "Skills" (2026-10-02, sin re-verificar).
- CX.5: fila `<synthetic>` (0 tokens) visible en "CLI tabs"; "Avg cost / run" mezcla runs y sesiones (sin re-verificar).
  Runs de chat con caché no vistos en DB (el purge de los gates los borra; el anillo de CX.2 los usa y funciona).
- H.5.3: `elapsed_ms` no cuenta el cuelgue de Codex; `effort` del rol no llega a `cli_effort` del eval (sin verificar
  si se aplica). El cuelgue en sí es CI.11.
- Plan (Settings): el selector de sprints tiene "Sprint 29/30/31" fijos en el JSX (`PlanBoardView.tsx`), visto en UI.28.
- "Clonar desde URL" (paso 2 de "+ Add project"): en espera por decisión de Carlos; feature nueva → plan corto antes.
- Decisión pendiente de Carlos (UI.13.4b): la frontera por argumentos no frena `node -e`/`sh -c`; la barrera real es
  sandbox de proceso o lista de binarios permitidos. AT.14 cerró solo el hueco del hook `brain-no-code`.
- Ajustes menores: idioma solo traduce Settings; fuente del prototipo = del sistema; reemplazar el prompt base del CLI
  es el punto 8 de AT.13.
- Migración de ruta (2026-09-28): confirmar con Carlos que Orca detecta el proyecto en
  `~/Projects/projects/orchestos`.
- Sin identificar: qué borró `~/Library/Caches/ms-playwright` y un `duplicate column name` que salió una vez
  (2026-10-13). Sin verificar a ojo: el bloque "Executor reply" de la pestaña Contract (se comprobó por texto visible);
  el botón `Run` de Settings → Plan no se probó en vivo.

### Datos del entorno vigentes
- Repo en `/Users/carlosgallardo/Projects/projects/orchestos` (migrado 2026-09-28; plantilla en `~/Projects/screens`).
  Restos inofensivos dejados a propósito: `~/.claude/projects/-Users-carlosgallardo-Documents-projects-orchestos`
  (transcripciones para /resume) y entradas `[projects."…/Documents/…"]` en los `config.toml` de Codex dentro de Orca.
- Codex corre con `CODEX_HOME` de Orca (`~/Library/Application Support/orca/codex-accounts/*/home`); sin API key de
  OpenRouter el catálogo se baja igual (endpoint público).
- El flujo `opencode-terminal` NO va en el pre-push (necesita el binario opencode; CI no lo tiene).
- Delegación: por rol con `~/.agent-method/bin/delegate <rol> <spec>`; modelos solo en `~/.agent-method/roster.conf`.
  El cerebro no edita código (hook `brain-no-code`): los ejecutores van por `ORCHESTOS_ROLE=executor`.
- `git stash list` conserva 5 stashes viejos (UI.12.2b, UI.11, AT.10 parcial, wip cascada E.16, config local): no aplicar.
- Piloto ERP.4: repo `~/Projects/projects/erp-piloto`; conductor Playwright en `docs/done/evidence/ERP.4/conductor/`
  (copiar a `/tmp/erp4/`, crear `cmd/`, `out/`, `shots/`; `node driver.mjs` en segundo plano, `do.sh`, `stage.sh`,
  `screen.mjs`); registro de hallazgos en `docs/done/evidence/ERP.4/piloto-2026-10-12.md`.

### Lección LIMP.1 (2026-10-14)
Inventario de código muerto: `bunx knip@5 --config /tmp/limp1/knip.json` (config fuera del repo; entradas `src/cli.ts`,
`scripts/**`, `app/src/main.tsx`, `.claude/hooks/*.js`). Falsos positivos vistos: fixtures, `assets.d.ts`, `tailwindcss`
(lo usa el CSS), archivos que un test lee por ruta (`db/backup.ts`, `orcaProjectData.ts`). Un símbolo borrado puede dejar
falso el comentario que lo explicaba: revisar comentarios reescritos.
- Trampa: `PLAN.md` se renderiza desde la DB; tras editarlo a mano, `bun run plan:reconcile` antes del commit o el
  pre-commit falla con "PLAN.md staged no coincide con render(DB)".
- Trampa: al commitear por rutas con `git diff --name-only`, los archivos NUEVOS del ejecutor quedan fuera (pasó con
  el test de UI.53); mirar `git status --short` por `??` antes de commitear.
- Trampa: los ejecutores Codex corren `test:coverage`/`ui:gate` dentro del sandbox y fallan con `EADDRINUSE`/`EPERM`
  (abren puertos); el spec debe decir "fuera del sandbox" o el ejecutor para por baseline rojo.
