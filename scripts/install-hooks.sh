#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
hooks_dir="$(git rev-parse --git-path hooks)"
mkdir -p "$hooks_dir"

for hook in pre-commit pre-push; do
  cp "$root/scripts/$hook.sh" "$hooks_dir/$hook"
  chmod +x "$hooks_dir/$hook"
  echo "✓ $hook instalado en $hooks_dir/$hook"
done
