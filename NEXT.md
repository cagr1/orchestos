# NEXT — handoff 2026-10-25 tarde (corte: CI.11, CHAT.3)

Un solo presente: orden y trampas vivas. Lo cerrado vive en `docs/done/bloque-*.md`, `PLAN.md` y git (regla `AGENTS.md`
§ Reglas generales, 2026-10-19: `NEXT.md` se toca solo al cerrar o cortar un lote). Arranque:
`bun run agent:preflight -- --item <ID> --agent claude`. Lista viva: `bun run next`. Roster normal (`roster.conf`).

## Reglas de Carlos vigentes
- 2026-10-22, modo estricto: nada se reintenta, cierra ni muestra sin evidencia medida que el usuario vea; opinión de
  LLM marcada como tal. Memoria `feedback-evidencia-antes-de-actuar`. Método: `docs/specs/TRUST.md`.
- 2026-10-23, repartir cupo: Sol 6.1 es el acompañante de confianza de Opus — diagnóstico, auditoría y revisión fuerte
  van a Sol (`criterio` escribe, `analizar` audita solo lectura; `qa` solo revisa el diff sin commitear). Opus escribe
  specs, decide con Carlos, revisa lo de Sol y cierra. Memoria `feedback-subagentes-modelo-barato`.

## Cerrado 2026-10-23 (todo por Sol o Luna, revisado por Opus)
CI.23 `e34d743f` (commit `chore(tasks)` sobrevive a `index.lock` ajeno), CI.40 `30d99814` (premisa de TRUST.1
determinista), TRUST.R2 `19dd93d0` (auditoría: aprobaciones, undo, chat), CI.18 `0686bfff` (el hilo sigue abajo:
solo un gesto del usuario lo suelta), TRUST.6 `49e212c0` + .6.1 `fefa332d` ("done" solo con run `done` del mismo
proyecto), TRUST.7 `0f09c64e` + .7.1 `11e6d230` + .7.2 `fb6dc76d` (undo revierte el run completo y verifica el árbol),
TRUST.8 `8ef8da67` (create_task honesto, "Run requested", aprobaciones sin contenido avisan), CI.41 `fbab27a9`.
Vault `0208da4` (verificación: `qa` revisa lo de `mecanico`) y `d8e1d64` (rol `analizar`), solo locales.
Tarde: CI.42 `f75e8524` (Mutation Shards: selección por imports de runtime + ejecutores en 4 particiones; Sol) y
CI.19 fase 1 `c6e7066d` (un solo `run` en `scripts/ui-gate/lib.mjs` que dice exit y salida; Sonnet, Sol sin cupo).

Noche (revisado por Opus; Sol con cupo de nuevo): CI.43 `1171b3f7` + .1 `523202ce` (`scripts/post-commit.sh`: un
`git commit -- <rutas>` dejaba `MM` en los derivados y el sandbox rechazaba tareas), UI.26 `33218005` (Copy en Dev
copia su respuesta), CHAT.1 `fcebad54` (`rg` solo si está instalado), CFG.1 `a291f3a3` (fuera `models:`), config
`eb41e790` (reviewer Claude Sonnet 5.5, decisión de Carlos), `310ede9f` (`agentic.maxIterations` 15), `160b6a4f`
(fuera `agent:`), seguridad `c5e36e45` (zod 4.6.7 + overrides; `bun audit` limpio). Tareas `design-test-*` borradas.
2026-10-24: UI.29 integrada (merge `eca73ecb`, copiar en Dev debajo a la izquierda + carrera de `shell-look`), UI.30
`a2800bfa` (un solo anillo de contexto en Dev). Worktree `orchestos-ui28` y rama `ui/UI.29` borrados. CI.42
`[x]` (corrida `39983853493`: job más lento 122 min de 180). CHAT.2 `[x]` (prompt del chat: comandos, espera de
tareas, checks, reintentos; Sol). SKILLS.1 `42781af5` (medición de skills; Carlos: se quedan
todas, fuera solo el duplicado `skills/pro/api-contract.yaml`).

## Cerrado 2026-10-25 tarde (Sol criterio, revisado por Opus)
CI.11 `6880e028` (causa: 429 de OpenAI con reintento 70–245 s que Codex no emite por JSON-RPC; stderr drenado y
diagnóstico `[codex-turn]`), CHAT.3 `760982d9` (el chat dice por qué el modelo no responde: avisos tipados Codex/Claude,
429 leído de `logs_2.sqlite`, línea viva con contador, fallo visible y persistente; migración 32). Abierto CI.44.

## Orden
0. Tarea `chat-4a0d93a2…` (doc de observaciones del chat) sigue `pending`: Carlos le da Run. El "prompt genérico de
   Claude Code" (`--append-system-prompt`) y quizá el `~/.claude/CLAUDE.md` del HOME real van a ERP.5 con medición.
1. CI.44: aislar el `CODEX_HOME` del chat sin proyecto en los gates (hoy usa `~/.orchestos/general-chat` real y comparte
   su límite de peticiones). CI.19 espera el próximo fallo para la fase 2.
2. Ejecutor de tareas para otro CLI = entrada en `KNOWN_CLIS` + `registerTaskEngine`, solo con el CLI instalado y
   verificable en vivo.
- Trampa: al cerrar un ítem, `plan:reconcile` una sola vez antes del commit. Un segundo reconcile ve el ítem ya
  `done` sin commit que lo pruebe y falla ("Could not prove a closing commit SHA"); se arregla volviendo a reconciliar
  desde `git show HEAD:PLAN.md` y luego el PLAN.md nuevo.
- Anotado, sin ítem: `pickAutoSkill` elige una skill `explicit` si es candidata única (`chat.ts:791`,
  `verification-before-completion`) y `src/tasks/init.ts:71` genera `skill_id` `doc`/`implement` sin YAML — Carlos no
  los priorizó (2026-10-24); el revisor elige su ventana cortando en el primer tramo que no cabe; `permissions` parpadea a
  `null` al re-dispararse el efecto de config del chat (`OrchestChatView.tsx:108`, CI.41); TRUST.7.1 sin verificar en
  vivo el caso de residuos.
- Decisiones pendientes de Carlos: push del vault (`5134b27`, `520f0e0`, `0208da4`, `d8e1d64`); peso de `main.js`
  tras UI.24.4.

## Trampas vivas
- `gate:evidence` migra la DB durable (`scripts/run-evidence-gate.ts:116`) antes de exportar: una migración sin
  commitear se aplica a `~/.orchestos/db.sqlite` de Carlos (pasó con la 32 de CHAT.3, 2026-10-25; DB íntegra).
- Silencio de Codex sin eventos = casi siempre 429 con reintento largo; el motivo está en `$CODEX_HOME/logs_2.sqlite`
  (CHAT.3 lo muestra en el chat). No es un fallo de OrchestOS.
- Cierre de ítem (gates de `PLAN.md`, 2026-10-23): (1) el ítem debe existir `[ ]` en HEAD antes del commit que lo
  marca `[x]` (`closedPlanItemIds`); (2) `plan:reconcile` una sola vez por cierre: si ya quedó `done` en la DB sin
  commit, reabrir `[ ]` → reconcile → `[x]` → reconcile; (3) la ruta de evidencia entre backticks va en la MISMA
  línea que `Gate en vivo:`; (4) `Ejecutado por: … · Spec: docs/specs/<ID>.md` exacto, spec borrado en el commit;
  (5) `git commit -- <ruta>` no acepta archivos sin seguir: `git add` antes.
- Bun 1.3.14 no tiene `bun audit fix` (lo sugiere y no hace nada): fijar en `overrides` de `package.json`.
- Probar el dashboard sin tocar el de Carlos: `ORCHESTOS_HOME=<tmp con sqlite3 .backup de la DB> PORT=4343 bun
  src/dashboard/server.ts` + Playwright `channel: 'chrome'` (el chromium de Playwright no está instalado).
- Sol/Codex sin cupo de 5 h → `criterio-alt` (Sonnet); su diff no tiene revisor de otro proveedor: decirlo al cerrar.
  Sin Codex, los gates en vivo de chat y `qa-negative` no sirven: elegir flujos sin Codex (`plan-doc`,
  `project-tabs`, `model-routing`).
- Un registro que importa todos los motores (`task-engines.ts`) agranda la selección de cada shard de mutación: al
  sumar un hub así, medir `scripts/mutation-test-shard.ts` por shard (CI.42).
- Cambio de un texto que el producto emite: `grep -rn` del texto viejo en tests y flows, y correr la suite completa
  (`test:coverage`), no la acotada (TRUST.6.1 y TRUST.8 lo rompieron así).
- Fixture que escribe un hook de git: `mkdirSync(.git/hooks, recursive)` antes; con HOME temporal `git init` no la
  crea (TRUST.7.2).
- `method/bin/delegate.test.sh` "sin temporales" falla si hay otro `delegate` corriendo (mira `/tmp` global).
- Peso de arranque ~8,9k est., al borde de 9k: crecer `CLAUDE.md`/`MEMORY.md` vuelve a disparar el guard.
  `/reload-plugins` mostró "1 error during load" (detalle en `/plugin`, sin revisar).
- Luna (`mecanico`) inventó "cambios ajenos" en un archivo limpio (TRUST.4, dos veces con causas distintas): si un
  ejecutor para por solapamiento, comprobar con `git diff --quiet HEAD -- <ruta>` y escribir el estado real en el spec.
- `shot` de ui-gate espera 300 ms (TRUST.5): una captura dentro de una transición mentía sobre la pestaña activa.
- Selectores de flujos acotados al componente: `getByText('67%')` en toda la página chocó con la cuota real de Codex
  (CI.39). Datos reales del usuario aparecen en la barra durante los gates.
- `qa-negative` puede fallar porque el modelo real no escribe la premisa ("premisa no cumplida… []"): el flujo lo dice;
  reintentar una vez antes de diagnosticar.
- Spec de recorte de texto: definir el algoritmo completo (primera línea larga, sin saltos); Sol para en cada caso no
  definido (TRUST.1, dos paradas).
- Contraprueba de un test de `~/.agent-method`: el test resuelve el hook desde el cwd (`path.resolve('method/hooks/…')`);
  copiar a `<tmp>/method/hooks/` y correr desde `<tmp>`.
- Evidencia de ejecutor: solo `docs/done/evidence/<ID>-live.json`; Sol deja carpetas `<ID>/` con logs → borrarlas.
- Ítems de `PLAN.md` llevan emoji de delegación (`🧠 ⚡ 🔍`) tras el "—": sin él el parser
  (`scripts/plan-status.ts:45`) no los ve, ni `bun run next` ni el gate. Si un ítem ya quedó `done` en la DB sin commit que
  lo pruebe, `plan:reconcile` aborta "Could not prove a closing commit SHA": volverlo a `open` en
  `~/.orchestos/db.sqlite` (`plan_items`) y reconciliar. La línea `Ejecutado por: … · Spec: docs/specs/<ID>.md` va en UNA
  línea; un cierre que toca dashboard lleva `Gate en vivo: navegador real (Playwright), `docs/done/evidence/<ID>-live.json``.
- `criterio` = Sol 6.1 (Codex) desde 2026-10-22, pedido de Carlos: repartir cupo; Sonnet es `criterio-alt`. El "Codex no
  ve el token" era falso: lo recibía, pero leía `writer-lock.js status` "ocupado" y no escribía. Arreglado en el vault
  `5134b27` (`status` dice si el token coincide; el prompt manda correr `check`). Si Codex vuelve a fallar por entorno,
  se arregla la herramienta, no se rodea con Claude.
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
- El hook `brain-no-code` toma una redirección a una ruta de código dentro del texto de un heredoc como escritura del
  cerebro (bloqueó un spec y este mismo `NEXT.md`): escribir specs y docs con Write/Edit, no con `cat <<EOF`.
- Preflight del ejecutor: el ítem tiene que estar **abierto** en `PLAN.md` (no un sub-ítem, no un padre ya `[x]`).
- `src/run/logger.ts` ENOENT al limpiar el fixture de un flujo que agotó su espera: consecuencia, no causa (visto otra
  vez el 22 en `auto-flow`).
- El plan gate parte el segmento de un ítem en su primera línea en blanco: `Ejecutado por: … · Spec:` va **antes** de
  ella o el gate dice "Procedencia … must delete docs/specs/<ID>.md" (pasó en H.10.2, ítem largo con párrafos).
- `qa` vía `delegate` solo acepta un archivo de spec y revisa el diff sin commitear: para auditar o diagnosticar
  sin editar usar `analizar` (2026-10-23, `qa` devolvió "sin defectos" sobre `runs-summary.json`).
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
