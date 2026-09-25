# MR.1.c — UI de Model routing (4 roles) + UI de `taskAgentRules`

Decisiones de Carlos (2026-09-25): grilla 2×2 actual con 3 campos por tarjeta; borrar la tarjeta "QA judge";
el plegable "Task → Model Mappings" se reemplaza por la UI de reglas. Diseño completo en PLAN.md § MR.1.

## Qué cambiar

### 1. API — `src/dashboard/handlers/config.ts`
- GET `/api/config`: añadir `taskAgentRules: cfg.taskAgentRules ?? []`.
- PUT `/api/config`: aceptar `taskAgentRules?: TaskAgentRule[]` (`src/config/schema.ts`: `match.output?: string[]`,
  `match.skill?: string`, `agent: AgentChoice`, `cli_effort?: string`). Validar: array; cada regla con `agent` en
  `AGENT_CHOICES`; `match` con al menos uno de `output` (array de strings no vacíos) o `skill` (string no vacío);
  `cli_effort` string si viene. 400 con mensaje claro si no. Array vacío = borrar las reglas del YAML. Escribir en
  `orchestos.config.yaml` igual que `roleAssignments` (sin pisar el resto de claves). Incluirlo en el chequeo de
  "nothing to save".
- Tests en el test existente del handler de config: GET devuelve reglas; PUT válido persiste y conserva otras claves;
  PUT inválido (agent desconocido, match vacío) → 400; `[]` borra.

### 2. UI — `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx` (sección `model_routing`, ~`:1251-1416`)
- Datos: `GET /api/models/catalog` → `{ agents: [{ id, installed, models[{id,name}], efforts[], error? }] }`
  (`handlers/model-catalog.ts`) y `roleAssignments` / `roleWarnings` / `taskAgentRules` de `/api/config`.
- Grilla 2×2 (mismas clases de tarjeta que hoy: `p-3.5 rounded-card border border-app bg-app-surface space-y-2
  relative`), una tarjeta por rol, en este orden y con estas descripciones cortas:
  Orchestrator — "Chat, drafts and task splitting"; Executor — "Runs tasks"; Reviewer — "QA, adversarial and
  refuter (read-only)"; Auxiliary — "Diagnose and memory judge (read-only)".
  Cada tarjeta, tres controles apilados:
  1. **Agente**: select con los agentes del catálogo; los `installed: false` aparecen deshabilitados; primera opción
     "Unassigned" (= `null`).
  2. **Modelo**: el combobox con filtro que ya existe (mismas clases de botón/lista), alimentado por
     `catalog.agents[agente].models`. Deshabilitado si el agente es "Unassigned". Si el modelo guardado no está en
     el catálogo, mostrarlo igual (valor real, no se borra). Si `agent.error`, mostrar el error en una línea
     `text-app-muted` bajo el control.
  3. **Esfuerzo**: select con `catalog.agents[agente].efforts`; oculto si la lista está vacía (API).
  Cambiar el agente limpia modelo y esfuerzo de esa tarjeta.
  Tarjeta sin asignar: texto "Unassigned" en el control de agente. Si `roleWarnings` incluye
  `reviewer-same-as-executor`, línea de aviso en la tarjeta Reviewer: "Same agent and model as Executor: errors may
  correlate." (aviso, no bloquea).
- Guardar: el botón Save existente envía `{ roleAssignments: { orchestrator, executor, reviewer, auxiliary } }`
  (`{agent, model, effort?}` o `null`) y `taskAgentRules`. Tras guardar, releer `/api/config` (para que
  `roleWarnings` refleje lo guardado).
- **Borrar**: la tarjeta "QA judge" (`~:1360-1374`); el estado `roleModels`, `ALL_SEARCHABLE_MODELS` si queda sin
  uso, `activeComboboxRole` si se reemplaza, `isTaskModelTableOpen` y el plegable "Task → Model Mappings" con su
  `'Claude 3.7 Sonnet'` inventado; el envío de `roles` (models.* legacy) desde esta sección.
- **Reglas (`taskAgentRules`)**: en el lugar del plegable borrado, mismo contenedor plegable (`rounded-card border
  border-app bg-app-surface text-xs overflow-hidden` + botón con `ChevronDown`), título "Task rules
  ({n})". Dentro, una fila por regla, en orden (la primera que coincide gana — decirlo en una línea
  `text-app-muted`): campo de texto "output globs" (separados por coma → `match.output`), campo "skill"
  (→ `match.skill`), select de agente (`AGENT_CHOICES` detectados, como arriba), select de esfuerzo opcional, botón
  borrar fila. Botón "Add rule" al final. Se guarda con el mismo Save.
- Sin CSS nuevo: solo clases Tailwind ya usadas en este archivo; `styles.css` no se toca.
- No tocar la sección "Default agent" (`executor`), el chat ni el composer (eso es MR.1.d).

### 3. Gate en navegador — flujo nuevo `scripts/ui-gate/flows/model-routing.mjs`
Mismo esqueleto que `tasks.mjs` (proyecto temporal con `orchestos init`, sin `writeGateRoles`: los roles se ponen
**clickeando**). Pasos con `step(...)`:
1. Abrir Settings → Model routing: las 4 tarjetas visibles, las 4 muestran "Unassigned"; no aparece "QA judge" ni
   "Claude 3.7 Sonnet".
2. Asignar por clicks los 4 roles a Codex · `gpt-6-luna` · medium; Save; recargar la página: los 4 muestran ese valor;
   `GET /api/config` → `roleAssignments` coincide; aparece el aviso reviewer = executor.
3. Añadir una regla (output `docs/**` → Codex), Save, recargar: la regla sigue; `GET /api/config` la devuelve.
   Borrarla, Save, recargar: 0 reglas.
4. Correr la tarea de `tasks.mjs` ("Append the line…", criterio `README.md contains the line: …`) con Run Next Task
   y esperar su fin: el run registrado tiene `model = gpt-6-luna` y `qa_model = gpt-6-luna` (lo puesto por UI).
Registrar el flujo donde `run.mjs`/el pre-push listan los flujos (buscar la lista de 9 en `scripts/pre-push.sh`).

## Verificación (Luna)
`bunx tsc --noEmit`; `tsc -p src/dashboard/app/tsconfig.json --noEmit`; tests del handler de config; `bun test`
completo (línea final literal); `node --check scripts/ui-gate/flows/model-routing.mjs`; biome sobre los tocados;
`node scripts/ui-fidelity/check-css.mjs`. Todo identificador usado en el flujo nuevo debe estar importado (un
`import()` no lo detecta). Los ui:gate los corre el cerebro fuera del sandbox.
