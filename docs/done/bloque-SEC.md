## Archivado 2026-10-22 desde PLAN.md (DOC.4)

<a id="bloque-sec-sec-1"></a>
- [x] **SEC.1 — ⚡ `bun audit` en rojo: 4 vulnerabilidades altas en dependencias transitivas.**
  (2026-10-20, hallado al correr `security:gate` en ERP.7.1a.) `brace-expansion` (>=4.0.0 <5.0.11, GHSA-qhr7-859c-m2p7,
  GHSA-6j4f-fj2g-mc7p) y `fast-uri` (<3.1.7, GHSA-qw65-cvwx-89v3, GHSA-58mr-gqgx-xq4g). Gate: `bun run security:gate` exit 0
  y `bun run test:coverage` verde.
  **Cerrado 2026-10-20.** Ya había `overrides` para los dos paquetes en versiones vulnerables (`brace-expansion` 5.0.9,
  `fast-uri` 3.1.6): suben a 5.0.11 y 3.1.7 (llegan por `glob`/`minimatch` y `ajv`, vía `@stryker-mutator/core`).
  `bun install` regeneró `bun.lock` (4 líneas). `bun run security:gate`: PASS ("No vulnerabilities found … 4 below
  --audit-level=high"), matriz 1825/0; pre-push verde. Quedan 4 avisos moderados (`qs` ×2, `fast-uri`, `brace-expansion`),
  fuera del umbral del gate. Commit `3d1a3a31`.
  Ejecutado por: mecanico (overrides) + cerebro (`bun install` y gates: el sandbox no tiene red) · Spec: docs/specs/SEC.1.md
