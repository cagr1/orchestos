#!/bin/bash
# uso: do.sh <etiqueta> '<json de la orden>' [segundos de espera]
label="$1"; json="$2"; limit="${3:-120}"
printf '%s' "$json" > "/tmp/erp4/cmd/$label.json"
for ((i = 0; i < limit * 2; i++)); do
  if [ -f "/tmp/erp4/out/$label.json" ]; then cat "/tmp/erp4/out/$label.json"; exit 0; fi
  /bin/sleep 0.5
done
echo "sin resultado tras ${limit}s"; exit 1
