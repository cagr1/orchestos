# OrchestOS — SSRF y contenido no confiable

Bloque L.4, 2026-07-29.

## Fetch permitido

Los fetch iniciados por contenido externo aceptan únicamente `http:`/`https:`, puertos 80/443,
sin usuario/contraseña embebidos. Se bloquean loopback, unspecified, RFC1918, link-local,
metadata/link-local IPv4, IPv6 ULA, IPv6 link-local, multicast y direcciones IPv4-mapped dentro
de IPv6. Los hostnames se resuelven con el resolver del sistema y cualquier dirección privada
devuelta bloquea el request.

`executeFetchUrl()` usa `redirect: "error"`, timeout de 10 segundos, tipos text/markdown/JSON y
lectura incremental con límite de 256 KB. El import remoto de skills usa la misma política,
timeout de 15 segundos y límite de 256 KB. Se hace una segunda resolución después de obtener la
respuesta: si el hostname pasó de público a privado, el resultado se descarta.

El segundo check reduce la ventana de DNS rebinding, pero no es pinning criptográfico de socket:
el `fetch` global de Bun no expone aquí un transporte con IP resuelta y SNI/Host coordinados. Si
se requiere garantía contra un cambio entre el check y la conexión, debe introducirse un cliente
HTTP explícitamente diseñado para resolución fijada; no se simula esa garantía.

## Datos sin autoridad

Web, OCR, archivos adjuntos, archivos leídos por `read_file` y resultados de búsqueda de memoria
se envuelven en `<untrusted-data source="...">`. El system prompt declara que ese bloque es dato,
nunca instrucción, y no puede cambiar tools, paths, modelo, permisos o criterios de aceptación.
El delimitador es defensa de prompt y no una frontera criptográfica: el modelo debe seguir la
política del system prompt, no instrucciones contenidas en el documento.

Las pruebas en `src/__tests__/ssrf.test.ts`, `chat-fetch-url.test.ts` y
`chat-read-project-tools.test.ts` cubren IPv6, mapped IPv6, credenciales, puertos, schemes,
redirect behavior indirecto, tamaño, contenido adversarial y DNS rebinding observable.
