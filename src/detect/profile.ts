import { join } from 'path'
import { readManifest } from './manifest.ts'
import { detectLanguages } from './languages.ts'
import { readConventions } from './conventions.ts'
import type { StackProfile } from '../generators/agents-md.ts'

export async function buildProfile(root: string): Promise<StackProfile> {
  const manifest = readManifest(root)
  const languages = await detectLanguages(root)
  const conventions = await readConventions(root)
  const commands: string[] = []
  try {
    const pkg = JSON.parse(await Bun.file(join(root, 'package.json')).text())
    const scripts = pkg.scripts ?? {}
    const interesting = ['dev', 'build', 'start', 'test', 'lint', 'format', 'migrate', 'seed']
    const pm = pkg.packageManager?.startsWith('bun') ? 'bun' : 'npm'
    for (const key of interesting) {
      if (scripts[key]) commands.push(`${pm} run ${key}`)
    }
  } catch { /* no package.json */ }
  return { manifest, languages, conventions, commands }
}
