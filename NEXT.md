# NEXT — handoff 2026-10-20 (lote H.7.2c → H.7.3 cerrado; asignación de modelos del día abajo)

Un solo presente: orden y trampas vivas. Lo cerrado vive en `PLAN.md` y git (regla `AGENTS.md` § Reglas generales,
2026-10-19: `NEXT.md` se toca solo al cerrar o cortar un lote). Arranque:
`bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`.

## Asignación de Carlos, vale 2026-10-20 y 2026-10-21 (extendida por Carlos el 20: "hoy y mañana vas a tener el rol de supervisor") (ahorrar cupo semanal de Claude: 75 % usado, reinicia en ~1 d 17 h)
Prevalece sobre el roster y sobre `~/.claude/CLAUDE.md` § Selección de modelos. Vence al terminar el 2026-10-21. También el push: lo prepara un agente delegado, Opus verifica.
- Opus (cerebro) solo crea (plan, spec, docs) y verifica (lee el diff, corre gates con comandos propios, commitea).
  No lee a fondo ni teclea código: todo lo demás va a agentes GPT.
- Código: `mecanico` (Luna) para ⚡; lo que exige criterio va a `criterio-alt` (Sol), no a `criterio` (Sonnet).
- QA: `qa` (Sol), más que de costumbre: después de cada ítem delegado, también los ⚡, antes del commit.
- Lectura: `leer` (Luna). `investigar` (Sonnet) solo si hace falta internet; no hay rol GPT con web en el roster.
- Astra: no (tampoco hoy). Sin subagentes de Claude (`Agent`/`Explore`).
- No se edita `roster.conf`: el cambio es temporal y se aplica eligiendo el rol al delegar.

## Orden
1. Lote ERP.7 cerrado: ERP.7 (informe `docs/done/ERP.7.md`) y ERP.7.2 (diff + deshacer por tarea en el hilo).
   Antes de commitear en el vault: `git -C ~/Projects/MemoriesMD branch --show-current`.
2. H.7.2c y H.7.3 cerrados (aviso de contexto en vivo en Claude Code y OpenCode). Sigue: ERP.7.1 (modo de permiso y aprobar por acción) espera plan corto + GO de Carlos; base: aprobar =
   aprobar el diff que ya muestra la tarjeta. ERP.6.2 cuando toque costo. Acceso remoto = IDEAS `#73`, después.
3. Fiabilidad, cuando el pre-push la tumba: CI.23, CI.18, CI.19, CI.11, CI.27 (primero que deje evidencia).
- Decisiones pendientes de Carlos sin ítem: turno de chat con CLI lento (más de 120 s o aviso honesto, en CI.18);
  peso de `main.js` tras UI.24.4 (dejarlo, alias de `rehype-raw` o lazy-load de Streamdown).

## Trampas vivas
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

## Decisiones de Carlos vigentes
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

## Decisiones de Carlos 2026-10-14 (respuesta a AT.19 y `readBoundaryWarning`)
- (a) `create_task` en lugar del marcador: GO, implementar sin presentar plan → AT.20.
- (b) Shell de solo lectura: sí, para todos los LLM, nunca solo para uno → AT.21 (mismo servidor MCP que AT.20).
- Le interesa ver la ventana de contexto real en Chat y en Dev → CX.6. `readBoundaryWarning` (aviso de privacidad,
  no un número) sigue sin mostrarse; la frontera de lectura está verificada por el gate `read-boundary`.

## Pendientes sin ítem (una sola lista; abrir ítem solo si Carlos lo pide)
Verificados el 2026-10-14 contra el código salvo "(sin re-verificar)".
- Herramienta: `delegate investigar` y todo rol `claude` con `--tools` fallan (`~/.agent-method/bin/delegate:147,167-171`);
  esquive en `AGENTS.md`; el arreglo va en `method/` del vault.
- startup-guard ciego a lo que de verdad carga: no mira `~/.claude/skills/*`, `~/.claude/skills/synced/` ni
  `~/.claude/plugins/synced/` (`.claude/hooks/startup-guard.js` sin lectura de esas rutas); Claude Docs cargó pese a
  `disabledMcpServers` (2026-10-10). Candidato a CTX-GUARD.2.
- `readBoundaryWarning` sin consumidor (`src/dashboard/types.ts:90`, `app/src/api/chat.ts:14,77`; decisión de Carlos:
  sin aviso) → LIMP.1 comprobó que sí tiene consumidores (`chat.ts`, `chat-sessions.ts`, `api/chat.ts`): quitarlo cambia lógica, decide Carlos. Cuando el CLI se queda sin cupo ("out of usage credits") el chat lo muestra como
  respuesta normal, no como error (sin re-verificar).
- Intermitentes vistos una vez, sin ítem (si se repiten, abrir):
  `chat-streaming` "Dev renders text during generation … t_first=null" (ejecutor de AT.19.1, 2026-10-17);
  `restart-mid-run` caso A, reporte "failed · attempt 1/3" con
  reintento pendiente cuando el gate exige coincidir con el estado final (2026-10-13; decidir si un intento fallido con
  reintento pendiente debe decir "failed"); `chat-context`, diálogo de nuevo chat sin Claude (sonda de CI.10 en
  negativo bajo carga, 2026-10-05).
- `waitForTaskRun` (`app/src/api/chat.ts`) espera hasta 10 min ante un `pending` con intento fallido: no se midió si
  deja el botón pulsado ocupado todo ese tiempo.
- Settings → Tasks muestra "Create First Task" (`OrchestSettingsView.tsx:2463`; contradice "Tasks solo por chat") y
  "Loading live settings…" fijo en la cabecera (2026-10-03, sin re-verificar). Settings → Skills: la pestaña
  "Instincts" aparece resaltada además de "Skills" (2026-10-02, sin re-verificar).
- `src/run/logger.ts:50-53` (`write`) hace `appendFileSync` sin guarda: lanza ENOENT si el cleanup de un flujo ya borró
  el `runs/` del proyecto (visto en `ui-gate-68402/dashboard.log`, 2026-09-28).
- CX.5: fila `<synthetic>` (0 tokens) visible en "CLI tabs"; "Avg cost / run" mezcla runs y sesiones (sin re-verificar).
  Runs de chat con caché no vistos en DB (el purge de los gates los borra; el anillo de CX.2 los usa y funciona).
- H.5.3: `elapsed_ms` no cuenta el cuelgue de Codex; `effort` del rol no llega a `cli_effort` del eval (sin verificar
  si se aplica). El cuelgue en sí es CI.11.
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

## Datos del entorno vigentes
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

## Lección LIMP.1 (2026-10-14)
Inventario de código muerto: `bunx knip@5 --config /tmp/limp1/knip.json` (config fuera del repo; entradas `src/cli.ts`,
`scripts/**`, `app/src/main.tsx`, `.claude/hooks/*.js`). Falsos positivos vistos: fixtures, `assets.d.ts`, `tailwindcss`
(lo usa el CSS), archivos que un test lee por ruta (`db/backup.ts`, `orcaProjectData.ts`). Un símbolo borrado puede dejar
falso el comentario que lo explicaba: revisar comentarios reescritos.
