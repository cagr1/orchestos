#!/bin/sh

set +e
payload=$(cat 2>/dev/null) || payload=
if printf '%s' "$payload" | grep -q '"rate_limits"'; then
  home_dir=${ORCHESTOS_CLAUDE_STATUSLINE_HOME:-${ORCHESTOS_HOME:-${HOME:-}/.orchestos}}
  mkdir -p "$home_dir" 2>/dev/null || true
  tmp="$home_dir/.claude-statusline.json.$$"
  printf '%s' "$payload" >"$tmp" 2>/dev/null && mv -f "$tmp" "$home_dir/claude-statusline.json" 2>/dev/null || rm -f "$tmp" 2>/dev/null
  session_id=$(printf '%s' "$payload" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([A-Za-z0-9._-][A-Za-z0-9._-]*\)".*/\1/p' | sed -n '1p')
  if [ -n "$session_id" ]; then
    mkdir -p "$home_dir/claude-statusline" 2>/dev/null || true
    session_file="$home_dir/claude-statusline/$session_id.json"
    session_tmp="$session_file.$$"
    printf '%s' "$payload" >"$session_tmp" 2>/dev/null && mv -f "$session_tmp" "$session_file" 2>/dev/null || rm -f "$session_tmp" 2>/dev/null
  fi
fi
if [ -n "${ORCHESTOS_STATUSLINE_NEXT:-}" ]; then
  printf '%s' "$payload" | "$ORCHESTOS_STATUSLINE_NEXT" 2>/dev/null || true
fi
exit 0
