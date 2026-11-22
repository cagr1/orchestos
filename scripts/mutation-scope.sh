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
