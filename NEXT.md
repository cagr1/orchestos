# NEXT — handoff 2026-11-06 (CI.55 fase 2, CI.63, CI.64, UI.65, limpieza; desacople del método esperando GO)

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Orden

0. Hecho 2026-11-05 (todo empujado, pre-push verde): DOC.9 `1fba1673` + DOC.9.1 `9692bf2c` (`readme:sync` y PR de
   los viernes); RUN.2 `77975857` (`notice` de Codex en `run_steps`; antes tumbaba el runner); RUN.1 `6bce134f`
   (tarjeta fallida con diagnóstico, sin `Retry`; interrupción con "Resume"); UI.64 `985f0730` ((+) de proyecto con
   "Clone from URL"; clip con menú); CI.62 `eec3bc8a` (`ui:gate` borra `runDir` de más de 24 h); poda de specs
   `04b2303b` y de capturas versionadas `912b693b`. Settings: revisión pestaña por pestaña cerrada por ahora.
0b. Hecho 2026-11-06: CI.55 fase 2 `bb92b483`; CI.63 `fe602898` (el texto en vivo duplicaba el mensaje que sigue a
   una herramienta: `chat-live.ts`); CI.64 `0e6fdac7` (pre-push reconoce `chat-live.ts` y el hilo como chat); UI.65
   `aafee2ce`; limpieza `735bf403` (307 evidencias e imágenes, 3,2 MB); push cada 2 commits `1e69a1d2`.
0c. **Espera GO de Carlos — desacoplar el método personal** (plan en `docs/specs/LIMPIEZA-2.md` § 2 y en la salida
   de Sol): reescribir `AGENTS.md`, hooks `.claude/` y roadmaps sin `agent-method`/`delegate`/Sol/Luna/vault; el
   candado de escritor del pre-commit (`scripts/pre-commit.sh:27`) sin `~/.agent-method` no protege: implementarlo
   dentro del repo (recomendado) o quitarlo.
0d. Propuesta pendiente de Carlos (investigación ODD/SDD/TDD 2026-11-06): mutación sobre los módulos tocados por el
   ítem antes de cerrar (hoy `Mutation Shards` es nocturno y por módulos fijos). ODD descartado: sin definición
   estable; lo único con respaldo es eval-driven (arXiv 2411.13768).
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
- Un ítem `[x]` ya reconciliado no se puede reescribir antes de su commit ("Could not prove a closing commit SHA"):
  pasarlo a `[ ]`, `plan:reconcile`, volver a `[x]`, `plan:reconcile`.
- Texto visible nuevo en TSX exige una línea `Texto visible: "<texto>" (por qué no basta un ícono)` en el ítem.

## Anotado, sin ítem (abrir ítem solo si Carlos lo pide; los intermitentes, también si se repiten)

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
