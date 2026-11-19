# GOV.4 — Tres controles para que el cerebro no gaste su cupo en trabajo de Codex

GO de Carlos el 2026-11-19. Evidencia y motivo en `PLAN.md` § GOV.4. Solo hooks de este repo (`.claude/hooks/`), con
sus tests en `tests/hooks/`. Patrón de test: `tests/hooks/brain-no-code.test.ts` (`runHook` con `spawnSync('node',
[HOOK_PATH])`, entrada JSON por stdin; usar un directorio de estado temporal por variable de entorno, como
`SUBAGENT_BUDGET_ROOT` en `subagent-budget.js:17`).

## 1. Subagentes de Claude para mapear código → negados (`subagent-budget.js`)
- En `PreToolUse` de `Agent` (`subagent-budget.js:188`), antes del presupuesto: si `tool_input.subagent_type` es
  `Explore`, `general-purpose`, `Plan`, `fork` o falta (Claude Code usa `general-purpose` por defecto), negar con:
  "Mapear o leer código va a Codex: ~/.agent-method/bin/delegate leer \"<pregunta>\" (GOV.4). Subagentes de Claude
  solo para web-fetch o guías de Claude Code."
- Se permiten los demás tipos (`web-fetch`, `claude-code-guide`, `statusline-setup`, …) con el presupuesto actual.
- Escape explícito: si `ORCHESTOS_ALLOW_CLAUDE_SUBAGENT=1` en el entorno del hook, no se niega (para cuando Carlos
  lo pida).

## 2. Fixes chicos con tope (`brain-no-code.js`)
- Hoy un Edit/MultiEdit de ≤20 líneas en código pasa siempre (`brain-no-code.js:15`, `:127-135`).
- Nuevo: estado por sesión en `.orchestos/brain-fixes/<session_id>.json` (directorio sobreescribible con
  `BRAIN_FIXES_ROOT`; crear si falta) con el número de Edit/MultiEdit chicos permitidos en código desde la última
  delegación.
  - Un fix chico = como mucho **2** Edit/MultiEdit (el código y su test). El 3.º se niega con:
    "Tercer Edit del cerebro desde la última delegación: reescribe el spec y re-delega a criterio (GOV.4)."
  - Se pone a 0 cuando el cerebro corre una delegación de escritura: `PreToolUse` de `Bash` cuyo comando contiene
    `agent-method/bin/delegate` seguido de `mecanico`, `criterio` o `criterio-alt` (no `qa`, `leer`, `analizar`).
  - Solo cuenta Edit permitidos (los que hoy pasarían); los negados no suman. Archivos fuera de código no cuentan.
  - `ORCHESTOS_ROLE=executor` sigue sin restricción (`brain-no-code.js:121`).
  - `SessionStart`: borrar el estado de esa sesión si el hook ya está registrado para ese evento; si no, no hace falta
    registrarlo (un `session_id` nuevo empieza sin archivo).
- El Bash que hoy niega no cambia.

## 3. Aviso por turnos (`context-budget.js`)
- Además del aviso por tokens, contar los turnos del cerebro en el transcript (`transcript_path`, JSONL de Claude
  Code): mensajes `type: "assistant"` distintos por `message.id` que tengan al menos un bloque `tool_use`.
- Al llegar a **80**, una sola vez por sesión (estado en el `.orchestos/context-budget.json` que ya existe, por
  `session_id`), imprimir: "80 turnos del cerebro en esta sesión: sugiero /cut (GOV.4). Cada turno relee todo el
  contexto." Sin escribir handoff extra si el aviso de tokens ya lo hizo.
- Transcripts `opencode-session:` no se cuentan (no son JSONL).
- Leer el archivo de forma tolerante (línea inválida → se salta) y sin pasar de ~200 ms en un transcript de 5 MB.

## Qué no tocar
- La lógica de presupuesto de 2 subagentes, el umbral de tokens actual, los mensajes existentes.
- `.claude/settings.json` salvo que haga falta registrar un evento nuevo (decirlo en el reporte).

## Tests (deben fallar sin el cambio)
- subagent-budget: `Explore`, sin tipo y `general-purpose` → deny con el texto; `web-fetch` → permitido; con
  `ORCHESTOS_ALLOW_CLAUDE_SUBAGENT=1` → permitido.
- brain-no-code: 2 Edit chicos pasan, el 3.º se niega; tras un Bash `~/.agent-method/bin/delegate criterio x.md` el
  contador vuelve a 0; `delegate qa` no lo reinicia; `ORCHESTOS_ROLE=executor` nunca se niega; Edit en `docs/` no cuenta.
- context-budget: transcript sintético con 79 turnos → sin aviso; 80 → aviso una vez; segunda llamada → sin aviso;
  mensajes repetidos con el mismo `message.id` cuentan una vez.

## Gates
`bun test tests/hooks/`, `bunx biome check .claude/hooks tests/hooks`, `bunx tsc --noEmit`. El cerebro prueba cada
hook en vivo en esta sesión de Claude Code.
