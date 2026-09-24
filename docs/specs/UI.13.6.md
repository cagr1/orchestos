# UI.13.6 — La cuota de Codex aparece siempre y una ventana vencida cuenta como libre

Diagnóstico en PLAN.md § UI.13.6 (3 hallazgos, ya verificados; no re-diagnosticar). Síntoma para Carlos: en un
proyecto donde nunca se usó Codex la barra muestra `—` para Codex; tras el reset de una ventana también sale `—`;
Brave mostró una barra vieja.

## Cambios
1. **Respaldo de cuenta para Codex, `scripts/session-status.ts:196-203`:** la cuota de Codex es de la cuenta, no del
   proyecto. Llamar `readCodexRateLimitsLive` siempre que Codex esté instalado y no haya `explicit` (hoy exige
   `liveCodex`), y si el proyecto no tiene sesión de Codex, añadir la entrada con `context: null` y las ventanas en
   vivo — igual que el bloque de Claude en `:230-245`. Si la lectura en vivo devuelve `[]`, no inventar nada.
2. **Ventana vencida = 100 % libre, en todas las capas:**
   - Cliente, `ShellStatusBar.tsx:36-38` (`remaining`): si `resetsAt` ya pasó → `100`, no `null`. El texto de reset
     sigue sin mostrarse (`formatReset` ya devuelve `undefined`).
   - Hermanos en el servidor: `readClaudeStatuslineRateLimits` descarta la ventana vencida (`session-status.ts:73`),
     así la barra nunca llega a verla y sale `—`. Conservar la ventana (con su `resetsAt` pasado) para que el cliente
     la pinte 100 %; el combinador por `resets_at` mayor sigue igual. Revisar lo mismo en los lectores de Codex
     (`scripts/context-adapters.ts:180,257`) y en cualquier otro que filtre por `resetsAt <= now`.
   - Tests: `session-status.test.ts` (Codex sin sesión del proyecto → entrada con ventanas; ventana vencida se
     conserva) y test del mapeo del cliente si hay suite para él (si no, exportar `mapQuotas` y testearlo).
3. **Caché del bundle, `src/dashboard/http.ts`:** `Cache-Control: no-cache` en `/app/dist/*` y en el `index.html`
   del shell (`:62` y `:73`). Test en la suite del servidor si existe una para `serveStatic`.

## Gate (lo que el cerebro va a medir)
Extender `scripts/ui-gate/flows/usage-bar.mjs` (sus pasos actuales siguen verdes):
- El proyecto temporal no tiene sesiones de Codex. Antes del turno: `button[title^="Codex:"]` muestra `\d+%`, no `—`.
  Después del turno real (Codex · gpt-5.6-luna · medium, ya existe en el flujo): lo mismo.
- Ventana vencida: tras los pasos actuales, reemplazar las lecturas de statusline del `statuslineHome` del gate por
  una sola con `five_hour.resets_at` en el pasado (`used_percentage: 80`), pulsar `Refresh usage` → la celda de
  Claude (`button[title^="Claude"]`) muestra `100%`.
- `fetch` de `/` y de `/app/dist/main.js` desde la página: header `cache-control` contiene `no-cache`.
- 0 errores de consola; 0 proyectos `orchestos-ui-*` al terminar.
- Verde: `bun run gate:all` + `bun run ui:gate usage-bar` + `bun run ui:gate smoke`.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues. No toques `~/.orchestos/claude-statusline*` real ni la DB real salvo por la
API con el proyecto temporal. No re-ejecutes `agent:preflight`. `bun run typecheck` completo;
`bunx biome check . --diagnostic-level=error` = 0 errores. Lista TODOS los archivos que toques. No hagas commit.
