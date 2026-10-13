# NEXT — handoff 2026-10-13 (decisiones de Carlos recibidas; lote de hallazgos del piloto planificado, sin abrir)

## Decisiones de Carlos 2026-10-13 (respuesta a las 7 preguntas del handoff anterior)
1. Utilidad de ERP.4: el veredicto lo pone el cerebro → "sirve, pero todavía no solo". ERP.4 se cierra al terminar
   el lote de abajo.
2. Hallazgo 2: GO.
3. Sin regla de presupuesto: un fallo se diagnostica y se arregla en el producto ("si aplico una regla de presupuesto
   no mejoro, solo limito"). Causas de la etapa 6: árbol con archivo sin seguimiento (hallazgo 18, abierto) y check de
   `tsc` (ERP.4.6, cerrado).
4. Reintento desde el hilo del chat: GO.
5. Se arreglan TODOS los hallazgos abiertos (5, 6, 7, 11, 12, 16, 18), no un subconjunto. El 6 es el más grave para
   él: nada hardcodeado, la tarea dice quién la hizo según la config.
6. Residuos de `erp-piloto`: limpiar si no sirven (las 3 tareas sobrantes no sirven; se limpian tras el hallazgo 5).
7. `chat-retry-report` NO entra al pre-push.

## PRIMERO al retomar — ERP.4.10 ejecutado, SIN verificar ni commitear (Carlos pidió parar para /clear, 2026-10-13)
Estado del árbol: cambios de ERP.4.10 sin commitear en `src/dashboard/handlers/{chat,project,tasks}.ts`,
`src/run/harness.ts`, `src/tasks/schema.ts`, y nuevos `src/__tests__/natural-draft-context.test.ts` y
`scripts/ui-gate/flows/chat-followup-task.mjs`. Ejecutó `criterio` (sonnet), 1 ronda; su reporte dice typecheck y
lint limpios y 44/0 en sus tests: **no es evidencia**.
Falta, en este orden:
1. Leer el diff completo (`git diff -- src scripts`); el cerebro solo alcanzó a ver el cambio de `chat.ts`.
2. `bun run typecheck`, `bun run lint`, `bun run test:coverage`.
3. Gate en vivo: `bun run gate:evidence -- --label ERP.4.10-followup-live -- bun run ui:gate chat-followup-task`
   (pedido en dos mensajes → tarea creada con `task_class: implement` → `done`) y `auto-flow` como regresión.
4. Cerrar en PLAN.md (`[ ]`→reconcile→`[x]`→reconcile→commit), borrar `docs/specs/ERP.4.10.md` en el commit de cierre.
Avisos del ejecutor por resolver al verificar:
- `extractMentionedPaths` no quita backticks: una respuesta del orquestador con la ruta entre backticks no la
  resuelve en el respaldo. Arreglarlo en ronda de corrección de este ítem (el respaldo es parte del hallazgo 2).
- No verificado si `listChatMessages` ya trae el mensaje del turno en curso; `buildDraftMessages` evita duplicarlo.
- `POST /api/tasks` acepta ahora `task_class` (inocuo, no pedido).
- `classifyTask` en `evals/runner.ts:251` y `cli.ts:664` no se tocó (texto libre, no tareas de `tasks.yaml`).

## Lote en curso (ERP.4.10–4.16 abiertos en PLAN.md con causa y decisión; ejecutar en ese orden)
Specs ya escritos y commiteados: `docs/specs/ERP.4.11.md` (etiqueta del ejecutor resuelta con `autoRoute`, el
borrador deja de elegir proveedor) y `docs/specs/ERP.4.12.md` (commit de `tasks.yaml` al terminar el run, limitado a
esa ruta). Releer cada spec contra el código tras cerrar el ítem anterior: 4.11 toca el mismo borrador que 4.10.
Sin spec todavía: 4.13 a 4.16. Diseño pensado para 4.13: el chequeo de árbol limpio (`run/sandbox-policy.ts:32-70`)
deja la tarea `pending` (hoy `failed`, `cli.ts:1288-1296`); el reporte al hilo lleva los archivos en un campo
estructurado; endpoint nuevo que commitea esos archivos y relanza ("Commit & Run"); botón de reintento en el último
mensaje de fallo de una tarea `pending`/`failed` usando `POST /api/tasks/:id/run`; reusar el JSX y las clases de la
tarjeta "Task ready to run" (`OrchestChatView.tsx:395-445`), sin CSS nuevo; gate: ampliar `chat-retry-report`.
Respuestas de Carlos 2026-10-13: árbol sucio = seguir bloqueando + `pending` + "Commit & Run" en el hilo (ERP.4.13);
Memory = entrada mecánica por tarea terminada, sin LLM (ERP.4.16; confirmar en el spec si las tareas siguientes leen
`memory_entries` en su prompt). Al terminar: limpiar las 3 tareas sobrantes de `erp-piloto` y cerrar ERP.4 con el
veredicto "sirve, pero todavía no solo". **No añadir UI a Settings en este lote:** Carlos va a revisar Settings
pestaña por pestaña (dashboard real, Claude Desktop) y decir qué sirve y qué sobra; le parece confuso y que muestra
de más, y eso le cuesta cupo al usuario.
Sin pushear: 4 commits de docs (`1952226`, `4136ffd`, `cf89647` y este). No pushear con ERP.4.10 a medias: el
pre-push correría la suite sobre código sin verificar.
Lecciones: `delegate leer` devuelve la respuesta duplicada y con el log de hooks delante (leer desde la línea
`codex`); tras añadir ítems a PLAN.md, `bun run plan:reconcile` antes de commitear.

## Lote cerrado 2026-10-13 (GO de Carlos: "iniciemos con los arreglos")
- ERP.4.7 `617f8ca` — botón `Run` por tarjeta en Settings → Tasks. Gate en vivo `tasks` 19/19. Pusheado.
- ERP.4.9 `8daed04` — el hilo muestra el fin de un reintento sin recargar. Gate `chat-retry-report` 12/12 +
  contraprueba. Pusheado.
- ERP.4.8 `867627d` — el run fallido guarda y muestra la respuesta del ejecutor (migración 24). Gate `qa-negative`
  25/25 y `test:coverage` 1709/0 corridos por el cerebro. **Pusheado 2026-10-13 (`8daed04..5e36a6b`), pre-push
  verde.** Dos pushes abortados antes: (a) un test leía `~/.orchestos/.env` — corregido; (b) `qa-negative` y
  `chat-context` cayeron con el cupo de Claude al ~95 %. Con cupo disponible ambos pasaron solos (25/25 y 5/5) y
  dentro del pre-push completo: el fallo fue de cupo, no de ERP.4.8.
Correcciones a lo reportado: Settings → Plan ya tenía `Run` por tarea (el hallazgo 19 valía solo para Tasks; el
botón de Plan no se probó en vivo). Sin verificar a ojo: el bloque "Executor reply" de la pestaña Contract (se
comprobó por texto visible). Sin identificar: qué borró `~/Library/Caches/ms-playwright` y un `duplicate column
name` que salió una vez.
Lecciones del lote: (1) el ejecutor de Codex para si ve `writer-lock status: ocupado: claude` — decirle en el spec
que escribe bajo el candado del cerebro (`AGENT_WRITER_TOKEN`); (2) el scope del preflight del ejecutor debe incluir
`PLAN.md`, `LEDGER.md` y `docs/**` o el cierre exige `**Fuera de scope declarado:**`; (3) formatear con biome todo
JSON de evidencia antes de commitear; (4) si falta el navegador: `bunx playwright install chromium`; (5) antes de
afirmar "no existe en la UI", grepear el handler en todas las pestañas; (6) el check de `tsc` solo se añade si la
tarea declara salida `.ts` (`checks.ts:79`); (7) `criterio` (sonnet) corrió `prettier` y `git stash` no pedidos:
prohibirlos en el spec; (8) una columna nueva de `runs` va como migración numerada, no `safeAddColumn` (la migración
10 reconstruye la tabla, `migrate.ts:390`); (9) tocar `src/run/harness.ts` exige entrada en `LEDGER.md`; (10) un
test que llega al QA debe fijar `OPENROUTER_API_KEY` o lee `~/.orchestos/.env` del host; (11) un literal con forma
de clave en un test lo frena `security:secrets`: construirlo con `.join('')`.

## Orden vigente
1. R.8.2.1, R.8.2.2 y CI.17 cerrados 2026-10-11. CI.18 (`chat-roles` intermitente) instrumentado y medido 3/3 PASS;
   queda abierto hasta el próximo fallo: si el pre-push lo tumba, leer el detalle JSON del paso del marcador y la
   captura `marker-failure` en el `result.json` que imprime. Siguiente: R.8.3.
2. R.8.3 cerrado 2026-10-11 (gate `qa-negative`; detalle en PLAN.md). Siguiente: R.8.4 → R.8.6 en orden, luego ERP.4.
   Abierto CI.19 (`git commit` del fixture falló 1 de 9 en el andamiaje; ya deja evidencia en `qa-negative`).
3. R.8.4 cerrado 2026-10-11 (gate `restart-mid-run`; detalle en PLAN.md). Siguiente: R.8.5 → R.8.6, luego ERP.4.
   R.8.5.1 cerrado 2026-10-11: tareas y roles de Codex con `CODEX_HOME` aislado, tareas de Claude con los flags del
   chat (decisión de Carlos: aisladas). R.8.5 cerrado 2026-10-12 (`read-boundary`, `project-isolation`,
   `qa-negative`; detalle y límites en PLAN.md). R.8.6 cerrado 2026-10-12 (sin `true` literales; `note` para
   diagnóstico; el linter de flujos lo impide). Siguiente: ERP.4.
   ERP.4: decisiones de Carlos ya escritas en PLAN.md (inventario mínimo, repo `erp-piloto`, modelos del roster,
   una sesión / parar a los 2 fallos).
   Hecho 2026-10-12: repo `~/Projects/projects/erp-piloto` creado y registrado (`orchestos init`), 2 commits; roles
   del piloto en su `orchestos.config.yaml` (orquestador claude-opus-5-5, ejecutor codex gpt-6-luna, revisor codex
   gpt-6.1-sol, auxiliar codex gpt-6-luna). Único cambio frente al config de OrchestOS: el revisor (luna → sol).
   Sin verificar: que el dashboard lea esos roles del proyecto (mirar Model routing del proyecto antes de correr).
   Falta: levantar el dashboard real, pedir el módulo por el chat del proyecto (un pedido por etapa: datos+migración,
   regla de stock, permiso admin, API, pantalla, tests), dejar que cree y ejecute las tareas, reiniciar el dashboard
   una vez a mitad, guardar una corrección y comprobar que se recupera en la tarea siguiente. Registrar por etapa:
   CLI/modelo usado, intervenciones, bloqueos, tiempo. Conducir por navegador real (Playwright), no por curl.
   **2026-10-13: piloto completo, etapas 1-6 hechas** (25 tests verdes en `erp-piloto`, pantalla recorrida con
   Playwright, revisión `qa` "sin defectos"). Cerrados y pusheados ERP.4.5 (gates de review no van al ejecutor) y
   ERP.4.6 (check de `tsc` exige `tsconfig.json`). Dashboard y navegador ABAJO.
   **ERP.4 sigue abierto solo por decisiones de Carlos:** (1) decisión de utilidad; (2) GO al plan del hallazgo 2
   (el borrador de tarea solo lee el mensaje actual, `chat.ts:1111`); (3) qué hallazgos se arreglan: 5-9, 11-13 y
   15-19 del registro `docs/done/evidence/ERP.4/piloto-2026-10-12.md` (recomendados: 19/18 relanzar una tarea desde
   la UI, 15 guardar la respuesta del ejecutor en el run fallido, 17 el hilo no muestra el fin del reintento).
   Detalle de lo que espera respuesta (reportado a Carlos el 2026-10-13, sin contestar todavía):
   - Utilidad: lectura del cerebro = sirve pero todavía no solo (módulo correcto, sobrevive reinicios, aplica la
     corrección guardada, centavos por run; a cambio 2 arreglos de producto, 1 commit manual y 2 pedidos repetidos en
     esta sesión).
   - Plan del hallazgo 2 (necesita GO, cambia la auto-creación de tareas): pasar a `buildNaturalDraft` la respuesta
     del orquestador y los últimos turnos del hilo (ya cargados en el handler, `chat.ts:1104-1112`); test del
     borrador + corrida en vivo con un pedido en dos mensajes; sin tocar el ejecutor ni el formato de `tasks.yaml`.
   - Regla de presupuesto: la etapa 6 falló 2 veces por causas distintas (`bun.lock` sin commitear, sin run; check de
     `tsc`) y se reintentó una 3.ª vez. Se le preguntó a Carlos si lo cuenta como violación de "parar a los 2 fallos".
   - ERP.4.5 invierte dos tests de O.2 (`planner-skill-catalog.test.ts:84-95`): avisado, sin objeción aún.
   - `erp-piloto`: `tasks.yaml` modificado sin commitear y 3 tareas sobrantes (`chat-79f90f32` failed,
     `chat-f59db027` y `chat-ad9e193d` pending). No tocadas; no limpiar sin que Carlos lo diga.
   Luego ERP.5 (revisar sobrecarga).
   Conductor: `docs/done/evidence/ERP.4/conductor/` → copiar a `/tmp/erp4/` (crear `cmd/`, `out/`, `shots/`),
   `node driver.mjs` en segundo plano, órdenes con `do.sh`, una etapa con `stage.sh <etiqueta> <mensaje.txt>`;
   `screen.mjs` recorre la pantalla de `erp-piloto` (`bun run start`, puerto 3000).
   Lecciones 2026-10-13: un archivo propio bajo `docs/` también pasa por `bun run lint` en el pre-push (formatear con
   biome antes de commitear); diagnosticar un run de Codex sin texto → rollout en
   `<proyecto>/.orchestos/agent-home/codex/sessions/`; `delegate qa` responde solo "sin defectos" aunque el spec pida
   desglose; `bunx tsc` en un repo sin typescript reescribe el lockfile (revisar `git status` después).
   Lecciones: el hook `brain-no-code` bloquea un heredoc de Bash que nombre rutas `src/…` (specs con Write); antes de
   abrir un ítem, `grep "\*\*<ID> —" PLAN.md` (CI.20 ya existía); trampa de `plan:reconcile` sigue viva: cerrar
   siempre con `[ ]`→reconcile→`[x]`→reconcile→commit.
   Corrida anterior, mismo día: piloto DETENIDO en la etapa 1 (misma etapa, mismo fallo, 2 veces). ERP.4.1 cerrado
   (`b0ce9e4`: el chat crea la primera tarea sin `tasks.yaml`). Registro y 9 hallazgos:
   `docs/done/evidence/ERP.4/piloto-2026-10-12.md`. Espera decisión de Carlos: qué hallazgos se arreglan antes de
   reanudar (recomendado, en este orden: 4 fallo visible en el chat, 3/9 salidas declaradas que el proyecto ignora,
   2 seguimiento que no crea tarea). Para reanudar: dashboard real + conductor Playwright de una página viva (el de
   esta corrida estaba en `/tmp/erp4/driver.mjs`, no versionado); `erp-piloto` quedó con la tarea `chat-ad9e193d…`
   en `pending` (reintento 2/3) y `tasks.yaml` modificado sin commitear.
   Lección: si el archivo objetivo tiene cambios sin commitear de una ronda previa, el spec debe decirlo; si no,
   `mecanico` los toma por ajenos y no edita.
   Lecciones de R.8.4: `delegate qa` exige archivo de spec, no acepta la pregunta directa; el cerebro no puede editar
   `scripts/` (hook `brain-no-code`), ni una palabra: va por `mecanico`; no editar `src/` con un `ui:gate` corriendo.
   Lecciones de R.8.3 para delegar:
   - macOS no tiene `timeout`: tope con `perl -e 'alarm N; exec @ARGV' ~/.agent-method/bin/delegate …`.
   - El spec debe decir "NO correr `test:coverage` ni detenerse por el baseline" (en el sandbox de Codex dan 3 fallos
     falsos: `csrf-origin` por puertos, `adversarial-review` ×2 por sandbox anidado) y aclarar que el candado de
     escritor `ocupado: claude …` es el cerebro que delega; si no, Luna se detiene sola.
   - Una ronda de corrección = un spec en archivo propio; rondas apiladas en el mismo archivo no se ejecutan.
   - Visto sin verificar: en la captura de `qa-negative` la pestaña "Contract" aparece activa con el contenido de QA;
     el código es correcto (`RunsEvidenceView.tsx:113-142`) y hay `transition: all 150ms` → probable captura a mitad
     de transición.
   - Dashboard en `localhost:4242` (PID 36588, desde 10:53 del 10-11): no lo levantó esta sesión; no se tocó.

R.8.2 cerrado 2026-10-10 (`b9decaa`): historial al CLI de Claude y a threads nuevos de Codex; gate `chat-continuity`.
Lecciones:
- Subagente Sonnet (Agent tool) NO puede editar `src/`: hereda el entorno de la sesión cerebro y `brain-no-code`
  lo bloquea. Ejecutor = Luna (`ORCHESTOS_ROLE=executor codex exec …`) o `ORCHESTOS_ROLE=executor claude -p --model sonnet`.
- Si el ejecutor toca `scripts/*.sh`, correr `bun run hooks:install` antes de relanzarlo: su preflight bloquea.
- Gates de chat: leer el texto final de la respuesta de `/api/chat`, no solo el DOM (el DOM puede estar a mitad del
  render aunque la respuesta HTTP ya llegó).
- La trampa de `plan:reconcile` reapareció: reconcile con `[x]` + commit fallido por otra causa (faltaba
  `Ejecutado por:` en PLAN.md) → misma salida (`[ ]`, reconcile, `[x]`, reconcile, commit).

Cerrados 2026-10-07/10 (detalle y evidencia en PLAN.md): CI.15, R.8.1.1, CI.16. Todo pusheado; árbol limpio salvo
los ajenos de siempre (IDEAS.md, orchestos.config.yaml, read-boundary.mjs: se rehace en R.8.5, no commitear tal cual).

Lecciones de esta tanda:
- Luna (codex exec) en sandbox no abre puertos → `EADDRINUSE` falso; decirle que el baseline se verificó fuera.
  Una corrida de Luna se colgó >12 h sin salida: vigilar con un Monitor de 20 min y matar si no termina.
- Trampa del plan gate: `plan:reconcile` con `[x]` antes de que el commit pase deja el ítem `done` en la DB sin SHA;
  si el commit falla → "Could not prove a closing commit SHA". Salida: `[ ]`, reconcile, `[x]`, reconcile, commit.
  Ítem delegado: commitear el spec ANTES (commit `docs(<ID>): spec`) para que el cierre lo borre.

## CI.14 cerrado (2026-10-06) — histórico. Pendientes que eran EN ORDEN, sin saltar (regla de Carlos: nada se deja "porque no rompe lo siguiente")
1. `enforceContract` (tests de `contract.ts`) flaky bajo Stryker: 615 kills falsos en la corrida del 10-02. Abrir ítem.
2. R.8.1.1 (plan presentado, espera GO): el marcador `[[orchestos:task]]` pegado al final de la frase no crea tarea
   (2/4 corridas de auto-flow) y queda visible; `chat.ts:118`, `chat-live.ts:3`, prompt `chat.ts:1267`. Además
   "Loading models…" bloquea el envío ~5 s tras recargar (medido 4.7–5.2 s): medir qué petición es la lenta.
3. Luego R.8.2.
Arranque: `bun run agent:preflight -- --item <ID> --agent claude` (abrir antes el ítem en PLAN.md). Detalle de R.8.1.1:
respuesta real que falló = `OrchestOS creará una tarea para crear claude-nota.md con una sola línea: nota de claude.
[[orchestos:task]]` (misma línea). El test `src/dashboard/__tests__/chat-task-marker.test.ts:12` exige que el marcador
a mitad de frase NO cuente: el arreglo acepta solo el marcador al FINAL de la última línea. Verificar con auto-flow 3
corridas seguidas. Captura de "Loading models…": `AgentComposer.tsx:130-172` (getChatModels + getCliModels), envío
bloqueado en `:249`.

## R.8.1 cerrado (2026-10-05) — histórico (el orden vigente es el de arriba)
Arranque (tras /clear): `bun run agent:preflight -- --item R.8.2 --agent claude`. auto-flow 31/31 (detalle en PLAN.md).
Nuevo pendiente: composer muestra "Loading models…" tras recargar un hilo (captura en la evidencia de R.8.1).
`read-boundary.mjs`, IDEAS.md y orchestos.config.yaml siguen sin commitear y ajenos.

## 2026-10-05: PLAN.md/NEXT.md saneados (cerrados → docs/done/). Siguiente: elegir de `bun run next`
Arranque: tab nuevo → `bun run agent:preflight -- --item <ID> --agent claude`. Sin dashboard corriendo.

Cerrado 2026-10-04 (detalle y evidencia en PLAN.md y `docs/done/evidence/`):
- I.7, I.7.2 (reporte de fin de tarea en el chat), I.7.3 (regresión: Approve & Run no ocultaba la tarjeta).
- Bloque CX: CX.1 `gate:evidence` exporta runs de ui:gate · CX.2 anillo de contexto por hilo, recalcula al cambiar
  de modelo · CX.3 hook de Claude Code solo por % de ventana · CX.4 tokens de caché + `elapsed_ms` en runs ·
  CX.5 Settings → Usage = runs de OrchestOS + tabs CLI de proyectos registrados (en vivo: $3.88 + $1,131).
- CI.13: "Run" en Tasks mostraba nada si la tarea fallaba (camino de error verificado solo por lectura).

H.5.3 cerrado 2026-10-05: baseline 8/9 (detalle en `docs/done/bloque-H.md#plan-orden-h-5-3`). Siguiente según
Rumbo: **ERP.4** (piloto de módulo ERP).

Pendientes anotados (sin ítem todavía; abrir si Carlos quiere):
- (2026-10-10) startup-guard ciego a lo que de verdad carga: no mira `~/.claude/skills/*` (hyperframes, puesto por `npx skills add` el 10-01, movido a `~/agent-backups/2026-10-10-hyperframes/`), ni `~/.claude/skills/synced/` (anthropic-skills, de la cuenta) ni `~/.claude/plugins/synced/` (prisma, cowork-plugin-management, de la cuenta); Claude Docs cargó pese a `disabledMcpServers`. Candidato a CTX-GUARD.2.
- `chat-context` falló en el pre-push: el diálogo de nuevo chat no listó Claude (sonda de CI.10 en negativo bajo carga); pasó al reintentar (2026-10-05).
- `usage-bar` falló en el pre-push con ENOTEMPTY al borrar su tmpdir (`orchestos-ui-13-5-*`); pasó al reintentar (2026-10-05).
- H.5.3: Codex se cuelga sin salida a veces (timeout 20 min; huecos de 5-14 min entre trials) — ligar a CI.11;
  `elapsed_ms` no cuenta el cuelgue; `effort` del rol no llega a `cli_effort` del eval (sin verificar si se aplica).
- CX.5: fila `<synthetic>` (0 tokens) visible en "CLI tabs"; "Avg cost / run" mezcla runs y sesiones.
- `chat-roles` flaky dentro del pre-push completo (falló 2 veces, pasa solo); causa no reproducida.
- I.7.2: si el dashboard se reinicia a mitad del run, el reporte de fin se pierde (gap declarado).
- Runs de chat con caché no vistos en DB (el purge de los gates los borra); el anillo de CX.2 los usa y funciona.
- Datos del entorno: Codex corre con `CODEX_HOME` de Orca (`~/Library/Application Support/orca/codex-accounts/*/home`);
  sin API key de OpenRouter el catálogo se baja igual (endpoint público).

Sin commitear y ajenos (no tocar sin Carlos): IDEAS.md, orchestos.config.yaml.

## R.8 corto hecho (2026-10-05) — NO listo para ERP.4. GO de Carlos: R.8.1 → R.8.6 en orden (PLAN.md). Siguiente: R.8.1
Arranque (tras /clear): `bun run agent:preflight -- --item R.8.1 --agent claude`. Ojo: `bun run next` lista ERP.4
primero por posición en PLAN.md; el orden real es el del Rumbo (R.8.1 primero). Dashboard ajeno en `localhost:4242`
(PID 41821, desde 13:17): preguntar a Carlos antes de cerrarlo.
A: 5/6 gates verdes; read-boundary inconcluso (Claude se niega sin invocar Read; 2 corridas más: inconcluso y timeout
180 s). B: revisión de Sol en `docs/done/evidence/R.8-revision-sol-2026-10-05.md` — 5 hallazgos altos: continuidad
historial→CLI tras recarga sin gate; QA/checks sin prueba sustantiva ni negativa; auto-flow acepta estado terminal
fallido y "sin botón 5 s" como aprobación; sin recarga/reinicio tras producir tareas (gap I.7.2); privacidad del
contexto del CLI sin prueba. Medios: pasos `true` literales, nombres de pasos que exceden lo comprobado.
`scripts/ui-gate/flows/read-boundary.mjs` tiene reintentos de Luna SIN commitear: se rehace en R.8.5 (no commitear tal cual).

## H.9.4 cerrado (2026-10-05) — siguiente: R.8 corto
Gate `read-boundary` PASS 6/6 (`docs/done/evidence/H.9.4-live.json`).
Pendientes nuevos: borrar `readBoundaryWarning` (sin consumidor, decisión de Carlos: sin aviso); cuando el CLI se queda
sin cupo ("out of usage credits") el chat lo muestra como respuesta normal, no como error.

## Pendientes sin ítem heredados (consolidados 2026-10-05 desde handoffs 2026-09-22 → 2026-10-03)
Sin verificar de nuevo hoy salvo lo indicado; abrir ítem solo si Carlos lo pide.
- Settings → Tasks del proyecto muestra "Create First Task" (`OrchestSettingsView.tsx:2533`, verificado hoy en el
  código; contradice "Tasks solo por chat") y "Loading live settings…" fijo en la cabecera (2026-10-03).
- Settings → Skills: la pestaña "Instincts" aparece resaltada (pill) además de "Skills" (visto en capturas 2026-10-02).
- `src/run/logger.ts:52` lanza ENOENT al escribir en `runs/` de un proyecto que el cleanup de un flujo ya borró
  (visto en `ui-gate-68402/dashboard.log`, 2026-09-28).
- Chat: historial en las ramas Claude/OpenCode (hoy solo Codex tiene memoria por thread; OpenCode pasó a terminal en Dev
  con AT.15). Composer que conserva el mensaje durante el turno y Markdown que junta saltos simples ("uno\ndos" →
  "uno dos"): vistos en captura 2026-09-27, UI.18–UI.20 pueden haberlos cubierto, no re-verificado.
- "Clonar desde URL" (paso 2 de "+ Add project"): en espera por decisión de Carlos; feature nueva → plan corto antes.
- Decisión pendiente de Carlos (UI.13.4b): la frontera por argumentos no frena `node -e`/`sh -c`; la barrera real es
  sandbox de proceso o lista de binarios permitidos. AT.14 cerró solo el hueco del hook `brain-no-code`.
- Ajustes menores: idioma solo traduce Settings; fuente del prototipo = del sistema (si Carlos quiere Plus Jakarta Sans
  real es un cambio de una línea); reemplazar el prompt base del CLI (Codex ~96 % del input en el fixture; ver AT.13).
- `usage-bar` falla a veces por `account/rateLimits/read` de Codex (>3 s); fallback candidato en `AGENTS.md` § Lecciones.
- Migración de ruta (2026-09-28): confirmar con Carlos que Orca detecta el proyecto en `~/Projects/projects/orchestos`.

## Datos del entorno vigentes
- Repo en `/Users/carlosgallardo/Projects/projects/orchestos` (migrado 2026-09-28; plantilla en `~/Projects/screens`).
  Restos inofensivos dejados a propósito: `~/.claude/projects/-Users-carlosgallardo-Documents-projects-orchestos`
  (transcripciones para /resume) y entradas `[projects."…/Documents/…"]` en los `config.toml` de Codex dentro de Orca.
- El flujo `opencode-terminal` NO va en el pre-push (necesita el binario opencode; CI no lo tiene).
- Delegación (Carlos): Luna = mecánico, Sonnet 5.5 = criterio, Sol 6.1 (`gpt-6.1-sol`) = QA. El cerebro no puede editar
  código (hook): los ejecutores van por `ORCHESTOS_ROLE=executor codex exec …`.
- `git stash list` conserva 5 stashes viejos (UI.12.2b, UI.11, AT.10 parcial, wip cascada E.16, config local): no aplicar.
- Archivo histórico: handoffs anteriores y logs de lotes L1–L4 en `docs/done/sprint-30.md` § Apéndice; lecciones de
  delegación/ui-gate en `AGENTS.md`; el resto vive en `git log -p NEXT.md`.
