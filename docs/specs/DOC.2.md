# DOC.2 — `docs/` solo con lo relevante

Pedido de Carlos 2026-10-14: en `docs/` hay demasiado texto; dejar solo lo relevante, comprimir, borrar lo que no
sirve. `docs/done/` (sprints y bloques) es la historia de OrchestOS: no se borra nada de ahí, solo se le añade.
Clasificación por contenido hecha por `leer` contra HEAD: `/tmp/doc1/docs-audit.log` (léela primero).

Prohibido: `git stash`, `git commit`, `git checkout`/`restore`, `prettier`. Escribes bajo el candado del cerebro
(`ocupado: claude …`). No corras `test:coverage`. Usa `git mv` / `git rm` para que la historia siga al archivo.

## Resultado esperado en `docs/` (raíz)
`agent-work-protocol.md` (comprimido), `security.md` (nuevo, fusionado), `SPEC.md` (doc de producto del modo
spec-driven, se queda), `sources-registry.yaml` (lo lee `scripts/check-sources-drift.ts`), `roadmaps/` (datos del
producto, no tocar), `specs/` (solo specs de ítems abiertos), `done/`. Nada más.

## Acciones
1. **`agent-work-protocol.md` — comprimir.** Lo leen `scripts/agent-preflight.ts` y `scripts/agent-governance.ts`
   (la ruta no cambia). ~70 % repite `AGENTS.md`. Dejar solo lo que no está en `AGENTS.md`/`CLAUDE.md`, y donde
   repita, una línea que apunte a la sección de `AGENTS.md`. No perder ninguna regla: si una regla solo vive aquí,
   se queda aquí.
2. **`security.md` — fusionar la política vigente** de `security-data-retention.md`, `security-filesystem-policy.md`,
   `security-migration-recovery.md`, `security-ssrf-policy.md` y el comando de `security-gate.md` en un solo archivo,
   una sección por tema, sin repetir. Verificar contra el código (`src/dashboard/ssrf.ts`, `src/db/retention.ts`,
   etc.) que lo que queda es verdad hoy; lo que ya no lo es se corrige o se quita. Luego `git rm` de esos 5.
3. **A `docs/done/security/` (histórico, `git mv`):** `security-db-query-audit.md`, `security-secrets-audit.md`,
   `security-manual-review.md`, `security-threat-model.md`.
4. **A `docs/done/design/` (diseños de features ya implementadas, `git mv`):** `diff-review-design.md`,
   `executor-engine-design.md`, `external-executor-design.md`, `graph-runner-design.md`, `ocr-chat-design.md`,
   `chat-task-detection-design.md`, `semantic-skill-selection-design.md`, `chat-web-fetch-design.md`, `E2E.md`.
5. **A `docs/done/ui/` (dirección de UI superada por UI.13–UI.26, `git mv`):** `dashboard-experience-direction.md`,
   `ui-aistudio-prompt.md`, `ui-reference-patterns.md`, `specs/UI.14-aistudio-prompt.md`.
6. **A `docs/done/` (`git mv`):** `memoria-poda-2026-09-11.md`, `audits/2026-09-10-block-s-review.md` (y quitar la
   carpeta `audits/` vacía).
7. **Borrar (`git rm`):** `propuesta-flujo-por-lote.md` (su propio texto dice que al aprobarse lo demás se borra; se
   aprobó 2026-09-23 y vive en las reglas), `sub-agents-flow.md` (duplicado y desactualizado frente a `AGENTS.md`),
   `screenshots/` (4 PNG sin ninguna referencia), y los specs de ítems cerrados o retirados: `specs/CI.2.B.md`,
   `specs/MR.1.a.md`, `specs/MR.1.d1.md`, `specs/UI.11.md`, `specs/UI.13.2d.md`, `specs/UI.13.2e.md`,
   `specs/UI.13.4c.md`. Antes de cada borrado: `git grep` del nombre; si algo vivo lo usa (no `docs/done/`), no
   borrar y reportar.
8. **Actualizar referencias** a todo archivo movido o borrado: comentarios en `src/**` y `scripts/**` (solo la ruta
   en el comentario), `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `PLAN.md`, `NEXT.md`, `README.md` y los propios docs.
   Los enlaces dentro de `docs/done/**` que apunten a un archivo movido también se corrigen. Comprobar al final:
   `git grep -n -E "docs/(security-[a-z-]+|[a-z-]+-design|E2E|ui-aistudio-prompt|ui-reference-patterns|dashboard-experience-direction|memoria-poda[^ ]*|propuesta-flujo-por-lote|sub-agents-flow|screenshots|audits)"`
   solo devuelve rutas nuevas válidas.

## Qué NO se toca
`docs/roadmaps/**`, `docs/specs/CI.18.md`, `docs/specs/CI.23.md`, `docs/specs/CTX-GUARD.md`, `docs/specs/DOC.2.md`,
el contenido de `docs/done/**` salvo enlaces, `IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`,
`.orchestos/**`. Ninguna lógica de código: solo rutas en comentarios.

## Verificación
`bun run typecheck`, `bun run lint` (formatear con `bunx biome format --write` lo tocado), `bun run plan:reconcile`,
`bun run agent:preflight -- --item DOC.2 --agent claude` (prueba que el preflight sigue leyendo el protocolo),
`bun run security:gate` si existe. Reporte final: árbol de `docs/` (sin `done/`) antes/después, líneas totales
antes/después de los archivos vivos, y qué regla del protocolo comprimido quedó solo ahí.
