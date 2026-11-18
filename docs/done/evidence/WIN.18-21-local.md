# Verificación focalizada en Windows, 2026-11-18

Clon en una ruta con espacios. Base `9704ed84`, Bun 1.3.14. La suite de diagnóstico de la base
(`bun run test:coverage` con las utilidades de Git for Windows disponibles) reportó 2939 pass,
92 fail, 6 skip y 2 errors. Sirvió para reproducir los fallos, no como prueba oficial de la demo.

- WIN.18, WIN.20 y WIN.21: `bun test --timeout 15000 action-approvals.test.ts worktree-contract.test.ts contract.test.ts tasks-api-init.test.ts usage-endpoint.test.ts context-update-safety.test.ts max-output-tokens-callers.test.ts chat-cli-commands.test.ts auth-token.test.ts db-backup.test.ts config-permission-mode.test.ts orchestos-home.test.ts cli-health.test.ts no-native-model-select.test.ts`: 136 pass, 0 fail. Los tres casos `context --force` pasaron aislados y habían fallado en cobertura global con estado 0 pero sin escrituras. Se mantiene abierto el diagnóstico de esa diferencia.
- WIN.19 y parte de WIN.6: `bun test --timeout 30000 chat-sessions.test.ts chat-r5-reliability.test.ts cli-search-path.test.ts chat-adapters.test.ts`: 46 pass y un fallo en el modelo estimado del fixture R.6. Corregido el modelo del fixture a `openai/gpt-4o`, `bun test --timeout 15000 src/dashboard/__tests__/chat-sessions.test.ts -t 'R.6 persiste'`: 1 pass, 0 fail. Los casos de Codex validaron el fallback y los turnos secuenciales con el ejecutable falso.
- `bun run typecheck` y `bun run lint`: exit 0 en Windows. Cobertura global del diff final y prueba oficial pendientes.

El fixture Claude usa un ejecutable nativo Windows para transmitir argv multilínea. El shim
`.cmd` del diagnóstico recortó ese argv. El soporte de Claude/OpenCode vía shim se mantiene abierto en WIN.6.
