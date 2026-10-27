---
type: execution-plan
project: orchestos
created: 2026-05-26
owner: Carlos Gallardo
status: sprint-30-abierto--fiabilidad-del-recorrido-y-shell-chat-workspace
---

# OrchestOS — Plan activo

Historial completado → ver [DONE.md](DONE.md).
Ideas pendientes → ver [IDEAS.md](IDEAS.md).

## Rumbo — orden cerrado por Carlos (2026-09-22)

*"Terminar interfaz, luego producto mínimo para entrega y luego corregir"* lo que Opus detectó corriendo dentro de
OrchestOS. Una fase a la vez; lo que no está en una fase no se abre sin GO de Carlos. Restricción que manda en las
tres: harness liviano (ver abajo) — la respuesta dentro de OrchestOS tiene que sentirse igual que el CLI directo,
sin peso extra y con reglas claras.

### Fase 1 — Terminar la interfaz (plantilla React de AI Studio, regla UI.13) — CERRADA
Todos sus ítems están archivados en `docs/done/` (UI.13.x, UI.9.8/9.9, UI.10.A, CI.2; el selector nativo de nuevo proyecto lo cerró UI.15).

### Fase 2 — Producto mínimo para entrega (ruta ERP) — EN CURSO
**Decisión de Carlos 2026-10-05:** *"primero lo primero, que funcione"* — ERP.4 no se abría hasta que R.8 dijera, con
evidencia, que el recorrido funciona. Cerrados y archivados: AT.10, R.7, ERP.2, ERP.3, I.7, H.5.3, H.9.4. R.8.1–R.8.6
están cerrados (2026-10-05/12); R.8 queda abierto solo por la contrastación con una tarea real de Carlos, que cubre
ERP.4. El piloto de ERP.4 corrió completo el 2026-10-13 (etapas 1-6; ERP.4.1–ERP.4.13 cerrados).

**Orden vigente** (GO de Carlos 2026-10-13 a UI.24, UI.25 y UI.26; "UI.24 primero, ERP.4 al final", `NEXT.md`):
1. UI.26.5 → UI.26.6 → UI.26.7 (UI.26 absorbió UI.25.2–25.4; UI.25 y UI.26.1–26.4a cerrados 2026-10-13/14).
2. UI.24.4 → UI.24.5 → UI.24.6 (incluye ERP.4.14) → UI.24.7 (UI.24.1–24.3 cerrados 2026-10-13).
3. ~~ERP.4.15 → ERP.4.16 → limpiar `erp-piloto` → veredicto de ERP.4 → cierre de R.8~~ (cerrado 2026-10-15).
4. ~~UI.8.6 (permisos visibles: aprobar en el chat lo que el CLI va a hacer)~~ (cerrado 2026-10-16). Sigue Fase 3.

Fiabilidad abierta, sin orden fijo (se atiende cuando el pre-push la tumba): CI.11, CI.18, CI.19, CI.23, CI.25.
Documentación y código muerto: DOC.1 y LIMP.1 (GO de Carlos 2026-10-14).

### Fase 3 — Correr dentro de OrchestOS igual que el CLI directo
AT.13 (el contexto inyectado dice la verdad y no pesa) → AT.19 (lo que Claude notó dentro del chat; AT.19.1, AT.19.2) → AT.20 → AT.21 → CX.6 → ERP.6 (demostrar que no pesa) → ERP.5 (qué quitar) → ERP.7 (T3 Code) → H.7.2c → H.7.3 (aviso de contexto)
→ AT.11 (adaptadores genéricos).

### Fuera de las tres fases (no se abren sin GO)
H.10.2 (H.9.4 entró a la Fase 2 el 2026-10-05). Los 11 superados por UI.13/UI.14 se retiraron el 2026-09-22 (`docs/done/retirados.md`).

## Restricción de producto: harness liviano — decisión de Carlos (2026-09-17)

**Pedido textual:** *"quiero un harness o orquestador light sin ahogar el trabajo de los agentes
cerebro"*. Origen: usando Orca, Carlos observa que consume ~2 GB de RAM y concluye que OrchestOS
no debe ir por ahí.

**Medición del 2026-09-17, no estimación** (`ps -o rss=`, ambos corriendo en la misma máquina):

| Proceso | RSS |
| --- | --- |
| OrchestOS (`bun run src/cli.ts dashboard`) | **121 MB** |
| Orca (suma de sus procesos, en ese momento) | **1,270 MB** |

OrchestOS ya es ~10× más liviano. **Eso deja de ser una casualidad y pasa a ser un invariante que
se defiende:** toda propuesta que agregue un runtime residente (swarms, memoria vectorial, índice
persistente, servidor extra) declara su costo en RAM antes de entrar, y se compara contra estos
121 MB. Es el mismo criterio con el que `IDEAS.md#64` deja a Serena MCP condicionada a medición
antes/después en vez de adoptarla por fe.

**"Sin ahogar al cerebro" es la otra mitad y limita lo anterior:** liviano no puede significar
recortarle contexto, herramientas o criterio al modelo que piensa. El ahorro sale de *dónde corre
el trabajo* (delegar al ejecutor, que gasta su propio contexto y su propio cupo — medido: 145,664
tokens de Luna que nunca entraron en el contexto del cerebro), no de podar al cerebro.

## Fase 1 — Terminar la interfaz

Cerrada. Todos sus ítems están archivados en `docs/done/` (ver "Cerrados — evidencia archivada" al final).

## Fase 2 — Producto mínimo para entrega

### Settings al nivel de los ADEs — SET (GO de Carlos 2026-10-26)

Referencia: `docs/specs/SET-ref.md` (T3 Code, MonoCode y Orca vistos en vivo el 2026-10-26). No se quita ninguna
sección. Decisiones de Carlos (2026-10-26): guardado instantáneo; página Providers nueva (Model routing y Executor la
consumen; "CLIs propios" se muda ahí); "API & Models" pasa a "API keys" y Health deja de exigir OpenRouter;
Keybindings de solo lectura en la primera versión. Orden: SET.0 primero (bloquea a los demás al probar en vivo).

- [x] **SET.0 — 🔍 `/api/usage` bloquea el servidor ~12 s y congela Settings en "Loading live settings…".**
  (cerrado 2026-10-26) Medido sobre copia de la DB: en frío `/api/usage` 12,2 s y `/api/settings` en paralelo 11,9 s
  (en serie 0,03 s); `readCliTranscriptUsage` parseaba ~1,4 GB de JSONL en el hilo principal. Arreglo: el lector
  (`src/usage/cli-transcripts-reader.ts`, sin cambios de lógica) corre en un worker persistente
  (`cli-transcripts-worker.ts`) con su caché por `(ruta, size, mtime)`. Evidencia del cerebro en vivo, mismo
  escenario: `/api/settings` concurrente 0,11 s, `/api/usage` 10,6 s en frío y 0,23 s después, payload idéntico;
  `test:coverage` 2101/0, typecheck y lint verdes.
  Gate en vivo: navegador real (Playwright) `usage-bar` 19/19, `docs/done/evidence/SET.0-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/SET.0.md
- [x] **SET.1 — 🧠 Shell de Settings: nav agrupada con iconos, guardado instantáneo y buscador que resalta la fila.**
  (cerrado 2026-10-26) Nav App/Agents/Observe/Protect con iconos; fuera la barra "N unsaved changes · Save" y la
  descripción bajo cada título; borradores locales para estados que el backend rechaza (agente sin modelo, regla sin
  `match`; ronda 1 paró por eso, spec completado). Appearance, Keybindings y Providers quedan vacías hasta SET.5/SET.3.
  Evidencia del cerebro: página por página en vivo sobre copia de la DB; `test:coverage` 2101/0, typecheck y lint.
  Gate en vivo: navegador real (Playwright) `settings-shell` 22/22, `model-routing` 19/19, `custom-cli` 13/13, `docs/done/evidence/SET.1-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/SET.1.md
- [x] **SET.2 — 🧠 Detección de CLIs como los ADEs: PATH del login shell, versión, sesión y modelos, 0 tokens.**
  (cerrado 2026-10-26) `GET /api/providers` (`src/dashboard/handlers/providers.ts`): PATH del proceso + login shell
  (una vez, 3 s) + rutas conocidas en `src/run/executors/cli-discovery.ts`, que también usa `detectInstalledClis`;
  `--version` en paralelo, sesión leída de disco (Claude `oauthAccount.emailAddress`/`organizationType`, Codex payload
  de `id_token`; ronda 1 leía campos inexistentes y la ronda 2 lo corrigió), caché 30 s y `?refresh=1`. Evidencia del
  cerebro en vivo (`orchestos-set-ref`): Claude 2.1.311 pro, Codex 0.164.0 plus, opencode 1.19.0, 4 no encontrados;
  0 tokens/JWT en la respuesta; 1,1 s en frío, 11 ms en caché. `test:coverage` 2109/0 fuera del sandbox.
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/SET.2.md
- [x] **SET.2.1 — 🧠 Los CLIs se lanzan con el mismo PATH con que se detectan.**
  (cerrado 2026-10-26) Hermano de SET.2 hallado por el cerebro: un CLI visto solo por el PATH del login shell salía
  "instalado" pero chat/tareas lo lanzaban con el PATH del proceso (ENOENT). `applyCliSearchPath()` al arrancar
  dashboard y CLI deja `process.env.PATH = cliSearchPath()`; `whichCli` en los checks de existencia, `env` en el único
  spawn sin él (`chat-cli-models` `defaultRunner`); marcador `ORCHESTOS_CLI_SEARCH_PATH` para que los hijos no repitan
  el login shell (0,64 s medido). Test con ejecutable falso fuera del PATH. `test:coverage` 2120/0; chat y tareas
  reales pasan en el gate del lote (`model-routing` 19/19, `usage-bar` 19/19, `text-sweep` 10/10).
  Ejecutado por: claude sonnet (criterio-alt, Codex sin cupo), revisión Opus · Spec: docs/specs/SET.2.1.md
- [x] **SET.3 — 🧠 Página Providers: una fila por CLI detectado + no encontrados + CLIs propios.**
  (cerrado 2026-10-26) Providers con Instalados (versión, cuenta enmascarada, plan, N modelos, toggle `hiddenClis`),
  No encontrados con "How to install" y CLIs propios movidos desde Executor; el select de modelo solo en la fila del CLI
  Ejecutor (escribe `roles.executor.model`; decisión del cerebro, Model routing no cambia). Siete rondas: r1 paró por
  esa decisión; en vivo el cerebro halló opencode "0 models" (su catálogo propio se cortaba a 3 s en paralelo con el
  del chat → ahora usa `readCliModelCatalogsCached`), versión con el nombre del CLI, Settings entera esperando a
  `/api/usage` en frío (12,4 s; `getUsage`/`getProviders` salen del `Promise.all`) y catálogos lanzados por nombre
  aunque la detección diera la ruta. Evidencia del cerebro en vivo (`orchestos-set-ref`): Claude 2.1.311 pro 13,
  Codex 0.164.0 plus 10, opencode 1.19.0 380 en la primera carga. `test:coverage` 2118/0.
  Gate en vivo: navegador real (Playwright) `providers` 12/12, `custom-cli` 13/13, `model-routing` 19/19, `usage-bar` 19/19, `settings-shell` 21/21, `docs/done/evidence/SET.3-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) r1–r5, luna (mecanico) r7, claude sonnet (criterio-alt) r6 por cupo de Codex, revisión Opus · Spec: docs/specs/SET.3.md
- [x] **SET.4 — 🔍 "API & Models" pasa a "API keys" y OpenRouter deja de ser crítico.**
  (cerrado 2026-10-26) Título de la página "API keys"/"Claves de API" y fuera la línea al pie; `openrouter-key`
  `critical: false` en `setup.ts` (2 sitios): con un CLI de tareas el setup queda listo sin clave (en vivo, Health
  "All prerequisites met" con OpenRouter listado como el check que falta); `executor-modes` marca "OpenRouter API"
  `detected` solo con `OPENROUTER_API_KEY`. `rg "API & Models"` = 0. `test:coverage` 2121/0.
  Gate en vivo: navegador real (Playwright) `model-routing` 19/19, `docs/done/evidence/SET.4-live.json`
  Ejecutado por: claude sonnet (criterio-alt, Codex sin cupo), revisión Opus · Spec: docs/specs/SET.4.md
- [x] **SET.5 — ⚡ Appearance con página propia y Keybindings de solo lectura.** (cerrado 2026-10-26) Temas en
  Appearance sin descripción larga; General = fila Language (sale de la nav); Keybindings lee el registro nuevo
  `lib/keybindings.ts` (2 atajos globales, ambos Cmd/Ctrl+K) que también usa `CommandPalette`. Dos paradas válidas
  de Sol (General vacío, condición de filtro imposible); spec completado. Evidencia del cerebro: General, Appearance y
  Keybindings vistos en vivo sobre copia de la DB; `test:coverage` 2101/0, typecheck y lint.
  Gate en vivo: navegador real (Playwright) `settings-pages` 17/17, `settings-shell` 21/21, `shell-look` 73/73, `docs/done/evidence/SET.5-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/SET.5.md
- [x] **SET.6 — 🔍 Fallas sueltas vistas en vivo en Settings.** (cerrado 2026-10-26) El bloque de CLIs propios
  (ahora en Providers) pasa por `language`: "Add CLI", "New CLI", Installed/Not installed, formulario y ayudas (visto
  en vivo en inglés); "Setup needs attention" lista los checks que fallan (label + hint); la entrada Health de la nav
  lleva un punto verde con `ready` y ámbar si falta algo crítico (no existía; visto verde en vivo, el ámbar solo
  leído en código). "Loading project data…" no se reprodujo con la tabla cargada (probable causa: Settings esperaba a
  `/api/usage`, arreglado en SET.3 r3; hipótesis, sin reproducción previa); `project-tabs` lo vigila. `test:coverage` 2121/0.
  Gate en vivo: navegador real (Playwright) `project-tabs` 40/40, `text-sweep` 10/10, `docs/done/evidence/SET.6-live.json`
  Ejecutado por: claude sonnet (criterio-alt, Codex sin cupo), revisión Opus · Spec: docs/specs/SET.6.md

### Confianza en el flujo — TRUST (GO de Carlos 2026-10-22)

Regla: nada se reintenta, cierra ni muestra sin evidencia medida que el usuario vea. Opinión de LLM se marca como tal.

- [x] **TRUST.0 — 🔍 Auditar la evidencia de cada paso del flujo.** (cerrado 2026-10-22) Tabla y 7 huecos verificados
  leyendo el código en `docs/specs/TRUST.md`; orden por riesgo: TRUST.2, TRUST.1, TRUST.3, CI.23.
  Ejecutado por: codex gpt-6-luna (leer) + verificación del cerebro · Spec: docs/specs/TRUST.md
- [x] **TRUST.2 — ⚡ "QA pass" solo si algo verificó.** (cerrado 2026-10-22) Sin criterios el juez no corría y se
  escribía `pass` (`src/run/harness.ts:783`). Ahora veredicto `skipped` con motivo que dice qué verificó (checks corridos o
  "nada verificó esta tarea"); `graph-runner`/`cli` copian el veredicto real, no un literal. UI: "Sin QA · n checks",
  "Sin verificar" (aviso) o "QA pass/fail"; `skipped` no cuenta en la tasa de pase. Evidencia del cerebro: diff leído,
  typecheck y lint limpios, 45/45 unitarios, captura del run "Sin verificar"; `test:coverage` 1985/0 (ejecutor).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.2-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.2.md
- [x] **TRUST.1 — ⚡ El reintento recibe la causa medida, no un resumen.** (cerrado 2026-10-22) `formatCheckFailure`
  (`src/run/checks.ts`): cmd + exit/expected o timeout + cola de stderr/stdout, ≤ 1800. El prompt conserva primera línea
  y final (antes cortaba el final). Fallo de QA llega como "Opinión del juez QA (<modelo>): …". UI: salida bajo el check
  fallido en Runs; el detalle de tarea muestra el motivo sin exigir `retryCount > 0` y avisa "No hay registro de por qué
  falló". Evidencia del cerebro: diff leído, typecheck y lint limpios, 63/63 unitarios, capturas con `TRUST1-MARKER` en
  Runs y en Tasks; `test:coverage` 1991/0 (ejecutor). Dos paradas del ejecutor por casos borde de recorte no definidos
  en el spec (corregido el spec, no el ejecutor).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.1-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.1.md
- [x] **TRUST.3 — ⚡ La UI separa medida de opinión.** (cerrado 2026-10-22) Pestaña QA de Runs en "Medido" (checks y su
  salida) y "Opinión del juez (<modelo>)" (veredicto y criterios); un check fallido ya no aparece como "QA verdict";
  juez que no corrió en tono neutro, sin ✗; sin checks ni juez "Nada verificó este run". La respuesta del ejecutor se
  titula "Lo que reporta el ejecutor (no verificado)" y se muestra también en runs `done`. Evidencia del cerebro: diff
  leído, captura de `qa-negative` con las dos secciones; typecheck, lint, fidelidad JSX y `test:coverage` 1992/0
  (ejecutor). Una aserción propia del ejecutor (reply en run `done`) se retiró porque el run real trae
  `executor_reply: null` → TRUST.4.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.3-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.3.md
- [x] **TRUST.4 — 🔍 Un run `done` de Codex no guarda lo que reportó el ejecutor.** (cerrado 2026-10-22) Bug del producto:
  3 de 7 `insertRun` de `harness.ts` (éxito, excepción, fallo previo a checks) no pasaban `executor_reply`; ERP.4.8 lo
  había acotado a fallos. Ahora todos. Evidencia del cerebro: diff leído, typecheck, 4/4 `harness-executor-reply`
  (contraprueba contra HEAD: `Received: null`), captura del run `done` con el texto real de Codex bajo "Lo que reporta
  el ejecutor (no verificado)"; `test:coverage` 1992/0 (ejecutor). Luna (`mecanico`) paró dos veces: `writer-lock check`
  daba EPERM en el sandbox (arreglado en el vault `520f0e0`: el refresco no bloquea la autorización) y luego afirmó
  cambios ajenos en `tasks.mjs` que no existían; pasó a Sol.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.4-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.4.md
- [x] **TRUST.5 — 🔍 La pestaña resaltada en el detalle de un run no es la que se ve.** (cerrado 2026-10-22) No era bug
  del componente: las clases eran correctas; las capturas de ui-gate se tomaban dentro de la transición de 150 ms y la
  evidencia visual mentía. `shot` (`scripts/ui-gate/run.mjs`) espera 300 ms antes de capturar; `qa-negative` afirma las
  clases de las pestañas. Evidencia del cerebro: diff leído, captura nueva con "QA Assertions" resaltada; `test:coverage`
  1992/0 (ejecutor).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.5-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/TRUST.5.md
- [x] **TRUST.R2 — 🔍 Auditar aprobaciones, undo y lo que el chat afirma de las tareas.** (cerrado 2026-10-23) Mapeo de
  Sol (`analizar`), huecos altos verificados por el cerebro leyendo el código. Tabla y huecos: `docs/specs/TRUST.md` §
  Ronda 2. Sin delegación de código: auditoría de solo lectura.
- [x] **TRUST.6 — ⚡ El reporte de tarea dice "done" solo con un run `done` del mismo proyecto.** (abierto y cerrado 2026-10-23)
  `task-report.ts:39-44`: el titular sale de `tasks.yaml` sin mirar el run (puede decir "✓ done" + "No run was
  recorded."), y sin run del proyecto usa `runs[0]` de cualquier proyecto (evidencia ajena con el mismo ID de tarea).
  Arreglo: run válido = el del mismo proyecto; sin `projectId` no se adjunta run (el lanzamiento sin proyecto tampoco
  le pone `project_id`). `✓ done` exige yaml `done` + run `done`; si no, "marked done in tasks.yaml · latest run <estado>"
  o "· no matching run recorded" y `outcome` = estado del run o `pending` (la tarjeta no lo pinta como éxito). Sin
  hermanos con el mismo defecto. Contraprueba: 5 tests fallan contra HEAD. Cerebro: tests 64/0 + thread.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.6-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/TRUST.6.md
- [x] **TRUST.6.1 — ⚡ Regresión de TRUST.6: el test de reconcile esperaba "✓ done" sin run.** (abierto y cerrado 2026-10-23)
  `task-run-reconcile.test.ts:165` crea la tarea `done` sin run y sigue esperando `✓ done`: 15/1 en HEAD, 16/0 en
  HEAD~1. Visto por Sol al correr `src/dashboard/handlers` en TRUST.7; el cerebro corrió solo suites acotadas al cerrar
  TRUST.6. No llegó a CI (sin push).
  Arreglo: el test registra un run `done` del proyecto y pasa el watch con su `project_id`; la expectativa no cambia.
  Cerebro: diff leído, 16/0. Lección: al cambiar un texto que el producto emite, `grep -rn` del texto viejo en tests.
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/TRUST.6.1.md
- [x] **TRUST.7 — ⚡ Undo comprueba que el rollback quedó limpio.** (abierto y cerrado 2026-10-23) `runs.ts:253-266`: si el
  commit del undo falla, `revert --abort` no se comprueba; podrían quedar cambios inversos aplicados con el error a la
  vista. Verificar árbol vs. HEAD tras abortar y mostrar residuos. Inferido, reproducir primero: un run con varios
  commits (fast-forward, `sandbox.ts:194/253`) registra solo HEAD y el undo revierte solo ese.
  Reproducido antes de arreglar (Sol): 2 commits en el worktree → undo dejaba vivo el primero. Arreglo: el merge guarda
  la base tomada bajo el candado (`runs.commit_base_sha`, migración 31 aditiva, sin backfill) y el undo revierte el
  rango lineal completo (rechaza historia no lineal); tras abortar o commitear compara HEAD y árbol, y solo marca
  revertido si quedó limpio (si no: `rollbackClean:false` + `residualFiles`). Runs viejos sin base: undo de un SHA.
  Contraprueba: 5 tests fallan contra HEAD. Cerebro: diff leído, `test:coverage` 2003/0, `chat-task-undo` 16/16.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.7-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/TRUST.7.md
- [x] **TRUST.7.1 — ⚡ La tarjeta muestra los archivos residuales de un undo que no quedó limpio.** (abierto y cerrado 2026-10-23)
  TRUST.7 devuelve `residualFiles` con 500; `revertRun` (`api/runs.ts:141`) y `TaskCard.tsx:202` solo pasan archivos en
  409 → el usuario vería el error sin los archivos.
  Arreglo: `revertRun` pasa `residualFiles` y la tarjeta los pinta con cualquier status (lista existente, sin JSX nuevo).
  Cerebro: diff leído, typecheck, `test:coverage` 2003/0, `chat-task-undo` 16/16 (camino feliz). **Sin verificar en
  vivo el caso residual**: requiere un revert que deje residuos, que el flow no puede fabricar.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.7.1-live.json` (misma corrida que TRUST.7)
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/TRUST.7.1.md
- [x] **TRUST.7.2 — ⚡ Los tests de TRUST.7 asumen que `git init` crea `.git/hooks`.** (abierto y cerrado 2026-10-23) El
  pre-push (HOME temporal, sin plantilla de git) falló 3 tests de `run-revert.test.ts` con `ENOENT …/.git/hooks/
  pre-commit`; localmente pasaban. Hermano: `scripts/ui-gate/flows/tasks.mjs:101` (CI.40).
  Arreglo: `mkdirSync(.git/hooks, recursive)` antes de cada hook (3 tests + el flow). Cerebro: 15/0 con
  `HOME` temporal, `GIT_CONFIG_GLOBAL=/dev/null` y `GIT_TEMPLATE_DIR` vacío. Trampa: un fixture que escribe hooks crea
  la carpeta, como `commit-tasks-yaml.test.ts:110`.
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/TRUST.7.2.md
- [x] **TRUST.8 — ⚡ El chat no promete lo que no pasó.** (abierto y cerrado 2026-10-23) `create_task` responde al orquestador
  "the user will see it and approve it" (`src/mcp/server.ts:34`, `adapters.ts:118`) aunque fuera de modo manual arranca
  solo (`chat.ts:1169`); "Started" se añade tras el spawn, sin estado `running` (`chat.ts:1189`); la nota del sistema
  va pegada al texto libre del LLM (`chat.ts:1199`) y no se distingue. Aprobación: OpenCode sin `metadata.diff` y
  `NotebookEdit` de Claude ofrecen aprobar una ruta sin cambio visible (`opencode-approval.ts:22`,
  `claude-approval.ts:14-22`) → avisar que falta el detalle.
  Arreglo (Sol): `CREATE_TASK_RESPONSE` dice que la propuesta se recibió, que OrchestOS la correrá o retendrá y que
  no diga que está hecha; `▶ Started` → `▶ Run requested` (es el spawn, no `running`) y la tarjeta absorbe esa nota
  (ya no sale duplicada en la burbuja); Claude/OpenCode/Codex avisan "did not provide the content of this change" en
  el detalle de la aprobación. Ajuste del cerebro: fuera las etiquetas "Model statement (unverified)" y "OrchestOS:"
  que Sol puso en cada respuesta (texto que no aporta; el estado medido es la tarjeta) — Luna. `chat-followup-task` y
  `chat-task-undo` miden la tarea por `/api/tasks` + tarjeta visible, no por el texto (Luna). En vivo, el modelo ahora
  dice "la creación aún no está confirmada". Cerebro: `test:coverage` 2007/0; `chat-streaming` 27/27, `codex-live`
  14/14, `chat-followup-task` 9/9, `chat-task-undo` 17/17; `chat-permissions` 9/9 en la corrida anterior y sola, 1 fallo
  en la del archivo de evidencia → CI.41.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TRUST.8-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, 2 ajustes) · Spec: docs/specs/TRUST.8.md
- [x] **CI.41 — 🔍 `chat-permissions` intermitente: `data-permission-mode` null en el primer paso.** (abierto y cerrado 2026-10-23)
  1 de 3 corridas hoy (set de 5 flows de chat): `composer reports yolo without permissions strip: mode=null`; la
  captura `1-yolo` muestra el composer cargado ("Auto-edit"). `chat-permissions.mjs:59-62`: el `waitForFunction` vio
  `yolo` y el `getAttribute` siguiente leyó `null` → el composer se re-montó entre ambos. Sola: 9/9. Próximo paso: el
  paso guarda el atributo en el mismo `waitForFunction` y el detalle dice si el nodo se reemplazó.
  Medido (Sol): `yolo → null` ocurre sin reemplazar el nodo. Causa verificada por el cerebro: el efecto de config de
  `OrchestChatView.tsx:104-118` pone `permissions` a `null` cada vez que se re-dispara y lo rellena al responder
  `/api/config`; el atributo (`:541`) parpadea un fetch. No afecta al envío (el backend lee el modo de su config).
  Arreglo del gate: lectura atómica dentro del `waitForFunction` + marca de reemplazo, en Yolo y Manual. Anotado sin
  ítem: el parpadeo de `permissions` al re-disparar el efecto. Sol: 9/9 ×3 y set de chat verde; cerebro: 9/9.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.41-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CI.41.md

### Abiertos — fiabilidad de los gates y documentación

- [x] **CI.39 — 🔍 `usage-bar` rojo: el refresco manual muestra la cuota vieja un instante.** (abierto y cerrado 2026-10-22)
  Bloqueaba el push de TRUST.5. Defecto del flujo, no del producto ni de TRUST.5: buscaba "67%" en toda la página y la
  cuota real de Codex marcaba justo 67 %; además el conteo de requests mezclaba dos documentos (reload). Selectores
  acotados a la cuota de Claude (`footer button[title^="Claude"]`) y carga limpia por `about:blank`; aserciones intactas.
  Evidencia del cerebro: diff leído; contrapruebas del ejecutor (colisión forzada falla con el selector viejo y pasa con
  el nuevo; Claude 61→67 % sigue fallando); `usage-bar` 5/5 (19/19), `test:coverage` 1992/0 (ejecutor).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.39-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/CI.39.md
- [x] **UI.30 — ⚡ Un solo anillo de contexto: fuera el de la cabecera de Dev.** (abierto y cerrado 2026-10-23, Carlos:
  "esta repetido en el chat cual de los 2 vale?") UI.27.3 subió el anillo a la barra superior; el de la cabecera de Dev
  quedó duplicado. Se quita; el fetch de Dev se queda porque llena la caché que lee la barra superior. model/source/engine
  no se pasan: `ContextRing` nunca los muestra. Excepciones de fidelidad en `jsx-allow.json`.
  Evidencia: `ui:fidelity:jsx` 0, typecheck 0, biome sin errores en los archivos tocados, `test:coverage` 2023/0.
  En vivo (dashboard real, Dev con sesión abierta): un solo anillo, dentro de `header.h-11`, con dato.
  Gate en vivo: navegador real (navegador integrado de Claude Desktop), `docs/done/evidence/UI.30-live.json`
  Ejecutado por: Opus (Dev, sin delegación) · codex mecanico (`jsx-allow.json`) · Spec: docs/specs/UI.30.md (borrado)
- [x] **CI.42 — 🔍 `Mutation Shards` excede 3 h: cada shard arrastra los tests de todos los ejecutores.** (abierto 2026-10-23, cerrado 2026-10-24)
  Corrida `39921431428` (d734166): `executors` y `executors-codex` cortados a 180 min; `context-routing` 21→69 min,
  `runtime-boundaries` 45→135 min. Prueba inicial de Stryker 7→27 s y 10→28 s. Medido (cerebro): la selección por
  grafo de imports (`scripts/mutation-test-shard.ts`) pasó de 52 a 62 archivos en context-routing y de 54 a 67 en
  executors desde el registro `task-engines.ts`; `tasks-concurrency` 10,8 s y `run-revert` 8,7 s entran ahora.
  Spec: `docs/specs/CI.42.md` (borrado).
  Arreglo (Sol): el selector sigue solo imports de runtime (Bun `scanImports` + AST; fuera `import type`, comentarios
  y textos de fixtures) y `executors`/`executors-codex` se parten en 4 configs (6 jobs, mismos archivos mutados:
  13/13 y 4/4). Selección HEAD: context-routing 62→28, runtime-boundaries 65→34, particiones 45–49. Gates (cerebro):
  typecheck 0, lint sin errores, `mutation-test-shard.test.ts` 8/0; `test:coverage` 2013/0 (ejecutor). Abierto hasta
  ver los tiempos reales del `workflow_dispatch` (estimación de Sol: job más lento ~150 min).
  Cierre (cerebro, `gh run view 39983853493`, success): executors-codex-engines 122, executors-routing 117,
  executors-engines 115, executors-codex-server 110, runtime-boundaries 74, context-routing 24 min; todos < 180.
  Ejecutado por: Sol (arreglo `f75e8524`) · cierre y medición: Opus
- [x] **CI.44 — 🔍 Los gates usan el Codex del chat general del HOME real.** (abierto 2026-10-25, cerrado 2026-10-25) El chat sin proyecto
  arranca Codex con `CODEX_HOME=~/.orchestos/general-chat` del usuario aunque el gate corra con home aislado: el
  `logs_2.sqlite` real tiene threads de los gates (`docs/done/evidence/CHAT.3-r4/REPORT.md`). Mezcla sesiones de prueba
  con las de Carlos y comparte su límite de peticiones (429). Aislarlo en el home del gate.
  Hecho: `src/config/orchestos-home.ts` (`orchestosHome()`/`orchestosDir()`, por llamada) y `generalChatConfigHome()`
  en `codex.ts`; hermanos con el mismo defecto: `.env` de los 4 providers API, `dbPath` de setup (dashboard y CLI),
  `config.yaml` global (`config/load.ts`) y la copia de evidencia de `ui-gate/run.mjs`. `auth.json` se sigue enlazando
  del home real. Cerebro: tsc, lint, `test:coverage` 2083/0; `qa` sin defectos. En vivo: el hilo general del gate
  (`01a17509…`, Codex real) no aparece en `~/.orchestos/general-chat/logs_2.sqlite` (717 filas antes y después).
  Gate en vivo: navegador real (Playwright), chat-notices 5/5, codex-live 14/14, `docs/done/evidence/CI.44-live.json`
  Ejecutado por: codex gpt-6-luna (mecanico), revisión qa + Opus · Spec: docs/specs/CI.44.md

- [x] **CHAT.3 — 🔍 Si el modelo no responde, el chat dice por qué, en el momento.** (cerrado 2026-10-25, pedido de
  Carlos tras CI.11) Hoy el aviso de reintento de Codex (`error` con `willRetry`) se descarta, la cuota agotada
  (`account/rateLimits/updated`) no se muestra, no hay clasificación de errores (cuota, auth, red, sobrecarga, modelo
  inválido) y al timeout el hilo enseña el texto crudo `Codex CLI: Codex timed out after 120000ms`. Capa común de
  avisos + adaptador por CLI (Codex, Claude).
  Hecho: paso `notice` tipado (`src/run/executors/cli-failure.ts`, clasificador + mapa directo de errores de Claude
  `api_retry`/`assistant.error`); Codex convierte `error` con `willRetry` y cuota al 100 % en avisos, y mientras calla
  lee su log nativo `logs_2.sqlite` (solo lectura) para decir "Codex got 429 Too Many Requests — retry 1/5 in 70 s":
  la causa medida de los silencios de CI.11 era un 429 con reintento a 70–245 s que Codex no emite por JSON-RPC. En el
  hilo: línea viva "Request sent to <modelo> — no response yet…" con contador; el fallo queda visible con mensaje
  clasificado y "Details", también tras recargar. Migración 32 (`chat_turn_steps.type` admite `notice`). Timeout del
  turno configurable solo para gates (`ORCHESTOS_CHAT_TURN_TIMEOUT_MS`); flujos nuevos `chat-timeout` y
  `chat-notices`. 5 rondas: la revisión del cerebro cazó que el mensaje del usuario contaba como respuesta, que el
  aviso no llegaba a pantalla y que "Codex reported no error" mentía. Cerebro: tsc, lint, `test:coverage` 2079/0.
  Gate en vivo: navegador real (Playwright), chat-streaming 27/27, codex-live 14/14, chat-notices 5/5, chat-timeout 9/9, `docs/done/evidence/CHAT.3-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CHAT.3.md

- [x] **CHAT.2 — 🔍 El prompt del chat no explica comandos, espera de tareas, checks ni reintentos.** Cerrado 2026-10-24.
  GO de Carlos 2026-10-24. Cuatro ajustes de texto: `Commands:` son de los ejecutores; `create_task` arranca o espera
  (manual / archivos existentes); qué son los checks automáticos; reintentar/cancelar/borrar van por la tarjeta.
  `Commands:` lleva "(for task executors and their checks, not this chat)"; `buildAutoTaskInstruction` recibe
  `permissionMode` del config: Manual → espera Run en la tarjeta; Yolo → arranca salvo output existente; "never claim a
  waiting task is running"; checks = outputs declarados + checks de tarea/proyecto, revisor LLM solo con criterios o
  gate de revisión (cerebro lo contrastó en `harness.ts:791`); reintentar/cancelar/borrar → la tarjeta. Cerebro:
  typecheck 0, unitarios 14/0; ejecutor `test:coverage` 2026/0.
  Gate en vivo: `docs/done/evidence/CHAT.2-chat-live.json` (chat-streaming 27/27, codex-live 14/14)
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CHAT.2.md (borrado)
- [x] **SKILLS.1 — 🔍 No se sabe qué skills de OrchestOS se usan ni si aportan.** Cerrado 2026-10-24.
  GO de Carlos 2026-10-24. Fase 1: medir sin LLM inventario, caminos de selección, uso real en `runs` y resultado de
  QA por skill (`skills/*.yaml` + `skills/pro/`); veredicto propuesto por skill. Retirar espera OK de Carlos.
  Medido (SQL de solo lectura sobre `~/.orchestos/db.sqlite`; el cerebro reprodujo los conteos): 806 runs, 778 sin
  skill. Con skill: doc-gen 9 (1/8; los 8 fallos son `codex produced no turn.completed`, todos el 2026-09-23, no la
  skill), frontend-design 8 (6/2), qa-structured 5, security-review 1, tdd-enforcer 1; IDs sin YAML `doc` 3 (0/3) e
  `implement` 1, aún generados por `src/tasks/init.ts:71`. 22 de 27 YAML nunca corrieron: el camino automático solo
  elige con candidata única o `mode: automatic` (`chat.ts:791`), así que "nunca usada" mide al selector, no a la skill.
  Aporte no demostrable (muestras < 10, sin control). Hallazgos: `skills/pro/api-contract.yaml` idéntica (`cmp`) a la
  normal y sombreada; `pickAutoSkill` elige una skill `explicit` si es candidata única (`verification-before-completion`).
  Ejecutado por: codex gpt-6.1-sol (analizar), verificación Opus · Spec: docs/specs/SKILLS.1.md (borrado)
- [x] **CI.11 — 🔍 El turno 2 de Codex en `codex-live` tardó 180 s contra 22 s del turno 1.** (abierto 2026-10-03, cerrado 2026-10-25)
  Visto una vez en la corrida completa de ui-gates (`$TMPDIR/ui-gate-73235/result.json`, paso "turn 2 is faster than
  turn 1": 22141 ms vs 180113 ms, el timeout del flujo). Sin verificar si es latencia del modelo o un cuelgue al
  retomar el thread. Señalado por la QA de Sol: sacar el flujo del pre-push no puede silenciar este detector.
  Siguiente paso: reproducir con `gate:evidence` y leer el log del app-server de Codex en ese turno.
  Fase 1 (evidencia, 2026-10-21, spec `docs/specs/CI.11.md`): solo no se reproduce (4 de 4 verde, turno 1 ≈10 s,
  turno 2 ≈3–5 s) y `dashboard.log` no guardaba nada del app-server. Ahora `CodexAppServer.turn()` escribe
  `[codex-turn] {event, threadId, ms}` por fase (`thread-start`/`thread-resume`, `turn-start`, `first-delta`,
  `turn-completed`, `turn-error` con solo `kind`/`method`/`name`, sin texto del error: QA de Sol mostró que un error
  remoto puede repetir el chat) y el paso `turn 2 is faster than turn 1` vuelca esas líneas si falla. Abierto hasta el
  próximo fallo: leer en qué fase se fue el tiempo. Ejecutado por: GPT (criterio-alt + mecanico), QA: GPT (qa).
  Fase 2 (2026-10-25, causa medida): reproducido 2 veces en 6 corridas, en turno 2 y en turno 1. Hipótesis de stderr
  sin drenar (`codex-app-server.ts:99`, solo `taskTurn()` lo drenaba) refutada: con stderr drenado volvió a fallar y
  `stderrBytes` fue 0. En el fallo el cliente no descartó nada (`dropped: {}`); Codex emitió `turn/started` e
  `item/completed` del mensaje del usuario y después nada. El rollout de Codex muestra la petición al modelo a las
  15:24:42 sin respuesta hasta el abort a las 15:26:40 (ni `token_count`): **latencia del backend del modelo, no de
  OrchestOS.** Queda: stderr drenado siempre, `[codex-turn]` con `notifications`/`dropped`/`stdoutBytes`/`stderrBytes`
  por turno, y `ui-gate` conserva `log/` y `sessions/` del home de Codex si un flujo falla. Qué hace el producto ante
  ese silencio (aviso honesto, margen) es decisión de Carlos, fuera de este ítem.
  Gate en vivo: `codex-live` 3 corridas (PASS/FAIL/PASS), `docs/done/evidence/CI.11-repro-2026-10-25/fase2-codex-turn.log`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CI.11.md

- [x] **CI.18 — 🔍 `chat-roles` intermitente en el pre-push completo (3.ª vez, 2026-10-11).** (cerrado 2026-10-23) Instrumentar el paso del
  marcador y medir la causa antes de arreglar. Spec: docs/specs/CI.18.md
  2026-10-11: instrumento aplicado (Luna): el detalle del paso guarda `/api/chat` (texto, `autoTask`) + captura
  `marker-failure`. Medido: 3 corridas del set completo del pre-push → 3/3 PASS; desde R.8.2.1 suma 6 de 7 (1 fallo, el
  del pre-push de las 09:10). En las 3, Codex emitió el marcador sin que se le repitiera la instrucción → la hipótesis
  "R.8.2.1 quitó el refuerzo" no se sostiene. Causa del fallo sin medir: queda abierto hasta el próximo fallo, que ya
  deja evidencia. `dbTasks` siempre `[]` (las tareas no viven en la tabla `tasks` con `project_id`): campo inútil.
  2026-10-16 (4.ª vez, pre-push de UI.8.6): falló otro paso, `question turn receives a response: No response text`;
  la captura `orchestrator-question-response` muestra `Codex CLI: Codex timed out after 120000ms` con la cuota de
  Codex al 90 %. Ese día Codex tardaba 30–65 s en responder "ok" fuera de OrchestOS y tumbó 2 corridas de
  `chat-permissions` igual. Causa de esta vez: latencia externa de Codex contra el timeout de 120 s del turno
  (familia CI.11). Pendiente de decidir: si el turno de chat necesita más margen o un aviso honesto, no reintentos ciegos.
  2026-10-23 (5.ª vez, pre-push de CI.23): `held task card visible at the bottom` → `atBottom:false`; la captura muestra
  el hilo cortado y la tarjeta "Approve & Run" fuera de vista. Bug de producto: `useStickToBottom` soltaba el hilo ante
  cualquier `scrollTop` que bajara, también el que causa el layout (contracción, clamping). Arreglo (Sol): solo un gesto
  del usuario (rueda arriba, tacto, teclado, arrastre de la barra) suelta el hilo; el ResizeObserver lo mantiene abajo.
  `chat-roles` suma pasos deterministas: crecimiento con scroll entregado antes del ResizeObserver, y rueda real que
  no se mueve al crecer el contenido. Contraprueba de Sol: hook anterior a 1200 px del fondo, nuevo a 0 px. Causa exacta
  bajo carga: inferida. Sin scroll programático en los hilos (solo Settings). Cerebro: 54/0 thread, `chat-roles` 12/12.
  La familia CI.11 (latencia de Codex) sigue en CI.11.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.18-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CI.18.md
- [x] **CHAT.1 — 🔍 El chat ofrece `rg` aunque no esté instalado.** Cerrado 2026-10-23. Reportado por el chat:
  `run_readonly` fallaba con "Executable not found". `readonlyPrograms()` sondea `rg --version` (sonda inyectable,
  cache por proceso); schema, descripción y prompt se arman de esa lista; sin `rg` la llamada responde
  `rg is not installed; use ["git","grep",…]`. Cerebro, sonda real en la Mac de Carlos: `[git, ls]`, la descripción
  no menciona `rg`, `rg` → error con alternativa, `git grep` → resultado. Ejecutor: 2025/0 en `test:coverage`.
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CHAT.1.md
- [x] **CFG.1 — 🔍 `orchestos.config.yaml` tiene bloques muertos que confunden.** Cerrado 2026-10-23. Clasificado con
  lectores: `models:` era solo migración legacy con los 4 roles asignados → fuera del YAML (la migración de
  `load.ts` queda para proyectos viejos); `agent`, `agentic`, `apiMode`, `external` tienen lectores vivos y se quedan.
  Settings ya no recrea `models:` en un YAML que no lo tiene. Ejecutor: 2025/0 en `test:coverage`.
  Settings con YAML sin `models:` muestra los 4 roles; un PUT con la clave legacy no lo recrea.
  Gate en vivo: navegador real (Playwright, Chrome), `docs/done/evidence/CFG.1-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CFG.1.md
- [x] **UI.26 — 🔍 En modo Dev, Copy de una respuesta vieja copia la última.** Cerrado 2026-10-23. Reportado por
  Carlos ("solo se copia el último"). El botón de cada respuesta buscaba el último `assistant` del timeline; ahora usa
  el del exchange (`assistantCopyTarget`, `components/dev/copy-target.ts`, 3 tests). Chat ya copiaba bien (22 botones,
  probado en vivo). Cerebro: `test:coverage` 2017/0, typecheck y lint verdes.
  Dev, sesión "Hola" sobre copia de la DB: 12/12 respuestas copian la suya.
  Gate en vivo: navegador real (Playwright, Chrome), `docs/done/evidence/UI.26-live.json`
  Ejecutado por: codex (mecanico), revisión Opus · Spec: docs/specs/UI.26.md
- [x] **CI.43.1 — 🔍 El test del post-commit falla en el pre-push.** Cerrado 2026-10-23. `git init` sin plantillas no
  crea `.git/hooks` (HOME temporal del pre-push): 2 fallos ENOENT; el test crea la carpeta. Cerebro: con HOME y
  `GIT_TEMPLATE_DIR` vacíos 2/2.
  Ejecutado por: codex (mecanico), revisión Opus · Spec: docs/specs/CI.43.1.md
- [x] **CI.43 — 🔍 Un `git commit -- <rutas>` deja el índice desfasado y bloquea las tareas.** Cerrado 2026-10-23: la tarea
  `chat-4a0d93a2…` no arrancó ("uncommitted changes") con el árbol idéntico a HEAD: el pre-commit hace `git add` de
  los derivados en el índice temporal del commit parcial y el índice real queda viejo (`MM`). Reproducido en repo
  mínimo. Arreglo: `scripts/post-commit.sh` re-sincroniza los derivados idénticos a HEAD; `install-hooks.sh` y
  `checkHooks` lo incluyen. `scripts/post-commit.test.ts` reproduce `MM` sin el hook y limpio con él. Cerebro:
  `test:coverage` 2017/0; `git status` limpio tras este mismo commit parcial.
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CI.43.md
- [x] **CI.45 — 🔍 Tras rechazar una tarea, el chat no la recrea cuando el usuario la reenvía (intermitente).**
  (cerrado 2026-10-26) Tumbó el pre-push de AT.11.2 (`chat-turn-details`, 1 de 2): el modelo contestó "vuelve a
  enviarla como una tarea" al mensaje que ya la reenviaba. Mismo síntoma que CI.29; la instrucción
  `src/chat/chat-context.ts:186` dejaba abierta esa lectura: ahora dice que el mensaje nuevo ES el pedido y prohíbe pedir
  que lo reenvíe. Evidencia del cerebro: diff leído (2 líneas); `test:coverage` 2091/0.
  Gate en vivo: navegador real (Playwright) `chat-turn-details` 29/29 tres veces seguidas, `docs/done/evidence/CI.45-live.json`
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CI.45.md
- [ ] **CI.19 — 🔍 El `git commit` del fixture falla a veces en el andamiaje de los ui-gates.** Visto 1 vez en
  `qa-negative` (2026-10-11, 1 de 9): `Command failed: git … commit -qm task fixture`, sin motivo porque el helper
  `run` usa `stdio: 'ignore'`. `qa-negative` ya reporta stdout/stderr y exit; los otros 20 flows con el mismo helper no.
  Al próximo fallo, leer el motivo en el `result.json` antes de arreglar; llevar el helper a `scripts/ui-gate/lib.mjs`.
  Fase 1 (2026-10-23): `run` vive en `scripts/ui-gate/lib.mjs` y los 27 flows lo importan; todo fallo dice
  `failed (exit N): <stdout+stderr>`. Gates (cerebro): `plan-doc` 16/16, `project-tabs` 39/39, `model-routing` 18/18;
  `test:coverage` 2012/0 (ejecutor). Sigue abierto hasta el próximo fallo: leer el motivo y escribir la fase 2.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.19-live.json`
  Ejecutado por: claude sonnet (criterio-alt; Sol sin cupo de 5 h) · Spec: docs/specs/CI.19.md
- [x] **CI.23 — 🔍 `tasks`: la tarea relanzada no deja su commit `chore(tasks)` (intermitente en batería).** (cerrado 2026-10-23) Visto 2 de
  6 corridas del set de UI.26.4 (2026-10-14), nunca con `tasks` solo: tras relanzar `gate-failed-task` y llegar a
  `done`, a los 15 s de `waitForTasksYamlCommit` el último commit es el del trabajo (`orchestos(gate-failed-task): …`)
  y `tasks.yaml` sigue modificado. No lo trajo UI.26.4 (solo presentación); el pre-push de `03b9cf3` pasó. Primero que
  deje evidencia (estado de la tarea, `git log -3` y el log del dashboard en el detalle del paso), luego causa.
  Spec fase 1 (evidencia): docs/specs/CI.23.md — `commitTasksYaml` hoy traga todo fallo (candado 30 s, commit exit≠0).
  Fase 1 cerrada (`9a82ee8`, 2026-10-14): `commitTasksYaml`/`commitFinalTaskState` escriben `[tasks-yaml] …` en stderr
  (el CLI hijo hereda stderr → `dashboard.log`) y el paso vuelca porcelain, `git log -5`, estado de la tarea y log.
  Reproducción: set de UI.26.4 6 de 6 verde, 0 líneas `[tasks-yaml]`. Abierto hasta el próximo fallo: leer el
  detalle del paso en `result.json` y escribir la fase 2 (causa).
  2026-10-22: visto 1 vez (`CI.32.c-live`, con `auto-flow chat-retry-report chat-permissions` antes): `porcelain="M
  tasks.yaml"`, último commit `orchestos(gate-first-task): …`; `tasks` solo pasó 31/31 justo después. Detalle en
  `$TMPDIR/ui-gate-65780/result.json` (temporal, no conservado).
  Causa medida (fase 1, 2026-10-23, `dashboard.log:106` de esa corrida): `commit exit=128 … .git/index.lock: File
  exists`; `add` pasó. Otro proceso git tenía el índice; cuál no quedó identificado (candidatos verificados en código:
  `git status` del dashboard y del flow, `codex exec` read-only en la raíz). Arreglo: `git()` de `src/run/sandbox.ts`
  reintenta `add`/`commit` ≤ 2 s solo ante ese error exacto, nunca borra el lock (vale para todas las rutas que
  commitean); `status`/`diff` del dashboard y del flow con `GIT_OPTIONAL_LOCKS=0`. Contraprueba: los 4 tests nuevos
  fallan contra HEAD. Gates del cerebro: typecheck, 10/10 unit, `ui:gate tasks` 43/43.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.23-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) · revisión: Opus
- [x] **CI.40 — 🔍 `tasks`: el paso de TRUST.1 depende de que el modelo real cree `TRUST.txt`.** (abierto y cerrado 2026-10-23)
  Visto 1 vez (corrida de Sol para CI.23): `gate-check-failure` quedó `retryReason="missing declared output(s):
  TRUST.txt"`; el check con `TRUST1-MARKER` nunca corrió y el paso falló sin decir que la premisa no se cumplió. La
  corrida siguiente pasó. Arreglo: premisa determinista (sin depender del modelo) o, como `qa-negative.mjs:337`,
  informar "premisa no cumplida".
  Arreglo: un hook `post-checkout` del repo fixture crea `TRUST.txt` en el worktree de `gate-check-failure` (la tarea
  ya no pide escribir nada) y el paso exige que el check haya emitido `TRUST1-MARKER` en el run; si no, falla con
  "premisa no cumplida" y el `retryReason`. Anotado sin tocar: `gate-first-task`, `gate-failed-task` y `gate-role-task`
  también dependen de que el modelo escriba. Gates: Sol 43/43 ×2, cerebro 43/43.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.40-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CI.40.md
- [x] **TCLI.1 — ⚡ Registro de ejecutores de tareas y elección por registro.** (cerrado 2026-10-22) (GO de Carlos 2026-10-22: "no hay un CLI
  de preferencia, eso es primordial") Un módulo registra el ejecutor de tareas de cada CLI; harness, auto-route, evals,
  cascada, CLI y handler de tareas lo consultan en vez de ramas fijas. Un CLI registrado sin ejecutor de tareas falla
  con mensaje visible, nunca `single-shot` en silencio. Fuera de TCLI: ejecutores reales de DeepSeek/Gemini/Kimi/GLM
  (no instalados, no verificables en vivo) y el chat. Spec: docs/specs/TCLI.1.md
  Hecho: `src/run/executors/task-engines.ts` (registro CLI ↔ motor; built-ins con carga diferida porque `codex.ts` abre
  la DB y LIMP.3 lo prohíbe al importar config); `taskEngine` sale de `CliDefinition`; harness, auto-route, evals,
  engine-cascade, `cli.ts` (un chequeo de binario), `handlers/tasks.ts`, `task-report.ts` y `schema.ts` consultan el
  registro. Los ids persistidos no cambian (`external` = Claude). Un CLI de `KNOWN_CLIS` sin ejecutor como Ejecutor →
  "<label> no tiene ejecutor de tareas en OrchestOS…", ya no `single-shot`. Evidencia (cerebro): typecheck y lint
  limpios, `test:coverage` 1971/0, `task-engines.test.ts` nuevo, `ui:gate tasks` 31/31 vía `gate:evidence`
  (`TCLI.1-tasks-live`). Anotado: el ejecutor vio fallar 1 vez `codex-engine.test.ts` "timeout … timed out" (678 ms,
  también sobre HEAD limpio); al cerebro pasó 3/3 suelto y en la suite: intermitente por tiempo, sin ítem hasta repetir.
  Ejecutado por: claude sonnet (criterio) · Spec: docs/specs/TCLI.1.md
- [x] **TCLI.2 — ⚡ Tipos y front derivados del registro.** (cerrado 2026-10-22) `dashboard/types.ts:216,276`,
  `handlers/runs.ts:81`, `app/src/types/orchestos.ts:7`, `App.tsx:876-886`, `load.ts:146`: sin uniones cerradas de CLI.
  Hecho: tipos de motor abiertos; `/api/system/executor-modes` = local + `KNOWN_CLIS` + api, con `taskEngine` (tiene
  ejecutor de tareas) y `session` (`chat`/`terminal`/`null`, del adaptador de chat); Settings no ofrece al rol Ejecutor
  un CLI sin ejecutor (`model-catalog.ts` expone `taskEngine`); el modal de chat nuevo filtra por `session` en vez del
  caso especial de OpenCode (un Gemini instalado ya no se ofrece para chat y da 400); `load.ts` usa `KNOWN_CLIS`;
  `App.tsx` pasa el agente tal cual (`chat-sessions.ts:270-279` rechaza con 400 los que no tienen adaptador). Además:
  arreglado el intermitente de `codex-engine.test.ts` "timeout … timed out" (2 veces hoy) y su hermano en opencode: el
  mock armaba el retardo de salida al construirse, antes del spawn; ahora en `start()` al spawnear. Evidencia
  (cerebro): typecheck, lint, `ui:fidelity:jsx` limpios; `test:coverage` 1976/0; `gate:evidence` `TCLI.2-live`:
  `tasks` 31/31, `chat-roles` 10/10, `chat-continuity` 8/8. El filtro del Ejecutor no cambia nada visible hoy (los 3
  CLI instalados tienen ejecutor); lo cubre `executor-modes-endpoint.test.ts`. No se pudo probar la migración legacy
  con `gemini`: `resolveAgent` descarta agentes sin adaptador de chat antes de llegar ahí.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TCLI.2-live.json`.
  r2 se lanzó primero a `mecanico` (Codex): no vio `AGENT_WRITER_TOKEN` y no escribió (trampa ya anotada en NEXT.md).
  Ejecutado por: claude sonnet (criterio) · Spec: docs/specs/TCLI.2.md
- [x] **CTX-GUARD.3 — 🧠 Bajar el peso de arranque bajo 9k.** (GO de Carlos 2026-10-22; cerrado 2026-10-22) El cerebro
  podó `CLAUDE.md` (`d5afa04c`). Carlos apagó lo de cuenta en local: `skillOverrides` (`anthropic-skills:*` → `off`),
  `cowork-plugin-management@synced: false` y `disableClaudeAiConnectors: true` (los conectores cayeron en vivo;
  `disabledMcpServers` no tenía efecto y se retira). El guard contaba archivos en disco y daba falso positivo: ahora
  descuenta `skillOverrides`/plugins `@synced` apagados, respeta `disableClaudeAiConnectors` y lee `MEMORY.md` de la ruta
  derivada de `ROOT` (medía la vieja `-Documents-`). Evidencia: guard en vivo silencioso (~8,9k est.);
  `startup-guard.test.ts` 18/18, los 3 tests nuevos fallan contra HEAD; typecheck y biome limpios.
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CTX-GUARD.3.md
- [x] **UI.29 — 🔍 Dev: el copiar de la respuesta del asistente va abajo a la izquierda.** (abierto 2026-10-23, Carlos:
  "lo normal es que salga en la esquina inferior izquierda") `OrchestDevWorkspace.tsx:~935` lo pone `absolute right-2
  top-2`; en Chat ya va debajo a la izquierda. Worktree `ui/UI.29` (otra sesión tiene el árbol principal).
  (cerrado 2026-10-23) El botón va debajo de la tarjeta, alineado a su borde izquierdo (medido en vivo: 4 px bajo la
  tarjeta, mismo `left`). De paso: `shell-look` fallaba en el resaltado de Settings (dura 960 ms y el flujo esperaba
  1000 ms antes de medirlo); ahora confirma y mide en una sola evaluación, sin relajar la afirmación.
  Ejecutado por: gpt-6.1-sol (rol `criterio`) · Spec: docs/specs/UI.29.md (borrado). Revisión: Opus (diff + vivo).
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/UI.29-live.json` — `shell-look` 76/76,
  `chat-streaming` 27/27 (Sol: 3/3 rondas).
- [x] **CI.38 — ⚡ `chat-continuity` no distingue dos chats con el mismo título tras UI.27.3.** (abierto 2026-10-22)
  Pre-push de `39c67167` 2/2: `strict mode violation: getByRole('button', { name: 'Remember this code for later: …' })
  resolved to 2 elements`. El flujo crea un chat de Claude y uno de Codex con el mismo título en el mismo proyecto;
  antes los separaba el prefijo "Claude:"/"Codex:", que UI.27.3 quitó (el icono los distingue). Arreglo:
  `data-thread-id` en cada chat/sesión del sidebar (`ShellSidebar.tsx`, solo el atributo) y `chat-continuity` y su hermano
  `codex-live` eligen la sesión por id. Evidencia: `chat-continuity` 8/8, `codex-live` 14/14, `chat-streaming` 27/27;
  typecheck, lint y `ui:fidelity:jsx` limpios.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/CI.38-live.json`.
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CI.38.md
- [x] **DOC.4 — ⚡ Archivar los cerrados de PLAN.md y poner al día CONTEXT.md.** (abierto y cerrado 2026-10-22, GO de
  Carlos) 133 ítems `[x]` de primer nivel (con cuerpo y sub-ítems) y 6 secciones `###` ya cerradas movidos literal a
  `docs/done/bloque-<PREFIJO>.md` bajo `## Archivado 2026-10-22 desde PLAN.md (DOC.4)`, con ancla por ítem; nuevos
  `bloque-UI`, `bloque-CTX-GUARD`, `bloque-SEC`, `bloque-OC`; la prosa de H.7 a `bloque-H.md`. `PLAN.md` 2.678 → 216
  líneas; comprobación de 0 líneas perdidas (multiconjunto de líneas no vacías antes ⊆ después + archivos). `plan:reconcile`
  borró 133 huérfanos de la DB; `bun run next` igual. Lo hizo el cerebro con un script en `/tmp`: `delegate` prohíbe al
  ejecutor editar el plan. `CONTEXT.md` § Estado vigente reescrito al 2026-10-22 (CI.32.c, CI.34, CI.35–CI.37, UI.27,
  UI.28, CTX-GUARD.2, tareas con cualquier CLI pendiente de plan).
  Sin delegación: plan y docs son del cerebro.

**Mantenibilidad (observación transversal):** en la revisión, cli.ts tenía 2923 líneas,
harness.ts 1203 y chat.ts 1237. La concentración de responsabilidades merece atención, pero
el tamaño no demuestra un bug. Extraer únicamente responsabilidades necesarias para los ítems
anteriores, con pruebas de comportamiento; no abrir un refactor masivo por conteo de líneas.

**Decisiones pendientes de Carlos dentro de UI.8** (no las toma ningún LLM):
1. `agents` como tabla propia o proyección derivada (UI.8.2).
2. Estados de sesión `ended` con **resume/fork** (§C.3) — PI y Codex los tienen; OrchestOS no.
3. Si UI.8.6 entra en este bloque o sale como bloque propio con backend separado. — Decidido 2026-10-16: entra la aprobación por tarea; la de cada herramienta sale como bloque propio.

## Fase 3 — Correr dentro de OrchestOS igual que el CLI directo

**Después de iniciar:** AT.11 (registro extensible completo), migración visual de pantallas
secundarias, resume/fork avanzado, orquestación de flotas y mejoras de aprendizaje nocturno.
H.10.2 sigue abierto; no es condición de entrada si el piloto no usa ese proceso. UI.8.6 completo
puede entregarse después, pero el piloto debe mostrar permisos reales y los límites de H.9.4.
La corrida sobre carlosgallardo.dev citada en AT queda como smoke opcional, no criterio de éxito.
Revisión documental de esta ruta: preflight AT.10 válido; verificación por lectura, sin corrida
ERP ni prueba visual nueva. Los ítems permanecen abiertos hasta sus gates reales.

**AT.11 adelantado (GO de Carlos 2026-10-26):** "cualquier CLI" sin instalar nada ni escribir código por CLI. Hoy cada
motor es código a mano (`src/run/executors/task-engines.ts:37-51`) y el único PTY está fijo a `opencode`
(`src/dashboard/terminal.ts:19`). Modelo: capa común configurable (como Orca: cualquier CLI de terminal) + adaptadores
ricos por CLI solo para streaming/sesiones/cuotas (como T3 Code). Fuera: chat con CLI genérico (necesita streaming).

- [x] **AT.11.2 — 🧠 Motor genérico: un CLI declarado en la config global corre tareas.** (cerrado 2026-10-26)
  Sin código por CLI, declarado en `~/.orchestos/config.yaml`. Comando + args con `{prompt}` (o stdin), `modelArgs` con `{model}` salvo modelo
  `default`, sin shell, diff por worktree; tokens y costo "no medido" en vez de $0. Solo config global: `clis` en la
  config de proyecto se ignora con aviso y Settings no lo escribe nunca. Solo rol Ejecutor (400 en los otros tres; fuera
  del chat). La vista del run nombra el CLI (`claude-plain · default`), no solo el modelo.
  Evidencia del cerebro: diff leído (motor, config, rol, persistencia por rutas del YAML); tsc 0, lint 0,
  `ui:fidelity:jsx` 0, `test:coverage` 2091/0; capturas de Settings (Ejecutor "Claude (genérico)", modelo "Default del
  CLI") y del run (`README.md` escrito, costo/tokens "no medido"). Sol cortado por "model at capacity" antes de su
  reporte: verificado entero por el cerebro.
  Gate en vivo: navegador real (Playwright) `custom-cli` 9/9, `tasks` 43/43, `model-routing` 18/18, `docs/done/evidence/AT.11.2-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, anexo) · Spec: docs/specs/AT.11.2.md
- [x] **AT.11.3 — 🧠 Settings: agregar, editar y quitar un CLI genérico desde la UI.** (cerrado 2026-10-26)
  Settings → Executor → "CLIs propios": lista con instalado/no instalado, formulario en línea (nombre, ID, comando,
  argumentos uno por línea, args de modelo, modelos) dentro de la barra de cambios sin guardar. `GET/PUT /api/clis`
  escribe solo el `config.yaml` global por rutas del documento, valida con la misma función que el registro y rechaza
  con motivo quitar un CLI asignado como Ejecutor o en una regla. La edición espera a que cargue Settings (la carga
  borraba el borrador). Límite anotado: el bloqueo por Ejecutor asignado mira la config efectiva del proyecto activo,
  no la de otros proyectos.
  Evidencia del cerebro: diff del handler leído; tsc 0, lint 0, `ui:fidelity:jsx` 0, `test:coverage` 2099/0; capturas
  del formulario y de la lista. Tres defectos del flujo nuevo (Sol no pudo correrlo: su sandbox no ejecuta `claude`)
  corregidos por Luna: espera de la fila de Runs, navegación sobrante, 400 esperado sin declarar.
  Gate en vivo: navegador real (Playwright) `custom-cli` 13/13, `tasks` 43/43, `model-routing` 18/18, `docs/done/evidence/AT.11.3-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, anexos) · Spec: docs/specs/AT.11.3.md

## Fuera de fase

**Fuera de scope declarado de H.9:** `opencode` (mismo criterio que H.8 — sin contrato
verificado); el sandbox de **escritura** de las tareas (worktrees ya lo cubren, es otro eje); la
frontera de red/SSRF (`src/dashboard/ssrf.ts` ya existe y no se toca); y cualquier cambio al
vault o a `~/.claude`/`~/.codex` de Carlos — el vault sigue alimentando el trabajo de desarrollo
igual que hoy, lo que se corta es que el **producto** lo herede por accidente.

### H.6 — Fuera de alcance de este bloque (anotado, no se toca)

- `src/cli.ts` tiene **2439 líneas y 63 edges** — god file evidente. Es lo segundo que critica
  un externo después del README, pero no es un hueco de harness. Va a `IDEAS.md` si Carlos lo
  aprueba; **no se refactoriza dentro del Bloque H**.
- Cobertura de líneas 62.91% y `src/skills/fetch.ts` en 0% de funciones. El trinquete ya sube
  solo; no abrir ítem salvo decisión explícita.
- Todo el gobierno del repo está en español con README en inglés. Decisión de producto, no
  defecto — no tocar sin que Carlos lo pida.

---

## Retirados

→ [11 ítems superados por UI.13/UI.14, retirados 2026-09-22](docs/done/retirados.md)

## Cerrados — evidencia archivada

→ [cerrados de AT](docs/done/bloque-AT.md)
→ [cerrados de DOC](docs/done/bloque-DOC.md)
→ [cerrados de H](docs/done/bloque-H.md)
→ [cerrados de I](docs/done/bloque-I.md)
→ [cerrados de R](docs/done/bloque-R.md)
→ [cerrados de S](docs/done/bloque-S.md)
→ [cerrados de ERP](docs/done/bloque-ERP.md)
→ [cerrados de CI](docs/done/bloque-CI.md)
→ [cerrados de CX](docs/done/bloque-CX.md)
→ [cerrados de MR](docs/done/bloque-MR.md)
→ [cerrados de GOV](docs/done/bloque-GOV.md)
→ [cerrados de UI](docs/done/bloque-UI.md)
→ [cerrados de CTX-GUARD](docs/done/bloque-CTX-GUARD.md)
→ [cerrados de SEC](docs/done/bloque-SEC.md)
→ [cerrados de OC](docs/done/bloque-OC.md)
→ [cerrados de UI / Sprint 30](docs/done/sprint-30.md)
→ [cerrados de Sprint 1](docs/done/sprint-01.md)
→ [cerrados de Sprint 2](docs/done/sprint-02.md)
→ [cerrados de Sprint 3](docs/done/sprint-03.md)
→ [cerrados de Sprint 4](docs/done/sprint-04.md)
→ [cerrados de Sprint 5](docs/done/sprint-05.md)
→ [cerrados de Sprint 6](docs/done/sprint-06.md)
→ [cerrados de Sprint 7](docs/done/sprint-07.md)
→ [cerrados de Sprint 8](docs/done/sprint-08.md)
→ [cerrados de Sprint 9](docs/done/sprint-09.md)
→ [cerrados de Sprint 10](docs/done/sprint-10.md)
→ [cerrados de Sprint 11](docs/done/sprint-11.md)
→ [cerrados de Sprint 12](docs/done/sprint-12.md)
→ [cerrados de Sprint 13](docs/done/sprint-13.md)
→ [cerrados de Sprint 14](docs/done/sprint-14.md)
→ [cerrados de Sprint 15](docs/done/sprint-15.md)
→ [cerrados de Sprint 16](docs/done/sprint-16.md)
→ [cerrados de Sprint 17](docs/done/sprint-17.md)
→ [cerrados de Sprint 18](docs/done/sprint-18.md)
→ [cerrados de Sprint 19](docs/done/sprint-19.md)
→ [cerrados de Sprint 20](docs/done/sprint-20.md)
→ [cerrados de Sprint 21](docs/done/sprint-21.md)
→ [cerrados de Sprint 22](docs/done/sprint-22.md)
→ [cerrados de Sprint 23](docs/done/sprint-23.md)
→ [cerrados de Sprint 24](docs/done/sprint-24.md)
→ [cerrados de Sprint 25](docs/done/sprint-25.md)
→ [cerrados de Sprint 26](docs/done/sprint-26.md)
→ [cerrados de Sprint 27](docs/done/sprint-27.md)
→ [cerrados de Sprint 28](docs/done/sprint-28.md)
→ [cerrados de Sprint 29](docs/done/sprint-29.md)
→ [decisiones de Carlos](docs/done/decisiones.md#entregable-rapido) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#ruta-erp) — Fase 2
→ [decisiones de Carlos](docs/done/decisiones.md#i-0-el-orden) — Fase 1
→ [decisiones de Carlos](docs/done/decisiones.md#sprint-30-decision) — Fase 1
