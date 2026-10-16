# AT.13 — el contexto de proyecto que el chat inyecta dice la verdad y no pesa

Decisión de Carlos 2026-10-16: NO reemplazar el prompt base del CLI. Se mide y se quita lo falso/ruido de lo que
agrega OrchestOS.

## Problema (medido 2026-10-16)
- `loadContext()` (`src/context/load.ts:3`) devuelve `projects.agents_md` guardado en DB, que solo se regenera con
  `orchestos init/context/summary`. En este repo el registro es del 2026-08-17 y le dice al CLI "Runtime: Node.js,
  Framework: none, No scripts detected"; `buildProfile()` en el momento da Bun, React y 5 scripts (~20 ms).
- En el gate `chat-context` (proyecto recién `init`, luego se escriben archivos) el bloque "Project context" llega
  todo en `unknown` + "## Notes for AI agents" (reglas para quien edita; el chat es de solo lectura). Línea base:
  `context_tokens` 740, Codex `input_tokens` 2930 (`/tmp/at13-before/result.json`).

## Cambios
1. `src/context/load.ts`: agregar
   `export async function refreshProjectContext(root: string): Promise<{ profile: StackProfile; agentsMd: string } | null>`
   — si `getProject(root)` no existe devuelve `null` (misma semántica que `loadContext` → ''); si existe corre
   `buildProfile(root)` + `generateAgentsMd(profile)` y llama `upsertProject(root, profile, agentsMd)` SOLO si
   `agentsMd !== row.agents_md`. `loadContext` queda igual (lo usan rutas síncronas).
2. Hermanos (todos los consumidores async que inyectan contexto a un agente): reemplazar `loadContext(root)` por
   `(await refreshProjectContext(root))?.agentsMd ?? ''` en `src/cli.ts:547,675,1201,2838` y
   `src/dashboard/handlers/project.ts:308` si la función que lo contiene ya es async (si no lo es, dejarla y anotarlo
   en el reporte). `src/cli.ts:170` (comando que imprime el contexto) también. `run-graph.ts` usa `deps.loadContext`
   inyectable: cambiar el default real a una versión async solo si `deps` ya se espera con `await`; si no, dejarlo y
   anotarlo.
3. Chat (`src/dashboard/handlers/chat.ts:1261`): usar `refreshProjectContext(root)` y pasar a
   `buildChatSystemPrompt` el `profile` en vez del markdown: nuevo campo `projectProfile?: StackProfile` en
   `ChatPromptInput`, quitar `projectContext`. En `src/chat/chat-context.ts` agregar
   `export function chatProjectContext(profile: StackProfile): string` que emite solo lo conocido:
   - `Stack: <runtime> · <framework> · <lang1 pct%>, <lang2 pct%>, <lang3 pct%>` — omitir cada valor `unknown`/`none`;
     omitir la línea si no queda nada.
   - `Commands: <c1>, <c2>, …` solo si `commands.length`.
   - `Conventions: <…>` solo con lo detectado (mismos textos cortos que `generateAgentsMd`, sin "No convention files").
   - Sin "Notes for AI agents" ni título `# AGENTS.md`.
   - Si no queda ninguna línea, devuelve '' y el prompt no lleva el bloque `Project context:`.
4. Tests unitarios en `src/chat/chat-context.test.ts` (perfil completo, perfil todo `unknown` → sin bloque, sin
   "Notes for AI agents") y en un test nuevo de `refreshProjectContext` (registro viejo → se reescribe; igual → no
   escribe; sin registro → null). Actualizar `src/__tests__/chat-effort.test.ts` y
   `src/dashboard/__tests__/run-graph-api.test.ts` solo si sus mocks rompen.
5. Gate en vivo `scripts/ui-gate/flows/chat-context.mjs`: el fixture ya hace `init` (línea 128) antes de escribir
   archivos. Después del `init`, escribir en el fixture un `package.json`
   (`{"name":"ctx-fixture","scripts":{"test":"bun test"},"dependencies":{"react":"^19.0.0"}}`) y un `bun.lock` vacío
   (no commitearlos hace falta solo si el árbol sucio no bloquea el chat; si bloquea, sumarlos al `git add` existente).
   En la aserción del prompt de Codex agregar: incluye `Bun`, `React`, `bun run test`; NO incluye
   `Notes for AI agents` ni `unknown`. Mantener las aserciones existentes.

## No tocar
- `buildAutoTaskInstruction`, `toolText`, `responseGuidance` (afinados por gates en vivo en MR.1.d2).
- `generateAgentsMd` y el AGENTS.md que escribe `init` en disco (`context-update-safety.test.ts:62`).
- Flags de los CLI (`external.ts`, `codex.ts`).

## Verificación
- `bunx tsc --noEmit`, `bun run test:coverage`, biome sobre lo tocado.
- `bun run gate:evidence -- --label AT.13-after -- bun run ui:gate chat-context` (lo corre el cerebro).
