# UI.24.3 — Pensando (spec)

Ítem de PLAN.md § UI.24. Solo presentación del hilo; el backend no cambia.
Escribes bajo el candado de escritor del cerebro (`writer-lock status: ocupado: claude` es quien te delega: sigue).
NO correr `test:coverage`, `ui:gate`, `prettier` ni `git stash`; no commitear; no tocar PLAN.md ni NEXT.md.
Ajenos, no tocar: `IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`.
Antes de correr `bun run lint`: `bunx biome format --write` sobre cada archivo que toques.

## Qué se ve hoy
- Turno en curso sin texto: `Loader2` girando + `…` (`OrchestChatView.tsx`, bloque `isWorking && !liveText`).
- Mensaje terminado con razonamiento: caja "Reasoning (n steps)" abierta por defecto, con estado propio
  `expandedReasoning`.
- La lámina (`ThreadStatesSheet.tsx`) dibuja `ThinkingIndicator` de la familia, que rota palabras inventadas
  ("Moonwalking", "Refining"): no nombra ninguna fase real y no se usa en el hilo.

## Qué debe verse
1. **Turno en curso.** Una fila discreta, sin caja, alineada con la respuesta: texto con la clase `shimmer-text`
   que nombra la fase real y, al lado, el tiempo transcurrido en `tabular-nums` y color apagado
   (`text-muted-foreground`). Fases (la UI está en inglés):
   - último paso del turno vivo es `tool_use` con `ok === null` → `Running <tool>` (`tool` tal cual llega; si es
     `null`, `Running tool`);
   - hay `liveText` → `Writing`;
   - cualquier otro caso (sin pasos, o último paso `reasoning`) → `Thinking`.
   La fila se muestra mientras `isWorking`, encima del texto en vivo cuando lo hay. Si el turno vivo ya tiene pasos
   `reasoning`, la fila es la cabecera de un `ThinkingSteps` plegado por defecto que al abrirse los lista.
2. **Turno terminado con razonamiento.** En lugar de la caja "Reasoning (n steps)": un `ThinkingSteps` plegado por
   defecto con cabecera `Thought for 12 s` (o `Thought` si no hay duración válida), que se abre con un clic y lista
   los pasos. Sin `shimmer-text`. Un mensaje sin razonamiento no muestra nada.
3. Respeta `prefers-reduced-motion` (la familia y `.shimmer-text` ya lo hacen; no añadir animaciones propias).
4. Sin colores nuevos: solo tokens (`text-foreground`, `text-muted-foreground`, `--app-*`). Sin iconos de lucide
   en la fila (fuera `Loader2` y `Sparkles` de este bloque; quitar del import lo que quede sin uso).

## Piezas (archivos y contrato)
- **Nuevo** `src/dashboard/app/src/components/thread/thinking.ts` — funciones puras, sin React:
  - `parseDbTime(value: string): number` — acepta `YYYY-MM-DD HH:MM:SS` (UTC, sin zona) e ISO; devuelve ms o `NaN`.
  - `formatElapsed(ms: number): string` — `< 60 s` → `"12 s"`; si no → `"1 m 05 s"`. Redondeo hacia abajo; mínimo
    `"0 s"`.
  - `livePhase(turn: TimelineTurn | undefined, hasLiveText: boolean): string` — las tres fases de arriba; los pasos
    se ordenan por `seq`.
  - `thoughtMs(turn: TimelineTurn): number | undefined` — `fin − inicio`, con `inicio = parseDbTime(turn.createdAt)`
    y `fin` = `createdAt` del primer paso cuyo `seq` es mayor que el del último paso `reasoning`; si no existe,
    `turn.updatedAt`. Devuelve `undefined` si no hay pasos `reasoning`, si algún tiempo es `NaN` o si el resultado
    es `< 0`.
- **Nuevo** `src/dashboard/app/src/components/thread/thinking.test.ts` (`bun:test`): un caso por rama de las
  cuatro funciones (incluye: herramienta en curso, herramienta terminada → `Thinking`, texto en vivo, formato de
  fecha sin zona, minuto con cero a la izquierda, turno sin razonamiento, tiempo inválido).
- **Nuevo** `src/dashboard/app/src/components/thread/ThreadThinking.tsx` — componente propio que compone
  `ThinkingSteps`, `ThinkingStepsHeader`, `ThinkingStepsContent`, `ThinkingStep` de
  `@/components/ui/thinking-steps` (no se editan). Props:
  `{ active: boolean; label: string; elapsed?: string; steps: string[] }`.
  - `active` → la raíz lleva `data-thread-working`, `role="status"` y `aria-live="polite"`; el `label` va con
    `shimmer-text`. No activo → sin esos atributos ni shimmer.
  - `steps.length === 0` → solo la fila (sin plegable ni chevron).
  - Cada paso de razonamiento es texto libre y puede ser largo (varias líneas): debe leerse entero al abrir, sin
    desbordar el ancho del hilo ni truncarse. Elige la composición con las piezas de la familia que lo logre y
    mírala en la lámina.
  - Ancho: el del hilo (`w-full`), no los `w-80` por defecto de `ThinkingSteps`.
- `src/dashboard/app/src/api/chat.ts` (`:226-256`): además de `reasoning`, el mensaje del asistente recibe
  `thoughtMs?: number` (de `thoughtMs(turn)`); añadir el campo opcional al tipo en `types/orchestos.ts:186`.
  Ojo: los fixtures `JSON.stringify` de `api/chat.test.ts` no están tipados; si alguno compara el mensaje entero,
  actualizarlo.
- `OrchestChatView.tsx`:
  - el bloque `isWorking && !liveText` y la caja de razonamiento pasan a `ThreadThinking`; se borra el estado
    `expandedReasoning`;
  - el tiempo transcurrido se cuenta desde que `isWorking` pasa a `true` en esta vista (reloj local, un tick por
    segundo, se limpia al terminar); el turno vivo es `liveTimeline.turns` con `id === liveTimeline.live?.turnId` o,
    si no hay `live`, el último con `status === 'pending'`;
  - no tocar el bloque "Tool executions" (es de UI.24.7), las tarjetas de tarea, ni `div.prose`.
- `ThreadStatesSheet.tsx`: los estados `thinking`, `thinking-steps-running` y `thinking-steps-done` (mismos
  `id`, el gate los busca) se dibujan con `ThreadThinking`: activo sin pasos (`Thinking`, `4 s`); activo con pasos y
  herramienta (`Running Bash`, `9 s`); terminado (`Thought for 8 s`, tres pasos, uno de ellos de tres líneas).
  Borrar `src/dashboard/app/src/components/ui/thinking-indicator.tsx` si queda sin importadores (y su línea en
  `THIRD_PARTY_NOTICES.md` solo si lista archivos uno a uno).

## Gates (los flujos son parte del ítem)
- `scripts/ui-gate/flows/codex-live.mjs:174-175` y `:235-236`: hoy cuentan `.animate-spin` para probar que el
  indicador desapareció; con este cambio pasarían en vacío. Cambiar el selector a `[data-thread-working]` (mismo
  criterio: 0 al terminar; ajustar el texto del detalle).
- `scripts/ui-gate/flows/chat-streaming.mjs`: en el bucle que muestrea el turno activo (donde se toma
  `chat-text-visible-mid-turn`), guardar el `innerText` de `[data-thread-working]` la primera vez que sea visible.
  Dos pasos nuevos tras el turno: `working-indicator-names-phase` (se vio y su texto cumple
  `/(Thinking|Writing|Running .+)/` y `/\d+ s/`) y `working-indicator-gone` (0 elementos al terminar).
- `scripts/ui-gate/flows/thread-states.mjs`: un paso por tema que haga clic en la cabecera de
  `[data-testid="state-thinking-steps-done"]` y compruebe que un paso pasa a ser visible; y otro que compruebe que
  en la lámina no aparece ninguna de las palabras `Moonwalking`, `Refining`, `Planning`.

## Verificación que corres tú (y pegas la salida)
- `bunx tsc --noEmit` (raíz) y `bunx tsc --noEmit -p src/dashboard/app`
- `bun test src/dashboard/app/src/components/thread/thinking.test.ts src/dashboard/app/src/api/chat.test.ts`
- `bun run lint` (0 errores) · `bun run build:app` · `bun run ui:fidelity:jsx`
- `grep -n "expandedReasoning\|Loader2\|Sparkles\|animate-spin\|animate-pulse" src/dashboard/app/src/components/chat/OrchestChatView.tsx` → sin salida

Si algo no se puede aplicar (un tipo no cuadra, una pieza de la familia no admite lo pedido), detente y dilo con
la línea exacta.
