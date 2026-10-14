# CI.12 — el candado de `tasks.yaml` puede quedar vacío tras un SIGKILL y bloquear 60 s

Spec ejecutado por `mecanico` (gpt-6-luna) el 2026-10-14: token en temporal `<lock>.<pid>.<uuid>.tmp` publicado con
`linkSync`, limpieza de temporales de PIDs muertos y tres tests en `src/__tests__/tasks-concurrency.test.ts`.
Detalle y evidencia: PLAN.md § CI.12.
