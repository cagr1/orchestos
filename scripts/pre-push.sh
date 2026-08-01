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
if ! bun run test:coverage; then
  echo ""
  echo "❌ pre-push: esto mismo va a fallar en CI. Push abortado."
  echo "   Si el push es urgente y aceptás dejar CI rojo: git push --no-verify"
  exit 1
fi

echo "✅ pre-push: verde. CI debería coincidir."
