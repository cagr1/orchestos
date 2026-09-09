# S.6 — Sprint Board sobre `plan_items`

## Encargo

Implementar la pantalla Sprint Board del dashboard. Ejecutor recomendado: `gpt-5.6-terra`, en una
sesión separada. Esta tarea cruza SQLite, HTTP, shell vanilla e isla React; el diseño ya está
decidido aquí. El ejecutor implementa y prueba, pero **no verifica ni cierra S.6**. El cerebro hará
la revisión independiente y el gate vivo después.

No cambiar de modelo dentro de la conversación larga del cerebro: `INS-2026-016` confirma que ese
cambio invalida el prompt cache. Abrir otra sesión para la ejecución.

## Historia de usuario

Desde el dashboard de OrchestOS, Carlos abre “Plan”, ve los ítems agrupados por sprint, distingue
cuáles están listos o bloqueados, entiende las aristas de dependencia, edita dependencias y prepara
el cierre de un ítem listo. El cambio persiste en `plan_items`/`plan_item_deps`, la vista se
actualiza y `bun run plan:render` reproduce byte a byte el `PLAN.md` escrito por el flujo.

## Estado inicial verificado

- `plan_items` tiene 77 filas y `plan_item_deps` está vacío.
- `src/db/plan-items.ts` ya expone `listPlanItems()`, `setDeps()`, `closePlanItem()` y
  `readyItems()`. No existe detección de ciclos ni actualización de `plan_doc_segments`.
- No existe handler ni ruta `/api/plan` en `src/dashboard/server.ts`.
- La navegación vive en `src/dashboard/public/app.js`; las pantallas nuevas se montan como islas
  React registradas en `src/dashboard/public-src/ui.tsx`.
- React lee el estado propiedad de `app.js` mediante `window.state` + `useAppVersion()`. No crear
  un segundo store para el board.
- `plan:render` hoy vive en `scripts/plan-render.ts` y lee `plan_doc_segments`.
- Un ítem `done` exige `commit_sha`, pero antes del commit de cierre ese SHA aún no existe. El
  flujo actual usa temporalmente `HEAD` y ejecuta `plan:reconcile` después del commit. El board
  debe mostrar esa transición como cierre pendiente, sin fingir que ya está respaldada.

## Decisiones cerradas

### 1. Superficie de producto

Añadir una pantalla React llamada `PlanBoardScreen`, accesible como `Plan` desde el grupo de
operador del sidebar. No crear otra app, página HTML independiente ni dependencia visual.

Cada sprint se presenta como una sección en el orden de `position`. Dentro aparecen tres columnas:

1. `Listos`: abiertos sin dependencias abiertas.
2. `Bloqueados`: abiertos con al menos una dependencia abierta.
3. `Cerrados`: ítems `done`.

Cada tarjeta muestra ID, emoji de delegación, título y bloque cuando exista. Las dependencias se
muestran como aristas textuales inequívocas: chips `DEP → ITEM`, con la dependencia abierta en
ámbar y cerrada en verde. No usar canvas, D3 ni auto-layout; el grafo requerido es la relación
dirigida visible y navegable, no un diagrama decorativo.

Estados obligatorios: loading, error, vacío, listo, bloqueado, cierre en curso y error de mutación.
Todos los textos nuevos deben existir en inglés y español en `public/i18n.js`.

### 2. Contrato HTTP

Crear `src/dashboard/handlers/plan.ts` y registrar estas rutas en `src/dashboard/server.ts`, todas
mediante `withDashboardProject()`:

#### `GET /api/plan`

Respuesta 200:

```json
{
  "items": [
    {
      "id": "S.6",
      "sprint": "Sprint 30",
      "block": "Bloque S",
      "delegation": "🔍",
      "title": "Pantalla Sprint Board en el dashboard",
      "status": "open",
      "position": 5,
      "commitSha": null,
      "closedAt": null,
      "dependsOn": ["S.5"],
      "blockedBy": [],
      "ready": true
    }
  ]
}
```

Reglas:

- `dependsOn` contiene todas las aristas, ordenadas por la posición del ítem dependencia.
- `blockedBy` contiene únicamente dependencias cuyo estado no sea `done`.
- `ready` es `status === "open" && blockedBy.length === 0`.
- El handler comprueba que `<project.root>/PLAN.md` existe y que su contenido coincide con
  `renderPlan(database)`. Si falta o está desincronizado, responde 409; nunca muestra ni muta una
  DB que podría corresponder a otro checkout.

#### `PUT /api/plan/items/:id/dependencies`

Body exacto: `{ "dependsOn": ["S.5", "R.8"] }`.

- Validar el ID de URL con `validateTaskId()` y que `dependsOn` sea un array de IDs únicos.
- Rechazar con 404 ítems inexistentes.
- Rechazar autorreferencia y cualquier ciclo directo o transitivo con 409.
- Rechazar cambios sobre un ítem `done` con 409.
- Guardar todas las aristas en una transacción; reutilizar `setDeps()` después de validar.
- Responder el mismo item enriquecido que devuelve `GET /api/plan`.
- Esta operación no toca `PLAN.md`: S.4b dejó `plan_item_deps` fuera del render del markdown.

#### `POST /api/plan/items/:id/prepare-close`

Sin body. Solo se admite para un ítem `open` cuyo `blockedBy` esté vacío.

El endpoint realiza una transición recuperable:

1. Verifica nuevamente que el `PLAN.md` del proyecto coincide byte a byte con `renderPlan()`.
2. Resuelve `git rev-parse HEAD` en `project.root` y usa ese SHA únicamente como valor provisional
   para satisfacer el `CHECK` de SQLite.
3. En una transacción, llama `closePlanItem(id, provisionalSha, now)` y cambia exactamente el
   encabezado del segmento de ese ítem de `- [ ] **<ID> —` a `- [x] **<ID> —`. Cero reemplazos
   globales y exactamente un segmento afectado.
4. Renderiza el documento completo y reemplaza `<project.root>/PLAN.md` mediante archivo temporal
   en el mismo directorio + `rename`, nunca con escritura directa.
5. Si falla la escritura o la transacción, restaura tanto la fila/segmento como el archivo original
   y responde error. No puede quedar DB cerrada con markdown abierto, ni al revés.
6. Responde 200 con `{ "item": <item enriquecido>, "commitPending": true }`.

La UI debe llamar a la acción **“Preparar cierre”** y, al terminar, mostrar: “Cierre preparado;
falta el commit y `bun run plan:reconcile`”. No afirmar “cerrado” todavía. El endpoint no ejecuta
`git add`, `git commit`, hooks, ni borra el spec: esas acciones pertenecen al protocolo del agente.

Después del commit de cierre, `bun run plan:reconcile` reemplaza el SHA provisional por el SHA real.
El estado durable final solo es válido si `git show --stat <commit_sha>` incluye `PLAN.md`.

### 3. Lógica compartida

Extraer `renderPlan(database)` desde `scripts/plan-render.ts` hacia un módulo importable bajo
`src/db/plan-doc.ts`. `scripts/plan-render.ts` queda como adaptador CLI y reexporta la función para
no romper imports existentes.

En `src/db/plan-items.ts` añadir funciones pequeñas y testeables para:

- listar ítems con `dependsOn`, `blockedBy` y `ready` sin N+1 queries;
- detectar si un conjunto de dependencias produciría un ciclo;
- preparar el cierre coordinado con `plan_doc_segments`.

No cambiar el esquema ni crear una migración: las tablas actuales alcanzan.

### 4. Integración con la UI existente

En `src/dashboard/public/app.js`:

- añadir estado `planItems`, `planStatus` y `planMutation`;
- añadir `fetchPlan()`, incluirlo en `fetchAll()` y refrescarlo después de cada mutación;
- añadir `plan` a `NAV` como pantalla de operador;
- exponer por `window.OrchestOS` únicamente `fetchPlan`, `setPlanDependencies` y
  `preparePlanItemClose`.

En `src/dashboard/public/screens-ops.js`, registrar `SCREENS.plan` con `react: true` y host
`<div data-island="screen-plan"></div>`.

En `src/dashboard/public-src/ui.tsx`, registrar `screen-plan` → `PlanBoardScreen`.

La isla usa `appState()`, `useAppVersion()` y `screenApi()` como Specs/Skills. Puede usar estado
React local solo para selector abierto, confirmación y mutación en curso. Los datos del plan siguen
perteneciendo a `window.state` hasta que el bloque UI retire el vanilla.

La edición de dependencias es inline: botón “Editar dependencias”, lista de checkboxes de todos los
ítems excepto el propio, `Guardar` y `Cancelar`. Al guardar, deshabilitar controles hasta recibir
respuesta. Si el backend devuelve ciclo/409, mostrar el mensaje y conservar la selección para que
Carlos pueda corregirla.

“Preparar cierre” solo aparece habilitado en tarjetas `ready`. Exige confirmación inline con ID y
título; no usar `window.confirm()`.

Regenerar `src/dashboard/public/dist/ui.js`, `.map` y `ui.css` mediante `bun run build:ui`; no editar
los artefactos generados a mano.

## Archivos previstos

- `src/db/plan-doc.ts` (nuevo)
- `src/db/plan-items.ts`
- `scripts/plan-render.ts`
- `src/dashboard/handlers/plan.ts` (nuevo)
- `src/dashboard/server.ts`
- `src/dashboard/types.ts`
- `src/dashboard/public/app.js`
- `src/dashboard/public/screens-ops.js`
- `src/dashboard/public/i18n.js`
- `src/dashboard/public-src/islands/screens/PlanBoardScreen.tsx` (nuevo)
- `src/dashboard/public-src/islands/screens/screen-api.ts`
- `src/dashboard/public-src/ui.tsx`
- `src/dashboard/public-src/styles/ui.css`
- `src/dashboard/public/dist/*` generados
- tests unitarios/integración bajo `src/db/` y `src/dashboard/__tests__/`
- `scripts/ui-gates/s6-sprint-board.mjs` (nuevo, escrito por el ejecutor; corrido por el revisor)
- `scripts/s6-live-evidence.json` (nuevo, generado únicamente durante la verificación independiente)

El ejecutor debe declarar un scope que cubra exactamente estas familias y registrar en el handoff
cualquier desviación. `NEXT_ACTIONS.md`, S.7, UI.8 y otros hallazgos quedan fuera.

## Pruebas que debe dejar verdes el ejecutor

### Backend

1. GET devuelve todos los ítems, dependencias, `blockedBy` y `ready` en orden estable.
2. GET responde 409 cuando PLAN.md no coincide con el render de la DB.
3. PUT persiste dependencias y GET posterior las refleja.
4. PUT rechaza duplicados, inexistentes, autorreferencia, ítem cerrado y ciclo transitivo.
5. Preparar cierre rechaza ítem inexistente, cerrado y bloqueado.
6. Preparar cierre actualiza una sola fila y un solo segmento, escribe PLAN.md byte-exacto y
   devuelve `commitPending: true`.
7. Fallo de filesystem no deja cambio parcial en DB ni en PLAN.md.
8. Las rutas mutantes conservan el gate CSRF global del servidor.

Usar `ORCHESTOS_HOME` y repositorios temporales; ninguna prueba toca la DB o PLAN.md reales.

### UI

1. La pantalla está registrada en nav, command palette y `SCREENS`.
2. Renderiza loading/error/vacío y los tres grupos por sprint.
3. Las aristas `DEP → ITEM`, los bloqueadores y la delegación son visibles.
4. Guardar dependencias llama el endpoint correcto, espera la respuesta y refresca.
5. Un 409 conserva la selección y presenta el error.
6. Preparar cierre está deshabilitado para bloqueados y requiere confirmación inline para listos.
7. El flujo exitoso muestra el aviso de commit pendiente.

No añadir tests que solo repitan literales de la implementación; cubrir estados y transiciones.

## Gate vivo que escribirá el ejecutor y correrá el cerebro

`scripts/ui-gates/s6-sprint-board.mjs` debe crear un repo-fixture temporal con tres ítems repartidos
en dos sprints, sembrar la DB bajo el `ORCHESTOS_HOME` que entrega el wrapper, iniciar el dashboard
real en un puerto libre y abrir Chromium con Playwright.

Secuencia obligatoria:

1. Abrir Plan desde el sidebar, no navegando directamente por JavaScript.
2. Confirmar dos secciones de sprint, IDs/títulos y cero errores de consola/página.
3. Editar B para depender de A y guardar.
4. Confirmar en DOM y API que B pasa de listo a bloqueado y aparece `A → B`.
5. Recargar la página y confirmar que la arista persiste desde SQLite.
6. Preparar cierre de A desde la tarjeta y confirmar el mensaje de commit pendiente.
7. Confirmar que A aparece cerrado y B pasa a listo sin recarga manual.
8. En el repo-fixture, crear el commit de cierre con hooks deshabilitados solo para el fixture y
   ejecutar `bun run plan:reconcile` contra su home aislado.
9. Verificar que el SHA durable de A es el commit recién creado, que `git show --stat <sha>` incluye
   PLAN.md y que `bun run plan:render` es byte a byte idéntico al PLAN.md del fixture.
10. Guardar screenshot y escribir `scripts/s6-live-evidence.json` con resultados de DOM, API, DB,
    SHA, comparación byte a byte y errores de consola.

El cerebro lo ejecutará así:

```sh
bun run gate:evidence -- --label S.6 -- bun run scripts/ui-gates/s6-sprint-board.mjs
```

El script limpia únicamente su repo-fixture temporal. No crea ni borra manualmente el home de
evidencia; eso pertenece a `gate:evidence`.

## Gates finales reservados al cerebro

- Revisar el diff completo y confirmar que no incluye trabajo vecino.
- `bunx tsc --noEmit`.
- Tests específicos de DB/API/UI.
- `bun run test:coverage`.
- `bun run lint`, juzgado por exit code.
- `bun run build:ui` y confirmar que el diff generado es reproducible.
- Gate vivo anterior contra dashboard y Chromium reales.
- Prueba negativa de ciclo y de cierre bloqueado contra el servidor real del fixture.
- `git diff --check`.

Solo el cerebro, después de esos gates, mueve la evidencia a `docs/done/`, marca S.6 `[x]`, añade
`Ejecutado por: <modelo> · Spec: docs/specs/S.6.md`, cita en la línea `Gate en vivo:` los blobs
staged `scripts/ui-gates/s6-sprint-board.mjs` y `scripts/s6-live-evidence.json`, y borra este spec en
el mismo commit. El ejecutor no hace ninguno de esos pasos y no crea el commit final.

## Condiciones de parada del ejecutor

Parar y generar `bun run agent:handoff` sin cerrar S.6 si ocurre cualquiera:

- necesita cambiar el esquema SQLite o agregar `project_id` a las tablas del plan;
- no puede mantener DB y PLAN.md recuperables ante error;
- el ciclo de dependencias no se puede rechazar antes de escribir;
- necesita ejecutar Git desde el endpoint del dashboard;
- el board requiere una librería de grafos o un rediseño del shell;
- algún test/gate base falla por trabajo ajeno;
- aparece una decisión de producto no resuelta por este documento.
