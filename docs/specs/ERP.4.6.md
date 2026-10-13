# ERP.4.6 — El check por defecto de `tsc` solo se añade si el proyecto tiene `tsconfig.json`

## Problema
`defaultChecksFor` (`src/run/checks.ts:71-80`) añade `bunx tsc --noEmit` cuando existe `node_modules` y alguna salida
es `.ts`/`.tsx`. En un proyecto sin `tsconfig.json` (caso real: `erp-piloto`, Bun puro, `node_modules` solo con react)
`tsc --noEmit` sin archivos ni config imprime la ayuda y sale con 1: el check no puede pasar nunca y el harness
descarta el trabajo del ejecutor ("check failed: bunx tsc --noEmit exit 1", run de la tarea `chat-f59db027`).

## Cambio
1. `src/run/checks.ts`, `defaultChecksFor`: el check `bunx tsc --noEmit` se añade solo si además existe
   `join(effectiveRoot, 'tsconfig.json')`. El check `bun test <archivo>` de los `.test.ts`/`.test.tsx` NO cambia:
   sigue dependiendo solo de `node_modules`. Añadir al comentario de la función una entrada fechada
   `ERP.4.6 (2026-10-13)` de 2-3 líneas con el motivo; no borrar el historial del comentario.
2. Tests:
   - `src/__tests__/checks.test.ts`: los tests que hoy esperan el check de `tsc` (líneas ~48-57, ~111, ~117) deben
     crear también un `tsconfig.json` (`{}`) en su directorio temporal; lo más simple es que el helper de fixture
     (línea ~22, el que crea `node_modules`) lo escriba junto a `node_modules`, salvo que un test pida lo contrario.
     Test nuevo: con `node_modules` pero SIN `tsconfig.json` y salida `['src/a.ts', 'tests/a.test.ts']`, no hay check
     de `tsc` y sí hay `bun test tests/a.test.ts`.
   - `src/__tests__/sandbox-node-modules.test.ts:~94`: el fixture de ese test debe tener `tsconfig.json` versionado
     (commiteado en el repo temporal, para que llegue al worktree) para que la expectativa del check de `tsc` siga
     valiendo. Los `git commit` de fixtures llevan identidad propia (`git -c user.name=… -c user.email=… commit`),
     como ya hace ese archivo.
   - Si `src/__tests__/agentic-engine.test.ts` u otro test espera el check de `tsc`, mismo ajuste de fixture.
   Las expectativas existentes no se debilitan: solo se añade el `tsconfig.json` al fixture.

## No tocar
- `src/run/sandbox.ts`, `src/run/harness.ts`, `PLAN.md`, `NEXT.md`, `scripts/`.
- `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json` y
  `docs/done/evidence/ERP.4/` tienen cambios sin commitear ajenos: no tocarlos.

## Verificación (la corre el ejecutor)
- `bunx tsc --noEmit`
- `bun test src/__tests__/checks.test.ts src/__tests__/sandbox-node-modules.test.ts src/__tests__/agentic-engine.test.ts`
- `grep -rn "tsc --noEmit" src/__tests__` y confirmar que ningún otro test queda esperando el check sin `tsconfig.json`
- `bunx biome check` sobre los archivos tocados
- Contraprueba: decir qué test nuevo falla con el código viejo.

NO correr `test:coverage` ni `ui:gate`, ni detenerse por el baseline. El candado de escritor `ocupado: claude …` es
el cerebro que delega: se puede editar. Hay un dashboard real en `localhost:4242`: no tocarlo. No commitear.
