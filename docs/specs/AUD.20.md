# AUD.20 — Pérdida de datos del usuario: escrituras que pisan sin resguardo

Fuente: `docs/auditoria-2026-11-11.md` § AUD.20; `PLAN.md` ítem AUD.20. Todas las rutas y líneas de abajo se
comprobaron con grep/sed el 2026-11-11 sobre `76e4bb32`.

Arranque: `bun run agent:preflight -- --item AUD.20 --agent codex`. No editar `PLAN.md` ni `NEXT.md`. No commitear.

## Cambios (cada uno con su test; el test falla antes del cambio)

1. **`detect`/`init` no pisan `AGENTS.md`** — `src/cli.ts:84-85` (`detect`) y `:104-105` (`init`), y
   `handleApiProjectDetect` en `src/dashboard/handlers/project.ts:66-82`.
   - Mismo patrón que `context update` (`src/cli.ts:156-171`): si `AGENTS.md` existe y no hay `--force`, error a
     stderr, `process.exitCode = 1`, y **no se escribe nada** (ni `AGENTS.md` ni `context.json`; `init` tampoco hace
     `upsertProject`). Añadir la opción `--force` a `detect` e `init`.
   - Dashboard: `POST /api/project/detect` (ruta en `src/dashboard/server.ts:415`) acepta body JSON opcional
     `{ force?: boolean }`; sin `force` y con `AGENTS.md` existente responde 409
     `{ ok: false, error: 'AGENTS.md exists', path }` sin escribir. El endpoint no tiene llamador en la UI (no tocar UI).
   - Test: extender `src/__tests__/context-update-safety.test.ts` (mismo arnés de proceso aparte con
     `ORCHESTOS_HOME` temporal) con `detect` e `init` con y sin `--force`; test del handler con dir temporal.

2. **`saveSpec` no escribe fuera de `.orchestos/specs`** — `src/spec/store.ts:43-45,57-63`.
   - Extraer el regex de id de tarea de `src/tasks/schema.ts:91` a una constante exportada (`TASK_ID_RE`) y usarla en
     ambos sitios. `specPath()` lanza `Error('Invalid spec id: …')` si el id no cumple. Así lo heredan
     `loadSpec`, `saveSpec` y `archiveSpec`.
   - Test (`src/__tests__/spec.test.ts`): `id: ../../README` en `saveSpec` lanza y no crea ni modifica nada fuera
     del dir; `loadSpec(root, '../x')` lanza.

3. **Archivar no pisa ni pierde campos** — `src/spec/archive.ts`.
   - `:36,48`: si `YYYY-MM-DD-<id>.md` ya existe, usar `YYYY-MM-DD-<id>.2.md`, `.3.md`, …; escribir con
     `writeFileSync(path, content, { flag: 'wx' })`.
   - `:73-89`: borrar `_internals.serializeSpecRaw` y usar el serializador de `store.ts` (exportarlo como
     `serializeSpec`): conserva `capabilities`, `design`, `designApprovedAt`. Si algo importa `_internals`, adaptar.
   - `:66` `deleteArchivedSpec`: casar el nombre exacto con
     `^\d{4}-\d{2}-\d{2}-<id escapado>(\.\d+)?\.md$` y borrar todas las versiones archivadas de ese id (devuelve true
     si borró alguna). `foo` no borra `bar-foo`.
   - Tests (`src/__tests__/spec-archive.test.ts`, `src/__tests__/specs-delete.test.ts`): archivar dos veces el mismo
     día conserva ambos; spec con `capabilities` + `design: approved` + `designApprovedAt` los conserva al archivar;
     borrar `foo` con `bar-foo` archivado deja `bar-foo`.

4. **Regenerar una spec no conserva aprobaciones viejas** — `src/cli.ts:1646-1655` (`spec draft`).
   - Igual que ya hace con `approvedAt`: si `design === 'approved'` pasa a `'pending'` y se borra
     `designApprovedAt`; si `draftSpecBody` no devuelve `capabilities`, se borran las anteriores.
   - Test con el LLM sustituido como ya hagan los tests de `spec draft` (buscar con grep `draftSpecBody` en
     `src/__tests__`); si no hay forma inyectable sin tocar producción, extraer la mutación del frontmatter a una
     función pura exportada y probar esa.

5. **Escritura de contrato todo-o-nada** — `src/run/contract.ts:103-111` (`enforceContract`).
   - Fase 1: escribir cada archivo a un temporal en su mismo directorio (`<ruta>.orchestos-tmp-<pid>-<n>`); si falla
     alguno, borrar los temporales y relanzar sin tocar ningún destino.
   - Fase 2: guardar el contenido previo (o "no existía") de cada destino y `renameSync` temporal→destino; si un
     rename falla, restaurar los ya renombrados (reescribir el previo o borrar si no existía), borrar temporales y
     relanzar.
   - Test (`src/__tests__/contract.test.ts`): dos archivos, el segundo con su directorio padre convertido en archivo
     regular (o sin permiso de escritura) → el primero queda con su contenido original y no hay temporales sueltos.

6. **PUT de config serializado y atómico** — `handleApiConfigSet` en `src/dashboard/handlers/config.ts:134-405`
   (lee en `:251`, `await Bun.file(configPath).text()` en `:326`, escribe en `:402`).
   - Envolver todo el leer-modificar-escribir en una cola por `configPath` (Map de promesas en el módulo; la siguiente
     petición espera a la anterior aunque ésta falle).
   - Escribir a temporal en el mismo dir + `renameSync`.
   - Test: dos `handleApiConfigSet` concurrentes (`Promise.all`) que cambian campos distintos (p. ej. `permissionMode`
     y un `roleAssignments`) → el yaml final tiene ambos. Mirar `src/dashboard/__tests__/config-permission-mode.test.ts`
     para el arnés.

7. **Borrados individuales que no dependen del pragma de FK** — `src/db/runs.ts:291-294` (`deleteRun`) y
   `src/db/memory.ts:117-120` (`deleteMemoryEntry`).
   - `PRAGMA foreign_keys` solo se enciende en `src/db/migrate.ts:1289` tras ciertas migraciones: el resultado del
     borrado depende de la historia de la DB. Hacer cada borrado en una transacción que antes limpie los
     dependientes: `eval_trials` (`run_id NOT NULL REFERENCES runs`, `migrate.ts:89`) se borran; `chat_turns.run_id`
     (`migrate.ts:176`, nullable) y cualquier otra referencia a `runs(id)` sin `ON DELETE` → `NULL`;
     `memory_conflicts` con `entry_a_id`/`entry_b_id` = id (`migrate.ts:1439-1440`) se borran. Comprobar con grep
     `REFERENCES runs(id)` y `REFERENCES memory_entries(id)` en `migrate.ts` que no falte ninguna.
   - Test con `PRAGMA foreign_keys = ON` en la DB de prueba: borrar un run con `eval_trials` y un turno que lo
     referencia, y una entrada con conflicto → ambos devuelven true.

8. **`resolveConflict` resuelve el conflicto encontrado** — `src/db/memory.ts:193-221`.
   - Seleccionar también `c.id` y usarlo en el `UPDATE memory_conflicts … WHERE id = ?` (hoy usa el id de entrada,
     que puede ser `entry_a_id`/`entry_b_id`).
   - Test (`src/__tests__/memory-conflicts.test.ts`): `resolveConflict(entryAId)` deja `resolved_at` no nulo.

9. **`tasks.yaml` ilegible no equivale a tarea borrada** — `src/dashboard/handlers/task-run-reconcile.ts:64-73`.
   - Si `loadTasks` lanza, devolver `'watching'` sin borrar el watch; solo `'dropped'` cuando el yaml se leyó y la
     tarea no está.
   - Test: yaml inválido → `'watching'` y el watch sigue en la DB.

## Fuera de alcance

- UI: ninguna. AUD.19 (aislamiento), AUD.8 (endpoints sin uso), validación con Zod (AUD.12–17).
- No cambiar el formato de `orchestos.config.yaml` ni el comportamiento con YAML inválido (`config.ts:396-400`).

## Verificación

- `bunx tsc --noEmit`, `bun run lint`, y `bun run test:coverage` completos en verde.
- Cada test nuevo falla con el código de `76e4bb32` (comprobarlo con `git show 76e4bb32:<archivo>` del archivo de
  producción en un temporal; sin `git stash` ni `checkout`).
- Informe: por cada punto 1–9, archivo:línea del cambio y nombre del test.
