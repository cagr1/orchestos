#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Running pre-commit typecheck..."
# Mes 22/E.10 — `--git-dir` resuelve al gitdir INTERNO cuando el commit corre
# dentro de un worktree (ej. .git/worktrees/<name> del repo principal, no la
# carpeta del propio worktree) — `cd "$(git rev-parse --git-dir)/.."` aterrizaba
# en el lugar equivocado, y `bun run dreaming:export` (que resuelve su ruta de
# salida vía `import.meta.dir`, relativo al propio script) terminaba
# escribiendo `runs-summary.json` en el REPO PRINCIPAL en vez del worktree
# aislado — ensuciándolo justo antes de que el merge-back del sandbox
# intentara fusionar, incluso con el discard defensivo ya aplicado (E.9).
# `--show-toplevel` resuelve correctamente la raíz del working tree en AMBOS
# casos (repo principal o worktree) — verificado con una reproducción real.
cd "$(git rev-parse --show-toplevel)"
bun run typecheck

# Mes 22/F.2 — gate del ledger de responsabilidad de LLMs: si el commit toca un
# archivo listado en .claude/protected-rules.json, exige una entrada nueva en
# LEDGER.md en el mismo commit. Gobernanza de este repo, no feature del producto.
echo "📒 Verificando gate del ledger (Mes 22/F.2)..."
bun run ledger:gate

# Mes 22/E.10 — un worktree (sandbox de una tarea) NUNCA debe commitear
# runs-summary.json. Con la ruta ya corregida arriba, el export queda
# aislado a la copia del worktree (ya no ensucia el repo principal) — pero
# si el worktree TAMBIÉN lo commitea, cualquier commit en `master` que
# regenere el mismo archivo con OTRO timestamp produce un CONFLICTO DE
# CONTENIDO real en el rebase (no un timing issue, verificado con una
# reproducción: "CONFLICT (content): Merge conflict in runs-summary.json").
# Es un reporte compartido derivado de la DB, no parte del output de la
# tarea — el worktree jamás debería tocarlo. `.git` es un ARCHIVO (no
# carpeta) en la raíz de un worktree; en el repo principal es una carpeta.
if [ -f .git ]; then
  echo "📊 (worktree — se omite el export de runs-summary, solo corre en el repo principal)"
else
  echo "📊 Exportando runs-summary para dreaming..."
  bun run dreaming:export
  git add runs-summary.json
fi
