# UI.8.2 — integridad de datos: FK reales, `agents` como proyección derivada

Contrato en `PLAN.md:1722-1730`. Segundo paso de la Entrega 2 (`NEXT.md`), después de UI.8.1
(cerrado). Backend puro, sin UI. Habilita lo visual de UI.8.3/UI.8.4.

**Decisión de Carlos, 2026-09-15: `agents` es proyección derivada de sesiones/tareas
existentes, NO tabla propia.** No crear ninguna tabla `agents`. Si UI.8.4 necesita una lista
de "agentes con actividad en el proyecto", se deriva con una query sobre `chat_sessions`
(columna `agent`) y/o `runs` (columna `provider`/`model`), agrupada por `project_id` — un
helper de lectura, no una entidad nueva con su propio ciclo de vida. Este spec no incluye
escribir ese helper (eso es UI.8.4, cuando se sepa la forma exacta que necesita el shell);
solo deja registrada la decisión para que UI.8.4 no reabra la pregunta.

## Estado real medido en la DB de desarrollo (2026-09-15, `~/.orchestos/orchestos.db`)

```
runs 102 filas, files 17, code_edges 14, projects 1 (solo id=73903c93c6bd19e0, este repo)
orphan runs.project_id (no matchea ningún projects.id): 6 filas → valor c8b5b836957b464f
orphan files.project_id (ídem, CAST a TEXT): 17 filas (TODAS) → valores gfc-cs, gfc-go,
  gfc-java, gfc-js, gfc-rust, ruby-check
```

Los valores `gfc-*`/`ruby-check` en `files.project_id` no son IDs de proyecto reales — son
slugs de fixtures de test (`indexProject(root, project.id)` en producción siempre recibe el
`id` real de la tabla `projects`, ver `src/cli.ts:105,149` y
`src/dashboard/handlers/project.ts:98`; esos slugs solo aparecen en `src/graph/*.test.ts`,
confirmar antes de tocar nada). Es contaminación de tests corriendo contra la DB real de
desarrollo, un problema aparte de este ítem — **no purgar ni "corregir" esa causa acá**, solo
manejar las filas huérfanas que ya existen sin perderlas.

## Qué cambiar

### 1. `runs.project_id` → FK real hacia `projects(id)`, nullable

`runs` ya tiene `project_id TEXT` (sin FK). SQLite no permite `ALTER TABLE ... ADD
CONSTRAINT`, así que hace falta el patrón estándar de reconstrucción de tabla dentro de una
migración versionada (ver `applyMigrationSteps`/`FUTURE_MIGRATIONS` en `src/db/migrate.ts`,
próxima versión = **10**, seguir el mismo patrón `precondition`/`apply`/`postcondition` que
las migraciones 5-9 ya usan):

1. Antes de recrear la tabla, contar filas con `project_id` no nulo que no exista en
   `projects` y ponerlas a `NULL` (no borrar la fila — preservar `runs` completo). Registrar
   cuántas filas se tocaron (para el postcondition y la evidencia de cierre).
2. `CREATE TABLE runs_new` con el mismo DDL que hoy (`src/db/migrate.ts:442-462`) más
   `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL`.
3. `INSERT INTO runs_new SELECT * FROM runs` (columnas explícitas, no `SELECT *`, para no
   depender del orden — listar las mismas columnas de la definición actual).
4. `DROP TABLE runs`, `ALTER TABLE runs_new RENAME TO runs`.
5. Recrear cualquier índice que existiera sobre `runs` (revisar `grep -n "ON runs"
   src/db/migrate.ts` antes de escribir el paso — no asumir que no hay ninguno).
6. `postcondition`: `COUNT(*)` de `runs` **igual** al de antes de migrar (ningún row
   perdido) y que `PRAGMA foreign_key_list(runs)` liste la FK nueva.

### 2. `files.project_id` y `code_edges.project_id` → `TEXT` con FK real

Mismo patrón de reconstrucción, versión **11** (después de que 10 se aplique — no combinar
dos rebuilds de tabla distintas en un solo step, más fácil de auditar y de revertir si algo
falla a mitad de camino):

1. `files.project_id` es `INTEGER` hoy pero recibe strings (type affinity de SQLite lo
   permite sin error, por eso nunca reventó) — cambiar la columna a `TEXT`.
2. Igual que en el punto 1: las filas cuyo `project_id` actual no matchea ningún
   `projects.id` (hoy: las 17 de `files`, las 14 de `code_edges` — confirmar el número real
   al momento de correr, puede haber cambiado) se ponen a `NULL`, no se borran. Contar y
   loguear.
3. `CREATE TABLE files_new` con `project_id TEXT`, `FOREIGN KEY (project_id) REFERENCES
   projects(id) ON DELETE SET NULL`, mismo resto del DDL de `src/db/migrate.ts:464-474`
   (incluido el índice `idx_files_project`, y el `UNIQUE(project_id, path)` — con
   `project_id` ahora `TEXT` sigue funcionando igual).
4. Igual para `code_edges` (`src/db/migrate.ts:476-487`) — ojo que `code_edges.from_file_id`
   y `to_file_id` referencian `files(id)`, que **no cambia de tipo** (sigue `INTEGER PRIMARY
   KEY`), solo `code_edges.project_id` cambia de `INTEGER` a `TEXT` con su propia FK.
5. Postcondition: `COUNT(*)` de `files` y `code_edges` iguales a antes de migrar, FKs
   presentes en `PRAGMA foreign_key_list`.

### 3. `PRAGMA foreign_keys`

Confirmar que la conexión de Bun SQLite tiene `PRAGMA foreign_keys = ON` (buscar en
`src/db/sqlite.ts` si ya se activa al abrir la conexión). Si no está activo, las FKs nuevas
son decorativas — no se harían cumplir en runtime. Si falta, agregarlo ahí (afecta a toda
conexión, confirmar que no rompe algún INSERT existente que hoy dependa silenciosamente de
que no se valide — correr `test:coverage` completo para verlo).

## Cómo se verifica — con una COPIA de la DB real, nunca en caliente sobre `~/.orchestos`

1. Copiar `~/.orchestos/orchestos.db` a un archivo temporal (`cp`, no tocar el original).
2. Insertar un **registro centinela** antes de migrar en la copia (mismo patrón que H.5.2):
   una fila de `runs` con un `id` reconocible tipo `SENTINEL-UI82-<timestamp>`.
3. Correr `bun run db:migrate` (`scripts/migrate-db.ts`) apuntando a la copia (revisar si el
   script acepta un path o usa `~/.orchestos` fijo — si es fijo, exportar la variable de
   entorno que use `src/db/sqlite.ts` para resolver la ruta, o correr con `cwd`/env que
   apunte a un directorio temporal con su propia copia de la DB, NUNCA editar el script para
   hardcodear un path de prueba).
4. Verificar: el centinela sigue presente y con los mismos datos; `COUNT(*)` de `runs`,
   `files`, `code_edges` idénticos antes/después; `PRAGMA foreign_key_list` muestra las 3 FKs
   nuevas; probar un `INSERT` con `project_id` inventado y confirmar que SQLite lo rechaza
   (la FK funciona de verdad, no solo existe en el DDL).
5. Recién con eso verde, aplicar la migración real sobre `~/.orchestos/orchestos.db` (la de
   verdad, ahora sí) y repetir el conteo antes/después como evidencia final.
6. `bunx tsc --noEmit` y `bun run test:coverage` completos en verde — ninguna query existente
   contra `files`/`code_edges`/`runs` puede asumir el tipo INTEGER viejo de `project_id`
   (grepear `src/graph/*.ts` y cualquier otro consumidor antes de dar por cerrado).

## Qué NO tocar

- No purgar los datos de test contaminando la DB real (`gfc-*`, `ruby-check`) más allá de
  ponerles `project_id = NULL` por la FK — es un problema aparte, no de este ítem.
- No crear tabla `agents` (decisión de Carlos arriba).
- No tocar `context_chunks` (ya tiene FK) ni `memory_entries` (ya es `TEXT` sin problema
  reportado, fuera de alcance salvo que el grep de consumidores encuentre algo roto).

## Evidencia de cierre

Conteos antes/después (copia de prueba Y DB real), captura de `PRAGMA foreign_key_list` de
las 3 tablas, y el intento de INSERT inválido rechazado, en
`docs/done/evidence/UI.8.2-live.json`. Borrar este spec en el commit de cierre.
