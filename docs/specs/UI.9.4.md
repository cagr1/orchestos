# UI.9.4 — Agregar proyecto desde la UI

Spec de ejecución para el ítem UI.9.4. El dashboard añade `+` junto a Projects; el servidor abre
el selector nativo macOS mediante `osascript choose folder` con argv fijo, registra la carpeta en
la DB sin inicializarla ni indexarla, y devuelve la fila pública del proyecto. La UI refresca el
árbol, selecciona el proyecto creado y trata cancelación/error sin mutar la lista.

Alcance: `src/cli.ts`, `src/projects/ensure.ts`, handlers y router del dashboard, Sidebar, i18n,
estilos y `src/dashboard/__tests__/projects-choose.test.ts`.

Verificación: typecheck, test específico, build UI, cobertura completa y gate real en navegador
con selección manual desde el diálogo nativo. UI.9.1–UI.9.5 quedan fuera.
