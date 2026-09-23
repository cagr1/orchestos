#!/bin/sh

set +e
payload=$(cat 2>/dev/null) || payload=
if printf '%s' "$payload" | grep -q '"rate_limits"'; then
  home_dir=${ORCHESTOS_HOME:-${HOME:-}/.orchestos}
  mkdir -p "$home_dir" 2>/dev/null || true
  tmp="$home_dir/.claude-statusline.json.$$"
  printf '%s' "$payload" >"$tmp" 2>/dev/null && mv -f "$tmp" "$home_dir/claude-statusline.json" 2>/dev/null || rm -f "$tmp" 2>/dev/null
fi
if [ -n "${ORCHESTOS_STATUSLINE_NEXT:-}" ]; then
  printf '%s' "$payload" | "$ORCHESTOS_STATUSLINE_NEXT" 2>/dev/null || true
fi
exit 0
