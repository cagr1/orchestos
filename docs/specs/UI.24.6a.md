# UI.24.6a — Imágenes nativas al CLI del chat

Ítem: PLAN.md § UI.24 → UI.24.6a. Preflight: `bun run agent:preflight -- --item UI.24.6a --agent <tú>`. Rol: `criterio`.
No commitear, no tocar PLAN.md ni NEXT.md. Ajenos sin commitear (no tocar): `IDEAS.md`, `NEXT.md`,
`orchestos.config.yaml`, `.orchestos/feature-status.json`, `runs-summary.json`. **PROHIBIDO `git stash`,
`git checkout`, `git restore`.** El candado writer-lock lo tiene la sesión que te delega (claude): puedes editar.

## Problema (verificado por el cerebro)

En `src/dashboard/handlers/chat.ts:1356-1381`, cada imagen adjunta va a `imageParts` si `supportsVisionInput(model)`,
o a OCR si no. El turno por CLI (`useClaudeCli` `:1519`, `useCodexCli` `:1582`) **no recibe `imageParts`**: con un
modelo con visión, la imagen se pierde en silencio (comentario `:1514-1516`). Con modelo sin visión llega solo el OCR.

## Objetivo

En el turno por CLI, cada imagen adjunta llega al modelo **como imagen**:

1. Antes de lanzar el CLI, escribir cada `FileEntry` de tipo `image` (`content` = data URL base64) a un archivo en
   un directorio temporal del turno, `mkdtempSync(join(tmpdir(), 'orchestos-chat-att-'))`, **nunca dentro del
   proyecto** (ensuciaría el árbol y bloquearía tareas). Extensión según el mime. Borrar el directorio en el `finally`
   del turno, igual que `isolatedCwd` hoy. Función pura y testeable para "data URL → bytes + extensión"
   (rechaza lo que no sea `data:image/(png|jpeg|gif|webp);base64,`).
2. **Codex**: `runCodexChat` (`src/run/executors/codex.ts:417`) recibe las rutas. Ruta `exec` (sin `sessionId`):
   `buildCodexChatArgs` (`codex.ts:304`) añade `--image <ruta>` por imagen (`codex exec --help`: `-i, --image
   <FILE>...`). Ruta app-server (con `sessionId`): usar el ítem de entrada de imagen local del protocolo de
   `codex app-server` en el `turn/start` (leer el código existente que arma el input del turno y, si hace falta, el
   esquema de `codex app-server generate-ts` o `generate-json-schema`; citar dónde lo viste). Si el protocolo no
   admite imagen local, decirlo y caer a `exec` no: caer a OCR (punto 4) y reportarlo.
3. **Claude**: `buildClaudeChatArgs` (`src/run/executors/external.ts:354`) acepta directorios extra: `--add-dir
   <tmp de adjuntos>`; el prompt (`cliInput`, `chat.ts:1521`) añade al final una línea por imagen
   `Attached image: <ruta absoluta>` para que la abra con `Read` (que lee imágenes). Comprobar que el `--settings`
   restringido (`external.ts`, `CLAUDE_CHAT_BOUNDARY_FLAGS`) no niega leer fuera del proyecto ese directorio; si lo
   niega, ampliar la regla solo a ese directorio y explicarlo.
4. En el CLI, la imagen **no** pasa por OCR si se pudo escribir y pasar; si falla la escritura o el CLI no la admite,
   OCR como hoy (y el 422 de `:1377-1379` se mantiene). La ruta API (`imageParts` → `messages`, `:1499-1503`) no
   cambia.
5. Quitar o actualizar el comentario `:1514-1516` (ya no es verdad).

## No tocar

Frontend (eso es UI.24.6b), `POST /api/chat/upload` (`chat.ts:240-280`), OpenCode, ruta API, frontera de lectura del
proyecto (`read-boundary`). Solo el directorio de adjuntos del turno se añade como lectura.

## Tests (pegar salida)

- `buildCodexChatArgs` con 2 imágenes → dos `--image <ruta>`; sin imágenes, args idénticos a hoy.
- `buildClaudeChatArgs` con dir de adjuntos → `--add-dir <dir>` además del proyecto; sin él, idénticos a hoy.
- data URL → archivo: png/jpeg ok, mime raro rechazado.
- El directorio temporal se borra tras el turno (también si el CLI falla).
- Si existe test del input del app-server, el ítem de imagen local entra.

## Verificación en vivo (obligatoria, pegar salida)

Script desechable fuera del repo (`/tmp`) o test manual contra el dashboard real (`bun run src/cli.ts dashboard` o
el comando del repo; bajarlo al terminar): subir con `curl -F file=@<png con un texto grande, p. ej. "ZEBRA-4417">
http://localhost:<puerto>/api/chat/upload`, y mandar a `/api/chat` en una sesión **Codex** con `fileIds` y el mensaje
"¿Qué palabra se lee en la imagen? Responde solo la palabra." Pegar la respuesta. Repetir con **Claude** si el CLI
está disponible. Generar el PNG con lo que haya (p. ej. `bun` + canvas no hay: usar `sips`/`qlmanage` o un PNG
pequeño escrito con un script). Si no se pudo, decirlo, no inventarlo.

    bun run typecheck
    bunx biome format --write <archivos tocados> && bunx biome check <archivos tocados>
    bun test src/run/executors src/dashboard/handlers
    bun run ui:gate chat-streaming codex-live read-boundary

Reportar: archivos tocados, cómo se pasa la imagen en cada CLI (con cita), resultado de la prueba en vivo, límites.
