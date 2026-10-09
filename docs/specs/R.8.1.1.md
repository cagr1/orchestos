# R.8.1.1 — marcador de tarea al final de la última línea + caché del catálogo de modelos CLI

Parte 1 (aplicada en 5b21afa): `hasTaskMarker`/`stripTaskMarker` en `src/dashboard/chat-live.ts` aceptan el marcador
al final de la última línea; a mitad de frase no cuenta; `getLiveText` oculta el prefijo parcial en streaming.

Parte 2: `readCliModelCatalogsCached` en `src/dashboard/chat-cli-models.ts` (TTL 10 min, lecturas simultáneas
comparten una, no cachea si algún catálogo trae `error`, rechazo no se cachea) + `resetCliModelCatalogCache`; usada en
`handleApiChatCliModels`, la validación de `handlers/chat.ts:860` y el reader por defecto de `handlers/model-catalog.ts`.
Tests en `chat-cli-models.test.ts`: concurrencia, TTL, error, rechazo. No tocar frontend ni `readCliModelCatalogs`.
