# USO.12 — El borrador del composer se pierde al cambiar de pestaña

Origen: tarea que creó el chat de Carlos el 2026-11-13 (`chat-7ad67f02-b28f-43f3-ae40-7d5970dafe75`), sacada de `tasks.yaml` por USO.10:
el chat no debe lanzar cambios sobre OrchestOS. Texto original:

Bug reportado por Carlos (2026-11-13): al escribir en el composer y cambiar a otro tab, el texto escrito se pierde.

Causa verificada: `src/dashboard/app/src/components/common/AgentComposer.tsx:234` guarda el texto en `useState('')` local. Al cambiar de vista/tab el componente se desmonta y el estado se pierde.

Arreglo:
1. Nuevo `src/dashboard/app/src/lib/composer-drafts.ts`, con el mismo patrón que `src/dashboard/app/src/lib/chat-queue.ts` (Map a nivel de módulo + listeners): `readComposerDraft(threadId)`, `writeComposerDraft(threadId, text)` (con texto vacío borra la entrada) y `subscribeComposerDrafts`. Además, reflejarlo en `sessionStorage` (clave `orchestos:composer-draft:<threadId>`, dentro de try/catch) para que sobreviva a una recarga de la pestaña del navegador.
2. En `AgentComposer.tsx`, usar como clave el `queueThread` que ya existe (l.199: `contextSessionId ?? new:<projectId>`). Iniciar `inputText` desde el borrador guardado, guardar cada cambio y, si cambia `queueThread`, cargar el borrador del nuevo hilo. En cada sitio donde hoy se vacía el texto tras enviar (`setInputText('')` en l.520 y l.527), borrar también el borrador. El vaciado de l.413 (entrada a shell mode con `!`) solo actualiza el borrador a vacío. Los borradores de hilos distintos no se mezclan.
3. Tests en `src/dashboard/app/src/lib/composer-drafts.test.ts`: escribir/leer por hilo, que el vacío borra, aislamiento entre hilos y el respaldo en sessionStorage (con un stub si no hay `sessionStorage`).

No tocar: servidor, handlers, polling ni el diff de ACT.1 sin commitear (`OrchestChatView.tsx`, `OrchestDevWorkspace.tsx`, `components/thread/*`, `api/chat.ts`, `types/orchestos.ts`, `PLAN.md`). Tampoco `index.css` ni `styles.css`. No commitear.

Verificación: `bunx tsc -p src/dashboard/app/tsconfig.json --noEmit`, `bunx biome check` de los archivos tocados, `bun test src/dashboard/app` y `bun run build:app`.

## Criterios
- Escribir texto en el composer, cambiar a otra vista o tab y volver conserva el texto en ese hilo
- Al enviar el mensaje, el borrador de ese hilo queda vacío y no reaparece al volver
- Los borradores de hilos/sesiones distintos son independientes
- No se modificaron OrchestChatView.tsx, OrchestDevWorkspace.tsx, components/thread/*, api/chat.ts, types/orchestos.ts ni PLAN.md
