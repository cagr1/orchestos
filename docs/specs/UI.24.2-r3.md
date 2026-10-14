# UI.24.2 — ronda 3 (spec)

Los cambios sin commitear de `main.tsx`, `index.css`, `OrchestChatView.tsx`, `package.json`, `bun.lock`,
`.impeccable/config.json` y `chat-streaming.mjs` son de las rondas 1 y 2 de UI.24.2: son tuyos, se conservan.
Ajenos, no tocar: `IDEAS.md`, `orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`.
Escribes bajo el candado de escritor del cerebro (`ocupado: claude` es quien te delega: sigue).
NO correr `test:coverage`, `ui:gate`, `prettier` ni `git stash`; no commitear; no tocar PLAN.md ni NEXT.md.

## Defecto
En la captura del gate en vivo, entre la burbuja del usuario y la respuesta quedan ~64 px: la fila meta de
`ChatMessage` ya reserva su alto y el contenedor suma `gap-5` encima.

## Cambio (un archivo, una clase)
En el contenedor de la lista del hilo (el `div` con `data-ff`), cambiar `gap-5` por `gap-2`. Nada más.

## Verificación que corres tú (y pegas la salida)
- `bunx tsc --noEmit -p` del front, `bun run lint`, `bun run build:app`.
