# NEXT — handoff 2026-11-09 (CI.72–77 y CI.79 cerrados; CI.78 en curso)

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Orden

0. Hecho 2026-11-07 (bloque ADE, GO de Carlos; propuesta y comparación con Orca/T3/MonoCode en
   `docs/specs/ADE-PLAN.md`): plan `15f8630b`; ADE.1 `8c56a98f` (editar archivos: CodeMirror, ⌘S, conflicto con el
   disco, `PUT /api/explorer/file`); ADE.2 `0104b2bf` (Settings → Editor); ADE.3 `59150637` (14 atajos desde
   `lib/keybindings.ts`, Go to file ⌘P, paleta sin acciones del prototipo); CI.68 `7ad5c745` (gate `model-routing`
   espera la sugerencia). Antes, el mismo día: CI.66 `f149cba9`, CI.67 `85f09c44`, SK.3 `d132e976`, UI.70 `7bfb7199`.
1. Hecho 2026-11-07/08: ADE.4 `9fd00b9f`, ADE.5 `e369e260`, ADE.6 `46902e01`, ADE.7 `2e9aae2d` (escala UI ⌘= ⌘- ⌘0,
   ocultar ignorados por git, diff daltónico), ADE.8 `1355590c` (unificado/lado a lado, espacios, Changes en árbol),
   ADE.9 `4ad5dd8e` (Settings → Terminal), ADE.10 `3aeec278` (nombre, ícono, rama base, script de setup por proyecto;
   merge-back sin mover el checkout). Bloque ADE completo.
   Decidido por el cerebro, Carlos puede revertir: cola por defecto "Queue message"; clic en notificación abre Dev
   solo si el hilo es pestaña de Dev abierta; ajustes de proyecto en la DB local, no en el config del repo.
1b. Hecho CI.70 (GO de Carlos 2026-11-08): cada prueba corre una vez (`AGENTS.md` § Gates); pre-push sin flujos;
   todos los flujos a las 01:30 en local, resultado en el startup-guard. Mañana: leer el aviso de arranque y resolver
   lo rojo/flaky antes del siguiente ítem. Primera corrida completa: noche del 2026-11-08 (duración aún sin medir).
2. Hecho CI.71 `51a8e03d` (desacople del método personal, `LIMPIEZA-2` § 2, borrado; en git): reglas, hooks, roadmaps y
   fixtures sin `~/.agent-method`, alias de modelos ni vault. Se quedan a propósito: `delegate` en
   `scripts/writer-lock.mjs`, aislamiento de `~/.claude` en `qa-negative`/`cli-registry`, historia en `IDEAS.md`/`docs/done/`.
2b. Hecho ADE.11 `4631c4fd` (terminal escala con la UI, "Replace" por teclado, atajos de letra por carácter) y LIMP.4
   `09445a3a` (evidencia de ítems cerrados fuera del árbol; queda solo la de ítems abiertos). LIMPIEZA-2 completo.
2c. Hecho 2026-11-09: CI.72 `971b3c04` (la corrida nocturna no tenía `node` de nvm: 45/49 rojos; el instalador
   hereda el PATH del usuario y la corrida no arranca si falta un binario), auditoría de `IDEAS.md` `73247216`
   (6 hechas, 5 obsoletas fuera; quedan 21), CI.73 `333e1f86` (#62), #63 medido y cerrado, CI.74 `38b787db` (#61:
   1.078+382 avisos → 388). **Primera corrida nocturna válida: noche del 2026-11-09**; leer el aviso de arranque.
   Decide Carlos: los 378 avisos de producto (`any` 137, `!` 90, deps de hooks 48, a11y ~60) cambian código real.
2d. Hecho 2026-11-09 (tarde): CI.75 `678c23e5` (48 deps de hooks), CI.77 `27c3378f` (58 avisos a11y), CI.79
   `62c2bf34` (adjuntos de Dev se perdían: el composer se desmontaba al hidratar la sesión). Abiertos: CI.76
   (`notifications` sin Claude en el diálogo, flaky) y **CI.78 en curso** — `shell-look` al día salvo ⌘K en Settings
   (ver ítem; spec de rondas `docs/specs/CI.78.md` sin commitear, sigue con la ronda 5: diagnosticar ⌘K).
   Siguiente tras CI.78: tope de `any`/`!` en el lint (137/90, que no suba) y después Carlos elige producto o el mes
   de uso real. Biome: 282 avisos restantes.
3. Mutación 42469416136: el re-run terminó verde (todos los shards). Desde CI.70 no se vigila en sesión.
4. **Esperan su próximo fallo**: CI.69 (`usage-bar`, Enter sin envío; ver ítem); CI.57 `composer-picker-model-missing.json`; CI.54 `turn1-bubble-missing.json`; CI.19;
   CI.55 (`role-task-missing-output-attempt-<n>.json`). Leer el JSON el mismo día: CI.62 borra el `runDir` a las 24 h.
5. Cabos sueltos de la sesión SK.1/SK.2 (2026-11-06/07):
   - PR #4 (README sync, conteo de tests) abierto: espera merge de Carlos. El workflow ya abre PRs (permiso activado,
     rama por run `f4d4a63e`).
   - Set curado en `~/.orchestos/skills/` sin fases: `tdd`, `karpathy-guidelines`, `verification-before-completion`,
     `impeccable` no aplican solas hasta marcar sus chips "Applies in" (SK.2). Propuesta: Build+Fix para las tres
     primeras; `impeccable` sin fase (solo tareas de UI) hasta que haya triggers. Decide Carlos.
   - El import de `SKILL.md` no trae auxiliares: `impeccable` remite a 33 `reference/*.md`, `security-audit` a 4,
     `tdd` a 2. Anotado, sin ítem.
   - "Thought" en el chat repetiría la respuesta (Carlos, 2026-11-06). Sin reproducir: en `~/.orchestos/db.sqlite`
     los pasos `reasoning` de Claude llegan vacíos y los de Codex son resúmenes cortos; "Thought" solo muestra pasos
     `reasoning` (`app/src/api/chat.ts:279`). Carlos iba a verlo en Claude Desktop; sin rastro en git. Necesita un
     caso (agente, modelo, captura) antes de abrir ítem.
6. "navegador propio" sin anotar en `IDEAS.md` hasta que Carlos diga qué espera de él.
   **Ojo**: tras cambios de UI, `bun run build:app`; el dashboard lee `dist/` del disco, así que un build roto deja
   en blanco también el dashboard de Carlos (:4242) — probar la carga antes de seguir.

## Trampas vivas (las que no están en `AGENTS.md`)

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
- `git commit -- $VAR` en zsh no separa palabras: usar `xargs` o `${=VAR}`.
- `qa-negative` depende de que Claude escriba a propósito una salida incorrecta: falló 1 vez en el pre-push
  (2026-11-07) y pasó 26/26 aislado.

## Anotado, sin ítem (abrir ítem solo si Carlos lo pide; los intermitentes, también si se repiten)

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
