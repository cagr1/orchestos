# Bloque CLI — actualizaciones de los CLIs

## CLI.2 — Actualizaciones de CLI en la barra inferior (2026-11-22)

- Base: CLI.1 (`dde94d7d`) — Codex/Claude, versión de npm, botón Update solo en Settings › Providers, `<cli> update`.
- Nuevo: entrada "N CLI updates" en la barra inferior con popover (actual → última, Update, Update all); OpenCode con
  la última de GitHub releases; método de instalación detectado por la ruta real (npm, bun, brew, curl, standalone,
  native; desconocido → se niega); negativa si una tarea o turno de chat usa el CLI; `GET /api/cli-updates` en fondo.
- Gates: `bun run typecheck` 0, `bun run lint` 0, 98 tests de los archivos tocados en verde; qa gpt-6.1-sol (r1: 1
  alta + 2 medias corregidas; r2: sin defectos).
- En vivo: OpenCode 2.3.0 → 2.3.2 por el botón Update del popover; `opencode --version` → v2.3.2 —
  `docs/done/evidence/CLI.2-live.json`.
- Sin probar: Windows (los shims `.cmd` de npm quedan como método desconocido y se niegan), brew y bun en vivo.
