# UI.8.6 — Permisos visibles (`INS-2026-014`)

GO de Carlos 2026-10-16: (1) aprobación a nivel de **tarea** ahora; aprobar cada herramienta a mitad de
corrida queda como bloque propio; (2) default **Yolo**; (3) el modo es **por proyecto**.
Referencias: Orca §A.6 (tira permanente) y §A.11 (`Yolo | Manual`) en `docs/done/ui/ui-reference-patterns.md:84,127`.

## Qué cambiar

### 1. Config por proyecto — `permissionMode: 'yolo' | 'manual'`
- `src/config/schema.ts:71` (`OrcheConfig`): campo opcional `permissionMode?: 'yolo' | 'manual'`. Ausente = `yolo`.
- `src/config/load.ts:~105`: `permissionMode: raw.permissionMode === 'manual' ? 'manual' : undefined` (mismo criterio
  que `adversarialQA`: solo el literal válido cuenta).
- `src/dashboard/handlers/config.ts`: GET (`:31`) devuelve `permissionMode` (`'yolo'` si ausente) y
  `permissions` (punto 2). PUT (`:126`) acepta `permissionMode` ∈ {`yolo`,`manual`}, 400 si otro valor; lo escribe
  en el `orchestos.config.yaml` del proyecto con el mismo mecanismo que `taskAgentRules`.
- `src/dashboard/app/src/api/settings.ts:196,219`: tipos de `getConfig`/`saveConfig`.

### 2. Descripción honesta, derivada de los flags reales — `src/run/permissions.ts` (nuevo)
- Extraer a constantes exportadas y **usarlas en los builders** (no duplicar literales):
  - `CLAUDE_TASK_ALLOWED_TOOLS = 'Edit,Write,Read,Glob,Grep'` en `external.ts` (`:170` y `:196`).
  - `CODEX_TASK_SANDBOX = 'workspace-write'` en `codex.ts` (`:128`, `:145`).
  - `OPENCODE_TASK_AUTO_FLAG = '--auto'` en `opencode.ts` (`:81`, `:90`).
- `describePermissions(cfg)` → `{ mode, chat: string, tasks: string }`:
  - `chat`: siempre `read-only` (las tres fronteras de chat ya lo son; no cambiar).
  - `tasks`: según el agente del rol `executor` (`resolveRole(cfg,'executor')`, `src/config/load.ts:192`):
    - claude → `isolated worktree · tools: Edit, Write, Read, Glob, Grep · no shell` (de la constante).
    - codex → `isolated worktree · sandbox workspace-write` (de la constante).
    - opencode → `isolated worktree · all tools auto-approved (--auto)`.
    - otro/sin asignar → `isolated worktree`.
  - Test unitario: el texto contiene cada herramienta de `CLAUDE_TASK_ALLOWED_TOOLS` y `CODEX_TASK_SANDBOX`; si
    alguien cambia el flag, la descripción cambia sola.

### 3. Backend: Manual retiene toda tarea del chat — `src/dashboard/handlers/chat.ts:1166`
- Hoy: `existingFiles.length` → `held`; si no, `spawnTaskRun`. Nuevo: retener si `existingFiles.length > 0`
  **o** `cfg.permissionMode === 'manual'` (`cfg` ya está cargado en `:1143`). Mismo payload `held`,
  `existingFiles` (puede ser `[]`), misma persistencia (`:1479`). Nota (`:1181`): en Manual sin archivos existentes,
  `⏸ Created task \`<id>\`, waiting for your approval before it runs (Manual permissions).`
- Liberar = el camino que ya existe: **Approve & Run** → `POST /api/tasks/:id/run`. No crear endpoint nuevo.
- Verificar que `App.tsx:241-259` no descarta la tarjeta cuando `existingFiles` es `[]` (hoy usa
  `row.existingFiles` como `output`; si queda vacía, usar el `output` de la tarea pendiente).
- Test de handler: Manual + sin archivos existentes → no hay `spawnTaskRun`, `taskHeld: true`; Yolo → corre.

### 4. Tira permanente sobre el compositor — `OrchestChatView.tsx:546`
- Dentro de `data-composer-region`, **encima** de `<AgentComposer>` (debajo no va nada: comentario `:545`).
- Una línea, `text-xs` muted, sin caja ni color de alerta:
  `Chat: read-only · Tasks: <tasks> · <Auto-run | Manual approval>`. `data-permissions-strip`,
  `data-permission-mode="yolo|manual"`.
- Datos: `permissions` de `GET /api/config` del proyecto activo; refrescar al guardar en Settings y al cambiar de
  proyecto. Sin proyecto activo: no se muestra.
- Look: familia UI.24 (un acento, sin degradados, sin iconos de alerta). `Manual approval` puede llevar el acento.

### 5. Settings — `OrchestSettingsView.tsx`, sección del proyecto (junto a Model routing, `:517`)
- `SettingsRow` + `SettingsSegmented` (`settings/primitives.tsx:53,76`), label `Agent permissions`, opciones
  `Yolo | Manual`, descripción de una línea:
  `Yolo runs tasks the chat creates right away. Manual waits for your approval in the chat before each task runs.`
- Guarda al cambiar (`saveConfig({ permissionMode }, activeProjectId)`), toast igual que los demás. `data-permission-mode-control`.

### 6. Gate en vivo — `scripts/ui-gate/flows/chat-permissions.mjs` (nuevo)
Modelo: `chat-retry-report.mjs:130`. Proyecto temporal **sin** el archivo de salida (que la retención venga de
Manual, no de `existingFiles`):
1. Tira visible con `data-permission-mode="yolo"` y texto `Auto-run`.
2. Settings → `Manual`; volver al chat: tira con `manual` y `Manual approval`; YAML del proyecto con `permissionMode: manual`.
3. Pedir crear un archivo nuevo → `[data-task-state="held"]` visible; la tarea sigue `pending` sin run tras 5 s.
4. Approve & Run → la tarea sale de `held` (running/done). Capturas `shot` en 1, 2, 3.
No entra al pre-push (usa CLI real); evidencia con
`bun run gate:evidence -- --label UI.8.6-chat-permissions -- bun run ui:gate chat-permissions`.

## Qué no tocar
- Las fronteras de chat (`CLAUDE_CHAT_BOUNDARY_FLAGS`, codex app-server `read-only`, opencode `--agent plan`).
- Los flags de tarea en sí: solo se extraen a constantes, mismo valor.
- `orchestos.config.yaml` de este repo (cambio ajeno sin commitear), `IDEAS.md`.
- Aprobación de cada herramienta (bloque aparte).

## Verificación
- `bunx tsc --noEmit`, `bun run test:coverage`, lint del app.
- `rg` en `scripts/ui-gate/` por textos/selectores del hilo tocados (lección `AGENTS.md`).
- Gate en vivo del punto 6 con evidencia.
