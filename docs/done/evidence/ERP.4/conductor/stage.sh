#!/bin/bash
# uso: stage.sh <etiqueta> <archivo-mensaje>
# Envía el mensaje por el chat del piloto, espera el fin de la tarea creada y muestra el resultado.
label="$1"; file="$2"
cd /tmp/erp4 || exit 1
api() { curl -s -H 'x-orchestos-project-id: cb53f7dd329bfc1c' -H 'Origin: http://localhost:4242' http://localhost:4242/api/tasks; }
echo "inicio $(date +%T)"
./do.sh "$label-send" "$(jq -Rs '{op:"send",text:.}' "$file")" 600 > "out/$label-summary.json"
jq '{status,elapsedMs,reply,created:[.created[]|{id,status,output}]}' "out/$label-summary.json"
id=$(jq -r '.created[0].id // empty' "out/$label-summary.json")
[ -z "$id" ] && { echo "SIN TAREA"; exit 2; }
for ((i = 0; i < 180; i++)); do
  s=$(api | jq -c --arg id "$id" '.tasks[] | select(.id==$id) | {status,runId,qaVerdict,retryCount,retryReason}')
  case "$s" in
    *'"running"'*) /bin/sleep 5 ;;
    *'"pending"'*'"retryCount":0'*) /bin/sleep 5 ;;
    *) break ;;
  esac
done
echo "fin $(date +%T) $s"
/bin/sleep 8
./do.sh "$label-text" '{"op":"text"}' 30 | jq -r .body | tail -6 | cut -c1-400
sqlite3 ~/.orchestos/db.sqlite "select provider, model, qa_model, status, elapsed_ms, input_tokens, output_tokens, usd_cost from runs where task_id='$id' order by created_at"
git -C ~/Projects/projects/erp-piloto log --oneline -2
(cd ~/Projects/projects/erp-piloto && bun test 2>&1 | tail -5)
