# UI.24.2 — ronda 2 (spec)

Los cambios sin commitear de `main.tsx`, `index.css`, `OrchestChatView.tsx`, `package.json`, `bun.lock`,
`.impeccable/config.json` y `scripts/ui-gate/flows/chat-streaming.mjs` son de la ronda 1 de UI.24.2: son tuyos, se
conservan. Ajenos, no tocar: `IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`,
`runs-summary.json`.
Escribes bajo el candado de escritor del cerebro (`ocupado: claude` es quien te delega: sigue).
NO correr `test:coverage`, `ui:gate`, `prettier` ni `git stash`; no commitear; no tocar PLAN.md ni NEXT.md.

## Defecto
El gate en vivo `chat-streaming` falló en `thread-font-inter`: el `font-family` computado de `body` es la pila del
sistema (`-apple-system, "system-ui", …`), no Inter. Causa: `body` (`src/dashboard/app/index.html:13`) y la raíz de
`App.tsx:1168` llevan la clase `font-sans`, que resuelve a `--font-sans` por defecto de Tailwind y gana a la regla
`body { font-family }` de `index.css:109`.

## Cambios (dos archivos, nada más)
1. `src/dashboard/app/src/index.css`, bloque `@theme inline` (líneas 3-15): añadir como última línea del bloque
   `--font-sans: 'Inter Variable', system-ui, -apple-system, sans-serif;`
   La regla `body` de `:106-111` no cambia.
2. `src/dashboard/app/src/components/chat/OrchestChatView.tsx:283`: borrar el comentario
   `// Human avatar stays on the right, after the message bubble.` (ya no hay avatar).

## Verificación que corres tú (y pegas la salida)
- `bunx tsc --noEmit -p src/dashboard/app`
- `bun run lint` (debe terminar sin errores; warnings ajenos no cuentan)
- `bun run build:app`
- `grep -c "Inter Variable" src/dashboard/app/dist/main.css` → al menos 1

Si algo no se puede aplicar tal cual, detente y dilo con la línea exacta.
