# R.7 — Escritura atómica y coordinación entre procesos para tasks.yaml

Problema: `src/tasks/loader.ts:25` (`saveTasks`) comprueba un hash opcional y sobrescribe con `writeFileSync`
directo; los handlers hacen load → mutar → save sin exclusión. Dos procesos (server del dashboard + `task run`)
pierden actualizaciones y un corte a mitad de escritura deja un YAML incompleto. tasks.yaml sigue siendo la fuente
de verdad; **no** migrar a SQLite.

## Cambios

1. **`src/run/file-lock.ts` (nuevo):** `withFileLock<T>(path, fn, { waitTimeoutMs=30_000, staleMs=60_000,
   pollIntervalMs=50 })`. Mismo algoritmo que `src/run/git-lock.ts:37-79` (`openSync(path,'wx')`, sleep, stale por
   mtime) más:
   - el lockfile guarda `${process.pid}:${crypto.randomUUID()}` (token);
   - recuperación: si el lockfile tiene más de `pollIntervalMs` de antigüedad y su PID no existe
     (`process.kill(pid,0)` lanza error con código ≠ `EPERM`), se roba enseguida; lockfile vacío o sin PID → solo
     decide el stale por mtime;
   - liberación: borrar el lockfile solo si su contenido sigue siendo el token propio;
   - timeout → `Error` con la ruta del lock en el mensaje.
   `withGitLock` (`git-lock.ts:37`) pasa a ser `withFileLock(join(root,'.orchestos','git.lock'), fn)`, mismas
   constantes. `src/__tests__/git-lock.test.ts` debe seguir pasando sin cambios.

2. **`src/tasks/loader.ts`:**
   - `writeTasksAtomic(path, content)` exportada: escribe en `join(dirname(path), '.tasks.yaml.tmp-<pid>-<rand>')`,
     `fsyncSync` del fd, `closeSync`, `renameSync` sobre `path`; si algo falla, borra el temporal y relanza.
   - `withTasksLock(root, fn)`: `withFileLock(join(root,'.orchestos','tasks.lock'), fn, { waitTimeoutMs: 10_000,
     staleMs: 30_000 })`.
   - `mutateTasks<T>(root, fn: (file: TasksFile) => T): T`: bajo `withTasksLock`: `loadTasks` → `fn(file)` →
     `validateTasksFile` → serializar igual que hoy (`stringify(..., { lineWidth: 120 })`) → si el texto es idéntico
     al del disco no escribe; si no, `writeTasksAtomic`. Si `fn` lanza, no se escribe nada y el error se propaga.
   - `saveTasks(root, file, expectedHash?)`: misma firma y mismo mensaje de conflicto, pero hash-check + escritura
     dentro de `withTasksLock` y con `writeTasksAtomic`.
   - `updateTaskStatus` (`loader.ts:56`): implementada con `mutateTasks`; tarea inexistente → mismo error
     `Task "<id>" not found in tasks.yaml` (explícito, nunca la recrea).

3. **Escritores migrados a `mutateTasks`** (load+mutate+save dentro del callback; respuestas 404/409 se deciden
   lanzando o devolviendo un resultado desde el callback, sin escribir):
   - `src/dashboard/handlers/tasks.ts:278` (crear tarea), `:407` (retry), `:435` (delete), `:464` (bulk delete),
     `:592` (approve-split).
   - `src/db/reset.ts:30`.
   - `src/tasks/init.ts:91`: `withTasksLock` + `writeTasksAtomic` en vez de `writeFileSync`.
   - `src/cli.ts` ya pasa por `updateTaskStatus`: sin cambios.
   **`commitTasksYaml` y `withGitLock` se llaman DESPUÉS de que `mutateTasks` devuelve, nunca dentro del callback**
   (los dos locks no se anidan). No cambiar mensajes de commit ni respuestas HTTP existentes.

## Tests (procesos reales, aislados en `mkdtempSync`)

Nuevo `src/__tests__/tasks-concurrency.test.ts` (patrón de subprocesos: `git-lock.test.ts:22-80`; pasar `env`
explícito a `Bun.spawn`, regla CI.5) y casos unitarios nuevos en `src/tasks/loader.test.ts`:
1. 4 procesos × 25 `updateTaskStatus` cada uno sobre SU tarea (`retry_reason: "p<k>-<i>"`): al final las 4 tareas
   tienen `p<k>-24`, el archivo valida y no se perdió ninguna tarea.
2. Misma tarea: dos procesos parchean campos distintos → ambos campos presentes. Tarea borrada con `mutateTasks` y
   luego `updateTaskStatus` sobre ella → lanza el error "not found" y la tarea no reaparece.
3. Interrupción: hijo que reescribe en bucle un tasks.yaml de ~3000 tareas; el padre lo mata con `SIGKILL` a un
   tiempo distinto en cada una de 5 rondas; tras cada muerte `loadTasks` valida, y un `mutateTasks` siguiente
   termina en < 2 s (lock del muerto recuperado por PID).
4. Lock: PID muerto → se toma en < 1 s; lockfile vacío con mtime viejo → se toma; PID vivo (hijo durmiendo) con
   `waitTimeoutMs` corto → error de timeout con la ruta; liberar con token ajeno no borra el lock.
5. `saveTasks` con `expectedHash` desactualizado sigue lanzando el error de conflicto (test existente en
   `loader.test.ts` intacto).

## Fuera de alcance
SQLite, cambiar `commitTasksYaml`, tocar `PLAN.md`, commits.

## Verificación (ejecutor)
`bunx tsc --noEmit`; `bun test src/tasks src/__tests__/git-lock.test.ts src/__tests__/tasks-concurrency.test.ts
src/dashboard src/db`; `bunx biome check` sobre los archivos tocados. Reportar la salida real. No commitear.
