# Auditoría del Bloque S

Fecha: 2026-09-10 · Alcance: S.1–S.6a · HEAD revisado: `2bee156`

Este documento registra una revisión independiente solicitada por Carlos. No promueve
ningún hallazgo a `PLAN.md` ni crea un ítem de implementación. Los arreglos descritos
abajo quedan para otro LLM, después de abrir el ítem y el spec correspondientes.

## Resultado

Los ocho ítems del bloque (`S.1`, `S.2`, `S.3`, `S.4a`, `S.4b`, `S.5`, `S.6` y
`S.6a`) aparecen cerrados en `PLAN.md`. La proyección actual también contiene 78
ítems, 57 `done` y 21 `open`; los 78 segmentos de ítem y los 79 segmentos de prosa
de `plan_doc_segments` están presentes, sin huérfanos ni faltantes.

La sincronización estructural pasa: `bun run plan:render --check` terminó con exit 0,
`bun run hooks:check` confirmó hooks instalados y sincronizados, y `bun run next`
produjo 21 ítems listos. El validador actual reportó confirmados los 57 ítems `done`,
incluidos los ocho de S; ese resultado no descarta los falsos positivos descritos abajo.

Esto no permite declarar el bloque completamente sano: las pruebas aisladas de esta
revisión encontraron tres defectos principales de comportamiento en la lógica de
procedencia y estado de cierre, incluyendo el caso de repositorios Git shallow.

## Evidencia de gates

La evidencia de cierre registrada en `PLAN.md` para S.6a reporta `bunx tsc --noEmit`
exit 0, `bun run test:coverage` con 1388 tests y 0 fallos, Biome exit 0, build de UI
reproducible, `git diff --check` limpio y el gate Playwright real ejecutado dos veces.
La corrida independiente informada para esta auditoría obtuvo 1388 pass, 0 fail,
3483 expectativas, 150 archivos y 40.05 s; typecheck, lint y hooks terminaron con
exit 0. Lint emitió 879 warnings y 490 infos: se registra el exit code, no se
confunde ese ruido heredado con un fallo.

Los comandos locales `bun run plan:render --check`, `bun run plan:status` y la
consulta de conteos a SQLite resolvieron la base mediante el `ORCHESTOS_HOME` estable
del proceso. No fueron corridas del harness ni fixtures aislados. `plan:status`
regeneró la proyección derivada; el árbol quedó sin cambios versionados y conservó
únicamente `?? NEXT_ACTIONS.md`, que pertenece al usuario. La validación de SHA
descrita arriba consultó esa DB estable; las reproducciones de defectos siguientes
usaron fixtures temporales separados.

No se repitió en esta auditoría el gate de navegador/Playwright ni se ejecutaron
corridas live del harness o corridas pagadas. La evidencia de navegador citada es la
registrada previamente en `PLAN.md` para S.6a.

## Hallazgos que requieren trabajo

### 1. Reapertura: un SHA viejo puede quedar aceptado como cierre actual

Fixture aislado: `/tmp/orchestos-s-audit-CS2Y3Q`.

El escenario creó un cierre (`0501d983e5468cecaec0c036b6dc9b1017eb9d5f`), reabrió el
ítem (`3a11611`) y luego cambió de nuevo la línea sin crear todavía un commit de cierre.
En `scripts/plan-import.ts:52` la reconciliación atribuyó otra vez el SHA del primer
cierre y `src/db/plan-items.ts:284` produjo `commitPending: false`. La lógica actual
conserva/acepta el SHA histórico durante la reapertura.

Acción para otro LLM: reproducir el fixture con una prueba de regresión que cubra
`open → done → open → done`, definir cuál SHA debe quedar en cada transición y hacer
que `commitPending` dependa del cierre confirmado correspondiente al estado vigente.
Verificar además que una reconciliación posterior no revive el SHA anterior.

Criterio de aceptación: la prueba falla contra la implementación actual, pasa después
del arreglo, y un cierre histórico no puede limpiar `commitPending` de una reapertura.

### 2. El gate acepta un spec archivado que no corresponde al ID

Fixture aislado: `/tmp/orchestos-s-provenance-JL1Xj2`.

En `scripts/plan-gate.ts:138`, el caso archivado `F.1` demuestra que una sección que
declara `Spec docs/specs/Fx1.md` puede pasar aunque el ID sea `F.1`. Esto deja una
brecha entre la existencia de una declaración y la correspondencia exacta entre ítem,
spec y evidencia.

Acción para otro LLM: fijar en un spec la correspondencia obligatoria entre ID y spec
para la vía archivada `docs/done/`, y añadir un fixture negativo para spec incorrecto
(`Fx1` frente a `F.1`). Mantener separado el contrato de la ruta inline.

Criterio de aceptación: un spec archivado que no corresponde al ID falla con mensaje
determinista; un cierre archivado válido conserva el contrato actual.

### 3. Historial shallow: un commit de prosa puede confirmarse como cierre

Fixture aislado: clone `--depth=1` desde
`file:///tmp/orchestos-s-audit-CS2Y3Q` a
`/tmp/orchestos-s-audit-CS2Y3Q-shallow`.

El historial shallow terminó en `39395a5ad8c11ef2578732a2f2c4194a2a13a244`, un commit
que solo cambia prosa después del cierre real `3fe930e`. En `scripts/plan-import.ts:52`
`importPlan(root)` atribuyó al ítem el SHA de ese commit de prosa; en
`src/db/plan-items.ts:223`/`:265`, `isConfirmedPlanCloseCommit()` devolvió `true` y
`commitPending` devolvió `false`. Al no existir el padre local, la implementación
trata el commit como raíz y convierte la falta de historia en un cierre confirmado.

Acción para otro LLM: conservar esta receta reproducible, documentar la salida de Git
y añadir el caso al contrato de `findAllPlanCloseCommits()` y
`listPlanItemsWithCommitStatus()`.

Criterio de aceptación: un historial shallow que no permite probar el padre produce
estado pendiente/error explícito; nunca atribuye el cierre al último commit visible ni
lo confirma como raíz.

## Observaciones heredadas, no regresiones nuevas

S.1–S.6a conservan evidencia inline extensa en `PLAN.md`; `docs/done/bloque-S.md` aún
no existe porque S.6a difirió el archivado del bloque a una operación posterior. Eso
es una deuda documental conocida, no evidencia de que los ítems estén abiertos.

La ruta de procedencia archivada y la ruta inline tienen contratos distintos. No deben
mezclarse al corregir los hallazgos. Del mismo modo, `feature-status.json` es derivado:
su estado dirty o staged no sustituye comprobar la fuente y la DB. `NEXT_ACTIONS.md`
queda fuera de esta auditoría.

`bodyFromEvidence()` en `scripts/plan-import.ts` no aplica la misma frontera local de
ruta/blob que `checkProvenance()` aplica al gate staged. Se registra como observación
de consistencia y defensa en profundidad, no como vulnerabilidad remota confirmada:
`plan:reconcile` es una operación CLI local y `/api/plan` no expone `body`. Si se desea
corregirlo, debe añadirse una prueba de traversal/symlink y un ítem de seguridad
separado, sin mezclarlo con los tres defectos confirmados.

La ruta inline también acepta una línea `Ejecutado por:` vacía en
`scripts/plan-gate.ts:120` dentro del fixture de procedencia. Se conserva aquí como
observación heredada del camino inline, no como un cuarto defecto nuevo de S.6a:
el contrato de S.6a mantiene ese camino histórico y el hallazgo confirmado de esta
revisión es la falta de validación del spec en la evidencia archivada.

## Criterio de cierre para el siguiente ítem

El próximo LLM debe abrir un ítem explícito y un spec antes de implementar. Debe añadir
regresiones en fixtures temporales, ejecutar los comandos exactos de CI, comprobar los
casos negativos contra Git real y obtener una revisión independiente 🔍. El cierre no
debe basarse en el reporte del ejecutor; debe incluir evidencia reproducible y borrar el
spec conforme al ciclo de vida del repositorio.

La decisión de probar controles reales y fixtures separados sigue INS-2026-015:
primero se auditan instrucciones, estado, verificación, alcance y ciclo de sesión del
harness antes de atribuir el fallo al modelo. INS-2026-014 queda como criterio de
seguridad adicional si una prueba confirma traversal o lectura de symlink fuera de
`docs/done/`; esta auditoría no lo eleva a defecto confirmado.
