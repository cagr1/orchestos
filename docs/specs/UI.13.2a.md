# UI.13.2a — Chat de la app nueva con datos reales

Regla de la cadena (PLAN.md § UI.13): la UI del prototipo en `src/dashboard/app/src/` **no se
rediseña**: className, estructura y animaciones quedan. Solo se cambian sus mocks por la API real.
El vanilla (`src/dashboard/public/*.js`) es **referencia de lectura** para saber qué endpoint y
qué payload usa cada acción; no se edita.

## 1. Capa de API: `src/dashboard/app/src/api/chat.ts`

Funciones tipadas que llaman a los endpoints que ya existen (`src/dashboard/server.ts:325-356`),
copiando payloads y manejo de respuesta del vanilla:

| Acción | Endpoint | Referencia vanilla |
|---|---|---|
| listar sesiones | `GET /api/chat/sessions?project=` | `app.js:476` |
| crear sesión | `POST /api/chat/sessions` | `app.js:503`, `app.js:574` |
| mensajes de una sesión | `GET /api/chat/sessions/:id/messages` | `app.js:397` |
| estado del turno | `GET /api/chat/sessions/:id/turn-status` | `app.js:458` |
| renombrar | `PATCH /api/chat/sessions/:id` | `app.js:541` |
| borrar | `DELETE /api/chat/sessions/:id` | (buscar el `DELETE` en `app.js`) |
| enviar mensaje | `POST /api/chat` | `screens-core.js:728` (payload, stream/polling y errores) |
| adjuntar | `POST /api/chat/upload` | `screens-core.js:893` |
| modelos del compositor | `GET /api/chat/models` | `app.js:3089` |

Más funciones de mapeo API → tipos del prototipo (`types/orchestos.ts`: `ChatThread`,
`ChatMessage`, `ToolExecution`). Campos que la API no tiene: se omiten (son opcionales) o se
derivan; **nunca** se rellenan con valores inventados.

## 2. Conectar `App.tsx` y la vista de Chat

- `App.tsx:114-116`: el estado de hilos arranca vacío y se carga de `listarSesiones`; el activo es
  el más reciente. `handleSendMessage` (`App.tsx:324`) deja de simular (`setTimeout` con respuesta
  fija) y llama `enviarMensaje`; la respuesta y las filas de herramientas se muestran con los mismos
  componentes del prototipo, a medida que llegan (mismo mecanismo que el vanilla).
- New chat, renombrar y borrar desde el sidebar (`components/layout/ShellSidebar.tsx`) y la vista
  (`components/chat/OrchestChatView.tsx`) llaman a la API.
- Selector de agente/modelo/esfuerzo del compositor: opciones de `/api/chat/models`; el valor por
  defecto es el que el vanilla usa hoy (config del usuario), **nunca uno hardcodeado** — memoria del
  proyecto: el modelo lo decide Carlos por config.
- Estados vacío / cargando / error con los componentes que el prototipo ya tenga; si no tiene, texto
  mínimo sin estilos nuevos.

## 3. Fuera del look: CLI QUOTAS y SESSION CONTEXT

Decisión de Carlos (PLAN.md § UI.12): el uso de CLIs se queda **como está hoy**. Quitar las barras
mock de `ShellSidebar.tsx` (CLI QUOTAS) y `OrchestChatView.tsx` (SESSION CONTEXT) y montar en su
lugar, abajo de la app, el componente real `src/dashboard/public-src/islands/shell/SessionStatusBar.tsx`
(copiarlo a `app/src/components/` con sus dependencias; hoy se monta en `public/index.html:44`).

## No tocar

`src/dashboard/public/**`, `src/dashboard/public-src/**` (se copia, no se mueve), handlers del
server, `PLAN.md`. No commitear.

## Verificación (el ejecutor)

- `bun run build:app`, `bun run typecheck`, `bun run test:coverage` verdes.
- Tests unitarios de las funciones de mapeo (`app/src/api/*.test.ts`, `bun:test`).
- Dashboard en :4330, Playwright: la lista de chats coincide con `GET /api/chat/sessions`; abrir uno
  muestra sus mensajes reales; New chat crea una sesión (aparece en la API); renombrar y borrar se
  reflejan en la API. **Enviar**: interceptar `POST /api/chat` con `page.route` y comprobar que el
  payload es igual al que manda `/legacy` para el mismo texto; no disparar un LLM real. Bajar el
  dashboard al terminar. Si una sesión de prueba queda creada, borrarla.
