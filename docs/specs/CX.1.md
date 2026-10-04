# CX.1 — `gate:evidence` exporta 0 runs de `ui:gate` (spec para Luna)

Ítem: PLAN.md § CX.1.

## Bug medido (I.7.2, 2026-10-04)

`bun run gate:evidence -- --label X -- bun run ui:gate auto-flow` ejecuta tareas reales (Claude y Codex), pero
imprime `evidence: 0 exported`. Causa: el wrapper (`scripts/run-evidence-gate.ts:147`) le pasa al hijo
`ORCHESTOS_HOME=<tempHome>`, y `scripts/ui-gate/run.mjs:16,253,261` lo pisa con su propio
`<runDir>/home`. El dashboard escribe los runs ahí y el wrapper exporta desde `<tempHome>`, que está vacío.

## Cambios

1. **`scripts/run-evidence-gate.ts:147`**: además de `ORCHESTOS_HOME`, pasar
   `ORCHESTOS_GATE_EVIDENCE_HOME: tempHome` en el env del hijo.
2. **`scripts/ui-gate/run.mjs:16-17`**:
   `const home = process.env.ORCHESTOS_GATE_EVIDENCE_HOME || path.join(runDir, 'home')`. `databasePath` se
   sigue derivando de `home`. Sin la variable, el comportamiento queda idéntico.
3. **`run.mjs:262`**: las capturas van a `path.join(runDir, 'gate-captures')` en vez de `home`. El wrapper borra
   `tempHome` después de exportar, y las capturas son evidencia: no deben borrarse con él. Revisar que nada más
   del runner ni de los flujos lea capturas desde `home/gate-captures` (`grep -rn gate-captures scripts src`).
   Si algo lo hace, apuntarlo al mismo `runDir`.
4. **`run.mjs:~279-286`** (chequeo "dashboard database escaped runDir"): comparar contra
   `realpath(home)` en vez de `runDir` (`actualDatabasePath` debe empezar con `${realpath(home)}${sep}`). Se
   mantiene la protección: la DB nunca es la del usuario, porque el wrapper ya exige
   `tempHome !== evidenceHome`.

## Tests

- `scripts/ui-gate/run.test.ts` o `scripts/run-evidence-gate.test.ts`, según dónde esté el patrón existente:
  el env que el wrapper pasa al hijo incluye `ORCHESTOS_GATE_EVIDENCE_HOME === tempHome`. Si `run.mjs` no es
  testeable sin lanzar el navegador, extraer la resolución de `home` a una función exportada pura
  (`resolveGateHome(env, runDir)`) y testearla con y sin la variable.

## Gate

`bunx tsc --noEmit` · `bun run lint` (sin errores nuevos en los archivos tocados) · `bun test` completo. Reportar
salidas reales. El cerebro corre después `gate:evidence` con un flujo real y confirma `exported > 0`.

## Fuera de alcance

Cualquier otro cambio a los flujos, al export de runs (`exportRunEvidence`) o al formato de evidencia. No
commitear ni tocar `PLAN.md`.
