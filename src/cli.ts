#!/usr/bin/env bun
import { Command } from 'commander'
import { resolve, join } from 'path'
import { writeFileSync } from 'fs'
import { readManifest } from './detect/manifest.ts'
import { detectLanguages } from './detect/languages.ts'
import { readConventions } from './detect/conventions.ts'
import { generateAgentsMd, type StackProfile } from './generators/agents-md.ts'
import { generateContextJson } from './generators/context-json.ts'
import { runMigrations } from './db/migrate.ts'
import { upsertProject, getProject, listProjects } from './db/projects.ts'
import { loadContext } from './context/load.ts'

// Run migrations on every boot (idempotent)
runMigrations()

const program = new Command()

program
  .name('orchestos')
  .description('Contract-first coding runner — bounded local patches with evidence')
  .version('0.1.0')

// ── detect ────────────────────────────────────────────────────────────────────
program
  .command('detect [path]')
  .description('Detect stack and generate AGENTS.md + context.json (dry-run, no DB)')
  .action(async (targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const t0 = performance.now()
    const profile = await buildProfile(root)
    const agentsMd = generateAgentsMd(profile)
    const contextJson = generateContextJson(profile)
    writeFileSync(join(root, 'AGENTS.md'), agentsMd, 'utf-8')
    writeFileSync(join(root, 'context.json'), JSON.stringify(contextJson, null, 2), 'utf-8')
    const elapsed = Math.round(performance.now() - t0)
    console.log(`[detect] ${profile.manifest.name} (${profile.manifest.runtime} / ${profile.manifest.framework}) in ${elapsed}ms`)
    console.log(`  → AGENTS.md`)
    console.log(`  → context.json`)
  })

// ── init ──────────────────────────────────────────────────────────────────────
program
  .command('init [path]')
  .description('Detect stack, write AGENTS.md + context.json, and save to DB')
  .action(async (targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const t0 = performance.now()
    const profile = await buildProfile(root)
    const agentsMd = generateAgentsMd(profile)
    const contextJson = generateContextJson(profile)
    writeFileSync(join(root, 'AGENTS.md'), agentsMd, 'utf-8')
    writeFileSync(join(root, 'context.json'), JSON.stringify(contextJson, null, 2), 'utf-8')
    upsertProject(root, profile, agentsMd)
    const elapsed = Math.round(performance.now() - t0)
    console.log(`[init] ${profile.manifest.name} saved in ${elapsed}ms`)
    console.log(`  → AGENTS.md`)
    console.log(`  → context.json`)
    console.log(`  → ~/.orchestos/db.sqlite`)
  })

// ── context ───────────────────────────────────────────────────────────────────
const ctx = program.command('context').description('Manage saved project context')

ctx
  .command('show [path]')
  .description('Print saved AGENTS.md from DB')
  .action((targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const content = loadContext(root)
    if (!content) {
      console.error(`[context] No saved context for ${root}. Run: orchestos init`)
      process.exit(1)
    }
    console.log(content)
  })

ctx
  .command('update [path]')
  .description('Re-detect and update saved context in DB')
  .action(async (targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const t0 = performance.now()
    const profile = await buildProfile(root)
    const agentsMd = generateAgentsMd(profile)
    const contextJson = generateContextJson(profile)
    writeFileSync(join(root, 'AGENTS.md'), agentsMd, 'utf-8')
    writeFileSync(join(root, 'context.json'), JSON.stringify(contextJson, null, 2), 'utf-8')
    upsertProject(root, profile, agentsMd)
    const elapsed = Math.round(performance.now() - t0)
    console.log(`[context] Updated ${profile.manifest.name} in ${elapsed}ms`)
  })

ctx
  .command('list')
  .description('List all saved projects')
  .action(() => {
    const rows = listProjects()
    if (rows.length === 0) {
      console.log('[context] No projects saved yet. Run: orchestos init <path>')
      return
    }
    for (const row of rows) {
      const p = JSON.parse(row.stack_profile) as StackProfile
      console.log(`  ${p.manifest.name.padEnd(24)} ${p.manifest.runtime}/${p.manifest.framework.padEnd(12)} ${row.path}`)
    }
  })

program.parse()

// ── helpers ───────────────────────────────────────────────────────────────────
async function buildProfile(root: string): Promise<StackProfile> {
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
