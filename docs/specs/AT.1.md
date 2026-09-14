# AT.1 — Hook `brain-no-code`: el cerebro no teclea código

Ejecutor: Luna. Implementa exactamente esto; si algo resulta imposible, para y repórtalo.
**No commitees y no toques `PLAN.md`, `AGENTS.md` ni `CLAUDE.md`.** El cierre lo hace el cerebro.

Preflight: `bun run agent:preflight -- --item AT.1 --agent luna`.

## Qué construir

1. `.claude/hooks/brain-no-code.js` — hook `PreToolUse` de Claude Code, Node ESM, mismo estilo
   que `.claude/hooks/startup-guard.js` (cabecera con propósito, sin dependencias).
   - Raíz: `process.env.BRAIN_GUARD_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../..')`.
   - Lee el JSON de stdin: `tool_name`, `tool_input`.
   - Si `process.env.ORCHESTOS_ROLE === 'executor'` → permitir.
   - Cualquier error de lectura/parseo → permitir (salir 0 sin imprimir).
   - **Ruta de código:** convertir a relativa a la raíz (acepta absoluta o relativa, quita `./`).
     Si queda fuera de la raíz (`..`) → no es código. Si empieza con
     `.orchestos/worktrees/<nombre>/`, quitar ese prefijo. Es código si empieza con `src/`,
     `tests/`, `scripts/` o `.claude/hooks/`.
   - `Edit`, `Write`, `MultiEdit`: ruta = `tool_input.file_path`. `NotebookEdit`: `tool_input.notebook_path`.
     Bloquear si es ruta de código.
   - `Bash`: partir `tool_input.command` en segmentos por `&&`, `||`, `;`, `|`. Bloquear si en
     algún segmento:
     a. un redirect `>` o `>>` (no precedido de dígito ni `&`) apunta a ruta de código;
     b. el segmento empieza con `tee` y algún argumento que no empiece con `-` es ruta de código;
     c. el segmento empieza con `sed` o `perl`, tiene un flag que empieza con `-` y contiene `i`
        (`-i`, `-i.bak`, `-pi`), y algún token (sin comillas) es ruta de código.
   - Todo lo demás → permitir (salir 0 sin imprimir).
   - Bloquear = imprimir en stdout y salir 0:
     `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"<MSG>"}}`
     con MSG = `Cerebro no escribe código (AGENTS.md § Protocolo de delegación): escribe el spec en docs/specs/<ID>.md y delega a Luna. Ejecutor Sonnet: lanzar con ORCHESTOS_ROLE=executor. Ruta: <ruta relativa>`

2. `.claude/settings.json` — agregar en `hooks` (sin tocar lo existente):
   `"PreToolUse": [{ "matcher": "Edit|Write|MultiEdit|NotebookEdit|Bash", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/hooks/brain-no-code.js\"", "timeout": 5 }] }]`

3. `tests/hooks/brain-no-code.test.ts` — mismo patrón que `tests/hooks/startup-guard.test.ts`
   (`spawnSync('node', [HOOK_PATH], { input, env })`, `BRAIN_GUARD_ROOT` apuntando a un tmpdir).
   Casos, uno por `it`:
   - deny: `Edit` a `<root>/src/a.ts`; `Write` a `tests/x.test.ts`; `Edit` a `.claude/hooks/h.js`;
     `Edit` a `<root>/.orchestos/worktrees/t1/src/a.ts`.
   - allow (stdout vacío): `Edit` a `PLAN.md`; `Write` a `docs/specs/AT.9.md`; `Edit` fuera de la raíz.
   - deny Bash: `cat > src/a.ts <<EOF`; `echo x >> scripts/b.ts`; `sed -i '' 's/a/b/' src/a.ts`;
     `perl -pi -e 's/a/b/' tests/c.ts`; `echo x | tee src/a.ts`.
   - allow Bash: `bun test src/db/plan-items.test.ts 2>&1 | tee /tmp/log`; `git diff -- src/`;
     `grep -rn foo src/`; `sed -n 1,20p src/a.ts`; `git checkout HEAD -- src/a.ts`.
   - allow con `ORCHESTOS_ROLE=executor` sobre `Edit` a `src/a.ts`.
   - allow con stdin inválido.

## Gates del ejecutor

`bun test tests/hooks/brain-no-code.test.ts` verde · `bunx tsc --noEmit` limpio · `git status`
muestra solo los 3 archivos de arriba.
