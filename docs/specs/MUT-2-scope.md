# MUT.2 (D) — Tope de memoria del kernel para el shard entero

Rol: `mecanico`. Sin decisiones abiertas: el contenido va literal.

## Por qué

1 de 16 shards muere cada noche con "runner lost communication" (22-11: dos, `executors-routing` y
`executors-engines-b`) y no deja log. El tope de 2 GB de `mutation-test-shard.ts` muestrea cada 2 s y solo mide el
PID de `bun test`, no a sus hijos. Un scope de systemd con `MemoryMax` hace que el kernel mate al proceso más grande
del árbol del shard sin hueco de muestreo; el runner sobrevive y el mutante cuenta como detectado.

## Cambios (solo estos dos archivos)

### 1. Nuevo `scripts/mutation-scope.sh` (modo 755), contenido literal:

```bash
#!/usr/bin/env bash
# MUT.2: corre un shard de mutación dentro de un scope de systemd con tope de memoria del kernel.
# El tope de 2 GB por `bun test` (mutation-test-shard.ts) muestrea cada 2 s y no ve a los hijos; si el árbol del
# shard llena la RAM, el runner pierde la comunicación y no queda log. Con MemoryMax el OOM ocurre dentro del scope:
# el kernel mata al proceso más grande (el mutante), el runner sigue vivo y el mutante cuenta como detectado.
# Uso (runner de GitHub, sudo sin contraseña): scripts/mutation-scope.sh <comando> [args...]
set -uo pipefail

unit="${MUTATION_SCOPE_UNIT:-mutation-shard}"
max="${MUTATION_SCOPE_MEMORY_MAX:-75%}"

in_scope() {
  local name="$1" limit="$2"
  shift 2
  # sudo -E conserva el entorno salvo PATH (secure_path): se pasa explícito junto con la identidad.
  sudo -E systemd-run --scope --quiet --unit="$name" \
    -p MemoryMax="$limit" -p MemorySwapMax=0 -p OOMPolicy=continue \
    --uid="$(id -u)" --gid="$(id -g)" \
    env "PATH=$PATH" "HOME=$HOME" "USER=$(id -un)" "LOGNAME=$(id -un)" "$@"
}

# Autoprueba: un proceso que pasa de 256 MB debe morir por OOM dentro de su scope, sin tocar el runner.
probe_status=0
in_scope "$unit-probe" 256M python3 -c "x = b'1' * (1024 ** 3)" || probe_status=$?
if [ "$probe_status" -ne 137 ]; then
  echo "[scope] autoprueba fallida: exit $probe_status (esperado 137, OOM kill)" >&2
  exit 1
fi
echo "[scope] autoprueba ok: 1 GB en scope de 256M -> exit 137"
echo "[scope] $unit.scope MemoryMax=$max MemorySwapMax=0: $*"

status=0
in_scope "$unit" "$max" "$@" || status=$?
echo "[scope] exit $status"
# Las primeras líneas son de la autoprueba; las siguientes, OOM reales dentro del shard.
sudo dmesg 2>/dev/null | grep -E 'Memory cgroup out of memory|oom-kill:' | tail -20 | sed 's/^/[oom] /'
exit "$status"
```

### 2. `.github/workflows/mutation-nightly.yml`

a. Bajo `workflow_dispatch:` (hoy vacío) agregar un input para correr un solo shard:

```yaml
  workflow_dispatch:
    inputs:
      shard:
        description: 'Correr solo este shard (vacío = todos)'
        required: false
        default: ''
```

b. A cada step del job **excepto el de upload** (`actions/checkout`, `setup-bun`, `bun install`, `bun run typecheck`,
`Mutation run`) agregar `if: ${{ !inputs.shard || inputs.shard == matrix.shard }}`. Al step `Upload mutation report`
cambiar `if: always()` por `if: ${{ always() && (!inputs.shard || inputs.shard == matrix.shard) }}`. Los steps de una
línea (`- uses: …` / `- run: …`) pasan a forma de mapa para poder llevar el `if`.

c. En el step `Mutation run (with resource sampler)`:
   - Reemplazar `bun run ${{ matrix.command }} &` por `bash scripts/mutation-scope.sh bun run ${{ matrix.command }} &`.
   - Dentro del bucle del sampler, después de la línea `ps -eo … | sed 's/^/[res] /'`, agregar:

```bash
              scope_dir=/sys/fs/cgroup/system.slice/mutation-shard.scope
              if [ -r "$scope_dir/memory.current" ]; then
                printf '[res] scope %s MB | %s\n' "$(( $(cat "$scope_dir/memory.current") / 1048576 ))" \
                  "$(grep -E '^(oom|oom_kill) ' "$scope_dir/memory.events" | tr '\n' ' ')"
              fi
```

## Qué no tocar

Particiones, `matrix.include`, `stryker.*.config.mjs`, `scripts/mutation-test-shard.ts`, `package.json`, PLAN.md,
cualquier otro archivo. No commitear.

## Verificación del ejecutor

- `bash -n scripts/mutation-scope.sh` y `shellcheck scripts/mutation-scope.sh` si está instalado.
- `bun -e "const y=require('yaml');y.parse(require('fs').readFileSync('.github/workflows/mutation-nightly.yml','utf8'))"`
  (o `npx --yes yaml-lint`/`actionlint` si existe) sin error.
- `git diff --stat` muestra solo los dos archivos.

## Verificación del cerebro (en vivo)

Tras push a master: `gh workflow run "Mutation Shards" -f shard=context-routing`. El log debe mostrar
`[scope] autoprueba ok`, líneas `[res] scope … MB | oom 0 oom_kill 0` y el shard terminando en verde bajo el scope.
Los otros 15 jobs del matrix salen en segundos con todos sus steps skipped.

## Baseline

Ya corrido por el cerebro: `bunx tsc --noEmit` verde (este cambio no toca TypeScript). El ejecutor no lo repite: en su
sandbox Bun no puede escribir en el tempdir. Para validar el YAML usar `node -e` con el paquete `yaml` de
`node_modules` si `bun -e` falla por lo mismo.
