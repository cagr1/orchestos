# Auditoría completa — 2026-11-11

Pedida por Carlos: la del 2026-11-10 (`docs/auditoria-2026-11-10.md`) dejó sin leer el front, `chat.ts`,
`codex-app-server.ts`, `mcp/` y los gates, y no vio la clase "validación a mano" (AUD.11–18). Esta cubre todo `src/`,
`scripts/`, hooks y workflows. Ítems: `PLAN.md` § "Abiertos — auditoría 2026-11-11" (AUD.19–AUD.28).

## Método

- **Barridos mecánicos** (cerebro): tamaño y complejidad de funciones con el AST de TypeScript; `knip` con config
  temporal (archivos, exports y dependencias sin uso); grafo de imports sin tests; grep de SQL interpolado, `shell`,
  `catch` vacío, `as any`, rutas heredadas; scripts sin invocador.
- **Lectura completa por área** (4 corridas de `delegate analizar`, Sol, solo lectura): A servidor y handlers, B
  motores y ejecución, C frontend, D datos/config/CLI/gates. Salida literal en los anexos.
- **Contraste** (cerebro): cada hallazgo marcado ✔ se leyó en el código en esta sesión. Lo no marcado es reporte del
  auditor sin contrastar: quien escriba el spec lo comprueba antes.
- **No se hizo**: nada se ejecutó en vivo (ni dashboard ni suite). No se leyeron los tests salvo una muestra de 25,
  `components/ui/*` solo por inventario de exports, ni `docs/`.

## Veredicto

La validación de entradas no era el único hueco de clase. Hay cuatro más, cada uno con varios sitios:

1. **Aislamiento entre proyectos** (AUD.19). El producto nació de un solo proyecto (el cwd) y varias consultas y
   rutas siguen sin filtro de proyecto: datos de un proyecto se leen, mezclan o borran desde otro.
2. **Pérdida de datos del usuario** (AUD.20). Escrituras que pisan archivos sin resguardo ni atomicidad.
3. **Resultados aceptados que no debían** (AUD.21, AUD.26). El ejecutor acepta un error como éxito; varios gates no
   pueden fallar.
4. **Ciclo de vida de procesos y turnos** (AUD.22, AUD.24). Streams sin drenar, timeouts que no terminan, turnos de
   chat que quedan pendientes.

Limpio: 0 `catch {}` vacíos, 0 `@ts-ignore`, 0 `TODO/FIXME`, sin `shell: true`, SQL interpolado solo con nombres de
columna internos; la muestra de 25 tests no tiene aserciones vacías; `mergeWithDefaults` no pierde más campos que
`requireSpec`.

## Hallazgos por ítem

✔ = contrastado por el cerebro en el código.

### AUD.19 — Aislamiento entre proyectos

- ✔ `src/db/reset.ts:16` — `DELETE FROM runs` sin filtro: resetear un proyecto borra el historial de todos. Además
  falla por foreign key si hay `eval_trials`/`chat_turns` vinculados (`migrate.ts:86,172`, sin contrastar).
- ✔ `src/db/run-steps.ts:69-80` — pasos leídos y borrados solo por `task_id`; afecta `handlers/tasks.ts:563` y
  `chat-sessions.ts:179`. Igual `db/runs.ts:295` (costes por tarea).
- ✔ `src/dashboard/handlers/project.ts:340` — el PDF usa `listRuns(10)` global (`db/runs.ts:242`).
- ✔ `src/skills/compile.ts:8` — `DIST_DIR` es `process.cwd()/dist/skills`, no el proyecto pedido (`skills.ts:241`).
- ✔ `src/dashboard/handlers/specs.ts:26-37` — lanza `<proyecto>/src/cli.ts` sin esperar ni mirar la salida: en un
  proyecto ajeno responde `ok` y no crea la spec.
- ✔ `src/dashboard/server.ts:166` — `project=none` cae al cwd del servidor: `PUT /api/explorer/file?project=none`
  escribe ahí; `handlers/chat.ts:903` ofrece herramientas de proyecto.
- ✔ `App.tsx:1053` — `handleCloseAgent(agentId)` descarta el `proj.id` que entrega `ShellSidebar.tsx:414`.
- `handlers/tasks.ts:506` — acepta `sessionId` de otro proyecto como destino del reporte (`task-report.ts:145`).
- `handlers/chat.ts:1554,1129` — sesión general (`project_id` null) atribuye el run al proyecto del cwd.
- `src/context/compress.ts:45` — `CONTEXT.md` se comprime con los últimos runs globales.
- `src/cli.ts:789` — el run directo guarda `provider: openrouter` y `project_id: null` siempre.
- ✔ `src/instincts/store.ts:182-183` — `listApplicable` devuelve `[]` sin proyecto; `cli.ts:1931` crea instintos sin
  proyecto: nunca se aplican. Y aprobar sube la confianza a 0,7 con umbral 0,8 (`store.ts:165`, `schema.ts:158`).
- `App.tsx:1505` — Run durante el cambio de proyecto usa el proyecto nuevo con las tareas del anterior.
- `App.tsx:845` — `refreshProjectTabs` aplica una respuesta tardía de A sobre las pestañas de B.
- `src/usage/cli-transcripts-reader.ts:60,222` — caché por archivo aunque el parseo filtra por proyectos registrados.

### AUD.20 — Pérdida de datos del usuario

- ✔ `src/cli.ts:84-85,104-105` y `handlers/project.ts:71-72` — `detect`/`init` sobrescriben `AGENTS.md` y
  `context.json`; `context update` sí lo protege (`context-update-safety.test.ts`).
- ✔ `src/spec/store.ts:57-63` — `saveSpec` escribe en `<id del frontmatter>.md` sin validar: `id: ../../README`
  sobrescribe fuera de `.orchestos/specs` (seguridad).
- ✔ `src/spec/archive.ts:44-48` — destino por fecha+id con `writeFileSync`: archivar dos veces el mismo día pisa la
  primera. `:77` el serializador propio omite `capabilities`, `design`, `designApprovedAt` (sin contrastar).
- ✔ `src/spec/archive.ts:66` — borra por `endsWith('-<id>.md')`: pedir `foo` puede borrar `bar-foo`.
- `src/run/contract.ts:103` + `harness.ts:588` — en modo cwd, si falla la escritura del segundo archivo queda el
  primero modificado.
- `handlers/config.ts:326,402` — dos PUT simultáneos leen el mismo yaml: el último pisa al otro.
- `src/db/runs.ts:291`, `db/memory.ts:118` — borrados individuales fallan por foreign key (`migrate.ts:1439`).
- `src/db/memory.ts:195,212` — `resolveConflict` actualiza con el id de entrada y puede dejar el conflicto abierto.
- `handlers/task-run-reconcile.ts:67` — un `tasks.yaml` ilegible por un instante se trata como tarea eliminada.
- `src/cli.ts:1650` — regenerar una spec conserva `design: approved` y capacidades viejas.

### AUD.21 — Ejecución de tareas: resultados y límites

- ✔ `src/run/harness.ts:190-197` vs `:283` — `dryRun` se comprueba después de crear el worktree y correr
  `setup_script`.
- ✔ `src/run/graph-runner.ts:472` + `harness.ts:196` — sandbox explícito lleva `branch: null` y el harness solo crea
  worktree si hay rama: `--sandbox worktree` por el grafo corre en el cwd. Sin contrastar: qué `sandboxBranch` pasa
  `graph-runner.ts:501`.
- ✔ `src/run/executors/external.ts:733-755` — el camino de tareas no mira `is_error` (el de chat sí, `:612`).
- ✔ `src/cli.ts:1401-1404` — `task run --id` descarta el resultado: tarea fallida o inexistente sale con código 0.
- `src/cli.ts:1359` — los fallos ordinarios no suben `retry_count`: nunca llega a `failed_permanent`.
- `src/cli.ts:1411` — `--all` dice "All tasks done" con tareas `blocked`/`failed` y corta en 20 vueltas sin avisar.
- `src/run/graph-runner.ts:160,211,428` — límites de tiempo y presupuesto no se comprueban entre tareas ni intentos.
- `src/run/graph-runner.ts:546,562` — `blocked` del harness se trata como `failed`: reintenta y diagnostica.
- `src/run/executors/agentic.ts:182` — `run_check` prueba el archivo del disco, no el buffer; `:113` no deja leer un
  output propio que no esté en `input`.
- `src/providers/codex.ts:26,58` — ignora modelo, cwd y abort; `extractText` no reconoce `item.text`.
- `src/providers/tool-call.ts:173,507` — quita `openai/` también al llamar a OpenRouter.

### AUD.22 — Procesos, streams y sesiones de motor

- ✔ `src/run/executors/opencode.ts:174-216` — `stderr: 'pipe'` nunca se lee: tubería llena = cuelgue.
- `codex.ts:199`, `external.ts:337`, `opencode.ts:182`, `checks.ts:225` — timeout manda SIGTERM sin escalar a SIGKILL
  ni plazo para cerrar lectores.
- `codex.ts:229`, `opencode.ts:211` — excepción leyendo stdout libera el reader y deja proceso y timer vivos.
- `codex-app-server.ts:142,1089` — el `exit` de un proceso viejo rechaza las peticiones del nuevo.
- ✔ `codex-app-server.ts:746-751` — la recreación del hilo exige `input.threadConfig`: quitar todas las herramientas
  no lo recrea y conserva la config anterior (seguridad: modo `code` → `chat`).
- `codex.ts:503,593` — la ruta `exec` pierde `signal` y transcript.
- `checks.ts:322`, `mcp/readonly.ts:23` — sondas síncronas `--version` sin plazo.
- `src/dashboard/terminal.ts:69` — si falla el spawn, la `Bun.Terminal` queda abierta.
- `src/chat/ocr.ts:25` — promesa del worker rechazada queda en caché: el OCR falla hasta reiniciar.

### AUD.23 — Seguridad (además de AUD.7 y AUD.13)

- ✔ `handlers/explorer.ts:44-48,120` — lectura y listado confinan solo por texto de ruta; un symlink dentro del
  proyecto lee fuera. La escritura sí usa `realpath` (`:169`). Igual sin `realpath`: `git-changes.ts:90`, skills
  (`registry.ts:108,309`), specs (`store.ts:44`).
- ✔ `src/security/secrets.ts:47-50,84` — un secreto que contenga `test`, `example`, etc. se considera placeholder y
  no se redacta.
- ✔ `scripts/check-secrets.ts:19-26` — escanea el diff línea a línea: una clave PEM multilínea pasa.
- ✔ `src/run/executors/spawn-trace.ts:8-10,57` — solo oculta argumentos de más de 160 caracteres; `stderr` va crudo.
- `handlers/projects.ts:275,284` — `parentDir` del clon puede ser cualquier directorio del host.
- ✔ `handlers/explorer.ts:73` (sin contrastar la línea) — un symlink roto rompe todo el listado.

### AUD.24 — Chat: turnos que quedan mal

- `handlers/chat.ts:1015` + `db/chat-turns.ts:45` — lease de 150 s sin renovar: una respuesta que tarda más no se
  puede guardar. ✔ el valor (`DEFAULT_LEASE_MS = 150_000`); sin contrastar que no se renueve.
- `handlers/chat.ts:1944,1363` — error antes del `catch` interno deja el turno `pending`.
- `handlers/chat.ts:1051` + `chat-turns.ts:231` — repetir el `requestKey` de un turno fallido da 500.
- `handlers/chat.ts:1304` — adjunto inexistente se descarta en silencio.
- `OrchestChatView.tsx:88,201` — recargar durante un turno pierde el estado de actividad y el botón de detener.
- `App.tsx:1374,1427` — POST correcto + GET fallido se trata como envío fallido y restaura el borrador.
- `handlers/skills.ts:182` — `PUT /api/skills/a` con `id: b` (también en AUD.16).

### AUD.25 — UI que no hace lo que muestra

- ✔ `OrchestDevWorkspace.tsx:432` — `!comando` solo corre con `onRunCommand`, que `App.tsx` no pasa: consume el
  borrador y no ejecuta. ✔ `OrchestChatView.tsx:310` — Chat descarta `_isShellCmd` y lo envía al LLM.
- ✔ `PlanBoardView.tsx:98-104` — el kanban no tiene columna `failed`.
- ✔ `App.tsx:1094-1143` — `purgingProjectIds` solo se limpia en el `catch` (líneas 1118 y 1143).
- `OrchestSettingsView.tsx:1048,3727` — "Executor model" da `model: undefined` y `validRule` exige modelo.
- `PlanBoardView.tsx:313` — el Plan del kanban no pide ni limpia `explainResult`.
- `OrcaRightInspector.tsx:297,576` — la búsqueda oculta hijos si el padre no coincide; "contents" busca nombres.
- `OrchestDevWorkspace.tsx:622,458,473` — recorta herramientas (3 lecturas, 1 edición, 1 comando) sin ver el resto.
- `AgentComposer.tsx:575` — subidas sin abort al desmontar.
- `src/usage/cli-transcripts-reader.ts:130,144` — todo el consumo de una sesión Codex va a la última fecha y modelo.
- `src/skills/scaffold.ts:195` vs `targets/_shared.ts:56` — clave de lenguaje normalizada vs nombre literal.

### AUD.26 — Gates que no pueden fallar

- ✔ `scripts/check-coverage.ts:14-16` — `found === 0` cuenta como 100 %: un LCOV vacío pasa.
- `scripts/check-test-assertions.ts:5` — cuenta `expect(` en comentarios y strings.
- `scripts/check-scope-lock.ts:48` — no mira eliminaciones.
- `scripts/nightly-ui-gates.ts:322` — sale 0 aunque fallen todos los flujos; `:228` candado sin PID ni recuperación.
- `scripts/adversarial-review.ts:775,796` — un fallo de infraestructura avanza el SHA: esos commits no se revisan.
- `scripts/context-adapters.ts:362` — timers de lectura sin cancelar.

### AUD.27 — Código sin uso (amplía AUD.8)

- ✔ Archivos sin importador: `src/index.ts` (y `"module": "index.ts"` de `package.json` apunta a un archivo que no
  existe), `src/dashboard/app/src/data/orcaProjectData.ts`; más los tres de AUD.8.
- ✔ Scripts sin invocador: `scripts/live-r5-review.ts`, `live-read-boundary.ts`, `verify-read-audit.ts`,
  `verify-read-boundary.ts`, `ui-fidelity/capture.mjs` (uso manual histórico en `docs/done/bloque-R.md`).
- ✔ 77 exports y 104 tipos exportados que nada importa (`knip`): 29 de backend — entre ellos `loadContext`,
  `executeSearchMemory`, `getTurnByRequestKey`, `listByScope`, `updateRunCost`, `runMcpServer`,
  `registerCliChatAdapter`, `ExecutorLLMCallError`, `claudeContextMeasure`, `orchestosModelToCliModel` — y 48 de
  front, casi todos de `components/ui/*` y `lib/*-context.tsx` (copias de librería: `CardGroup/Media/Image/Eyebrow/
  Feature/Button`, `ThinkingStepDetails/Sources/Source/Image`, `IconProvider`, `ShapeProvider`, `useSurface`…). Varios
  solo pierden el `export`; borrar exige comprobar uso interno.
- ✔ `AgentComposer.tsx:1042` — bloque bajo `{false && …}`. Sin contrastar: diff siempre vacío y aprobación simulada
  inalcanzable en `OrchestDevWorkspace.tsx:147,897`; campo `stopping` de `chat-turn-registry.ts:4`.
- `src/db/migrate.ts:707,1429` — tablas `orchestration_runs`, `orchestration_leases` y cuatro columnas
  adversarial/refuter que solo aparecen en migraciones. `src/tasks/schema.ts:57,106` — `planner_model` sin consumidor.
- `src/run/executors/codex.ts:125` — `buildCodexPrompt` duplica `buildCliTaskPrompt` (`task-prompt.ts:3`).
- ✔ `src/dashboard/http.ts:58` — rama `/legacy` que solo devuelve 404. `config_version` se guarda y nada lo lee.
- Raíz, sin versionar e ignorados: `eng.traineddata`, `spa.traineddata`, `demo/`, `runs/`, `reports/`,
  `review-evidence/`, `private/`, `REVIEW.md`. No ensucian el repo; borrarlos del disco lo decide Carlos.
- Falso positivo descartado: `tailwindcss` y `@stryker-mutator/command-runner` (uso por CSS y por config).

### AUD.28 — Arquitectura: funciones que mezclan responsabilidades

Medido con el AST (líneas / ramas): `OrchestSettingsView` 3843/544, `App` 1982/412, `handleApiChat` 1122/274,
`runTask` 1045/176, `AgentComposer` 1022/204, `OrchestDevWorkspace` 836/147, `OrcaRightInspector` 731/79,
`OrchestChatView` 563/104, `route` 430/263, `turn` 338/93, `notification` 307/130, `handleApiConfigSet` 271/122.
100 funciones pasan de 80 líneas. Los cortes propuestos, con nombres y rangos de línea, están en los anexos
(líneas `[arquitectura]`).

Orden recomendado, por riesgo de lo que protegen y porque varios ítems de arriba caen dentro:

1. `runTask` (`harness.ts:139`) → `prepareRun`, `resolveExecutorBudget`, `executeRun`, `validateOutputs`, `verifyRun`,
   `finalizeRun`, `persistFailure`. Resuelve de paso el orden de `dryRun` (AUD.21). Antes: AUD.10 (mutación).
2. `handleApiChat` (`chat.ts:840`) → `resolveChatRequest`, `claimChatTurn`, `createTurnRecorder`, `settleTaskIntent`,
   `loadChatContext`, `prepareAttachments`, `executeChatTransport`. Junto con AUD.24.
3. `route` (`server.ts:174`) → `guardRequest` + tabla de rutas por dominio. Junto con AUD.7 (el token entra en
   `guardRequest`) y AUD.19 (`project=none`).
4. `App` → `useDevTabs`, `useThreadHydration`, `useTaskPolling`, `useProjectResources`, `useProjectActions`,
   `useChatActions`, `useTaskActions`, `AppShell`. Junto con las carreras de cambio de proyecto (AUD.19).
5. `OrchestSettingsView` → hooks de búsqueda, datos y autosave + una sección por archivo.

Regla: mover sin cambiar comportamiento, un corte por commit, con la suite y el ui-gate del área como red. Choca con
"prototipo = plantilla, `cp` + gate de className" en los componentes copiados del prototipo: decide Carlos si el
corte de `App`/`OrchestSettingsView` vale perder la comparación 1:1 con el prototipo.

### Lectura E — lo que A–D dejaron fuera (añadida el mismo día)

Al cerrar se comprobó que ~11.200 líneas de producto no estaban en el alcance de ningún auditor. E leyó el backend
restante (`src/run/*` fuera de executors, `ssrf.ts`, `settings-store.ts`, `ownership.ts`, `memory/judge.ts`…) y las
vistas restantes del front. Sus hallazgos se reparten en los ítems existentes:

- AUD.23 (seguridad):
  - ✔ `src/run/path-policy.ts:63-72` — recorre con `existsSync`, que da `false` para un symlink colgante: un output
    enlazado a un archivo exterior que aún no existe pasa la política y `contract.ts:103` lo crea fuera.
  - ✔ `src/run/approvals.ts:30-34` — misma causa: `withinProject=true` y auto-aprobación en `auto-edit` (`:51`).
  - ✔ `src/run/approvals.ts:54` — el permiso "siempre" de un comando no incluye el `cwd`.
  - ✔ `src/run/prompt.ts:43-47` — lee `task.input` con `join(projectRoot, file)` sin `resolveProjectPath`:
    `../privado.txt` va al proveedor.
  - ✔ `src/dashboard/settings-store.ts:62-67` — `~/.orchestos/.env` se crea sin modo 0600.
  - ✔ `src/dashboard/ssrf.ts:105-110` — una IPv4 pública retorna antes del chequeo de puerto (`:112`). Sin contrastar:
    `:125` valida DNS y `fetch` vuelve a resolver (rebinding).
- AUD.22: ✔ `src/run/file-lock.ts:77-84` — dos procesos ven al dueño muerto; el segundo `unlink` borra el candado
  que el primero acaba de tomar.
- AUD.25 (UI):
  - ✔ `components/common/ConfirmDialog.tsx:38-42` — Enter confirma aunque el foco esté en "Cancel": Enter sobre
    Cancel en "Delete this chat?" borra.
  - `InstinctsView.tsx:33`, `MemoryView.tsx:42` — cierran el formulario sin esperar el guardado: si falla, se pierde
    lo escrito.
  - `src/run/html-script-check.ts:143` — concatena `<script type="module">` independientes y rechaza HTML válido.
- AUD.27: `SpecsView.tsx:24` recibe `onDraftSpec` y no lo usa; `ViewStateFeedback.tsx:46` ignora `type`.
- AUD.28: cortes de `SkillsView`, `InstinctsView`, `MemoryView`, `SpecsView`, `CommandPalette` en el anexo F.

Sin evasión encontrada (E): traversal y rutas absolutas en `path-policy.ts`, `read-audit.ts`, correlación de
aprobaciones, `ownership.ts`, IPv4 decimal e IPv6 privado en `ssrf.ts`.

**Sigue sin leer**: el interior de `components/ui/*` (~4.500 líneas, copias de librería), `scripts/ui-gate/**`,
`scripts/ui-fidelity/**`, `tests/**` (~20.000 líneas) y los tests de `src/` fuera de la muestra de 25.

## Anexos — salida literal de los auditores

### Anexo A — servidor y handlers

    [P1] [falla] src/dashboard/handlers/system.ts:11; src/db/reset.ts:16 — el reset borra runs de todos los proyectos — 
    resetear A → desaparece también el historial de B — filtrar y ejecutar el reset en una transacción por proyecto.
    [P1] [falla] src/dashboard/handlers/project.ts:71 — detectar sobrescribe AGENTS.md sin preservar contenido — proyecto 
    con instrucciones propias → se pierden — conservar el archivo existente o exigir una sustitución explícita.
    [P1] [falla] src/dashboard/handlers/specs.ts:29 — busca el CLI dentro del proyecto seleccionado — proyecto externo 
    sin src/cli.ts → responde ok pero no genera la spec — resolver el CLI desde la instalación y observar su salida.
    [P1] [falla] src/dashboard/handlers/skills.ts:241; src/skills/compile.ts:8 — compilar ignora el root seleccionado — 
    compilar una skill de B desde el dashboard de A → escribe en dist/skills de A — pasar el directorio de destino al 
    compilador.
    [P1] [falla] src/dashboard/handlers/config.ts:326; src/dashboard/handlers/config.ts:402 — actualizar configuración 
    permite escrituras perdidas — dos PUT simultáneos sobre campos distintos leen el mismo YAML → el último elimina el 
    cambio anterior — serializar la operación completa de lectura y escritura.
    [P1] [falla] src/dashboard/handlers/chat.ts:1015; src/db/chat-turns.ts:45; src/db/chat-turns.ts:247 — el lease dura 
    150 segundos y no se renueva — preparación y respuesta superan ese plazo → no se puede guardar la respuesta ya 
    generada — renovar el lease mientras el turno siga activo.
    [P2] [falla] src/dashboard/handlers/chat.ts:1554 — el null de una sesión general cae al proyecto de respaldo — 
    conversación general → run atribuido al proyecto del cwd — distinguir sesión ausente de project_id null; corregir 
    también src/dashboard/handlers/chat.ts:1129.
    [P2] [falla] src/dashboard/handlers/chat.ts:1944 — los errores anteriores al catch interno dejan el turno pendiente — 
    falla refreshProjectContext en src/dashboard/handlers/chat.ts:1363 → se desregistra el controlador sin finalizar el 
    turno — finalizar también los errores no causados por cancelación.
    [P2] [falla] src/dashboard/handlers/chat.ts:1051; src/db/chat-turns.ts:231 — no se puede reproducir un turno fallido 
    — repetir su requestKey → 500 porque el fallo no guarda envelope — persistir y reproducir la respuesta de error con 
    su estado HTTP.
    [P2] [falla] src/dashboard/handlers/chat.ts:1304 — descarta adjuntos inexistentes silenciosamente — enviar un fileId 
    caducado o anterior al reinicio → el modelo responde sin el archivo — rechazar la petición indicando los adjuntos 
    ausentes.
    [P2] [falla] src/chat/ocr.ts:25 — conserva para siempre una promesa rechazada — falla la primera carga del worker → 
    todo OCR posterior falla hasta reiniciar — limpiar workerPromise cuando falle su creación.
    [P2] [falla] src/dashboard/terminal.ts:69 — no cierra la terminal si falla spawn — cwd desaparecido o ejecutable 
    inválido después de crear Bun.Terminal → queda el recurso abierto — cerrar la terminal al capturar el fallo de 
    lanzamiento.
    [P2] [falla] src/dashboard/handlers/explorer.ts:73 — un enlace roto rompe todo el listado — directorio con un symlink 
    colgante → statSync lanza fuera del catch — aislar el error de cada entrada o usar lstatSync.
    [P2] [falla] src/dashboard/handlers/skills.ts:182 — permite cambiar el id interno sin cambiar el archivo — PUT 
    /api/skills/a con id b → a.yaml aparece como b pero resolver b busca otro archivo — exigir que body.id coincida con 
    el id de la URL.
    [P2] [falla] src/dashboard/handlers/task-run-reconcile.ts:67 — confunde error de lectura con tarea eliminada — 
    tasks.yaml temporalmente malformado durante la reconciliación → borra el seguimiento durable — conservar la fila y 
    reintentar los errores de lectura.
    [P1] [seguridad] src/dashboard/handlers/explorer.ts:44; src/dashboard/handlers/explorer.ts:120 — las lecturas solo 
    confinan léxicamente — enlace dentro del proyecto hacia un archivo externo → GET devuelve su contenido; un enlace a 
    directorio permite listar fuera en src/dashboard/handlers/explorer.ts:61 — verificar realpath antes de leer.
    [P1] [seguridad] src/dashboard/handlers/tasks.ts:563; src/db/run-steps.ts:72 — los pasos se consultan únicamente por 
    task_id — A y B tienen una tarea con el mismo id → A recibe pasos de B — identificar y filtrar los pasos por proyecto 
    y corrida; afecta también src/dashboard/handlers/chat-sessions.ts:179.
    [P1] [seguridad] src/dashboard/handlers/tasks.ts:506 — acepta una sesión de cualquier proyecto como destino del 
    reporte — lanzar tarea de A con sessionId de B → inserta evidencia de A en B mediante 
    src/dashboard/handlers/task-report.ts:145 — comprobar pertenencia antes de lanzar.
    [P1] [seguridad] src/dashboard/server.ts:166; src/dashboard/handlers/chat.ts:903 — el scope general recupera 
    autoridad sobre el cwd — PUT /api/explorer/file?project=none modifica el cwd; POST /api/chat?project=none sin sesión 
    ofrece herramientas de proyecto — rechazar operaciones de proyecto cuando el scope sea none.
    [P1] [seguridad] src/dashboard/handlers/project.ts:340; src/db/runs.ts:242 — el resumen consulta runs globales — 
    descargar el PDF de A → incluye tareas, modelos y costos de B, renderizados en src/generators/summary-pdf.ts:109 — 
    consultar exclusivamente runs del proyecto seleccionado.
    [P3] [muerto] src/dashboard/handlers/chat-turn-registry.ts:4 — stopping se inicializa y escribe, pero nunca se lee — 
    detener un turno → el campo no interviene en ninguna decisión — eliminarlo.
    [P3] [arquitectura] src/dashboard/handlers/chat.ts:840 — handleApiChat mezcla validación, ownership, contexto, 
    adjuntos, tareas, persistencia y transportes — modificar un transporte obliga a recorrer 1122 líneas — extraer 
    resolveChatRequest (844–990), claimChatTurn (992–1056), createTurnRecorder (1059–1188 y 1519–1647), settleTaskIntent 
    (1206–1299), loadChatContext (1301–1454), prepareAttachments (1456–1517) y executeChatTransport (1657–1942).
    [P3] [arquitectura] src/dashboard/handlers/config.ts:134 — handleApiConfigSet mezcla validación, transformación y 
    edición del YAML — cada opción se procesa en dos representaciones → duplicación de lógica — extraer 
    validateConfigPatch (135–248), applyConfigPatch (250–315) y persistConfigPatch (317–403).
    [P3] [arquitectura] src/dashboard/server.ts:174 — route concentra seguridad, ownership y todos los dominios HTTP — 
    añadir una ruta depende del orden de cientos de condiciones → colisiones difíciles de detectar — extraer guardRequest 
    (178–203), routeRuns (205–216 y 247–255), routeTasks (256–301), routeSkills (332–385), routeChat (426–488) y tablas 
    de rutas para los bloques restantes hasta 596.
    Rutas de archivos: GET /api/explorer/tree y GET /api/explorer/file — no confinadas ante symlinks; PUT 
    /api/explorer/file — comprueba realpath y excluye .git — src/dashboard/server.ts:588; 
    src/dashboard/handlers/explorer.ts:44; src/dashboard/handlers/explorer.ts:169.
    Rutas de archivos: GET /api/git/diff — valida confinamiento léxico y pasa el path tras --; no comprueba realpath — 
    src/dashboard/server.ts:585; src/dashboard/handlers/git-changes.ts:90.
    Rutas de archivos: POST /api/tasks/:id/commit-run — acepta únicamente rutas relativas presentes en la lista de 
    archivos sucios — src/dashboard/server.ts:272; src/dashboard/handlers/tasks.ts:536.
    Rutas de archivos: GET /api/skills/:id y GET /api/skills/:id/export — pueden leer del proyecto, biblioteca global o 
    instalación; sin confinamiento realpath — src/dashboard/server.ts:359; src/dashboard/server.ts:362; 
    src/skills/registry.ts:108.
    Rutas de archivos: POST /api/skills, PUT /api/skills/:id y DELETE /api/skills/:id — destino léxico en skills/ del 
    proyecto; no comprueban symlinks — src/dashboard/server.ts:365; src/dashboard/server.ts:368; 
    src/dashboard/server.ts:371; src/skills/registry.ts:309.
    Rutas de archivos: POST /api/skills/:id/build — lee con los fallbacks anteriores y escribe en el cwd del servidor, no 
    en el proyecto seleccionado — src/dashboard/server.ts:374; src/dashboard/handlers/skills.ts:236; 
    src/skills/compile.ts:8.
    Rutas de archivos: POST /api/skills/registry/:id/import y POST /api/skills/pro/:id/import — destino léxico en el 
    proyecto, sin comprobar symlinks; pro puede leer de la instalación — src/dashboard/server.ts:351; 
    src/dashboard/server.ts:383; src/dashboard/handlers/skills.ts:597; src/dashboard/handlers/skills.ts:280.
    Rutas de archivos: PUT /api/skills/:id/phases — modifica la biblioteca global, no queda confinada al proyecto — 
    src/dashboard/server.ts:340; src/dashboard/handlers/skills.ts:397; src/dashboard/handlers/skills.ts:413.
    Rutas de archivos: POST /api/skills/library — escribe en la biblioteca global usando el id convertido del contenido 
    remoto — src/dashboard/server.ts:332; src/dashboard/handlers/skills.ts:342.
    Rutas de archivos: POST /api/specs/:id, POST /api/specs/:id/approve, POST /api/specs/:id/approve-design y GET 
    /api/specs/:id/lint — id validado; rutas léxicas bajo .orchestos/specs, sin comprobación realpath — 
    src/dashboard/handlers/specs.ts:74; src/dashboard/handlers/specs.ts:103; src/dashboard/handlers/specs.ts:125; 
    src/dashboard/handlers/specs.ts:141; src/spec/store.ts:44.
    Rutas de archivos: POST /api/specs/:id/archive, DELETE /api/specs/:id y POST /api/specs/bulk-delete — id validado; 
    archivo y archivo histórico bajo .orchestos/specs, sin comprobar symlinks — src/dashboard/handlers/specs.ts:151; 
    src/dashboard/handlers/specs.ts:166; src/dashboard/handlers/specs.ts:177; src/spec/archive.ts:36; 
    src/spec/archive.ts:68.
    Rutas de archivos: POST /api/projects/clone — parentDir puede ser cualquier directorio existente del host; crea un 
    destino exclusivo dentro de él — src/dashboard/server.ts:403; src/dashboard/handlers/projects.ts:275; 
    src/dashboard/handlers/projects.ts:284.
    Rutas de archivos: POST /api/chat — read_file comprueba confinamiento mediante resolveProjectPath; los archivos de 
    imagen se escriben fuera del proyecto en un temporal — src/dashboard/server.ts:480; 
    src/dashboard/handlers/chat.ts:684; src/chat/attachment-files.ts:28.
    Rutas de archivos: GET /app/dist/* — confinado mediante realpath al directorio de la aplicación, no al proyecto — 
    src/dashboard/server.ts:598; src/dashboard/http.ts:47; src/dashboard/http.ts:62.
    Leído entero: src/dashboard/server.ts:1, src/dashboard/http.ts:1, src/dashboard/terminal.ts:1, 
    src/dashboard/types.ts:1, src/dashboard/chat-cli-models.ts:1; todos los src/dashboard/handlers/*.ts y src/chat/*.ts, 
    incluidos sus tests.
    No leído: ninguno del alcance asignado; las dependencias externas al alcance solo se inspeccionaron donde se citan. 
    No verificado en ejecución: los escenarios anteriores; la consigna prohíbe suite y servidores 
    (/private/tmp/aud2/A.md:3).

### Anexo B — motores y ejecución

    [P1] [falla] src/run/contract.ts:103; src/run/harness.ts:588 — Escrituras parciales sin rollback en modo cwd — 
    escribe a.ts y falla al escribir b.ts → devuelve failed pero conserva a.ts modificado — validar todas las rutas antes 
    de escribir y restaurar el snapshot ante cualquier excepción.
    [P1] [falla] src/run/harness.ts:190; src/run/harness.ts:283 — dryRun ejecuta operaciones con efectos reales antes de 
    comprobarse — árbol con derivados modificados o setup_script → descarta cambios o ejecuta el script durante una 
    simulación — comprobar dryRun antes de preparar el sandbox.
    [P1] [seguridad] src/run/graph-runner.ts:472; src/run/harness.ts:196 — Sandbox worktree explícito termina usando cwd 
    — sandboxMode=worktree → branch=null → no crea worktree y escribe en el proyecto — resolver la rama y rechazar la 
    ejecución si no puede crear el aislamiento solicitado.
    [P1] [falla] src/run/executors/opencode.ts:178 — stderr queda sin consumir — OpenCode llena la tubería → se bloquea 
    aunque stdout siga pendiente — drenar ambos streams concurrentemente.
    [P1] [seguridad] src/run/executors/codex-app-server.ts:747 — Retirar todas las herramientas no recrea el hilo — turno 
    con MCP seguido de uno sin threadConfig → conserva la configuración anterior — comparar offerKey también cuando el 
    conjunto nuevo está vacío.
    [P1] [seguridad] src/run/executors/spawn-trace.ts:9; src/run/executors/spawn-trace.ts:57 — La supuesta redacción solo 
    oculta argumentos largos y deja stderr crudo — prompt corto con una credencial → aparece completo en el log — ocultar 
    argumentos por su función y aplicar redacción de secretos a stderr.
    [P1] [falla] src/run/executors/external.ts:741 — El ejecutor de tareas no rechaza is_error — Claude modifica los 
    outputs y después devuelve un resultado de error con costo → el harness puede aceptarlo — comprobar el estado 
    terminal antes de devolver los archivos, conservando el costo consumido.
    [P1] [falla] src/providers/codex.ts:58; src/run/executors/codex.ts:273 — extractText no reconoce item.text del 
    protocolo usado por el propio proyecto — respuesta item.completed/agent_message → devuelve JSONL crudo — reutilizar 
    el parser del ejecutor.
    [P2] [falla] src/providers/codex.ts:26 — Ignora modelo, raíz de ejecución y cancelación — se solicita otro 
    modelo/proyecto o se aborta → ejecuta en el cwd heredado con el modelo predeterminado y sigue esperando — reutilizar 
    el transporte común con cwd, modelo, timeout y signal explícitos.
    [P2] [falla] src/providers/tool-call.ts:173; src/providers/tool-call.ts:507 — Elimina openai/ también al llamar 
    OpenRouter — modelo openai/gpt-4o-mini → envía gpt-4o-mini, a diferencia de src/providers/openrouter.ts:85 — 
    normalizar únicamente para el proveedor OpenAI.
    [P2] [falla] src/run/executors/codex.ts:503; src/run/executors/codex.ts:593 — La ruta exec pierde la cancelación y el 
    historial — ejecución sin sesión o fallback de protocolo → signal y transcript no llegan al transporte — propagar 
    ambos en las dos rutas.
    [P2] [falla] src/run/executors/codex.ts:199; src/run/executors/external.ts:337; src/run/executors/opencode.ts:182; 
    src/run/checks.ts:225 — Timeout no garantiza terminar — hijo ignora SIGTERM → siguen esperando streams/exit 
    indefinidamente — añadir escalado a SIGKILL y un plazo independiente para cerrar lectores.
    [P2] [falla] src/run/executors/codex.ts:229; src/run/executors/opencode.ts:211 — Una excepción leyendo stdout solo 
    libera el reader — stream falla → quedan proceso y timer activos — cerrar proceso, streams y timer en un finally 
    común.
    [P2] [falla] src/run/executors/codex-app-server.ts:142; src/run/executors/codex-app-server.ts:1089 — El exit de un 
    proceso antiguo modifica el estado del nuevo — kill seguido de otro turn antes del exit anterior → failAll rechaza 
    solicitudes nuevas y borra child/ready — vincular los handlers a la instancia de proceso que los creó.
    [P2] [falla] src/run/graph-runner.ts:160; src/run/graph-runner.ts:211; src/run/graph-runner.ts:428 — Los límites no 
    se comprueban entre todas las ejecuciones — primera tarea consume el tiempo o un intento consume el presupuesto → 
    siguen las tareas de la tanda o los retries — comprobar límites antes de cada tarea, intento y diagnóstico.
    [P2] [falla] src/run/graph-runner.ts:546; src/run/graph-runner.ts:562 — No maneja el resultado blocked del harness — 
    bloqueo de roadmap → lo convierte en failed, reintenta y puede diagnosticarlo — preservar blocked como resultado 
    terminal.
    [P2] [falla] src/run/executors/agentic.ts:182 — run_check ignora los cambios del buffer — write_file modifica código 
    virtualmente y después ejecuta un check → prueba el archivo antiguo del disco — ejecutar los checks sobre una 
    materialización aislada del buffer.
    [P2] [falla] src/run/executors/agentic.ts:113 — Impide leer outputs propios si no figuran en input — input=[a], 
    output=[b], escribe b y trata de verificarlo → recibe “not in declared input” — permitir leer los archivos ya 
    presentes en el buffer.
    [P2] [falla] src/run/checks.ts:322; src/mcp/readonly.ts:23 — Sondas síncronas sin plazo — ejecutable se cuelga al 
    recibir --version → bloquea antes del timeout de la operación — acotar también las sondas.
    [P3] [muerto] src/run/executors/codex.ts:125; src/run/executors/task-prompt.ts:3 — buildCodexPrompt duplica 
    buildCliTaskPrompt — cualquier cambio del contrato requiere mantener dos copias idénticas — usar la función 
    compartida.
    [P3] [arquitectura] src/run/harness.ts:139 — runTask mezcla preparación, ejecución, validación, persistencia y 
    limpieza — cambiar una fase obliga a recorrer 1045 líneas — extraer prepareRun (164–281), resolveExecutorBudget 
    (303–381), executeRun (407–546), validateOutputs (549–723), verifyRun (725–1036), finalizeRun (1038–1121) y 
    persistFailure/cleanup (1122–1182).
    [P3] [arquitectura] src/run/executors/codex-app-server.ts:347 — notification mezcla diagnóstico, avisos, 
    aprobaciones, texto, uso y terminación — añadir un evento afecta un dispatcher de 307 líneas — separar 
    recordDiagnostics (348–362), handleAccountNotice (363–459), handleTurnLifecycle (460–492 y 602–651), handleText 
    (493–519 y 546–555), handleUsage (520–545) y handleCompletedItem (556–600).
    [P3] [arquitectura] src/run/executors/codex-app-server.ts:664 — turn mezcla reanudación, contexto, cancelación y 
    diagnóstico SQLite — cambios de transporte atraviesan toda la sesión — extraer openOrResumeThread (697–783), 
    buildTurnInput (784–789), startInterruptibleTurn (790–883), watchNativeRetries (884–942) y awaitTurnResult (943–996).
    [P3] [arquitectura] src/run/executors/opencode-server.ts:116 — runOpencodeServer mezcla proceso, HTTP, permisos y 
    traducción — cambiar el protocolo exige tocar toda la vida del hijo — extraer startServer (120–177), createApiClient 
    (178–194), createSession (195–219), readMessagePages (220–233), pollSession (234–287) y stopServer (288–301).
    [P3] [arquitectura] src/run/executors/agentic.ts:97 — run mezcla herramientas, almacenamiento virtual y llamada LLM — 
    cambiar la visibilidad del buffer afecta toda la ejecución — extraer createBufferedTools (98–201), 
    buildAgenticInstructions (203–229) y executeAgenticLoop (231–273).
    [P3] [arquitectura] src/run/graph-runner.ts:124 — runGraph mezcla selección, límites, ejecución y reporte — una tanda 
    larga elude comprobaciones intermedias — extraer selectReadyTasks (169–208), executeReadyBatch (210–270) y 
    buildGraphReport (280–312), con un guard común para los límites.
    [P3] [arquitectura] src/run/graph-runner.ts:329 — executeSingleTask mezcla dependencias, retries, persistencia y 
    diagnóstico — blocked cae en la rama genérica de fallo — extraer checkDependencies (376–420), runAttempt (428–509), 
    handleAttemptResult (511–579) y diagnoseAndBlockBranch (581–625).
    Procesos: Claude drena ambos streams; abort escala a SIGKILL y quita el listener; excepción manda SIGTERM; timeout 
    carece de escalado (src/run/executors/external.ts:313,328,395,399).
    Procesos: Codex app-server drena ambos streams; timeout/abort del chat solicitan interrupción, pero no matan el 
    servidor si esta falla; taskTurn sí ejecuta kill en finally 
    (src/run/executors/codex-app-server.ts:129,821,835,972,1077).
    Procesos: OpenCode server drena ambos streams, acota las esperas y aplica SIGTERM/SIGKILL en finally; no encontré una 
    ruta equivalente de cancelación en OpenCode exec (src/run/executors/opencode-server.ts:175,288; 
    src/run/executors/opencode.ts:168).
    Procesos: CLI genérico drena ambos streams y mata con SIGKILL al vencer; la promesa espera close; un error de stdin 
    distinto de EPIPE rechaza sin detener inmediatamente al hijo (src/run/executors/generic-cli.ts:37,41,48,55).
    Procesos: MCP readonly drena con tope, mata el grupo y cancela lectores al vencer; no recibe AbortSignal externo 
    (src/mcp/readonly.ts:637,672,680,701).
    Procesos: discovery/capability/health tienen timeout; setup tiene diez minutos y SIGKILL; los helpers síncronos de 
    git no tienen plazo ni abort (src/run/executors/cli-discovery.ts:19; src/run/executors/cli-registry.ts:357; 
    src/run/executors/cli-health.ts:34; src/run/sandbox.ts:158,40; src/run/executors/worktree-diff.ts:17).
    Leído entero: 
    src/run/executors/{agentic,chat-adapters,claude-approval,cli-discovery,cli-failure,cli-health,cli-health.test,cli-regi
    stry,cli-search-path.test,codex-app-server,codex-approval,codex,external,generic-cli,opencode-approval,opencode-server
    ,opencode,single-shot,spawn-trace,step-event,task-engines,task-prompt,types,worktree-diff}.ts:1; 
    src/run/{graph-runner,harness,sandbox,sandbox-policy,contract,checks}.ts:1; 
    src/providers/{anthropic,codex,index,openai,openrouter,tool-call}.ts:1; 
    src/mcp/{adapters,readonly,readonly.test,server,server.test}.ts:1; 
    src/router/{auto-route,classify,engine-cascade,model-catalog,opencode-catalog,pricing,role-runner}.ts:1.
    No leído: src/run/worktree-diff.ts no encontrado; la implementación está en src/run/executors/worktree-diff.ts:134.

### Anexo C — frontend

    [P1] [falla] src/dashboard/app/src/App.tsx:1505 — Ejecuta usando el proyecto actual, aunque todavía muestra tareas 
    del anterior — cambiar A→B y pulsar Run antes de cargar B, con IDs coincidentes, ejecuta otra tarea — asociar las 
    tareas a su proyecto y bloquear acciones durante el cambio.
    [P1] [falla] src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:432; src/dashboard/app/src/App.tsx:1933 — 
    El envío shell depende de onRunCommand, que App no proporciona — enviar !comando consume el borrador y deja working 
    sin ejecutar — conectar execCommand y finalizar el estado según su resultado.
    [P1] [falla] src/dashboard/app/src/components/chat/OrchestChatView.tsx:310 — Chat ignora isShellCmd — enviar !comando 
    lo manda al LLM como mensaje normal — ejecutar mediante el endpoint de consola o retirar ese modo de Chat.
    [P1] [falla] src/dashboard/app/src/components/chat/OrchestChatView.tsx:88; 
    src/dashboard/app/src/components/chat/OrchestChatView.tsx:201 — La actividad depende exclusivamente de isWorking 
    local — recargar durante un turno deja de consultar el streaming y no ofrece detenerlo — hidratar la actividad desde 
    el timeline del servidor.
    [P1] [falla] src/dashboard/app/src/App.tsx:1053; src/dashboard/app/src/components/layout/ShellSidebar.tsx:414 — 
    Archivar descarta el projectId que entrega el sidebar — cerrar un agente de otro proyecto sin hilo cargado termina 
    usando project=none y falla silenciosamente — recibir y conservar el proyecto explícito.
    [P2] [falla] src/dashboard/app/src/App.tsx:1143 — La marca purgingProjectIds solo se elimina si falla la purga — 
    volver a registrar y abrir ese ID deja bloqueadas las hidrataciones — retirar la marca también en finally.
    [P2] [falla] src/dashboard/app/src/App.tsx:845 — refreshProjectTabs aplica cualquier respuesta sin comprobar el 
    proyecto vigente — una respuesta lenta de A sobrescribe Memory/Specs/Skills/Instincts de B — cancelar al cambiar o 
    comprobar proyecto y generación antes de actualizar.
    [P2] [falla] src/dashboard/app/src/App.tsx:1374; src/dashboard/app/src/App.tsx:1427 — Confunde fallo de recarga con 
    fallo de envío — POST exitoso seguido de GET fallido retira el mensaje optimista y restaura el borrador para 
    reenviarlo — separar confirmación del envío y sincronización posterior.
    [P2] [falla] src/dashboard/app/src/components/settings/OrchestSettingsView.tsx:1048; 
    src/dashboard/app/src/components/settings/OrchestSettingsView.tsx:3727 — “Executor model” produce model undefined, 
    pero validRule exige modelo — seleccionar esa opción conserva la regla anterior o descarta la nueva — aceptar 
    herencia cuando el agente coincide con Executor.
    [P2] [falla] src/dashboard/app/src/components/plan/PlanBoardView.tsx:313 — Plan del kanban no solicita ni limpia 
    explainResult — abrir otra tarea muestra ausencia de resultado o el resultado anterior — compartir con Dry-Run el 
    controlador que consulta y reinicia el modal.
    [P2] [falla] src/dashboard/app/src/components/plan/PlanBoardView.tsx:98 — El kanban omite el estado failed — una 
    tarea failed cuenta en el total pero desaparece del tablero — añadir su columna o incluirla explícitamente en una 
    existente.
    [P2] [falla] src/dashboard/app/src/components/dev/OrcaRightInspector.tsx:297; 
    src/dashboard/app/src/components/dev/OrcaRightInspector.tsx:576 — La búsqueda filtra padres por nombre y contents no 
    modifica la búsqueda — buscar auth oculta src/auth.ts si src no coincide; buscar contenido sigue buscando nombres — 
    conservar ancestros de coincidencias e implementar la consulta por contenido.
    [P2] [falla] src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:622; 
    src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:458; 
    src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:473 — Recorta herramientas sin ofrecer acceso al resto — 
    cuatro lecturas, varias ediciones o varios comandos muestran solo tres lecturas, una edición y un comando por 
    resultado — renderizar todas las operaciones agrupadas.
    [P2] [falla] src/dashboard/app/src/components/common/AgentComposer.tsx:575 — Los uploads carecen de cleanup al 
    desmontar — cambiar de modo durante una subida deja la petición ejecutándose y pierde su borrador — persistir el 
    borrador y abortar sus controladores al desmontar.
    [P3] [muerto] src/dashboard/app/src/components/common/AgentComposer.tsx:1042; 
    src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:147; 
    src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:897 — Quedan selector bajo false, diff permanentemente 
    vacío y aprobación simulada inalcanzable — ninguna entrada puede activar esas ramas — eliminar bloques y sus 
    estados/controladores exclusivos.
    [P3] [muerto] src/dashboard/app/src/components/ui/card.tsx:1009; 
    src/dashboard/app/src/components/ui/thinking-steps.tsx:603; src/dashboard/app/src/components/ui/tooltip.tsx:253 — Sin 
    consumidores externos encontrados: CardGroup/CardMedia/CardImage/CardEyebrow/CardFeature/CardButton, 
    ThinkingStepDetails/Sources/Source/Image y TooltipPortalContainer — no forman parte de ningún flujo importador 
    encontrado — retirar exports y eliminar implementaciones únicamente si tampoco tienen uso interno.
    [P3] [muerto] src/dashboard/app/src/lib/icon-context.tsx:217; src/dashboard/app/src/lib/shape-context.tsx:162; 
    src/dashboard/app/src/lib/size-context.tsx:177; src/dashboard/app/src/lib/surface-context.tsx:17 — Sin consumidores 
    externos encontrados: IconProvider/useIcon, ShapeProvider/useShapeContext, useSizeContext/useTypeScale y useSurface — 
    sus mecanismos opcionales no se utilizan — podar esas interfaces conservando los hooks y valores internos consumidos.
    [P3] [arquitectura] src/dashboard/app/src/App.tsx:134 — Mezcla navegación, datos, ejecución y shell — las 
    actualizaciones tardías comparten estado entre proyectos — extraer useDevTabs (159–247), useThreadHydration 
    (340–563), useTaskPolling (581–695), useProjectResources (747–916), useProjectActions (1024–1186), useChatActions 
    (1188–1443), useTaskActions (1445–1634) y AppShell (1768–2114).
    [P3] [arquitectura] src/dashboard/app/src/components/settings/OrchestSettingsView.tsx:754 — Mezcla carga, guardado, 
    buscador y todas las secciones — cada sección comparte baseline y efectos con las demás — extraer useSettingsSearch 
    (1069–1189), useSettingsData (1253–1391), useSettingsAutosave (1425–1576), ProvidersSection (2677–3027), 
    RoutingSection (3296–3856), UsageSection (3915–4195), ProjectSection (4226–4491) y DangerDialogs (4494–4581).
    [P3] [arquitectura] src/dashboard/app/src/components/common/AgentComposer.tsx:175 — Mezcla catálogo, referencias, 
    cola, uploads y presentación — cambiar sesión conserva responsabilidades con ciclos distintos — extraer 
    useComposerModels (204–229, 289–359), useFileReferences (232–263, 400–465), useComposerQueue (469–559), 
    useComposerUploads (572–631) y ComposerControls (744–1193).
    [P3] [arquitectura] src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:191 — Mezcla transporte y 
    presentación por turno — el componente contiene además DevExchange de 529 líneas — extraer useDevTimeline (254–344), 
    useDevSend (392–438), ExchangeTools (562–893) y ExchangeMessages (503–560, 925–958).
    [P3] [arquitectura] src/dashboard/app/src/components/dev/OrcaRightInspector.tsx:139 — Mezcla tres fuentes y vistas 
    independientes — Files, Diff e History mantienen estado en el mismo componente — extraer useExplorerTree (160–217), 
    useGitChanges (219–252), ExplorerPane (295–371, 497–600), ChangesPane (373–443, 602–649) y HistoryPane (254–293, 
    651–866).
    [P3] [arquitectura] src/dashboard/app/src/components/dev/DevFilePanel.tsx:19; 
    src/dashboard/app/src/components/dev/DevDiffPanel.tsx:65; src/dashboard/app/src/components/dev/DevSessionTabs.tsx:14 
    — Mezclan consulta/estado y controles — guardar, refrescar o abrir menús modifica componentes completos — extraer 
    useFileDocument (45–147), useFileDiff (81–104) y useNewSessionPicker (35–82, 110–141); separar sus respectivos 
    cuerpos de visualización.
    [P3] [arquitectura] src/dashboard/app/src/components/chat/OrchestChatView.tsx:68; 
    src/dashboard/app/src/components/thread/TaskCard.tsx:129 — Mezclan acciones asíncronas con render de evidencia — 
    streaming, aprobaciones y undo tienen ciclos independientes — extraer useChatTimeline (200–257), useChatSend 
    (304–331), useTaskUndo (173–227), TaskDiagnosis (284–337) y TaskApprovals (413–482).
    [P3] [arquitectura] src/dashboard/app/src/components/plan/PlanBoardView.tsx:52; 
    src/dashboard/app/src/components/runs/RunsEvidenceView.tsx:38 — Mezclan selección/filtros con varias vistas completas 
    — kanban/tabla y lista/detalle divergen en comportamiento — extraer PlanKanban (230–338), PlanTable (340–432), 
    TaskExplainDialog (435–525), RunDetail (88–379) y RunsList (381–509).
    [P3] [arquitectura] src/dashboard/app/src/components/layout/ShellSidebar.tsx:48; 
    src/dashboard/app/src/components/layout/ShellStatusBar.tsx:117; 
    src/dashboard/app/src/components/layout/NewAgentSelectorModal.tsx:29 — Mezclan navegación, menús y carga — diálogos y 
    paneles dependen del estado de sus contenedores — extraer ChatSidebar (126–217), ProjectSidebar (219–434), 
    QuotaDetails (246–343) y useAgentChoices (38–89).
    [P3] [arquitectura] src/dashboard/app/src/hooks/use-fluid-hover.ts:246; 
    src/dashboard/app/src/components/thread/ThreadStatesSheet.tsx:208 — Concentran medición/interacción y múltiples 
    fixtures, respectivamente — mantenerlos exige recorrer responsabilidades independientes — separar 
    useHoverMeasurements (301–451, 550–570), useHoverPointer (453–543), MessageSamples (230–276), ThinkingSamples 
    (278–317) y ComposerSamples (323–340).
    Leído entero: código de producción asignado en src/dashboard/app/src/: App.tsx; 
    components/settings/OrchestSettingsView.tsx; components/common/AgentComposer.tsx; 
    components/{dev,chat,thread,runs,plan,layout}/*.{ts,tsx}; api/*.ts, hooks/*.{ts,tsx}, lib/*.{ts,tsx} y types/*.ts, 
    excluyendo archivos de pruebas.
    No leído: archivos *.test.ts del alcance; implementación completa de components/ui/* —solo inventario de exports y 
    referencias—; resto del repositorio fuera del alcance. No encontré un módulo UI completo sin importadores; sí los 
    exports enumerados.

### Anexo D — datos, config, CLI y gates

    [P1] [seguridad] src/spec/store.ts:61 — la escritura confía en el id del frontmatter — aprobar una spec con id 
    ../../README sobrescribe README.md — validar id, correspondencia con el archivo y confinamiento de ruta.
    [P1] [falla] src/cli.ts:84; src/cli.ts:105 — detect e init sobrescriben AGENTS.md sin protección — ejecutarlos sobre 
    un proyecto con reglas manuales las destruye — aplicar el mismo resguardo que context update.
    [P1] [falla] src/spec/archive.ts:77 — el serializador de archivo omite capabilities, design y designApprovedAt — 
    archivar elimina esos metadatos — compartir el serializador de src/spec/store.ts:146.
    [P1] [falla] src/spec/archive.ts:48 — el destino solo distingue fecha e id y permite sobrescritura — archivar dos 
    versiones del mismo id durante el mismo día destruye la primera — usar destinos únicos y creación exclusiva.
    [P1] [falla] src/spec/archive.ts:66 — el borrado compara sufijos ambiguos — pedir foo puede borrar una spec bar-foo — 
    identificar exactamente el id archivado.
    [P1] [falla] src/db/reset.ts:16; src/db/migrate.ts:86; src/db/migrate.ts:172 — reset borra runs todavía referenciados 
    — con eval_trials o chat_turns vinculados falla por foreign key — resolver las dependencias dentro de una transacción.
    [P1] [falla] src/db/runs.ts:291; src/db/memory.ts:118; src/db/migrate.ts:1439 — los borrados individuales tampoco 
    resuelven referencias — borrar un run vinculado o una memoria con conflictos produce error SQL — eliminar 
    dependencias o devolver un bloqueo explícito.
    [P1] [falla] src/cli.ts:1931; src/instincts/store.ts:183 — instinct add y propose crean registros sin proyecto, pero 
    listApplicable excluye todos los globales — la regla creada por CLI nunca llega al harness — asignar el proyecto o 
    implementar aplicación global coherente.
    [P1] [seguridad] scripts/check-secrets.ts:21; src/security/secrets.ts:27 — el escaneo staged fragmenta una expresión 
    multilínea — una clave privada PEM añadida en varias líneas pasa ese chequeo — analizar los blobs staged completos.
    [P1] [seguridad] src/security/secrets.ts:49; src/security/secrets.ts:84 — cualquier secreto que contenga test, 
    example u otra palabra exenta evita la redacción — una credencial real con esa subcadena queda visible — limitar las 
    excepciones a placeholders completos reconocidos.
    [P2] [falla] src/cli.ts:1402 — task run descarta el resultado fallido — --id inexistente o tarea fallida termina con 
    salida exitosa — traducir el resultado a process.exitCode.
    [P2] [falla] src/cli.ts:1359 — los fallos ordinarios no incrementan retry_count — repetir una tarea desde cero nunca 
    alcanza failed_permanent — persistir el contador de cada intento fallido.
    [P2] [falla] src/cli.ts:1411 — --all equipara ausencia de pending con éxito y limita silenciosamente a veinte vueltas 
    — tareas blocked/failed producen “All tasks done”, o quedan pendientes tras el límite — comprobar todos los estados y 
    reportar terminación incompleta.
    [P2] [falla] src/cli.ts:1650 — regenerar el cuerpo conserva aprobación de diseño y capacidades anteriores — una spec 
    rediseñada puede seguir design: approved y retener capacidades obsoletas — invalidar el diseño y reemplazar también 
    las capacidades ausentes.
    [P2] [falla] src/instincts/store.ts:165; src/instincts/schema.ts:158 — aprobar una propuesta eleva 0,6 a 0,7, por 
    debajo del umbral 0,8 — una aprobación humana sigue sin habilitarla — alinear aprobación y umbral de aplicación.
    [P2] [falla] src/db/run-steps.ts:79; src/db/runs.ts:295 — la identidad de tarea omite proyecto — dos proyectos con t1 
    mezclan costes e historial; iniciar uno borra los pasos del otro — incluir proyecto o run en consultas y claves.
    [P2] [falla] src/context/compress.ts:45 — CONTEXT.md usa los últimos runs globales — comprimir A incorpora prompts de 
    B — consultar por project.id.
    [P2] [falla] src/usage/cli-transcripts-reader.ts:60; src/usage/cli-transcripts-reader.ts:222 — la caché depende solo 
    del archivo, aunque el parser filtra por proyectos — registrar o quitar un proyecto conserva inclusiones/exclusiones 
    anteriores — cachear datos sin filtrar o incluir las raíces en la clave.
    [P2] [falla] src/usage/cli-transcripts-reader.ts:130; src/usage/cli-transcripts-reader.ts:144 — todo el acumulado 
    Codex recibe la última fecha y modelo — una sesión de varios días/modelos concentra artificialmente consumo y precio 
    — acumular incrementos por evento, fecha y modelo.
    [P2] [falla] src/db/memory.ts:195; src/db/memory.ts:212 — resolveConflict acepta ids de entrada al buscar, pero 
    actualiza el conflicto usando ese mismo id — puede cambiar contenido y devolver false dejando el conflicto abierto — 
    recuperar y actualizar el id real del conflicto atómicamente.
    [P2] [falla] src/cli.ts:789 — el run directo persiste siempre provider: openrouter y project_id: null — ejecutar con 
    otro proveedor pierde atribución — registrar proveedor y proyecto efectivos.
    [P2] [falla] scripts/check-scope-lock.ts:48 — el scope-lock excluye eliminaciones — borrar un archivo fuera del scope 
    no se comprueba — incluir D en el filtro.
    [P2] [falla] scripts/check-coverage.ts:15 — cero elementos medidos equivale a 100 % — un LCOV vacío supera ambos 
    umbrales — exigir métricas presentes y denominadores positivos.
    [P2] [falla] scripts/check-test-assertions.ts:5 — se cuentan comentarios y strings como aserciones — un test vacío 
    con un comentario expect(...) supera el control — inspeccionar llamadas reales mediante AST.
    [P2] [falla] scripts/nightly-ui-gates.ts:322 — nightly:run devuelve éxito aunque fallen todos los flujos o haya 
    suspensión — un consumidor del exit code interpreta verde — devolver también el estado efectivo de la corrida.
    [P2] [falla] scripts/nightly-ui-gates.ts:228 — el candado no tiene dueño ni recuperación — SIGKILL deja running y 
    bloquea las noches siguientes — guardar PID y recuperar únicamente candados huérfanos.
    [P2] [falla] scripts/adversarial-review.ts:775; scripts/adversarial-review.ts:796 — los fallos de infraestructura se 
    descartan y el SHA avanza — una corrida sin sandbox deja esos hallazgos sin revisar permanentemente — conservarlos 
    pendientes sin avanzar su cobertura.
    [P2] [falla] scripts/context-adapters.ts:362 — cada lectura crea un timeout que no se cancela — respuestas rápidas 
    dejan timers activos hasta ocho segundos — limpiar el timer y liberar el reader al terminar.
    [P2] [falla] src/skills/scaffold.ts:195; src/skills/targets/_shared.ts:56 — scaffold genera claves de lenguaje 
    normalizadas, pero el renderer busca el nombre detectado literal — TypeScript busca TypeScript y omite typescript — 
    compartir una normalización.
    [P3] [muerto] src/db/migrate.ts:707; src/db/migrate.ts:1429 — orchestration_runs, orchestration_leases y las cuatro 
    columnas adversarial/refuter solo aparecen en migraciones dentro del código de producción — nuevas DB siguen 
    incorporando estructuras sin consumidores — retirarlas mediante migración que preserve cualquier histórico.
    [P3] [muerto] src/tasks/schema.ts:57; src/tasks/schema.ts:106 — planner_model se declara y carga sin consumidores de 
    producción encontrados — configurarlo no cambia ejecución — retirar el campo o implementar su contrato.
    [P3] [arquitectura] src/cli.ts:460 — el callback mezcla DAG y ejecución directa — ambos caminos concentran políticas 
    distintas — extraer runGraphCommand (482–590), buildDirectRunPrompt (592–649) y executeDirectRun (651–812).
    [P3] [arquitectura] src/cli.ts:1117 — task run mezcla selección, ejecución y persistencia — sus variantes divergen en 
    estados y errores — extraer selectTasks (1401–1446), prepareTaskExecution (1168–1244), invokeTask (1246–1265) y 
    persistTaskOutcome (1270–1398).
    [P3] [arquitectura] src/cli.ts:1950 — setup mezcla sondas y presentación — obtener resultados exige atravesar 
    impresión y colores — extraer collectSetupChecks (1951–2070) y printSetupChecks (2071–2104).
    [P3] [arquitectura] src/db/migrate.ts:1304 — runMigrations mezcla baseline, reparaciones y ejecución versionada — 
    cada arranque recorre responsabilidades históricas — separar ensureBaselineTables (1307–1391), ensureLegacyColumns 
    (1393–1433), ensureSupportingTables (1435–1555) y finalizeMigrationLedger (1557–1577).
    [P3] [arquitectura] scripts/adversarial-review.ts:648 — main mezcla selección, proveedor, validación y publicación — 
    fallos parciales terminan compartiendo avance de SHA — extraer prepareReview (660–713), requestVerifiedFindings 
    (715–761) y verifyAndPublishFindings (762–798).
    [P3] [arquitectura] scripts/ui-fidelity/capture.mjs:168 — runTarget mezcla navegación y tres grupos de captura — un 
    fallo intermedio evita el cierre final del navegador — separar openTarget (168–188), captureChatAndDev (190–279), 
    captureSettings (281–314), captureProjectTabs (316–338) y cierre en finally.
    No encontré otro campo omitido por mergeWithDefaults además del requireSpec ya conocido; clis se incorpora por 
    separado (src/config/schema.ts:81; src/config/load.ts:57; src/config/load.ts:70). config_version se conserva, pero no 
    encontré un consumidor operativo de versiones (src/config/load.ts:71).
    No encontré invocadores automáticos de live-r5-review.ts, live-read-boundary.ts, verify-read-audit.ts, 
    verify-read-boundary.ts ni ui-fidelity/capture.mjs. No los doy por muertos: los lectores/verificadores tienen 
    referencias de uso manual histórico (docs/done/bloque-R.md:68; docs/done/bloque-R.md:99); capture también tiene 
    referencia histórica (docs/done/sprint-30.md:1691).
    Muestra de 25 tests: no encontré aserciones tautológicas ni casos que solo prueben su mock. Casos leídos, bajo 
    src/__tests__/: cli-dashboard-paths.test.ts:5 (resuelve bundle); curator-prompts.test.ts:5 (campos de hardening); 
    db-query-limits.test.ts:5 (límites inválidos); failure-kind.test.ts:8 (clasifica errores); 
    openrouter-affordable-tokens.test.ts:9 (extrae saldo); sqlite-path.test.ts:7 (aísla DB); orchestos-home.test.ts:14 
    (resuelve home); chat-task-bar-instrumentation.test.ts:13 (persiste click); coverage-gate.test.ts:29 (vacío cuenta 
    como cubierto, relacionado con el hallazgo); claude-resume.test.ts:14 (reanuda sesión); 
    chat-rejected-tasks.test.ts:12 (tarea eliminada); config-legacy-orchestration.test.ts:12 (ignora clave antigua); 
    harness-retry.test.ts:20 (inyecta fallo previo); tool-output-cap.test.ts:17 (trunca salida); specs-delete.test.ts:34 
    (borra archivo); codex-provider.test.ts:42 (comprueba invocación y aislamiento); instinct-apply-worktree.test.ts:29 
    (resuelve proyecto); clarify.test.ts:19 (detecta ambigüedad); compute-file-diffs.test.ts:7 (archivo añadido); 
    boundary.test.ts:7 (valida esquema); openrouter-chat.test.ts:44 (verifica request generado); cli-failure.test.ts:38 
    (preserva error); secrets.test.ts:49 (redacta logs); context-update-safety.test.ts:36 (protege AGENTS.md); 
    cli-setup.test.ts:62 (prerrequisito ausente).
    Leído entero: src/cli.ts; archivos no test de src/db/, src/config/, src/tasks/, src/spec/, src/skills/ y targets/, 
    src/instincts/, src/analyze/, src/agents/, src/detect/, src/context/, src/usage/, src/hooks/, src/security/, 
    src/evals/, src/generators/, src/plan/ y src/projects/; scripts/*.ts salvo *.test.ts; scripts/*.sh; 
    .claude/hooks/*.js; .github/workflows/*.yml; scripts/ui-fidelity/capture.mjs; src/context/load.test.ts; los 25 tests 
    enumerados; src/dashboard/handlers/specs.ts; src/dashboard/handlers/usage.ts.
    No leído: scripts/*.test.ts; restantes tests de src/db/, src/tasks/, src/detect/, src/usage/, src/evals/ y src/plan/; 
    restantes src/__tests__/; handlers del dashboard salvo los dos enumerados, de los que solo contrasté referencias 
    puntuales.

### Anexo F — lectura E (backend y vistas restantes)

    [P1] [falla] src/dashboard/app/src/components/common/ConfirmDialog.tsx:38 — Enter confirma incluso con «Cancel» 
    enfocado — abrir «Delete this chat?» y pulsar Enter → ejecuta el borrado — respetar el botón enfocado y su activación 
    nativa.
    [P1] [seguridad] src/run/path-policy.ts:65 — existsSync omite symlinks colgantes — output «escape.txt» enlazado a un 
    archivo exterior todavía inexistente → pasa la validación y writeFileSync crea el destino exterior 
    (src/run/contract.ts:103) — inspeccionar enlaces con lstat aunque su destino no exista.
    [P1] [seguridad] src/run/approvals.ts:31 — la canonicalización también omite symlinks colgantes — enlace dentro del 
    proyecto hacia un archivo exterior inexistente → withinProject=true y autoaprobación en auto-edit 
    (src/run/approvals.ts:51) — rechazar enlaces colgantes al recorrer la ruta.
    [P1] [seguridad] src/run/approvals.ts:54 — el permiso persistente identifica comandos sin incluir cwd — aprobar 
    siempre «rm informe.txt» en un directorio y repetirlo desde otro → reutiliza la autorización; Codex entrega cwd 
    separado de commandKey (src/run/executors/codex-approval.ts:59) — incluir el cwd canónico en la identidad autorizada.
    [P1] [seguridad] src/run/prompt.ts:44 — lee inputs sin aplicar la política de rutas — input «../privado.txt» o un 
    symlink exterior → incorpora su contenido al mensaje enviado al proveedor — resolver cada input mediante 
    resolveProjectPath antes de leerlo.
    [P1] [falla] src/run/file-lock.ts:81 — recuperar un candado elimina la ruta sin comprobar que siga siendo el archivo 
    inspeccionado — dos procesos detectan dueño muerto; uno adquiere el reemplazo y el otro lo elimina → escritores 
    simultáneos — serializar la recuperación y verificar la identidad del candado.
    [P1] [seguridad] src/dashboard/ssrf.ts:125 — valida DNS sin fijar la dirección usada por fetch — dominio que resuelve 
    primero a IP pública y después a privada → conexión interna; el consumidor vuelve a resolver al descargar 
    (src/dashboard/handlers/skills.ts:441) — conectar exclusivamente a una IP previamente validada.
    [P1] [seguridad] src/dashboard/settings-store.ts:67 — crea el archivo de claves sin permisos restrictivos explícitos 
    — con umask 022, un .env nuevo queda legible por otros usuarios locales — crear directorio y archivo con permisos 
    0700/0600.
    [P2] [seguridad] src/dashboard/ssrf.ts:109 — las IPv4 públicas retornan antes de validar el puerto — 
    https://8.8.8.8:8443/ → admitida pese al control de puertos de src/dashboard/ssrf.ts:112 — comprobar el puerto antes 
    de cualquier retorno satisfactorio.
    [P2] [falla] src/run/html-script-check.ts:143 — concatena scripts que tienen ámbitos independientes — dos script 
    type="module" válidos con «const x» → el check recibe una declaración duplicada y rechaza el HTML — comprobar cada 
    bloque por separado respetando su tipo.
    [P2] [falla] src/dashboard/app/src/components/instincts/InstinctsView.tsx:33 — descarta el formulario sin esperar el 
    guardado — falla la petición asíncrona de src/dashboard/app/src/App.tsx:1627 → desaparecen los textos introducidos — 
    esperar el resultado y conservar el formulario ante errores.
    [P2] [falla] src/dashboard/app/src/components/memory/MemoryView.tsx:42 — cierra la resolución sin esperar su 
    persistencia — rechaza la petición de src/dashboard/app/src/App.tsx:1585 → se pierde la resolución escrita — cerrar 
    únicamente tras guardar y mostrar el error.
    [P3] [muerto] src/dashboard/app/src/components/specs/SpecsView.tsx:24 — recibe onDraftSpec pero nunca lo utiliza — el 
    consumidor entrega el callback y ninguna acción lo invoca — retirar la prop y su cableado.
    [P3] [muerto] src/dashboard/app/src/components/common/ViewStateFeedback.tsx:46 — ignora el parámetro type — 
    type="table" produce exactamente el mismo esqueleto que "list" — eliminar el parámetro o implementar sus variantes.
    [P3] [arquitectura] src/dashboard/app/src/components/skills/SkillsView.tsx:27 — mezcla filtros, importación, 
    compilación y configuración por fila — incorporar una operación exige tocar el componente completo — extraer 
    SkillsFilters (45–116), AddSkillDialog (129–187) y SkillRow con sus mutaciones (203–352).
    [P3] [arquitectura] src/dashboard/app/src/components/instincts/InstinctsView.tsx:15 — mezcla selección, tarjetas y 
    alta — cambiar el guardado afecta al componente que presenta toda la lista — extraer InstinctCard (92–190) y 
    AddInstinctDialog (195–269), incluyendo handleAddSubmit (30–37).
    [P3] [arquitectura] src/dashboard/app/src/components/memory/MemoryView.tsx:16 — mezcla búsqueda, presentación y 
    resolución — modificar la persistencia obliga a intervenir también la vista de consulta — extraer MemoryList 
    (111–155) y MemoryResolutionDialog (159–229), trasladando los manejadores de resolución (30–43).
    [P3] [arquitectura] src/dashboard/app/src/components/specs/SpecsView.tsx:21 — mezcla búsqueda/selección con detalle y 
    acciones — cambiar la navegación obliga a recorrer también la presentación del contrato — extraer SpecsList (41–94) y 
    SpecDetail (97–168).
    [P3] [arquitectura] src/dashboard/app/src/components/common/CommandPalette.tsx:22 — mezcla catálogo, ejecución, 
    filtrado y diálogo — añadir comandos obliga a modificar el renderizador — extraer buildPaletteActions (35–84) y 
    PaletteDialog (92–169), conservando estado y filtrado en el contenedor.
    Controles sin otra evasión encontrada: normalización, traversal y rutas absolutas en src/run/path-policy.ts:21,28; 
    symlinks existentes exteriores en src/run/path-policy.ts:73; cwd en src/run/path-policy.ts:86; filtrado de entorno en 
    src/run/path-policy.ts:98. Persistencia inválida, IDs/resultados duplicados, límites y terminal ausente en 
    src/run/read-audit.ts:42,123,151,165; su cobertura excluye lecturas implícitas explícitamente en 
    src/run/read-audit.ts:182. Correlación de aprobación/run y cierre de pendientes en src/run/approvals.ts:88,138. 
    Adquisición mediante enlace y liberación por token en src/run/file-lock.ts:64,107. Selección registrada y comparación 
    de pertenencia en src/dashboard/ownership.ts:12,19. Esquema, credenciales, mayúsculas, IPv4 decimal normalizada y 
    rangos IPv6 privados en src/dashboard/ssrf.ts:90,92,94,105,69; redirects bloqueados en los consumidores 
    src/dashboard/handlers/chat.ts:408 y src/dashboard/handlers/skills.ts:441. No comprobé explotaciones en vivo.
    Leído entero: src/run/qa.ts:1; src/run/read-audit.ts:1; src/run/approvals.ts:1; src/run/path-policy.ts:1; 
    src/run/file-lock.ts:1; src/run/permissions.ts:1; src/run/middleware.ts:1; src/run/middlewares/context-inject.ts:1; 
    src/run/middlewares/index.ts:1; src/run/middlewares/instinct-apply.ts:1; src/run/middlewares/roadmap-context.ts:1; 
    src/run/middlewares/skill-route.ts:1; src/run/html-script-check.ts:1; src/run/commit-tasks-yaml.ts:1; 
    src/run/git-exclude.ts:1; src/run/transcript-parser.ts:1; src/run/tool-output-cap.ts:1; src/run/prompt.ts:1; 
    src/run/logger.ts:1; src/run/failure-kind.ts:1; src/run/graph-summary.ts:1; src/run/e2e-smoke.ts:1; 
    src/dashboard/ssrf.ts:1; src/dashboard/settings-store.ts:1; src/dashboard/project-context.ts:1; 
    src/dashboard/ownership.ts:1; src/dashboard/default-chat-agent.ts:1; src/dashboard/chat-live.ts:1; 
    src/dashboard/llm/clients.ts:1; src/dashboard/prompts/curator.ts:1; src/memory/judge.ts:1; src/roadmaps/context.ts:1; 
    src/cli-skill-curate.ts:1; src/cli-skill-fetch.ts:1; src/cli-dashboard-paths.ts:1; src/boundary/index.ts:1; 
    src/dashboard/app/src/components/skills/SkillsView.tsx:1; 
    src/dashboard/app/src/components/instincts/InstinctsView.tsx:1; 
    src/dashboard/app/src/components/memory/MemoryView.tsx:1; src/dashboard/app/src/components/specs/SpecsView.tsx:1; 
    src/dashboard/app/src/components/tasks/TaskDetailPanel.tsx:1; 
    src/dashboard/app/src/components/context/ContextView.tsx:1; 
    src/dashboard/app/src/components/settings/primitives.tsx:1; 
    src/dashboard/app/src/components/settings/ProjectGeneralSettings.tsx:1; 
    src/dashboard/app/src/components/settings/routing-roles.ts:1; 
    src/dashboard/app/src/components/common/ActionMenuButton.tsx:1; 
    src/dashboard/app/src/components/common/CloneProjectDialog.tsx:1; 
    src/dashboard/app/src/components/common/CommandPalette.tsx:1; 
    src/dashboard/app/src/components/common/ConfirmDialog.tsx:1; 
    src/dashboard/app/src/components/common/ContextRing.tsx:1; 
    src/dashboard/app/src/components/common/ProjectAddButton.tsx:1; 
    src/dashboard/app/src/components/common/ProjectIcon.tsx:1; 
    src/dashboard/app/src/components/common/ProviderLogos.tsx:1; 
    src/dashboard/app/src/components/common/ResizableAside.tsx:1; 
    src/dashboard/app/src/components/common/StatusBadge.tsx:1; 
    src/dashboard/app/src/components/common/ViewStateFeedback.tsx:1; src/dashboard/app/src/main.tsx:1.
    No leído: ninguno del alcance asignado; AgentComposer estaba excluido expresamente en /private/tmp/aud2/E.md:34.

### Anexo E — funciones de 80+ líneas (líneas, ramas, archivo:línea, nombre)

    3843	cx544	src/dashboard/app/src/components/settings/OrchestSettingsView.tsx:754	OrchestSettingsView
    1982	cx412	src/dashboard/app/src/App.tsx:134	App
    1122	cx274	src/dashboard/handlers/chat.ts:840	handleApiChat
    1045	cx176	src/run/harness.ts:139	runTask
    1022	cx204	src/dashboard/app/src/components/common/AgentComposer.tsx:175	AgentComposer
    836	cx147	src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:191	OrchestDevWorkspace
    731	cx79	src/dashboard/app/src/components/dev/OrcaRightInspector.tsx:139	OrcaRightInspector
    563	cx104	src/dashboard/app/src/components/chat/OrchestChatView.tsx:68	OrchestChatView
    529	cx88	src/dashboard/app/src/components/dev/OrchestDevWorkspace.tsx:444	DevExchange
    477	cx38	src/dashboard/app/src/components/plan/PlanBoardView.tsx:52	PlanBoardView
    473	cx68	src/dashboard/app/src/components/runs/RunsEvidenceView.tsx:38	RunsEvidenceView
    446	cx34	src/dashboard/app/src/components/layout/ShellSidebar.tsx:48	ShellSidebar
    430	cx263	src/dashboard/server.ts:174	route
    405	cx82	src/dashboard/app/src/components/thread/TaskCard.tsx:129	TaskCard
    344	cx58	src/dashboard/app/src/hooks/use-fluid-hover.ts:246	useFluidHover
    338	cx93	src/run/executors/codex-app-server.ts:664	turn
    332	cx36	src/dashboard/app/src/components/skills/SkillsView.tsx:27	SkillsView
    309	cx24	src/run/graph-runner.ts:329	executeSingleTask
    307	cx130	src/run/executors/codex-app-server.ts:347	notification
    295	cx66	src/dashboard/app/src/components/dev/DevSessionTabs.tsx:14	DevSessionTabs
    275	cx4	src/db/migrate.ts:1304	runMigrations
    271	cx122	src/dashboard/handlers/config.ts:134	handleApiConfigSet
    258	cx11	src/dashboard/app/src/components/instincts/InstinctsView.tsx:15	InstinctsView
    230	cx58	src/dashboard/app/src/components/layout/ShellStatusBar.tsx:117	ShellStatusBar
    225	cx52	src/dashboard/app/src/components/dev/DevFilePanel.tsx:19	DevFilePanel
    217	cx15	src/dashboard/app/src/components/memory/MemoryView.tsx:16	MemoryView
    210	cx2	src/dashboard/app/src/components/thread/ThreadStatesSheet.tsx:208	ThreadStatesSheet
    208	cx29	src/dashboard/app/src/components/layout/NewAgentSelectorModal.tsx:29	NewAgentSelectorModal
    198	cx37	src/dashboard/app/src/components/dev/OpenCodeTerminal.tsx:16	OpenCodeTerminal
    190	cx29	src/run/graph-runner.ts:124	runGraph
    187	cx51	src/run/executors/opencode-server.ts:116	runOpencodeServer
    178	cx34	src/run/executors/agentic.ts:97	run
    164	cx21	src/dashboard/app/src/components/dev/DevDiffPanel.tsx:65	DevDiffPanel
    160	cx10	src/dashboard/app/src/components/specs/SpecsView.tsx:21	SpecsView
    156	cx11	src/providers/tool-call.ts:601	runToolLoop
    149	cx9	src/dashboard/app/src/components/common/CommandPalette.tsx:22	CommandPalette
    146	cx21	src/run/sandbox.ts:58	createWorktree
    141	cx28	src/dashboard/app/src/components/ui/banner.tsx:222	BannerMotion
    141	cx20	src/generators/summary-pdf.ts:6	generateSummaryPdf
    139	cx22	src/run/executors/external.ts:660	run
    135	cx24	src/dashboard/app/src/App.tsx:1309	handleSendMessage
    135	cx30	src/run/executors/external.ts:521	runClaudeChat
    133	cx21	src/dashboard/app/src/components/common/CloneProjectDialog.tsx:5	CloneProjectDialog
    131	cx21	src/dashboard/app/src/components/common/ResizableAside.tsx:8	ResizableAside
    129	cx24	src/agents/diagnose.ts:147	diagnoseTask
    129	cx25	src/run/graph-summary.ts:25	printGraphSummary
    128	cx26	src/dashboard/app/src/components/tasks/TaskDetailPanel.tsx:56	TaskDetailPanel
    128	cx63	src/mcp/readonly.ts:224	planGit
    127	cx29	src/dashboard/handlers/providers.ts:112	createProviderReader
    126	cx14	src/dashboard/app/src/components/settings/ProjectGeneralSettings.tsx:7	ProjectGeneralSettings
    126	cx29	src/run/executors/external.ts:282	runClaudeCode
    124	cx17	src/run/executors/codex.ts:617	run
    123	cx19	src/dashboard/app/src/components/dev/GoToFileDialog.tsx:6	GoToFileDialog
    123	cx19	src/providers/tool-call.ts:477	openaiRound
    123	cx20	src/run/executors/codex.ts:486	runCodexChat
    122	cx19	src/dashboard/app/src/components/ui/tooltip.tsx:130	Tooltip
    122	cx25	src/dashboard/handlers/chat.ts:1526	finishTurnSuccess
    122	cx32	src/dashboard/server.ts:607	startServer
    121	cx35	src/run/sandbox.ts:227	mergeWorktreeBackLocked
    120	cx63	src/chat/chat-context.ts:141	buildChatSystemPrompt
    118	cx45	src/dashboard/handlers/setup.ts:52	handleApiSetup
    117	cx35	src/dashboard/app/src/hooks/useAttentionNotifications.ts:26	useAttentionNotifications
    113	cx17	src/dashboard/app/src/components/common/ActionMenuButton.tsx:5	ActionMenuButton
    112	cx9	src/dashboard/app/src/components/dev/CodeEditor.tsx:93	CodeEditor
    112	cx28	src/dashboard/handlers/setup.ts:195	handleApiHealth
    112	cx42	src/detect/manifest.ts:12	readManifest
    111	cx11	src/dashboard/handlers/usage.ts:21	handleApiUsage
    108	cx34	src/dashboard/handlers/runs.ts:238	handleApiRunsRevert
    101	cx15	src/detect/roadmap-profile.ts:257	detectDisciplines
    101	cx24	src/run/executors/codex-app-server.ts:170	receive
    99	cx24	src/mcp/server.ts:121	handleMcpMessage
    99	cx39	src/run/executors/step-event.ts:117	claudeEventToStep
    98	cx17	src/dashboard/app/src/components/ui/input-message.tsx:283	QueuedRow
    98	cx24	src/dashboard/app/src/hooks/useStickToBottom.ts:3	useStickToBottom
    97	cx14	src/dashboard/app/src/components/common/ContextRing.tsx:22	ContextRing
    94	cx26	src/dashboard/app/src/components/common/ProviderLogos.tsx:28	ProviderLogo
    94	cx35	src/run/qa.ts:189	parseVerdict
    93	cx41	src/dashboard/handlers/chat-sessions.ts:237	handleApiChatSessionsCreate
    92	cx10	src/dashboard/app/src/components/common/ConfirmDialog.tsx:3	ConfirmDialog
    92	cx10	src/dashboard/app/src/components/dev/DiscardChangesModal.tsx:11	DiscardChangesModal
    92	cx4	src/tasks/init.ts:58	scaffoldTasksYaml
    91	cx16	src/spec/lint.ts:42	lintSpec
    90	cx55	src/skills/registry.ts:138	validateSkill
    90	cx19	src/usage/cli-transcripts-reader.ts:157	readCliTranscriptUsage
    89	cx30	src/dashboard/handlers/tasks.ts:271	createTaskRecord
    89	cx8	src/run/qa.ts:88	runQA
    88	cx52	src/dashboard/handlers/task-report.ts:46	buildTaskReportData
    87	cx18	src/dashboard/app/src/components/ui/thinking-steps.tsx:153	CollapsePanel
    87	cx13	src/run/sandbox-policy.ts:88	resolveSandboxMode
    86	cx29	src/dashboard/handlers/chat.ts:1214	settleTaskIntent
    85	cx9	src/dashboard/app/src/components/ui/thinking-steps.tsx:367	ThinkingStep
    85	cx17	src/roadmaps/context.ts:48	loadRoadmapContext
    84	cx12	src/run/executors/generic-cli.ts:9	genericCliEngine
    84	cx15	src/run/executors/opencode.ts:307	run
    83	cx16	src/db/plan-items.ts:229	listPlanItemsWithCommitStatus
    82	cx16	src/run/executors/codex.ts:403	runCodexChatExec
    81	cx19	src/dashboard/app/src/App.tsx:600	poll
    81	cx10	src/dashboard/handlers/skills.ts:588	handleApiSkillsRegistryImport
    80	cx13	src/run/executors/codex-app-server.ts:1004	taskTurn
    80	cx12	src/run/executors/generic-cli.ts:11	run
