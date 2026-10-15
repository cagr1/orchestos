# UI.24.6b — Composer que sube de verdad + fichas (incluye ERP.4.14)

Rol: `criterio`. Fuente: `PLAN.md` § UI.24.6 / UI.24.6b. GO de Carlos 2026-10-15 ("que funcione").

## Problema (verificado en HEAD 829a98b)
- `AgentComposer.tsx:307-317` (`handleFileUpload`) crea ids locales `att_…` y nunca llama a `POST /api/chat/upload`.
  `api/chat.ts:552-553` manda esos ids como `fileIds`; el backend (`handlers/chat.ts:1198-1201`) los busca en
  `fileStore` y los descarta en silencio. El clip no adjunta nada.
- Las fichas del composer (`AgentComposer.tsx:493-513`) y del mensaje enviado (`OrchestChatView.tsx:325-337`) son
  chips de texto mono; existe `components/ui/file-thumbnail.tsx` (`FileThumbnail {file, size, radius?}`) sin usar ahí.
- Tras el turno, `App.tsx:930+` recarga los mensajes del servidor (`loadThreadMessages`), que no traen adjuntos: el
  mensaje enviado pierde sus adjuntos a los segundos.
- ERP.4.14: `OrchestChatView.tsx:70-94` arranca `orchestrator = null` y pinta "Orchestrator unassigned" mientras carga
  la config (`AgentComposer.tsx:639-645`).

## Qué cambiar
1. **Tipo** `ChatAttachment` (`app/src/types/orchestos.ts:239`): sumar `file?: File`, `fileId?: string`,
   `status?: 'uploading' | 'ready' | 'error'`, `error?: string`. `id` sigue siendo la clave local de la ficha.
2. **Cliente de subida** en `app/src/api/chat.ts`: `uploadChatFile(file: File, signal?)` → `POST /api/chat/upload`
   multipart con campo `file`; devuelve `ChatUploadResponse` (`src/dashboard/types.ts:406`); error HTTP → throw con el
   mensaje del servidor (413 "File exceeds 10 MB limit", etc.). `sendMessage` manda `fileIds` = `fileId` de los
   adjuntos `ready` (nunca el `id` local).
3. **Composer** (`AgentComposer.tsx`):
   - Una sola función `addFiles(files: File[])` usada por el input del clip, **pegar** (`onPaste` del textarea: archivos
     de `clipboardData.files`; si no hay archivos, el pegado de texto queda igual) y **arrastrar** (`onDragOver`/`onDrop`
     sobre la caja del composer, con un estado visual discreto de "soltar aquí" usando los tokens existentes).
   - Cada archivo entra como ficha `uploading` y se sube en el acto; pasa a `ready` con `fileId` o a `error`.
   - Tope: 5 adjuntos (`MAX_CHAT_ATTACHMENTS`, `handlers/chat.ts:740`); el sobrante no entra y se avisa en la ficha
     o en una línea de error del composer. Resetear `input.value` tras elegir (para poder elegir el mismo archivo).
   - Ficha: `FileThumbnail` (tamaño ~48) + nombre truncado; `uploading` = spinner encima; `error` = marca de error +
     botón **Reintentar** (`aria-label="Retry upload"`) ; siempre botón quitar (`aria-label="Remove attachment"`, se
     conserva). Quitar durante la subida aborta la petición.
   - Send deshabilitado mientras haya alguna ficha `uploading`; con fichas en `error` sí se puede enviar (se mandan
     solo las `ready`) — o deshabilitar también: elegir lo que lea más claro y decirlo en el reporte.
   - Mantener intactos: `textarea`, `aria-label="Send message"`, `aria-label="Attach file"`,
     `title="Select model and reasoning effort"`, `div.max-w-*` del contenedor (los leen los gates de chat).
4. **Mensaje enviado** (`OrchestChatView.tsx:325-337` y el render equivalente en `OrchestDevWorkspace.tsx` si lo
   tiene): adjuntos con `file` → `FileThumbnail` (≈64, como `chat-message.tsx`); sin `file` (p. ej. tras recargar la
   página) → la ficha de nombre actual. Cada adjunto del mensaje lleva `data-attachment-name="<nombre>"`.
5. **No perder los adjuntos al recargar mensajes** (`App.tsx` `handleSendMessage`): al reemplazar los mensajes con
   `loadThreadMessages`, copiar los `attachments` del mensaje optimista al último mensaje `user` del servidor con el
   mismo `content`. Persistirlos en la base queda fuera (tras recargar la página no se ven: igual que hoy).
6. **ERP.4.14** (`OrchestChatView.tsx`): estado de carga distinto de "sin orquestador" (`undefined` = cargando,
   `null` = sin asignar, o un flag aparte). Mientras carga: sin aviso y Send deshabilitado; el aviso "Orchestrator
   unassigned…" solo con la config ya leída y sin orquestador. Revisar si `AgentComposer` necesita un prop nuevo.
7. **Fidelidad**: quitar de `package.json:28` (`ui:fidelity:jsx`) el par `common/AgentComposer.tsx` (excepción
   UI.24 del prototipo ya decidida por Carlos para hilo y composer). No tocar los otros dos pares ni `check-css`.
8. **Gate nuevo** `scripts/ui-gate/flows/chat-attachments.mjs` (modelo: `codex-live.mjs` y `composer-picker.mjs`;
   proyecto temporal con identidad git por `-c`, `writeGateRoles`, cleanup con purge):
   - Codex real como agente del chat.
   - `.txt` con un token aleatorio (`ATT-<hex>`) por `setInputFiles` sobre el `input[type=file]`.
   - PNG generado en el navegador (canvas con una palabra aleatoria grande, negra sobre blanco → `toDataURL` → buffer)
     y pasado por **pegar o soltar** (distinto camino que el `.txt`), así el gate cubre ambos.
   - Afirmar: ambas fichas pasan a listo (sin `uploading`), Send habilitado; se observa `POST /api/chat/upload` ×2 y el
     `POST /api/chat` lleva `fileIds` con 2 ids que no empiezan con `att_`.
   - Prompt: "Reply with the token from the attached text file and the word in the attached image." → la respuesta
     (`div.prose`, texto plano) contiene el token y la palabra (comparación sin mayúsculas).
   - El mensaje enviado muestra 2 `[data-attachment-name]`, el de la imagen con un `<img>` cargado
     (`naturalWidth > 0`), y siguen ahí tras terminar el turno.
   - Capturas con `shot` del composer con fichas y del hilo final.
   - No entra al pre-push (`scripts/pre-push.sh` sin cambios): se corre a mano al tocar adjuntos.
9. **Tests unitarios**: `uploadChatFile` (multipart, error con mensaje), que `sendMessage` mande `fileId` y no el id
   local, y la fusión de adjuntos del punto 5 (extraer a una función pura testeable).

## Qué NO tocar
Backend (`handlers/chat.ts`, `src/chat/*`, DB), ruta API, OpenCode, TTL de 30 min, carpetas, `PLAN.md`, `NEXT.md`,
`docs/done/**`, `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json`.
No commitear. No `git stash`.

## Cómo se verifica (el ejecutor corre esto y pega la salida)
- `bun run typecheck && bun run lint`
- tests nuevos + `bun test src/dashboard/app` (o el patrón de los tests del frontend existentes)
- `bun run build:app && bun run ui:fidelity:jsx`
- `bun run ui:gate chat-attachments composer-picker chat-streaming codex-live chat-continuity` (fuera del sandbox si
  hace falta; ver `AGENTS.md` § lecciones de ui-gate). Mirar las capturas.
- `rg` en `scripts/ui-gate/` por cada texto/selector del composer o del hilo que cambie.

El cerebro además corre la contraprueba: `chat-attachments` contra el composer de HEAD debe fallar.
