#!/usr/bin/env bun
import { Command } from 'commander'
import { resolve, join } from 'path'
import { writeFileSync } from 'fs'
import { readManifest } from './detect/manifest.ts'
import { detectLanguages } from './detect/languages.ts'
import { readConventions } from './detect/conventions.ts'
import { generateAgentsMd, type StackProfile } from './generators/agents-md.ts'
import { generateContextJson } from './generators/context-json.ts'

const program = new Command()

program
  .name('orchestos')
  .description('Contract-first coding runner — bounded local patches with evidence')
  .version('0.1.0')

program
  .command('detect [path]')
  .description('Detect stack and generate AGENTS.md + context.json')
  .action(async (targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const t0 = performance.now()

    try {
      const manifest = readManifest(root)
      const languages = await detectLanguages(root)
      const conventions = await readConventions(root)

      // Extract useful commands from package.json scripts
      const commands: string[] = []
      try {
        const pkg = JSON.parse(
          (await Bun.file(join(root, 'package.json')).text())
        )
        const scripts = pkg.scripts ?? {}
        const interesting = ['dev', 'build', 'start', 'test', 'lint', 'format', 'migrate', 'seed']
        for (const key of interesting) {
          if (scripts[key]) commands.push(`${pkg.packageManager === 'bun' ? 'bun' : 'npm'} run ${key}`)
        }
      } catch { /* no package.json or no scripts */ }

      const profile: StackProfile = { manifest, languages, conventions, commands }

      const agentsMd = generateAgentsMd(profile)
      const contextJson = generateContextJson(profile)

      writeFileSync(join(root, 'AGENTS.md'), agentsMd, 'utf-8')
      writeFileSync(join(root, 'context.json'), JSON.stringify(contextJson, null, 2), 'utf-8')

      const elapsed = Math.round(performance.now() - t0)
      console.log(`[detect] ${manifest.name} (${manifest.runtime} / ${manifest.framework}) in ${elapsed}ms`)
      console.log(`  → AGENTS.md`)
      console.log(`  → context.json`)
    } catch (err: any) {
      console.error(`[detect] Error: ${err.message}`)
      process.exit(1)
    }
  })

program.parse()
