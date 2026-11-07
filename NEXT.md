# NEXT — handoff 2026-11-07 (CI.66, CI.67, SK.3, UI.70; sigue el desacople)

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Orden

0. Hecho 2026-11-06: CI.55 fase 2 `bb92b483`; CI.63 `fe602898`; CI.64 `0e6fdac7`; UI.65 `aafee2ce`; limpieza
   `735bf403` (307 archivos, 3,2 MB); regla de push cada 2 commits `1e69a1d2`; DEV.1 `a557f107` (candado en
   `scripts/writer-lock.mjs`); SK.1 `c222bfc5` (biblioteca `~/.orchestos/skills/`, activación por proyecto, "Add
   skill"); CI.65 `4d7d6e62` (gates de chat esperan "Send" habilitado). Push confirmado.
0a. Hecho 2026-11-06: set curado en `~/.orchestos/skills/` (apagado por defecto; se enciende por proyecto):
   `karpathy-guidelines`, `grilling`, `to-spec`, `tdd`, `impeccable`, `verification-before-completion`,
   `security-audit`. `grill-me` se quitó: solo dice "Call the Skill tool with grilling"; se importó `grilling`, que
   trae el contenido. En el repo OrchestOS la `verification-before-completion` propia (`skills/`) gana a la de la
   biblioteca, como manda la precedencia. **Límite visto**: el import no trae archivos auxiliares; `impeccable`
   remite a 33 `reference/*.md`, `security-audit` a 4 y `tdd` a 2. Si SK.2 las usa en serio, sumar import de
   auxiliares (anotado, sin ítem). README sync: el repo no dejaba a Actions crear PRs (activado); rama por run
   `f4d4a63e`; PR #4 abierto para Carlos.
0b. SK.2 hecho `7e7da8a5`: chips "Applies in" por skill de biblioteca; el ejecutor recibe principal + automáticas
   de su fase (tope 48k); `runs.phase_skills_json` (migración 36). El set curado de `~/.orchestos/skills/` aún no
   tiene fases: asignarlas es parte de SK.3 (defaults del perfil no programador). Ojo: una de biblioteca marcada solo
   "Review" entra a QA como gate (`resolveGates`), y `security-audit` pesa 22 KB.
   SK.3 (hecho 2026-11-07): perfil "¿sabes programar?" en el onboarding; si no, el orquestador pregunta primero
   (`grilling`) y revisión y seguridad corren siempre. Motivo: el método funciona con quien sabe código; un no
   programador no pide cada fase. Falta spec.
0b2. Hecho 2026-11-07: UI.66–69 venían de una sesión perdida en el worktree `ui-fixes`; su push filtró 13 commits de
   fixtures (revertidos `85379e95`). Causa CI.67 `85f09c44`: desde un worktree git exporta `GIT_DIR` a los hooks y la
   suite lo heredaba. CI rojo desde SK.2 → CI.66 `f149cba9` (orden de `readdirSync`). SK.3 `d132e976` (perfil
   global `~/.orchestos/profile.json`, tarjeta en Chat vacío, "no programa" → `grilling` en el chat, revisor
   forzado y `security-audit`). UI.70 `7bfb7199` (íconos Material Icon Theme en árbol, diff y tabs). Worktree
   `ui-fixes` borrado. Tauri y caché de Safari anotados en `IDEAS.md` #41 (sin ítem). Falta anotar en `IDEAS.md` el
   "navegador propio" cuando Carlos diga qué espera de él.
   **Ojo**: tras traer cambios de UI, `bun run build:app` + reiniciar el dashboard; Safari puede servir `main.js`
   viejo (Cmd+Option+R) hasta que se haga el arreglo `?v=<hash>`.
0c. **Desacople del método personal**, después de SK.1–3 (GO de Carlos): reescribir `AGENTS.md`, hooks `.claude/`
   (`brain-no-code.js:16`, `subagent-budget.js:156`, `context-budget.js:30`), `docs/roadmaps/` y fixtures sin
   `agent-method`/`delegate`/Sol/Luna/vault; plan y tabla en `docs/specs/LIMPIEZA-2.md` § 2. Las reglas personales que
   valga la pena conservar pasan a skills y perfil del producto. El candado ya está hecho (DEV.1).
0d. Mutación: sigue nocturna (`Mutation Shards`, cron `0 3 * * *` UTC). Propuesto a Carlos, sin GO: el arranque de
   sesión muestra el resultado de la última corrida nocturna (verde/rojo, duración, módulos que bajaron). ODD
   descartado (sin definición estable; solo eval-driven tiene respaldo, arXiv 2411.13768).
1. CI.55 fase 2 hecha: el gate sigue el reintento y guarda el rollout de Codex por intento. Espera su próximo
   fallo: leer `codexRollouts` de `role-task-missing-output-attempt-<n>.json` (nota `gate-role-task retried`).
2. **`Mutation Shards`** (CI.61): corrida 42006593533 debajo de 150 min. Si una posterior pasa 150, reabrir CI.61.
3. **Esperan su próximo fallo**: CI.57 `composer-picker-model-missing.json`; CI.54 `turn1-bubble-missing.json`; CI.19,
   el motivo en el detalle del paso. Leer el JSON el mismo día: CI.62 borra el `runDir` a las 24 h.
4. Cualquier CLI corre tareas sin código (Settings → Providers → "CLIs propios"). Un adaptador rico para un CLI nuevo
   sigue siendo `KNOWN_CLIS` + `registerTaskEngine`, y lo prueba el cerebro, no Carlos.

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
