# ERP.3.2 — Orquestación solo en la pestaña Tasks

Eres el EJECUTOR. No invoques `codex exec` ni delegues. No commitees. No toques `IDEAS.md` ni `orchestos.config.yaml`.

`src/dashboard/app/src/components/settings/OrchestSettingsView.tsx:2258`: `{orchestration && (` se pinta en todas las
pestañas del proyecto; en Plan suma un checkbox y `ui:gate plan-doc` falla ("three read-only checkboxes").
Cambio: condicionar a `activeProjectTab === 'tasks' && orchestration`. Nada más.
Gate: tsc, biome, `bun test` completo. El cerebro corre ui:gate.
