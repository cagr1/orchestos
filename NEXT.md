# NEXT — handoff 2026-11-13, noche (uso real; USO.8–USO.10 cerrados)

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Orden

Rumbo de Carlos del 2026-11-12 (`PLAN.md` § Rumbo): uso normal → uso real → Windows → Tauri. Antes: lote de
auditoría AUD.1–AUD.28 en el orden de la segunda auditoría; lo cerrado está en `docs/done/bloque-AUD.md`.

1. **Etapa 1 — cerrada 2026-11-13**: AUD.14, AUD.17, AUD.16 y SES.1 (a `58c67af0`, b `eea3f797`, c `c76a0ed5`).
   Trampas que dejó: el preflight solo ve ítems sin sangría (`scripts/agent-governance.ts:37`); cerrar un ítem exige
   `Ejecutado por: … · Spec: docs/specs/<ID>.md` y, si `plan:reconcile` ya lo marcó done antes del commit, reabrirlo,
   reconciliar y cerrarlo de nuevo; esperas de tests de procesos ≥4 s (las de 1 s tumbaron el pre-push con carga).
2. **Etapa 2 — uso real (ahora)**: Carlos trabaja en OrchestOS en vez de Orca. Lo que reporte se abre como ítem con su
   evidencia y va primero. Cerrados antes de empezar: USO.1 `6d5e420e` (los 12 rojos de la nocturna inválida: 9 eran
   sueño del Mac, 2 gates desfasados, 1 producto roto en `providers`) y LRN.1a `202dce5d` (F0 de lecciones).
   Cerrados en esta sesión: USO.2 `78b53643` (el dashboard abre sin `#t=`: el token va en un meta del HTML, se
   borró la pantalla "Dashboard token required", `orchestos dashboard` abre el navegador, `--no-open`) y LRN.1b
   `a6122e4e` (F1: `## Lessons` en el prompt del chat, `propose_lesson`, Remember, edición en Instincts; gate
   `lessons`). Tarde del 2026-11-13, reportes de Carlos: USO.3 `8e11385d` (UI servida con React de desarrollo:
   `build-app.ts` sin `NODE_ENV`; sondeo de 1 s en Dev y tareas; `gpt-reserve` oculto por Codex; Claude sin grupo
   `OLDER`), USO.4 `705e205a` (divisor bajo la barra superior), USO.5 `6b1e0805` (desvanecido arriba del hilo),
   USO.6 `0cb8f2f9` ("Thought" de Dev repetía la respuesta) y ACT.1 `0b5cc0dd` (vista de actividad como Claude
   Code en Chat y Dev: `components/thread/activity.ts` + `TurnActivity.tsx`). Noche: USO.8 `7d2ecc20` (al cargar solo se pide la línea de tiempo del hilo abierto) y USO.9 `3d79153b` (el
   dashboard se caía si un transcript se borraba al leer el estado). **Push sin pre-push** durante esta etapa
   (`CLAUDE.md`, `100097d5`). USO.10 cerrado (`docs/done/evidence/USO.10-live.json`). Orden: USO.11 (web y documentos en el Chat; incluye borrar la fila "Orchestrator
   unassigned… Model routing" de `AgentComposer.tsx:1256`, pedido de Carlos), USO.12 (borrador del composer, spec
   lista), MSG.1 (escribir la spec). Las 2 tareas que el chat dejó en `tasks.yaml` se sacaron y viven como
   `docs/specs/USO.12.md` y `docs/specs/MSG.1.md`. LRN.1 queda abierto solo con F2 (espera datos de F0, D6). WIN.1
   necesita una máquina Windows.
   Trampas: un ui-gate de Dev que escribe justo tras `Launch Agent` debe esperar la fila del agente
   (`aside[data-resizable-aside="left"] [data-thread-id]`): el borrador de la pestaña nueva se pierde al cambiar (USO.12).
   Cerrar un ítem sin delegación exige una línea propia `Sin delegación: <motivo>`, y la de
   `Ejecutado por: … · Spec: docs/specs/<ID>.md` debe terminar en `.md` (regex de `scripts/plan-gate.ts:173`). Codex no
   protege contra `null` lo que el Chat sí protegía al portar código entre vistas: mirar Dev en vivo. El ejecutor Codex no corre ui-gates (no puede invocar CLIs): los corre el cerebro con
   `bun run gate:evidence -- --label <ID>-<flujo> -- bun run ui:gate -- <flujo>`; un gate que cuenta filas de Settings
   se rompe al sumar una fila (pasó con SES.1b); `boundary-budget` rechaza `JSON.parse` nuevo, usar `parseJson` de
   `src/boundary` — salvo en la UI: importar `src/boundary` desde `app/src` mete zod y yaml al bundle (+430 KB,
   visto en ACT.1); allí `JSON.parse` con `try`. Re-correr la nocturna con `caffeinate` o el Mac enchufado. No se revisan pantallas por iniciativa propia.
3. **Etapa 3 — Windows**: WIN.1, fase 1 = prueba de humo. Nada se arregla antes de verla fallar.
4. **Etapa 4 — Tauri** (decidido, `IDEAS.md` #41). Se gradúa al plan al abrir la etapa.
5. **Aparcados, no se toman** (`docs/done/aparcados-2026-11-12.md`): CI.19, CI.54, CI.55, CI.57, CI.69, CI.76, CI.81,
   AUD.8, AUD.9, AUD.10, AUD.27, AUD.28. Si uno de esos gates falla, se lee su JSON el mismo día (CI.62 borra el
   `runDir` a las 24 h) y se reabre solo si es producto roto.
6. **Decisión pendiente de Carlos, con recomendación del cerebro**: pausar la nocturna de ui-gates y la mutación
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
