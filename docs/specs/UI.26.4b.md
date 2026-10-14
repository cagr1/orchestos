# UI.26.4b — `ui:fidelity:jsx` rojo desde UI.26.4a (mecánico)

Eres la ejecutora; no delegas. Escribes bajo el candado del cerebro (`ocupado: claude …`). Prohibido `git stash`,
`git commit`, `git checkout`/`restore`, `prettier`. No corras `test:coverage`.

`bun run ui:fidelity:jsx` falla: "2 missing occurrence(s) in OrchestDevWorkspace.tsx — className "border-app"
(template line 187), className "border-t" (template line 392)". Causa: UI.26.4a (`a9d5736`) quitó a propósito
`border-t border-app` del contenedor del composer (`<div data-composer-region className="p-3 bg-app-bg …">`).

Cambio: en `scripts/ui-fidelity/jsx-allow.json` añadir dos entradas con el mismo formato que las existentes:
- `{"archivo": "OrchestDevWorkspace.tsx", "valor": "border-app", "motivo": "UI.26.4a (Carlos 2026-10-14): sin línea sobre el composer."}`
- `{"archivo": "OrchestDevWorkspace.tsx", "valor": "border-t", "motivo": "UI.26.4a (Carlos 2026-10-14): sin línea sobre el composer."}`
No tocar ningún `.tsx`.

Verificar: `bun run ui:fidelity:jsx` exit 0; `bunx biome format --write scripts/ui-fidelity/jsx-allow.json`; `bun run lint`.
