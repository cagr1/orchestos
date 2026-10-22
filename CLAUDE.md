# OrchestOS — Instrucciones para Claude / LLMs

Motivos e incidentes detrás de cada regla: `docs/done/claude-md-historia.md` (histórico).

## Regla cero — vale para cualquier LLM (estricta)

Este archivo, `PLAN.md` y `AGENTS.md` aplican igual a Claude, Codex, DeepSeek, opencode o cualquier modelo/CLI. Orden
obligatorio en `docs/agent-work-protocol.md`. Antes de tocar código:

    bun run agent:preflight -- --item <ID> --agent claude

Ningún botón, config o pantalla se entrega sin verificarlo en vivo (dashboard real, no mocks). Si no se pudo verificar,
se dice en vez de reportarlo como listo.

## Identidad git — prohibido modificar

Nunca `git config user.email|user.name`, ni `--local`/`--global` salvo pedido explícito. Correcta: `cagr1` /
`cagr_14@hotmail.com`. Cambiarla rompe el mapa de contribuciones de GitHub.

## Reglas generales

- Sin `--no-verify` ni `git push --force` salvo pedido. No crear ni borrar ramas remotas sin confirmación.
- **Memoria evolutiva:** toda mejora de proceso, hallazgo o regla se persiste en el mismo turno: `PLAN.md` (cadenas
  activas y evidencia), `AGENTS.md`/`CLAUDE.md` (reglas), `CONTEXT.md` (arquitectura/estado). Al cambiar una regla se
  conserva su historial.
- **Push automático:** `git push origin master` tras cada 2-3 commits, sin pedirlo; no durante debugging activo ni con
  motivo para retener. Nunca `--force`.
- **Plan antes de cambios grandes:** si toca varios módulos o redefine un comportamiento central, plan corto (alcance,
  pasos, qué queda fuera) y esperar GO de Carlos. Fixes de un archivo/función no lo necesitan.

## Hooks de git

`bun run hooks:install` instala ambos. pre-commit (`scripts/pre-commit.sh`): `tsc --noEmit`, `security:secrets`,
`ledger:gate`, export de `runs-summary.json`, y aborta si el hook difiere de su fuente. pre-push (`scripts/pre-push.sh`):
`bun run test:coverage`; si cambia el chat (`src/dashboard/handlers/chat*`, chat del front, `src/run/executors/`) corre
también `chat-streaming` y `codex-live`. Al cerrar un ítem de chat:
`bun run gate:evidence -- --label <ítem>-chat-live -- bun run ui:gate chat-streaming codex-live`. Gates en vivo con home
temporal: `bun run gate:evidence -- --label <gate-id> -- <comando>` (`AGENTS.md` § "Evidencia de gates reales").

## Verificar contra CI, no contra tu máquina

- Correr el comando exacto del workflow, `bun run test:coverage`, nunca `bun test` a secas.
- Lo que dependa de un binario del sistema va detrás de una sonda inyectable (`ToolchainProbe`), nunca un spawn directo
  en el test.
- Umbrales de `scripts/check-coverage.ts`: se calibran contra el log de CI, con margen, y solo suben.
- Bun no ve cambios a `process.env` en runtime (`os.homedir()`, `Bun.spawn` sin `env`): pasar el env o escribir la
  config en el fixture.
- Fixtures con `git commit` llevan identidad propia (`git -c user.name=… -c user.email=… commit`).
- El pre-push corre con HOME temporal, PATH mínimo y gitconfig con `user.useConfigOnly = true`.
- Estado de CI: `gh run list --workflow CI`. CI rojo es prioridad. `Mutation Shards` rojo suele ser la suite normal
  fallando, no mutación.

## Higiene de contexto

La config de carga vive en `.claude/settings.json` versionado (`disabledMcpServers`,
`CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1`), no en la cuenta. `.claude/hooks/startup-guard.js` avisa al arrancar si hay
conectores no declarados, plugins fuera de la allowlist o peso sobre 9k tokens; si avisa, el cerebro lo dice antes de
trabajar, una vez. Detalle: `docs/specs/CTX-GUARD.md`.
