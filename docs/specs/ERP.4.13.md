# ERP.4.13 — árbol sucio: la tarea queda `pending` y el hilo ofrece "Commit & Run" y reintento

Rol: `criterio`. Eres el ejecutor: no delegues. No commitees ni toques `PLAN.md`/`NEXT.md`.
Preflight: `bun run agent:preflight -- --item ERP.4.13 --agent claude --scope "src/**,scripts/ui-gate/**,NEXT.md,PLAN.md,LEDGER.md,docs/**,.orchestos/feature-status.json"`.
Candado de escritor: te lanzó el cerebro que lo tiene y heredas `AGENT_WRITER_TOKEN`; escribes bajo su candado.
`writer-lock.js status` → `ocupado: claude …` es lo esperado, no un bloqueo: no pares por eso.
Hay cambios ajenos sin commitear (`IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`): no los toques. Prohibido `prettier`, `git stash`, `git commit`, `git checkout` de archivos.
NO corras `bun run test:coverage` ni ningún `ui:gate`, ni te detengas por el baseline: los corre el cerebro.

## Síntoma (piloto ERP.4, hallazgo 18) y decisión de Carlos (2026-10-13)
Con un archivo sin commitear en el proyecto, la tarea termina `failed`, el mensaje manda a la terminal ("commit or
stash") y el hilo no ofrece nada. Decisión: se sigue bloqueando (el ejecutor trabaja sobre el último commit); la
tarea queda `pending`; el hilo lista los archivos con un botón "Commit & Run" que los commitea y relanza; y el último
reporte de fallo de una tarea ofrece "Retry". Todo desde el chat, sin terminal y **sin UI nueva en Settings**.

## Estado actual (leído en el código)
- `resolveSandboxMode` (`src/run/sandbox-policy.ts:44-73`) restaura `runs-summary.json`, lee `git status --porcelain`,
  exceptúa solo `runs-summary.json` y lanza un `Error` genérico con hasta 10 líneas.
- `src/cli.ts:1288-1296` captura ese error y marca `{ status: 'failed', retry_reason: message }`.
- El reporte al hilo es un string: `buildTaskReport` (`src/dashboard/handlers/task-report.ts:21-43`) →
  `appendTaskReport` (`src/db/chat-sessions.ts:285-302`) inserta en `chat_messages` con `task_id`; sin campos propios.
- El hilo pinta el reporte como Markdown (`OrchestChatView.tsx:376-394`); la tarjeta "Task ready to run" está en
  `OrchestChatView.tsx:395-452`. `Approve & Run` → `runProjectTask` (`app/src/api/chat.ts:449-463`) →
  `POST /api/tasks/:id/run` (`handlers/tasks.ts:407-437`, ruta en `server.ts:244-247`) → `spawnTaskRun`.
- Tras recargar, un mensaje con `taskHeld` y tarea aún `pending` vuelve a mostrar la tarjeta (`App.tsx:209-225`):
  hoy es la única forma de reintentar desde el hilo, y exige recargar.
- `tasks.yaml` ya no ensucia el árbol: el CLI commitea su estado al salir (`commitFinalTaskState`,
  `src/run/commit-tasks-yaml.ts`, ERP.4.12).

## Comportamiento exigido

### 1. Política de sandbox (`src/run/sandbox-policy.ts`)
- Exporta `listDirtyFiles(projectRoot: string): string[]`: rutas relativas con cambios sin commitear, con la misma
  excepción de hoy (`runs-summary.json`). Parseo robusto: `git status --porcelain -z`; una entrada de rename aporta
  las dos rutas; los no seguidos cuentan. Sin truncar.
- Exporta `class DirtyTreeError extends Error` con `files: string[]` (lista completa). `resolveSandboxMode` la lanza
  en vez del `Error` genérico; el `message` conserva el texto de hoy (lo imprime el CLI).
- Exporta `DIRTY_TREE_REASON_PREFIX = 'uncommitted changes: '`.
- No cambies qué se considera sucio ni cuándo se bloquea.

### 2. CLI (`src/cli.ts:1288-1296`)
Si el error es `DirtyTreeError`: `updateTaskStatus(root, taskId, { status: 'pending', retry_reason:
DIRTY_TREE_REASON_PREFIX + files.join(', ') })`, **sin** tocar `retry_count` (no hubo intento). El valor de retorno
de `executeTask` sigue siendo `'failed'` (los bucles `--all`/siguiente tarea deben parar igual que hoy; verifica los
llamadores `cli.ts:1821-1865` y dilo en el reporte). Cualquier otro error: como hoy.
Audita los consumidores que deducen "el run terminó" del estado: `isTaskStillRunning`, `resolveTaskReportPoll` y
`decideTaskPollAction` (`app/src/api/tasks.ts`), el sondeo de `App.tsx:307-392` y `task-run-reconcile.ts`. Una tarea
`pending` cuyo `retryReason` empieza por el prefijo **ya terminó** aunque `retryCount` sea 0; ajusta lo necesario
para que ni el botón Run de Settings ni el hilo se queden esperando.

### 3. Reporte con datos estructurados
- Migración numerada nueva en `src/db/migrate.ts` (la siguiente libre; no `safeAddColumn`): columna
  `chat_messages.task_report TEXT NULL` con JSON `{ "outcome": <estado de la tarea al reportar>, "dirtyFiles"?: string[] }`.
- `appendTaskReport` recibe y guarda ese objeto; **todo** reporte de fin de tarea lo lleva (`outcome` = `done`,
  `pending`, `failed`, `failed_permanent`, `blocked`).
- En `task-report.ts`: si la tarea está `pending` y su `retry_reason` empieza por el prefijo, `dirtyFiles =
  listDirtyFiles(root)` (leído en vivo, no parseado del string) y el texto del reporte es exactamente
  ``✗ Task `<id>` not started · uncommitted changes in the project`` — sin la cita `> No run was recorded.`
- El mensaje sale por la API de mensajes del hilo como `taskReport` (camelCase, objeto ya parseado o ausente):
  `src/dashboard/handlers/chat-sessions.ts:76` y los tipos de `src/db/chat-sessions.ts` y del front.

### 4. Endpoint `POST /api/tasks/:id/commit-run`
En `src/dashboard/handlers/tasks.ts`, ruta registrada junto a la de `/run` en `server.ts`. Body JSON
`{ files: string[], sessionId?: string }`.
- Mismas validaciones de id/`tasks.yaml`/tarea que `handleApiTasksRun`.
- `files` no vacío; cada ruta relativa, sin `..`, no absoluta, y presente **ahora** en `listDirtyFiles(root)`; si
  alguna no cumple → 400 con el nombre de la ruta. No se commitea nada fuera de esa lista.
- Bajo `withGitLock`: `git add -- <files>` y `git commit -m "chore: commit pending changes before <id> (dashboard)"
  -- <files>`. Identidad y hooks del repo del usuario; no se fija identidad. Si el commit sale ≠ 0 → 409 con el
  stderr de git y la tarea no se lanza.
- Después, lo mismo que `handleApiTasksRun` (poner `pending`, `spawnTaskRun` con `sessionId`). Reutiliza el código,
  no lo dupliques.
- Helper de commit de rutas: función nueva junto a `commitTasksYaml` en `src/run/commit-tasks-yaml.ts` (o módulo
  vecino), que devuelve `{ ok: boolean; stderr: string }`.

### 5. Hilo del chat (frontend)
- Cliente: `commitAndRunProjectTask(taskId, files, …)` junto a `runProjectTask` en `app/src/api/chat.ts`, mismos
  headers y `sessionId`.
- En `OrchestChatView.tsx`, debajo del Markdown de un mensaje con `taskReport`, **solo si es el último mensaje del
  hilo con ese `taskId`**:
  - `dirtyFiles` no vacío → tarjeta con el **mismo JSX y las mismas clases** que "Task ready to run"
    (`OrchestChatView.tsx:395-452`): título `Uncommitted changes`, la píldora con el id, la lista de archivos en
    lugar de la descripción (una ruta por línea, misma clase de texto de la descripción más `font-mono`), el bloque
    de error igual, y un solo botón esmeralda `Commit & Run`. Sin botón Reject.
  - `outcome` es `pending` o `failed` y sin `dirtyFiles` → solo la fila de botones de esa tarjeta
    (`div.flex.items-center.gap-2.pt-1`) con un botón esmeralda `Retry` que llama a `runProjectTask`.
  - Cualquier otro `outcome`: nada.
  - Al pulsar: el botón se deshabilita hasta que la promesa resuelve; un error se muestra en el mismo
    `role="alert"` que usa la tarjeta (`taskActionErrors`). Cuando llega el reporte siguiente de esa tarea, el
    mensaje deja de ser el último y la acción desaparece sola.
- Cero CSS nuevo: ninguna clase que no exista ya en ese archivo; `styles.css` no se toca. Icono: uno de
  `lucide-react` ya importado en el archivo o `RotateCw`.
- `App.tsx:209-225`: la tarjeta "Task ready to run" de un mensaje `taskHeld` ya no reaparece si el hilo tiene un
  mensaje posterior con el mismo `taskId` y `taskReport` (la tarea ya se lanzó: la acción vive en el último
  reporte). Una tarea propuesta y nunca lanzada sigue mostrándola como hoy.

## Tests
- `sandbox-policy`: `listDirtyFiles` con repo temporal real (modificado, no seguido, rename, `runs-summary.json`
  exceptuado); `resolveSandboxMode` lanza `DirtyTreeError` con `files` completos. Fixtures con identidad propia
  (`git -c user.name=… -c user.email=… commit`) y `env` explícito en cada spawn.
- `task-report`: tarea `pending` con el prefijo → texto exacto y `taskReport.dirtyFiles`; tarea `failed` normal →
  `outcome: 'failed'` sin `dirtyFiles`; `done` → `outcome: 'done'`.
- Endpoint: 400 por ruta fuera de la lista sucia y por `..`; caso bueno → el commit contiene solo esos archivos y
  la tarea queda lanzada (usa la costura de spawn que ya usen los tests de `handleApiTasksRun`; si no hay, prueba
  hasta el commit y dilo).
- Migración: el test de migraciones existente sigue verde y la columna existe.
- Front (`app/src/api/tasks.test.ts` u hermano): `isTaskStillRunning` con `pending` + prefijo + `retryCount: 0` → `false`.
- Todo fixture `JSON.stringify` del front que simule mensajes o filas debe llevar la forma nueva.

## Gate en vivo (lo escribes tú, lo corre el cerebro) — `scripts/ui-gate/flows/chat-retry-report.mjs`
1. El reintento existente deja de recargar la página: tras arreglar el check, pulsa `Retry` en el último reporte y
   comprueba `done` + reporte nuevo en el hilo sin recargar; además, que el reporte anterior ya no muestra `Retry`.
2. Tramo nuevo, mismo proyecto temporal: escribe un archivo no seguido (`sucio.txt`), pide una segunda tarea por el
   chat y aprueba. Pasos: la tarea queda `pending` (API) con `retryReason` que empieza por `uncommitted changes: `;
   el hilo muestra `Uncommitted changes` con `sucio.txt` sin recargar; pulsa `Commit & Run`; `git log -1
   --format=%s` empieza por `chore: commit pending changes before `; `git status --porcelain` no lista `sucio.txt`;
   la tarea termina `done` y su reporte aparece sin recargar.
Sin pasos `true` literales; cada paso con su `note`. El repo temporal lleva identidad local (`git config`).

## No tocar
`src/run/harness.ts` (si resulta imprescindible, para y repórtalo), `styles.css`, Settings (ninguna vista de
`components/settings/`), el formato de `tasks.yaml`, `PLAN.md`, `NEXT.md`.

## Verificación (corre y pega la salida)
`bun run typecheck` · `bun run lint` · `bun test <los archivos de test que tocaste>` · `bun run build:app` ·
`bun run ui:fidelity:jsx` · `node --check scripts/ui-gate/flows/chat-retry-report.mjs`.
En el reporte: lista de archivos tocados y cualquier punto del spec que no hayas podido cumplir tal cual.
