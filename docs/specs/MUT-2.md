# MUT.2 — Shards de mutación: dejar evidencia de recursos y cerrar la fuga del fixture

Contexto: corrida 43852165619 (2026-11-16). 3 de 15 shards fallaron con "The hosted runner lost
communication with the server" (falta de CPU/memoria o runner terminado), no por timeout.
Diagnóstico de `analizar` (Sol): hipótesis principal = procesos que sobreviven a un mutante; sin
confirmar. Regla: un fallo intermitente primero deja evidencia, después se corrige.

## A. Evidencia de recursos en el log del job

Dónde: `.github/workflows/mutation-nightly.yml:56` (step `- run: bun run ${{ matrix.command }}`).

Qué: reemplazar ese step por uno con `name: Mutation run (with resource sampler)` que:
- arranca en segundo plano un muestreo cada 60 s que imprime en stdout UNA línea compacta más el
  top 5 por RSS: fecha UTC, línea `Mem:` de `free -m`, `some avg10` de `/proc/pressure/memory` y
  `/proc/pressure/cpu`, cantidad total de procesos (`ps -e --no-headers | wc -l`), y
  `ps -eo pid,ppid,pgid,etimes,rss,pcpu,args --sort=-rss | head -6` (args cortados a 120 caracteres);
- corre `bun run ${{ matrix.command }}`, guarda su exit code, mata el muestreo y sale con ese
  exit code (el resultado del shard no cambia).
Prefijo de cada línea: `[res]`, para filtrar con `gh run view --log | grep '\[res\]'`.
`shell: bash`. Nada de artefactos nuevos: si el runner muere, solo sobrevive el log en streaming.

## B. El fixture de generic-cli mata su propio CLI falso

Dónde: `src/__tests__/generic-cli.test.ts`. `script()` (líneas 37–40) escribe el CLI falso;
el caso `setInterval(() => {}, 1000)` (línea 209) solo muere si el código bajo prueba
(`src/run/executors/generic-cli.ts:38–41`, `proc.kill('SIGKILL')` en el timer) funciona. Un
mutante que rompa ese kill deja el proceso vivo para siempre.

Qué: que la limpieza no dependa del código mutado.
- `script()` antepone al source una línea que registra su PID: append de `process.pid + '\n'` a
  `join(root, '.orchestos/fake-cli.pids')` (usar `appendFileSync` de `node:fs`).
- `afterEach`, ANTES del `rmSync`, lee ese archivo si existe y hace `process.kill(pid, 'SIGKILL')`
  por cada PID, ignorando `ESRCH`.

## Qué no tocar

- `scripts/mutation-test-shard.ts` y la configuración de Stryker (`concurrency`, shards): el
  aislamiento por grupo de procesos espera la evidencia de A.
- `src/run/executors/generic-cli.ts` (código de producto).
- `max-parallel: 2` del workflow: explica la cola de >3 h, no es un fallo.

## Verificación

1. `bun test src/__tests__/generic-cli.test.ts` verde.
2. Prueba de que B sirve: comentar temporalmente `proc.kill('SIGKILL')` en
   `generic-cli.ts:40`, correr el test, y comprobar con
   `ps -eo pid,args | grep '.orchestos/fake-cli' | grep -v grep` que no queda ningún proceso;
   repetir SIN el cambio de B y mostrar que sí queda (pegar ambas salidas). Restaurar `generic-cli.ts`.
3. `bun run typecheck`, `bun run lint`.
4. YAML válido:
   `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/mutation-nightly.yml'))"`.
5. Evidencia en CI (la verifica el cerebro tras el push): la nocturna siguiente muestra líneas
   `[res]` en el log de cada shard.
