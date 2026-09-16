# UI.9.2 — Modo Chat completo y controles propios de la sesión

Ítem: `PLAN.md` § UI.9.2. Ejecuta únicamente este spec; no cambies UI.9.3, UI.9.5,
el inspector, Settings globales ni la creación de proyectos.

## Objetivo

Completar el modo Chat para que una sesión tenga un CLI fijo desde su creación y el usuario
pueda cambiar únicamente modelo y esfuerzo compatibles con ese CLI. Corregir además la
legibilidad del switch Chat/Dev y conservar los colores de marca de los iconos de CLI.

## Cambios requeridos

1. **CLI fijo por sesión.**

   - La fuente del CLI activo debe ser `state.chatSessions.find(id === state.chatSessionId).agent`
     (o la metadata equivalente cargada para la sesión), no `state.orcheConfig.agent`.
   - `buildChatModelFx()` y el envío de mensajes deben usar ese CLI activo.
   - El menú del composer no debe ofrecer `agent`, `CLI`, DeepSeek ni ningún cambio de transporte.
     La fila que identifica el CLI puede permanecer como texto/icono no interactivo.
   - El selector de CLI solo existe en `+ New chat`/`+` de proyecto. Crear una sesión con Claude,
     Codex, OpenCode, API o Local debe persistir ese `agent`; cambiar de sesión debe actualizar la
     etiqueta y los controles al CLI de la sesión seleccionada.

2. **Modelo compatible con el CLI.**

   - Para API/OpenRouter se conserva el catálogo de modelos y búsqueda existentes.
   - Para Claude se conservan solo sus alias/modelos fijables ya verificados.
   - Para Codex/OpenCode/Local no mostrar un catálogo de OpenRouter que el transporte no acepta;
     mostrar el modelo que corresponda al CLI o el estado `CLI default model` si no existe un
     catálogo seguro. No crear fallback silencioso a DeepSeek.

3. **Esfuerzo derivado del CLI real.**

   - Centralizar el mapa de niveles para no reutilizar siempre `low/medium/high`.
   - Claude: `low`, `medium`, `high`, `xhigh`, `max`.
   - Codex: `minimal`, `low`, `medium`, `high`, `xhigh`.
   - API: mostrar esfuerzo solo si el modelo real declara `supportsReasoning`; conservar los niveles
     válidos del contrato OpenRouter.
   - OpenCode/Local: no mostrar esfuerzo hasta tener niveles verificados para ese transporte.
   - El valor persistido no puede quedar seleccionado si ya no pertenece al mapa del CLI/modelo.
   - El request de chat debe enviar `effort` solo cuando el control visible y el contrato efectivo
     lo permiten.

4. **Switch Chat | Dev legible.**

   - `#shellModeChat` y `#shellModeDev` deben mostrar siempre sus iconos `chat` y `code` dentro
     de un contenedor visible, más sus etiquetas cuando el rail está expandido.
   - Deben tener anatomía de botón: borde, fondo/hover, foco visible, cursor, `aria-pressed` y
     estado activo claramente distinguible; no depender solo de color azul ni de tooltip.
   - En rail colapsado los iconos siguen visibles y no se solapan; las etiquetas se ocultan.
   - No cambiar la lógica de persistencia ni la navegación de UI.9.1.

5. **Colores de CLI.**

   - Los iconos de Claude, Codex/OpenAI, OpenCode, DeepSeek, Gemini, Kimi y GLM deben conservar
     su color original en las filas del menú y de sesiones; no heredar `color: var(--accent)` del
     sidebar ni quedar todos azules.
   - Definir clases/datos por CLI en el CSS/renderer (`data-agent` o equivalente), con contraste
     suficiente en tema oscuro y brillante. El estado deshabilitado puede reducir opacidad, pero
     no convertir la marca en azul.

## Archivos objetivo

- `src/dashboard/public/app.js:buildChatModelFx`, estado de sesión y envío de chat.
- `src/dashboard/public/screens-core.js:wire` del composer; quitar cualquier control CLI residual.
- `src/dashboard/public/data.js` y/o `src/dashboard/public/styles.css`: mapa de esfuerzo e iconos.
- `src/dashboard/public-src/islands/shell/Sidebar.tsx` y `src/dashboard/public/styles.css`: switch
  y colores del menú/sesiones.
- Tests relevantes bajo `src/dashboard/__tests__/` si el contrato actual no queda cubierto.

## Qué no tocar

- Backend de proyectos, selector nativo, UI.9.1 ya cerrada, UI.9.3/9.5, panel derecho,
  Settings globales y tareas fuera del composer de Chat.
- No reintroducir un selector global que cambie `orchestos.config.yaml` desde el chat.

## Verificación

1. `bunx tsc --noEmit`, tests relevantes, `bun run build:ui` y `bun run test:coverage`.
2. Búsqueda sin restos de un selector CLI dentro del composer; el CLI aparece solo como identidad
   fija de la sesión.
3. Dashboard real + Playwright a 1440×900 con al menos una sesión API y una Claude/Codex/OpenCode:
   crear desde el menú, cambiar de sesión, confirmar CLI fijo, modelo permitido, esfuerzo distinto
   por CLI y ausencia de DeepSeek cuando el CLI no es API.
4. Comprobar visualmente ambos estados del switch y colores de cada icono; guardar evidencia en
   `docs/done/evidence/UI.9.2-live.json` y capturas en `docs/done/evidence/UI.9.2/`.
5. Ejecutar `ui3-shell` y documentar por separado la deuda preexistente de `ui81` si continúa.

No cerrar el ítem si un CLI seleccionado vuelve a aparecer como opción de transporte dentro del
composer o si el chat usa `orcheConfig.agent` en lugar del agente persistido de la sesión.
