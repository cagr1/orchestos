# Diagnóstico — por qué no se puede usar Codex CLI en OrchestOS (2026-09-14)

Solo diagnóstico. No se aplicó ningún cambio. Entorno: `codex-cli 0.153.4`, `codex login status` →
"Logged in using ChatGPT".

## 1. Causa principal: el chat de proyecto bloquea Codex a propósito

- `src/run/executors/cli-registry.ts:79-88`: Codex tiene `readBoundary: { kind: 'none' }`, con
  el motivo "Codex no ofrece hoy un sandbox que acote paths de lectura.".
- `src/dashboard/handlers/chat.ts:107-116` solo admite agentes que tengan un límite real de
  lectura. Por eso `chat.ts:763-764` responde 400.
- Crear una sesión de proyecto con Codex también da 400 (`src/dashboard/handlers/chat-sessions.ts:132-139`).
- El toast que se muestra sale de `cli-registry.ts:52`: `CLI "Codex" no está disponible para chat de proyecto: ...`.
- Es intencional: el gate AT.3 (NEXT.md) espera justo ese toast. `chat.ts:1111-1118` documenta
  que en la prueba en vivo del 2026-08-17 `--sandbox read-only` no impidió escribir.

## 2. El chat general (sin proyecto) también falla — dos bugs

El agente lo reprodujo con una sola llamada "responde OK" (`chat.ts:1398-1439`,
`src/run/executors/codex.ts:227-295`):

1. **Carpeta fuera de git:** el chat corre en un directorio temporal que no es un repositorio
   git y no pasa `--skip-git-repo-check`. Resultado:
   `Not inside a trusted directory and --skip-git-repo-check was not specified.` y exit 1.
2. **Credenciales no heredadas:** `CODEX_HOME` se redirige a `.orchestos/agent-home/codex`
   (`codex.ts:243`), sin `auth.json`, y además se pasa `--ignore-user-config` (`codex.ts:236`).
   Resultado: `401 Unauthorized: Missing bearer or basic authentication` y exit 1, aunque
   `~/.codex/auth.json` existe.

## 3. Descartado

- **Flags:** los que usa OrchestOS existen en 0.153.4 (`exec`, `--json`, `--sandbox`, `--color`,
  `--ignore-user-config`, `-m`, `-c`). El formato JSON (`thread.started`, `turn.started`)
  coincide con el que espera el parser.
- **Config local sin commitear:** `apiMode: agentic` y `agentic.maxIterations: 2` en
  `orchestos.config.yaml` solo aplican al agente `api` (`src/dashboard/handlers/config.ts:11`).
  No afectan a Codex.

## 4. No verificado

- El mensaje exacto que vio Carlos (no se pegó).
- Ejecución de tasks con Codex de punta a punta. Por el código debería funcionar:
  - `engine-cascade.ts:141-142` → `openai/gpt-5.4`.
  - No redirige `CODEX_HOME`.
  - Exige modo worktree (`codex.ts:317-321`).
  - Un modelo no `openai/*` aborta antes (`codex.ts:326-331`).
- Si el dashboard permite elegir Codex en una sesión general.

## 5. Corrección sugerida (pendiente de decisión de Carlos)

- **Para usar el chat ya:** elegir Claude en Settings y dejar Codex para tasks.
- **Chat de proyecto con Codex:** es un cambio de seguridad multi-módulo. Requiere un plan
  confirmado y demostrar en vivo un bloqueo de lectura real antes de cambiar `readBoundary`.
- **Chat general:**
  - Añadir `--skip-git-repo-check` en `buildCodexChatArgs`.
  - Dar acceso a la auth dentro del `CODEX_HOME` aislado: enlazar/copiar `~/.codex/auth.json`,
    o no reemplazar `CODEX_HOME`.
  - Revisar el mismo patrón en los otros CLIs registrados.
