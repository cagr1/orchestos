# USO.50 — QA: "no verificado" honesto no es fallo

Ítem: PLAN.md USO.50. Rol: criterio. No commitear ni tocar PLAN.md.

## Caso real (verificado en `~/.orchestos/db.sqlite`, run `804fca61…`, tarea Agro `chat-88da5540`)
Criterio 1 ("al menos 5 referentes con … ficha/cantidad/carrito …") salió `pass:false`. La evidencia citada era:
"La página indexada no permitió confirmar el selector de cantidad en cada ficha; **no verificado**". El criterio 4
*exigía* "datos no verificados marcados". El ejecutor hizo lo correcto y la tarea se rechazó.

## Regla
Un criterio que pide hechos externos (sitios, precios, datos de terceros, comportamiento en vivo) se cumple si el
archivo lo trata: con el dato, o con una marca explícita de "no verificado" y su motivo. Eso es `unverified`, no
fallo. Fallar = falta el contenido, es placeholder, o la evidencia contradice el criterio. `unverified` nunca aplica a
lo que se puede comprobar en los propios archivos (estructura, tabla, idioma, código).

## Cambios
1. `src/run/qa.ts`
   - `QACriterionResult` (línea 15): campo opcional `unverified?: boolean`.
   - Prompt con criterios (líneas 120-132): esquema JSON con `"unverified": true | false` opcional por criterio y la
     regla de arriba, en inglés como el resto. `unverified: true` exige `pass: true` y evidencia literal del pasaje
     donde el archivo marca el dato como no verificado.
   - Parser (líneas 254-278): `unverified` solo se conserva si `pass` queda `true` (evidencia real incluida). El
     veredicto sigue: falla si algún criterio queda `pass:false`. Un criterio `unverified` válido cuenta como pass.
   - Si hay ≥1 `unverified` y el veredicto es pass, `reason` termina con ` (N unverified)`.
2. Mostrarlo (sin CSS nuevo):
   - `src/dashboard/app/src/api/runs.ts:26` tipo + `mapRunRow` (línea 61): si `c.unverified`, rationale empieza con
     `Unverified — `.
   - `src/dashboard/handlers/task-report.ts`: en el headline de tarea hecha y verificada (`verifiedDone`, ~línea 101),
     sumar ` · N unverified` cuando los criterios del run tengan `unverified`. Leer de lo que ya expone
     `runRecordToRow` (grep para confirmar el campo; si no trae criterios, parsear `qa_criteria_json` del run).
   - `src/dashboard/types.ts` si el tipo de criterios vive ahí.

## Tests (en los archivos de test existentes de qa y task-report; `grep -rln "runQA\|parseQA" src --include='*.test.ts'`)
- Criterio con `pass:true, unverified:true` y excerpt literal → veredicto pass, reason con `(1 unverified)`.
- `pass:false, unverified:true` → sigue fallando (unverified no salva un fallo).
- `unverified:true` con excerpt inexistente en el archivo → fail.
- El headline del reporte suma `· 1 unverified`.

## No tocar
`harness.ts` (persiste `qa.criteria` tal cual, línea 987/1089), `MAX_RETRIES`, el prompt sin criterios, CSS.

## Verificación
`bunx tsc --noEmit`, `bun run lint`, los tests de qa, runs y task-report.
