# Spec CTX-GUARD — Guard de arranque: config declarada y peso avisado antes de leer

Escrito por el cerebro (Claude Opus 5) el 2026-09-11. El ejecutor NO toma decisiones de
diseño: si algo no está resuelto aquí, para y reporta — no improvisa.

## Problema medido (no estimado)

Tab nuevo y limpio en OrchestOS, antes del primer tool call: **57,035 tokens**.
Medición cruda, transcript `~/.claude/projects/-Users-carlosgallardo-Documents-projects-orchestos/51eed520-*.jsonl`,
primer objeto con `message.usage`: `cache_creation 28,694 + cache_read 28,339`.

Desglose por fuente (chars/4):

| Fuente | tokens |
|---|---|
| System prompt del binario (schemas de tools + ~30 skills bundled) | ~46,000 |
| `MEMORY.md` del proyecto | 3,999 |
| `~/.claude/CLAUDE.md` | 2,600 |
| `CLAUDE.md` del proyecto | 1,677 |
| MCP: nombres diferidos + instrucciones de Figma | ~2,000 |
| Hooks (SessionStart + knowledge-radar) | ~580 |

## Causa raíz: dos canales que la regla vigente no cubría

`INS-2026-018` (plugins por proyecto) está bien aplicada: `.claude/settings.json` del repo
tiene `enabledPlugins: {}` y `claude plugin list` muestra todo disabled. Pero el contexto
seguía cargando basura por **dos canales distintos que esa regla no nombra**:

1. **Conectores de cuenta claude.ai** (Figma, Vercel, Supabase, Mintlify, Gmail, Drive,
   Calendar). Viven en el servidor de la cuenta, no en `.mcp.json` ni en `mcpServers`.
   Verificado 2026-09-11: `claude mcp remove "claude.ai Figma"` responde
   `No MCP server named "claude.ai Figma"` y el conector sigue conectado. No hay env var
   (`CLAUDE_CODE_DISABLE_*MCP*` solo expone `MCP_TASK_BACKGROUND`). La única llave local
   es la clave `disabledMcpServers` de settings (string encontrado en el binario 2.1.234).
2. **Skills bundled del binario**: ~30 skills cargan su descripción en cada sesión sin que
   ningún `enabledPlugins` las toque. Llave: env `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1`.
   `knowledge-radar` y `knowledge-promote` NO son skills bundled — son commands en
   `~/.claude/commands/*.md` (verificado), así que sobreviven al flag.

Ya aplicado por el cerebro en `.claude/settings.json` (versionado, viaja con el repo a
cualquier terminal y cualquier máquina): `disabledMcpServers` con los 7 conectores, y
`env` con `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1` + `CLAUDE_CODE_DISABLE_ARTIFACT=1`.

## Por qué hace falta un diente y no una regla más

Es el patrón de `CLAUDE.md § Regla cero`: el pre-commit estuvo 11 días desincronizado en
silencio porque nadie hacía cumplir la regla mecánicamente. Aquí es idéntico — la config
se "desconfiguró" sola (un conector nuevo de la cuenta, una skill nueva del binario,
un `settings.json` reseteado) y nadie se enteró hasta medir. Una regla escrita no es
enforcement (`docs/agent-work-protocol.md` § Principio).

## Trabajo a ejecutar

### 1. `.claude/hooks/startup-guard.js` (nuevo, ESM, sin dependencias externas)

Hook `SessionStart` (matcher `startup|resume|clear|compact`). Node puro, timeout 5 s.
No debe llamar a `claude mcp list` (hace red, tarda segundos). Solo lee archivos.

Comprueba, en este orden, y **acumula** los hallazgos:

- **Deriva de conectores:** lee `~/.claude.json` → `claudeAiMcpEverConnected` (array de
  strings). Lee `.claude/settings.json` del repo → `disabledMcpServers`. Todo nombre del
  primero ausente del segundo es un hallazgo: `conector no declarado: <nombre>`.
- **Deriva de env:** `.claude/settings.json` → `env`. Si falta
  `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` o no vale `"1"`, hallazgo.
- **Deriva de plugins:** `~/.claude/settings.json` → `enabledPlugins`. Toda clave con
  valor `true` que no esté en la allowlist `["security-guidance@claude-plugins-official"]`
  es un hallazgo.
- **Peso del arranque:** suma `wc -c / 4` de `~/.claude/CLAUDE.md`, `CLAUDE.md` del repo y
  `<memoria del proyecto>/MEMORY.md` (ruta:
  `~/.claude/projects/-Users-carlosgallardo-Documents-projects-orchestos/memory/MEMORY.md`).
  Si el total supera **9,000** tokens estimados, hallazgo con el desglose por archivo.

**Salida — regla dura, misma lógica que `context-budget.js`:** si no hay ningún hallazgo,
el hook **no imprime absolutamente nada** y sale 0. Un aviso por sesión que siempre aparece
es el mismo mal que este hook cura. Con hallazgos: imprime un bloque de como máximo 8
líneas, encabezado `[startup-guard] arranque pesado o config derivada:`, una línea por
hallazgo, y una última línea con la orden concreta de arreglo. Sale 0 siempre — nunca
bloquea la sesión.

Cualquier error de lectura o JSON inválido: salir 0 en silencio. El guard jamás rompe un tab.

### 2. Registrar el hook

Añadirlo al array `SessionStart` de `.claude/settings.json` del repo, después del
`session-resume.js` existente. Mismo formato (`command` con `${CLAUDE_PROJECT_DIR}`, timeout 5).

### 3. Test

`tests/hooks/startup-guard.test.ts` (Bun). Mínimo 4 casos, con fixtures en tmpdir, sin
tocar el `~/.claude.json` real:
- config correcta → stdout vacío, exit 0;
- un conector en `claudeAiMcpEverConnected` ausente de `disabledMcpServers` → hallazgo;
- `env` sin `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` → hallazgo;
- JSON corrupto → stdout vacío, exit 0.

## Fuera de alcance — NO TOCAR

`PLAN.md`, `src/**`, `scripts/**`, `.claude/hooks/context-budget.js`,
`.claude/hooks/session-resume.js`, `AGENTS.md`, `CLAUDE.md`, cualquier archivo de
`~/Documents/MemoriesMD`, y `~/.claude/settings.json`. No borrar ni reordenar las claves
ya existentes de `.claude/settings.json`.

## Gates de cierre

- `bunx tsc --noEmit` limpio.
- `bun test ./tests/hooks/startup-guard.test.ts` verde.
- `bun run test:coverage` (comando exacto de CI) verde antes del push.
- Prueba en vivo: correr el hook a mano con la config actual del repo y pegar la salida
  cruda (debe ser vacía); luego con un conector borrado a mano de `disabledMcpServers` en
  una copia temporal, y pegar el aviso. Evidencia cruda, no "verificado".
