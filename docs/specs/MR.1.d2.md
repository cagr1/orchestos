# MR.1.d2 — El contexto que el chat inyecta al CLI dice la verdad (AT.13)

Alcance = AT.13 puntos 1-8 (PLAN.md § AT.13) + `$0` del chat de Codex sin precio (resto de MR.1.b2). Capa genérica
para cualquier agente del chat; OpenCode solo recibe el texto común (parcado, no se toca su adaptador).
Preflight de Luna: `--item MR.1`. Fuera: cambiar la columna `runs.usd_cost` (nullable pero leída por ~19 archivos),
el adaptador de OpenCode, el ejecutor de tareas, MR.1.d5.

Estado verificado 2026-09-27 (DB real `~/.orchestos/db.sqlite` + código):
- Todos los runs de chat Codex tienen `usd_cost = 0` con `cost_breakdown_json[0].source = "unknown"`; el contexto los
  suma como `$0.0000`.
- `runs.model` mezcla `gpt-5.6-luna via Codex CLI (effort: medium)`, `codex (cli default model) via Codex CLI`,
  `claude (cli default model)`, `gpt-6-luna` (provider `role:codex`), `unknown`.
- `memory_entries` = 0 filas y `.orchestos/specs/` no existe en este repo → el bloque Memory/Specs no aparece, pero el
  prompt dice "Answer questions about … memory, specs".
- El perfil guardado del proyecto dice `Runtime: Node.js` y `No scripts detected` (hay `bun.lock` y `lint`, `check`,
  `test:coverage`, `typecheck`…).
- Input de un turno Codex del chat: 12.3 K–26.4 K tokens.

## Backend
0. Extraer el armado del prompt de `src/dashboard/handlers/chat.ts:1134-1274` a una función pura nueva
   `buildChatSystemPrompt(input)` en `src/chat/chat-context.ts` (entrada: tasks, runs recientes, memoria, specs,
   contexto del proyecto, agente, etiqueta de modelo, instrucción de auto-tarea, `now`, zona horaria). `chat.ts` solo
   junta los datos y la llama. Sin cambio de comportamiento salvo los puntos siguientes.
1. **Herramientas reales.** Cada adaptador exporta lo que realmente habilita, y el prompt lo cita en vez de
   "may run the CLI tools":
   - Claude: constante `CLAUDE_CHAT_TOOLS = 'Read,Glob,Grep'` en `src/run/executors/external.ts`, usada por
     `buildClaudeChatArgs` (`:325-326`) y por el prompt → "You can read files with Read, Glob, Grep. You cannot edit
     files or run commands."
   - Codex: `--sandbox read-only` (`src/run/executors/codex.ts:261`) → "You can read files and run read-only shell
     commands; writes are blocked by the sandbox."
   - OpenCode: `--agent plan` → "read-only plan agent".
   - API/Ollama: el texto actual de `chat.ts:1270` (no puede modificar archivos).
2. **Costo desconocido = `n/a`.** En el contexto, un run cuyo `cost_breakdown_json` tiene alguna entrada con
   `source: "unknown"` (o `usd_cost` nulo) se imprime `n/a` y no suma; el encabezado dice
   `total cost $X (partial: N runs without price)` cuando N > 0. `runCodexChat` (`codex.ts:345-348`) devuelve
   `usd: null` cuando no hay precio en catálogo (tipo `number | null`), nunca `0`; `chat.ts` pasa `reportedUsd:
   result.usd` en la rama Codex (hoy no lo pasa, `:1516-1525`) y `chatCost` ya marca `unknown`.
3. **Tasks en una línea.** `id [status] [qa:…] [retries:n]: <primera línea de la descripción, máx. 80 chars…>`.
   El detalle completo no se inyecta; el CLI puede leer `.orchestos/tasks.yaml` con sus herramientas (decirlo en una
   frase). Solo tasks no `done` + las 5 `done` más recientes; el encabezado conserva los conteos totales.
4. **Motivo de QA.** Para cada task con `qa_verdict: fail`, añadir ` — qa: <runs.qa_reason del último run con ese
   task_id, máx. 120 chars>` (consulta a `runs` por `task_id`, `created_at DESC LIMIT 1`).
5. **Modelo normalizado.** Función `displayRunModel(model, provider)` en `src/chat/chat-context.ts`: quita el sufijo
   ` via … CLI` y ` (effort: …)`, convierte `… (cli default model)` y `unknown` en `<agente> default`, y prefija el
   agente: `codex · gpt-6-luna`, `claude · claude-opus-5-5`, `openrouter · openai/gpt-5.4`. Solo para mostrar: no
   reescribe la DB. Los runs nuevos del chat ya guardan el modelo canónico (`canonicalModel`, `chat.ts:1339`).
6. **Fechas con zona.** Encabezado `Now: <fecha-hora local> (<IANA tz>, UTC±hh:mm)`; cada run
   `YYYY-MM-DD HH:mm` en hora local con la misma etiqueta de zona (no el ISO UTC recortado de `:1167`).
7. **Índice de memoria/specs.** El rol solo menciona memoria y specs si hay algo: bloque `Project files:` con las
   rutas que existan de `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `PLAN.md`, `README.md` (existencia, no contenido),
   más `Memory (N entries)` y `Specs (N)` como hoy cuando N > 0. Con N = 0 no se nombran en el rol. El
   `search_memory` solo existe en la ruta API: en rutas CLI no se promete.
7b. **Perfil veraz** (menor, barato): `src/detect/manifest.ts:21` → `runtime: 'Bun'` si hay `bun.lock`/`bun.lockb`;
   `src/detect/profile.ts:16` → gestor `bun` también si hay `bun.lock`, y sumar `typecheck`, `check`,
   `test:coverage` a `interesting`. El `agents_md` guardado se regenera por la ruta que ya existe al re-detectar el
   proyecto (no migración).
8. **Sin contradicciones propias.** Borrar del prompt de OrchestOS la frase de "Files to create or modify"
   (`chat.ts:1272`: las tareas entran solo por chat) y cualquier promesa que el punto 1 desmienta. **No** cambiar
   `--append-system-prompt` por `--system-prompt` ni tocar el prompt base de Codex en esta pasada (decisión de Carlos, abajo).
9. **Medición.** Guardar `context_tokens = estimateTokens(systemPrompt)` en el run de chat (columna existente,
   hoy vacía en chat). Reportar antes/después para el mismo proyecto temporal y el mismo mensaje.

## Tests
- `src/chat/chat-context.test.ts`: herramientas por agente (Claude/Codex/OpenCode/API); run con `source: unknown` →
  `n/a` y total "partial"; task larga → una línea ≤ 80 chars; task `qa:fail` → motivo; `displayRunModel` sobre los
  6 valores reales de arriba; fecha con zona inyectando `now` y tz fijos; memoria/specs vacíos → el rol no los nombra.
- `codex.test.ts`: `runCodexChat` con modelo sin precio → `usd: null`.
- `manifest`/`profile`: `bun.lock` → Bun + `bun run`; `test:coverage` detectado.

## Gate
- `test:coverage` (comando exacto de CI), tsc back+app, biome.
- Turno real de chat con Claude CLI (haiku) y con Codex (`gpt-6-luna` medium) sobre un proyecto temporal con una task
  `qa:fail` y un run sin precio; capturar el system prompt (log de depuración del gate o el test de integración) y
  verificar: herramientas reales, `n/a`, tasks en una línea, motivo de QA, modelos normalizados, zona horaria.
- `context_tokens` antes/después del mismo turno → PLAN.md.
- Los 11 ui:gate verdes (el prompt cambia la respuesta del Orquestador: `chat-roles` y `chat-streaming` sobre todo).

## Decisión de Carlos 2026-09-27 (punto 8): medir ahora, reemplazar después
Claude CLI recibe hoy el prompt de OrchestOS **encima** del prompt base de Claude Code (`--append-system-prompt`);
Codex, dentro del mensaje, encima del suyo. Reemplazarlo (`--system-prompt` en Claude) quita peso pero también las
instrucciones de uso de herramientas del CLI. Recomendación: esta pasada solo mide (`context_tokens` + tokens de
input reales del CLI) y quita las contradicciones propias; reemplazar el prompt base va aparte, con la medición en
la mano.
