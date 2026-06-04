#!/usr/bin/env bash
# OrchestOS Installer — macOS / Linux
# Run: bash install.sh

set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'
BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
OK="${GREEN}✓${RESET}"; FAIL="${RED}✗${RESET}"; INFO="${YELLOW}→${RESET}"

echo ""
echo -e "${BOLD}OrchestOS — Installer${RESET}"
echo "=============================================="
echo ""

# ── 1. Bun ────────────────────────────────────────────────────────────────────
if command -v bun &>/dev/null; then
    BUN_VER=$(bun --version)
    echo -e "  $OK  Bun $BUN_VER"
else
    echo -e "  $INFO  Bun no encontrado — instalando..."
    if curl -fsSL https://bun.sh/install | bash; then
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
        if command -v bun &>/dev/null; then
            echo -e "  $OK  Bun instalado correctamente."
        else
            echo -e "  $FAIL  Bun instalado pero no detectado en esta sesión."
            echo -e "     ${DIM}Cierra esta terminal, abre una nueva y vuelve a ejecutar: bash install.sh${RESET}"
            exit 1
        fi
    else
        echo -e "  $FAIL  Error instalando Bun."
        echo -e "     ${DIM}Instala manualmente desde https://bun.sh y vuelve a ejecutar este script${RESET}"
        exit 1
    fi
fi

# ── 2. Repo / proyecto ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$SCRIPT_DIR/package.json" ]; then
    # Script was run outside the project directory — repo not cloned yet.
    # When OrchestOS has a public URL, replace the placeholder below and
    # uncomment the clone block.
    #
    # REPO_URL="https://github.com/YOUR_USER/orchestos"
    # git clone "$REPO_URL" orchestos
    # cd orchestos
    echo -e "  $FAIL  No se encontró package.json en el directorio actual."
    echo -e "     ${DIM}Asegúrate de ejecutar install.sh desde la carpeta de OrchestOS${RESET}"
    exit 1
fi

cd "$SCRIPT_DIR"
echo -e "  $OK  Proyecto encontrado: $SCRIPT_DIR"

# ── 3. Dependencias ───────────────────────────────────────────────────────────
echo -e "  $INFO  Instalando dependencias (bun install)..."
bun install
echo -e "  $OK  Dependencias instaladas."

# ── 4. ~/.orchestos/.env ──────────────────────────────────────────────────────
ORCHESTOS_DIR="$HOME/.orchestos"
ENV_PATH="$ORCHESTOS_DIR/.env"

mkdir -p "$ORCHESTOS_DIR"

if [ ! -f "$ENV_PATH" ]; then
    cat > "$ENV_PATH" << 'EOF'
# OrchestOS — API Keys
# ==============================================
# Obtén tu clave en https://openrouter.ai (REQUERIDA)
OPENROUTER_API_KEY=

# Opcional — necesaria para executor: anthropic
# Obtén tu clave en https://console.anthropic.com
ANTHROPIC_API_KEY=

# Opcional — necesaria para embeddings / dictado (Whisper)
# Obtén tu clave en https://platform.openai.com
OPENAI_API_KEY=
EOF
    echo -e "  $OK  Creado: $ENV_PATH"
    echo ""
    echo -e "  ${YELLOW}${BOLD}Importante:${RESET} abre ese archivo y añade tu OPENROUTER_API_KEY antes de continuar."
    echo -e "     ${DIM}Ruta: $ENV_PATH${RESET}"
    echo ""
    read -rp "  ¿Ya añadiste tu API key? (s para continuar, Enter para salir): " resp
    if [[ "${resp,,}" != "s" ]]; then
        echo "  Abre $ENV_PATH, añade la key y vuelve a ejecutar: bash install.sh"
        exit 0
    fi
else
    echo -e "  $OK  $ENV_PATH ya existe — no se sobreescribió."
fi

# ── 5. Abrir dashboard ────────────────────────────────────────────────────────
echo ""
echo -e "${DIM}──────────────────────────────────────────────${RESET}"
echo -e "  $OK  ${GREEN}${BOLD}Instalación completada.${RESET}"
echo ""
echo "  Iniciando el dashboard en http://localhost:4242 ..."
echo -e "  ${DIM}(Ctrl+C para detenerlo)${RESET}"
echo ""

# Open browser in background (macOS: open, Linux: xdg-open)
if command -v open &>/dev/null; then
    sleep 1 && open "http://localhost:4242" &
elif command -v xdg-open &>/dev/null; then
    sleep 1 && xdg-open "http://localhost:4242" &
fi

bun run src/cli.ts dashboard
