# LIMPIEZA-2 — Lista exacta de borrado y plan para desacoplar el método personal (solo análisis)

Sigue a LIMPIEZA-1 (inventario de Luna, demasiado conservador: "citado en un histórico = conservar"). No se edita ni
se borra nada: la salida es la lista y el plan; el cerebro los ejecuta tras el GO de Carlos.

## Criterio de Carlos (2026-11-06)

Limpiar archivos que ya no se usan: imágenes, evidencia que ya no sirve, capturas, specs ejecutados. Que OrchestOS
se rija por sus propias reglas (la evolución del trabajo hecho), no por el método personal de Carlos.
Ya decidido en CI.62: las imágenes no se versionan. **Que un histórico de `docs/done/` cite un archivo no lo hace
necesario**: el histórico puede quedarse con la cita como texto.

## Medido por el cerebro

- Imágenes versionadas: 3 (`r6-runs-browser.png`, `scripts/s6-sprint-board.png`, `scripts/s6a-sprint-board.png`), 172 KB.
- `docs/done/evidence/`: 315 archivos, 3,8 MB. `docs/done/` sin evidence: 84 archivos. Repo `.git`: 72 MB.

## 1. Lista exacta de borrado

Para cada archivo de `docs/done/evidence/` y raíz/`scripts/` que no sea código: decidir **borrar** o **conservar**,
con una sola regla verificable. Antes, averiguar qué mecanismo **exige** que la evidencia exista y bajo qué condición
(leer `scripts/ledger-gate*`, `scripts/plan-import.ts` (reconcile), `scripts/gate-evidence*`, `scripts/pre-commit.sh`,
`scripts/check-*`): p. ej. si `ledger:gate` o `plan:reconcile` fallan cuando un `[x]` de `PLAN.md` cita una
evidencia que no existe. Regla propuesta (ajústala con lo que encuentres): conservar solo lo que cita un ítem que
sigue en `PLAN.md` o lo que un mecanismo exige; borrar el resto (lo cerrado vive en git y en `docs/done/bloque-*.md`).
Igual para `docs/done/*.md` duplicados entre sí (mismo bloque dos veces) y `docs/specs/CTX-GUARD.md` (lo cita
`CLAUDE.md`: decir si su contenido ya vive en el código o en otro doc).

Salida: un bloque con las rutas a borrar, una por línea (listo para `git rm`), con el total de archivos y KB; y la
lista corta de lo que se conserva con su motivo. Probar la regla: en un clon temporal (`git worktree add` en
`$TMPDIR`, y quitarlo al final) borrar la lista y correr `bun run ledger:gate`, `bun run plan:reconcile -- --dry-run` (o
el equivalente que no escriba) y `bunx tsc --noEmit`; reportar salida.

## 2. Plan para desacoplar el método personal

`git grep -nE 'agent-method|delegate|roster|MemoriesMD|vault|criterio-alt|gpt-6|Sol\b|Luna\b|cerebro|~/.claude'`
fuera de `docs/done/`. LIMPIEZA-1 encontró: `AGENTS.md:5,37-59,117`; `scripts/pre-commit.sh:27`
(`~/.agent-method/hooks/writer-lock.js`); `docs/reference/gotchas.md:48`; `docs/roadmaps/README.md` y
`docs/roadmaps/disciplines/*.md`; `scripts/ui-gate/flows/qa-negative.mjs:258-259`; `CONTEXT.md:27`.

Para cada referencia: qué regla de OrchestOS expresa y cómo queda como regla **propia del repo** (texto neutral,
o mecanismo dentro del repo que la haga cumplir). Caso especial: el writer-lock del pre-commit — qué pasa en una
máquina sin `~/.agent-method` (¿falla, se salta?), y si el repo necesita su propio candado o basta con quitar la
dependencia. Salida: tabla `archivo:línea | hoy | propuesta | qué se pierde`.
