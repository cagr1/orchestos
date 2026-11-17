# USO.20 F1 — pestaña Preview en Dev (navegador integrado)

Objetivo: en Dev, Carlos ve la app que construye el agente (p. ej. `http://localhost:3000`) dentro de OrchestOS,
como una pestaña más junto a sesiones, terminal y archivos. Solo UI; F2 (que el agente vea la página) queda fuera.

Verificado por grep el 2026-11-17: el dashboard no manda CSP ni `X-Frame-Options` (la única CSP está en
`src/dashboard/handlers/chat-sessions.ts:660`, descargas de adjuntos), así que un iframe a otro puerto carga.

## Cambios (todos en `src/dashboard/app/src/`)

1. `components/dev/session-tabs.ts`
   - `DevTab` suma `| { type: 'preview'; id: string }`.
   - `openPreviewTab(state)`: igual que `openTerminalTab` (`:20-25`): reutiliza la existente o crea
     `preview:<uuid>`, y la activa.
   - `persistedDevTabs` (`:50-58`) excluye `preview` igual que `terminal`.
   - Revisar `restoreSessionTabs` y el restaurado de `App.tsx:237-239` (trata `terminal` aparte): `preview` no se
     persiste, así que no necesita restaurarse.
2. `components/dev/preview-url.ts` (nuevo): `normalizePreviewUrl(input: string): string | null`.
   - Recorta; vacío → `null`. Sin esquema → antepone `http://` (`localhost:3000` → `http://localhost:3000`).
   - Solo `http:` y `https:` (con `new URL`); cualquier otro esquema o URL inválida → `null`.
   - `previewUrlKey(projectId)` = `orchestos-preview-url:<projectId>` (localStorage).
3. `components/dev/DevPreviewPanel.tsx` (nuevo), props `{ projectId: string }`.
   - Barra superior: input de URL (placeholder `http://localhost:3000`, Enter navega), botón recargar (ícono
     `RotateCw`, aria-label y Tooltip "Reload") y botón abrir fuera (ícono `ExternalLink`, aria-label y Tooltip
     "Open in browser", `window.open(url, '_blank', 'noopener')`).
   - URL inválida al pulsar Enter: no navega y muestra debajo del input "Enter an http:// or https:// URL".
   - La última URL válida se guarda en localStorage por proyecto y se carga al montar.
   - Sin URL: estado vacío centrado, "Run your dev server in the terminal and enter its URL above".
   - `<iframe title="Preview" src={url} className="flex-1 w-full border-0 bg-white" />`. Recargar = remontar el
     iframe con un `key` que se incrementa (no tocar `contentWindow`: es de otro origen).
   - Estilo: copiar las clases de la barra de `DevFilePanel.tsx`/`DevDiffPanel.tsx` (mismo alto, borde, tokens
     `app-*`). No sumar CSS a `styles.css`.
4. `components/dev/DevSessionTabs.tsx`
   - Título `'Preview'` para `tab.type === 'preview'` en la cadena de `:163-170`.
   - Ícono `Globe` (lucide) donde se elige el ícono (`:195` y la segunda rama `:238`).
   - `data-preview-tab={tab.type === 'preview' ? tab.id : undefined}` junto a `data-terminal-tab` (`:186`, `:229`).
5. `App.tsx`
   - `handleOpenPreview` junto a `handleOpenTerminal` (`:703-705`): `updateDevTabs(currentProject.id, openPreviewTab)`.
   - Render: la pestaña Preview se queda montada al cambiar de pestaña (no recargar la app del usuario), como la
     terminal en el `activeDevTabs.tabs.map` de `:2281-2318`: para `tab.type === 'preview'` renderizar
     `<div key hidden={tab.id !== activeDevTabs.activeId} data-dev-preview="" className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col"><DevPreviewPanel projectId={currentProject.id} /></div>`.
   - La rama de `OrchestDevWorkspace` (`:2242-2245`) debe excluir también `preview` (hoy excluye `terminal`).
   - `ShellStatusBar` (`:2412-2418`): pasar `onTogglePreview={mode === 'dev' ? handleOpenPreview : undefined}` y
     `previewOpen={activeDevTab?.type === 'preview'}`.
6. `components/layout/ShellStatusBar.tsx`: props `onTogglePreview?` y `previewOpen?`; botón igual al de Terminal
   (`:233-249`) con ícono `Globe`, texto "Preview", Tooltip "Preview", `data-preview-toggle`, colocado justo antes
   del de Terminal. El `ml-auto` pasa al primero de los dos para que queden juntos a la derecha.

## Qué no tocar
- Nada de servidor, MCP ni Playwright (eso es F2). Nada de detección automática del puerto.
- No persistir la pestaña Preview entre recargas (sí la URL por proyecto).
- No tocar Chat ni `styles.css`.

## Tests (deben fallar sin el cambio)
- `components/dev/session-tabs.test.ts`: `openPreviewTab` crea una sola pestaña y la reutiliza; `persistedDevTabs`
  la excluye.
- `components/dev/preview-url.test.ts`: `localhost:3000` → `http://localhost:3000/` o equivalente que use la
  implementación; `https://x.dev` se conserva; `javascript:alert(1)`, `file:///etc/passwd`, `""` y `"  "` → `null`.

## Gates
`bunx tsc --noEmit`, `bunx tsc --noEmit -p src/dashboard/app`, `bunx biome check` sobre los archivos tocados,
`bun test src/dashboard/app/src/components/dev/` y `bun run build:app`. La verificación en vivo la hace el cerebro.
