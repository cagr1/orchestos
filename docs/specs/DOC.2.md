# DOC.2 — Roster de cerebros sin contradicciones

## Alcance

- Corregir la sección más reciente de `AGENTS.md` para declarar como cerebros a Opus 5,
  Fable 5.1, `gpt-5.6-sol` y `gpt-6-astra`.
- Declarar a Luna como ejecutor por defecto, Terra como ejecutor con criterio y Sonnet como
  excepción si Terra no alcanza.
- Conservar que Carlos fija el modelo de cada corrida delegada.
- Dejar inequívoco que todo modelo del roster de cerebros piensa, planifica, escribe specs y
  verifica, pero no escribe código de producto.

## Fuera de alcance

- Código de producto, configuración de proveedores y routing de OrchestOS.
- Cambiar alias o IDs de modelos.
- Modificar la política de costos o el protocolo de cierre.

## Gate

- Preflight de `DOC.2` con scope documental.
- Revisión de contradicciones mediante `rg`.
- `git diff --check` y `bun run plan:render -- --check`.
