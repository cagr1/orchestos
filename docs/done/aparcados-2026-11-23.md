# Aparcados el 2026-11-23 — MUT.2

Carlos, 2026-11-23: revertir el tope de memoria del kernel (D) y aparcar MUT.2. La corrida manual completa que lo iba a
cerrar dio 5 rojos; la memoria del árbol del shard queda descartada como causa. Vuelve a `PLAN.md` con su mismo ID cuando
se reanude la mutación (fin de la pausa de CI.85), no antes. Texto original intacto abajo, con la entrada de cierre.

## Cuando se reanude la mutación

Probar de a uno, cada intento con **un shard** por `workflow_dispatch` (input `shard`, p. ej. uno de los que cayeron)
antes de una corrida completa:

1. **CPU, no memoria**: el pico de memoria de los verdes fue 3,5–4,5 GB de 16. Mirar `cpu_pressure` del muestreo `[res]`
   en los verdes y probar menos workers en paralelo por shard (concurrencia de Stryker).
2. **Runner más grande** (más núcleos/RAM) para los shards que más caen (`executors-routing*`, `executors-codex-server*`,
   `executors-engines-b`, `executors-codex-engines-b`).
3. **Inestabilidad del lado de GitHub**: el rojo nunca deja log ni artefacto y cambia de shard cada noche; comparar con
   el estado de Actions en la fecha y, si se repite sin patrón, aceptar el reintento del shard como mitigación.

Lo que sigue en el repo de MUT.2: (A) muestreo `[res]` en el workflow y (B) fixture de `generic-cli` que mata su CLI
falso (`52c93ccb`); (C) tope de 2 GB RSS por `bun test` en `scripts/mutation-test-shard.ts` (`MUTATION_RSS_CAP_KB`,
no es parte del revert: actúa por proceso desde el propio shard y sí bajó los rojos de 5 a 1 en las nocturnas del
20-11 y 21-11); input `shard` de `workflow_dispatch`. Revertido: (D) `scripts/mutation-scope.sh`, su uso y el muestreo
`[res] scope` en `.github/workflows/mutation-nightly.yml` (de `1233be00`) y su spec `docs/specs/MUT-2-scope.md`.

## Texto original

- [ ] **MUT.2 — Shards de mutación: el runner se queda sin recursos.** (2026-11-17) La nocturna del 11-16 tuvo 3 de
  15 shards rojos (`executors-routing-c`, `executors-engines-b`, `executors-codex-server-c`) por "runner lost
  communication", no por timeout. Hipótesis de `analizar` (Sol), sin confirmar: procesos que sobreviven a un mutante,
  p. ej. el CLI falso con `setInterval` de `generic-cli.test.ts:209`, que solo muere si el kill bajo mutación funciona.
  Spec: `docs/specs/MUT-2.md` — (A) muestreo de memoria y procesos en el log del job, (B) el fixture mata su propio
  CLI falso. El aislamiento por grupo de procesos en `mutation-test-shard.ts` espera la evidencia de (A).
  2026-11-19, evidencia de (A) en la nocturna 44293867573: rojos `executors-codex-server` y `-b`, misma causa; su log
  no existe (BlobNotFound), así que el muestreo nunca sirve en el shard que muere. Los 13 verdes sí: procesos planos
  (~170-204), `bun test` ≤ 371 MB, salvo `runtime-boundaries-checks`, donde un mutante llevó `bun test` a 11,4 GB en
  116 s (13,1 de 16 GB). Fuga de procesos descartada; causa = mutante que asigna sin límite → OOM sobre el runner.
  (C) tope de 2 GB RSS por `bun test` en `mutation-test-shard.ts`: spec `docs/specs/MUT-2-cap.md`.
  2026-11-21, nocturna 44724733840 (20-11, con el tope): 1 de 16 rojo (`executors-codex-server-b`, "lost
  communication", 16:48→18:03; upload falló, log inexistente) frente a 5 el 19-11 y 2 el 18-11. Verdes: pico de memoria
  del runner 3,6–4,5 GB de 16, `bun test` ≤ 368 MB. Mejora, no cierre; falta la nocturna del 21-11 (44895977056).
  2026-11-22, nocturna 44895977056 (21-11): otra vez 1 de 16 rojo, ahora `executors-routing-b` ("lost communication",
  13:15→15:15, a las 2h01 de un shard de ~2h15; sin log ni artefacto). Verdes: pico del runner 3,5–4,4 GB. El shard
  rojo cambia cada noche (16-11 routing-c/engines-b/codex-server-c; 18-11 codex-server/-b; 20-11 codex-server-b;
  21-11 routing-b): no apunta a un mutante fijo. Sin el log del que muere, no hay causa; siguiente paso: que el
  muestreo sobreviva al runner (escribir `[res]` a un artefacto subido por un job aparte o a un step `if: always()`).
  2026-11-22, la nocturna 45014677461 lleva 2 rojos más ("lost communication": `executors-routing`, `-engines-b`).
  Descartado el muestreo fuera del runner: un step `if: always()` muere con el runner. (D) tope del kernel para el árbol
  entero del shard: `scripts/mutation-scope.sh` lo corre en un scope de systemd (`MemoryMax=75%`, sin swap,
  `OOMPolicy=continue`) con autoprueba de OOM al arrancar; el sampler imprime `[res] scope … MB | oom N oom_kill N`.
  Spec `docs/specs/MUT-2-scope.md`; `workflow_dispatch` acepta `shard` para probar uno solo. Límite conocido (`qa`):
  el OOM podría elegir a Stryker en vez del mutante; entonces el shard queda rojo pero con log.
  Gate en vivo (`1233be00`): dispatch 45041775154 con `shard=context-routing`, verde en 37 min, artefacto subido; log:
  `[scope] autoprueba ok` (kernel: `oom-kill … oom_memcg=/system.slice/mutation-shard-probe.scope … python3`),
  37 líneas `[res] scope` de 1984–2335 MB con `oom 0 oom_kill 0`, `[scope] exit 0`; los otros 15 jobs, steps
  skipped. Cierre: una nocturna con 16/16 verdes, o un rojo con log y `[res] scope … oom_kill N>0` (OOM contenido, sin
  "lost communication"). Si vuelve "lost communication" con el scope, la causa no es memoria del árbol del shard.
  2026-11-22: sin cron desde CI.85 (nocturnas en pausa), la nocturna se reemplaza por una corrida manual completa:
  https://github.com/cagr1/orchestos/actions/runs/45082749243 (`48279b83`, sin `shard`); con el mismo criterio de
  cierre, esa corrida cierra MUT.2 o lo deja abierto.
  2026-11-23, resultado de la corrida manual 45082749243 (`48279b83`, con el scope de `1233be00`): 5 de 16 shards rojos
  (`executors-routing`, `-routing-c`, `-routing-d`, `-codex-server-c`, `-codex-engines-b`), todos con la anotación
  "The hosted runner lost communication with the server" y sin logs. Las nocturnas previas al scope tenían 1 rojo.
  Por el criterio de cierre de arriba, la causa no es la memoria del árbol del shard, y el scope pudo empeorarlo.
  Decisión de Carlos (2026-11-23): revertir (D) y aparcar. Revert: commit `revert(MUT.2)` del 2026-11-23 (SHA en
  `git log -- scripts/mutation-scope.sh`). Sin corrida nueva de mutación (pausa de CI.85).
