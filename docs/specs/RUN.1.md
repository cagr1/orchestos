# RUN.1 — La tarjeta de una tarea fallida muestra por qué falló; sin botón `Retry`

## Decisión de Carlos (2026-11-05)
"No creo que el usuario deba hacer restart de una tarea fallida; si algo falló, es más valioso saber por qué que
volver a intentar." El reintento automático con el motivo del fallo (`MAX_RETRIES`, `src/run/qa.ts:284`;
`src/run/graph-runner.ts:422-595`) **se mantiene igual**. Cambia lo que ve el usuario en el hilo.

## Hoy
- `src/dashboard/handlers/task-report.ts:43-75`: el reporte lleva titular + `summary` (≤300 chars de
  `retry_reason` o `run.result`). Checks, veredicto QA y reporte del ejecutor no viajan.
- `src/dashboard/app/src/components/thread/TaskCard.tsx:432-438`: `Retry` para `failed` y `pending`.
- El detalle completo ya existe en Runs: `RunsEvidenceView.tsx:175` (`failureReason`, "Lo que reporta el ejecutor
  (no verificado)") y `:306-336` (checks deterministas, salida del check fallido, razones del QA). Reusar esa misma
  fuente de datos (la API que consume Runs), no duplicar consultas a la DB.

## Qué cambiar
1. **Reporte** (`task-report.ts`): cuando la tarea termina mal (`failed`, o `pending` con `retry_count`), `data`
   suma un `diagnosis` acotado y mecánico (sin LLM):
   - `cause`: la causa completa (no truncada a 300; tope 2 KB);
   - `failedCheck`: nombre/comando del primer check determinista que falló y su salida (cola, tope 2 KB), si hubo;
   - `qaReasons`: razones del veredicto QA, si hubo;
   - `executorReport`: lo que reportó el ejecutor (tope 1 KB), rotulado como no verificado;
   - `runId` para enlazar a la evidencia.
   Campos ausentes se omiten; nunca se inventan.
2. **Tarjeta** (`TaskCard.tsx`): en `failed` el diagnóstico va arriba del cuerpo: causa, check fallido con su salida
   (bloque mono, colapsable si pasa ~12 líneas), razones del QA, reporte del ejecutor con la etiqueta "not verified", y
   un enlace "View evidence" que abre ese run en Runs (la navegación que ya existe hacia Runs; si no hay una a un run
   concreto, abrir Runs con ese `runId` seleccionado). Mismo lenguaje visual que el resto de la tarjeta (className de
   componentes existentes; no sumar CSS a `styles.css`). Texto de UI en inglés como el resto.
3. **Quitar `Retry`** de la tarjeta en `failed`. En `pending`:
   - sin corrida en curso porque se interrumpió (p. ej. reinicio del dashboard, caso `restart-mid-run`): la tarjeta
     dice que se interrumpió y conserva una sola acción "Resume" (no es un fallo de la tarea);
   - `pending` por árbol sucio ya tiene "Commit & Run": sin cambios.
   Quitar el cableado muerto (`onRetry`/`onRetryTask`) solo si queda sin consumidores; el `Run` de Settings → Tasks no
   se toca.
4. **Gates**: actualizar `scripts/ui-gate/flows/chat-retry-report.mjs` (hoy exige `Retry`) para comprobar que una
   tarea fallida muestra el diagnóstico y no ofrece `Retry`, y `restart-mid-run` si depende del botón. Tests unitarios
   de `task-report` para `diagnosis` (con check fallido, con QA, sin run, topes de tamaño).

## Qué no tocar
La política de reintentos (`qa.ts`, `graph-runner.ts`, `harness.ts`), Runs, Settings. No commitear ni tocar
`PLAN.md`/`NEXT.md`.

## Cómo se verifica
- `bun run typecheck`, `bun run lint`, `bun run test:coverage`.
- `bun run ui:gate chat-retry-report restart-mid-run tasks` (fuera del sandbox), verdes.
- Captura del hilo con una tarea fallida real mostrando el diagnóstico y sin `Retry` (la deja el gate en su `runDir`;
  pegar la ruta).
