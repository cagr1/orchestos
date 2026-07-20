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

## 2026-07-20 16:53 America/Guayaquil — claude-sonnet-5

**Regla tocada**: [[feedback-context-no-max-tokens]] (PLAN.md § Mes 22 Bloque E) — `harness.ts` está
protegido por tocar la derivación de `max_tokens`.
**Clasificación**: RESPETÓ
**Por qué**: el cambio (Bloque G/G.5) no toca la derivación de `max_tokens`/contextWindow — solo
agrega el import de `opencodeEngine` y una rama `else if (requestedEngine === 'opencode')` a la
selección de executor, más un ajuste de comentario en `shouldSplit()` para excluir también el
nuevo engine 'opencode' del split (mismo motivo ya existente para 'external': el executor no es la
API LLM directa). Cero líneas tocadas en el cálculo de `maxTokens`.
**Reversibilidad/evidencia**: commit de G.5 (feat(Bloque G/G.5): executor opencode (batch), cierra
G.5) — revertible con `git revert`, sin side-effects en datos. 797 tests · 0 fail · `tsc --noEmit`
limpio antes del commit.

---
