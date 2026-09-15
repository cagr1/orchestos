# ERP.1 — un CLI por chat, elegido en "Nuevo chat"; el composer solo modelo/esfuerzo

Contrato vigente: `PLAN.md:30-45` y `PLAN.md:63-84`. Complementa a `AT.10` (spec hermano,
`docs/specs/AT.10.md`, cubre backend: cero fallback de modelo, error real, detección).
**Este spec es frontend**: mover la selección de CLI de "dentro del composer" a un
mini-menú al crear un chat nuevo, y dejar el composer con solo modelo/esfuerzo.

## Contrato exacto (palabras de Carlos, 2026-09-15)

Al pulsar `+ / Nuevo chat`, abrir primero un **mini menú de CLIs**, antes de crear la
sesión o mostrar su compositor. Cada opción presenta icono y nombre del CLI; elegirla
crea y abre el chat en el proyecto activo con ese CLI fijado. Cerrar/cancelar el menú no
crea una conversación vacía ni lanza un proceso. Mostrar disponibilidad real; un CLI sin
adaptador o no detectado no puede iniciar una sesión. Dentro del chat solo se
seleccionan **modelo y esfuerzo** compatibles; el CLI se identifica como etiqueta, no
como opción intercambiable del selector.

Referencia visual: `/Users/carlosgallardo/Desktop/Screenshot 2026-09-15 at 9.20.19 AM.png`
(menú de nueva pestaña de Orca, filas de agentes con icono+nombre). Se adopta ese patrón
solo para el "Nuevo chat" de OrchestOS — no amplía el alcance a terminal, navegador,
emulador ni Agent Teams.

## Cambios

### 1. Mini-menú en "Nuevo chat" (`src/dashboard/public/screens-core.js`)

- `chat-new-session` (línea ~480, handler en línea ~835) ya no llama
  `App.startNewChatSession()` directo. En su lugar abre un menú (mismo patrón que
  `st.chatAttachMenuOpen` en `screens-core.js:862-868`: un booleano de estado +
  `App.rerender()`, cerrar con click fuera/Escape).
- El menú lista los CLIs de `st.executorModes.modes` (ya trae `id`, `label`, `detected`,
  `path`, `readBoundary` — ver `src/dashboard/handlers/tasks.ts:29-73`). Cada fila:
  icono (reusar el mapeo de iconos que ya usa `buildChatModelFx`/`ICON` en `app.js`,
  buscar `cli.icon` de `KNOWN_CLIS` si `executorModes` no trae icono — confirmar en el
  código antes de inventar un campo nuevo) + nombre (`t('chat.modelfx.agentLabel.' +
  info.id)`, ya existe). Si `!detected`, fila deshabilitada con el motivo real (path
  ausente / CLI sin adaptador de chat — confirmar contra `chatCapable` si ese campo ya
  existe en el registro, si no, limitar la lista a los agentes que `AGENT_CHOICES`
  soporta hoy: `local`, `claude`, `codex`, `opencode`, `api`).
- Elegir una fila: cierra el menú y llama `App.startNewChatSession(agentId)` (nueva
  firma, ver punto 2). Cancelar/click fuera/Escape: solo cierra el menú, sin fetch ni
  `POST /api/chat/sessions`.

### 2. `startNewChatSession` recibe el agente elegido (`src/dashboard/public/app.js:483-507`)

- Cambiar la firma a `startNewChatSession(agent)`. El body del `POST /api/chat/sessions`
  ya acepta `agent` (`chat-sessions.ts:98,128-153` — confirmado, sin cambios de backend
  necesarios). Quitar el fallback `state.orcheConfig?.agent || 'api'`: el agente viene
  siempre del menú, nunca implícito del config global.
- Todo lo demás de la función (guardar `chatSessionId`, `chatHistories`, aviso de
  frontera de lectura) queda igual.

### 3. Composer: quitar el nav "agent" (`src/dashboard/public/app.js`, `buildChatModelFx`)

- Quitar el botón `data-modelfx-nav="agent"` de la vista `root` (línea ~2831-2834) y
  toda la rama `view === 'agent'` (línea ~2892-2925, incluida `CHAT_UNSUPPORTED_AGENTS`
  — ya no aplica, el picker gateado por detección vive ahora en el mini-menú del punto
  1). También quitar `chatAgentUnsupportedWarning` de la vista `root` (línea ~2805-2809):
  ya no puede pasar que la sesión tenga un CLI "no soportado por el chat", porque el
  mini-menú no deja crear esa sesión.
- En su lugar, mostrar el CLI de la sesión activa como **etiqueta no interactiva**
  (reusar el patrón de `modelHiddenAgent` que ya renderiza
  `t('chat.modelfx.modelDecidedBy', agentLabel)` como texto fijo, línea ~2812-2818) en
  algún punto visible del panel `root` — decidir la key i18n exacta leyendo
  `src/dashboard/public/i18n.js` (o equivalente) para no duplicar una cadena parecida.
- El resto del panel (`model`, `effort`, `reset`) queda igual: eso ya era por-sesión.

### 4. `screens-core.js:982-1004` — borrar el handler `data-modelfx-agent`

Ya no existe ese botón (punto 3), así que el `PUT /api/config` que cambiaba `agent`
desde el composer queda sin uso — borrar el bloque completo. **No** reemplazar por otra
llamada a `/api/config`: el agente de una sesión ya existente es inmutable por contrato
(`chat-sessions.ts:227`, "Only mode and title can be changed; agent is immutable" — ya
lo aplica el backend, confirmar que sigue así, no tocarlo).

## Qué NO tocar

- Backend de `chat.ts`/`codex.ts`/`opencode.ts` — eso es `AT.10` (spec hermano, puede
  cerrarse en paralelo o antes; si AT.10 ya cerró, no reabrir esos archivos).
- `orchestos.config.yaml` como sustituto: el flujo tiene que salir de la UI.
- La entidad `agents` nueva — las filas de sesiones existentes (`chat_sessions`) son la
  fuente, sin migración de esquema.

## Cómo se verifica

1. `bunx tsc --noEmit` limpio.
2. Test de frontend/integración (buscar dónde ya se testea `screens-core.js`/`app.js`
   si existe harness DOM, o test de handler si la lógica se puede aislar): abrir
   mini-menú, elegir CLI no detectado → no dispara fetch; elegir CLI detectado → POST
   con `agent` correcto y sesión activada.
3. `chat-sessions.test.ts`: sin cambios de contrato esperados (ya soporta `agent` en
   create), correr para confirmar que nada se rompió.
4. `bun run test:coverage` verde.
5. **Gate en vivo, obligatorio, navegador real:** `Nuevo chat` → menú → elegir CLI →
   chat creado con ese CLI; cancelar el menú → sin sesión nueva en
   `GET /api/chat/sessions` ni proceso lanzado; CLI no disponible → fila deshabilitada,
   no clickeable; selector dentro del chat solo ofrece modelo/esfuerzo (sin nav
   "agent"); recargar la página conserva el CLI elegido desde el menú para esa sesión.
   Repetir con dos CLIs distintos (p. ej. Codex y OpenCode) para confirmar que uno no
   cambia al tocar el otro. Evidencia: `docs/done/evidence/ERP.1-live.json`. Bajar el
   dashboard al terminar.

## Evidencia de cierre

Capturas antes/después no son obligatorias para este ítem (son de ERP.2), pero si el
gate en vivo usa Playwright/captura, adjuntarla igual en el JSON de evidencia. Borrar
este spec en el commit de cierre.
