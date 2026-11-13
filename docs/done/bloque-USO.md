# Cerrados de USO — fallos vistos en el uso real (etapa 2, desde 2026-11-13)

Movidos desde `PLAN.md` el 2026-11-13.

- [x] **USO.1 — Tres flujos de UI rojos reproducidos antes del uso real.** Gate en vivo: navegador Playwright, `chat-settings`, `project-tabs` y `providers` verdes con `gate:evidence` (labels `USO.1-<flujo>`), diagnóstico en `docs/done/evidence/USO.1-live.json`.
  `providers`: producto roto, ocultar un CLI no mandaba el proyecto (`api/settings.ts:285`), test en `clis.test.ts`.
  `chat-settings`: gate desfasado, 5 filas tras SES.1b y Enter en el diálogo activa Cancel (foco seguro).
  `project-tabs`: gate desfasado, `dist/` sin ignorar bloqueaba el sandbox del fixture. Los otros 9 rojos de la
  nocturna inválida pasaron al re-correrlos con la máquina despierta.
  Ejecutado por: gpt-6.1-sol (criterio) · Spec: docs/specs/USO.1.md
  Fuera de scope declarado: `scripts/ui-gate/flows/*.mjs` (gates desfasados) y `docs/done/evidence/USO.1-live.json`.

- [x] **USO.2 — El dashboard abre sin token en la URL.** Gate en vivo: navegador Playwright en `localhost` sin `#t=`, Chat renderizado y 16 llamadas `/api` sin 401; `smoke` 7/7 y `dev-terminal` 16/16, `docs/done/evidence/USO.2-live.json`. (reportado por Carlos 2026-11-13, GO al arreglo)
  AUD.7 (`c9c0fac6`) exige el token en `/api/*` y la UI solo lo obtenía de `#t=`: abrir `localhost:4242` a mano,
  desde un marcador u otro navegador mostraba "Dashboard token required". El servidor inyecta el token en el HTML
  (mismo origen + chequeo de Host), la pantalla se borra y `orchestos dashboard` abre el navegador.
  Ejecutado por: gpt-6-luna (mecanico) · revisión qa: sin defectos · Spec: docs/specs/USO.2.md
