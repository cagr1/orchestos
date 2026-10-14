# UI.24.3 — ronda 2 (spec)

Los cambios sin commitear bajo `src/dashboard/app/src/` (`api/chat.ts`, `types/orchestos.ts`,
`components/chat/OrchestChatView.tsx`, `components/thread/*`, borrado de `components/ui/thinking-indicator.tsx`) y
en `scripts/ui-gate/flows/{chat-streaming,codex-live,thread-states}.mjs` son de la ronda 1 de UI.24.3: son tuyos,
se conservan. Ajenos, no tocar: `IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`.
Escribes bajo el candado de escritor del cerebro (`ocupado: claude` es quien te delega: sigue).
NO correr `test:coverage`, `ui:gate`, `prettier` ni `git stash`; no commitear; no tocar PLAN.md ni NEXT.md.
Antes de `bun run lint`: `bunx biome check --write` sobre cada archivo que toques.

## Defectos vistos en las capturas del gate en vivo
1. **Desalineado.** El texto de la fila (`Thinking 4 s`, `Running Bash 9 s`, `Thought for 8 s`) empieza 8-10 px a la
   derecha del texto de la respuesta del asistente: la fila simple trae `px-2` y la cabecera de `ThinkingSteps`
   trae su propio relleno.
2. **Pasos con peso de título.** Los pasos de razonamiento salen en blanco y seminegrita; son texto secundario y
   pueden ocupar párrafos.
3. **Texto pegado.** El `innerText` de la fila es `Thinking0 s`: entre la fase y el tiempo solo hay un margen.

## Cambios — solo `src/dashboard/app/src/components/thread/ThreadThinking.tsx` y `scripts/ui-gate/flows/thread-states.mjs`
1. El borde izquierdo del texto de la fase coincide con el borde izquierdo del contenido de `ThreadThinking`
   (x del `span` de la fase = x del elemento raíz, ±1 px) en las tres variantes: fila simple, cabecera plegada y
   cabecera abierta. Fila simple: `px-0`. Cabecera: compensar el relleno horizontal de la familia con un margen
   negativo del mismo valor en la raíz o en la cabecera (leer el valor en
   `src/dashboard/app/src/components/ui/thinking-steps.tsx`, `TriggerRow`; ese archivo no se edita). El fondo de
   hover/abierto de la cabecera puede sobresalir a la izquierda; el texto no.
2. Los pasos se dibujan con `text-muted-foreground` y `font-normal` (por `className` de `ThinkingStep` o por selector
   en `ThinkingStepsContent`, junto a los `[&_span]` que ya hay).
3. Entre la fase y el tiempo va un espacio real (`{' '}`) además del margen, para que el `innerText` sea
   `Thinking 0 s`.
4. `thread-states.mjs`, por tema, un paso `<tema>-thinking-aligned`: para cada uno de
   `state-thinking`, `state-thinking-steps-running` y `state-thinking-steps-done`, el `left` del
   `getBoundingClientRect()` del primer `span` con el texto de la fase difiere ≤ 1 px del `left` del primer
   `p` dentro de `[data-testid="state-message-assistant"]`. Detalle: los cuatro valores. Y un paso
   `<tema>-thinking-steps-muted`: con el estado `state-thinking-steps-done` abierto, el `color` computado del texto
   `Write the fix` es igual al `color` computado de un elemento con clase `text-muted-foreground` de la lámina (el
   párrafo de la cabecera de la lámina sirve) y su `font-weight` es `400`.

## Verificación que corres tú (y pegas la salida)
- `bunx tsc --noEmit -p src/dashboard/app` · `bun run lint` (0 errores) · `bun run build:app`

Si la familia no permite alinear sin editar `thinking-steps.tsx`, detente y dilo con la línea exacta.
