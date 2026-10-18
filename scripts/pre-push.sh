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
# 2026-10-17 (CI.30): suite y lint se verifican en el commit empujado, no en el árbol.

cd "$(git rev-parse --show-toplevel)"

# Leer las refs antes de ejecutar gates: stdin del hook solo puede consumirse una vez.
push_refs=()
while IFS= read -r ref_line || [[ -n "$ref_line" ]]; do
  push_refs+=("$ref_line")
done

log_dir="$(mktemp -d "${TMPDIR:-/tmp}/orchestos-pre-push.XXXXXX")"
log_file="$log_dir/coverage.log"
tree="$log_dir/tree"
cleanup() {
  git worktree remove --force "$tree" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
}
trap cleanup EXIT

push_sha=""
last_sha=""
for ref_line in "${push_refs[@]}"; do
  read -r local_ref local_sha remote_ref remote_sha <<<"$ref_line"
  if [[ -n "$local_sha" && ! "$local_sha" =~ ^0+$ ]]; then
    last_sha="$local_sha"
    if [[ "$local_ref" == "refs/heads/master" ]]; then push_sha="$local_sha"; fi
  fi
done
[[ -n "$push_sha" ]] || push_sha="$last_sha"
if [[ -z "$push_sha" ]]; then
  echo "⏭️ pre-push: push de borrado sin commits; suite y lint omitidos."
  exit 0
fi
short_sha="${push_sha:0:7}"
echo "🧪 pre-push: corriendo la suite + trinquete de cobertura (lo mismo que CI)..."
echo "🔎 pre-push: verificando $short_sha (commit empujado, no el árbol)."

ci_home="$log_dir/home"
ci_bin="$log_dir/bin"
mkdir -p "$ci_home" "$ci_bin"
ln -s "$(command -v bun)" "$ci_bin/bun"
ln -s "$(command -v git)" "$ci_bin/git"
if command -v node >/dev/null 2>&1; then
  ln -s "$(command -v node)" "$ci_bin/node"
fi

# A clean HOME and minimal PATH reproduce CI; useConfigOnly prevents Mac Git from inferring
# an identity the Linux runner lacks, after three Mac-green/CI-red streaks.
printf '[user]\n\tuseConfigOnly = true\n' > "$ci_home/.gitconfig"
if ! git worktree add --detach "$tree" "$push_sha"; then
  echo "❌ pre-push: no se pudo preparar el worktree para $short_sha. Push abortado."
  exit 1
fi
repo_root="$(git rev-parse --show-toplevel)"
while IFS= read -r dependency_dir; do
  relative_dir="${dependency_dir#"$repo_root"/}"
  mkdir -p "$tree/$(dirname "$relative_dir")"
  ln -s "$dependency_dir" "$tree/$relative_dir"
done < <(find "$repo_root" -type d -name node_modules -prune -print)

if ! (cd "$tree" && env HOME="$ci_home" GIT_CONFIG_GLOBAL="$ci_home/.gitconfig" GIT_CONFIG_NOSYSTEM=1 PATH="$ci_bin:/usr/bin:/bin:/usr/sbin:/sbin" bun run test:coverage) >"$log_file" 2>&1; then
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
if ! (cd "$tree" && bun run lint) >"$lint_log" 2>&1; then
  echo ""
  echo "❌ pre-push: bun run lint falla (mismo paso de CI). Push abortado."
  echo "   Primeras 60 líneas de diagnósticos:"
  sed -n '1,60p' "$lint_log"
  echo "   Sugerencia: bunx biome check --write ."
  echo "   Log completo: $lint_log"
  exit 1
fi

tail -n 6 "$lint_log"

# CI.10/CI.9.5: los flujos con modelo real corren automáticamente cuando cambia el chat.
ui_flows=(smoke plan-doc project-delete usage-bar text-sweep chat-turn-details tasks runs-graph qa-negative restart-mid-run project-tabs model-routing composer-picker chat-roles chat-context)
ui_paths='^(src/dashboard/|scripts/ui-gate/|src/run/)'
ui_required=0
chat_required=0
chat_paths='^(src/dashboard/handlers/chat|src/dashboard/chat-cli-models\.ts|src/dashboard/app/src/App\.tsx|src/dashboard/app/src/components/chat/|src/dashboard/app/src/api/chat|src/dashboard/app/src/components/common/AgentComposer|src/run/executors/|scripts/ui-gate/flows/(chat-streaming|codex-live|chat-continuity)\.mjs)'
for ref_line in "${push_refs[@]}"; do
  read -r local_ref local_sha remote_ref remote_sha <<<"$ref_line"
  [[ -n "$local_sha" ]] || continue
  if [[ "$remote_sha" =~ ^0+$ ]]; then
    base_sha="$(git merge-base "$local_sha" origin/master 2>/dev/null || true)"
  else
    base_sha="$remote_sha"
  fi
  [[ -n "$base_sha" ]] || continue
  changed_paths="$(git diff --name-only "$base_sha" "$local_sha")"
  if grep -Eq "$ui_paths" <<<"$changed_paths"; then
    ui_required=1
  fi
  if grep -Eq "$chat_paths" <<<"$changed_paths"; then chat_required=1; fi
done

if (( ui_required )); then
  ui_log="$log_dir/ui-gate.log"
  echo "🧭 pre-push: cambios de dashboard/run detectados; corriendo ${#ui_flows[@]} ui-gates..."
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

if (( chat_required )); then
  chat_log="$log_dir/chat-gate.log"
  echo "💬 pre-push: cambios de chat detectados; corriendo chat-streaming, codex-live y chat-continuity..."
  if ! bun run ui:gate chat-streaming codex-live chat-continuity >"$chat_log" 2>&1; then
    echo "⚠️ pre-push: falló el chat-gate; reintentando una vez (latencia de modelo real)."
    chat_retry_log="$log_dir/chat-gate-retry.log"
    if ! bun run ui:gate chat-streaming codex-live chat-continuity >"$chat_retry_log" 2>&1; then
      echo "❌ pre-push: chat-gates fallaron dos veces. Push abortado."
      tail -n 100 "$chat_retry_log"
      echo "   Log completo: $chat_retry_log"
      exit 1
    fi
    tail -n 15 "$chat_retry_log"
  else
    tail -n 15 "$chat_log"
  fi
else
  echo "⏭️ pre-push: sin cambios de chat; chat-streaming y codex-live omitidos."
fi

echo "✅ pre-push: verde. CI debería coincidir. Log completo: $log_file"
