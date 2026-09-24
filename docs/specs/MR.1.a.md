# MR.1.a — Config de 4 roles + migración + catálogo único (spec para Luna)

Preflight: `bun run agent:preflight -- --item MR.1 --agent codex` (el preflight solo reconoce ítems de primer nivel; MR.1.a es sub-ítem de MR.1).
Contexto: PLAN.md § MR.1. Model routing pasa a 4 roles globales `{agente, modelo, esfuerzo}`. Este sub-ítem crea
**solo** el modelo de datos, su lectura/escritura y el catálogo. **No** cambia quién ejecuta qué: `models.*`,
`DEFAULT_CONFIG.models`, `autoRoute`, harness, QA, diagnose, draft y la UI **no se tocan** (eso es MR.1.b/c).
Prohibido: `orchestos init`, `git config` de cualquier tipo, tocar ítems ⚡ ajenos, commitear, invocar `codex exec`
o delegar a otro agente, escribir en el `orchestos.config.yaml` real del repo (tests siempre en dir temporal).

## 1. `src/config/schema.ts` — tipos nuevos (añadir, no borrar nada)
```ts
export const ROLE_NAMES = ['orchestrator', 'executor', 'reviewer', 'auxiliary'] as const
export type RoleName = (typeof ROLE_NAMES)[number]
export const ROLE_AGENTS = ['claude', 'codex', 'opencode', 'api'] as const
export type RoleAgent = (typeof ROLE_AGENTS)[number]
export interface RoleAssignment {
  agent: RoleAgent
  model: string        // CLI: id del catálogo del CLI; api: id OpenRouter (ej. 'deepseek/deepseek-v4-flash')
  effort?: string      // texto libre, sin validar por agente (decisión de Carlos)
  provider?: string    // solo agent 'api'; ausente = 'openrouter'
}
```
En `OrcheConfig` añadir `roles: Partial<Record<RoleName, RoleAssignment>>` (siempre presente, puede ser `{}`),
con JSDoc corto que remita a PLAN.md § MR.1. `DEFAULT_CONFIG.roles = {}` — **nunca** un rol por defecto.

## 2. `src/config/load.ts` — lectura + migración en memoria
En `mergeWithDefaults` añadir `roles: resolveRoles(raw)`. Por cada `RoleName`:
1. Si `raw.roles?.[name]` existe: validarlo — objeto con `agent ∈ ROLE_AGENTS` y `model` string no vacío
   (trim). `effort`/`provider` opcionales, solo si son string no vacío. Inválido → `warnIgnored('roles.<name>', …)`
   y el rol queda **sin asignar** (no cae a legacy).
2. Si no existe, migrar desde `raw.models` (el YAML crudo, **nunca** desde `DEFAULT_CONFIG`):
   `orchestrator ← models.planner`, `executor ← models.executor_heavy`, `reviewer ← models.qa`.
   `auxiliary` no tiene origen legacy → sin asignar. `executor_light` y `default` no migran.
   Usar `parseRoleValue(valor, {provider:'', model:''})`; si el resultado tiene `model` vacío → sin asignar.
   Resultado: `{ agent: 'api', model, provider }` (conservar el provider legacy, ej. `openrouter`).
3. Ninguno de los dos → la clave no aparece en `roles`.

Exportar además, en `load.ts`:
```ts
export class RoleUnassignedError extends Error {}   // name = 'RoleUnassignedError'
export function resolveRole(cfg: OrcheConfig, role: RoleName): RoleAssignment
```
`resolveRole` devuelve la asignación o lanza `RoleUnassignedError` con el mensaje exacto
`Rol '<name>' sin asignar: elígelo en Settings → Model routing`. Sin consumidores todavía (los pone MR.1.b).

`scaffoldConfigYaml()`: añadir un bloque comentado `# roles:` con los 4 roles de ejemplo
(`executor: { agent: codex, model: gpt-6-luna, effort: medium }`, etc.). No cambiar el bloque `models:`.

## 3. `src/dashboard/handlers/config.ts` — GET y PUT
GET (`handleApiConfigGet`): añadir al JSON, sin tocar los campos existentes:
- `roleAssignments`: objeto con las 4 claves; valor `RoleAssignment` o `null` si sin asignar.
- `roleWarnings: string[]`: contiene `'reviewer-same-as-executor'` si ambos están asignados con igual `agent` y
  `model` (aviso de errores correlacionados, no bloqueo).

PUT (`handleApiConfigSet`): aceptar `roleAssignments?: Partial<Record<RoleName, {agent, model, effort?, provider?} | null>>`.
- Validar antes de escribir: clave ∉ `ROLE_NAMES`, `agent` ∉ `ROLE_AGENTS` o `model` vacío → 400 con mensaje que
  nombre el rol; no escribe nada. `roleAssignments` cuenta como "algo que guardar" en el chequeo `nothing to save`.
- `null` → `document.deleteIn(['roles', name])`. Objeto → `document.setIn(['roles', name], {...})` escribiendo
  solo los campos presentes (sin `effort`/`provider` si no vinieron; `provider` solo con agent `api`).
- Mismo patrón de `parseDocument` que ya usa el handler (preserva el resto del YAML). En la rama de fallback
  (`yamlStringify(newConfig)`) `newConfig.roles` debe reflejar el cambio.
- No borrar ni tocar `models.*` al escribir `roles` (lo retira MR.1.b).

## 4. Catálogo único — `GET /api/models/catalog`
Nuevo archivo `src/dashboard/handlers/model-catalog.ts`:
```ts
export interface CatalogAgent { id: RoleAgent; installed: boolean; models: {id:string;name:string}[]; efforts: string[]; error?: string }
export async function handleApiModelCatalog(deps?: { readCli?: typeof readCliModelCatalogs; fetchFn?: ChatModelsFetch }): Promise<Response>
```
- Devuelve `{ agents: CatalogAgent[] }` en orden `claude, codex, opencode, api`.
- CLI: `readCliModelCatalogs()` (`src/dashboard/chat-cli-models.ts`). CLI no instalado → `installed:false, models:[]`.
  Los `efforts` por modelo del catálogo CLI se pueden descartar; se usa el `efforts` del catálogo.
- `api`: lista de OpenRouter. **Extraer** la parte de fetch+map de `handleApiChatModels`
  (`handlers/chat.ts:243`) a una función exportada reutilizable (misma caché `chatModelsCache`), y que
  `handleApiChatModels` la use — su respuesta HTTP no cambia. Si OpenRouter falla y no hay caché:
  `{ id:'api', installed:true, models:[], efforts:[], error:'<mensaje>' }` — el catálogo **no** responde 502.
- Registrar la ruta en `src/dashboard/server.ts` junto a `/api/chat/cli-models` (antes del catch-all estático).
- No cambiar `/api/chat/models` ni `/api/chat/cli-models`.

## 5. Tests (nuevos, `src/__tests__/model-roles-config.test.ts` y `src/dashboard/__tests__/model-catalog.test.ts`)
Siempre con dir temporal (`mkdtempSync`) pasado como `root`; nunca el cwd real.
1. YAML legacy (`models.planner/executor_heavy/qa` con `provider: openrouter`) → `roles` =
   orchestrator/executor/reviewer con `agent:'api'`, provider `openrouter`; `auxiliary` ausente.
2. Sin archivo de config → `roles` = `{}`; `resolveRole(cfg,'executor')` lanza `RoleUnassignedError` con el
   mensaje exacto.
3. `roles.executor` explícito (`agent: codex, model: gpt-6-luna, effort: medium`) gana sobre `models.executor_heavy`.
4. `roles.reviewer` con `agent: 'foo'` → reviewer sin asignar (no migra desde `models.qa`).
5. PUT `roleAssignments.executor` → 200; GET devuelve `roleAssignments.executor` igual; el YAML conserva
   `models:` y otros campos (ej. `agent: codex`) intactos.
6. PUT con `null` borra el rol; PUT con agent inválido → 400 y el archivo no cambia (comparar bytes).
7. GET con reviewer = executor (mismo agent+model) → `roleWarnings` contiene `'reviewer-same-as-executor'`.
8. Catálogo con `readCli` y `fetchFn` inyectados: orden de agentes, CLI no instalado → `installed:false`,
   OpenRouter caído → 200 con `error` en `api`. Llamar `clearChatModelsCache()` en `beforeEach`.
Recordatorio (PLAN.md § CI.5): Bun no ve cambios a `process.env`/`homedir()` en runtime; no depender del HOME real
ni de CLIs instalados en el host — todo inyectado.

## Verificación (Luna corre y pega la salida real, sin resumir)
1. `bunx tsc --noEmit`
2. `bun test src/__tests__/model-roles-config.test.ts src/dashboard/__tests__/model-catalog.test.ts src/__tests__/config-set-executor-mode.test.ts src/__tests__/config-get-resilience.test.ts src/__tests__/task-agent-rules-config.test.ts src/dashboard/__tests__/config-executor-mode.test.ts`
3. `bun run test:coverage` → 0 fail.
4. `bunx biome check` sobre los archivos tocados.
Reporte final: lista de archivos tocados y cualquier punto del spec que no se pudo cumplir, dicho explícitamente.

## Ronda 2 — bug hallado en el gate en vivo (cerebro, 2026-09-24)
PUT `roleAssignments: { orchestrator: null }` sobre un YAML con `models.planner` responde 200, borra
`roles.orchestrator`, y el GET siguiente lo devuelve **asignado** otra vez: el loader lo re-migra desde `models.*`.
Un rol con origen legacy no se puede desasignar. Arreglo:
1. `src/config/load.ts` `resolveRoles`: si `explicit[name] === null` → rol sin asignar, **sin** `warnIgnored` y sin
   migrar desde legacy (comentario de una línea con el porqué).
2. `src/dashboard/handlers/config.ts`: `null` → `document.setIn(['roles', name], null)` (no `deleteIn`); en la rama
   de fallback `yamlStringify`, los roles puestos a `null` también se serializan como `null` explícito.
3. `src/__tests__/model-roles-config.test.ts`: el fixture del test PUT/GET añade
   `executor_heavy: { provider: openrouter, model: legacy }` bajo `models:`, para que el caso `executor: null`
   ejercite de verdad la re-migración; el assert `roles.executor` indefinido debe seguir pasando. Añadir un test de
   loader: YAML con `roles: { reviewer: null }` y `models.qa` → reviewer ausente y sin aviso en `console.error`.
Verificación: la misma de arriba (puntos 1, 2 y 4; `test:coverage` lo corre el cerebro fuera del sandbox).
