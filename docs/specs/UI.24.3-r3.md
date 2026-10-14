# UI.24.3 — ronda 3 (spec)

Los cambios sin commitear bajo `src/dashboard/app/src/` y en
`scripts/ui-gate/flows/{chat-streaming,codex-live,thread-states}.mjs` son de las rondas 1 y 2 de UI.24.3: son
tuyos, se conservan. Ajenos, no tocar: `IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`.
Escribes bajo el candado de escritor del cerebro (`ocupado: claude` es quien te delega: sigue).
NO correr `test:coverage`, `ui:gate`, `prettier` ni `git stash`; no commitear; no tocar PLAN.md ni NEXT.md.
Antes de `bun run lint`: `bunx biome check --write` sobre cada archivo que toques.

## Resultado del gate en vivo tras la ronda 2
- `thread-states` FAIL `orchestos-thinking-aligned`: fase a 336 / 340 / 340 px, párrafo del asistente a 336 px. La
  cabecera de la familia trae `px-3` (12 px, `size-context.tsx:77`) y la ronda 2 compensó con `-mx-2` (8 px).
- `chat-streaming` FAIL `working-indicator-gone`: `1 working indicators remain`. El paso cuenta en el mismo instante
  en que la API da el turno por terminado; la vista tarda un ciclo de sondeo (300 ms) en retirar la fila.

## Cambios
1. `src/dashboard/app/src/components/thread/ThreadThinking.tsx`:
   - `-mx-2` → `-mx-3` en `ThinkingSteps`.
   - Quitar `className="[&>span:last-child]:hidden"` de `ThinkingStepsHeader`: oculta el chevron, que es la señal
     de que la fila se abre. El chevron se queda.
2. `scripts/ui-gate/flows/chat-streaming.mjs`, paso `working-indicator-gone`: sondear hasta 5 s (cada 250 ms) a que
   `page.locator('[data-thread-working]').count()` sea 0; el paso pasa si llega a 0 dentro del plazo y el detalle
   dice cuántos ms tardó o cuántos quedan.
3. Si el paso `thinking-aligned` de `thread-states.mjs` dependía de que el chevron estuviera oculto, corregir su
   selector para que mida el `span` visible con el texto de la fase.

## Verificación que corres tú (y pegas la salida)
- `bunx tsc --noEmit -p src/dashboard/app` · `bun run lint` (0 errores) · `bun run build:app`
