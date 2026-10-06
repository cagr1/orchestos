# CI.14 — Mutation Shards tras selección de tests (2026-10-06)

Corrida manual `37480050158` (commit `9fda072`), comparada con la última corrida completa `36987578986` (10-02, suite entera).

| Shard | Duración 10-02 | Duración ahora | Score 10-02 | Score ahora |
|---|---|---|---|---|
| executors | 168 min | 121 min | 50.76% | 50.98% |
| orchestration | 103 min | 65 min | 63.56% | 45.64% |
| runtime-boundaries | 62 min | 37 min | 53.56% | 50.00% |
| context-routing | 67 min | 26 min | 64.10% | 36.94% |

10-03 → 10-06 (sin selección): executors y orchestration cancelados por timeout de 180 min las 4 noches.

**La baja de score es corrección, no pérdida.** En 10-02, 615 de 1,881 kills incluían un fallo de `enforceContract`
(tests de `contract.ts`) en mutantes de archivos que esos tests no importan; 232 kills se debían SOLO a eso.
`src/run/e2e-smoke-agents.ts` no lo importa ningún test y tenía 35 "kills". En `qa.ts`, de 102 kills que pasaron a
Survived, 77 eran solo `enforceContract` y el resto de tests que no alcanzan `qa.ts` (`defaultChecksFor`,
`buildSections`). Corrida nueva: 1 kill con ese ruido. Los scores de ahora son la medición honesta.
`git-lock.ts` bajó de 35 a 3 mutantes porque el archivo cambió (R.7), no por la selección.

Pendiente visto: `enforceContract` falla bajo la carga de Stryker (flaky) — sin ítem; ya no contamina otros shards.
