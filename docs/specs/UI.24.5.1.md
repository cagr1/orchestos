# UI.24.5.1 — dos ui-gates que aún leen el texto viejo del reporte de tarea (mecánico)

Ítem: UI.24.5.1 (preflight con `--item UI.24.5.1`). Contexto: UI.24.5 (commit local, sin pushear) dibuja cada tarea como una tarjeta
`[data-task-id="<id>"][data-task-state="held|running|failed|blocked|pending|done"]` (`src/dashboard/app/src/components/thread/TaskCard.tsx`).
Ya no hay texto "Task ready to run" ni el reporte "✓ Task `<id>` done" dentro de `div.prose`; la etiqueta de estado
visible es "Ready to run" / "Running" / "Failed" / "Uncommitted changes" / "Pending" / "Done" y el resumen del
reporte va dentro de la tarjeta. Los cambios sin commitear en `IDEAS.md`, `NEXT.md`, `orchestos.config.yaml`,
`.orchestos/feature-status.json`, `runs-summary.json` son ajenos: no tocarlos. No commitear. PROHIBIDO `git stash`,
`git checkout`, `git restore`. El candado writer-lock lo tiene la sesión que te delega (claude): puedes editar.

Cambios (solo estos dos archivos):
1. `scripts/ui-gate/flows/restart-mid-run.mjs:134-156` (`showChat`): en vez de recorrer `div.prose` buscando el
   `taskId` en el texto, leer `page.locator(\`[data-task-id="${taskId}"]\`)` y devolver true si existe y su
   `innerText` cumple `expected`. No cambiar las llamadas (`:303,378,435`) salvo que `expected` no pueda casar con
   el texto de la tarjeta: entonces casar contra `data-task-state` y decir cuál y por qué. Leer `TaskCard.tsx` para
   saber qué texto muestra cada estado (el resumen del reporte, p. ej. "Interrupted…", va dentro de la tarjeta).
2. `scripts/ui-gate/flows/chat-roles.mjs:162`: `heldTaskLabel` pasa a
   `page.locator('[data-task-state="held"]').last()` (el resto del flujo, `visible(heldTaskLabel…)`,
   `innerText()`, igual). Comprobar en el resto del archivo que no queden lecturas del texto viejo.

Verificación (pegar salida real): `bunx biome format --write` y `bunx biome check` de los 2 archivos;
`bun run ui:gate restart-mid-run chat-roles` (los dos deben pasar; si `chat-roles` falla por el orquestador real que
responde sin crear tarea —`autoTask` null en el detalle— decirlo con el detalle, no es de este cambio).
