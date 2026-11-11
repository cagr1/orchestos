# AUD.20 — correcciones tras la revisión qa

Sobre el diff sin commitear de AUD.20 (`docs/specs/AUD.20.md`). Arranque:
`bun run agent:preflight -- --item AUD.20 --agent codex`. No editar `PLAN.md`/`NEXT.md`. No commitear.
Cada punto con un test que falle antes del cambio.

1. **`src/run/contract.ts` (`enforceContract`) — temporales propios.** Nombre del temporal con
   `randomUUID()` (`node:crypto`) en vez de `pid-index`, y marcar cada entrada de `staged` como `created: true`
   solo después de que `writeFileSync(..., { flag: 'wx' })` tuvo éxito; el `finally` borra solo los `created`.
   Test: un archivo preexistente con forma de temporal ajeno sigue existiendo tras un fallo.

2. **`src/run/contract.ts` — rollback que no se interrumpe.** Cada restauración en su propio try/catch; se intentan
   todas. Se relanza el error original; si hubo fallos de restauración, se relanza
   `new Error(<mensaje original> + ' (rollback incompleto: <rutas>)', { cause: original })`. Test con fallo
   inyectado (seguir el mecanismo que ya use `src/__tests__/contract.test.ts`; si no hay, el mismo truco de
   directorio/permisos) donde la restauración de uno falla: los demás quedan restaurados y el mensaje contiene el
   error original.

3. **`src/run/contract.ts` y `src/dashboard/handlers/config.ts` — conservar permisos.** Si el destino existe, antes
   del rename `chmodSync(temporal, statSync(destino).mode & 0o7777)`. Test: destino `0755` en el contrato y `0600`
   en la config conservan su modo.

4. **`src/spec/archive.ts` — versiones sin ambigüedad.** La versión va con un separador que un id no puede contener
   (`~`, fuera de `SPEC_ID_RE` en `src/spec/store.ts`): `YYYY-MM-DD-<id>~2.md`. El patrón de `deleteArchivedSpec`
   pasa a `(~\d+)?`. Comprobar con grep que nada más parsea esos nombres (`listSpecs` lee el id del frontmatter).
   Test: archivar `foo` y `foo.2`; borrar `foo` deja el de `foo.2`.

5. **`src/dashboard/http.ts:112-116` (`validateTaskId`) — rechazar `..`.** Añadir `|| t.includes('..')` para que
   coincida con `specPath`. Test: `POST /api/specs/foo..bar` (o `validateTaskId('foo..bar')`) → 400/null, no 500.

## Verificación

`bunx tsc --noEmit`, `bun run lint`, `bun run test:coverage` en verde. Informe por punto: archivo:línea y test.
