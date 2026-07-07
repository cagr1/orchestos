#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Running pre-commit typecheck..."
cd "$(git rev-parse --git-dir)/.."
bun run typecheck

echo "📊 Exportando runs-summary para dreaming..."
bun run dreaming:export
git add runs-summary.json
