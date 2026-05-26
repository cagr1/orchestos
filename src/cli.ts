#!/usr/bin/env bun
import { Command } from 'commander'
import { resolve, join } from 'path'
import { writeFileSync, existsSync } from 'fs'
import { readManifest } from './detect/manifest.ts'
import { detectLanguages } from './detect/languages.ts'
import { readConventions } from './detect/conventions.ts'
import { generateAgentsMd, type StackProfile } from './generators/agents-md.ts'
import { generateContextJson } from './generators/context-json.ts'
import { runMigrations } from './db/migrate.ts'
import { upsertProject, getProject, listProjects } from './db/projects.ts'
import { loadContext } from './context/load.ts'
import { loadSkill, listSkillFiles, getSkillPath, type SkillTarget } from './skills/registry.ts'
import { compileSkill } from './skills/compile.ts'

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

// ── skill ─────────────────────────────────────────────────────────────────────
const skill = program.command('skill').description('Manage and compile skills')

skill
  .command('add <id>')
  .description('Scaffold a new skill YAML file in skills/')
  .action((id: string) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
      console.error(`[skill] id must be kebab-case (e.g. fix-typescript-errors)`)
      process.exit(1)
    }
    const outPath = getSkillPath(id)
    if (existsSync(outPath)) {
      console.error(`[skill] Already exists: ${outPath}`)
      process.exit(1)
    }
    const scaffold = `id: ${id}
version: 1.0.0
name: ${id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
description: Describe what this skill does in one sentence (max 200 chars).
targets:
  - claude
  - cursor
  - openai
instructions: |
  1. Step one.
  2. Step two.
  3. Step three.
`
    writeFileSync(outPath, scaffold, 'utf-8')
    console.log(`[skill] Created: ${outPath}`)
  })

skill
  .command('list')
  .description('List all skills in skills/')
  .action(() => {
    const files = listSkillFiles()
    if (files.length === 0) {
      console.log('[skill] No skills found. Run: orchestos skill add <id>')
      return
    }
    for (const f of files) {
      try {
        const s = loadSkill(f)
        console.log(`  ${s.id.padEnd(32)} v${s.version.padEnd(8)} targets: ${s.targets.join(', ')}`)
      } catch (e: any) {
        console.log(`  ${f} — ⚠ ${e.message}`)
      }
    }
  })

skill
  .command('build')
  .description('Compile skills to dist/skills/<target>/')
  .option('--target <target>', 'Compile only to this target (claude | cursor | openai)')
  .option('--id <id>', 'Compile only this skill')
  .action((opts: { target?: string; id?: string }) => {
    const targetFilter = opts.target as SkillTarget | undefined
    if (targetFilter && !['claude', 'cursor', 'openai'].includes(targetFilter)) {
      console.error(`[skill] Invalid target "${targetFilter}". Valid: claude, cursor, openai`)
      process.exit(1)
    }

    const files = opts.id
      ? [getSkillPath(opts.id)]
      : listSkillFiles()

    if (files.length === 0) {
      console.log('[skill] No skills to compile.')
      return
    }

    let total = 0
    let errors = 0
    for (const f of files) {
      try {
        const s = loadSkill(f)
        const written = compileSkill(s, targetFilter ? [targetFilter] : undefined)
        for (const p of written) console.log(`  [ok] ${p}`)
        total += written.length
      } catch (e: any) {
        console.error(`  [err] ${f}: ${e.message}`)
        errors++
      }
    }
    console.log(`\n[skill] ${total} file(s) compiled, ${errors} error(s)`)
    if (errors > 0) process.exit(1)
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
