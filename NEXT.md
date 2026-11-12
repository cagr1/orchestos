# NEXT — handoff 2026-11-12 (lote de auditoría AUD.19–28; AUD.25 en curso)

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Orden

1. **Siguiente: lote de auditoría** (GO de Carlos 2026-11-10 para AUD.1 y AUD.2; antes: "decide Carlos — otro bloque
   de producto o el mes de uso real"). Informe y dirección por ítem: `docs/auditoria-2026-11-10.md`.
   - AUD.1, AUD.2 y AUD.3 cerrados. Antes de delegar cada uno, el cerebro comprueba con grep su lista de "no verificado" y
     lee entero el módulo que toca y sus tests (AUD.1: 5 enmiendas; AUD.2: 3, todas por casos borde de rutas de git).
   - AUD.4 cerrado 2026-11-11 (`runs.failure_kind` + chip en hilo y Runs; evidencia en `PLAN.md`).
   - 2026-11-11, sesión aparte: AUD.11 (tasks.yaml estricto), AT.22 (el cerebro hace fixes de ≤20 líneas; el hook
     lo permite) y AUD.18 (`src/boundary/` con Zod + gate `boundary-budget` en pre-commit, 140 parseos, solo baja)
     cerrados. Abiertos AUD.12–17 (migrar esos parseos; AUD.13 es seguridad): van después de AUD.7 y bajan el
     presupuesto. Parseo nuevo de datos externos → `src/boundary`, o el commit no entra.
   - 2026-11-11, segunda auditoría completa (`docs/auditoria-2026-11-11.md`): abre AUD.19–AUD.28. Cuatro clases
     nuevas además de la validación: aislamiento entre proyectos (AUD.19), pérdida de datos (AUD.20), resultados
     aceptados que no debían (AUD.21, AUD.26) y ciclo de vida de procesos y turnos (AUD.22, AUD.24).
   - **Siguiente — orden vigente** (Carlos, 2026-11-11: "comenzar según tu orden"), con spec nuevo cada uno:
     AUD.20 → AUD.19 → AUD.7 → AUD.23 + AUD.13 → AUD.21 + AUD.5 → AUD.22 + AUD.6 → AUD.24 → AUD.25 →
     AUD.26 + AUD.9 → AUD.12, 14–17 → AUD.27 + AUD.8 → AUD.10 → AUD.28. Antes: AUD.7, AUD.5, AUD.10, AUD.8, AUD.9,
     AUD.6 (orden de la primera auditoría).
     - AUD.20 cerrado 2026-11-11 (`1b06897b`; evidencia en `PLAN.md` y `docs/done/evidence/AUD.20-live.json`).
     - AUD.19 cerrado 2026-11-11 (`01b3648a`; evidencia en `PLAN.md` y `docs/done/evidence/AUD.19-live.json`). Queda sin gate
       en vivo: las carreras de cambio de proyecto de `App.tsx`.
     - AUD.7 cerrado 2026-11-12 (`c9c0fac6`; token persistente + `guardRequest`; evidencia `docs/done/evidence/AUD.7-live.json`).
       Desde aquí el dashboard se abre con la URL `#t=` que imprime `orchestos dashboard`; scripts que llamen a `/api`
       mandan `x-orchestos-token` (archivo o `ORCHESTOS_DASHBOARD_TOKEN`).
     - AUD.23 + AUD.13 cerrados 2026-11-12 (`08df6053`, `73345523`; evidencia `docs/done/evidence/AUD.23-live.json`).
       Residual aceptado: opción corta pegada a un symlink preexistente (`-fleak.txt`) en la regla readOnly de Codex.
     - Nocturna de ui-gates 2026-11-12 sobre `01b3648`: 0/50 por la regresión de AUD.19 (`/api/health` exigía proyecto),
       corregida en `c9c0fac6` (smoke, dev-terminal, user-profile pasan). Mirar la próxima corrida antes de seguir.
     - AUD.21 + AUD.5 cerrados 2026-11-12 (`26358263`; evidencia `docs/done/evidence/AUD.21-live.json`). `task run` ya no llama
       al Auxiliar tras `done` y sale 1 si la tarea no queda `done`.
     - AUD.22 + AUD.6 cerrados 2026-11-12 (`adb93357`; evidencia `docs/done/evidence/AUD.22-live.json`). Los motores se lanzan
       como grupo (`src/run/process-tree.ts`): todo spawn nuevo de un CLI de agente pasa por `spawnTree`.
     - AUD.24 cerrado 2026-11-12 (evidencia `docs/done/evidence/AUD.24-chat-stop-result.json`). El lease del turno se
       renueva; recargar a mitad de turno conserva Stop y actividad.
     - **AUD.25 EN CURSO (2026-11-12, sesión cortada a mitad de la ejecución).** Spec `docs/specs/AUD.25.md`
       (11 puntos; decisión tomada: `!comando` en Dev va al tab terminal del proyecto, en Chat se quita el modo shell).
       Delegado a `criterio`; al cortar ya había editado 17 archivos (app, `handlers/explorer.ts`, `server.ts`,
       `html-script-check.ts`, `scaffold.ts`, `_shared.ts`, `cli-transcripts-reader.ts`) y escribía los ui-gates.
       Al retomar: (1) `git status` y `git diff --stat` — los cambios sin commitear SON de AUD.25, no ajenos;
       (2) relanzar `delegate criterio docs/specs/AUD.25.md` con la nota "continúa: el árbol ya tiene parte hecha;
       revisa cada punto del spec, completa lo que falte, tests y ui-gates"; (3) el cerebro lee el diff, corre tsc,
       lint, `test:coverage` y los ui-gates en vivo con `gate:evidence`; (4) `qa` sobre el diff; (5) cierre en
       `PLAN.md` con línea `Gate en vivo: navegador Playwright … \`<evidencia>.json\`` en UNA línea y
       `Ejecutado por: … · Spec: docs/specs/AUD.25.md`, borrar el spec, commit por rutas, push.
       Trampa de cierre vista en AUD.24: si `plan:reconcile` se corre dos veces con el ítem ya `[x]`, falla
       ("Could not prove a closing commit SHA"): poner `[ ]`, reconciliar, volver a `[x]`, reconciliar.
     - Después de AUD.25: AUD.26 + AUD.9. Lo no marcado ✔ en el informe se comprueba
       con grep al escribirlo. No relanzar los auditores: su salida literal está en los anexos.
     - AUD.28 cambia comportamiento central: plan corto y GO de Carlos antes de delegar; no tiene GO.
     - Sin leer en la auditoría: `components/ui/*` por dentro, `scripts/ui-gate`, `tests/`.
   - Decisiones de Carlos pendientes: adoptar el tamaño por reanudabilidad de ODD en el proceso; qué ideas de
     `IDEAS.md` entran al cierre (propuesta en el informe); Tauri (recomendado) o Electron, después de AUD.7.
   - Cupo: la auditoría gastó ~35 % del cupo de 5 h. No relanzar agentes de lectura: la evidencia ya está escrita.
1a. **Primero tras el lote AUD (Carlos, 2026-11-12): SES.1** — cerrar una sesión de verdad: archivar detiene el
   turno en curso y la X del tab deja de parecer un cierre. Detalle en `PLAN.md` § "Abiertos — ciclo de vida de
   sesiones".
1b. **Después del lote AUD (Carlos, 2026-11-10: "primero lo pendiente y luego esto")** — ritmo de entrega. Medido
   el 2026-11-10: pre-commit 5 s, pre-push 124 s, CI ~2 min verde; los hooks no son la causa. Desde el 2026-11-08,
   2 de ~30 commits fueron de producto (ADE.11, CI.79); el resto CI.72–84, AUD y 22 `docs(NEXT)` en la semana; la
   cola lista no tiene ítem de producto. Causa: cada rojo de la nocturna se vuelve CI.\* prioritario y muchos son
   gate desfasado de la UI, no producto roto. Propuestas a decidir: (a) medir avance en ítems de producto cerrados,
   no en commits; (b) rojo nocturno = producto roto → primero; gate desfasado → lote semanal; (c) cada lote alterna
   producto con CI/AUD. Ya aplicado: push tras cada commit (`74e43672`).
2. Ui-gates nocturnos: la del 2026-11-11 (`089302a`) tampoco vale: durmió en batería hasta las 08:16 pese a
   `caffeinate` (36 eventos, `sleeps` del JSON) — sin enchufe y tapa abierta no hay corrida válida. Despierto:
   `chat-timeout` = AUD.9; `opencode-terminal` falló 2/2 al despertar y pasó 13/13 repetido (flaky, sin ítem);
   `chat-retry-report` pasó 27/27 dos veces en el día. La corrida del 2026-11-10 (`a3c6648`) no vale, el Mac durmió en batería toda la noche (CI.82:
   ahora `caffeinate` y el guard marca "corrida inválida"). Repetidos despierto: 2 eran del sueño, 3 eran deriva del
   gate (CI.83) y uno destapó un desborde real de la terminal al 125 % (CI.84). Sin repetir todavía: `auto-flow`,
   `chat-*` (attachments, context, followup-task, permissions, readonly-shell, retry-report) y los 3 flaky;
   `chat-timeout` es AUD.9. Para que la corrida cuente: Mac enchufado y con la tapa abierta. Al arrancar, leer el
   aviso del startup-guard y resolver lo rojo antes del siguiente ítem.
3. **Esperan su próximo fallo** (`PLAN.md` § Abiertos): CI.76 (`notifications`); CI.69 (`usage-bar`); CI.57
   `composer-picker-model-missing.json`; CI.54 `turn1-bubble-missing.json`; CI.19; CI.55
   (`role-task-missing-output-attempt-<n>.json`). Leer el JSON el mismo día: CI.62 borra el `runDir` a las 24 h.
4. Biome: 282 avisos, con tope por regla (`scripts/lint-budget.json`, CI.80): solo bajan. Los de producto (`any`
   137, `!` 90) cambian código real; bajarlos lo decide Carlos.
5. Cabos sueltos de la sesión SK.1/SK.2 (2026-11-06/07):
   - PR #4 (README sync, conteo de tests) abierto: espera merge de Carlos.
   - Set curado en `~/.orchestos/skills/` sin fases: `tdd`, `karpathy-guidelines`, `verification-before-completion`,
     `impeccable` no aplican solas hasta marcar sus chips "Applies in" (SK.2). Propuesta: Build+Fix para las tres
     primeras; `impeccable` sin fase (solo tareas de UI) hasta que haya triggers. Decide Carlos.
   - El import de `SKILL.md` no trae auxiliares: `impeccable` remite a 33 `reference/*.md`, `security-audit` a 4,
     `tdd` a 2. Anotado, sin ítem.
   - "Thought" en el chat repetiría la respuesta (Carlos, 2026-11-06). Sin reproducir: en `~/.orchestos/db.sqlite`
     los pasos `reasoning` de Claude llegan vacíos y los de Codex son resúmenes cortos; "Thought" solo muestra pasos
     `reasoning` (`app/src/api/chat.ts:279`). Necesita un caso (agente, modelo, captura) antes de abrir ítem.
6. "navegador propio" sin anotar en `IDEAS.md` hasta que Carlos diga qué espera de él.

**Trampas de cierre** (2026-11-12): `delegate qa` exige un archivo de spec (en `/tmp` vale), no texto suelto; el
plan-gate pide la línea `Ejecutado por: … · Spec: docs/specs/<ID>.md` o `Sin delegación: <motivo>` en cada `[x]`;
el hook deja al cerebro editar código solo de a ≤20 líneas por `Edit` (ni `sed`/heredoc sobre `src/`); `mecanico`
puede reescribir el spec que recibe — no fiarse de él como registro.

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
- Peso de `main.js` (~1,9 MB) aceptado; no se reabre sin síntoma medido.

## Entorno

- Repo: `~/Projects/projects/orchestos`. Piloto ERP: `~/Projects/projects/erp-piloto`; conductor Playwright en
  `docs/done/evidence/ERP.4/conductor/`.
- Inventario de código muerto: `bunx knip@5` con config fuera del repo; falsos positivos conocidos en fixtures,
  `assets.d.ts`, `tailwindcss` y archivos que un test lee por ruta.
