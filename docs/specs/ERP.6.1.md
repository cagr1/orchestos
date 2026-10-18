# ERP.6.1 — Codex en el chat no gasta llamadas descubriendo y reintentando `run_readonly`

## Evidencia (ERP.6, 2026-10-18, `gpt-6-luna` medium, 3 repeticiones, mismo pedido con herramientas)
Codex directo: 2,7 llamadas, 82 220 tokens de entrada, 10,5 s. Codex por OrchestOS: 4,3 llamadas, 109 241, 14,3 s
(Claude por OrchestOS es 4× más liviano que directo; el trivial de Codex también es más liviano). Rollout de la
corrida de 6 llamadas (`.orchestos/agent-home/codex/sessions/2026/10/18/rollout-…-01a14ffb-….jsonl`):
1. `ALL_TOOLS.filter(x => /run_readonly/i.test(...))` — descubrir la herramienta (aparece en TODAS las corridas con
   herramientas; directo no existe ese paso).
2. `tools.mcp__orchestos__run_readonly({argv:["rg","-n","contextWindowFor"]})` — útil.
3. `run_readonly({argv:["sed","-n","257,275p",...]})` — rechazado (sed no está en la lista; es su hábito para leer
   un rango).
4. `run_readonly({argv:["rg","-n","-A 18",...]})` → `rg: error parsing flag -A` (flag y valor en un solo elemento).
5. reintento con `"-A","18"` — útil.
Causa: el texto de `src/chat/chat-context.ts:225-227` (común a todos los CLI) no nombra la herramienta como la ve
Codex, no dice cómo leer un rango de archivo y no dice que cada flag y su valor van en elementos separados.

## Qué hacer
1. `src/chat/chat-context.ts` (`verifyText`): mantener la regla de AT.21 (git, ls y rg por `run_readonly`) y añadir,
   en el texto común: "Each flag and its value are separate argv items, e.g. [\"rg\",\"-n\",\"-A\",\"18\",\"pattern\",
   \"path\"]." y, solo si el CLI tiene lectura propia (claude, codex): "Read file contents with your own file reading,
   not with run_readonly" (Codex: `sed -n`/`cat` por su shell de solo lectura; Claude: Read).
2. Nombre invocable por CLI, como dato del adaptador, no un `if` en el texto: el nombre que ve cada CLI es
   `mcp__orchestos__run_readonly` (`RUN_READONLY_STEP_LABEL`, `src/mcp/adapters.ts:35`); en el chat por API es
   `run_readonly`. El prompt cita el nombre que recibe ese turno ("call `mcp__orchestos__run_readonly` …"), para que
   Codex no tenga que buscarlo en `ALL_TOOLS`. Si hace falta pasar el nombre a `chat-context`, hacerlo por el input
   que ya trae `offeredTools`.
3. Tests en `src/chat/chat-context.test.ts`: el texto para codex/claude incluye el nombre `mcp__…` y la regla de
   argv; para API, `run_readonly` sin prefijo; sin `run_readonly` ofrecido, nada de esto aparece.

## Qué NO se toca
La lista permitida de `src/mcp/readonly.ts` (frontera de seguridad de AT.21, revisada 3 veces por qa): no añadir
`sed`/`cat`. El resto del prompt. Prohibido `git stash`, `git commit`, `git checkout`/`restore`, `prettier`.

## Verificación
`bun run typecheck`, `bun run lint`, `bun run test:coverage`. El cerebro repite la medición de ERP.6 (`/tmp/erp6/bench.ts`).
