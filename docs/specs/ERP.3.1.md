# ERP.3.1 — hermano de ERP.3: Settings pide /api/orchestration de un proyecto purgado

Eres el EJECUTOR. No invoques `codex exec` ni delegues. No commitees. No toques `IDEAS.md` ni `orchestos.config.yaml`.

Evidencia (pre-push, dashboard real): `bun run ui:gate project-delete` →
`FAIL project-delete: 0 console errors: HTTP 404: http://127.0.0.1:…/api/orchestration`.
`withDashboardProject` (`src/dashboard/server.ts:528`) responde 404 porque el proyecto ya se purgó; el `useEffect` de
orquestación en `src/dashboard/app/src/components/settings/OrchestSettingsView.tsx` (depende de
`isProjectSection, activeProjectId`) sigue disparando para ese proyecto. Las demás lecturas por proyecto de esa vista
no lo hacen: busca cómo se protegen (purga/salida de Settings, proyecto ausente de la lista) y aplica **el mismo**
patrón a la orquestación (también a los guardados). No silencies el 404 en el back ni en el flujo de prueba.

Gate: tsc, `bunx biome check . --diagnostic-level=error`, `bun test` completo. El cerebro corre
`ui:gate project-delete orchestration` (no puedes en tu sandbox).
