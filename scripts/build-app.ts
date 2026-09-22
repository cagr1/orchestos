#!/usr/bin/env bun
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import tailwind from 'bun-plugin-tailwind'

const ROOT = join(import.meta.dir, '..')
const ENTRY = join(ROOT, 'src/dashboard/app/src/main.tsx')
const OUTDIR = join(ROOT, 'src/dashboard/app/dist')

const watch = process.argv.includes('--watch')

async function build(): Promise<boolean> {
  const started = Date.now()
  const result = await Bun.build({
    entrypoints: [ENTRY],
    outdir: OUTDIR,
    target: 'browser',
    minify: true,
    sourcemap: 'linked',
    publicPath: '/app/dist/',
    loader: { '.woff': 'file', '.woff2': 'file' },
    naming: { entry: '[name].[ext]', chunk: '[name]-[hash].[ext]', asset: '[name].[ext]' },
    plugins: [tailwind],
  })

  if (!result.success) {
    for (const log of result.logs) console.error(log)
    return false
  }
  const files = result.outputs.map((o) => o.path.replace(`${OUTDIR}/`, '')).join(', ')
  console.log(`✓ build:app → src/dashboard/app/dist/ (${files}) en ${Date.now() - started}ms`)
  return true
}

await rm(OUTDIR, { recursive: true, force: true })
const ok = await build()
if (!watch) process.exit(ok ? 0 : 1)

console.log('… watch activo sobre src/dashboard/app/src/')
const watcher = (await import('node:fs')).watch(
  join(ROOT, 'src/dashboard/app/src'),
  { recursive: true },
  () => {
    void build()
  },
)
process.on('SIGINT', () => {
  watcher.close()
  process.exit(0)
})
