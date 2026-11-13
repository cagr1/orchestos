#!/usr/bin/env bun
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwind from 'bun-plugin-tailwind'
import { generateManifest } from 'material-icon-theme'

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
    // USO.3: sin esto sale React de desarrollo y StrictMode duplica cada carga de la UI servida.
    define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  })

  if (!result.success) {
    for (const log of result.logs) console.error(log)
    return false
  }
  const source = generateManifest()
  const iconName = (id: string | undefined): string => {
    if (!id) throw new Error('Missing default file icon')
    const definition = source.iconDefinitions?.[id]
    if (!definition) throw new Error(`Missing file icon definition: ${id}`)
    return basename(definition.iconPath)
  }
  const associations = (entries: Record<string, string> = {}) =>
    Object.fromEntries(Object.entries(entries).map(([name, id]) => [name, iconName(id)]))
  const manifest = {
    file: iconName(source.file),
    folder: iconName(source.folder),
    folderExpanded: iconName(source.folderExpanded),
    fileExtensions: associations(source.fileExtensions),
    fileNames: associations(source.fileNames),
    folderNames: associations(source.folderNames),
    folderNamesExpanded: associations(source.folderNamesExpanded),
  }
  const iconsDir = join(OUTDIR, 'file-icons')
  const themeDir = dirname(fileURLToPath(import.meta.resolve('material-icon-theme/package.json')))
  await mkdir(iconsDir, { recursive: true })
  const icons = new Set([
    manifest.file,
    manifest.folder,
    manifest.folderExpanded,
    ...Object.values(manifest.fileExtensions),
    ...Object.values(manifest.fileNames),
    ...Object.values(manifest.folderNames),
    ...Object.values(manifest.folderNamesExpanded),
  ])
  await Promise.all(
    [...icons].map((name) => copyFile(join(themeDir, 'icons', name), join(iconsDir, name))),
  )
  await copyFile(join(themeDir, 'LICENSE'), join(iconsDir, 'LICENSE'))
  await Bun.write(join(iconsDir, 'manifest.json'), JSON.stringify(manifest))
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
