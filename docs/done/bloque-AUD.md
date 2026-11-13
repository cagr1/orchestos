# Cerrados de AUD — auditorías del código del 2026-11-10 y 2026-11-11

Informes con la evidencia `archivo:línea` de cada ítem: `docs/auditoria-2026-11-10.md` (AUD.1–AUD.10) y
`docs/auditoria-2026-11-11.md` (AUD.19–AUD.28: cada ítem es una clase de falla con varios sitios). AUD.11–AUD.18
salieron de la revisión de validadores del 2026-11-11. Todos cerrados desde 2026-11-13. Aparcados sin
hacer: `docs/done/aparcados-2026-11-12.md` (AUD.8, AUD.9, AUD.10, AUD.27, AUD.28).

- [x] **AUD.1 — El contrato se puede saltar con borrados, prefijos de tooling y rutas raras.**
  (abierto 2026-11-10) Llegan a la rama base sin pasar por él. `readWorktreeDiff` alimenta al contrato desde `git status --porcelain -uall`
  (`worktree-diff.ts:56`) y descarta (a) archivos borrados, `if (!existsSync(full)) continue` (`worktree-diff.ts:117`);
  (b) todo lo que empiece por `.impeccable/`, `.claude/`, `.codex/`, `.opencode/`, `.cursor/`, `.aider/` o termine en
  `.DS_Store` salvo que la tarea lo declare en `output[]` (`worktree-diff.ts:79-92`); (c) rutas con espacios o no ASCII:
  se parsea sin `-z` (`parseGitStatusPorcelain`, `worktree-diff.ts:15-29`), git las entrecomilla, `resolveProjectPath` /
  `existsSync` no encuentran la ruta con comillas y cae en (a). Pero el merge hace `git add -A -- . :!node_modules`
  (`sandbox.ts:205`): todo eso se commitea en la rama de la tarea y se integra a la base. Los 3 executors que usan
  `readWorktreeDiff` (`generic-cli.ts:64`, `opencode.ts:362`, `external.ts:754`) lo comparten. No verificado: si otra
  capa (QA, checks) cubre los borrados. Verificación: test con fixture git real que demuestre que lo commiteado en el
  merge es exactamente el conjunto que el contrato aprobó: un borrado no declarado, un `.claude/hooks/x` no declarado y
  un archivo `con espacio.txt` no declarado hacen fallar la tarea o quedan fuera del commit.
  Hecho: puerta del harness tras `enforceContract` con `listWorktreeChanges` contra el punto de bifurcación
  (`branch.<rama>.orchestosForkPoint`, guardado por `createWorktree`): cubre commits del worktree, staged, borrados y
  rutas con espacios (`-z`). Tooling sin commitear y artefactos del `setup_script` (`orchestosSetupArtifact`) = ruido;
  commiteados = violación. `mergeWorktreeBack` exige las rutas declaradas, rechaza lo commiteado no declarado, agrega
  solo lo declarado con `--literal-pathspecs` y descarta lo excluido antes del rebase. Los commits del worktree se
  conservan (estrategia `commit` intacta). `readWorktreeDiff` omite los artefactos del setup (antes los ejecutores CLI
  fallaban el contrato con cualquier `setup_script` que creara archivos).
  Gates del cerebro: `tsc`, `lint` (282, sin subir), `test:coverage` 2508 pass / 0 fail, 58/58 en los 6 archivos
  tocados. Revisión `qa` (otro proveedor): P1 pathspec glob y P2 rebase bloqueado por lo excluido → corregidos, con
  tests (`worktree-contract.test.ts:348`, `:362`). El spec se amplió 5 veces por casos que no cubría.
  Evidencia: `docs/done/evidence/AUD.1-live.json`.
  Ejecutado por: codex (criterio) · Spec: docs/specs/AUD.1.md

- [x] **AUD.2 — El producto ejecuta `git checkout -- runs-summary.json` en cualquier proyecto del usuario.**
  (abierto 2026-11-10) Es un arreglo específico de este repo (el hook que exporta `runs-summary.json`) metido en el
  producto: `sandbox-policy.ts:94` lo hace al empezar la corrida y `sandbox.ts:229` antes del merge (solo si la base
  está en el checkout); `sandbox-policy.ts:50` además lo excluye del listado de cambios sucios. En un proyecto ajeno con
  un `runs-summary.json` propio, se descartan sus cambios sin avisar. Verificación: test con un proyecto que tenga un
  `runs-summary.json` tracked y modificado: tras la corrida sigue modificado; el comportamiento actual queda detrás de
  una señal del propio repo (config o detección de `scripts/export-runs-summary.ts`).
  Hecho: campo `sandbox.derivedFiles` en `orchestos.config.yaml` (por defecto vacío; este repo declara
  `runs-summary.json`). Rutas validadas una vez en `parseSandboxConfig` (`load.ts`), literales, sin `.`/`..`/absolutas.
  `discardDerivedFiles` solo hace `checkout` de un archivo trackeado exacto (`ls-files -z` = la ruta), uno por uno; el
  chequeo de "sucio" parsea `status --porcelain -z`. Ningún literal `runs-summary` en `src` fuera de tests/comentarios.
  Gates del cerebro: `tsc`, `lint` (282, sin subir), `test:coverage` 2514 pass / 0 fail. Revisión `qa` (otro
  proveedor), 3 rondas: P1 directorio declarado descartaba todo, P1 doble normalización `%xx`, P2 rutas
  entrecomilladas → corregidos con test; slice(3) de la 1.ª línea y checkout múltiple que fallaba entero → los vio el
  cerebro. Queda (anotado en `NEXT.md`, falla hacia el lado seguro): un derivado sin trackear dentro de un directorio
  nuevo bloquea el sandbox (`?? build/`).
  Gate en vivo: sin navegador, clones reales del repo `docs/done/evidence/AUD.2-live.json`
  (declarado → `worktree` y limpio; no declarado → `DirtyTreeError` y el cambio se conserva). El campo vive solo en el
  yaml, sin control en Settings por decisión del spec, así que no hay superficie que abrir en el dashboard.
  Ejecutado por: codex (mecanico) · Spec: docs/specs/AUD.2.md

- [x] **AUD.3 — Una excepción inesperada en el harness no deja fila de run.** (abierto 2026-11-10) El `catch` general
  de `runTask` (`harness.ts:1061-1074`) devuelve `status: 'failed'`, `runId: ''` y `retryReason: unexpected: …` sin
  llamar a `insertRun` (los demás caminos sí lo hacen: `harness.ts:441`, `490`, `543`, `615`, `725`, `900`). La UI y el
  historial no ven ese fallo: rompe "o el porqué del fallo". Verificación: test que fuerce una excepción tras el inicio
  de la corrida y compruebe que existe una fila `runs` `failed` con el motivo.
  Hecho: el `catch` general inserta una fila `failed` con `result: unexpected: …` y devuelve su `runId`, salvo que la
  corrida ya tuviera fila (`runInserted`, marcado tras los 7 `insertRun`); el `insertRun` del catch no lanza. Sin
  `RunContext` o sin routing, `model`/`provider` = `unknown`. Tests: throw antes de `createRunContext` (gate de spec)
  y dentro de la cadena (`harness-evidence.test.ts`). Prueba en vivo por CLI con home temporal: tarea sin Reviewer
  asignado → fila `failed` con el motivo, `docs/done/evidence/AUD.3-live.json`. Gates del cerebro: `tsc`, `lint`
  (282, sin subir; la 1.ª versión lo subía y se corrigió), `test:coverage` 2516 pass / 0 fail. Revisión `qa`: sin
  defectos. La prueba en vivo destapó `model = ''` (corregido) y que `requireSpec` del yaml no se lee (anotado).
  Ejecutado por: codex (mecanico) · Spec: docs/specs/AUD.3.md

- [x] **AUD.4 — El fallo no se guarda como causa clasificada y las piezas de diagnóstico no llegan a la UI.**
  (abierto 2026-11-10) (a) La tabla `runs` no tiene columna de tipo de fallo (`migrate.ts:1320-1340` y los
  `ALTER TABLE runs` posteriores; solo `result`, `qa_reason`, `executor_reply`). (b) El clasificador determinista
  `src/run/executors/cli-failure.ts` lo usan los adaptadores de chat y el executor externo para generar avisos
  (`CliNotice`: `external.ts:2`, `chat-adapters.ts:11`, `codex-app-server.ts:10`, `step-event.ts:1`), no se persiste por
  run. (c) `src/agents/diagnose.ts` clasifica con LLM y describe `parse_error` como "could not be parsed as valid JSON"
  (`diagnose.ts:47`), pero el contrato usa delimitadores `<<<FILE:…>>>` (`contract.ts:37-41`, error en `contract.ts:55`).
  (d) `GET /api/tasks/:id/diagnose` y `POST /api/run/graph` existen (`server.ts:283`, `296`) y nada en
  `src/dashboard/app/src` los llama (el `diagnose?:` de `types/orchestos.ts:111` es solo un campo de tipo). Verificación:
  migración numerada con la causa clasificada; el clasificador determinista rellena la columna; la descripción de
  `parse_error` coincide con el contrato; la UI muestra la causa de un run fallido.
  **Cerrado 2026-11-11**: migración 38 `runs.failure_kind`, los 7 caminos de fallo de `harness.ts` la rellenan
  (`src/run/failure-kind.ts` para el proveedor), chip en la tarjeta del hilo y en Runs, `diagnoseTask` sin LLM cuando
  hay causa. Evidencia: `docs/done/evidence/AUD.4-live.json` (ui:gate `chat-retry-report` 27/27 con step AUD.4;
  `test:coverage` 2523/0). (d) queda para AUD.8.
  Gate en vivo: navegador (Playwright, `ui:gate chat-retry-report` 27/27), `docs/done/evidence/AUD.4-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio) + gpt-6-luna (mecanico, enmienda 2) · Spec: docs/specs/AUD.4.md

- [x] **AUD.5 — Tras cada tarea `done` por CLI, una llamada LLM oculta sobre los runs de todos los proyectos.**
  (abierto 2026-11-10, cerrado 2026-11-12 junto con AUD.21; cierre en AUD.21) En `orchestos task run` (`cli.ts:1303-1331`), al terminar `done` se lee `listRuns(20)`
  (`runs.ts:197-207`, sin filtro de proyecto) y, con 3 o más, `analyzeRunPatterns` hace una llamada al rol Auxiliar
  (`analyze/patterns.ts:144-150`) y puede crear propuestas de instinto. Gasto no declarado en `LIMITATIONS.md` y mezcla
  de proyectos en el análisis. Verificación: o se quita del camino de la tarea (queda en `--analyze`, `cli.ts:855`), o
  se filtra por proyecto y se declara en el resumen del run; test que cuente las llamadas al LLM de una tarea `done`.
  Sin delegación: se ejecutó dentro del spec de AUD.21 (caso 9); evidencia y ejecutor en AUD.21.

- [x] **AUD.6 — Los motores matan solo al hijo directo, no al grupo de procesos.** (abierto 2026-11-10, cerrado
  2026-11-12 junto con AUD.22; cierre en AUD.22)
  `external.ts:329-339` y `397` (`proc.kill('SIGTERM')`/`SIGKILL`), `opencode-server.ts:293-296` y `dashboard/terminal.ts:86-90`
  no lanzan `detached` ni matan `-pid`; solo `mcp/readonly.ts:619-624` mata el grupo (`process.kill(-proc.pid)`, lanzado
  con `detached: true`, `readonly.ts:652`). No verificado en vivo: si los CLIs de agente dejan nietos vivos tras un
  timeout o abort. Verificación: fixture con un CLI falso que lance un nieto; tras abortar la tarea no queda ese PID.
  Sin delegación: se ejecutó dentro del spec de AUD.22; evidencia y ejecutor en AUD.22.

- [x] **AUD.7 — Servidor local sin token: cualquier proceso local puede lanzar agentes.** (abierto 2026-11-10,
  cerrado 2026-11-12; GO de Carlos 2026-11-12) Cierre: `guardRequest` en el `fetch` de `startServer`, antes de
  `route()`: `Host`/`Origin` locales (403) y token en `/api/*` (401; el WebSocket de terminal lo lleva en `t`).
  Token persistente en `~/.orchestos/dashboard-token` (600), no por arranque: un reinicio no invalida la pestaña;
  rotar = borrar el archivo. La UI lo toma de `#t=` (URL que imprime `orchestos dashboard`), lo guarda en
  `localStorage` y lo agrega a cada fetch `/api/`; sin token, pantalla "Dashboard token required". Runner de
  ui-gates, `skill curate/fetch` y tests con servidor real lo pasan. qa: P2 (pegar la URL en pestaña bloqueada no
  recuperaba) → corregido + test. Visto y corregido: regresión de AUD.19, cuatro GET globales (`health`, `settings`,
  `setup`, `executor-modes`) exigían proyecto y el runner de ui-gates no arrancaba.
  Texto visible: "Dashboard token required" (identifica la credencial que falta; un ícono no explica el bloqueo).
  Texto visible: "Run orchestos dashboard and open the URL printed in the terminal." (el paso para recuperar acceso).
  Gates: tsc (server y app), lint, `build:app`, `test:coverage` 2612/0; ui-gates smoke, dev-terminal, user-profile.
  Gate en vivo: dashboard real con navegador Playwright y home aislado `docs/done/evidence/AUD.7-live.json`
  (sin token 401, Host/Origin ajenos 403, UI con `#t=` carga y limpia el hash, recarga sin hash sigue, WS sin `t` falla).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.7.md
  `isSameOrigin` devuelve `true` si la petición no trae `Origin` (`http.ts:95-107`); solo se aplica a POST/PUT/PATCH/
  DELETE (`server.ts:177-182`); los GET no se comprueban y no hay chequeo de `Host` (rebinding de DNS). El servidor
  escucha en `127.0.0.1` (`server.ts:615`), lo que cubre la red pero no a otros procesos del usuario ni a páginas de
  otros puertos en GET. Es además prerrequisito de cualquier empaquetado desktop (IDEAS #41). Verificación: token por
  arranque exigido en `/api/*` (o `Host` + `Origin` obligatorios), test de petición sin credencial = 403.

- [x] **AUD.11 — Validación a mano de `tasks.yaml` deja pasar valores inválidos.** (abierto y cerrado 2026-11-11)
  `src/tasks/schema.ts`: `output`/`input`/`depends_on` revisan cada elemento, `status`/`qa_verdict` el conjunto,
  `timeout_ms`/`expect_exit` exigen entero en rango, raíz no-mapping da error propio. Evidencia:
  `src/__tests__/tasks-schema-strict.test.ts` 22 pass; `bun run test:coverage` 2545 pass 0 fail; los 6 `tasks.yaml`
  reales de la máquina cargan igual antes y después; `qa` (Sol): sin defectos. La auditoría de los demás validadores
  abrió AUD.12–AUD.17 (lectura de un subagente; 1–5 contrastados por el cerebro en el código).

- [x] **AUD.18 — Sellar la validación de entradas externas: una puerta con Zod y un gate que solo deja bajar.**
  (abierto y cerrado 2026-11-11, GO de Carlos) `src/boundary/index.ts` (`check`, `parseJson`, `parseYamlText`,
  `readBody`, `badRequest`, `timeoutMs`; nunca lanza) sobre Zod 4.6.7, ya dependencia directa. Gate
  `scripts/boundary-budget.ts` en pre-commit: cuenta sobre el AST de TypeScript las llamadas a `JSON.parse`, `.json()`
  y `parse` de `yaml` (alias y namespace incluidos) fuera de `src/boundary/`, contra `scripts/boundary-budget.json`
  (63/64/13 = 140), que solo baja. Evidencia: 14 tests (boundary + gate); contraprueba `JSON.parse('1')` → exit 1;
  `bun run test:coverage` 2569 pass 0 fail. `qa` (Sol) halló 1 P1 (un transform que lanza escapaba) y 4 P2 de
  evasión del contador por regex; el P1 lo arregló el cerebro (fix chico, AT.22) con test, y el contador pasó a AST;
  el cerebro reprodujo los 10 casos de evasión. No cubre: alias de la función (`const p = JSON.parse; p(x)`). La
  migración de los 140 sitios va con AUD.12–AUD.17: cada ítem baja el presupuesto.
  Ejecutado por: gpt-6-luna (mecanico); fix del P1 Claude Opus 5.5 (cerebro) · Spec: docs/specs/AUD.18.md
  **Fuera de scope declarado:** `PLAN.md` registra el cierre y `.orchestos/feature-status.json` lo refleja.

- [x] **AUD.12 — Timeouts e iteraciones de config sin tope: un valor grande mata el run al instante o lo deja sin fin.**
  (abierto 2026-11-11, cerrado 2026-11-12) `setTimeout` con más de 2^31−1 ms, negativo o NaN dispara a 1 ms (reproducido en Bun). Entradas:
  `src/config/load.ts:298-302` (`external.timeoutMs`, solo `typeof`), `src/dashboard/handlers/config.ts:304-310` y
  `:380-386` (`externalTimeoutMinutes`, sin tope), `src/run/executors/cli-registry.ts:257-263`; destino
  `src/run/executors/external.ts:337-340`, `generic-cli.ts:26,40`. `agentic.maxIterations` (`load.ts:290-294`,
  `config.ts:297-303`) acepta `.inf`/`1e12`/`0`/`2.5` y es la única cota del loop (`src/providers/tool-call.ts:642`).
  Verificación: entero en rango en carga y en PUT, test por borde.
  Cierre (junto con AUD.15): `src/boundary/config-limits.ts` define los rangos de producto — timeout 60 s–24 h
  (1–1440 min), `maxIterations` 1–100 — y los aplica la carga YAML (fuera de rango → default con aviso), el PUT
  (400 con el rango) y `cli-registry`; los steppers de Settings llevan `max`. En el destino (`external.ts`,
  `generic-cli.ts`) `safeTimeoutMs` solo protege el rango técnico de `setTimeout` (1..2^31−1): el chat usa timeouts
  cortos legítimos (corrección del spec tras la 2.ª tanda; el ejecutor había espiado `setTimeout` en tests).
  Gates: tsc, lint, test:coverage 2782/0; qa sin defectos.
  Gate en vivo: navegador Playwright, `settings-shell` 23/23 (PUT 1441 → 400, stepper deshabilitado en 1440), `docs/done/evidence/AUD.12-settings-shell.json`.
  Ejecutado por: gpt-6.1-sol (criterio, 3 tandas) + claude-opus-5-5 (paso del ui-gate) · Spec: docs/specs/AUD.12.md

- [x] **AUD.13 — Seguridad: aprobación automática de comandos "read-only" de Codex sin mirar la ruta.** (cerrado
  2026-11-12 junto con AUD.23, mismo diff y evidencia `docs/done/evidence/AUD.23-live.json`) Cierre: `readOnly` exige
  `cwd`, `commandActions[].path` y rutas del comando dentro del proyecto; opciones con ruta, comillas o cualquier `$`
  → se pregunta (lista permitida de caracteres: sin `$ \ {} [] * ? ~`); el permiso "siempre" no aplica con `cwd` fuera; OpenCode con una entrada sin `file` → se pregunta.
  Spec compartido con AUD.23 (`docs/specs/AUD.23.md`, nunca commiteado).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.13.md
  (abierto
  2026-11-11) `src/run/executors/codex-approval.ts:54-66` marca `readOnly` solo por `commandActions[].type` y un regex;
  no cruza `cwd` ni la ruta de cada acción con `projectRoot`, y `src/run/approvals.ts:49` aprueba solo en `supervised`
  (p. ej. `cat ~/.ssh/id_rsa`). Igual en `src/run/executors/opencode-approval.ts:18-22`: entradas de `metadata.files` sin
  `file` se descartan. No verificado: que Codex clasifique así ese comando. Verificación: test con ruta fuera del
  proyecto → pide aprobación.

- [x] **AUD.15 — `effort` y `roles.*.agent` sin comprobar contra el conjunto permitido.** (abierto 2026-11-11, cerrado 2026-11-12)
  `src/dashboard/handlers/chat.ts:1380-1385` (`chatEffortLevelsForAgent` existe en `:157` y nadie lo llama),
  `tasks.ts:307-308`, `config.ts:188,231`; `src/config/load.ts:162-165` castea `obj.agent as RoleAgent`. Falla tarde, en
  la CLI, a veces tras crear el worktree.
  Cierre: `roles.*.agent` fuera de `BUILTIN_ROLE_AGENTS` (`claude`, `codex`, `opencode`, `api`) + CLIs configurados →
  ignorado con aviso en la carga; constante sin DB (importar `roleAgentIds()` abría la DB y rompía LIMP.3) y test
  anti-deriva contra `roleAgentIds()`. `effort` **no se valida**: decisión de Carlos 2026-09-22 (el nivel lo elige el
  usuario; OrchestOS no rechaza ninguno por engine). Mismo diff, gates y evidencia que AUD.12.
  Spec compartido con AUD.12 (`docs/specs/AUD.12.md`, nunca commiteado).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (paso del ui-gate) · Spec: docs/specs/AUD.15.md

- [x] **AUD.19 — Aislamiento entre proyectos: datos de un proyecto se leen, mezclan o borran desde otro.** (abierto y
  cerrado 2026-11-11) Cierre: reset, `run_steps` (migración 39, filas viejas con `project_id` null), costes, PDF,
  `CONTEXT.md`, reporte de tarea, sesión general, skills/specs y instintos, por proyecto; `requireProject` en las rutas
  de archivos/procesos (lista en la evidencia); `App.tsx` conserva el proyecto al cerrar agente, en pestañas y en Run.
  qa vuelta 1: `qa_reason` del chat solo por `task_id` → corregido + test. Vuelta 2: `/api/providers` sin proyecto
  lanza la sonda de la CLI sin `cwd` → descartado (sonda global, igual con proyecto). Visto en vivo y corregido: con
  cero proyectos `GET /api/config` daba 400 al cargar; GET config/providers no exigen proyecto (solo lectura).
  Gates: tsc, lint, `test:coverage` 2603/0; los 12 tests nuevos fallan sin el arreglo. Sin probar a ojo: las tres
  carreras de cambio de proyecto de `App.tsx` (cubiertas por el diff, no por gate en vivo).
  Gate en vivo: dashboard real con navegador Playwright y home aislado, dos proyectos `docs/done/evidence/AUD.19-live.json`
  (`project=none` 400 sin escribir en el cwd, reset de B conserva A, UI carga sin pageerror ni 4xx/5xx).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.19.md
  `db/reset.ts:16` borra los runs de todos; `db/run-steps.ts:69-80` identifica pasos solo por `task_id`;
  `handlers/project.ts:340` y `context/compress.ts:45` usan runs globales; `skills/compile.ts:8` y
  `handlers/specs.ts:26-37` asumen que el proyecto es el cwd/OrchestOS; `server.ts:166` da el cwd a `project=none`;
  `App.tsx:1053,845,1505` pierde o cruza el proyecto. Verificación: test con dos proyectos y el mismo id de tarea por
  cada sitio; `project=none` rechaza rutas de proyecto.

- [x] **AUD.20 — Pérdida de datos del usuario: escrituras que pisan sin resguardo.** (abierto y cerrado 2026-11-11)
  Cierre: 9 casos + 3 vueltas de qa (8 defectos corregidos: temporales ajenos/propios, rollback y limpieza que no
  tapan el error, permisos tras rename, versión de archivo `~N`, `..` en `validateTaskId`, detect por `readBody`).
  `specPath` acepta el mismo id que el dashboard salvo `..`. Gates: tsc, lint, `test:coverage` 2592/0; los tests
  nuevos fallan sin el arreglo. Queda: el YAML inválido de config se sigue reemplazando entero (`config.ts`, fuera
  de alcance).
  `detect`/`init` sobrescriben `AGENTS.md` (`cli.ts:84,104`, `handlers/project.ts:71`); `spec/store.ts:57-63` escribe
  en la ruta que diga el id del frontmatter (`../../README`); `spec/archive.ts:44-48,66,77` pisa, borra por sufijo y
  pierde campos; escritura parcial del contrato en cwd (`contract.ts:103`); PUT de config sin serializar
  (`handlers/config.ts:326,402`). Verificación: test por caso; el archivo previo se conserva o se pide confirmación.
  Gate en vivo: sin navegador, dashboard real por HTTP `docs/done/evidence/AUD.20-live.json` (home aislado; ninguna
  pantalla usa estas rutas): detect sin force 409 y AGENTS.md intacto; spec `foo..bar` 400; dos PUT de config
  simultáneos conservan ambos campos y el modo 600.
  Ejecutado por: gpt-6.1-sol (criterio) + mecanico + claude-opus-5-5 (fixes chicos)

- [x] **AUD.21 — Ejecución de tareas: errores aceptados como éxito y límites que no se aplican.** (abierto 2026-11-11,
  cerrado 2026-11-12 con AUD.5)
  `dryRun` después de crear worktree y correr `setup_script` (`harness.ts:190-197` vs `:283`); sandbox explícito sin
  rama corre en el cwd (`graph-runner.ts:472`, `harness.ts:196`); `is_error` de Claude sin mirar en tareas
  (`external.ts:733-755`); `task run --id` sale 0 al fallar (`cli.ts:1401`); `retry_count`, `--all` y límites del
  grafo (`cli.ts:1359,1411`, `graph-runner.ts:160,211,428,546`). Verificación: test por caso con CLI falso.
  Cierre: `dryRun` sin sandbox ni worktree; el grafo resuelve rama con `resolveSandboxMode(root, mode)`; `is_error`/
  `api_error` de Claude falla la tarea; `task run --id` sale 1 si no es `done` (id inexistente incluido); los fallos
  suben `retry_count`; `--all` lista lo no `done`, avisa el tope de 20 y para en `blocked`; límites de costo y tiempo
  antes de cada intento y cada tarea (`skipped_circuit_breaker`); `blocked` del harness sin reintento ni diagnose.
  AUD.5: borrada la llamada al Auxiliar tras `done`; `runs --analyze` filtra por proyecto como el dashboard. Fuera:
  `agentic.ts`, `providers/codex.ts`, `tool-call.ts` (resto del anexo). Gates: tsc, lint, `test:coverage` 2672/0;
  afectados 43/0 corridos por el cerebro. Gate en vivo: sin navegador (ninguna pantalla), CLI real con home y repo
  temporales, `docs/done/evidence/AUD.21-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio), diff revisado por claude-opus-5-5 · Spec: docs/specs/AUD.21.md

- [x] **AUD.22 — Procesos, streams y sesiones de motor.** (abierto 2026-11-11, cerrado 2026-11-12 con AUD.6) `opencode.ts:174-216` no drena
  `stderr`; timeouts sin SIGKILL (`codex.ts:199`, `external.ts:337`, `opencode.ts:182`, `checks.ts:225`); el `exit`
  de un app-server viejo rompe el nuevo (`codex-app-server.ts:142,1089`); quitar todas las herramientas no recrea el
  hilo de Codex (`codex-app-server.ts:746-751`); carrera al recuperar el candado (`file-lock.ts:77-84`). Va junto con AUD.6. Verificación: CLI falso que llena `stderr`, que
  ignora SIGTERM y que cambia de herramientas entre turnos.
  Cierre: `src/run/process-tree.ts` (`spawnTree` detached, `killTree` al grupo, `terminateTree` SIGTERM→SIGKILL a
  los 2 s también a nietos tras salir el líder, `killAllTrees` en la parada del dashboard y en `exit`) en claude,
  codex, opencode, checks, `opencode serve`, terminal, readonly y app-server; opencode drena stderr; error leyendo
  stdout termina proceso y timer (un fallo de `onStep` sigue sin abortar); el `exit` de un app-server viejo no toca
  al nuevo; quitar las herramientas reemplaza el hilo; el candado se recupera bajo `.recover` con token releído.
  Fuera: ruta `exec` de codex, sondas `--version` síncronas, spawn fallido de la terminal, caché del OCR. Gates: tsc,
  lint, `test:coverage` 2686/0. qa: 3 vueltas, 1 P2 corregido (nieto vivo si Bun salía antes del plazo). Gate en
  vivo: sin navegador, procesos reales con CLIs falsos, `docs/done/evidence/AUD.22-live.json`. Sin probar en vivo:
  cerrar una terminal real del dashboard con un nieto dentro.
  Ejecutado por: codex gpt-6.1-sol (criterio) + mecanico (enmienda) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.22.md

- [x] **AUD.23 — Seguridad: confinamiento por symlink y redacción de secretos.** (abierto 2026-11-11, cerrado
  2026-11-12 junto con AUD.13) Cierre: `realPathWithin` resuelve symlinks segmento a segmento (colgantes y encadenados
  con `..`) y lo usan explorer, git diff, specs, skills, `task.input` del prompt, `approvalPathWithin` y
  `resolveProjectPath`; symlink roto no tumba el listado; `redactSensitive` sin excepción de placeholder; PEM
  multilínea staged → `check-secrets` rojo; `spawn-trace` redacta args y stderr; `.env` 600 y atómico; puerto no
  estándar bloqueado también en IPv4. Fuera: destino de clon (lo elige el usuario; AUD.7 exige token). qa: 4 vueltas,
  5 P1 corregidos (symlink encadenado, `--file=/ruta`, comillas/`$HOME`, `\/etc`, comodines): la regla de Codex pasó a
  lista permitida de caracteres + realpath de cada argumento. Residual aceptado: `-fleak.txt` con symlink preexistente. Gates: tsc, lint, `test:coverage` 2635/0
  (+ tests afectados 100/0 tras las correcciones). Sin probar en vivo: las aprobaciones (requieren un turno de Codex
  real; cubiertas por tests con el código real del adaptador).
  Gate en vivo: dashboard real por HTTP con home aislado y symlinks hacia fuera, sin navegador (ninguna pantalla nueva) `docs/done/evidence/AUD.23-live.json`
  (árbol 200 con symlink roto, archivo/carpeta/git diff por symlink → 403 sin filtrar contenido).
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes chicos) · Spec: docs/specs/AUD.23.md
  `handlers/explorer.ts:44-48,120` confina lecturas solo por texto de ruta; `security/secrets.ts:47-50` no redacta un
  secreto que contenga `test`/`example`; `scripts/check-secrets.ts:19-26` no ve claves multilínea;
  `spawn-trace.ts:8-10,57` registra argumentos cortos y `stderr` crudos; symlink colgante pasa `path-policy.ts:63-72` y
  `approvals.ts:30-34`; `prompt.ts:43-47` lee inputs sin política de rutas; permiso "siempre" sin `cwd`
  (`approvals.ts:54`); `.env` sin 0600 (`settings-store.ts:62-67`); puerto sin validar en IPv4 (`ssrf.ts:105-112`). Verificación: test con symlink hacia fuera →
  403; secreto con `test` dentro → redactado; PEM staged → gate rojo.

- [x] **AUD.24 — Chat: turnos que quedan pendientes o no se pueden guardar.** (abierto 2026-11-11, cerrado 2026-11-12) Lease de 150 s sin
  renovar (`db/chat-turns.ts:45`, `handlers/chat.ts:1015`, sin contrastar la renovación); error antes del `catch`
  interno (`chat.ts:1944`); repetir un turno fallido da 500 (`chat.ts:1051`); adjunto ausente descartado en silencio
  (`chat.ts:1304`); recarga durante un turno pierde la actividad (`OrchestChatView.tsx:88`). Verificación: turno de
  más de 150 s con CLI falso queda guardado; ui-gate de recarga a mitad de turno.
  Cierre: `renewTurnLease` (no resucita un lease vencido) renovado cada lease/5 mientras vive el turno;
  `registerChatTurn` dentro del `try` y el `catch` externo marca `failed` (500) en vez de dejar `pending`; `requestKey`
  de un turno `failed` → 409 con el error guardado; adjunto ausente → 400 y turno `failed` antes del proveedor;
  `OrchestChatView` trabaja con `isWorking || thread.running` (Stop y actividad tras recargar) y `settleChatTurn`
  (`App.tsx`) recarga el hilo al terminar, con reintento 1/2/4 s y generación por envío local; POST correcto + GET
  fallido ya no restaura el borrador. También en AUD.24 (informe): `App.tsx:1374,1427`. Gates: tsc, lint,
  test:coverage 2693/0; qa 4 vueltas (3 P2 de la recarga corregidos); `docs/done/evidence/AUD.24-live.json`.
  Gate en vivo: navegador Playwright, `chat-stop` 24/24, `docs/done/evidence/AUD.24-chat-stop-result.json`.
  Con Claude real: recargar a mitad de turno devuelve Stop y la respuesta queda guardada.
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fixes de revisión) · Spec: docs/specs/AUD.24.md

- [x] **AUD.25 — UI que no hace lo que muestra.** (abierto 2026-11-11, cerrado 2026-11-12) `!comando` no ejecuta en Dev
  (`OrchestDevWorkspace.tsx:432`, `App.tsx` no pasa `onRunCommand`) ni en Chat (`OrchestChatView.tsx:310`); el kanban
  no tiene columna `failed` (`PlanBoardView.tsx:98-104`); `purgingProjectIds` no se limpia al terminar bien
  (`App.tsx:1094-1143`); regla "Executor model" inválida (`OrchestSettingsView.tsx:1048,3727`); Enter confirma con el foco en Cancel
  (`ConfirmDialog.tsx:38-42`); búsqueda del
  inspector (`OrcaRightInspector.tsx:297,576`). Verificación: en vivo en el dashboard, un step de ui-gate por caso.
  Cierre: `!cmd` en Dev se escribe en el PTY del tab terminal (lo reabre si la shell terminó); en Chat `!` es texto;
  columna `failed` en el kanban; "Plan" pide y limpia su resultado (solo escribe la última petición); la purga limpia
  `purgingProjectIds` en `finally`; "Executor model" válido para el agente Ejecutor; Enter sobre un botón no confirma;
  el árbol muestra carpetas con descendientes que coinciden y "contents" usa `GET /api/explorer/search` (`git grep`
  sin shell, tope 200, 5 s); Dev muestra todas las lecturas, ediciones y comandos; Instincts/Memory esperan el
  guardado; subidas abortadas al desmontar; del informe: consumo Codex por evento, cada `<script type="module">`
  por separado, clave de lenguaje normalizada en scaffold. Hallado al verificar (ya existía): tras purgar, `/branches`
  en vuelo daba 404; General se desmonta durante la purga y aborta la petición. Gates: tsc, lint,
  test:coverage 2706/0; qa 4 vueltas (4 P2 corregidos). Punto 4 en vivo solo "purga correcta": re-añadir el
  proyecto exige el selector nativo de carpetas; el set lo cubre el test unitario.
  Texto visible: "Bash" y "Copy output" (las mismas etiquetas que ya tenía la fila de comando, ahora una por comando).
  Gate en vivo: navegador Playwright, `aud25-ui` 14/14 y `project-delete` 12/12, `docs/done/evidence/AUD.25-ui-result.json`.
  Ejecutado por: gpt-6.1-sol (criterio, 2 tandas) + claude-opus-5-5 (fixes de revisión) · Spec: docs/specs/AUD.25.md

- [x] **AUD.26 — Gates que no pueden fallar.** (abierto 2026-11-11, cerrado 2026-11-12) `check-coverage.ts:14-16` da 100 % a un LCOV
  vacío; `check-test-assertions.ts:5` cuenta `expect(` en comentarios; `check-scope-lock.ts:48` ignora eliminaciones;
  `nightly-ui-gates.ts:322,228` sale 0 con todo rojo y su candado no se recupera; `adversarial-review.ts:775,796`
  avanza el SHA tras un fallo de infraestructura. Verificación: test rojo por cada caso antes del arreglo.
  Cierre: `evaluateCoverage` rechaza LCOV sin líneas o sin funciones; las aserciones se cuentan tras quitar
  comentarios y literales (escáner de un paso); scope-lock usa `--no-renames` sin filtro (borrados y origen de
  renombres); la nocturna sale 1 con algún flujo rojo y su candado guarda el PID y se recupera si el proceso murió;
  la revisión adversarial no avanza el SHA ni escribe `REVIEW.md` si un hallazgo acabó en `infrastructure-error` o
  `timeout` (todo o nada, sin duplicados); `context-adapters.ts` cancela el timer de cada lectura. Más AUD.9(a):
  `run.mjs` fija `ORCHESTOS_CHAT_TURN_TIMEOUT_MS=4000` cuando corre `chat-timeout` (solo; mezclado, error).
  Hallado al verificar: el flow exigía exactamente "2 s" pero el contador cuenta desde el envío y el aviso llega con
  `turn/started` (2,9 s en una corrida): carrera. Ahora comprueba que el contador sube entre dos lecturas.
  Gates: tsc, lint, test:coverage 2720/0; 20 tests nuevos rojos contra el código anterior; qa 2 vueltas (1 P2
  corregido: contador congelado pasaba).
  Gate en vivo: navegador Playwright, `chat-timeout` 9/9 sin la variable en el shell, `docs/done/evidence/AUD.26-chat-timeout-brain.json`.
  Ejecutado por: gpt-6.1-sol (criterio) + claude-opus-5-5 (fix del flow) · Spec: docs/specs/AUD.26.md

- [x] **AUD.14 — Salidas de LLM sin validar tumban el run.** (abierto 2026-11-11, cerrado 2026-11-13) `JSON.parse(tc.function.arguments)`
  sin `try` y `data.choices[0]` sin comprobar (`src/providers/tool-call.ts:216-220`, `:581-586`,
  `src/providers/openrouter.ts:118-124`); input de herramientas casteado en `src/run/executors/agentic.ts:194-200`
  (`write_file` sin `path` → `TypeError` en `path-policy.ts:21`, run abortado); borrador del planner
  (`src/dashboard/handlers/project.ts:268-283`); `frequency` declarada por el LLM en `src/analyze/patterns.ts:181-186`;
  campos de streams de CLI (`external.ts:612-623`, `opencode.ts:141-146`, `codex.ts:276-287`). Verificación: el error
  vuelve al modelo como resultado de herramienta, no aborta el run.
  Cierre: argumentos de herramienta con JSON roto o no-objeto vuelven al modelo como `[Error: invalid arguments…]`
  sin ejecutar (`parseToolArguments`, `tool-call.ts`); las cinco respuestas de proveedor pasan por `parseJson` con
  schema mínimo y lanzan `<Proveedor> returned an unexpected response: …` con el `error.message` del cuerpo; input
  de las herramientas agénticas validado por schema; `createToolRouter` convierte excepciones en resultado de error
  (relanza `AbortError`); resultado de Claude, eventos de OpenCode y tokens de Codex validados; `frequency` entero
  ≥ 0. `boundary-budget` 63/64 → 58/59. Fuera: el borrador del planner (`handlers/project.ts:278`) ya responde 502
  sin tumbar nada, y tocar `src/dashboard` exigía gate con navegador. Sin gate en vivo: no toca dashboard ni config.
  Gates: tsc, lint, test:coverage 2804/0; diff leído entero por el cerebro (otro proveedor).
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/AUD.14.md

- [x] **AUD.17 — Bodies y archivos con tipo incorrecto dan 500 en vez de 400; `.env` admite saltos de línea.**
  (abierto 2026-11-11, cerrado 2026-11-13) `POST /api/settings` (`src/dashboard/handlers/setup.ts:172-186` → `settings-store.ts:62-66`)
  escribe `"x\nOPENROUTER_API_KEY=…"` como línea nueva en `~/.orchestos/.env`. Resto: casts `as T` en `tasks.ts:276-295`,
  `instincts.ts:58-62,84-88,117`, `specs.ts:12-16`, `chat.ts:142-145,253,876`; body `null` en `run-graph.ts:75`,
  `system.ts:8`, `skills.ts:217`; `package.json.name` no string (`src/detect/manifest.ts:20`); línea JSON-RPC `null`
  (`src/mcp/server.ts:125,232`, `codex-app-server.ts:173-177`); precios de OpenRouter sin rango
  (`src/router/model-catalog.ts:166-172`).
  Cierre: bodies de settings, tasks (create/run/commit-run/bulk-delete), instincts, specs, chat, run-graph,
  system/reset y skills delete pasan por `readBody` con schema → 400 con causa; se conservan los mensajes 400
  previos. Settings rechaza valores con `\r`/`\n` y `writeEnv` también (defensa). `manifest.ts` acepta solo `name`
  texto; MCP responde `-32600` a mensajes no-objeto; codex-app-server trata `null` como respuesta inválida; precios
  negativos de OpenRouter = desconocido. `boundary-budget` 58/59 → 55/43.
  Gates: tsc, lint, test:coverage 2854/0; diff leído entero por el cerebro (otro proveedor).
  Gate en vivo: navegador Playwright, `settings-shell` 24/24 con HOME temporal, `docs/done/evidence/AUD.17-settings-shell.json`.
  Paso nuevo: key con salto de línea → 400 y keys intactas, key válida se guarda, tarea con `description: 5` → 400.
  Además `curl` contra el dashboard real, `docs/done/evidence/AUD.17-live.json` (`.env` intacto).
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/AUD.17.md

- [x] **AUD.16 — Skills: `validateSkill` devuelve el objeto crudo y el id de la URL no se cruza con el del contenido.**
  (abierto 2026-11-11, cerrado 2026-11-13) `src/skills/registry.ts:138-226` (`when_to_use: "x"` → `.map is not a function` en
  `src/skills/targets/_shared.ts:15`, rompe el prompt de QA); `src/dashboard/handlers/skills.ts:160-186`, `:593-622`;
  índice del registry casteado en `src/skills/fetch.ts:47-48,73`; el import ignora `review.status: rejected`.
  Cierre: `validateSkill` valida además `when_to_use`, `inputs_required`, `verifiers`, `anti_patterns`, `examples`
  (`title`/`input`/`output`), `language_targets` y `source`, y devuelve un objeto nuevo sin campos desconocidos; import,
  normalización, registry import y curate usan ese resultado. `PUT /api/skills/:id` con otro `id` → 400; registry
  import fija el id del contenido al de la URL (kebab-case o 400), consulta el índice (ausente 404, `rejected` 409);
  índice validado, entradas inválidas omitidas. `boundary-budget` response-json 43 → 42.
  Gates: tsc, lint, test:coverage 2875/0; diff leído entero por el cerebro (otro proveedor).
  Gate en vivo: navegador Playwright, `skills-library` 16/16 con HOME temporal, `docs/done/evidence/AUD.16-skills-library.json`.
  Además `curl` contra el dashboard real (id distinto → 400, archivo intacto), `docs/done/evidence/AUD.16-live.json`.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/AUD.16.md
