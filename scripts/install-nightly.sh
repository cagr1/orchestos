#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
label="dev.cagr1.orchestos.nightly-ui-gates"
target="$HOME/Library/LaunchAgents/$label.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.orchestos/nightly"
if [[ -f "$target" ]]; then
  launchctl bootout "gui/$UID" "$target" || true
fi
cp "$root/scripts/launchd/$label.plist" "$target"
launchctl bootstrap "gui/$UID" "$target"
echo "✓ $label instalado (01:30)"
