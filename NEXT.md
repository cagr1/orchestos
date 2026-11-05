# NEXT — handoff 2026-11-05 (ONB.1/ONB.2 arranque por CLI, UI.63, CI.61; CI.19, CI.54, CI.55, CI.57 esperan fallo)

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Orden

0. Hecho 2026-11-04 (todo empujado, pre-push verde): ONB.1 `daa4b8e4` (el chat arranca en una CLI con sesión, no
   OpenRouter); licencia MIT `58ffe912`; ONB.2 `4a611d6d` (Model routing propone la CLI detectada con "Use <CLI> for
   unassigned roles"; el error de rol vacío lleva a Model routing); CI.61 `8ec9b071` (shard `executors-routing`
   partido en `-routing` + `-routing-c`); UI.63 `e67b7dff` ("Reset credits" de Codex en el popover de cuotas).
   Descripción del repo en GitHub publicada (CLIs, APIs y LLMs locales).
1. **`Mutation Shards`** (CI.61): corrida 42006593533 (`e67b7dff`): `executors-routing` 43 min y `-routing-c` 109 min,
   debajo de 150. Si una corrida posterior pasa 150 min, reabrir CI.61 con la duración medida.
2. **Esperan su próximo fallo** (leer el JSON y escribir la fase 2). Todos dejan evidencia en el `runDir` del gate
   (`$TMPDIR/ui-gate-<pid>/`): CI.55 `role-task-missing-output.json`; CI.57 `composer-picker-model-missing.json`;
   CI.54 `turn1-bubble-missing.json`; CI.19, el motivo en el detalle del paso.
3. **Siguiente**: UI.64 (spec listo, criterio). Después: spec de la fase 2 de CI.55 (hallazgos en PLAN.md).
   Hecho 2026-11-05: DOC.9 + DOC.9.1 (readme:sync), RUN.2 (notice en run_steps), RUN.1 (diagnóstico sin Retry).
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
