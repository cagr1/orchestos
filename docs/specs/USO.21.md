# USO.21 — El agente ve la app que construye (F2 de USO.20)

Objetivo: en una sesión de Dev con proyecto, el agente (Claude o Codex por MCP) abre la URL de la pestaña Preview en un
Chromium headless, saca capturas, lee errores de consola/red y hace clic, y Carlos ve las capturas en el hilo.
GO de Carlos el 2026-11-19 (`PLAN.md` § USO.21).

Verificado por grep el 2026-11-19 (no re-derivar, sí releer las líneas antes de editar):
- `src/mcp/server.ts`: nombres de herramientas en L19-77; `tools/list` L217-275 con
  `...(options.tools.includes(X) ? [...] : [])`; `tools/call` L276-326 (desconocida → `-32602`, L280-281; respuesta
  con `text(value, isError)` L278-279); `parseServerArgs` L371-385 (`--tools`, `--root`, `--approval-run`,
  `--approval-mode`). Ninguna herramienta habla con el dashboard por HTTP; el proceso MCP no recibe proyecto ni sesión.
- `src/mcp/adapters.ts`: `McpOffer` L54, `mcpOfferKey` L60-62, `orchestosMcpServerCommand` L64-69, `claudeMcpArgs`
  L72-80 (`--allowedTools mcp__orchestos__<tool>`), `codexMcpThreadConfig` L83-90 (`default_tools_approval_mode:'approve'`),
  `codexExecMcpArgs` L93-104.
- `src/dashboard/handlers/chat.ts` L1541-1567: `offeredTools` y `mcpOffer = { tools, root }`. OpenCode no recibe MCP
  (`src/run/executors/cli-registry.ts` L139).
- `src/dashboard/app/src/components/dev/DevPreviewPanel.tsx`: URL solo en localStorage (L8, L32);
  `components/dev/preview-url.ts`: `normalizePreviewUrl`, `previewUrlKey`.
- Rutas de proyecto: `src/dashboard/server.ts` L492-499 (`route()` L191, regex sobre `url.pathname`);
  `handleApiProjectPatch` en `src/dashboard/handlers/projects.ts` L36-64.
- Hilo: `components/thread/TurnActivity.tsx` `ToolRow` L62-106; `activity.ts` `toolCategory` L21-29, `toolLabel`
  L31-46; `TimelineStep` en `api/chat.ts` L159-173. `TurnActivity` se usa en `OrchestChatView.tsx` L542/L673 y
  `OrchestDevWorkspace.tsx` L563. El hilo hoy no muestra imágenes de herramientas.
- `orchestosDir()` en `src/config/orchestos-home.ts:8`. Token del dashboard: `src/dashboard/auth-token.ts`.
- Playwright está en `devDependencies` (`package.json:91`); nada de `src/` lo importa. Chromium 1243 ya está en
  `~/Library/Caches/ms-playwright` en el Mac.

## Diseño

Estado por proyecto en archivos, sin migración y sin que el proceso MCP abra la base:
`<orchestosDir>/previews/<projectId>/url` (texto, una línea) y `<orchestosDir>/previews/<projectId>/shots/*.png`.

### 1. Servidor del dashboard
- `PUT /api/projects/:id/preview-url` con `{ url: string | null }`: valida con la misma regla que
  `normalizePreviewUrl` **más** host local (abajo); escribe o borra el archivo `url`. 404 si el proyecto no existe o
  está removido; 400 si la URL no es local.
- `GET /api/projects/:id/preview-url` → `{ url: string | null }`.
- `GET /api/projects/:id/previews/<name>`: sirve un PNG de `shots/`. `name` debe cumplir `^[\w.-]+\.png$` (sin `/`
  ni `..`); `Content-Type: image/png`; 404 si no existe. Mismo token/hosts que el resto de la API.
- Helper compartido (servidor y MCP), p. ej. `src/preview/local-url.ts`:
  `localPreviewUrl(input): string | null` = esquema http/https y host `localhost`, `127.0.0.1`, `[::1]` o
  `*.localhost`; cualquier otro → `null`. `previewDir(projectId)` = `join(orchestosDir(), 'previews', projectId)`,
  rechazando ids con `/` o `..`.

### 2. MCP (`src/mcp/server.ts`, módulo nuevo `src/mcp/preview.ts`)
- `parseServerArgs` suma `--preview-dir <ruta>`. `McpOffer` suma `previewDir?: string`;
  `orchestosMcpServerCommand` agrega `--preview-dir` si viene; `mcpOfferKey` lo incluye.
- Cuatro herramientas opt-in por `--tools`, solo si hay `--preview-dir`:
  - `preview_navigate { url?: string }`: abre `url` o, sin ella, la del archivo `url`. Sin URL → error de herramienta
    "No preview URL: open the Preview tab in Dev and enter your dev server URL". Devuelve título, URL final y estado HTTP.
  - `preview_screenshot { fullPage?: boolean }`: si no hay página abierta, navega primero a la URL por defecto. Guarda
    `shots/<YYYYMMDD-HHMMSS-mmm>.png` y devuelve `content: [{type:'image', data:<base64>, mimeType:'image/png'},
    {type:'text', text:'preview-shot:<nombre>.png'}]`. Conserva solo las últimas 50 capturas del proyecto.
  - `preview_console {}`: mensajes `error`/`warning` de consola, `pageerror` y `requestfailed` / respuestas ≥400
    desde la última navegación (máx. 100, cada uno ≤500 caracteres). Vacío → "No console errors".
  - `preview_click { selector?: string, text?: string }`: exactamente uno de los dos; `text` usa
    `page.getByText(text, { exact: false }).first()`. Timeout 5 s. Tras el clic espera `networkidle` (máx. 5 s) y
    devuelve la URL actual.
- Toda URL (argumento, archivo o la de destino tras un clic que navega) pasa por `localPreviewUrl`; si no es local, la
  navegación se aborta (`page.route('**', …)` que solo deja pasar `document` locales; recursos de terceros como
  fuentes/CDN sí se permiten) y la herramienta devuelve error.
- Chromium: `import('playwright')` dinámico al primer uso; un solo `browser` + `page` por proceso MCP, viewport
  1280×800; se cierra cuando stdin termina. Si falta el navegador, error con el comando de instalación
  (`bunx playwright install chromium`); no descargarlo solo.
- Playwright pasa de `devDependencies` a `dependencies` (misma versión).

### 3. Oferta (`src/dashboard/handlers/chat.ts` L1541-1567)
- Con proyecto (`project.id`), CLI con MCP y `readonlyOffered`: sumar las cuatro herramientas y
  `previewDir: previewDir(project.id)` al `mcpOffer`. En Chat sin proyecto no se ofrecen.
- Claude: entran en `--allowedTools` como las demás. Codex: van con la aprobación ya configurada.
- Instrucción breve en `buildChatSystemPrompt` (`src/chat/chat-context.ts`, junto a la de `run_readonly`; test en
  `src/chat/chat-context.test.ts:53`), con el nombre que ve el turno (`mcp__orchestos__preview_screenshot` en Claude):
  "Use preview_* to check the app you are building in the browser (screenshot, console errors) before saying a UI
  change works."

### 4. UI
- `DevPreviewPanel.tsx`: al montar, si localStorage está vacío, cargar `GET …/preview-url`; al guardar una URL
  válida, además del localStorage, `PUT …/preview-url` (fallo de red: no bloquea la vista). Una URL no local se
  muestra igual en el iframe, pero bajo el input aparece "The agent can only open localhost URLs" (texto visible nuevo).
- Hilo: en `ToolRow` (o un componente hermano), si `step.tool` termina en `preview_screenshot` y `step.output`
  contiene `preview-shot:<nombre>.png`, mostrar la miniatura (`<img loading="lazy">`, ancho máx. 360 px, borde
  `border-app`, redondeo de control) desde `GET /api/projects/<id>/previews/<nombre>` con el token como en el resto
  de llamadas (si `<img src>` no puede llevar la cabecera, pedir el blob con `fetch` y usar `URL.createObjectURL`).
  Clic → abre la imagen en tamaño real en una pestaña nueva. `TurnActivity` recibe `projectId?` desde
  `OrchestDevWorkspace.tsx` L563 y `OrchestChatView.tsx` (si el chat tiene proyecto).
- Categoría/etiqueta: `preview_*` → etiqueta legible ("Preview screenshot", "Preview console", "Preview click",
  "Preview navigate") en `toolLabel`. Sin CSS nuevo en `styles.css`.

## Qué no tocar
- OpenCode (no tiene MCP en el chat), Electron, URLs remotas, el iframe de la pestaña Preview.
- Herramientas MCP existentes y su orden en `tools/list`.

## Tests (deben fallar sin el cambio)
- `src/preview/local-url.test.ts`: `localhost:3000`, `http://127.0.0.1:5173/x`, `http://[::1]:8080`,
  `http://app.localhost` → válidas; `https://example.com`, `file:///etc/passwd`, `javascript:…`, `http://localhost.evil.com`
  → `null`; `previewDir` rechaza `../x` y `a/b`.
- `src/mcp/server.test.ts`: `tools/list` solo incluye `preview_*` con `--tools` y `--preview-dir`; `preview_navigate`
  sin URL devuelve `isError` con el texto de arriba; URL no local → `isError`. Playwright detrás de una interfaz
  inyectable (no lanzar Chromium en la suite: `CLAUDE.md` § "Verificar contra CI").
- `src/mcp/adapters` test: `--preview-dir` en los args y en `mcpOfferKey`.
- Handler: PUT/GET de `preview-url` (local ok, remota 400, proyecto inexistente 404) y GET de captura con nombre
  inválido → 404.
- `activity.ts`: `preview-shot:<nombre>` se extrae del output; etiquetas de `preview_*`.

## Gates
`bunx tsc --noEmit`, `tsc -p src/dashboard/app/tsconfig.json --noEmit`, `bunx biome check` de lo tocado,
`bun test src/mcp src/preview src/dashboard/app/src/components/dev src/dashboard/app/src/components/thread` y los
tests del handler, `bun run build:app`. La verificación en vivo (agente real capturando una página local y miniatura
en el hilo, con Claude y con Codex) la hace el cerebro.
