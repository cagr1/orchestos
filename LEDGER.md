# LEDGER.md — Responsabilidad de LLMs sobre este repo

Registro append-only. Gobernanza de CÓMO se desarrolla OrchestOS (varios LLMs, distintas
sesiones, tocando el mismo repo) — **no es un feature de OrchestOS-el-producto**, no vive en
`src/`, no tiene superficie en el dashboard. Mismo estatus que PLAN.md/IDEAS.md/DONE.md/CLAUDE.md:
texto plano, versionado en git, legible por humano.

**Propósito**: distinguir tres comportamientos para saber con qué modelo conviene trabajar —
obediencia ciega (aceptable), desviación razonada con argumento sólido (el más valioso), y
desviación silenciosa / regresión (el que rompe reglas sin avisar). No es para castigar, es para
que Carlos tenga su propia base de conocimiento de cómo actúa cada LLM en este proyecto.

Diseño completo, campos y ejemplo → [PLAN.md § Mes 22 Bloque F, F.1](PLAN.md).
Cuándo es obligatorio agregar una entrada → [PLAN.md § Mes 22 Bloque F, F.2](PLAN.md) — el gate de
`scripts/pre-commit.sh` lo exige automáticamente cuando el commit toca un archivo listado en
`.claude/protected-rules.json`.
Reporte agregado (tabla por modelo) → `bun run ledger:report` ([PLAN.md § F.3](PLAN.md), pendiente
de implementar).

---
