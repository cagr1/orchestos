# UI.9.8 — Barrido de texto que no aporta, y el modelo elegible en Codex

Pedido de Carlos (PLAN.md § UI.9.8): *"texto adicional que no aporta a nada debe DESAPARECER"*. Borrar, no acortar.
Las referencias de código del ítem (`screens-core.js`, `.chat-model-tag`) son del vanilla, ya borrado en UI.13.3:
el barrido se hace sobre la app React (`src/dashboard/app/src/`).

## Parte 1 — Barrido
1. Recorrer en navegador real (dashboard del gate, con un proyecto temporal y un turno real de chat) las pantallas
   que Carlos usa: Chat (lista, hilo, composer, detalles de turno), Dev (sidebar, workspace, Tasks/Runs/Graph/Plan),
   barra inferior, Settings (general y del proyecto) y los modales (New chat, Add project, Delete project).
2. Escribir `docs/specs/UI.9.8-sweep.md`: tabla `pantalla | texto literal | archivo:línea | veredicto | por qué`.
   Veredicto:
   - **evidente → borrado:** repite algo que ya se ve al lado; nombra mecanismos internos que el usuario no usa
     (`via Codex CLI`, `(cli default model)`, `Decided by…`, ids/rutas técnicas donde ya hay nombre); texto de
     ejemplo de la plantilla que no corresponde a datos reales; descripciones bajo un título que solo lo parafrasean.
   - **dudoso → se queda:** todo lo demás (avisos de riesgo, estados vacíos, ayuda de un control no obvio). Se lista
     para Carlos; no se toca.
3. Borrar solo los evidentes. **No tocar className ni estructura** (la plantilla es el frontend): se quita el nodo de
   texto o el elemento que solo contiene ese texto. El dato no se borra del backend; es regla de superficie.
   Cuidado con el modo de fallar de UI.9.7: al quitar una etiqueta no puede quedar alcanzable un fallback literal
   (`'CLI default model'`, `'default'`, etc.): buscar los literales en todo `src/dashboard/app/src/`.
4. `ui:fidelity:jsx` debe seguir verde; si un borrado lo rompe por un texto de muestra, ajustar su lista
   (`jsx-sample-text.json`) solo para ese texto, y decirlo en el reporte.

## Parte 2 — Modelo elegible en Codex (verificar, no rediseñar)
El selector ya existe: `AgentComposer.tsx` (`Select model and reasoning effort`) con catálogo de la caché de modelos
del propio Codex (`src/dashboard/chat-cli-models.ts:parseCodexModelsCache`), y `buildCodexChatArgs`
(`src/run/executors/codex.ts:251`) pasa `-m` con `--ignore-user-config`. Falta la prueba en vivo de que el modelo
elegido llega al binario. Si el turno no deja registro del modelo/argv usado, añadir el mínimo para poder medirlo
(p. ej. el modelo que reporta el stream JSON de Codex guardado en el turno), sin UI nueva.

## Gate (lo que el cerebro va a medir)
Flujo nuevo `scripts/ui-gate/flows/text-sweep.mjs`:
- Para cada texto borrado de `UI.9.8-sweep.md`: 0 apariciones en la página renderizada (`page.getByText(…, {exact:
  false})` con `hidden`), en la pantalla donde estaba, tras un turno real.
- Turno real Codex · gpt-5.6-luna · medium elegido desde el selector → el registro del turno (API o SQLite de solo
  lectura) dice `gpt-5.6-luna` y esfuerzo `medium`; y la cadena `cli default model` no aparece en ninguna parte.
- 0 errores de consola; proyecto temporal purgado (`POST /api/projects/:id/purge`).
- Verde: `bun run gate:all` + `bun run ui:gate text-sweep` + `smoke` + `chat-turn-details` + `project-tabs`.

## Reglas para el ejecutor
No invoques `codex exec` ni delegues. El dashboard real corre en :4242: no lo mates. La DB real solo por la API y
solo sobre el proyecto temporal. No re-ejecutes `agent:preflight`. `bun run typecheck` completo;
`bunx biome check . --diagnostic-level=error` = 0 errores. Lista TODOS los archivos que toques. Si algo falla por el
sandbox (EADDRINUSE, EPERM, red), dilo así. No hagas commit.
