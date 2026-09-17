# Auditoría del Bloque S — 2026-09-10

## Resultado

La auditoría terminada deja tres problemas principales: dos de severidad alta en la
reconciliación del plan y uno de severidad alta en el aislamiento por proyecto del Sprint
Board. También queda una observación secundaria de severidad media sobre el diagnóstico de
errores de carga y una advertencia operativa sobre `plan:render --check`.

## Hallazgos principales

### Alta — reconciliación incorrecta en clones shallow

`src/db/plan-items.ts:216-228` interpreta el último commit local como si tuviera padre vacío;
`scripts/plan-import.ts:53-57,74,84-97` acepta ese SHA como cierre probado. Reproducción dinámica
con `git clone --depth=1`: después de `open → close → commit solo de prosa`, la reconciliación
salió verde y persistió el SHA de prosa:

```json
{"shallow":"true","proseSha":"3b0ea5e69072742148ba3cbad20a25b86e17fd84","exit":0,"stdout":"[{\"id\":\"X\",\"status\":\"done\",\"commit_sha\":\"3b0ea5e69072742148ba3cbad20a25b86e17fd84\"}]","stderr":""}
```

S.7c corrigió la proyección `commitPending` de `listPlanItemsWithCommitStatus()`, pero no la
importación/reconciliación que escribe el dato falso. [Informe DB: líneas 3-10](/tmp/orchestos-s-audit-db.txt:3).

### Alta — un cierre anterior se hereda tras eliminar y reintroducir el ID

`src/db/plan-items.ts:230-241` solo registra reapertura cuando el ítem sigue presente y pasa a
`open`; `scripts/plan-import.ts:53-54` reutiliza el SHA de cierre anterior. Reproducción dinámica
en fixture real: `open → close A → eliminar X (commit) → reintroducir X done sin commit`; el
sistema aceptó A y declaró confirmado el nuevo cierre:

```json
{"closeSha":"a1f1c5c137754eb68e20ab2d490628cb36299534","exit":0,"stdout":"[{\"id\":\"X\",...,\"status\":\"done\",...,\"commitSha\":\"a1f1c5c137754eb68e20ab2d490628cb36299534\",...,\"commitPending\":false}]"}
```

Esto viola la garantía de no heredar el SHA de un cierre invalidado. [Informe DB: líneas 12-19](/tmp/orchestos-s-audit-db.txt:12).

### Alta — el plan es global y la selección de proyecto no aísla el Sprint Board

La UI hace `fetch('/api/plan')` sin `X-Orchestos-Project-Id` ni `?project=` (`src/dashboard/public/app.js:199`).
El endpoint puede resolver el `root` seleccionado (`src/dashboard/server.ts:156`), pero
`plan_items` y `plan_item_deps` no tienen `project_id` (`src/db/migrate.ts:246`) y las consultas
listan el plan global (`src/db/plan-items.ts:107`). Estas son inferencias estáticas del código;
no constituyen observación de aislamiento UI en un navegador.

La reproducción dinámica del endpoint, no del navegador, usó `alpha` importado en la DB global y
un `beta/PLAN.md` distinto: `GET /api/plan` con `X-Orchestos-Project-Id: beta` resolvió beta,
comparó contra el render global de alpha y devolvió `409 {"error":"PLAN.md is out of sync with the plan database"}`
(`src/dashboard/handlers/plan.ts:16`). Con markdown idéntico, una mutación de beta alteraría las
filas globales y escribiría solo `beta/PLAN.md`, dejando alpha desincronizado. [Informe UI: líneas 3-11](/tmp/orchestos-s-audit-ui.txt:3).

## Observación secundaria

### Media — error genérico al cargar el plan

`fetchPlan()` descarta cuerpo y status y solo asigna `planStatus = 'error'`
(`src/dashboard/public/app.js:199`); la UI muestra siempre “Could not load the plan. Check that
PLAN.md matches the database.” (`src/dashboard/public/i18n.js:847`). Se pierden diagnósticos
distintos como `404`, `410` y `409`. Esta conclusión es estática; la validación visual no fue
observada en navegador. [Informe UI: líneas 13-21](/tmp/orchestos-s-audit-ui.txt:13).

## Advertencia operativa

`bun run plan:render -- --check` terminó con exit 0, pero no es readonly: `scripts/plan-render.ts:3-4`
importa migraciones y `scripts/plan-render.ts:31-35` las ejecuta incluso con `--check`; la apertura
de SQLite (`src/db/sqlite.ts:8-16,27-28`) puede crear la DB y modificar `journal_mode`. El hook
también hereda esta propiedad (`scripts/pre-commit.sh:36-40`). La reproducción dinámica fue:

```text
$ bun run plan:render -- --check
$ bun run scripts/plan-render.ts --check
```

La consulta readonly posterior devolvió `{"query_only":1,"plan_items":82,"plan_doc_segments":165,"plan_item_deps":0}`.
Esto no garantiza ausencia de cambios en la DB: el check se ejecutó y puede escribir, y no existe
comparación previa/posterior que demuestre que no hubo cambios. [Informe de gates: líneas 7-27](/tmp/orchestos-s-audit-gates.txt:7).

## Checks ya ejecutados y limitaciones

- `bun run test:coverage`: 1392 pass, 0 fail; funciones 74.48%, líneas 63.35%.
- `hooks:check`, `bunx tsc --noEmit`, `bun run lint`: exit 0; lint reportó 879 warnings heredados.
- Suite relevante DB: 29 pass / 0 fail. Suite dashboard: 3 pass / 0 fail, 20 expect calls.
- Gate de procedencia: 10/10; `plan-import`: 3/3; `plan-items`: 6/6; `plan-render`: 4/4;
  `next` + `session-resume-hook`: 7/7.
- 82 IDs/estados alineados; 11 enlaces únicos y 11 anclas válidas; `git diff --check` limpio.

La validación de navegador no se repitió porque el dashboard estaba apagado
(`127.0.0.1:4242`, `net::ERR_CONNECTION_REFUSED`). Por tanto, no se presenta aislamiento UI como
observado en navegador. `NEXT_ACTIONS.md` era untracked preexistente y no se tocó. No se hicieron
cambios de código, DB, índice, commits ni push.

