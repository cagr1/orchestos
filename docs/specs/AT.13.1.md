# AT.13.1 — run-graph usa el contexto de proyecto fresco (hermano de AT.13)

`src/dashboard/handlers/run-graph.ts:82` lee `deps.loadContext(root)` (registro de DB sin refrescar) aunque
`handleApiRunGraph` ya es async. Cambiar:
- `:24` importar `refreshProjectContext` en vez de `loadContext as realLoadContext`.
- `deps` (`:58` y el reset de `:164`): campo `loadContext: (root: string) => Promise<string>` con default
  `async (root) => (await refreshProjectContext(root))?.agentsMd ?? ''`.
- `:82` `const projectContext = await deps.loadContext(root)` — antes de `states.set(... 'running' ...)`, como hoy.
- `src/dashboard/__tests__/run-graph-api.test.ts:116,163`: mocks `async () => ''`.
No tocar nada más. Verificación: `bunx tsc --noEmit`, `bun test src/dashboard/__tests__/run-graph-api.test.ts`.
