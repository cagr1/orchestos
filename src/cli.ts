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
import { classifyTask } from './router/classify.ts'
import { resolveModel } from './router/models.ts'
import { calcCost } from './router/pricing.ts'
import { chat } from './providers/openrouter.ts'
import { parseLLMResponse, enforceContract, snapshotHashes } from './run/contract.ts'
import { insertRun } from './db/runs.ts'
import { readFileSync } from 'fs'

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

// ── run ───────────────────────────────────────────────────────────────────────
program
  .command('run')
  .description('Execute a task with contract enforcement — only declared outputs are written')
  .requiredOption('--task <description>', 'What to do (natural language)')
  .requiredOption('--output <paths>', 'Comma-separated list of files the LLM is allowed to write (e.g. src/foo.ts,src/bar.ts)')
  .option('--skill <id>', 'Skill to inject as guidelines')
  .option('--file <paths>', 'Comma-separated input files to read and include as context')
  .option('--project <path>', 'Project root (defaults to cwd)')
  .option('--dry-run', 'Build the prompt and print it without calling the LLM')
  .action(async (opts: {
    task: string
    output: string
    skill?: string
    file?: string
    project?: string
    dryRun?: boolean
  }) => {
    const root = resolve(opts.project ?? '.')
    const allowedPaths = opts.output.split(',').map(p => p.trim()).filter(Boolean)
    const inputFiles = opts.file ? opts.file.split(',').map(p => p.trim()).filter(Boolean) : []
    const t0 = performance.now()

    // 1. Classify + resolve model
    const taskClass = classifyTask(opts.task)
    const model = resolveModel(taskClass)

    // 2. Build system prompt
    const projectContext = loadContext(root)
    let skillGuidelines = ''
    if (opts.skill) {
      try {
        const skillDef = loadSkill(getSkillPath(opts.skill))
        skillGuidelines = `\n## SKILL GUIDELINES: ${skillDef.name}\n${skillDef.instructions}\n`
      } catch (e: any) {
        console.warn(`[run] Skill "${opts.skill}" not found — continuing without it`)
      }
    }

    const system = [
      projectContext || '# Project context\nNo AGENTS.md found. Run: orchestos init',
      skillGuidelines,
      `\n## OUTPUT CONTRACT`,
      `You may ONLY write to these files: ${allowedPaths.join(', ')}`,
      `Respond with ONLY valid JSON in this exact format — no markdown, no explanation:`,
      `{ "files": [{ "path": "relative/path", "content": "full file content" }] }`,
      `If a file should not change, omit it from the array.`,
      `Writing to any other file is a contract violation and will be rejected.`,
    ].join('\n')

    // 3. Build user message
    let userContent = `Task: ${opts.task}\n`
    if (inputFiles.length > 0) {
      userContent += '\n### Input files:\n'
      for (const f of inputFiles) {
        const fullPath = join(root, f)
        if (existsSync(fullPath)) {
          userContent += `\n#### ${f}\n\`\`\`\n${readFileSync(fullPath, 'utf-8')}\n\`\`\`\n`
        } else {
          console.warn(`[run] Input file not found: ${f}`)
        }
      }
    }

    if (opts.dryRun) {
      console.log('─── SYSTEM PROMPT ──────────────────────────────────────')
      console.log(system)
      console.log('─── USER MESSAGE ───────────────────────────────────────')
      console.log(userContent)
      console.log(`\n[dry-run] model: ${model} (${taskClass}) | allowed: ${allowedPaths.join(', ')}`)
      return
    }

    console.log(`[run] task_class=${taskClass} model=${model}`)
    console.log(`[run] allowed outputs: ${allowedPaths.join(', ')}`)

    // 4. Snapshot before
    const before = snapshotHashes(root, allowedPaths)

    // 5. Call LLM
    let llmResponse
    try {
      llmResponse = await chat({ model, system, messages: [{ role: 'user', content: userContent }] })
    } catch (e: any) {
      const elapsed = Math.round(performance.now() - t0)
      insertRun({
        project_id: null, prompt: opts.task, task_class: taskClass,
        model, provider: 'anthropic', skill_id: opts.skill ?? null,
        allowed_outputs: JSON.stringify(allowedPaths),
        files_attempted: null, files_authorized: null, files_blocked: null,
        status: 'failed', input_tokens: 0, output_tokens: 0,
        usd_cost: 0, elapsed_ms: elapsed, result: e.message,
      })
      console.error(`[run] LLM call failed: ${e.message}`)
      process.exit(1)
    }

    const elapsed = Math.round(performance.now() - t0)
    const cost = calcCost(model, llmResponse.inputTokens, llmResponse.outputTokens)

    // 6. Parse response
    let parsed
    try {
      parsed = parseLLMResponse(llmResponse.text)
    } catch (e: any) {
      insertRun({
        project_id: null, prompt: opts.task, task_class: taskClass,
        model, provider: 'anthropic', skill_id: opts.skill ?? null,
        allowed_outputs: JSON.stringify(allowedPaths),
        files_attempted: null, files_authorized: null, files_blocked: null,
        status: 'failed',
        input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens,
        usd_cost: cost, elapsed_ms: elapsed, result: e.message,
      })
      console.error(`[run] Parse error: ${e.message}`)
      process.exit(1)
    }

    // 7. Enforce contract — BLOCKS if any file outside allowedPaths
    let contractResult
    try {
      contractResult = enforceContract(root, parsed, allowedPaths)
    } catch (e: any) {
      const attempted = parsed.files.map(f => f.path)
      const blocked = attempted.filter(p => !allowedPaths.includes(p))
      insertRun({
        project_id: null, prompt: opts.task, task_class: taskClass,
        model, provider: 'anthropic', skill_id: opts.skill ?? null,
        allowed_outputs: JSON.stringify(allowedPaths),
        files_attempted: JSON.stringify(attempted),
        files_authorized: JSON.stringify(attempted.filter(p => allowedPaths.includes(p))),
        files_blocked: JSON.stringify(blocked),
        status: 'blocked',
        input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens,
        usd_cost: cost, elapsed_ms: elapsed, result: e.message,
      })
      console.error(`\n[run] ✗ CONTRACT VIOLATION — task NOT applied`)
      console.error(e.message)
      process.exit(2)
    }

    // 8. Persist run with evidence
    insertRun({
      project_id: null, prompt: opts.task, task_class: taskClass,
      model, provider: 'anthropic', skill_id: opts.skill ?? null,
      allowed_outputs: JSON.stringify(allowedPaths),
      files_attempted: JSON.stringify(contractResult.filesAttempted),
      files_authorized: JSON.stringify(contractResult.filesAuthorized),
      files_blocked: JSON.stringify(contractResult.filesBlocked),
      status: 'done',
      input_tokens: llmResponse.inputTokens, output_tokens: llmResponse.outputTokens,
      usd_cost: cost, elapsed_ms: elapsed,
      result: `${contractResult.written.length} file(s) written`,
    })

    // 9. Print summary
    console.log(`\n[run] ✓ done`)
    for (const f of contractResult.written) console.log(`  → ${f.path}`)
    console.log(`\n  model:   ${model} (${taskClass})`)
    console.log(`  tokens:  ${llmResponse.inputTokens} in / ${llmResponse.outputTokens} out`)
    console.log(`  cost:    $${cost.toFixed(6)}`)
    console.log(`  time:    ${elapsed}ms`)
  })

// ── runs history ──────────────────────────────────────────────────────────────
program
  .command('runs')
  .description('Show recent run history')
  .option('--limit <n>', 'Number of runs to show', '10')
  .action((opts: { limit: string }) => {
    const { listRuns } = require('./db/runs.ts')
    const rows = listRuns(parseInt(opts.limit))
    if (rows.length === 0) { console.log('[runs] No runs yet.'); return }
    for (const r of rows) {
      const blocked = r.files_blocked ? JSON.parse(r.files_blocked).length : 0
      const icon = r.status === 'done' ? '✓' : r.status === 'blocked' ? '✗' : '!'
      console.log(`  ${icon} ${r.created_at.slice(0, 19)}  ${r.task_class.padEnd(10)} ${r.model.padEnd(22)} $${r.usd_cost.toFixed(5)}  ${r.prompt.slice(0, 50)}${blocked > 0 ? `  [${blocked} blocked]` : ''}`)
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
