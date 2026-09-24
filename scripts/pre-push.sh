#!/usr/bin/env bash
set -euo pipefail

# Mes 25 — gate pre-push (2026-08-01). El pre-commit corre tsc, security:secrets y
# ledger:gate, pero NUNCA la suite, así que nada en la máquina ejercitaba lo que
# ejercita CI. Resultado: CI verde por última vez el 2026-07-13 y rojo en el 100%
# de los pushes desde el 2026-07-29 — dos bugs distintos (un test que afirmaba
# sobre el PATH del host y un trinquete de cobertura mal calibrado) sobrevivieron
# semanas porque un CI que siempre falla deja de dar señal.
#
# Corre el comando EXACTO del workflow (bun run test:coverage, ~20s), no `bun test`:
# el gate de cobertura vive dentro de ese script y `bun test` a secas no lo toca.
#
# Instalación:  cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
# Emergencia:   git push --no-verify  (dejar el CI rojo es una decisión, no un accidente)

cd "$(git rev-parse --show-toplevel)"

echo "🧪 pre-push: corriendo la suite + trinquete de cobertura (lo mismo que CI)..."
log_dir="$(mktemp -d "${TMPDIR:-/tmp}/orchestos-pre-push.XXXXXX")"
log_file="$log_dir/coverage.log"

if ! bun run test:coverage >"$log_file" 2>&1; then
  echo ""
  echo "❌ pre-push: esto mismo va a fallar en CI. Push abortado."
  echo "   Últimas 80 líneas:"
  tail -n 80 "$log_file"
  echo "   Log completo: $log_file"
  echo "   Si el push es urgente y aceptás dejar CI rojo: git push --no-verify"
  exit 1
fi

tail -n 6 "$log_file"

# 2026-09-22: CI estuvo rojo por lint entre el 15 y el 22 de septiembre, pero pre-push no lo ejecutaba.
lint_log="$log_dir/lint.log"
if ! bun run lint >"$lint_log" 2>&1; then
  echo ""
  echo "❌ pre-push: bun run lint falla (mismo paso de CI). Push abortado."
  echo "   Primeras 60 líneas de diagnósticos:"
  sed -n '1,60p' "$lint_log"
  echo "   Sugerencia: bunx biome check --write ."
  echo "   Log completo: $lint_log"
  exit 1
fi

tail -n 6 "$lint_log"

ui_flows=(smoke plan-doc project-delete usage-bar text-sweep chat-turn-details tasks runs-graph project-tabs)
ui_paths='^(src/dashboard/|scripts/ui-gate/|src/run/)'
ui_required=0
while read -r local_ref local_sha remote_ref remote_sha; do
  [[ -n "$local_sha" ]] || continue
  if [[ "$remote_sha" =~ ^0+$ ]]; then
    base_sha="$(git merge-base "$local_sha" origin/master 2>/dev/null || true)"
  else
    base_sha="$remote_sha"
  fi
  [[ -n "$base_sha" ]] || continue
  if git diff --name-only "$base_sha" "$local_sha" | grep -Eq "$ui_paths"; then
    ui_required=1
    break
  fi
done

if (( ui_required )); then
  ui_log="$log_dir/ui-gate.log"
  echo "🧭 pre-push: cambios de dashboard/run detectados; corriendo los 9 ui-gates..."
  if ! bun run ui:gate "${ui_flows[@]}" >"$ui_log" 2>&1; then
    echo "❌ pre-push: ui-gates fallaron. Push abortado."
    tail -n 100 "$ui_log"
    echo "   Log completo: $ui_log"
    exit 1
  fi
  tail -n 15 "$ui_log"
else
  echo "⏭️ pre-push: sin cambios en src/dashboard/, scripts/ui-gate/ ni src/run/; ui-gates omitidos."
fi

echo "✅ pre-push: verde. CI debería coincidir. Log completo: $log_file"
