# Bloque CFG — cerrados

## Archivado 2026-11-03 desde PLAN.md (DOC.5)

<a id="bloque-cfg-seccion-abiertos---fiabilidad-de-los-gates-y-doc"></a>
### Abiertos — fiabilidad de los gates y documentación

- [x] **CFG.1 — 🔍 `orchestos.config.yaml` tiene bloques muertos que confunden.** Cerrado 2026-10-23. Clasificado con
  lectores: `models:` era solo migración legacy con los 4 roles asignados → fuera del YAML (la migración de
  `load.ts` queda para proyectos viejos); `agent`, `agentic`, `apiMode`, `external` tienen lectores vivos y se quedan.
  Settings ya no recrea `models:` en un YAML que no lo tiene. Ejecutor: 2025/0 en `test:coverage`.
  Settings con YAML sin `models:` muestra los 4 roles; un PUT con la clave legacy no lo recrea.
  Gate en vivo: navegador real (Playwright, Chrome), `docs/done/evidence/CFG.1-live.json`
  Ejecutado por: codex gpt-6.1-sol (criterio), revisión Opus · Spec: docs/specs/CFG.1.md
