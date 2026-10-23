#!/usr/bin/env bash
set -u

# Un commit parcial usa un índice temporal; sincronizar los derivados en el índice real.
for file in .orchestos/feature-status.json runs-summary.json; do
  if git diff HEAD --quiet -- "$file"; then
    git reset -q -- "$file"
  fi
done

exit 0
