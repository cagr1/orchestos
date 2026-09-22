# UI.13.1b — El fallback de la app no debe tragarse rutas /api

`src/dashboard/http.ts`, función `serveStatic`: el bloque `if (url === '/' || !extname(url))` sirve
`app/index.html` para cualquier ruta sin extensión, incluidas `/api/*` que el router no atendió.
Rompe `src/dashboard/__tests__/projects-choose.test.ts:106` (`GET /api/projects/choose` debe dar 404,
da 200).

Cambio: antes de ese fallback, cualquier `url` que empiece por `/api/` (o sea exactamente `/api`)
responde `404 Not found`. Agregar un caso de test en el archivo de tests de `http.ts` si existe
(si no, en `projects-choose.test.ts` no hace falta tocar nada: ya lo cubre).

Verificación: `bun test src/dashboard/__tests__/projects-choose.test.ts` y `bun run test:coverage`
verdes, `bun run typecheck` verde. No commitear, no tocar PLAN.md.
