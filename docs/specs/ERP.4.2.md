# ERP.4.2 — El intento fallido de una tarea se ve en el chat y en Tasks

## Problema (reproducido en vivo, piloto ERP.4)
Una tarea lanzada desde el chat falló el contrato ("missing declared output(s): …"). La tarea vuelve a
`status: pending` con `retry_count: 1`, `retry_reason` y `qa_verdict: fail`. No hay reintento automático: el
reintento es manual ("Run Next Task").
- El servidor SÍ agregó al hilo el reporte `⟳ Task … pending · retry scheduled` (`task-report.ts:28`), pero el chat
  nunca lo mostró: el polling de `src/dashboard/app/src/App.tsx:314-317` hace `continue` mientras el estado sea
  `pending` o `running`, sin recargar los mensajes.
- "retry scheduled" es falso: nada lo reintenta.
- Settings → proyecto → Tasks (`OrchestSettingsView.tsx:2537-2567`) muestra solo `PENDING`.

## Cambio
1. `src/dashboard/handlers/task-report.ts` (`buildTaskReport`): cuando `status === 'pending'`, el encabezado pasa a
   `✗ Task \`<id>\` failed · attempt <retry_count>/<MAX_RETRIES> · <provider>/<model>` (el sufijo provider/model
   igual que en las otras ramas, solo si hay run). `MAX_RETRIES` se importa de `src/run/qa.ts:282` (exportarlo si no
   lo está; no duplicar el número). El cuerpo (`> motivo`) no cambia. Si `retry_count` falta o es 0, usar el
   encabezado `✗ Task \`<id>\` pending` + sufijo (sin "attempt").
2. `src/dashboard/app/src/App.tsx:317`: una tarea `pending` cuyo intento ya falló deja de contar como "en curso".
   Condición de "intento fallido": `task.status === 'pending' && (task.retryCount ?? 0) > 0 && Boolean(task.retryReason)`.
   En ese caso NO hacer `continue`: seguir por el camino existente que carga los mensajes del hilo y refresca cuando
   aparece el reporte (`reportCount > 1`). `running` y `pending` sin intento fallido siguen igual. No cambiar el resto
   del efecto (tope de 6 intentos, `reportedTaskIds`).
   Extraer la condición a una función pura exportada en `src/dashboard/app/src/api/tasks.ts`
   (`isTaskStillRunning(task)`: `true` para `running` y para `pending` sin intento fallido) y usarla en `App.tsx`.
3. `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx`, tarjeta de tarea (`:2537-2567`): si
   `task.retryCount > 0 && task.retryReason`, agregar bajo la descripción una línea
   `Attempt {retryCount}/3 failed: {retryReason}` (el 3 como constante nombrada del frontend; si ya existe una
   compartida, usarla). **No agregar CSS ni clases nuevas**: usar solo clases que ya se usan en este mismo archivo
   para texto de error/aviso (buscar en el archivo; si no hay ninguna de error, usar `text-xs text-app-muted` como
   la descripción). `styles.css` no se toca.
4. Tests:
   - `src/dashboard/handlers/task-run-reconcile.test.ts:83` afirma `'retry scheduled'`: actualizar a la redacción
     nueva (`failed · attempt 1/3` si el fixture tiene `retry_count: 1`; ajustar el fixture si hace falta).
   - Test de `buildTaskReport` para la rama `pending` con `retry_count: 2` → contiene `failed · attempt 2/3` y el motivo.
   - Test de `isTaskStillRunning` junto a `src/dashboard/app/src/api/tasks.test.ts`: `running` → true; `pending` sin
     reintento → true; `pending` con `retryCount: 1` y motivo → false; `done` → false; `failed` → false.
   - No tocar los tests existentes de `tasks.test.ts:91-132` (el mensaje `Retry scheduled:` de `runTask` es otro
     camino) salvo que dejen de compilar.

## No tocar
- `src/run/graph-runner.ts`, `harness.ts`, la política de reintentos (sigue manual), el check verde de la barra
  lateral de Dev, `scripts/`, `PLAN.md`, `NEXT.md`, `styles.css`.
- `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json` tienen cambios sin
  commitear ajenos: no tocarlos.
- `src/dashboard/handlers/project.ts` y `src/dashboard/__tests__/draft-ignored-outputs.test.ts` pueden tener cambios
  sin commitear de otro ítem (ERP.4.3): son ajenos, no tocarlos.

## Verificación (la corre el ejecutor)
- `bun run typecheck`
- `bun test src/dashboard/handlers/task-run-reconcile.test.ts src/dashboard/app/src/api/tasks.test.ts` + los tests nuevos
- `bunx biome check` sobre los archivos tocados
- `bun run build:app`

NO correr `test:coverage` ni `ui:gate`, ni detenerse por el baseline (en el sandbox dan fallos falsos; se verifica
fuera). El candado de escritor `ocupado: claude …` es el cerebro que delega: se puede editar. No commitear.
