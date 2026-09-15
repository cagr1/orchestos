# Bloque AT — Aterrizar: que se pueda correr

<a id="bloque-at-at-12"></a>
### AT.12 — El tope absoluto de contexto deja de cortar la sesión

Ejecutado por: luna · Spec: docs/specs/AT.12.md

  `.claude/hooks/context-budget.js` ya no llama `process.exit(2)` cuando
  `absoluteLevel === 'block'`. Conserva ese nivel como dato y lo incorpora al aviso recurrente:
  tanto el primer turno como los siguientes llegan a `printWarning()` y terminan con éxito. Los
  umbrales y la clasificación de `scripts/context-budget.ts` no cambiaron.

  Verificación independiente del cerebro: `bunx tsc --noEmit`; `bun test
  scripts/context-budget.test.ts scripts/context-budget-hook.test.ts tests/hooks/context-budget.test.ts`
  (**14 pass / 0 fail**); búsqueda de `process.exit(2)`, el mensaje de cierre forzado y el tope
  absoluto en el hook (**sin coincidencias**); `git diff --check` limpio. La traza manual del
  flujo confirma que `absoluteLevel: 'block'` pasa el guard, actualiza el handoff solo en el primer
  turno y siempre imprime el aviso, sin ruta de salida no cero.

<a id="bloque-at-at-9"></a>
### AT.9 — Cualquier CLI en el chat, sin bloqueo por frontera de lectura

Ejecutado por: luna · Spec: docs/specs/AT.9.md

  El chat de proyecto ya no rechaza un CLI cuya frontera declarada de lectura sea `none`. La
  sesión se crea y el turno se ejecuta; el backend devuelve la razón real como
  `readBoundaryWarning` y la UI la muestra una sola vez por sesión. Las sesiones generales no
  reciben el aviso. Codex conserva `--sandbox read-only` para escrituras y declara honestamente
  que no limita la lectura al proyecto; OpenCode tampoco gana una frontera inexistente.

  Codex añade `--skip-git-repo-check` para funcionar desde el directorio temporal del chat general.
  Su home aislado enlaza el `auth.json` ya existente del usuario sin copiar el secreto, y no
  reemplaza un destino regular preexistente. Esto resuelve autenticación, pero no crea una frontera
  de lectura.

  Gate en vivo: Playwright con Chromium contra el dashboard real,
  `docs/done/evidence/AT.9-live.json` — una sesión nueva de proyecto con Codex respondió
  `AT9_PROJECT_OK`, persistió mensajes `user`/`assistant` y mostró exactamente una vez el aviso
  `Codex no limita la lectura a este proyecto`; una sesión general respondió `AT9_GENERAL_OK`,
  persistió ambos mensajes y no incluyó aviso. El servidor se detuvo al terminar.

  Verificación independiente del cerebro: `bunx tsc --noEmit`; cinco archivos de tests relevantes,
  **44 pass / 0 fail**; `bun run security:gate`, **1428 pass / 0 fail**, auditoría sin
  vulnerabilidades `high+`. La primera implementación de Luna fue devuelta por cuatro omisiones
  detectadas en review (helper muerto, replay durable sin aviso, fixture de auth incompleto y regex
  obsoleta); Luna las corrigió antes de aceptar el cierre.

  `bun run lint` conserva un único error ajeno a AT.9: formato en
  `src/__tests__/migration.test.ts:322`, ya versionado y sin cambios en este ítem. Quedó registrado
  como AT.9.1; los doce archivos `src/` de AT.9 sí pasan el formatter.

  Este cierre reemplaza la decisión de producto de AT.3/H.9.2 que bloqueaba con HTTP 400, sin borrar
  su historial ni relajar el mecanismo `--restricted` de Claude. H.9.4 sigue siendo el gate de la
  frontera efectiva para los CLIs que sí la declaran; para los que declaran `none`, verifica el
  aviso honesto en vez de prometer aislamiento.
