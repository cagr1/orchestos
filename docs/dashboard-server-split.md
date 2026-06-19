# Diseño — split de `src/dashboard/server.ts` (Mes 12, Bloque D)

`server.ts` son 1727 líneas: routing + handlers de 10 dominios de API + helpers de infraestructura
+ prompts del curador, todo en un solo archivo. Este documento define el mapa de módulos **antes**
de mover una sola línea (D1). La ejecución mecánica del movimiento es D2; el gate de no-regresión es D3.

## Principio

`route()` se queda en `server.ts` como **orquestador delgado**: solo importa handlers y hace el
`if (method && pathname)` → `return handlerX(...)`. Sigue siendo la única exportación que los tests
(`skills-api.test.ts`) usan (`const { route } = await import('../server.ts')`) — su firma y
comportamiento no cambian.

Cero cambios de comportamiento. Es mover código, no reescribirlo.

## Mapa de módulos

```
src/dashboard/
  server.ts                    -- route() orquestador + startServer() + entrypoint (import.meta.main)
  http.ts                      -- helpers de HTTP genéricos, sin dominio
  settings-store.ts            -- lectura/escritura de ~/.orchestos/.env
  llm/
    clients.ts                 -- ollamaChat (glue local-only, distinto de providers/openrouter.ts)
  prompts/
    curator.ts                 -- CURATOR_SYSTEM, IMPORT_SYSTEM (solo strings)
  handlers/
    runs.ts                    -- GET /api/runs, /api/runs/:id
    tasks.ts                   -- GET/POST/DELETE /api/tasks, /api/tasks/:id/run, /api/tasks/:id/diagnose
    instincts.ts                -- GET/POST /api/instincts, /approve, /reject
    specs.ts                    -- GET /api/specs, POST /api/specs/draft
    project.ts                  -- /api/project/constitution, /api/project/context, POST /api/natural
    chat.ts                      -- POST /api/chat, /api/chat/upload, GET /api/chat/models (+ file store)
    setup.ts                     -- /api/setup, /api/settings, /api/health, /api/setup/api-key, /api/providers/local
    skills.ts                    -- todo /api/skills/* (CRUD, export, build, pro pack, import, curate)
    memory.ts                    -- GET /api/memory
  types.ts                      -- (sin cambios)
  __tests__/
    skills-api.test.ts           -- (sin cambios, sigue importando { route } de server.ts)
```

## Función → archivo (mapa completo, por línea actual en `server.ts`)

| Símbolo actual | Líneas | Archivo destino |
|---|---|---|
| `FileEntry`, `fileStore`, `pruneExpiredFiles`, `randomId`, `extractPdfText`, `handleApiChatUpload`, `MAX_FILE_BYTES`, `FILE_TTL_MS` | 47–141 | `handlers/chat.ts` |
| `ENV_FILE`, `SETTINGS_KEYS`, `parseEnvFile`, `maskKey`, `readEnv`, `writeEnv` | 143–177 | `settings-store.ts` |
| `MIME`, `mimeType`, `STATIC_BASE_REAL`, `serveStatic` | 179–222 | `http.ts` |
| `jsonResponse`, `errorResponse` | 224–233 | `http.ts` |
| `parseContextWarnings`, `runRecordToRow`, `handleApiRuns` | 237–276 | `handlers/runs.ts` |
| `handleApiTasks` | 278–299 | `handlers/tasks.ts` |
| `handleApiInstincts`, `handleApiInstinctsApprove`, `handleApiInstinctsReject` | 301–331 | `handlers/instincts.ts` |
| `TASK_ID_RE`, `validateTaskId` | 333–339 | `handlers/tasks.ts` (compartido por run/delete/diagnose) |
| `handleApiSpecsDraft` | 341–355 | `handlers/specs.ts` |
| `handleApiChatModels`, `handleApiChat` | 357–507 | `handlers/chat.ts` |
| `handleApiProjectConstitutionGet/Put`, `handleApiProjectContextGet/Regenerate` | 509–540 | `handlers/project.ts` |
| `handleApiNatural` | 542–588 | `handlers/project.ts` |
| `handleApiSpecs` | 590–613 | `handlers/specs.ts` |
| `handleApiSettingsGet` | 615–643 | `handlers/setup.ts` |
| `handleApiSetup` | 645–762 | `handlers/setup.ts` |
| `handleApiSettingsPost` | 764–782 | `handlers/setup.ts` |
| `handleApiInstinctsCreate` | 784–802 | `handlers/instincts.ts` |
| `descToTaskId`, `inferExecutorFromModel`, `handleApiTasksCreate`, `handleApiTasksRun`, `handleApiTasksDelete` | 804–888 | `handlers/tasks.ts` |
| `handleApiHealth` | 890–959 | `handlers/setup.ts` |
| `handleApiTasksDiagnose` | 961–980 | `handlers/tasks.ts` |
| `handleApiMemory` | 982–999 | `handlers/memory.ts` |
| `isSameOrigin` | 1001–1012 | `http.ts` |
| `ollamaChat` | 1014–1044 | `llm/clients.ts` |
| `PROVIDER_CONFIGS`, `humanizeKeyError`, `handleApiSetupApiKey` | 1046–1149 | `handlers/setup.ts` |
| `handleApiProvidersLocal`, `formatSize` | 1151–1178 | `handlers/setup.ts` |
| `handleApiSkillsList/Get/Export/Create/Update/Delete/Build` | 1180–1318 | `handlers/skills.ts` |
| `handleApiSkillsProList/Import` | 1320–1364 | `handlers/skills.ts` |
| `CURATOR_SYSTEM`, `IMPORT_SYSTEM` | 1366–1421 | `prompts/curator.ts` |
| `handleApiSkillsImport`, `normalizeImport` | 1423–1517 | `handlers/skills.ts` (importa `IMPORT_SYSTEM` de `prompts/curator.ts`) |
| `handleApiSkillsCurate` | 1519–1572 | `handlers/skills.ts` (importa `CURATOR_SYSTEM`) |
| `route()` | 1574–1707 | `server.ts` (queda igual, solo cambian los imports) |
| `startServer()`, entrypoint | 1709–1727 | `server.ts` (sin cambios) |

## Dependencias entre módulos nuevos

- `http.ts` — sin dependencias de dominio. Lo importan todos los `handlers/*`.
- `settings-store.ts` — sin dependencias de dominio. Lo importan `handlers/setup.ts` y
  `handlers/chat.ts` (necesita `OPENROUTER_API_KEY` para `handleApiChatModels`).
- `llm/clients.ts` — importa `Bun.fetch` nativo, sin dependencias internas. Lo importa
  `handlers/chat.ts`.
- `prompts/curator.ts` — solo constantes string. Lo importa `handlers/skills.ts`.
- `handlers/*.ts` — cada uno importa de los stores existentes (`db/*`, `tasks/loader`,
  `instincts/store`, `spec/*`, `skills/*`, `context/load`, `providers/openrouter`) igual que hoy.
  Ningún handler importa de otro handler — si dos dominios necesitan la misma lógica, esa lógica
  vive en `http.ts`, `settings-store.ts` o `llm/clients.ts`, no se importa cruzado entre handlers.
- `server.ts` — importa los 9 módulos de `handlers/` y nada más de lógica de dominio.

Esto evita ciclos: la dirección de dependencia es siempre `server.ts → handlers/* → (stores/providers existentes | http.ts | settings-store.ts | llm/clients.ts | prompts/curator.ts)`.

## Tipos (`types.ts`)

Sin cambios — sigue siendo el archivo de tipos compartido que todos los `handlers/*` importan,
igual que `server.ts` hoy.

## Orden de ejecución para D2

Mover por dominio, de menor a mayor riesgo de romper algo (cada paso es un commit verificable con
`tsc --noEmit` + suite verde antes de seguir):

1. `http.ts` (helpers puros, cero estado) + `settings-store.ts` (estado de archivo, sin red)
2. `prompts/curator.ts` (strings, cero riesgo)
3. `llm/clients.ts` (una función, `ollamaChat`)
4. `handlers/memory.ts`, `handlers/runs.ts`, `handlers/instincts.ts`, `handlers/specs.ts` (CRUD simple, sin LLM)
5. `handlers/tasks.ts`, `handlers/project.ts` (algo de spawn de subprocesos, sin LLM directo salvo `handleApiNatural`)
6. `handlers/setup.ts` (el más grande de los "simples" — usa `settings-store.ts`)
7. `handlers/chat.ts` (usa `llm/clients.ts` + `settings-store.ts` + file store)
8. `handlers/skills.ts` (el más grande — usa `prompts/curator.ts`)
9. Dejar `server.ts` solo con `route()` + `startServer()` + entrypoint

Tras cada paso: `tsc --noEmit` limpio y 421+ tests verdes (gate D3 al final, pero verificar en
cada paso intermedio evita tener que revertir un movimiento grande si algo se rompe).
