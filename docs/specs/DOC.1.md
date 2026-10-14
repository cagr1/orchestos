# DOC.1 — La documentación dice lo que de verdad está hecho

Pedido de Carlos 2026-10-14: arreglar la documentación de todo lo realizado hasta ahora. Solo documentación: no se
toca código.

## Archivos que SÍ se editan
`PLAN.md`, `NEXT.md`, `CONTEXT.md`, `DONE.md`, `AGENTS.md` (solo § Lecciones), `docs/done/**`.

## Archivos que NO se tocan
`IDEAS.md`, `orchestos.config.yaml`, `runs-summary.json`, `.orchestos/feature-status.json` (cambios ajenos sin
commitear), `src/**`, `scripts/**`, `app/**`, `CLAUDE.md`, la sección DOC.1/LIMP.1 de PLAN.md.
Prohibido: `git stash`, `git commit`, `git checkout`/`restore`, `prettier`. El candado de escritor `ocupado: claude …`
es el cerebro que te delega: escribes bajo su candado, no te detengas por eso. No corras `test:coverage`.

## Qué corregir (contrastar cada punto con `git log` y el código antes de cambiarlo)
1. **Rumbo desactualizado** (`PLAN.md:14-37`). Dice Fase 1 CERRADA y Fase 2 = R.8.1→…→ERP.4→UI.8.6, pero el
   2026-10-13 Carlos dio GO a UI.24, UI.25 y UI.26 (están dentro de `## Fase 2`, `PLAN.md:749-1062`) y el orden
   decidido está en `NEXT.md:68` ("UI.24 primero, ERP.4 al final"). Reescribir el Rumbo con el orden real y vigente,
   citando la fecha de cada decisión. R.8.1–R.8.6 están cerrados: decirlo.
2. **Padres abiertos con hijos cerrados.** R.8 (`PLAN.md:495`) sigue `[ ]` con R.8.1–R.8.6 `[x]`. Leer su criterio
   de aceptación: si lo que falta es lo que cubre ERP.4 ("contrastar con una tarea real"), dejarlo abierto con una
   línea que diga que cierra con ERP.4; si no falta nada, cerrarlo (`[x]` + fecha + `Sin delegación:`). Revisar
   igual todo padre `[ ]` del archivo.
3. **AT.13** (`PLAN.md:1086`) está `[ ]` en PLAN.md, pero `docs/done/bloque-AT.md:215-218` lo da por cerrado el
   2026-09-28 (con un tramo pendiente). Dejar una sola verdad: qué puntos de AT.13 siguen abiertos (1-8), cuáles se
   resolvieron y con qué commit. Verificar en el código cada punto que declares resuelto.
4. **ERP.4.14**: NEXT.md dice que pasó a UI.24.6; PLAN.md lo sigue listando aparte. Que ambos digan lo mismo.
5. **NEXT.md con varios presentes.** Hoy conviven el handoff vigente y secciones históricas ("Orden vigente" del
   10-11, "CI.14 cerrado — histórico", "R.8.1 cerrado — histórico", "R.8 corto", "H.9.4", …). Regla: un solo
   handoff actual. NEXT.md queda con: estado actual, orden de lo que sigue, decisiones de Carlos vigentes, pendientes
   sin ítem (una sola lista, sin duplicados, quitando los que ya tienen ítem o se resolvieron — verificar), datos del
   entorno vigentes. Lo histórico se mueve a `docs/done/sprint-30.md` § Apéndice (donde ya viven los handoffs
   viejos) marcado como histórico. Las lecciones durables que no estén ya en `AGENTS.md` § Lecciones se mueven ahí
   (sin duplicar; grepear antes). No se pierde información: todo lo que sale de NEXT.md queda en otro archivo.
6. **CONTEXT.md**: la sección de estado debe coincidir con lo hecho hasta hoy (UI.24–UI.26, ERP.4, CI.24, CI.12).
7. **Ítems `[x]` en PLAN.md cuyo bloque ya cerró**: archivarlos en `docs/done/` siguiendo la convención del
   saneamiento del 2026-10-05 (`git log --grep sanea -i` / commit que movió cerrados a `docs/done/`). No archivar
   ítems de bloques todavía abiertos (UI.24, UI.25, UI.26, ERP.4). Mantener los enlaces.
8. Enlaces rotos a `docs/specs/*.md` o `docs/done/*` desde PLAN.md/NEXT.md/CONTEXT.md: corregirlos.

## Cómo se verifica
- `bun run plan:reconcile` sin errores y `bun run next` lista los mismos ítems abiertos que antes salvo los que
  cerraste a propósito (reportar cuáles y por qué).
- `bun run lint` verde.
- `git diff --stat` solo muestra archivos de la lista "SÍ se editan".
- Reporte final: por cada punto 1-8, qué cambiaste y la evidencia (`archivo:línea`, SHA).
