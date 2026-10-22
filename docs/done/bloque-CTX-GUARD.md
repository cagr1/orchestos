## Archivado 2026-10-22 desde PLAN.md (DOC.4)

<a id="bloque-ctx-guard-ctx-guard-2"></a>
- [x] **CTX-GUARD.2 — ⚡ El guard de arranque mide lo que de verdad carga.** (abierto y cerrado 2026-10-22, GO de Carlos)
  Estimaba con chars/4 y lo medido es 2,2 chars/token (`/context`: 26.309 chars → 11,9k tokens): callaba con 11,9k
  tokens de memoria (límite 9k). No medía las skills de cuenta. Arreglo (`.claude/hooks/startup-guard.js`):
  `CHARS_PER_TOKEN = 2.2`; suma la `description` de cada `SKILL.md` en `~/.claude/skills/**` y
  `~/.claude/plugins/synced/**` (sin directorios ocultos: r2 contaba `~/.claude/skills/.trash`) y las nombra en el
  hallazgo. Límite documentado en el archivo: `claude.ai Claude Docs` carga pese a `disabledMcpServers` y el guard no lo
  ve sin `claude mcp list` (red). Con el HOME real: 15,2k tokens est. (CLAUDE.md global 3,2k, del repo 4,9k, MEMORY 3,3k,
  13 skills de cuenta 3,8k; `/context` da 3,1k para 15 skills). Desde ahora avisa en cada arranque hasta bajar el peso o
  mover el límite: decisión de Carlos. Evidencia: `tests/hooks/startup-guard.test.ts` 14/0, fixtures con HOME temporal
  (pequeño calla; pesado avisa con `skills de cuenta (2)`; `.trash` no cuenta).
  Ejecutado por: codex gpt-6-luna (mecanico) · Spec: docs/specs/CTX-GUARD.2.md
