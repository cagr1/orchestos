# NEXT — handoff 2026-10-22 (corte tras el lote TCLI.1–TCLI.2 y la poda de CLAUDE.md)

Un solo presente: orden y trampas vivas. Lo cerrado vive en `docs/done/bloque-*.md` y git (regla `AGENTS.md` § Reglas
generales, 2026-10-19: `NEXT.md` se toca solo al cerrar o cortar un lote). Arranque:
`bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`. Roster normal (`roster.conf`).

## Cerrado 2026-10-22
Lote anterior (CI.35–CI.38, UI.27.3, UI.28, CTX-GUARD.2, DOC.4) en `docs/done/bloque-*.md` y git. Este lote, GO de
Carlos: TCLI.1 `2ec35349` (registro CLI ↔ ejecutor de tareas en `src/run/executors/task-engines.ts`; un CLI sin
ejecutor falla visible, ya no `single-shot`), TCLI.2 `f023ed2d` (tipos/front del registro; `executor-modes` con
`taskEngine` y `session`; arreglado el intermitente del timeout de `codex-engine.test.ts`), CTX-GUARD.3 parte del
cerebro `d5afa04c` (`CLAUDE.md` del repo 4,9k → 1,6k tokens est.; historia en `docs/done/claude-md-historia.md`).

## Orden
1. **CTX-GUARD.3 — falta Carlos**: apagar las 13 skills de cuenta en claude.ai. Con eso el guard mide ~8,1k (límite
   9k); cerrar el ítem con la salida de `node .claude/hooks/startup-guard.js` sin aviso.
2. **Agregar un CLI ejecutor de tareas** (DeepSeek/Gemini/Kimi/GLM) = entrada en `KNOWN_CLIS` + `registerTaskEngine`
   con su `ExecutorEngine`. Solo cuando el CLI esté instalado y se pueda verificar en vivo.
3. Fiabilidad, cuando el pre-push la tumba: CI.23, CI.18, CI.19, CI.11. Un flujo que revienta dice el locator y deja
   `<flujo>/failure.png`.
- Anotado, sin ítem: el revisor elige su ventana cortando en el primer tramo que no cabe (un revert posterior podría
  dejar caber uno más largo; nada se pierde, el salto queda anotado).
- Decisiones pendientes de Carlos sin ítem: turno de chat con CLI lento (más de 120 s o aviso honesto, en CI.18);
  peso de `main.js` tras UI.24.4 (dejarlo, alias de `rehype-raw` o lazy-load de Streamdown); arreglar en `method/` del
  vault que `delegate` → Codex no vea `AGENT_WRITER_TOKEN` (ver Trampas).

## Trampas vivas
- Ítems de `PLAN.md` llevan emoji de delegación (`🧠 ⚡ 🔍`) tras el "—": sin él el parser
  (`scripts/plan-status.ts:45`) no los ve, ni `bun run next` ni el gate. Si un ítem ya quedó `done` en la DB sin commit que
  lo pruebe, `plan:reconcile` aborta "Could not prove a closing commit SHA": volverlo a `open` en
  `~/.orchestos/db.sqlite` (`plan_items`) y reconciliar. La línea `Ejecutado por: … · Spec: docs/specs/<ID>.md` va en UNA
  línea; un cierre que toca dashboard lleva `Gate en vivo: navegador real (Playwright), `docs/done/evidence/<ID>-live.json``.
- `delegate mecanico` (Codex) sigue sin ver `AGENT_WRITER_TOKEN` (otra vez en TCLI.2): para escribir, `criterio`.
- Chequeo de tipos en specs: `bun run typecheck`. `bunx tsc --noEmit` de la raíz excluye `src/dashboard/app`: no vio un
  import borrado de `Button` y Plan quedó en pantalla negra (UI.28 r2).
- `delegate` prohíbe al ejecutor editar `PLAN.md`: archivar o reestructurar el plan lo hace el cerebro (DOC.4).
- Cambio de texto visible que viene de otra sesión: `rg` en `scripts/ui-gate/` antes de cerrar (UI.27.3 rompió
  `chat-turn-details` por el prefijo "Codex: " del título).
- `~/.claude/settings.json` `statusLine` = tee de OrchestOS → script de Orca (restaurado a mano 2026-10-21, respaldo
  `.bak.20261021-statusline`). Si Orca lo vuelve a pisar, lo avisan la barra y el startup-guard (CUOTA.1).
- El sandbox de `delegate` no tiene red: `git push` lo hace el cerebro. Los gates en vivo dan `listen EPERM` dentro del
  sandbox: el ejecutor los repite con permisos ampliados.
- `plan:reconcile` no re-cierra un ítem ya `[x]` editado antes de commitear ("Could not prove a closing commit SHA"):
  reabrir `[ ]`, reconcile, `[x]`, reconcile.
- `agent:live-gate` solo cuenta "Gate en vivo: navegador real (Playwright), `docs/done/evidence/…`" si esa línea cambia
  en el mismo commit; la procedencia exige `Ejecutado por: … · Spec: docs/specs/<ID>.md` al final de la línea. La
  evidencia JSON copiada de `result.json` necesita `biome format --write` (salto de línea final) o el lint del pre-push
  la tumba.
- Los gates en vivo de chat usan Codex: sin cupo de Codex el pre-push falla en ~10 flujos sin defecto de código.
- Desde CI.30 el pre-push verifica el commit empujado en un árbol aparte: push en fondo + seguir delegando funcionó el
  2026-10-22 (3 pushes). Con cambios en `src/dashboard` o `src/run` tarda ~13 min (15 ui-gates + chat-gate).
- El pre-commit NO corre lint; el pre-push sí. Correr `bun run lint` antes de commitear (el push de `2008db91` se
  rechazó por formato).
- Codex filtra de su shell las variables con `TOKEN` en el nombre: no ve `AGENT_WRITER_TOKEN` aunque `delegate` la
  exporte (`delegate:186`) y se niega a escribir. Esquive: el spec dice "tienes permiso de escritura; el hook sí recibe
  el token". Arreglo real en `method/` del vault.
- El hook `brain-no-code` toma una redirección a una ruta de código dentro del texto de un heredoc como escritura del
  cerebro (bloqueó un spec y este mismo `NEXT.md`): escribir specs y docs con Write/Edit, no con `cat <<EOF`.
- Preflight del ejecutor: el ítem tiene que estar **abierto** en `PLAN.md` (no un sub-ítem, no un padre ya `[x]`).
- `src/run/logger.ts` ENOENT al limpiar el fixture de un flujo que agotó su espera: consecuencia, no causa (visto otra
  vez el 22 en `auto-flow`).
- El plan gate parte el segmento de un ítem en su primera línea en blanco: `Ejecutado por: … · Spec:` va **antes** de
  ella o el gate dice "Procedencia … must delete docs/specs/<ID>.md" (pasó en H.10.2, ítem largo con párrafos).
- `qa` vía `delegate` solo acepta un archivo de spec, no la pregunta directa ("spec no existe").
- En los ui-gates, `visible(locator)` espera 15 s si el elemento no existe: para afirmar ausencia usar `count() === 0`,
  o la captura sale tarde y esconde fallos (UI.26.6b.2).
- Claves de prueba en flujos: sin prefijo `sk-` (`security:secrets`, `src/security/secrets.ts:31`, bloquea el commit).
- En esta terminal `CODEX_HOME` apunta a la cuenta de Orca: los rollouts de `codex exec` van ahí, no a `~/.codex`.
- Pre-commit con candado (AT.18): rechaza el commit si otra sesión tiene el candado del árbol. El "deshacer" del
  dashboard sobre este repo falla con 500 mientras tanto (límite declarado en `AGENTS.md` § Un árbol, un escritor).
- El cerebro no puede crear flujos de prueba en `scripts/` (hook `brain-no-code`): un gate de fallo forzado se delega.
- Trabajo de `criterio-alt` (Sol) lo revisa el cerebro, no `qa` (también Sol: mismo proveedor).
- Costo del revisor: lo reporta el adaptador en `ChatResponse.usd` (null = sin precio → `—`); nunca resolver precios
  con ramas por marca en `harness.ts` (r4 de ERP.6.2 lo hizo y se revirtió).
- `delegate` (rol de escritura) inyecta "No hagas commit ni edites el plan": commit y push los hace el cerebro (Carlos
  eligió eso el 2026-10-20). El sandbox de los ejecutores GPT no tiene red (`bun install`/`bun audit` los corre el cerebro)
  y a veces lee el candado del cerebro como ajeno: el spec dice "el candado es del cerebro que te lanzó; escribe".
- `delegate` inyecta "No invoques codex exec ni claude": un spec que exija probar un contrato de CLI en vivo para al ejecutor.
  El cerebro prueba el contrato (como en ERP.7.1d1/d2) y lo pega en el spec como "verificado; no invoques".
- Ronda de corrección = spec propio (`docs/specs/<ID>-rN.md`), no un anexo: con anexo, `mecanico` re-aplicó el spec entero
  y pisó la evidencia en vivo con un fallo de su sandbox (ERP.7.1c r4).
- Contratos de permisos verificados 2026-10-20: Claude 2.1.304 `--permission-prompt-tool` (ojo `--restricted` quita Bash y
  el `defaultMode: auto` del usuario aprueba sin preguntar si no hay `--settings` propio); OpenCode 1.19.0 `opencode serve`
  (`run` sin `--auto` rechaza solo; `always` es por patrón; Basic `opencode:<OPENCODE_SERVER_PASSWORD>`). Detalle en PLAN.md
  § ERP.7.1d1/d2.
- Codex 0.163: `commandActions` es aproximado; nunca derivar de ahí una identidad o una clasificación sin mirar el comando
  completo (bloqueante de QA en ERP.7.1a).
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
- `readBoundaryWarning` sin consumidor (`src/dashboard/types.ts:90`, `app/src/api/chat.ts:14,77`; decisión de Carlos:
  sin aviso) → LIMP.1 comprobó que sí tiene consumidores (`chat.ts`, `chat-sessions.ts`, `api/chat.ts`): quitarlo cambia lógica, decide Carlos. Cuando el CLI se queda sin cupo ("out of usage credits") el chat lo muestra como
  respuesta normal, no como error (sin re-verificar).
- Intermitentes vistos una vez, sin ítem (si se repiten, abrir):
  `chat-streaming` "Dev renders text during generation … t_first=null" (ejecutor de AT.19.1, 2026-10-17);
  `restart-mid-run` caso A, reporte "failed · attempt 1/3" con
  reintento pendiente cuando el gate exige coincidir con el estado final (2026-10-13; decidir si un intento fallido con
  reintento pendiente debe decir "failed"); `chat-context` `locator.click` timeout al pasar de Codex a Claude (pre-push de `e1d3b12`; desde CI.27 deja locator y `failure.png`);
  `chat-context`, diálogo de nuevo chat sin Claude (sonda de CI.10 en
  negativo bajo carga, 2026-10-05).
- Settings → Tasks: "Loading live settings…" fijo en la cabecera (2026-10-03, sin re-verificar). Settings → Skills: la pestaña
  "Instincts" aparece resaltada además de "Skills" (2026-10-02, sin re-verificar).
- CX.5: fila `<synthetic>` (0 tokens) visible en "CLI tabs"; "Avg cost / run" mezcla runs y sesiones (sin re-verificar).
  Runs de chat con caché no vistos en DB (el purge de los gates los borra; el anillo de CX.2 los usa y funciona).
- H.5.3: `elapsed_ms` no cuenta el cuelgue de Codex; `effort` del rol no llega a `cli_effort` del eval (sin verificar
  si se aplica). El cuelgue en sí es CI.11.
- Plan (Settings): el selector de sprints tiene "Sprint 29/30/31" fijos en el JSX (`PlanBoardView.tsx`), visto en UI.28.
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
