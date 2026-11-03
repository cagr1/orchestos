# Bloque TCLI — cerrados

## Archivado 2026-11-03 desde PLAN.md (DOC.5)

<a id="bloque-tcli-seccion-abiertos---fiabilidad-de-los-gates-y-doc"></a>
### Abiertos — fiabilidad de los gates y documentación

- [x] **TCLI.3 — ⚡ Detección común de CLIs funcionales: instalado → versión → sesión, sin efectos secundarios.** (abierto 2026-11-02)
  Carlos 2026-11-02 (opción recomendada, como T3 Code): hoy "funcional" = binario en el PATH (`cli-discovery.ts`);
  la sesión solo se mira en Settings y solo para Claude/Codex por archivos (`providers.ts:160`). Un solo estado por
  CLI, cacheado, que consumen Settings, el "+" de Dev y la barra de cuotas. Sondas medidas en esta máquina:
  `claude auth status` (JSON `loggedIn`), `codex login status` ("Logged in using ChatGPT", 18 ms), `opencode auth
  list` (credenciales, 0,5 s). CLI sin sesión: marcado en Settings, fuera del "+" y de la barra. Sondas inyectables
  (`ToolchainProbe`), nunca spawn directo en tests.
  Hecho: `src/run/executors/cli-health.ts` (estado por CLI cacheado 5 min, sondas en paralelo con tope de 5 s,
  inyectables); `/api/providers` y `/api/chat/cli-models` llevan `auth` y `functional`; el "+" de Dev filtra
  `chat && functional`. En vivo (cerebro, 4343): claude 2.1.316, codex 0.166.0 y opencode 1.19.0 con `auth ok` y
  `functional`; deepseek/gemini/kimi/glm no instalados. Gates del cerebro: lint, `test:coverage` 2201/0.
  r2: el ui-gate `providers` fallaba 2 pasos (los CLIs falsos del fixture no respondían a las sondas de sesión); ahora
  responden `auth status`/`login status` y el gate sigue verificando versión, cuenta, plan y comando de login.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TCLI.3-live.json`.
  Ejecutado por: codex gpt-6.1-sol (criterio r1, r2) · revisión Opus · Spec: docs/specs/TCLI.3.md
- [x] **TCLI.1 — ⚡ Registro de ejecutores de tareas y elección por registro.** (cerrado 2026-10-22) (GO de Carlos 2026-10-22: "no hay un CLI
  de preferencia, eso es primordial") Un módulo registra el ejecutor de tareas de cada CLI; harness, auto-route, evals,
  cascada, CLI y handler de tareas lo consultan en vez de ramas fijas. Un CLI registrado sin ejecutor de tareas falla
  con mensaje visible, nunca `single-shot` en silencio. Fuera de TCLI: ejecutores reales de DeepSeek/Gemini/Kimi/GLM
  (no instalados, no verificables en vivo) y el chat. Spec: docs/specs/TCLI.1.md
  Hecho: `src/run/executors/task-engines.ts` (registro CLI ↔ motor; built-ins con carga diferida porque `codex.ts` abre
  la DB y LIMP.3 lo prohíbe al importar config); `taskEngine` sale de `CliDefinition`; harness, auto-route, evals,
  engine-cascade, `cli.ts` (un chequeo de binario), `handlers/tasks.ts`, `task-report.ts` y `schema.ts` consultan el
  registro. Los ids persistidos no cambian (`external` = Claude). Un CLI de `KNOWN_CLIS` sin ejecutor como Ejecutor →
  "<label> no tiene ejecutor de tareas en OrchestOS…", ya no `single-shot`. Evidencia (cerebro): typecheck y lint
  limpios, `test:coverage` 1971/0, `task-engines.test.ts` nuevo, `ui:gate tasks` 31/31 vía `gate:evidence`
  (`TCLI.1-tasks-live`). Anotado: el ejecutor vio fallar 1 vez `codex-engine.test.ts` "timeout … timed out" (678 ms,
  también sobre HEAD limpio); al cerebro pasó 3/3 suelto y en la suite: intermitente por tiempo, sin ítem hasta repetir.
  Ejecutado por: claude sonnet (criterio) · Spec: docs/specs/TCLI.1.md
- [x] **TCLI.2 — ⚡ Tipos y front derivados del registro.** (cerrado 2026-10-22) `dashboard/types.ts:216,276`,
  `handlers/runs.ts:81`, `app/src/types/orchestos.ts:7`, `App.tsx:876-886`, `load.ts:146`: sin uniones cerradas de CLI.
  Hecho: tipos de motor abiertos; `/api/system/executor-modes` = local + `KNOWN_CLIS` + api, con `taskEngine` (tiene
  ejecutor de tareas) y `session` (`chat`/`terminal`/`null`, del adaptador de chat); Settings no ofrece al rol Ejecutor
  un CLI sin ejecutor (`model-catalog.ts` expone `taskEngine`); el modal de chat nuevo filtra por `session` en vez del
  caso especial de OpenCode (un Gemini instalado ya no se ofrece para chat y da 400); `load.ts` usa `KNOWN_CLIS`;
  `App.tsx` pasa el agente tal cual (`chat-sessions.ts:270-279` rechaza con 400 los que no tienen adaptador). Además:
  arreglado el intermitente de `codex-engine.test.ts` "timeout … timed out" (2 veces hoy) y su hermano en opencode: el
  mock armaba el retardo de salida al construirse, antes del spawn; ahora en `start()` al spawnear. Evidencia
  (cerebro): typecheck, lint, `ui:fidelity:jsx` limpios; `test:coverage` 1976/0; `gate:evidence` `TCLI.2-live`:
  `tasks` 31/31, `chat-roles` 10/10, `chat-continuity` 8/8. El filtro del Ejecutor no cambia nada visible hoy (los 3
  CLI instalados tienen ejecutor); lo cubre `executor-modes-endpoint.test.ts`. No se pudo probar la migración legacy
  con `gemini`: `resolveAgent` descarta agentes sin adaptador de chat antes de llegar ahí.
  Gate en vivo: navegador real (Playwright), `docs/done/evidence/TCLI.2-live.json`.
  r2 se lanzó primero a `mecanico` (Codex): no vio `AGENT_WRITER_TOKEN` y no escribió (trampa ya anotada en NEXT.md).
  Ejecutado por: claude sonnet (criterio) · Spec: docs/specs/TCLI.2.md
