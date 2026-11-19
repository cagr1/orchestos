# NEXT — AgroTienda en macOS y correcciones de Windows

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Sesión 2026-11-19 — empezar por aquí

Cerrado/subido hoy: **MUT.2 (C) `7369fbcd`** (tope de 2 GB RSS por `bun test` en `mutation-test-shard.ts`: un mutante
llevó `bun test` a 11,4 GB y el OOM tumba el runner; los logs de los shards muertos no existen, BlobNotFound),
IDEAS #75 `a596a717` (limpiar caché de los CLIs desde Settings), lint 87→86 `62f999e4`, **USO.22 `f4be44fd`** (tooltip
del menú `/` oscuro), **USO.23 `2b8d1968`** (Dev con contraste de Chat; panel derecho 300 px, ancho guardado solo si
el usuario lo cambia; Files sin peso), **USO.24 `f8ae0945`** (OpenCode se redibuja al cambiar el ancho: sesión propia
del PTY + SIGWINCH directo), **USO.25 `77f72eed`** (pestaña OpenCode negra `#0a0a0a`). Gates `shell-look` 75/75 y
`opencode-terminal` 13/13 al día.
Abierto: OpenCode avisa "Plugin failed" con `.opencode/plugin/context-budget.ts` del repo (sin revisar).

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
4. **En macOS al volver**: CMD.3 (`/cut` en OrchestOS, plan y GO antes de código; luego probar en Windows) y
   USO.21 tras usar Preview en la demo, con Playwright local en la versión web.
5. **Pendientes chicos**: plugin `context-budget.ts` que falla en OpenCode; Codex `/review` solo si Carlos lo pide.
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
   (`CLAUDE.md`, `100097d5`). 2026-11-14: USO.10 `8537462f` (Chat sin proyecto, "Open in Dev", tarjetas de tarea en Dev), CI rojo por un
   fixture de AUD.19 `5f70058f`, USO.11 `7f330150` (web y documentos en el Chat: `~/.orchestos/chats/<id>/`,
   tarjeta Download), USO.12 `ce7686b1` (borrador del composer por hilo). Evidencia en `docs/done/evidence/`.
   2026-11-14/15: MSG.1 `911b0302` (`message_session`, tabla `session_messages`, tarjeta Approve/Discard, entrega sin
   turno, inbound en `<untrusted-data>`; `untrustedContent` ahora neutraliza marcas internas), USO.13 `089e9ba7`
   (tema también en `<html>` para portales), USO.14 `91388169` (tooltips Radix en toda la UI).
   USO.15 (2026-11-15): los 11 ui-gates en verde; 9 desfasados por USO.10, y 2 productos rotos arreglados
   (notificaciones en Chat; el Chat general no reanudaba la sesión de Claude y reenviaba el transcript).
   MUT.1 (2026-11-15): shards de mutación repartidos (11 → 15) porque 4 pasaban de 3 h. La nocturna del 11-16 ya no
   cayó por tiempo sino por runner sin recursos: sigue en MUT.2 (bloque 2026-11-17 de arriba).
   **Siguiente**: lo que reporte Carlos en uso real. WIN.2 (`a0882d84`), WIN.3 (`36531977`), WIN.4 (`ef88ae9f`) y
   WIN.5 (`8c228123`) cerrados: Windows 216 → 98 tests rojos.
   **Windows en curso en el PC de Carlos (2026-11-16, Etapa 3).** Clon en `E:\Carlos\Development Tools\Proyectos\
   OrchestOS\orchestos`, Bun 1.4.0. Hechos y subidos: WIN.7 parcial (`boundary-budget` con rutas `\`), WIN.10
   (`.gitattributes` LF; el pre-commit no exporta `runs-summary.json` en Windows: cada máquina tiene su DB), WIN.8
   (Open folder/Clone con selector nativo), WIN.9 (reconcile sin `ps`). Anotado WIN.11 (IA local: Ollama +
   `qwen2.5-coder:7b`). **En el Mac, tras el pull, una vez:** `bun run hooks:install` y `bun run plan:reconcile`
   (verificado con un clon simulado: pull fast-forward limpio, commit siguiente pasa).
   **Orden siguiente (Carlos: "Codex debe funcionar en cualquier máquina"):**
   (a) **`delegate` en Windows — funciona (2026-11-16)**, arreglado en el vault `method/bin` y copiado a
   `~/.agent-method/bin`, **sin commitear en el vault**: `cygpath -w` del repo (con `E:/…` el sandbox de Codex
   arrancaba en `C:\`); `guard/git.cmd` nuevo (PowerShell no ejecuta el guardián bash sin extensión: "Acceso
   denegado"; el `.cmd` gana en PATH y lo corre con el bash de Git for Windows); `safe.directory` por
   `GIT_CONFIG_PARAMETERS` (el sandbox `elevated` corre como CodexSandboxUsers; Codex descarta variables con
   KEY/TOKEN). `delegate.test.sh` TODO OK; sonda en vivo: git pasa, `stash` bloqueado. Queda un aviso inocuo
   `.config/git/ignore: Permission denied`. **Llevar al Mac**: esa copia del vault tiene `raw/` con nombres
   inválidos en Windows y entradas `D` en el índice: **no commitear desde ahí**; aplicar los 3 cambios desde el Mac.
   Luna con `leer` en `low` a veces responde sin buscar. El ejecutor exige el ítem abierto en `PLAN.md` (preflight).
   (b) **WIN.6a, WIN.6c y WIN.12 cerrados**: Codex responde en Chat y en Dev en vivo (Chrome de Carlos); sin ventana
   de cmd; el selector de carpeta sale delante. WIN.6b descartado (el `app-server` ya arranca). (c) **Siguiente**:
   el orden de abajo. Dashboard del 4242: lo relanzó el cerebro sin variables `CLAUDE*` (PID 25868, sin log).
   **Revisión del 2026-11-16 (cerebro Fable, verificada): abiertos WIN.14–WIN.17.** Suite local: 114 rojos, no 98
   (`docs/done/evidence/WIN.17-local.txt`). Cerrados WIN.13–WIN.17, USO.17 y USO.18; CI Windows: 95 rojos
   (`docs/done/evidence/WIN.17-ci.txt`). El orden vigente de Windows está arriba. WIN.14 sin prueba en vivo: la tarea `chat-b9b3da84…` (`failed`)
   es de USO.16 y reescribiría `NEXT.md` con un estado viejo: no reintentarla; la prueba va con la tarea en vivo de WIN.1.
   Visto y sin ítem (no daña): en Windows los `mode: 0o600`/`chmodSync` no aplican, así que el token del dashboard
   (`dashboard/auth-token.ts:18`), `settings-store.ts:83` y los respaldos de la BD (`db/backup.ts`) quedan con los
   permisos heredados de la carpeta del usuario; `terminateTree` en win32 mata con `taskkill /F` sin plazo de gracia
   (`run/process-tree.ts:36`). Revisados y bien: `git diff --no-index /dev/null` y `core.hooksPath=/dev/null`
   (los tests del área pasan), apertura del navegador (`cli.ts:2199`). `PLAN.md` mantiene WIN.7 abierto (solo se
   cerró `boundary-budget`). Sin verificar: si WIN.14 pasa también en el Mac; el origen exacto de WIN.16.
   **WIN.6 (GO de Carlos 2026-11-16, como cerebro: spec → `delegate mecanico` → `qa`).** Diagnóstico en
   vivo: "Hola" a Codex en Dev no responde. `app-server` (spawn `node:child_process` de `codex.cmd`,
   `codex-app-server.ts:124`) da timeout en `initialize`; el respaldo `codex exec` pasa el prompt multilínea por argv y
   `cmd.exe` lo corta en el primer `\n`, perdiendo también los flags siguientes (`--json`) → salida texto, respuesta
   vacía. Con Bun 1.4.0 ya no hay `ERR_INVALID_ARG_VALUE`, pero el corte sigue. `codex exec … -` (prompt por stdin)
   verificado en vivo: funciona con prompt largo. Plan: (1) codex exec por stdin; (2) app-server y `generic-cli` con
   `Bun.spawn`; (3) OpenCode/`external` por stdin si el CLI lo acepta (probar en vivo antes); (4) fixtures de test
   multiplataforma; (5) "Hola" a Codex en Dev en vivo. Claude (`claude.exe` nativo) ya responde en Chat.
   Trampas de Windows: cerrar un ítem = `plan:reconcile` justo antes del commit (si "Could not prove a closing commit
   SHA": `[ ]`, reconcile, `[x]`, reconcile); sin spec, línea `Sin delegación: <motivo>`; push con `--no-verify` en un
   comando aparte (el clasificador lo pide aprobar). Al final: reinstalar desde cero con `install.ps1` para WIN.1.
   Al cerrar WIN.6 borrar `.github/workflows/win-probe.yml`.
   WIN.1 fase 1 corrida en CI (`windows-smoke.yml`, manual): instalador, dashboard, API, typecheck y ui-gate smoke
   pasan en Windows; 216 tests rojos repartidos en WIN.2–WIN.7. Falta turno de chat y tarea en la VM de Carlos.
   Re-correr tras cada WIN.n: `gh workflow run windows-smoke.yml` y bajar el artefacto `win1-smoke`.
   Flaky visto: `run-revert.test.ts:268` (TRUST.7) por timeout de 5 s con la suite cargada; pasa aislado.
   Pendiente de Carlos: cerrar en Dev las dos sesiones de prueba de MSG.1 ("Sesión de prueba MSG.1", "Pásale a la
   sesión…"); el endpoint de archivo solo acepta sesiones de Chat.
   Trampas nuevas: `mecanico` (Luna) se negó 2 veces sin cambios (leyó `NEXT.md` desfasado como "cambios ajenos"; creyó
   que los gates reservados al cerebro le impedían implementar): el spec dice el estado del árbol y el alcance del
   ejecutor. `aria-label` solo en controles de ícono (en botones con texto cambia su nombre accesible y rompe
   `getByRole(name)`). Desde USO.13 hay dos `[data-theme]`: los gates usan `div[data-theme]`. Tooltips en gates: abrir
   con `focus()`, no `hover()`. Títulos de sesión guardados a 40 caracteres sin elipsis (se ve en "Message from «…»").
   Anotado sin abrir ítem: varias pestañas "new" de Dev del mismo proyecto comparten borrador (USO.12);
   `src/run/logger.ts:16` escribe `runs/` en la raíz del proyecto (previo). LRN.1 queda abierto solo con F2 (espera datos de F0, D6). WIN.1
   necesita una máquina Windows.
   Trampas: el ejecutor Codex no puede invocar `claude`/`codex`: las sondas de CLI las hace el cerebro y van al spec.
   Claude `-p`: `acceptEdits` no cubre WebSearch/WebFetch (hace falta `--allowedTools`). El hook bloquea al cerebro
   editar `src/` por Bash; Edit sí pasa (fix chico + `qa`). Cerrar un ítem de dashboard exige en el mismo commit
   `Gate en vivo: navegador|Playwright — \`<evidencia>\`` en UNA línea y `Texto visible: "<texto>"` para texto JSX
   nuevo; si `plan:reconcile` ya lo marcó, reabrir → reconciliar → cerrar → reconciliar. Tests de chat general:
   su config va en `<ORCHESTOS_HOME>/.orchestos/config.yaml`, no en la carpeta. Cerrar un ítem sin delegación exige una línea propia `Sin delegación: <motivo>`, y la de
   `Ejecutado por: … · Spec: docs/specs/<ID>.md` debe terminar en `.md` (regex de `scripts/plan-gate.ts:173`). Codex no
   protege contra `null` lo que el Chat sí protegía al portar código entre vistas: mirar Dev en vivo. El ejecutor Codex no corre ui-gates (no puede invocar CLIs): los corre el cerebro con
   `bun run gate:evidence -- --label <ID>-<flujo> -- bun run ui:gate -- <flujo>`; un gate que cuenta filas de Settings
   se rompe al sumar una fila (pasó con SES.1b); `boundary-budget` rechaza `JSON.parse` nuevo, usar `parseJson` de
   `src/boundary` — salvo en la UI: importar `src/boundary` desde `app/src` mete zod y yaml al bundle (+430 KB,
   visto en ACT.1); allí `JSON.parse` con `try`. Re-correr la nocturna con `caffeinate` o el Mac enchufado. No se revisan pantallas por iniciativa propia.
3. **Etapa 3 — Windows**: WIN.1, fase 1 = prueba de humo. Nada se arregla antes de verla fallar.
4. **Etapa 4 — Electron** (`IDEAS.md` #41). Se gradúa al plan cuando Carlos confirme que la versión web funciona.
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
