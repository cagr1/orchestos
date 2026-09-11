# Bloque DOC — evidencia de cierre
Evidencia movida literalmente desde PLAN.md en S.2; PLAN.md conserva el índice.

<a id="bloque-doc-doc-1"></a>
### DOC.1 — ⚡ Reconciliar documentación viva con el estado verificable del plan.
 (cerrado 2026-09-08)
  Actualizar el estado operativo de `README.md`, `VISION.md`, `PRODUCT.md`, `CONTEXT.md`,
  `AGENTS.md`, este encabezado y los resúmenes vivos de `MemoriesMD/wiki/projects/orchestos.md`
  y `MemoriesMD/projects/orchestos/estado.md`. Mantener `docs/done/` como historial inmutable y
  no presentar R.6–R.8, H.10.2 ni UI.8.1–UI.8.6 como cerrados. Gate: diff acotado, coherencia
  contra los ítems abiertos/cerrados del plan y `bunx tsc --noEmit` (la documentación no cambia
  comportamiento). **Evidencia:** `bun test` ✅ (1342 pass / 0 fail, 3321 expects, 142 archivos),
  `bunx tsc --noEmit` ✅; se actualizaron las fuentes vivas del repo y los dos resúmenes vivos del
  vault. `docs/done/` quedó intacto como historial.

<a id="bloque-doc-doc-2"></a>
### DOC.2 — 🧠 El roster reconoce a Opus, Fable, Sol y Astra como cerebros.
 (cerrado 2026-09-11)
Ejecutado por: gpt-5.6-sol · Spec: docs/specs/DOC.2.md
  Se eliminó la contradicción interna de `AGENTS.md`: el roster activo declara como cerebros a
  Opus 5, Fable 5.1, `gpt-5.6-sol` y `gpt-6-astra`; que Sol y Astra usen Codex CLI no cambia su
  rol. Los ejecutores quedan separados: Luna por defecto, Terra si el spec conserva criterio y
  Sonnet como excepción si Terra no alcanza. Carlos sigue fijando el modelo de cada corrida
  delegada. **Evidencia:** `bun run agent:preflight -- --item DOC.2 --agent sol --scope ...` ✅;
  `bunx tsc --noEmit` ✅; `git diff --check` ✅; `bun run plan:render -- --check` ✅ antes del
  cierre; búsqueda en las fuentes vivas sin la regla contradictoria «el cerebro es Claude» ni
  «los ejecutores son los cuatro modelos de Codex» ✅.

**Regla**: marcar `[x]` con fecha al cerrar. Si una validación falla, no abrir el siguiente bloque.

**Delegación — NO es una leyenda, son muros dirigidos a ti, el que ejecuta (endurecido 2026-07-15):**
- 🧠 = **Claude implementa** — requiere criterio arquitectural o decisión de diseño.
- ⚡ = **DeepSeek implementa** — tarea bien especificada. **Si eres Claude: NO la implementas, NO la
  adelantas porque sea trivial o esté adyacente a lo tuyo, NO te ofreces a hacerla.** Si un ⚡ está
  sin cerrar y bloquea tu 🔍, **PARA y repórtalo** — no lo absorbas.
- 🔍 = **revisión/gate obligatorio por Claude** — independiente de quién implementó.

**Regla de alcance (scope-lock, 2026-07-15):** ejecuta **EXACTAMENTE** el/los ítem(s) que el usuario
nombró — nada adyacente, ni el prerequisito, ni el siguiente, sin instrucción explícita. Si el ítem
nombrado tiene un prerequisito sin cerrar, **PARA y avísalo**; no lo hagas en silencio. Motivo real
(2026-07-15): con "continua con A.4" un LLM tocó A.3 (⚡, ajeno) y se ofreció a hacer A.5 (⚡, ajeno).

**Regla de commits (cadencia, 2026-07-15):** cada ítem cerrado (`[x]`) se commitea **en el mismo
turno** en que se cierra. Tras 2-3 commits locales, `git push origin master` **automáticamente**
(autorización permanente en CLAUDE.md) — **NO pidas permiso por lo ya autorizado, NO acumules** una
pila de cambios sin commitear. `--force` sigue requiriendo pedido explícito.

**Regla de documentación obligatoria (2026-07-02):** todo hallazgo — bug real, deuda técnica, feature huérfana, contradicción entre `tasks.yaml`/DONE.md y el código real — se convierte en un ítem de este archivo (o de IDEAS.md si es backlog no inmediato) ANTES de tocar código. Si no está escrito acá, no se corrige. Motivo: una auditoría completa (2026-07-02) encontró deuda documentada en prosa dentro de DONE.md ("anotado como deuda conocida") que nunca se tradujo a un ítem accionable y por eso nadie la persiguió durante 3 meses (ver Bloque F0).

**Regla de flujo IDEAS→PLAN→DONE (decisión Carlos, 2026-07-02):** cuando una idea pasa de IDEAS.md a PLAN.md (se convierte en el eje o en un bloque de un Mes), **se ELIMINA de IDEAS.md en el mismo commit** — no queda duplicada en ambos. La evidencia de que se realizó vive siempre en DONE.md (documentación extensa al cierre del Mes). IDEAS.md es solo backlog vivo: lo que está ahí es porque NADIE lo está haciendo todavía.

---
