# AUD.2 — `runs-summary.json` sale del producto: archivos derivados por configuración

GO de Carlos: 2026-11-10. Rol: `mecanico`. Revisión: `qa`. Después de AUD.1 (tocan `sandbox.ts`). Citas verificadas
por lectura el 2026-11-10.

## Problema

El producto trata un nombre de archivo de este repo como caso especial en cualquier proyecto del usuario:

- `src/run/sandbox-policy.ts:94` — `git checkout -- runs-summary.json` al resolver el sandbox.
- `src/run/sandbox.ts:229` — el mismo descarte antes del merge.
- `sandbox-policy.ts:50` — lo filtra de `listDirtyFiles`, también anidado (`endsWith('/runs-summary.json')`).
- `sandbox-policy.ts:99` — lo filtra del chequeo de "repo sucio".

En un proyecto ajeno con un archivo homónimo, el producto descarta cambios sin commitear del usuario. El motivo
original es legítimo solo aquí: el pre-commit lo regenera con un timestamp (`scripts/pre-commit.sh:112-114`).

## Decisión (cerrada)

- Nuevo campo opcional en `OrcheConfig` (`src/config/schema.ts`): `sandbox?: { derivedFiles?: string[] }`.
  Por defecto, lista vacía: ningún proyecto recibe descarte alguno si no lo declara.
- Nueva función en `sandbox-policy.ts`: `derivedFilesFor(projectRoot): string[]`. Lee
  `loadOrcheConfig(projectRoot)` (`src/config/load.ts:42`), normaliza con `normalizeRelPath` y descarta entradas
  absolutas o con `..`. Coincidencia exacta de ruta relativa; se elimina la variante anidada.
- Los cuatro sitios de arriba usan esa lista en lugar del literal. Con lista vacía no se ejecuta ningún `checkout`.
- `orchestos.config.yaml` de este repo declara `sandbox: { derivedFiles: [runs-summary.json] }`: aquí no cambia nada.
- Los comentarios históricos de `sandbox-policy.ts:74-93` y `sandbox.ts:218-225` se conservan, ajustando el nombre
  literal a "los archivos derivados declarados".

## No tocar

- `scripts/pre-commit.sh` ni `scripts/export-runs-summary.ts`.
- La UI: no se añade control en Settings (un campo de yaml basta para un caso que hoy solo tiene este repo).
- La firma pública de `listDirtyFiles` y `resolveSandboxMode`.

## Verificación

Tests con repo git temporal e identidad propia:

1. Proyecto sin `sandbox.derivedFiles`, con `runs-summary.json` tracked y modificado → tras `resolveSandboxMode` el
   cambio sigue ahí, y `listDirtyFiles` lo lista.
2. Proyecto que lo declara → se descarta y no aparece como sucio (comportamiento actual).
3. Entrada `../x` o absoluta en la lista → ignorada.
4. `grep -rn "runs-summary" src --include='*.ts'` fuera de tests y comentarios: 0 coincidencias.

Gates: `bunx tsc --noEmit`, `bun run lint`, `bun run test:coverage`.

## No verificado al escribir el spec

- Que `loadOrcheConfig(projectPath)` lea el `orchestos.config.yaml` del proyecto y no solo el de `~/.orchestos`. Si no
  lo lee, parar y reportar: la decisión de dónde vive el campo cambia.
- Que `loadOrcheConfig` sea barato de llamar en los cuatro sitios; si no lo es, leer una vez y pasar la lista.
