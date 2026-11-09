#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
label="dev.cagr1.orchestos.nightly-ui-gates"
target="$HOME/Library/LaunchAgents/$label.plist"
IFS=: read -r -a path_entries <<< "$PATH"
filtered_path_entries=()
for path_entry in "${path_entries[@]}"; do
  [[ "$path_entry" == */node_modules/.bin ]] && continue
  filtered_path_entries+=("$path_entry")
done
PATH="$(IFS=:; printf '%s' "${filtered_path_entries[*]}")"
export PATH
nightly_path=""
for binary_dir in "${filtered_path_entries[@]}"; do
  for binary in bun node git claude codex opencode; do
    if [[ -x "$binary_dir/$binary" ]]; then
      case ":$nightly_path:" in
        *":$binary_dir:"*) ;;
        *) nightly_path="${nightly_path:+$nightly_path:}$binary_dir" ;;
      esac
    fi
  done
done
for binary in bun node git; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "Error: falta $binary en el PATH; no se instala $label" >&2
    exit 1
  fi
done
for binary_dir in /opt/homebrew/bin /usr/local/bin /usr/bin /bin /usr/sbin /sbin; do
  case ":$nightly_path:" in
    *":$binary_dir:"*) ;;
    *) nightly_path="${nightly_path:+$nightly_path:}$binary_dir" ;;
  esac
done
echo "PATH del LaunchAgent: $nightly_path"
# Escape both XML text and sed replacement characters without changing the source plist.
xml_path="${nightly_path//&/\&amp;}"
xml_path="${xml_path//</\&lt;}"
xml_path="${xml_path//>/\&gt;}"
replacement="${xml_path//\\/\\\\}"
replacement="${replacement//&/\\&}"
replacement="${replacement//|/\\|}"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.orchestos/nightly"
if [[ -f "$target" ]]; then
  launchctl bootout "gui/$UID" "$target" || true
fi
sed "s|__ORCHESTOS_NIGHTLY_PATH__|$replacement|g" "$root/scripts/launchd/$label.plist" > "$target"
launchctl bootstrap "gui/$UID" "$target"
echo "✓ $label instalado (01:30)"
