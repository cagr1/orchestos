#!/usr/bin/env bun
/**
 * Build del bundle de UI (UI.0, Mes 30).
 *
 * `src/dashboard/public-src/**` (React + TS + Tailwind) → `src/dashboard/public/dist/`.
 *
 * El destino está DENTRO de `src/dashboard/public/`, que es el `STATIC_DIR` real
 * (`src/dashboard/types.ts:437`) — no la carpeta `public/` de la raíz, que no existe;
 * el plan del Mes 30 decía `public/dist/` y la ruta real se corrigió al implementar.
 * `serveStatic()` sirve cualquier ruta bajo ese árbol, así que no hace falta tocar
 * nada de `src/dashboard/*.ts` para servirlo.
 *
 * El bundle NO se commitea (decisión de Carlos, 2026-08-22): versionar un artefacto
 * generado es el patrón que ya explotó con `runs-summary.json`. Por eso `install.sh`,
 * `install.ps1` e `install.bat` corren `build:ui` — sin eso, un clone fresco sirve un
 * dashboard sin islas.
 *
 * Uso: `bun run build:ui` · `bun run build:ui -- --watch`
 */
import tailwind from 'bun-plugin-tailwind'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const ENTRY = join(ROOT, 'src/dashboard/public-src/ui.tsx')
const OUTDIR = join(ROOT, 'src/dashboard/public/dist')

const watch = process.argv.includes('--watch')

async function build(): Promise<boolean> {
  const started = Date.now()
  const result = await Bun.build({
    entrypoints: [ENTRY],
    outdir: OUTDIR,
    target: 'browser',
    // El dashboard es local y de un solo usuario: `development` mantiene los mensajes
    // de error legibles de React, que es lo que hace falta al migrar 11 pantallas.
    // Cambiar a 'production' cuando la migración esté cerrada (UI.5).
    minify: false,
    sourcemap: 'linked',
    // `[name].[ext]` y no `ui.js`: el `import './styles/ui.css'` del entry emite
    // TAMBIÉN un artefacto de entrada (el CSS), así que un nombre fijo hace colisionar
    // los dos en la misma ruta. Con `[name].[ext]` salen `ui.js` y `ui.css`.
    naming: { entry: '[name].[ext]', chunk: '[name]-[hash].[ext]', asset: '[name].[ext]' },
    plugins: [tailwind],
  })

  if (!result.success) {
    for (const log of result.logs) console.error(log)
    return false
  }
  const files = result.outputs.map((o) => o.path.replace(`${OUTDIR}/`, '')).join(', ')
  console.log(`✓ build:ui → src/dashboard/public/dist/ (${files}) en ${Date.now() - started}ms`)
  return true
}

await rm(OUTDIR, { recursive: true, force: true })
const ok = await build()
if (!watch) process.exit(ok ? 0 : 1)

console.log('… watch activo sobre src/dashboard/public-src/')
const watcher = (await import('node:fs')).watch(
  join(ROOT, 'src/dashboard/public-src'),
  { recursive: true },
  () => { void build() },
)
process.on('SIGINT', () => { watcher.close(); process.exit(0) })
