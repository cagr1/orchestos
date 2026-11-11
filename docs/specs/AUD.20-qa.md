# AUD.20 — revisión qa del diff sin commitear

Revisar `git diff` (sin commitear) contra el spec `docs/specs/AUD.20.md`. Solo leer; no editar ni commitear.

Mirar en especial:
- `src/run/contract.ts` `enforceContract`: ¿queda algún camino que deje un destino modificado o un temporal suelto
  si falla una escritura o un rename? ¿El rollback puede lanzar y tapar el error original?
- `src/dashboard/handlers/config.ts`: la cola por `configPath` ¿serializa de verdad y no se queda colgada tras un
  error? El temporal fijo por pid ¿choca entre dos procesos o entre dos raíces?
- `src/spec/store.ts` `specPath`: acepta `^[A-Za-z0-9_.\-']{1,64}$` sin `..` (igual que `validateTaskId` de
  `src/dashboard/http.ts:110`). ¿Algún id que salga de `.orchestos/specs`? ¿Algún llamador que ahora reciba una
  excepción donde antes devolvía null y la convierta en 500?
- `src/spec/archive.ts` `deleteArchivedSpec`: ¿el patrón borra versiones de otro id (p. ej. ids con `.`)?
- `src/db/runs.ts` / `src/db/memory.ts`: ¿falta alguna tabla que referencie `runs(id)` o `memory_entries(id)`?
- Tests nuevos: ¿prueban el comportamiento o solo la implementación?

Veredicto: lista de defectos con `archivo:línea` y escenario concreto, o "sin defectos". Nada de estilo.
