# OrchestOS — Instrucciones para Codex / LLMs

## Identidad git — PROHIBIDO modificar

El email y nombre de git ya están configurados globalmente y son correctos.
**Nunca ejecutes** ninguno de estos comandos, ni local ni global:

```
git config user.email  ...    # PROHIBIDO
git config user.name   ...    # PROHIBIDO
git config --local ...        # PROHIBIDO salvo que el usuario lo pida explícitamente
git config --global ...       # PROHIBIDO salvo que el usuario lo pida explícitamente
```

La configuración correcta es:
- `user.email = cagr_14@hotmail.com`
- `user.name  = cagr1`

Modificarla rompe el mapa de contribuciones de GitHub silenciosamente.
Si necesitas saber el email activo, usa `git config user.email` (solo lectura).

## Reglas generales

- No uses `--no-verify` en commits salvo que el usuario lo pida.
- No hagas `git push --force` salvo instrucción explícita.
- No crees ni borres ramas remotas sin confirmación del usuario.
- **Memoria evolutiva obligatoria:** toda mejora de proceso, hallazgo, decisión técnica o regla
  transversal descubierta durante el trabajo debe persistirse en el mismo turno. Usa `PLAN.md` para
  cadenas activas y evidencia de ejecución, `AGENTS.md`/`CLAUDE.md` para reglas que deben obedecer los
  LLM y `CONTEXT.md` para memoria estable de arquitectura/estado. Nunca dejes conocimiento operativo
  importante solo en la conversación; al actualizar una regla, conserva el historial y no la elimines
  silenciosamente.
- Cadencia de sincronización: después de 2–3 commits locales (o cuando la rama quede con 3
  commits de ventaja sobre `origin/master`), ejecuta `git push origin master` automáticamente.
  No acumules más commits sin subir; el push normal está autorizado. `--force` sigue prohibido
  salvo instrucción explícita.

## Trabajo en equipo (Claude + Codex, en paralelo)

Carlos trabaja este repo con Claude y Codex a la vez, cada uno en su propia sesión (posiblemente
en un worktree/rama separada). No te va a decir "hacé el ítem X" cada vez — el punto de partida
SIEMPRE es `PLAN.md`. Antes de tocar código:

1. **Leé `PLAN.md` primero.** Es la fuente de verdad de qué falta y en qué orden. Cada ítem abierto
   (`- [ ]`) tiene una etiqueta: `🧠` (requiere criterio de diseño), `⚡` (mecánico, bien
   especificado), `🔍` (gate de revisión). **Agarrá SOLO ítems `⚡`** — los `🧠`/`🔍` son de Claude.
   Si un `⚡` te bloquea porque depende de un `🧠` sin cerrar, PARÁ y decilo, no lo hagas en caliente.
2. **Scope-lock**: ejecutá EXACTAMENTE el ítem que agarraste — nada adyacente, ningún "ya que
   estoy, aprovecho y arreglo esto otro también". Si ves algo fuera de scope que amerita
   arreglarse, anotalo, no lo toques en la misma pasada.
3. **Commit por ítem cerrado**, marcando `[x]` en `PLAN.md` en el mismo commit — así el otro agente
   (o Carlos) ve en `git log`/`PLAN.md` qué ya está tomado, sin necesitar coordinación en vivo.
4. **No pises lo que no es tuyo**: si un ítem `⚡` ya tiene evidencia de que otro agente lo está
   trabajando (branch activo, commit reciente sin mergear), no lo dupliques — avisá.
5. Antes de escribir código nuevo, correr `bunx tsc --noEmit` y la suite de tests relevante — igual
   criterio que ya pide el pre-commit hook, pero verificalo vos ANTES de terminar, no dejes que el
   hook sea la primera vez que se entera de un error de tipos.

## Qué está listo para tomar ahora (2026-07-30)

**Cambio de régimen**: Meses 22 (A–K), 23 (L) y 24 (M) están **cerrados formalmente** — los ítems
de Bloque K/J que esta sección listaba antes ya no aplican. El mes activo es **Mes 25**, y desde
2026-07-30 ejecuta el **backlog canónico por esfuerzo de `IDEAS.md`**: ese índice (`Mínimo` → `Bajo`
→ `Bajo-medio` → …) es el **único orden de ejecución**, se baja a PLAN.md un bloque a la vez, y al
graduar una idea **se elimina de IDEAS.md en el mismo commit**. Al terminar el backlog arranca ~1
mes de dogfooding real: cero features nuevas salvo bugs que impidan usar el producto.

**Ahora mismo NO hay ningún ⚡ desbloqueado.** El bloque abierto es **PLAN.md § Bloque N** (IDEAS #1,
endurecimiento de skills con Iron Law / Common Rationalizations / Red Flags) y sus dos ⚡ dependen de
🧠 sin cerrar:

- **N.4** (⚡, superficie en dashboard + i18n) — bloqueado por N.1/N.2: los campos todavía no existen
  en el contrato ni en el renderer, no hay nada que mostrar.
- **N.5** (⚡, autoría del contenido en las skills) — bloqueado por N.1/N.2 **y además por una
  decisión de Carlos** escrita en el ítem (¿las 24 skills o solo las 5 recomendadas?). No arranques
  sin esa respuesta.

Cuando N.1/N.2 cierren, N.4 y N.5 quedan tomables en ese orden. Si llegás antes, **PARÁ y decilo**
(regla 1 de arriba) — no adelantes el 🧠.

**NO tomes**:
- **N.1, N.2, N.3** — 🧠. N.2 en particular reordena el prompt de las 24 skills existentes
  (`iron_law` pasa a ir ANTES de `instructions`, hoy `sections[0]`); es criterio de diseño, no
  wiring mecánico.
- **N.6** — 🔍, gate con verificación en vivo.
- Los 5 **pendientes heredados** del Mes 25 (K.6.2-R7, L.5.7, L.6.2 y los 2 de roadmaps del Mes 24):
  **todos esperan una decisión de Carlos, no trabajo de código**. No los "cierres" ni los
  implementes por tu cuenta.
- La tarea `debug-codex-cli-deepseek` de `tasks.yaml` (`output: []` inválido, fantasma de un falso
  positivo) — pendiente de decisión de Carlos. No la borres ni la corrijas sin que él lo pida.

**Antes de agregar un campo nuevo a una skill** (aplica a todo el Bloque N): un campo en
`skills/*.yaml` no llega al LLM por existir. `validateSkill()` **no es strict** — un campo
desconocido carga sin error y se descarta en silencio. Hay que tocar los 3 puntos:
`SkillDef` + `validateSkill()` ([src/skills/registry.ts](src/skills/registry.ts)) y **`buildSections()`**
([src/skills/targets/_shared.ts](src/skills/targets/_shared.ts), el único renderer skill→prompt,
compartido por los 3 targets). Si además la skill se crea/importa por dashboard, sumá
[src/dashboard/prompts/curator.ts](src/dashboard/prompts/curator.ts) o toda skill importada nacerá
sin el campo.

## Pre-commit hook

El proyecto tiene un pre-commit hook en `scripts/pre-commit.sh` que corre `tsc --noEmit` antes de cada commit. Se instala automáticamente copiándolo a `.git/hooks/pre-commit`. Si clonas el repo en otro lado, ejecuta:

    cp scripts/pre-commit.sh .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit

## Estado operativo de seguridad (2026-07-29)

L.0–L.6.1 del baseline están cerrados. L.6.2 sigue abierto: la revisión CLI/HTTP inicial y sus
límites viven en `docs/security-manual-review.md`; falta una sesión con navegador para la revisión
visual y los flujos manuales de ejecución/worktree/diagnóstico/exportación. Hallazgos pendientes
`L62-001` (migración concurrente) y `L62-002` (provider key persistida antes de validación). No
corregirlos fuera de un ítem explícito de `PLAN.md`.
