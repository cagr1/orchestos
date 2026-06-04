#Requires -Version 5.1
# OrchestOS Installer — Windows
# Run: powershell -ExecutionPolicy Bypass -File install.ps1
# Or double-click install.bat

$ErrorActionPreference = 'Stop'
$ESC   = [char]27
$GREEN = "$ESC[32m"; $RED = "$ESC[31m"; $YELLOW = "$ESC[33m"
$BOLD  = "$ESC[1m";  $DIM = "$ESC[2m";  $RESET  = "$ESC[0m"
$OK   = "${GREEN}✓${RESET}"
$FAIL = "${RED}✗${RESET}"
$INFO = "${YELLOW}→${RESET}"

Write-Host ""
Write-Host "${BOLD}OrchestOS — Installer${RESET}"
Write-Host ("=" * 46)
Write-Host ""

# ── 1. Bun ────────────────────────────────────────────────────────────────────
$bunCmd = Get-Command bun -ErrorAction SilentlyContinue
if ($bunCmd) {
    $bunVer = (bun --version 2>&1).Trim()
    Write-Host "  $OK  Bun $bunVer"
} else {
    Write-Host "  $INFO  Bun no encontrado — instalando..."
    try {
        Invoke-RestMethod bun.sh/install.ps1 | Invoke-Expression
        # Reload PATH so bun is visible in this session
        $userPath    = [System.Environment]::GetEnvironmentVariable("PATH", "User")
        $machinePath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
        $env:PATH    = "$userPath;$machinePath"
        $bunCmd = Get-Command bun -ErrorAction SilentlyContinue
        if ($bunCmd) {
            Write-Host "  $OK  Bun instalado correctamente."
        } else {
            Write-Host "  $FAIL  Bun instalado pero no se pudo detectar en esta sesión."
            Write-Host "     ${DIM}Cierra esta terminal, abre una nueva y vuelve a ejecutar install.bat${RESET}"
            Read-Host "Presiona Enter para salir"
            exit 1
        }
    } catch {
        Write-Host "  $FAIL  Error instalando Bun: $_"
        Write-Host "     ${DIM}Instala manualmente desde https://bun.sh y vuelve a ejecutar este script${RESET}"
        Read-Host "Presiona Enter para salir"
        exit 1
    }
}

# ── 2. Repo / proyecto ────────────────────────────────────────────────────────
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgJson   = Join-Path $scriptDir "package.json"

if (-not (Test-Path $pkgJson)) {
    # Script was run outside the project directory — repo not cloned yet.
    # When OrchestOS has a public URL, replace the placeholder below and
    # uncomment the clone block.
    #
    # $repoUrl = "https://github.com/YOUR_USER/orchestos"
    # git clone $repoUrl orchestos
    # Set-Location orchestos
    Write-Host "  $FAIL  No se encontró package.json en el directorio actual."
    Write-Host "     ${DIM}Asegúrate de ejecutar install.bat desde la carpeta de OrchestOS${RESET}"
    Read-Host "Presiona Enter para salir"
    exit 1
}

Set-Location $scriptDir
Write-Host "  $OK  Proyecto encontrado: $scriptDir"

# ── 3. Dependencias ───────────────────────────────────────────────────────────
Write-Host "  $INFO  Instalando dependencias (bun install)..."
bun install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  $FAIL  bun install falló. Revisa la salida anterior."
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host "  $OK  Dependencias instaladas."

# ── 4. ~/.orchestos/.env ──────────────────────────────────────────────────────
$orchestosDir = Join-Path $HOME ".orchestos"
$envPath      = Join-Path $orchestosDir ".env"

if (-not (Test-Path $orchestosDir)) {
    New-Item -ItemType Directory -Force $orchestosDir | Out-Null
}

if (-not (Test-Path $envPath)) {
    $envContent = @"
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
"@
    [System.IO.File]::WriteAllText($envPath, $envContent, [System.Text.Encoding]::UTF8)
    Write-Host "  $OK  Creado: $envPath"
    Write-Host "     ${YELLOW}${BOLD}Importante:${RESET} abre ese archivo y añade tu OPENROUTER_API_KEY antes de continuar."
    Write-Host ""
    Write-Host "     ${DIM}Ruta: $envPath${RESET}"
    Write-Host ""
    $resp = Read-Host "  ¿Ya añadiste tu API key? (s para continuar, cualquier otra tecla para salir)"
    if ($resp.ToLower() -ne 's') {
        Write-Host "  Abre $envPath, añade la key y vuelve a ejecutar install.bat"
        exit 0
    }
} else {
    Write-Host "  $OK  $envPath ya existe — no se sobreescribió."
}

# ── 5. Abrir dashboard ────────────────────────────────────────────────────────
Write-Host ""
Write-Host ($DIM + ("─" * 46) + $RESET)
Write-Host "  $OK  ${GREEN}${BOLD}Instalación completada.${RESET}"
Write-Host ""
Write-Host "  Iniciando el dashboard en http://localhost:4242 ..."
Write-Host "  ${DIM}(Ctrl+C para detenerlo)${RESET}"
Write-Host ""

Start-Process "http://localhost:4242"
bun run src/cli.ts dashboard
