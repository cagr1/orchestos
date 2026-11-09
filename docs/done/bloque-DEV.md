# Cerrados de DEV

- [x] **DEV.1 — El candado "un árbol, un escritor" vive en el repo.** (GO de Carlos 2026-11-06) Hoy el pre-commit
  solo lo comprueba si existe `~/.agent-method/hooks/writer-lock.js` (`scripts/pre-commit.sh:25-34`); en otra máquina
  no protege.
  Hecho: `scripts/writer-lock.mjs` (copia del candado con el mismo archivo `.git/agent-writer.lock`, convive con el
  hook global) + 28 tests; el pre-commit lo comprueba siempre; `.claude/settings.json` lo registra como PreToolUse;
  `bun run writer-lock status|check|claim|release`; `AGENTS.md` § Un árbol, un escritor apunta ahí. Gates del cerebro:
  contraprueba con HOME temporal sin `.agent-method` (ajeno 1, propio 0, vencido 0), test 28/0; ejecutor:
  `test:coverage` 2347/0. Anotado: el repo no registra `release` en SessionEnd (lo hace el hook global; sin él,
  el candado vence a los 45 min).
  Ejecutado por: codex gpt-6.1-sol (criterio) · Spec: docs/specs/DEV.1.md
