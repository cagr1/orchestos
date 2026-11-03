# NEXT — handoff 2026-11-03 (DOC.5/DOC.6: plan e instrucciones podados; CI.19, CI.54, CI.55, CI.57 esperan fallo)

Un solo presente: orden y trampas vivas del lote. Lo cerrado vive en `docs/done/bloque-*.md` y git; las reglas, en
`AGENTS.md`. Versión anterior completa: `docs/done/poda-instrucciones-2026-11-03.md` (histórico).
Arranque: `bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Orden

0. Hecho hoy: DOC.5 (`7df5ee18`, `PLAN.md` de 116 a 15 KB) y DOC.6 (`AGENTS.md` y `NEXT.md` podados). En la otra
   sesión: UI.61, CI.58, CI.59, UI.62 y CI.60. **Push bloqueado**: el ui-gate `model-routing` falla tras actualizar
   OpenCode a 2.2.5 (lo lleva esa sesión). `master` va por delante de `origin`.
1. **Esperan su próximo fallo** (leer el JSON y escribir la fase 2). Todos dejan evidencia en el `runDir` del gate
   (`$TMPDIR/ui-gate-<pid>/`): CI.55 `role-task-missing-output.json`; CI.57 `composer-picker-model-missing.json`;
   CI.54 `turn1-bubble-missing.json`; CI.19, el motivo en el detalle del paso. Bucle de flakes del 2026-11-03
   (`/tmp/soak/`): `composer-picker` 15/15 verde.
2. **Decisiones de Carlos pendientes**: créditos de reinicio de Codex (recomendación: en el popover de cuotas);
   comentarios de Settings (mostrado 2026-11-02, sin pedidos); precio del revisor QA: el fallback `knownCost` sigue en
   `src/run/harness.ts:835` aunque la regla dice no resolver precios en el harness.
3. Cualquier CLI corre tareas sin código (Settings → Providers → "CLIs propios"). Un adaptador rico para un CLI nuevo
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

## Anotado, sin ítem (abrir solo si se repite o Carlos lo pide)

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
- "Clonar desde URL" en "+ Add project": feature nueva, plan corto antes.

## Decisiones de Carlos vigentes

- Settings se revisa con Carlos pestaña por pestaña en el dashboard real; no sumar UI ahí por iniciativa propia.
- Nada hardcodeado en quién ejecutó una tarea: lo dice la config.
- Memory = entrada mecánica por tarea terminada, sin LLM.
- Árbol sucio = seguir bloqueando + tarea `pending` + "Commit & Run" en el hilo.
- Peso de `main.js` (~1,9 MB) aceptado; no se reabre sin síntoma medido.

## Entorno

- Repo: `~/Projects/projects/orchestos`. Piloto ERP: `~/Projects/projects/erp-piloto`; conductor Playwright en
  `docs/done/evidence/ERP.4/conductor/`.
- Inventario de código muerto: `bunx knip@5` con config fuera del repo; falsos positivos conocidos en fixtures,
  `assets.d.ts`, `tailwindcss` y archivos que un test lee por ruta.
