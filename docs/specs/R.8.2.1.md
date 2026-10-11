# R.8.2.1 — Los turnos del chat no entran en "Recent runs" del contexto (spec)

GO de Carlos 2026-10-11. Hallazgo de cierre de R.8.2.

## Defecto (medido)
`chat.ts:~1205` llena "Recent runs" del system prompt con `listRunsByProjectId(project.id, 10)` / `listRuns(10)`, que
incluyen los runs `task_class='chat'` que deja cada turno. Así cada turno cambia el prompt del siguiente:
- Codex: `codexContextHash` (`codex-app-server.ts:46`) cambia → reenvía el system prompt entero como
  `<orchestos-context-update>` en cada turno desde el 2.º (~1.1k tokens que además se acumulan en el thread).
  Prueba aislada: cambiar solo `Now:` → mismo hash; +1 run de chat → hash distinto.
- Claude y Codex: en sesiones largas el tope de 10 se llena de turnos de chat y desaparecen los runs de tareas.

## Cambios
1. `src/db/runs.ts` — función nueva `listContextRuns(projectId: string | null, limit = 10): RunRecord[]`, misma forma
   que `listRunsByProjectId` / `listRuns` (usa `normalizeRunLimit`). SQL con
   `(task_class IS NULL OR task_class != 'chat')`, filtro por `project_id = ?` solo si `projectId` no es null.
   Orden `created_at DESC`.
2. `src/dashboard/handlers/chat.ts` (~1205) — `recentRuns = listContextRuns(project.id ?? null, 10)`. Nada más en
   ese bloque.
3. `scripts/ui-gate/flows/chat-context.mjs`:
   - En el seed SQL, agregar un segundo run `task_class='implement'` con modelo `'gpt-6-luna via Codex CLI'`, provider
     `codex`, mismo proyecto. Así el paso de Claude que exige `/codex · gpt-6-luna/` sigue probando la normalización
     del nombre del modelo, ahora con un run de tarea.
   - La consulta de `codexRun` también selecciona `id`. El paso de Claude añade la condición
     `!claudePrompt.includes(codexRun.id)`: el run de chat de Codex ya no aparece en el contexto de Claude.
4. `scripts/ui-gate/flows/chat-continuity.mjs` — el paso `Codex thread remembers sentinel without transcript
   duplication` añade la condición `!resumedCapture.includes('<orchestos-context-update>')`.

## Tests unitarios
`listContextRuns`, en el archivo de tests de `runs.ts` que ya exista; si no existe, uno nuevo en `src/__tests__/`
con el mismo patrón de DB aislada:
- con un run chat y otro implement en el mismo proyecto, devuelve solo el implement;
- con `projectId` null, ve runs de cualquier proyecto, pero sin los de chat;
- respeta el límite.

## No tocar
`listRuns` / `listRunsByProjectId` y sus otros llamadores (Runs, Usage, export) siguen viendo los runs de chat.
`codexContextHash`. El resto de `buildChatSystemPrompt`.

## Verificación (cerebro)
- `bunx tsc --noEmit`
- `bun run test:coverage`
- `bun run gate:evidence -- --label R.8.2.1 -- bun run ui:gate chat-context chat-continuity`
