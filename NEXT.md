# NEXT — AgroTienda en macOS y correcciones de Windows

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Sesión 2026-11-21 — empezar por aquí

Cerrado/subido: **USO.27 `0886e352`** (panel de uso tipo agentlytics: `byHour` en `/api/usage`, runs CLI = sesiones
por día, `UsageDashboard.tsx` + `lib/usage-stats.ts`), **USO.29 `7d9bd087`** (color de marca por CLI en el panel),
**CLI.1 `dde94d7d`** (aviso de versión nueva de Codex/Claude con botón Update en Providers; modelo de rol fuera del
catálogo marcado con sugerencia), MemoriesMD **`56212e9`** (`delegate` sale con 4 ante `model_not_found`).

Siguiente, en orden:
1. **USO.30** — el panel de uso no se acopla al tema: en carbon el hover card sale blanco y heatmaps/minigráficos usan
   `--app-accent` (#38bdf8). Tokens del tema activo; verificar en vivo en todos los temas de Appearance.
2. **USO.28** — `ContextRing.tsx:19` muestra "1.1M" para `window` 1000000 (rojo de `shell-look`, ajeno a USO.27).
   Diagnosticar de dónde sale `maxTokens` antes de tocar.

Trampas vivas: el hook del repo niega al cerebro editar código en `src/` (lib, executors…) también por Bash → spec +
`delegate`; `delegate` necesita el ítem abierto en PLAN.md o el preflight para al ejecutor; no editar
`~/.agent-method/bin/delegate` con un delegate corriendo (bash lee el script mientras corre); cada edición de PLAN.md
tras cerrar exige reabrir→reconcile→cerrar→reconcile (si reconcile dice "Could not prove a closing commit SHA",
es eso); `boundary-budget` cuenta cada `.json()` → validar con `src/boundary`; texto JSX nuevo → `Texto visible:`;
evidencia JSON escrita a mano → `biome format --write` antes del commit. Codex viejo (0.155) rechaza modelos nuevos:
si un delegate falla con exit 4, actualizar Codex.

Pendiente de Carlos: pasar `roster.conf` (criterio/qa/analizar) de gpt-6.1-sol a gpt-6.2-sol (no decidido).

La demo de e-commerce agropecuario (AgroTienda) y la prueba oficial las hace Carlos en macOS por el hardware.
Este pase de Windows se dedica a las correcciones y sus pruebas focalizadas. WIN.1 queda como prueba de humo
propia pendiente. Promocionar OrchestOS solo tras ~1 semana de uso sin USO graves en flujos básicos,
nocturnas verdes y "Windows experimental" declarado.

Windows, 2026-11-18: cerrados WIN.18, WIN.19 y WIN.21. WIN.6 ya usa la ruta detectada para Codex y el
catálogo, y WIN.20 tiene corregidos los fixtures reproducidos. Pendientes en Windows: los shims de Claude
y OpenCode (WIN.6), el fallo de `context --force` que solo se observó en la cobertura global (WIN.20),
los scripts de desarrollo (WIN.7) y la prueba de humo propia (WIN.1). [Evidencia](docs/done/evidence/WIN.18-21-local.md).

Orden:
1. **Demo AgroTienda en macOS** (Carlos, 2026-11-18: mejor hardware): es el uso real de la Etapa 2; cada fallo se
   abre como ítem USO con su evidencia y va primero. **Windows aparte**, en sesiones de corrección en esa máquina:
   continuar los ítems WIN abiertos. WIN.1 queda para una sesión posterior.
2. **MUT.1 y MUT.2 — leer la nocturna del 20-11** (la del 19-11 arrancó antes del tope de memoria):
   `gh run list --workflow "Mutation Shards"`; `gh run view --job <id> --log | grep '\[res\]'` en los verdes y
   buscar `RSS … MB > 2048 MB, kill` en los logs. Sin rojos "lost communication" → cerrar MUT.2. Si sigue → el mutante
   crece entre muestras de 2 s o la causa es otra.
3. **ui-gates nocturnos (solo Mac)**: la del 19-11 también inválida (batería y tapa cerrada: `caffeinate -i -s`
   no basta). El Mac debe quedar enchufado y con la tapa abierta. Leer `~/.orchestos/nightly/ui-gates-latest.json`.
4. **CMD.3 en Windows** (etapa 3): `/cut` con Claude y Codex sobre un repo de prueba con remoto.
5. **Pendientes chicos**: Codex `/review` solo si Carlos lo pide.
6. **Electron, etapa 4**: iniciar el empaquetado cuando Carlos confirme que OrchestOS ya funciona en el navegador
   (decisión del 2026-11-18). Al abrir la etapa, medir tamaño del paquete y RAM del prototipo (`IDEAS.md` #41).
7. Lo de abajo, en su orden. LRN.1 F2 espera datos de uso; LRN.2 va después de F2.

Trampas nuevas: los ui-gates buscan procesos por nombre en todo el Mac; con un dashboard abierto en paralelo hay
que filtrar por `ctx.dashboardPid()` (USO.24). `PLAN.md` se escribe y luego `bun run plan:reconcile`, o el pre-commit
lo rechaza. `delegate` en modo write exige un ítem ABIERTO en `PLAN.md`. Cerrar un ítem: "Could not prove a
closing commit SHA" → reabrir, reconciliar, cerrar, reconciliar, commitear. El gate de UI exige `[x]` y la línea
"Gate en vivo:" (con "navegador"/"browser" y el archivo de evidencia) en el MISMO commit que el código, y
"Texto visible:" como línea AÑADIDA en ese commit (no vale la de un commit previo). Un spec commiteado se borra en el
commit de cierre; uno nunca commiteado se borra del disco y el ítem lleva "Sin delegación: <motivo>". Si Codex se
queda sin cupo, la revisión espera; excepción del 2026-11-17 (solo esa vez, pedida por Carlos): subagente Sonnet.
El hook "cerebro no escribe código" bloquea Bash que mencione `src/`, no la herramienta Edit. `leer/analizar`
devuelven el transcript entero (la respuesta va tras la última línea `codex`).

## Orden

Rumbo de Carlos, actualizado el 2026-11-18 (`PLAN.md` § Rumbo): uso normal → uso real en navegador → Windows → Electron. Antes: lote de
auditoría AUD.1–AUD.28 en el orden de la segunda auditoría; lo cerrado está en `docs/done/bloque-AUD.md`.

1. **Etapa 1 — cerrada 2026-11-13** y **Etapa 2 — uso real (ahora)**: el relato ítem a ítem (USO.1–USO.26, LRN.1a/b,
   ACT.1, SES.1…) y las trampas que dejó está en `docs/done/next-etapas-1-2-2026-11-19.md` (histórico). Lo que Carlos
   reporte se abre como ítem USO con su evidencia y va primero; push con `--no-verify` en esta etapa.
2. **Etapa 3 — Windows**: WIN.1, fase 1 = prueba de humo. Nada se arregla antes de verla fallar.
3. **Etapa 4 — Electron** (`IDEAS.md` #41). Se gradúa al plan cuando Carlos confirme que la versión web funciona.
4. **Aparcados, no se toman** (`docs/done/aparcados-2026-11-12.md`): CI.19, CI.54, CI.55, CI.57, CI.69, CI.76, CI.81,
   AUD.8, AUD.9, AUD.10, AUD.27, AUD.28. Si uno de esos gates falla, se lee su JSON el mismo día (CI.62 borra el
   `runDir` a las 24 h) y se reabre solo si es producto roto.
5. **Decisión pendiente de Carlos, con recomendación del cerebro**: pausar la nocturna de ui-gates y la mutación
   mientras dure la etapa 2. Hoy `AGENTS.md` § "Gates y tests" manda resolver cada rojo nocturno antes del siguiente
   ítem; medido el 2026-11-10, desde el 2026-11-08 solo 2 de ~30 commits fueron de producto porque cada rojo se volvía
   un CI.\* prioritario y muchos eran gate desfasado, no producto roto. Sin GO, la regla sigue vigente. Otras
   pendientes: tamaño por reanudabilidad de ODD; qué ideas de `IDEAS.md` entran al cierre.
   - **Aprendizaje de errores (propuesto 2026-11-13, espera GO, va después de SES.1)**: hoy los instincts solo entran a
     tareas (`run/middlewares/instinct-apply.ts`), no al chat; nada se propone solo (`runs analyze` manual, rol
     auxiliary en `analyze/patterns.ts:144`). Diseño propuesto según investigación (Copilot memory, ACE, ExpeL): fallo →
     auxiliar propone lección atómica con cita → Carlos aprueba en la vista Instincts → inyección por relevancia con
     tope de tokens (chat y tareas) → caduca sin uso o si la cita ya no existe; exporta a `AGENTS.md` para todos los CLI.
     Opinión de Fable 5.2: `docs/specs/LRN-1-opinion-fable.md` (fases F0–F3, decisiones D1–D6 con recomendación).
7. Lo que dejó el lote AUD y sigue vivo:
   - El dashboard abre en cualquier URL local: el servidor inyecta el token en el HTML (USO.2). Los scripts que
     llamen a `/api` mandan `x-orchestos-token` (archivo `~/.orchestos/dashboard-token` o
     `ORCHESTOS_DASHBOARD_TOKEN`).
   - Todo spawn nuevo de un CLI de agente pasa por `spawnTree` (`src/run/process-tree.ts`). Parseo nuevo de datos
     externos → `src/boundary`, o el commit no entra. Rangos de config en `src/boundary/config-limits.ts`.
   - Sin gate en vivo: las carreras de cambio de proyecto de `App.tsx` (AUD.19). Residual aceptado: opción corta
     pegada a un symlink preexistente (`-fleak.txt`) en la regla readOnly de Codex (AUD.13).
   - Un ítem cerrado junto con otro necesita su propia línea `Ejecutado por: … · Spec: docs/specs/<ID>.md`. Los
     ui-gates del ejecutor suelen fallar por el localizador, no por el producto: mirar la captura antes de culpar al
     código. No relanzar los auditores: su salida literal está en los anexos de los informes.
   - Sin leer en la auditoría: `components/ui/*` por dentro, `scripts/ui-gate`, `tests/`.
8. Ui-gates nocturnos: la del 2026-11-11 (`089302a`) tampoco vale: durmió en batería hasta las 08:16 pese a
   `caffeinate` (36 eventos, `sleeps` del JSON) — sin enchufe y tapa abierta no hay corrida válida. Despierto:
   `chat-timeout` = AUD.9; `opencode-terminal` falló 2/2 al despertar y pasó 13/13 repetido (flaky, sin ítem);
   `chat-retry-report` pasó 27/27 dos veces en el día. La corrida del 2026-11-10 (`a3c6648`) no vale, el Mac durmió en batería toda la noche (CI.82:
   ahora `caffeinate` y el guard marca "corrida inválida"). Repetidos despierto: 2 eran del sueño, 3 eran deriva del
   gate (CI.83) y uno destapó un desborde real de la terminal al 125 % (CI.84). Sin repetir todavía: `auto-flow`,
   `chat-*` (attachments, context, followup-task, permissions, readonly-shell, retry-report) y los 3 flaky;
   `chat-timeout` es AUD.9. Para que la corrida cuente: Mac enchufado y con la tapa abierta. Al arrancar, leer el
   aviso del startup-guard y resolver lo rojo antes del siguiente ítem.
9. Biome: ~276 avisos, con tope por regla (`scripts/lint-budget.json`, CI.80): solo bajan (en ACT.1: `any` 135,
   `noArrayIndexKey` 14). Los de producto (`any`, `!` 90) cambian código real; bajarlos lo decide Carlos.
10. Cabos sueltos de la sesión SK.1/SK.2 (2026-11-06/07):
   - PR #4 (README sync, conteo de tests) abierto: espera merge de Carlos.
   - Set curado en `~/.orchestos/skills/` sin fases: `tdd`, `karpathy-guidelines`, `verification-before-completion`,
     `impeccable` no aplican solas hasta marcar sus chips "Applies in" (SK.2). Propuesta: Build+Fix para las tres
     primeras; `impeccable` sin fase (solo tareas de UI) hasta que haya triggers. Decide Carlos.
   - El import de `SKILL.md` no trae auxiliares: `impeccable` remite a 33 `reference/*.md`, `security-audit` a 4,
     `tdd` a 2. Anotado, sin ítem.
11. "navegador propio" sin anotar en `IDEAS.md` hasta que Carlos diga qué espera de él.

**Trampas de cierre** (2026-11-12): `delegate qa` exige un archivo de spec (en `/tmp` vale), no texto suelto; el
plan-gate pide la línea `Ejecutado por: … · Spec: docs/specs/<ID>.md` o `Sin delegación: <motivo>` en cada `[x]`;
el hook deja al cerebro editar código solo de a ≤20 líneas por `Edit` (ni `sed`/heredoc sobre `src/` ni
`scripts/`); `mecanico` puede reescribir el spec que recibe, así que no sirve como registro. Delegar un addendum
con el spec entero hace que el ejecutor rehaga o se pierda: un ajuste chico va en su propio spec
(`docs/specs/<ID>-fix.md`), y si el árbol trae el diff sin commitear del mismo ítem, el spec debe decir que es suyo
(si no, el ejecutor se niega por "cambios ajenos"). Los CLI de chat falsos de los ui-gates siguen el patrón de
`scripts/ui-gate/flows/lessons.mjs` y `dev-session-tabs.mjs` (binario en un temporal + preload sobre
`systemCliDiscoveryProbe`/`systemCliHealthProbe` + `restartDashboard`); `chat-followup-task.mjs` usa un CLI
real. Los fallos `EADDRINUSE`/`EPERM` del ejecutor en `test:coverage` son de su sandbox: se re-corre fuera.

**Ojo**: tras cambios de UI, `bun run build:app`; el dashboard lee `dist/` del disco, así que un build roto deja en
blanco también el dashboard de Carlos (:4242) — probar la carga antes de seguir.

Cerrado del 2026-11-07 al 09 (detalle en `docs/done/bloque-*.md` y git): bloque ADE completo (ADE.1–11), CI.66–80
salvo CI.69/CI.76, SK.3, UI.70, LIMP.4, auditoría de `IDEAS.md` (`73247216`) y limpieza de `PLAN.md` (rumbo viejo en
`docs/done/plan-historico-2026-11-09.md`).

## Trampas vivas (las que no están en `AGENTS.md`)

- `plan:reconcile` marca el ítem `[x]` en la DB con SHA provisional; si después cambias su texto y reconcilias
  otra vez falla ("Could not prove a closing commit SHA"): pasar el ítem a `[ ]`, reconciliar, volver a `[x]`,
  reconciliar. El cierre exige además la línea `Ejecutado por:` en el ítem.
- `agent:live-gate`: la ruta de evidencia en backticks va en la MISMA línea que `Gate en vivo:` (con
  navegador/browser/Playwright en ella), y el archivo staged en el mismo commit.
- PLAN.md se renderiza desde la DB: tras editarlo a mano, `bun run plan:reconcile` antes del commit (si no, el
  pre-commit falla en `plan-render --check`). Al cerrar con spec nunca commiteado, el commit imprime
  `pathspec 'docs/specs/<ID>.md' did not match`: es inofensivo, el commit entra.
- Tocar `src/router/model-catalog.ts` (y demás de `.claude/protected-rules.json`) exige entrada nueva en `LEDGER.md`
  en el mismo commit.
- El hook del cerebro permite `Edit` de ≤20 líneas en `src/`; Bash/heredoc y `Write` sobre `src/` se bloquean.
- `delegate` le prohíbe al ejecutor editar `PLAN.md`/`NEXT.md`: un ítem que solo mueve texto del plan lo hace el
  cerebro (DOC.5).
- `delegate <rol>` exige ruta a un archivo de spec; `leer` e `investigar` aceptan la pregunta directa.
- No marcar `[x]` antes de que el ejecutor termine: su preflight exige el ítem abierto.
- Codex en silencio: mirar sus logs (`logs_2.sqlite`, rollout en `<proyecto>/.orchestos/agent-home/codex/sessions/`)
  antes de culpar al producto. Gates que dependen de Codex necesitan cupo; sin él, no cuentan como validación.
- Codex corre con el `CODEX_HOME` de Orca (`~/Library/Application Support/orca/codex-accounts/*/home`).
- El flujo `opencode-terminal` no va en el pre-push (necesita el binario `opencode`; CI no lo tiene).
- Hub que importa todos los motores (`task-engines.ts`) agranda cada shard de mutación: medir
  `scripts/mutation-test-shard.ts` por shard al sumarlo.
- `method/bin/delegate.test.sh` "sin temporales" falla si corre otro `delegate` (mira `/tmp` global). La contraprueba
  de un test de `~/.agent-method` copia a `<tmp>/method/hooks/` y corre desde `<tmp>`.
- Spec o doc con comandos de escritura dentro de un heredoc de Bash dispara `brain-no-code`: usar Write/Edit.
- `.gitignore:55` ignora `.github/workflows/`: un workflow nuevo se suma con `git add -f`.
- La línea `Ejecutado por: … · Spec: docs/specs/<ID>.md` debe terminar en `.md` (sin "(borrado)"): si no, el
  plan-gate falla con "Procedencia <ID>: commit must delete…".
- Push desde un worktree solo después de CI.67 (`85f09c44`); antes, la suite commiteaba fixtures en la rama.
- Un ítem `[x]` ya reconciliado no se puede reescribir antes de su commit ("Could not prove a closing commit SHA"):
  pasarlo a `[ ]`, `plan:reconcile`, volver a `[x]`, `plan:reconcile`.
- Texto visible nuevo en TSX exige una línea `Texto visible: "<texto>" (por qué no basta un ícono)` en el ítem.
- Sonda de carga tras cada `build:app` de UI: `node --input-type=module - http://localhost:4242/ < probe.mjs`
  (Playwright, imprime `pageerror`; el script vivió en `/tmp/ade-ref/probe.mjs`). Un `tags.X` inexistente de
  `@lezer/highlight` pasa `tsc` (índice abierto) y deja la app en blanco.
- `ui:text-gate` también exige declarar textos que solo cambiaron de línea ("Loading…" en ADE.1).
- Evidencia: `docs/done/evidence/**/*.png` está en `.gitignore`; el plan-gate exige citar un `.json` del ítem.
- Cerrar la pestaña en Orca no mata la sesión de Claude: el proceso sigue vivo bajo `Orca Helper` (uno llevaba 8
  días) y retiene el candado de escritura. Salir con `/exit` antes de cerrar la pestaña; huérfanos:
  `ps -axo pid,etime,command | grep '[c]laude'`.
- Dos ítems con un solo spec nunca commiteado: el plan-gate solo acepta un spec compartido que estuvo en la historia;
  el segundo ítem declara `Spec: docs/specs/<su ID>.md` (inexistente) y nombra el compartido en el texto.
- `git commit -- $VAR` en zsh no separa palabras: usar `xargs` o `${=VAR}`.
- Apagar el dashboard (:4242) mientras Carlos lo usa le deja la pestaña abierta sin datos: hilos vacíos y el
  modelo guardado crudo en el composer (`gpt-reserve`). Si lo está usando, se deja arriba y se avisa.
- `git commit --only -- <ruta>` y `--amend` no pasan `agent:live-gate` (mira lo staged, no el commit): para sumar un
  arreglo a un commit sin subir, `git reset --soft HEAD~1` y recommitear por rutas.
- `ui:text-gate` cuenta `title`/`aria-label` como texto visible; un `aria-label` en `<span>` exige `role="img"`
  (lint `useAriaPropsSupportedByRole`, solo lo ve el pre-push si no se corre `bun run lint`).
- `qa-negative` depende de que Claude escriba a propósito una salida incorrecta: falló 1 vez en el pre-push
  (2026-11-07) y pasó 26/26 aislado.

## Anotado, sin ítem (abrir ítem solo si Carlos lo pide; los intermitentes, también si se repiten)

- Visto en la prueba en vivo de AUD.3 (2026-11-10): `requireSpec` existe en `OrcheConfig` (`schema.ts:98`) y el
  harness lo consulta (`harness.ts:170`), pero `mergeWithDefaults` (`config/load.ts`) no lo copia del yaml: declararlo
  en `orchestos.config.yaml` no tiene efecto. Misma clase que el `sandbox` de AUD.2. Revisar qué otros campos del tipo
  se pierden igual antes de abrir ítem.
- AUD.2, hallazgo P2 de `qa` sin corregir: un derivado sin trackear dentro de un directorio nuevo (`?? build/`) no se
  reconoce y bloquea el sandbox con `DirtyTreeError`. Falla hacia el lado seguro y ya pasaba antes. Arreglo probable:
  `--untracked-files=all` en `sandbox-policy.ts`, pero cambia la lista de "sucios" que ve la UI; decidirlo antes.
- **Repetido 2026-11-10** (2.ª vez; toca abrir ítem al terminar el lote AUD): el timeout de `session-status.test.ts`
  de abajo, en `test:coverage` con el diff de AUD.2; la corrida siguiente, 0 fallos.

- Visto 2026-11-06: `session-status.test.ts` ("lee cada transcript como máximo una vez") timeout de 5 s en
  `test:coverage` bajo carga; aislado 3/3. El repo no registra `writer-lock release` en SessionEnd (lo hace el hook
  global; sin él el candado vence a los 45 min). Menú del clip en Dev tapa el título del estado vacío (aceptado).

- Visto 2026-11-05: `chat-retry-report` falló 2 veces por el timeout de 30 s esperando el primer turno de Codex
  (`waitForResponse` sin timeout propio); en esa captura el mismo párrafo de Codex salió dos veces (posible stream
  duplicado, sin verificar). Acabados: el menú del clip tapa el borde del composer; "Interrupted" sale dos veces en la
  tarjeta; `pending` con reintento muestra el resumen, no el diagnóstico.
- Sin evidencia de cierre: el revisor elige su ventana cortando en el primer tramo que no cabe; TRUST.7.1 sin gate
  vivo del caso de residuos; `elapsed_ms` no cuenta el cuelgue de Codex y `effort` del rol quizá no llega a
  `cli_effort`; reemplazar el prompt base del CLI (punto 8 de AT.13); "Executor reply" de Contract sin mirar a ojo;
  `Run` de Settings → Plan sin probar en vivo. Fuera de alcance: CLI genérico en el chat (necesita streaming).
- Intermitentes vistos una vez: `chat-continuity` timeout de 180 s esperando al modelo; `chat-streaming` scroll con
  la cobertura en paralelo y `t_first=null` en Dev; `chat-context` clic de Codex a Claude; `restart-mid-run` caso A
  ("failed · attempt 1/3" con reintento pendiente: decidir si debe decir "failed").
- `pickAutoSkill` elige una skill `explicit` si es candidata única (`chat.ts:791`); `src/tasks/init.ts:71` genera
  `skill_id` sin YAML; `permissions` parpadea a `null` (`OrchestChatView.tsx:108`).
- `readBoundaryWarning` tiene consumidores; quitarlo cambia lógica (decide Carlos). Sin cupo, el chat muestra "out of
  usage credits" como respuesta normal (sin re-verificar).
- Sin re-verificar: Settings → Tasks "Loading live settings…" fijo; Skills resalta "Instincts"; fila `<synthetic>` en
  "CLI tabs"; "Avg cost / run" mezcla runs y sesiones; selector de sprints fijo en `PlanBoardView.tsx`;
  "Loading project data…".
- Decisión pendiente (UI.13.4b): la frontera por argumentos no frena `node -e`/`sh -c`; la barrera real es sandbox de
  proceso o lista de binarios.
- ONB: con una sola CLI, Reviewer = Executor (la UI avisa "errors may correlate"); el caso "ninguna CLI" solo
  está probado en tests; health `functional` de OpenCode no prueba que el servicio responda (huérfano 32162).
- "Clonar desde URL" en "+ Add project": feature nueva, plan corto antes.

## Decisiones de Carlos vigentes

- Decidido por el cerebro en ADE, Carlos puede revertir: cola por defecto "Queue message"; clic en notificación
  abre Dev solo si el hilo es pestaña de Dev abierta; ajustes de proyecto en la DB local, no en el config del repo.
- Revisión de Settings pestaña por pestaña: cerrada por ahora (Carlos, 2026-11-05).
- Nada hardcodeado en quién ejecutó una tarea: lo dice la config.
- Memory = entrada mecánica por tarea terminada, sin LLM.
- Árbol sucio = seguir bloqueando + tarea `pending` + "Commit & Run" en el hilo.
- Peso de `main.js` (2,41 MB con React de producción, 2026-11-13) aceptado; no se reabre sin síntoma medido.

## Entorno

- Repo: `~/Projects/projects/orchestos`. Piloto ERP: `~/Projects/projects/erp-piloto`; conductor Playwright en
  `docs/done/evidence/ERP.4/conductor/`.
- Inventario de código muerto: `bunx knip@5` con config fuera del repo; falsos positivos conocidos en fixtures,
  `assets.d.ts`, `tailwindcss` y archivos que un test lee por ruta.
