# Bloque SET — cerrados

## Archivado 2026-11-03 desde PLAN.md (DOC.5)

<a id="bloque-set-seccion-settings-al-nivel-de-los-ades---set--go-"></a>
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
