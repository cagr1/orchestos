# AT.6 — Lint en rojo: 3 archivos sin formatear/ordenar

Ejecutor: Luna. Implementa exactamente esto; si algo resulta imposible, para y repórtalo.
**No commitees y no toques `PLAN.md`.** El cierre lo hace el cerebro.

Preflight: `bun run agent:preflight -- --item AT.6 --agent luna`.

## Problema

`bun run lint` (biome check .) sale con exit 1: 5 errores, los 5 puramente mecánicos
(formato + orden de imports), en 3 archivos:

- `.claude/hooks/startup-guard.js` — formato.
- `tests/hooks/brain-no-code.test.ts` — formato + `assist/source/organizeImports`.
- `tests/hooks/startup-guard.test.ts` — formato + `assist/source/organizeImports`.

## Cambio

Correr exactamente:

    bunx biome check --write .claude/hooks/startup-guard.js tests/hooks/brain-no-code.test.ts tests/hooks/startup-guard.test.ts

No tocar ningún otro archivo. Si `biome check --write` deja diagnósticos sin resolver en
esos 3 archivos (algo que no sea formato/orden de imports), parar y reportar cuáles.

## Gates del ejecutor

- `bun run lint` exit 0.
- `bunx tsc --noEmit` limpio.
- `bun test tests/hooks/startup-guard.test.ts tests/hooks/brain-no-code.test.ts` verde.
- `git status` muestra solo los 3 archivos de arriba modificados (más lo que el cerebro ya
  tenía sin commitear en `.claude/hooks/brain-no-code.js`, que no es de este ítem — no lo
  toques ni lo commitees).
