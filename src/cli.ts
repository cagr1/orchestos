#!/usr/bin/env bun
import { Command } from 'commander'
import { resolve, join } from 'path'
import { writeFileSync, existsSync } from 'fs'
import { readManifest } from './detect/manifest.ts'
import { detectLanguages, detectPrimaryLanguage } from './detect/languages.ts'
import { readConventions } from './detect/conventions.ts'
import { generateAgentsMd, type StackProfile } from './generators/agents-md.ts'
import { generateContextJson } from './generators/context-json.ts'
import { runMigrations } from './db/migrate.ts'
import { upsertProject, getProject, listProjects } from './db/projects.ts'
import { loadContext } from './context/load.ts'
import { buildContextMd } from './context/compress.ts'
import { loadSkill, listSkillFiles, getSkillPath, type SkillTarget } from './skills/registry.ts'
import { compileSkill } from './skills/compile.ts'
import { classifyTask } from './router/classify.ts'
import { resolveModel } from './router/models.ts'
import { calcCost } from './router/pricing.ts'
import { parseCostBreakdownJson } from './run/transcript-parser.ts'
import { chat } from './providers/openrouter.ts'
import { ensureCatalogLoaded, maxOutputTokensFor } from './router/model-catalog.ts'
import { parseLLMResponse, enforceContract } from './run/contract.ts'
import { MAX_RETRIES } from './run/qa.ts'
import { RunLogger } from './run/logger.ts'
import { runTask } from './run/harness.ts'
import { resolveSandboxMode } from './run/sandbox-policy.ts'
import { executePlan } from './run/scheduler.ts'
import { runGraph } from './run/graph-runner.ts'
import { createPlan } from './agents/planner.ts'
import { diagnoseTask } from './agents/diagnose.ts'
import type { SubTask } from './agents/sub-agent.ts'
import { insertRun } from './db/runs.ts'
import { loadTasks, tasksExist, updateTaskStatus, tasksPath } from './tasks/loader.ts'
import { stringify as yamlStringify } from 'yaml'
import { readFileSync } from 'fs'
import { generateSummaryPdf } from './generators/summary-pdf.ts'
import { indexProject } from './graph/index.ts'
import { suggestContext } from './graph/suggest.ts'
import { inferEmbeddingProvider } from './providers/embeddings.ts'
import { scaffoldSkillYaml, SUPPORTED_LANGUAGES } from './skills/scaffold.ts'
import { registerSkillFetchCommands } from './cli-skill-fetch.ts'
import { registerSkillCurateImportCommands } from './cli-skill-curate.ts'
import { listConflicts } from './db/memory.ts'

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
  .option('--pdf', 'Also generate a PDF summary')
  .action(async (targetPath?: string, opts?: { pdf?: boolean }) => {
    const root = resolve(targetPath ?? '.')
    const t0 = performance.now()
    const profile = await buildProfile(root)
    const agentsMd = generateAgentsMd(profile)
    const contextJson = generateContextJson(profile)
    writeFileSync(join(root, 'AGENTS.md'), agentsMd, 'utf-8')
    writeFileSync(join(root, 'context.json'), JSON.stringify(contextJson, null, 2), 'utf-8')
    upsertProject(root, profile, agentsMd)
    const project = getProject(root)
    const indexResult = project ? await indexProject(root, project.id) : null
    const elapsed = Math.round(performance.now() - t0)
    console.log(`[init] ${profile.manifest.name} saved in ${elapsed}ms`)
    console.log(`  → AGENTS.md`)
    console.log(`  → context.json`)
    console.log(`  → ~/.orchestos/db.sqlite`)
    if (indexResult) console.log(`  -> code graph: ${indexResult.files} files, ${indexResult.edges} edges`)
    if (opts?.pdf) {
      const { listRuns: lr } = require('./db/runs.ts')
      const pdfPath = join(root, `${profile.manifest.name}-summary.pdf`)
      await generateSummaryPdf(profile, agentsMd, pdfPath, lr(10))
      console.log(`  → ${profile.manifest.name}-summary.pdf`)
    }
  })

// ── summary ───────────────────────────────────────────────────────────────────
program
  .command('summary [path]')
  .description('Generate a PDF summary of a project (runs init if not already saved)')
  .option('--out <file>', 'Output PDF path (default: <project>-summary.pdf in project root)')
  .action(async (targetPath?: string, opts?: { out?: string }) => {
    const root = resolve(targetPath ?? '.')
    const t0 = performance.now()
    const profile = await buildProfile(root)
    const agentsMd = generateAgentsMd(profile)
    upsertProject(root, profile, agentsMd)
    const { listRuns: lr2 } = require('./db/runs.ts')
    const pdfPath = opts?.out ?? join(root, `${profile.manifest.name}-summary.pdf`)
    await generateSummaryPdf(profile, agentsMd, pdfPath, lr2(10))
    const elapsed = Math.round(performance.now() - t0)
    console.log(`[summary] ${profile.manifest.name} → ${pdfPath} (${elapsed}ms)`)
  })

// ── context ───────────────────────────────────────────────────────────────────
program
  .command('index [path]')
  .description('Index project imports into the local code graph')
  .option('--project <name>', 'Saved project name or path')
  .option('--no-embed', 'Skip embedding generation for projects without API key')
  .action(async (targetPath?: string, opts?: { project?: string; noEmbed?: boolean }) => {
    const root = resolveIndexRoot(targetPath, opts?.project)
    const project = await ensureProject(root)
    const t0 = performance.now()
    const result = await indexProject(root, project.id, { noEmbed: opts?.noEmbed })
    const elapsed = Math.round(performance.now() - t0)
    const embedInfo = result.embeddings > 0 ? `, ${result.embeddings} embeddings` : ''
    console.log(`[index] indexed ${result.files} files, ${result.edges} edges${embedInfo} in ${elapsed}ms`)
  })

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

ctx
  .command('suggest <task>')
  .description('Suggest relevant files for a task using the code graph')
  .option('--project <name>', 'Saved project name or path')
  .option('--top <n>', 'Max results (default 10)', '10')
  .option('--no-expand', 'Disable 1-hop neighbor expansion')
  .action(async (taskText: string, opts: { project?: string; top: string; expand: boolean }) => {
    const root = resolveIndexRoot(undefined, opts.project)
    const project = getProject(root)
    if (!project) {
      console.error(`[suggest] No indexed project at ${root}. Run: orchestos init`)
      process.exit(1)
    }
    const topN = Math.max(1, parseInt(opts.top, 10) || 10)

    let taskEmbedding: number[] | undefined
    try {
      const ep = inferEmbeddingProvider('openai')
      const { embeddings } = await ep.embed([taskText])
      taskEmbedding = embeddings[0]
    } catch {
      // no embedding provider available — keyword-only path
    }

    const results = suggestContext(project.id, taskText, { topN, expand: opts.expand, taskEmbedding })
    if (results.length === 0) {
      console.log('[suggest] No matching files found for that task description.')
      return
    }
    console.log(`[suggest] Top ${results.length} files for: "${taskText}"`)
    for (const r of results) {
      const tag = r.reason === 'direct' ? '●' : r.reason === 'embedding' ? '◆' : '○'
      const scoreStr = taskEmbedding ? r.score.toFixed(3) : String(r.score)
      console.log(`  ${tag} ${r.path.padEnd(60)} score=${scoreStr}`)
    }
    console.log('\n  ● = direct token match   ◆ = semantic match   ○ = 1-hop neighbor')
  })

ctx
  .command('compress [path]')
  .description('Generate CONTEXT.md — compressed project context (~500 tokens vs ~2000 AGENTS.md)')
  .action((targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const result = buildContextMd(root)
    if (!result) {
      console.error(`[context] No saved context for ${root}. Run: orchestos init`)
      process.exit(1)
    }
    const outPath = join(root, 'CONTEXT.md')
    writeFileSync(outPath, result.content, 'utf-8')
    const saved = result.agentsMdTokens - result.tokenEstimate
    console.log(`[context] CONTEXT.md written to ${outPath}`)
    console.log(`  AGENTS.md: ~${result.agentsMdTokens} tokens → CONTEXT.md: ~${result.tokenEstimate} tokens (saved ~${saved} tokens)`)
  })

// ── skill ─────────────────────────────────────────────────────────────────────
const skill = program.command('skill').description('Manage and compile skills')
registerSkillFetchCommands(skill)

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
name: ${id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
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
  .option('--project <path>', 'Project root for language-aware compilation')
  .action(async (opts: { target?: string; id?: string; project?: string }) => {
    const targetFilter = opts.target as SkillTarget | undefined
    if (targetFilter && !['claude', 'cursor', 'openai'].includes(targetFilter)) {
      console.error(`[skill] Invalid target "${targetFilter}". Valid: claude, cursor, openai`)
      process.exit(1)
    }

    let detectedLanguage: string | undefined
    if (opts.project) {
      const root = resolve(opts.project)
      detectedLanguage = await detectPrimaryLanguage(root) ?? undefined
      if (detectedLanguage) {
        console.log(`[skill] Project language: ${detectedLanguage}`)
      } else {
        console.log('[skill] No recognised source files found — compiling without language targeting')
      }
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
        const written = compileSkill(s, targetFilter ? [targetFilter] : undefined, detectedLanguage)
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

skill
  .command('scaffold')
  .description('Generate a language-specific skill YAML — use when no skill covers your project language')
  .requiredOption('--language <lang>', 'Target language (e.g. Rust, "Visual Basic", R, SQL)')
  .option('--id <id>', 'Custom skill id (kebab-case). Default: <language>-development')
  .option('--out <path>', 'Output path. Default: skills/<id>.yaml')
  .action((opts: { language: string; id?: string; out?: string }) => {
    const lang = opts.language
    const supported = SUPPORTED_LANGUAGES.find(l => l.toLowerCase() === lang.toLowerCase())
    if (!supported) {
      console.warn(`[skill] Warning: "${lang}" is not in the known language list.`)
      console.warn(`  Known: ${SUPPORTED_LANGUAGES.join(', ')}`)
      console.warn('  Generating generic scaffold anyway.')
    }
    const resolvedLang = supported ?? lang
    const id = opts.id ?? `${resolvedLang.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-development`
    const outPath = opts.out ?? getSkillPath(id)
    if (existsSync(outPath)) {
      console.error(`[skill] Already exists: ${outPath}. Use --out to specify a different path.`)
      process.exit(1)
    }
    const yaml = scaffoldSkillYaml(resolvedLang, id)
    writeFileSync(outPath, yaml, 'utf-8')
    console.log(`[skill] Scaffolded: ${outPath}`)
    console.log(`  Language: ${resolvedLang}`)
    console.log(`  Edit verifiers, anti_patterns, and examples to match your project.`)
    console.log(`  Then run: orchestos skill build`)
  })

registerSkillCurateImportCommands(skill)

skill
  .command('languages')
  .description('List all languages supported for language-aware skill generation')
  .action(() => {
    console.log('[skill] Supported languages for --language and language_targets:\n')
    const cols = 4
    const padded = SUPPORTED_LANGUAGES.map(l => l.padEnd(20))
    for (let i = 0; i < padded.length; i += cols) {
      console.log('  ' + padded.slice(i, i + cols).join(''))
    }
    console.log(`\n  Total: ${SUPPORTED_LANGUAGES.length} languages`)
    console.log('\n  Missing a language? Use: orchestos skill scaffold --language <name>')
    console.log('  For unknown languages, orchestos generates a generic scaffold you can customize.')
  })

// ── run ───────────────────────────────────────────────────────────────────────
program
  .command('run')
  .description('Execute a task with contract enforcement — only declared outputs are written')
  .option('--task <description>', 'What to do (natural language). Required unless --graph is set.')
  .option('--output <paths>', 'Comma-separated list of files the LLM is allowed to write (e.g. src/foo.ts,src/bar.ts). Required unless --graph is set.')
  .option('--skill <id>', 'Skill to inject as guidelines')
  .option('--file <paths>', 'Comma-separated input files to read and include as context')
  .option('--project <path>', 'Project root (defaults to cwd)')
  .option('--dry-run', 'Build the prompt and print it without calling the LLM (one-shot) or show topological plan without executing (with --graph)')
  .option('--graph', 'Run the full DAG declared in tasks.yaml autonomously (Mes 14, Bloque B1)')
  .option('--max-cost <usd>', 'Circuit breaker: stop --graph when accumulated cost reaches this USD value')
  .option('--max-minutes <n>', 'Circuit breaker: stop --graph after this many wall-clock minutes')
  .option('--keep-worktree', 'Keep worktree on failure for post-mortem debugging (implies --sandbox=worktree)')
  .option('--sandbox <mode>', 'Sandbox mode: worktree | cwd | auto (default: auto)', 'auto')
  .action(async (opts: {
    task?: string
    output?: string
    skill?: string
    file?: string
    project?: string
    dryRun?: boolean
    graph?: boolean
    maxCost?: string
    maxMinutes?: string
    keepWorktree?: boolean
    sandbox?: string
  }) => {
    const root = resolve(opts.project ?? '.')

    // ── run --graph: DAG-wide autonomous traversal (B1) ────────────────────
    if (opts.graph) {
      if (!tasksExist(root)) {
        console.error(`[run --graph] No tasks.yaml found in ${root}. Run: orchestos task init`)
        process.exit(1)
      }
      const projectContext = loadContext(root)
      const project = getProject(root)
      const orcheConfigPath  = join(root, 'orchestos.config.yaml')
      const orcheConfigFound = existsSync(orcheConfigPath)
      const orcheConfig      = loadOrcheConfig(root)

      const maxCost   = opts.maxCost   != null ? Number(opts.maxCost)   : undefined
      const maxMinutes = opts.maxMinutes != null ? Number(opts.maxMinutes) : undefined
      if (maxCost != null && !Number.isFinite(maxCost)) {
        console.error(`[run --graph] --max-cost must be a number, got: ${opts.maxCost}`)
        process.exit(1)
      }
      if (maxMinutes != null && !Number.isFinite(maxMinutes)) {
        console.error(`[run --graph] --max-minutes must be a number, got: ${opts.maxMinutes}`)
        process.exit(1)
      }

      const sandboxRaw = opts.keepWorktree ? 'worktree' : (opts.sandbox ?? 'auto')
      const sandboxMode = sandboxRaw === 'auto' ? undefined : sandboxRaw as 'worktree' | 'cwd'

      // --dry-run: topological preview without spending tokens (B1)
      if (opts.dryRun) {
        const file = loadTasks(root)
        const tasks = file.tasks
        if (tasks.length === 0) {
          console.log(`[run --graph] No tasks declared in ${tasksPath(root)}`)
          return
        }
        console.log(`[run --graph] (dry-run) ${tasks.length} task(s) in ${tasksPath(root)}\n`)
        // Layered topological order: tasks with no pending ancestors first
        const doneOrPending = tasks.filter(t => t.status !== 'failed_permanent')
        const layers: string[][] = []
        const placed = new Set<string>()
        let progress = true
        while (progress) {
          progress = false
          const layer: string[] = []
          for (const t of doneOrPending) {
            if (placed.has(t.id)) continue
            const unmet = t.depends_on.filter(d => !placed.has(d) && doneOrPending.find(x => x.id === d)?.status !== 'done')
            if (unmet.length === 0) { layer.push(t.id); placed.add(t.id); progress = true }
          }
          if (layer.length > 0) layers.push(layer)
        }
        const stuck = doneOrPending.filter(t => !placed.has(t.id))
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i] ?? []
          console.log(`  step ${String(i + 1).padStart(2)}: ${layer.join(', ')}`)
        }
        if (stuck.length > 0) {
          console.log(`  stuck:    ${stuck.map(t => t.id).join(', ')} (cycles or unresolved dependencies)`)
        }
        console.log('')
        console.log(`  circuit breaker:`)
        console.log(`    cost limit:    ${maxCost != null ? `$${maxCost.toFixed(4)}` : '(not set — no cap)'}`)
        console.log(`    time limit:    ${maxMinutes != null ? `${maxMinutes} min` : '(not set — no cap)'}`)
        console.log(`    iterations:    200 (hard cap)`)
        console.log(`\n  Run without --dry-run to execute.`)
        return
      }

      console.log(`[run --graph] starting autonomous DAG traversal in ${root}`)
      if (maxCost != null)   console.log(`  cost cap:   $${maxCost.toFixed(4)}`)
      if (maxMinutes != null) console.log(`  time cap:   ${maxMinutes} min`)
      if (sandboxMode)       console.log(`  sandbox:    ${sandboxMode}`)
      console.log('')

      const result = await runGraph({
        projectRoot: root,
        contextText: projectContext,
        projectId: project?.id,
        orcheConfig,
        orcheConfigFound,
        maxCost,
        maxMinutes,
        sandboxMode,
        keepWorktree: opts.keepWorktree,
      })

      // Final summary — B2: outcome grouped by 3 buckets, autonomy metric prominent
      // (B1 had a flat list; B2 sorts into "completed alone · retried-and-resolved ·
      // branch blocked" so the human can see at a glance how autonomous the run was
      // and which branches had to be sacrificed.)
      printGraphSummary(result, root)
      // Exit code: 0 only if autonomy is 100% (no failures, no circuit break)
      const failed = result.tasks.some(e => e.outcome === 'failed_permanent' || e.outcome === 'blocked')
      process.exit(failed || result.circuit_break_reason ? 1 : 0)
    }

    // ── one-shot run (existing behavior) ─────────────────────────────────
    if (!opts.task || !opts.output) {
      console.error(`[run] Either --task/--output (one-shot) or --graph (DAG traversal) is required.`)
      process.exit(1)
    }
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
      `Output each file using EXACTLY this format — nothing else before the first delimiter or after the last:`,
      ...allowedPaths.map(p => `<<<FILE:${p}>>>\n(full file content)\n<<<ENDFILE>>>`),
      `Replace the placeholder with the actual file content. No JSON, no markdown fences, no extra text.`,
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

    // 4. Call LLM
    await ensureCatalogLoaded()
    const maxTokens = maxOutputTokensFor(model)
    let llmResponse
    try {
      llmResponse = await chat({ model, system, messages: [{ role: 'user', content: userContent }], maxTokens })
    } catch (e: any) {
      const elapsed = Math.round(performance.now() - t0)
      insertRun({
        project_id: null, prompt: opts.task, task_class: taskClass,
        model, provider: 'openrouter', skill_id: opts.skill ?? null,
        task_id: null, allowed_outputs: JSON.stringify(allowedPaths),
        files_attempted: null, files_authorized: null, files_blocked: null,
        snapshot_before: null, snapshot_after: null,
        qa_verdict: null, qa_reason: null,
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
        model, provider: 'openrouter', skill_id: opts.skill ?? null,
        task_id: null, allowed_outputs: JSON.stringify(allowedPaths),
        files_attempted: null, files_authorized: null, files_blocked: null,
        snapshot_before: null, snapshot_after: null,
        qa_verdict: null, qa_reason: null,
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
        model, provider: 'openrouter', skill_id: opts.skill ?? null,
        task_id: null, allowed_outputs: JSON.stringify(allowedPaths),
        files_attempted: JSON.stringify(attempted),
        files_authorized: JSON.stringify(attempted.filter(p => allowedPaths.includes(p))),
        files_blocked: JSON.stringify(blocked),
        snapshot_before: null, snapshot_after: null,
        qa_verdict: null, qa_reason: null,
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
      model, provider: 'openrouter', skill_id: opts.skill ?? null,
      task_id: null, allowed_outputs: JSON.stringify(allowedPaths),
      files_attempted: JSON.stringify(contractResult.filesAttempted),
      files_authorized: JSON.stringify(contractResult.filesAuthorized),
      files_blocked: JSON.stringify(contractResult.filesBlocked),
      snapshot_before: null, snapshot_after: null,
      qa_verdict: null, qa_reason: null,
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
  .option('--detail <run-id>', 'Show full evidence for a specific run')
  .option('--export', 'Export full run history to runs-export.json in cwd')
  .option('--analyze', 'Analyze runs for recurring patterns and suggest improvements (S30)')
  .option('--last <n>', 'Number of recent runs to analyze (default: 20)', '20')
  .action(async (opts: { limit: string; detail?: string; export?: boolean; analyze?: boolean; last?: string }) => {
    const { listRuns, getRun } = require('./db/runs.ts')

    if (opts.detail) {
      const r = getRun(opts.detail)
      if (!r) { console.error(`[runs] Run not found: ${opts.detail}`); process.exit(1) }
      printRunDetail(r)
      return
    }

    if (opts.export) {
      const rows = listRuns(0)   // 0 = unlimited
      const outPath = join(resolve('.'), 'runs-export.json')
      writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf-8')
      console.log(`[runs] Exported ${rows.length} run(s) → ${outPath}`)
      return
    }

    if (opts.analyze) {
      const { groupRunsByOutcome, analyzeRunPatterns } = await import('./analyze/patterns.ts')
      const { proposeInstinctsFromPatterns } = await import('./analyze/propose.ts')
      const n    = parseInt(opts.last ?? '20')
      const rows = listRuns(n)
      if (rows.length < 3) {
        console.log('[runs analyze] Not enough runs to analyze (need at least 3).')
        return
      }
      const groups = groupRunsByOutcome(rows)
      console.log(`[runs analyze] Analyzing ${groups.total} runs (pass: ${groups.qaPass}, fail: ${groups.qaFail}, blocked: ${groups.blocked})...`)
      const suggestions = await analyzeRunPatterns(groups)
      if (suggestions.length === 0) {
        console.log('[runs analyze] No recurring patterns detected.')
        return
      }
      console.log(`\n${suggestions.length} pattern(s) detected:\n`)
      for (const s of suggestions) {
        console.log(`  [${s.confidence.toUpperCase()}] ${s.pattern} (${s.frequency}x)`)
        console.log(`    → ${s.fix_hint}\n`)
      }

      // S34.2 — propose instincts for patterns with frequency >= threshold
      const proposals = proposeInstinctsFromPatterns(suggestions)
      if (proposals.length > 0) {
        console.log(`\n${proposals.length} instinct(s) proposed automatically (review with: orchestos instinct review):\n`)
        for (const p of proposals) {
          console.log(`  [${p.confidence.toFixed(2)}] ${p.trigger} → ${p.action}`)
        }
      }
      return
    }

    const rows = listRuns(parseInt(opts.limit))
    if (rows.length === 0) { console.log('[runs] No runs yet.'); return }
    for (const r of rows) {
      const blocked = r.files_blocked ? JSON.parse(r.files_blocked).length : 0
      const icon = r.status === 'done' ? '✓' : r.status === 'blocked' ? '✗' : '!'
      const qa = r.qa_verdict ? ` [qa:${r.qa_verdict}]` : ''
      console.log(`  ${icon} ${r.created_at.slice(0, 19)}  ${r.task_class.padEnd(10)} ${r.model.padEnd(22)} $${r.usd_cost.toFixed(5)}  ${r.prompt.slice(0, 45)}${qa}${blocked > 0 ? `  [${blocked} blocked]` : ''}`)
    }
  })

// ── config ────────────────────────────────────────────────────────────────────
import { loadOrcheConfig, scaffoldConfigYaml } from './config/load.ts'
import { autoRoute, formatRoute } from './router/auto-route.ts'

const config = program.command('config').description('Manage model routing configuration')

config
  .command('init [path]')
  .description('Create orchestos.config.yaml in the project directory')
  .action((targetPath?: string) => {
    const root       = resolve(targetPath ?? '.')
    const configPath = join(root, 'orchestos.config.yaml')
    if (existsSync(configPath)) {
      console.error(`[config] orchestos.config.yaml already exists at ${configPath}`)
      process.exit(1)
    }
    writeFileSync(configPath, scaffoldConfigYaml(), 'utf8')
    console.log(`[config] created ${configPath}`)
    console.log(`  Edit the file to set your preferred models per role.`)
  })

config
  .command('show [path]')
  .description('Show active config and which model would be used for each pending task')
  .option('-p, --project <path>', 'Project path (defaults to current directory)')
  .action((targetPath?: string, opts?: { project?: string }) => {
    const root        = resolve(targetPath ?? opts?.project ?? '.')
    const configPath  = join(root, 'orchestos.config.yaml')
    const configFound = existsSync(configPath)
    const cfg         = loadOrcheConfig(root)

    console.log(`\n[config] Source: ${configFound ? configPath : 'defaults (no orchestos.config.yaml found)'}`)
    console.log(`\n  Roles:`)
    console.log(`    planner        → ${cfg.models.planner.provider}/${cfg.models.planner.model || '(self)'}`)
    console.log(`    executor_heavy → ${cfg.models.executor_heavy.provider}/${cfg.models.executor_heavy.model || '(self)'}`)
    console.log(`    executor_light → ${cfg.models.executor_light.provider}/${cfg.models.executor_light.model || '(self)'}`)
    console.log(`    default        → ${cfg.models.default.provider}/${cfg.models.default.model || '(self)'}`)

    if (!tasksExist(root)) {
      console.log(`\n  No tasks.yaml found in ${root} — skipping task routing preview.`)
      return
    }

    const tasksFile = loadTasks(root)
    const pending   = tasksFile.tasks.filter(t => t.status === 'pending')

    if (pending.length === 0) {
      console.log(`\n  No pending tasks.`)
      return
    }

    console.log(`\n  Pending tasks — model routing preview:`)
    const COL_ID    = 20
    const COL_MODEL = 42
    console.log(`  ${'TASK ID'.padEnd(COL_ID)} ${'WOULD USE'.padEnd(COL_MODEL)} EXECUTOR`)
    console.log(`  ${'─'.repeat(COL_ID)} ${'─'.repeat(COL_MODEL)} ${'─'.repeat(12)}`)
    for (const t of pending) {
      const route    = autoRoute(t, cfg, configFound)
      const modelStr = route ? formatRoute(route) : `${t.executor} (legacy)`
      console.log(`  ${t.id.padEnd(COL_ID)} ${modelStr.padEnd(COL_MODEL)} ${t.executor}`)
    }
  })

// ── task ──────────────────────────────────────────────────────────────────────
const task = program.command('task').description('Manage and run declarative task workflows')

task
  .command('init [path]')
  .description('Generate tasks.yaml scaffold based on detected stack')
  .action(async (targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    if (tasksExist(root)) {
      console.error(`[task] tasks.yaml already exists in ${root}`)
      process.exit(1)
    }
    const profile = await buildProfile(root)
    const { manifest } = profile

    // Generate 2 starter tasks based on detected stack
    const isNext   = manifest.framework === 'Next.js'
    const isPython = manifest.runtime   === 'Python'

    const tasks = isNext ? [
      { id: 't1-component', description: 'Create a reusable Button component', skill: 'implement', input: [], output: ['src/components/Button.tsx'], depends_on: [], status: 'pending', retry_count: 0 },
      { id: 't2-styles',    description: 'Add CSS module styles for Button', skill: 'implement', input: ['src/components/Button.tsx'], output: ['src/components/Button.module.css'], depends_on: ['t1-component'], status: 'pending', retry_count: 0 },
    ] : isPython ? [
      { id: 't1-util', description: 'Create a utility function for string normalization', skill: 'implement', input: [], output: ['utils/normalize.py'], depends_on: [], status: 'pending', retry_count: 0 },
      { id: 't2-test', description: 'Write unit tests for the normalize utility', skill: 'implement', input: ['utils/normalize.py'], output: ['tests/test_normalize.py'], depends_on: ['t1-util'], status: 'pending', retry_count: 0 },
    ] : [
      { id: 't1-util', description: 'Create a utility helper function', skill: 'implement', input: [], output: ['src/utils/helper.js'], depends_on: [], status: 'pending', retry_count: 0 },
      { id: 't2-doc',  description: 'Add JSDoc comments to the helper', skill: 'doc', input: ['src/utils/helper.js'], output: ['src/utils/helper.js'], depends_on: ['t1-util'], status: 'pending', retry_count: 0 },
    ]

    const content = yamlStringify({ version: 1, project: manifest.name, tasks }, { lineWidth: 120 })
    writeFileSync(tasksPath(root), content, 'utf-8')
    console.log(`[task] Created tasks.yaml in ${root}`)
    console.log(`  → ${tasks.length} starter tasks for ${manifest.framework || manifest.runtime}`)
    console.log(`  Edit tasks.yaml to define your actual work, then run: orchestos task run <path>`)
  })

task
  .command('list [path]')
  .description('List all tasks and their status')
  .action((targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const file = loadTasks(root)
    console.log(`\n  ${file.project} — tasks.yaml\n`)
    const icons: Record<string, string> = { pending: '○', running: '◌', done: '✓', failed: '✗', failed_permanent: '✗✗', blocked: '⊘' }
    for (const t of file.tasks) {
      const icon = icons[t.status] ?? '?'
      const dep  = t.depends_on.length > 0 ? ` (needs: ${t.depends_on.join(', ')})` : ''
      const qa   = t.qa_verdict ? ` [qa:${t.qa_verdict}]` : ''
      const retry = t.retry_count > 0 ? ` retry:${t.retry_count}` : ''
      console.log(`  ${icon} ${t.id.padEnd(24)} ${t.status.padEnd(16)} out:${t.output.join(',')}${dep}${qa}${retry}`)
    }
    console.log()
  })

task
  .command('status [path]')
  .description('Show task status table with retry count, QA verdict, and cost')
  .action((targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const file = loadTasks(root)
    const { listRunsByTaskId } = require('./db/runs.ts')
    console.log(`\n  ${file.project} — task status\n`)
    const head = `  ${'id'.padEnd(22)} ${'status'.padEnd(18)} ${'retry'.padEnd(6)} ${'qa'.padEnd(6)} ${'cost'.padStart(10)}`
    console.log(head)
    console.log(`  ${'─'.repeat(head.length - 2)}`)
    let totalCost = 0
    for (const t of file.tasks) {
      let cost = 0
      try {
        const rows = listRunsByTaskId(t.id) as Array<{ usd_cost: number }>
        cost = rows.reduce((a, r) => a + (r.usd_cost ?? 0), 0)
      } catch { /* no runs yet */ }
      totalCost += cost
      const qa = t.qa_verdict ?? '-'
      console.log(`  ${t.id.padEnd(22)} ${t.status.padEnd(18)} ${String(t.retry_count).padEnd(6)} ${qa.padEnd(6)} ${('$' + cost.toFixed(5)).padStart(10)}`)
    }
    console.log(`  ${'─'.repeat(head.length - 2)}`)
    console.log(`  ${'total'.padEnd(22)} ${''.padEnd(18)} ${''.padEnd(6)} ${''.padEnd(6)} ${('$' + totalCost.toFixed(5)).padStart(10)}`)
    console.log()
  })

task
  .command('diagnose <id>')
  .description('Diagnose why a task failed — analyze last 3 runs and suggest a fix (does NOT execute anything)')
  .option('--model <model>', 'Model override (default: anthropic/claude-3-haiku via openrouter)')
  .action(async (taskId: string, opts: { model?: string }) => {
    const root = resolve('.')
    console.log(`\n[diagnose] Analyzing task "${taskId}"...`)
    try {
      const result = await diagnoseTask(taskId, root, opts.model)
      console.log(`\n  Task:    ${result.taskId}`)
      console.log(`  Pattern: ${result.pattern}`)
      console.log(`  Confidence: ${result.confidence}`)
      console.log(`\n  Suggestion:`)
      console.log(`    ${result.suggestion}`)
      console.log(`\n  Evidence:`)
      console.log(`    ${result.details}`)
      console.log(`\n  Note: This is a suggestion only — review and edit tasks.yaml manually.`)
    } catch (e: any) {
      console.error(`[diagnose] Error: ${e.message}`)
      process.exit(1)
    }
  })

task
  .command('run [path]')
  .description('Execute the next pending task with contract enforcement')
  .option('--id <task-id>', 'Run a specific task by id')
  .option('--all', 'Run all pending tasks in dependency order')
  .option('--expand <plan-task-id>', 'Run task and expand its plan into sub-tasks')
  .option('--explain <task-id>', 'Show what would run without executing or calling an LLM')
  .option('--clarify <task-id>', 'Ask for clarification before executing the task')
  .option('--keep-worktree', 'Keep worktree on failure for post-mortem debugging (implies --sandbox=worktree)')
  .option('--sandbox <mode>', 'Sandbox mode: worktree | cwd | auto (default: auto)', 'auto')
  .action(async (targetPath?: string, opts?: { id?: string; all?: boolean; expand?: string; explain?: string; clarify?: string; keepWorktree?: boolean; sandbox?: string }) => {
    const root = resolve(targetPath ?? '.')
    const projectContext = loadContext(root)
    const project = getProject(root)
    const orcheConfigPath  = join(root, 'orchestos.config.yaml')
    const orcheConfigFound = existsSync(orcheConfigPath)
    const orcheConfig      = loadOrcheConfig(root)

    if (opts?.explain) {
      explainTaskRun(root, opts.explain, project?.id)
      return
    }

    if (opts?.clarify) {
      await runClarifyMode(root, opts.clarify, project?.id, orcheConfig, orcheConfigFound)
      return
    }

    const executeTask = async (taskId: string): Promise<'done' | 'failed' | 'blocked' | 'retry'> => {
      const file = loadTasks(root)
      const t = file.tasks.find(x => x.id === taskId)
      if (!t) { console.error(`[task] Task "${taskId}" not found`); return 'failed' }
      if (t.status === 'done')             { console.log(`[task] ${taskId} already done`); return 'done' }
      if (t.status === 'failed_permanent') { console.log(`[task] ${taskId} permanently failed`); return 'failed' }

      // check dependencies
      for (const dep of t.depends_on) {
        const depTask = file.tasks.find(x => x.id === dep)
        if (!depTask || depTask.status !== 'done') {
          const log = new RunLogger(root, taskId)
          log.blocked(dep)
          console.error(`[task] ${taskId} blocked — dependency "${dep}" not done (status: ${depTask?.status ?? 'not found'})`)
          updateTaskStatus(root, taskId, { status: 'blocked' })
          return 'blocked'
        }
      }

      // resolve sandbox BEFORE marking running — updateTaskStatus writes tasks.yaml to
      // disk, and resolveSandboxMode's clean-tree check would then trip on that very
      // write if run afterward (chicken-and-egg false failure on an otherwise clean tree)
      const sandboxRaw = opts?.keepWorktree ? 'worktree' : (opts?.sandbox ?? 'auto')
      const preferredSandbox = sandboxRaw === 'auto' ? undefined : sandboxRaw as 'worktree' | 'cwd'
      let policy: ReturnType<typeof resolveSandboxMode>
      try {
        policy = resolveSandboxMode(root, preferredSandbox)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const log = new RunLogger(root, taskId)
        log.error(message)
        updateTaskStatus(root, taskId, { status: 'failed', retry_reason: message })
        console.error(`[task] ✗ ${taskId} failed — ${message}`)
        return 'failed'
      }

      // mark running + open log
      const log = new RunLogger(root, taskId)
      updateTaskStatus(root, taskId, { status: 'running' })
      console.log(`\n[task] Running: ${taskId}`)
      console.log(`  description: ${t.description}`)
      console.log(`  output:      ${t.output.join(', ')}`)

      const result = await runTask({ projectRoot: root, contextText: projectContext, task: t, projectId: project?.id, logger: log, orcheConfig, orcheConfigFound, sandboxMode: policy.mode, sandboxBranch: policy.branch, keepWorktree: opts?.keepWorktree })

      // map TaskResult → updateTaskStatus
      if (result.status === 'done') {
        updateTaskStatus(root, taskId, { status: 'done', run_id: result.runId, qa_verdict: 'pass', retry_reason: undefined })
        console.log(`[task] ✓ ${taskId} done · QA pass — ${result.qaReason}`)
        for (const f of result.filesWritten) console.log(`  → ${f}`)
        console.log(`  tokens: ${result.cost.inputTokens}/${result.cost.outputTokens} · $${result.cost.usd.toFixed(5)} · ${result.elapsedMs}ms`)

        // S30.4 — S34.6: background pattern analysis + instinct proposals after completion
        const { listRuns: listRunsForAnalyze } = require('./db/runs.ts')
        const recentRuns = listRunsForAnalyze(20)
        if (recentRuns.length >= 3) {
          const { groupRunsByOutcome, analyzeRunPatterns } = await import('./analyze/patterns.ts')
          const { proposeInstinctsFromPatterns } = await import('./analyze/propose.ts')
          const groups = groupRunsByOutcome(recentRuns)
          try {
            const suggestions = await analyzeRunPatterns(groups)
            if (suggestions.length > 0) {
              console.log(`\n[runs analyze] ${suggestions.length} recurring pattern(s) detected:`)
              for (const s of suggestions) {
                console.log(`  [${s.confidence.toUpperCase()}] ${s.pattern}: ${s.fix_hint}`)
              }
            }
            const proposals = proposeInstinctsFromPatterns(suggestions)
            if (proposals.length > 0) {
              console.log(`\n  ${proposals.length} instinct proposal(s) created (review with: orchestos instinct review):`)
              for (const p of proposals) {
                console.log(`    [${p.confidence.toFixed(2)}] ${p.trigger}`)
              }
            }
          } catch { /* best-effort — never block the task result */ }
        }

        return 'done'
      }

      if (result.status === 'retry') {
        const retryCount = t.retry_count + 1
        updateTaskStatus(root, taskId, { status: 'pending', qa_verdict: 'fail', retry_reason: result.retryReason, retry_count: retryCount })
        console.error(`[task] ✗ QA fail — ${result.qaReason}`)
        console.error(`  retry_count=${retryCount}/${MAX_RETRIES} → back to pending`)
        return 'retry'
      }

      // context budget insufficient — no se intentó la llamada, no cuenta como
      // retry/falla: la tarea queda pending tal cual (ver harness.ts pre-flight)
      if (result.status === 'pending') {
        updateTaskStatus(root, taskId, { status: 'pending', retry_reason: result.retryReason })
        console.error(`[task] ⏸ ${taskId} pending — ${result.retryReason}`)
        return 'blocked'
      }

      // failed
      const isPermanent = t.retry_count + 1 >= MAX_RETRIES
      updateTaskStatus(root, taskId, { status: isPermanent ? 'failed_permanent' : 'failed', retry_reason: result.retryReason })
      if (isPermanent) {
        try {
          const diag = await diagnoseTask(taskId, root)
          console.error(`\n[diagnose] ✗✗ FAILURE DIAGNOSIS for "${taskId}":`)
          console.error(`  Pattern:     ${diag.pattern} (${diag.confidence} confidence)`)
          console.error(`  Suggestion:  ${diag.suggestion}`)
          console.error(`  Evidence:    ${diag.details}`)
          console.error(`  (suggestion only — no changes were made)`)
        } catch {
          console.error(`[diagnose] Could not auto-diagnose: enable api key or run: orchestos task diagnose ${taskId}`)
        }
      }
      console.error(`[task] ✗ ${taskId} failed — ${result.retryReason}`)
      return 'failed'
    }

    // S22.6 — expand: run parent task, then execute sub-tasks from plan
    if (opts?.expand) {
      const parentStatus = await executeTask(opts.expand)
      if (parentStatus !== 'done') return

      const file = loadTasks(root)
      const parentTask = file.tasks.find(x => x.id === opts.expand)!
      const planFiles = parentTask.output.filter(o => o.endsWith('.plan.yaml'))
      if (planFiles.length === 0) {
        console.error(`[task] --expand: no .plan.yaml file in task "${opts.expand}" output — add a plan file to its output list`)
        return
      }

      const planPath = join(root, planFiles[0]!)
      if (!existsSync(planPath)) {
        console.error(`[task] --expand: plan file not found: ${planPath}; ensure the LLM wrote the plan to this path`)
        return
      }

      const planContent = readFileSync(planPath, 'utf-8')
      let subTasks: SubTask[]
      try {
        subTasks = createPlan(planContent)
      } catch (e) {
        console.error(`[task] --expand: invalid plan: ${(e as Error).message}`)
        return
      }

      console.log(`\n[task] Expanding into ${subTasks.length} sub-tasks:\n`)
      for (const st of subTasks) {
        const deps = st.depends_on.length > 0 ? ` (depends: ${st.depends_on.join(', ')})` : ''
        console.log(`  ${st.id}${deps}`)
        console.log(`    ${st.description}`)
      }

      const result = await executePlan(subTasks, {
        parentTaskId: opts.expand,
        projectRoot: root,
        baseBranch: parentTask.executor === 'codex' ? 'main' : 'main',
        parentExecutor: parentTask.executor,
        parentModel: parentTask.executor_model,
      }, async (st, worktree) => {
        const t0 = performance.now()
        const stLog = new RunLogger(root, st.id)
        console.log(`\n  [sub] Running: ${st.id} — ${st.description}`)

        const subTaskModel = st.executor_model ?? parentTask.executor_model
        const subTaskAsTask = {
          id: st.id,
          description: st.description,
          executor: st.executor ?? parentTask.executor,
          executor_model: subTaskModel,
          input: st.input ?? parentTask.input,
          output: st.output ?? parentTask.output,
          acceptance_criteria: st.acceptance,
          checks: st.checks,
          depends_on: st.depends_on,
          status: 'pending' as const,
          retry_count: 0,
          skill: st.skill,
        }

        const harnessResult = await runTask({
          projectRoot: worktree.path,
          contextText: projectContext,
          task: subTaskAsTask as any,
          projectId: project?.id,
          logger: stLog,
          orcheConfig,
          orcheConfigFound,
          sandboxMode: 'cwd',
          keepWorktree: opts?.keepWorktree,
        })

        const elapsed = Math.round(performance.now() - t0)
        const modelUsed = harnessResult.cost.inputTokens > 0 || harnessResult.cost.outputTokens > 0
          ? (subTaskModel ?? parentTask.executor_model ?? 'unknown')
          : 'unknown'

        if (harnessResult.status === 'done') {
          console.log(`  [sub] ✓ ${st.id} done — ${harnessResult.qaReason}`)
          return {
            sub_task_id: st.id,
            status: 'completed' as const,
            result: harnessResult.qaReason,
            model: modelUsed,
            usd_cost: harnessResult.cost.usd,
            tokens: { input: harnessResult.cost.inputTokens, output: harnessResult.cost.outputTokens },
            elapsed_ms: elapsed,
            files_written: harnessResult.filesWritten,
            qa_verdict: harnessResult.qaVerdict,
          }
        }

        const reason = harnessResult.retryReason ?? 'unknown error'
        console.error(`  [sub] ✗ ${st.id} failed — ${reason}`)
        return {
          sub_task_id: st.id,
          status: 'failed' as const,
          error: reason,
          model: modelUsed,
          usd_cost: harnessResult.cost.usd,
          tokens: { input: harnessResult.cost.inputTokens, output: harnessResult.cost.outputTokens },
          elapsed_ms: elapsed,
          files_written: [],
          qa_verdict: 'fail',
        }
      })

      console.log(`\n[task] ── Expand results ──`)
      for (const log of result.sub_tasks) {
        const icon = log.status === 'completed' ? '✓' : log.status === 'skipped' ? '—' : '✗'
        const costStr = `$${log.usd_cost.toFixed(5)}`
        console.log(`  ${icon} ${log.id.padEnd(22)} ${log.status.padEnd(12)} ${costStr.padStart(10)} ${log.error ?? ''}`)
      }
      const tc = result.aggregated_tokens
      console.log(`\n  total: ${result.sub_tasks.length} sub-tasks · ${tc.input}/${tc.output} tokens · $${result.aggregated_cost.toFixed(5)} · ${result.aggregated_ms}ms`)
      if (result.all_passed) {
        console.log(`  status: all passed ✓`)
      } else {
        console.log(`  status: some failed ✗`)
      }

      // S35.3 — update parent run with full cost breakdown
      const { getRun: getRunCost, updateRunCost } = require('./db/runs.ts')
      const { calcEntryCost, sumCosts, costBreakdownToJson } = await import('./run/transcript-parser.ts')
      if (parentTask.run_id) {
        const parentRun = getRunCost(parentTask.run_id)
        if (parentRun) {
          const breakdown = [
            calcEntryCost(parentTask.id, parentRun.model, parentRun.input_tokens, parentRun.output_tokens),
            ...result.sub_tasks.filter(log => log.usd_cost > 0).map(log =>
              calcEntryCost(log.id, log.model ?? parentRun.model, log.tokens.input, log.tokens.output)
            ),
          ]
          const total = sumCosts(breakdown)
          updateRunCost(parentRun.id, total, costBreakdownToJson(breakdown))
        }
      }
      return
    }

    if (opts?.id) {
      await executeTask(opts.id)
      return
    }

    if (opts?.all) {
      let iterations = 0
      const MAX = 20
      while (iterations++ < MAX) {
        const file = loadTasks(root)
        const pending = file.tasks.filter(t => t.status === 'pending')
        if (pending.length === 0) { console.log('\n[task] All tasks done ✓'); break }

        // find next executable (no unresolved deps)
        const next = pending.find(t =>
          t.depends_on.every(dep => file.tasks.find(x => x.id === dep)?.status === 'done')
        )
        if (!next) {
          const blocked = pending.map(t => t.id).join(', ')
          console.error(`\n[task] No executable tasks — blocked: ${blocked}`)
          break
        }
        const result = await executeTask(next.id)
        if (result === 'failed') { console.error('[task] Stopping — task failed'); break }
      }
      return
    }

    // default: run next pending task
    const file = loadTasks(root)
    const next = file.tasks.find(t =>
      t.status === 'pending' &&
      t.depends_on.every(dep => file.tasks.find(x => x.id === dep)?.status === 'done')
    )
    if (!next) { console.log('[task] No pending tasks ready to run.'); return }
    await executeTask(next.id)
  })

// ── spec ──────────────────────────────────────────────────────────────────────
import { loadSpec, saveSpec, listSpecs, specPath } from './spec/store.ts'
import { validateSpec } from './spec/validate.ts'
import { draftSpec as draftSpecBody } from './spec/draft.ts'

const spec = program.command('spec').description('Manage task specs (Spec-Driven workflow)')

spec
  .command('create <task-id>')
  .description('Create a new spec file with draft status')
  .option('--project <path>', 'Project root (defaults to cwd)')
  .action((taskId: string, opts: { project?: string }) => {
    const root = resolve(opts.project ?? '.')
    const existing = loadSpec(root, taskId)
    if (existing) {
      console.error(`[spec] Spec already exists for "${taskId}". Use: orchestos spec show ${taskId}`)
      process.exit(1)
    }
    const body = `## Contexto\n<placeholder>\n\n## Descripción\n<placeholder>\n\n## Criterios de aceptación\n- [ ] <criterio 1>\n- [ ] <criterio 2>\n\n## Notas\n<placeholder>\n`
    saveSpec(root, {
      frontmatter: {
        id: taskId,
        status: 'draft',
        createdAt: new Date().toISOString(),
        clarify: 'none',
      },
      body,
    })
    console.log(`[spec] Created: ${specPath(root, taskId)}`)
  })

spec
  .command('show <task-id>')
  .description('Print spec to console')
  .option('--project <path>', 'Project root (defaults to cwd)')
  .action((taskId: string, opts: { project?: string }) => {
    const root = resolve(opts.project ?? '.')
    const s = loadSpec(root, taskId)
    if (!s) {
      console.error(`[spec] No spec found for "${taskId}". Run: orchestos spec create ${taskId}`)
      process.exit(1)
    }
    console.log(`id:        ${s.frontmatter.id}`)
    console.log(`status:    ${s.frontmatter.status}`)
    console.log(`clarify:   ${s.frontmatter.clarify}`)
    console.log(`createdAt: ${s.frontmatter.createdAt}`)
    if (s.frontmatter.approvedAt) console.log(`approvedAt: ${s.frontmatter.approvedAt}`)
    if (s.frontmatter.capabilities) {
      const c = s.frontmatter.capabilities
      console.log(`capabilities:`)
      if (c.added.length)    console.log(`  added:    ${c.added.join(', ')}`)
      if (c.modified.length) console.log(`  modified: ${c.modified.join(', ')}`)
      if (c.removed.length)  console.log(`  removed:  ${c.removed.join(', ')}`)
    }
    console.log('')
    console.log(s.body)
  })

spec
  .command('list [path]')
  .description('List all specs with id, status, clarify')
  .option('--all', 'Include archived specs')
  .action((targetPath: string | undefined, opts: { all?: boolean }) => {
    const root = resolve(targetPath ?? '.')
    const specs = listSpecs(root, opts.all ?? false)
    if (specs.length === 0) {
      const hint = opts.all ? '' : ' (use --all to include archived)'
      console.log(`[spec] No specs found${hint}. Run: orchestos spec create <task-id>`)
      return
    }
    const COL_ID = 28
    const COL_STATUS = 10
    console.log(`  ${'ID'.padEnd(COL_ID)} ${'STATUS'.padEnd(COL_STATUS)} CLARIFY     CAPABILITIES`)
    console.log(`  ${'─'.repeat(COL_ID)} ${'─'.repeat(COL_STATUS)} ${'─'.repeat(10)} ${'─'.repeat(16)}`)
    for (const s of specs) {
      const caps = s.frontmatter.capabilities
      const capStr = caps ? `+${caps.added.length} ~${caps.modified.length} -${caps.removed.length}` : ''
      console.log(`  ${s.frontmatter.id.padEnd(COL_ID)} ${s.frontmatter.status.padEnd(COL_STATUS)} ${s.frontmatter.clarify.padEnd(12)} ${capStr}`)
    }
  })

spec
  .command('approve <task-id>')
  .description('Approve a spec (blocked if clarify: pending or validation fails)')
  .option('--project <path>', 'Project root (defaults to cwd)')
  .action((taskId: string, opts: { project?: string }) => {
    const root = resolve(opts.project ?? '.')
    const s = loadSpec(root, taskId)
    if (!s) {
      console.error(`[spec] No spec found for "${taskId}". Run: orchestos spec create ${taskId}`)
      process.exit(1)
    }
    if (s.frontmatter.clarify === 'pending') {
      console.error(`[spec] Cannot approve "${taskId}" — clarification is pending. Resolve it first (set clarify: resolved or none).`)
      process.exit(1)
    }
    const validation = validateSpec(s)
    if (!validation.valid) {
      console.error(`[spec] Cannot approve "${taskId}" — validation failed:`)
      for (const err of validation.errors) console.error(`  - ${err}`)
      process.exit(1)
    }
    s.frontmatter.status = 'approved'
    s.frontmatter.approvedAt = new Date().toISOString()
    saveSpec(root, s)
    console.log(`[spec] Approved: ${taskId}`)
  })

spec
  .command('draft <task-id>')
  .description('Use the LLM to draft spec body for an existing or new spec')
  .requiredOption('--description <text>', 'Task description to draft spec for')
  .option('--project <path>', 'Project root (defaults to cwd)')
  .action(async (taskId: string, opts: { description: string; project?: string }) => {
    const root = resolve(opts.project ?? '.')
    let s = loadSpec(root, taskId)
    if (!s) {
      // create a shell spec first
      s = {
        frontmatter: {
          id: taskId,
          status: 'draft',
          createdAt: new Date().toISOString(),
          clarify: 'none',
        },
        body: '',
      }
    }
    console.log(`[spec] Drafting spec body for "${taskId}" via LLM...`)
    try {
      const { body, capabilities } = await draftSpecBody(root, taskId, opts.description)
      s.frontmatter.status = 'draft'
      delete s.frontmatter.approvedAt
      if (capabilities) s.frontmatter.capabilities = capabilities
      s.body = body + '\n'
      saveSpec(root, s)
      const capInfo = capabilities
        ? ` (added:${capabilities.added.length} modified:${capabilities.modified.length} removed:${capabilities.removed.length})`
        : ''
      console.log(`[spec] Draft written: ${specPath(root, taskId)}${capInfo}`)
    } catch (e: any) {
      console.error(`[spec] LLM draft failed: ${e.message}`)
      process.exit(1)
    }
  })

// S28.3 — spec lint + S29 — spec archive
import { lintSpec } from './spec/lint.ts'
import { archiveSpec } from './spec/archive.ts'

spec
  .command('lint <task-id>')
  .description('Check acceptance criteria for WHEN/THEN format (advisory, does not block)')
  .option('--project <path>', 'Project root (defaults to cwd)')
  .action((taskId: string, opts: { project?: string }) => {
    const root = resolve(opts.project ?? '.')
    const s = loadSpec(root, taskId)
    if (!s) {
      console.error(`[spec] No spec found for "${taskId}"`)
      process.exit(1)
    }
    const result = lintSpec(s)
    if (result.findings.length === 0) {
      console.log(`[spec lint] ${taskId}: all ${result.structuredCount} criteria are in WHEN/THEN format ✓`)
      return
    }
    if (result.freeFormCount > 0) {
      console.log(`[spec lint] ${taskId}: ${result.freeFormCount} unstructured criteria (${result.structuredCount} already WHEN/THEN)`)
    }
    if (result.deltaIssuesCount > 0) {
      console.log(`[spec lint] ${taskId}: ${result.deltaIssuesCount} delta header issues`)
    }
    for (const f of result.findings) {
      console.log(`\n  Criterion: "${f.criterion}"`)
      console.log(`  Hint: ${f.suggestion}`)
    }
    process.exit(1)
  })

// S29.2 — spec archive command
spec
  .command('archive <task-id>')
  .description('Archive a completed spec (moved to .orchestos/specs/archive/YYYY-MM-DD-{id}.md)')
  .option('--project <path>', 'Project root (defaults to cwd)')
  .action((taskId: string, opts: { project?: string }) => {
    const root = resolve(opts.project ?? '.')
    try {
      const result = archiveSpec(root, taskId)
      console.log(`[spec] Archived "${taskId}" → ${result.archivedPath}`)
    } catch (e: any) {
      console.error(`[spec] Archive failed: ${e.message}`)
      process.exit(1)
    }
  })

// ── constitution ──────────────────────────────────────────────────────────────
import { loadConstitution, scaffoldConstitutionMd } from './spec/constitution.ts'
import { needsClarify, clarifyReason } from './spec/clarify.ts'

const constitution = program.command('constitution').description('Manage project constitution (agent constraints)')

constitution
  .command('init [path]')
  .description('Create CONSTITUTION.md scaffold in the project directory')
  .action((targetPath?: string) => {
    const root         = resolve(targetPath ?? '.')
    const constPath    = join(root, 'CONSTITUTION.md')
    if (existsSync(constPath)) {
      console.error(`[constitution] CONSTITUTION.md already exists at ${constPath}`)
      process.exit(1)
    }
    writeFileSync(constPath, scaffoldConstitutionMd(), 'utf8')
    console.log(`[constitution] created ${constPath}`)
    console.log(`  Edit ALLOWED / FORBIDDEN / REQUIRE_CONFIRMATION sections.`)
    console.log(`  It will be injected into every task prompt automatically.`)
  })

constitution
  .command('show [path]')
  .description('Show parsed rules from CONSTITUTION.md')
  .action((targetPath?: string) => {
    const root = resolve(targetPath ?? '.')
    const c    = loadConstitution(root)
    if (!c) {
      console.log(`[constitution] No CONSTITUTION.md in ${root}. Run: orchestos constitution init`)
      return
    }
    console.log(`\n[constitution] ${c.ruleCount} rules loaded`)
    if (c.forbidden.length > 0) {
      console.log(`\nFORBIDDEN (${c.forbidden.length}):`)
      c.forbidden.forEach(r => console.log(`  - ${r}`))
    }
    if (c.require_confirmation.length > 0) {
      console.log(`\nREQUIRE_CONFIRMATION (${c.require_confirmation.length}):`)
      c.require_confirmation.forEach(r => console.log(`  - ${r}`))
    }
    if (c.allowed.length > 0) {
      console.log(`\nALLOWED (${c.allowed.length}):`)
      c.allowed.forEach(r => console.log(`  - ${r}`))
    }
  })

// ── memory ────────────────────────────────────────────────────────────────────
const memory = program.command('memory').description('Manage project memory and conflict resolution')

memory
  .command('conflicts')
  .description('List unresolved memory conflicts')
  .option('--project <name>', 'Filter by saved project name or path')
  .action((opts: { project?: string }) => {
    const projectId = opts.project ?? undefined
    const rows = listConflicts(projectId)
    if (rows.length === 0) {
      console.log('[memory] No unresolved conflicts found.')
      return
    }
    console.log(`\n  Memory conflicts (${rows.length} unresolved):\n`)
    const COL_REL = 16
    const COL_CONF = 10
    console.log(`  ${'ID'.padEnd(28)} ${'RELATION'.padEnd(COL_REL)} ${'CONFIDENCE'.padEnd(COL_CONF)} CREATED`)
    console.log(`  ${'─'.repeat(28)} ${'─'.repeat(COL_REL)} ${'─'.repeat(COL_CONF)} ${'─'.repeat(24)}`)
    for (const r of rows) {
      console.log(`  ${r.id.padEnd(28)} ${r.relation.padEnd(COL_REL)} ${r.confidence.padEnd(COL_CONF)} ${r.created_at.slice(0, 19)}`)
    }
    console.log()
  })

// ── instinct ───────────────────────────────────────────────────────────────────
import { listInstincts, insertInstinct, listUnverified, updateConfidence, approveInstinct, deleteInstinct } from './instincts/store.ts'
import { MANUAL_DEFAULTS, AUTO_DEFAULTS, REVIEW_THRESHOLD, type InstinctSource } from './instincts/schema.ts'

const instinct = program.command('instinct').description('Manage atomic behavioral rules (instincts)')

instinct
  .command('list')
  .description('List instincts with id, trigger, confidence, source, verified')
  .option('--unverified', 'Show only unverified instincts')
  .option('--source <type>', 'Filter by source: manual or auto')
  .action((opts: { unverified?: boolean; source?: string }) => {
    let rows = opts.unverified
      ? listUnverified()
      : listInstincts({ source: opts.source as InstinctSource | undefined })

    if (!opts.unverified && opts.source) {
      rows = listInstincts({ source: opts.source as InstinctSource })
    }

    if (rows.length === 0) {
      console.log('[instinct] No instincts found.')
      return
    }

    const COL_ID = 28
    const COL_TRIGGER = 40
    console.log(`  ${'ID'.padEnd(COL_ID)} ${'TRIGGER'.padEnd(COL_TRIGGER)} CONFIDENCE  SOURCE   VERIFIED`)
    console.log(`  ${'─'.repeat(COL_ID)} ${'─'.repeat(COL_TRIGGER)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(8)}`)
    for (const r of rows) {
      const trigger = r.trigger.length > (COL_TRIGGER - 3)
        ? r.trigger.slice(0, COL_TRIGGER - 3) + '...'
        : r.trigger
      console.log(`  ${r.id.padEnd(COL_ID)} ${trigger.padEnd(COL_TRIGGER)} ${r.confidence.toFixed(2).padEnd(10)} ${r.source.padEnd(8)} ${String(r.verified).padEnd(8)}`)
    }
  })

instinct
  .command('review')
  .description('List unverified instincts (proposals pending approval) with trigger, action, confidence')
  .action(() => {
    const rows = listUnverified()
    if (rows.length === 0) {
      console.log('[instinct review] No unverified instincts found.')
      return
    }
    console.log(`\n  ${rows.length} unverified instinct(s) — review with: instinct approve <id> or instinct reject <id>\n`)
    const COL_ID = 28
    const COL_TRIGGER = 40
    const COL_ACTION = 40
    console.log(`  ${'ID'.padEnd(COL_ID)} ${'TRIGGER'.padEnd(COL_TRIGGER)} ${'ACTION'.padEnd(COL_ACTION)} CONFIDENCE`)
    console.log(`  ${'─'.repeat(COL_ID)} ${'─'.repeat(COL_TRIGGER)} ${'─'.repeat(COL_ACTION)} ${'─'.repeat(10)}`)
    for (const r of rows) {
      const trigger = r.trigger.length > (COL_TRIGGER - 3) ? r.trigger.slice(0, COL_TRIGGER - 3) + '...' : r.trigger
      const action  = r.action.length > (COL_ACTION - 3) ? r.action.slice(0, COL_ACTION - 3) + '...' : r.action
      console.log(`  ${r.id.padEnd(COL_ID)} ${trigger.padEnd(COL_TRIGGER)} ${action.padEnd(COL_ACTION)} ${r.confidence.toFixed(2).padEnd(10)}`)
    }
  })

instinct
  .command('approve <id>')
  .description('Approve a proposed instinct: verified=true, confidence+=0.1 (max 1.0)')
  .action((id: string) => {
    const ok = approveInstinct(id)
    if (!ok) {
      console.error(`[instinct] No instinct found with id "${id}"`)
      process.exit(1)
    }
    console.log(`[instinct] Approved ${id}`)
  })

instinct
  .command('reject <id>')
  .description('Reject and remove a proposed instinct')
  .action((id: string) => {
    const ok = deleteInstinct(id)
    if (!ok) {
      console.error(`[instinct] No instinct found with id "${id}"`)
      process.exit(1)
    }
    console.log(`[instinct] Rejected and removed ${id}`)
  })

instinct
  .command('set-confidence <id> <value>')
  .description('Update confidence of an instinct (recalculates verified automatically)')
  .action((id: string, value: string) => {
    const confidence = parseFloat(value)
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      console.error('[instinct] confidence must be a number between 0 and 1')
      process.exit(1)
    }
    const ok = updateConfidence(id, confidence)
    if (!ok) {
      console.error(`[instinct] No instinct found with id "${id}"`)
      process.exit(1)
    }
    const demoted = confidence < REVIEW_THRESHOLD ? ' — verified set to false (below review threshold)' : ''
    console.log(`[instinct] Updated confidence of ${id}: ${confidence}${demoted}`)
  })

instinct
  .command('propose')
  .description('Propose an auto instinct (confidence: 0.6, source: auto, verified: false — requires approval)')
  .requiredOption('--trigger <text>', 'Trigger condition for the instinct')
  .requiredOption('--action <text>', 'Action / behavior text for the instinct')
  .action((opts: { trigger: string; action: string }) => {
    const result = insertInstinct({
      trigger: opts.trigger,
      action: opts.action,
      confidence: AUTO_DEFAULTS.confidence,
      source: AUTO_DEFAULTS.source,
      verified: AUTO_DEFAULTS.verified,
    })
    console.log(`[instinct] Proposed instinct: ${result.id}`)
    console.log(`  trigger:    ${result.trigger}`)
    console.log(`  action:     ${result.action}`)
    console.log(`  confidence: ${result.confidence} (requires approval)`)
    console.log(`  Review with: orchestos instinct review`)
    console.log(`  Approve with: orchestos instinct approve ${result.id}`)
  })

instinct
  .command('add')
  .description('Add a manual instinct (confidence: 1.0, source: manual, verified: true)')
  .requiredOption('--trigger <text>', 'Trigger condition for the instinct')
  .requiredOption('--action <text>', 'Action / behavior text for the instinct')
  .option('--confidence <value>', 'Override confidence (default 1.0)', parseFloat)
  .action((opts: { trigger: string; action: string; confidence?: number }) => {
    const result = insertInstinct({
      trigger: opts.trigger,
      action: opts.action,
      confidence: opts.confidence ?? MANUAL_DEFAULTS.confidence,
      source: MANUAL_DEFAULTS.source,
      verified: MANUAL_DEFAULTS.verified,
    })
    console.log(`[instinct] Added instinct: ${result.id}`)
    console.log(`  trigger:    ${result.trigger}`)
    console.log(`  action:     ${result.action}`)
    console.log(`  confidence: ${result.confidence}`)
    console.log(`  source:     ${result.source}`)
    console.log(`  verified:   ${result.verified}`)
  })

// ── setup ─────────────────────────────────────────────────────────────────────
program
  .command('setup')
  .description('Check all prerequisites and print setup instructions')
  .action(() => {
    const { homedir } = require('os') as typeof import('os')
    const root = resolve('.')
    const envPath = join(homedir(), '.orchestos', '.env')
    const dbPath  = join(homedir(), '.orchestos', 'db.sqlite')

    // ── helpers ────────────────────────────────────────────────────────────────
    const GREEN  = '\x1b[32m'
    const RED    = '\x1b[31m'
    const YELLOW = '\x1b[33m'
    const BOLD   = '\x1b[1m'
    const DIM    = '\x1b[2m'
    const RESET  = '\x1b[0m'
    const OK  = `${GREEN}✓${RESET}`
    const FAIL = `${RED}✗${RESET}`
    const WARN = `${YELLOW}!${RESET}`

    interface CheckItem { label: string; ok: boolean; warn?: boolean; hint?: string }
    const items: CheckItem[] = []

    // 1. Bun
    const bunVersion: string = (globalThis as any).Bun?.version ?? ''
    if (bunVersion) {
      items.push({ label: `Bun ${bunVersion}`, ok: true })
    } else {
      items.push({
        label: 'Bun no encontrado',
        ok: false,
        hint: 'Instala Bun en https://bun.sh  →  powershell -c "irm bun.sh/install.ps1 | iex"',
      })
    }

    // 2. Dependencias (node_modules / bun.lock / bun.lockb)
    const hasLock    = existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))
    const hasMods    = existsSync(join(root, 'node_modules'))
    if (hasLock && hasMods) {
      items.push({ label: 'Dependencias instaladas (node_modules)', ok: true })
    } else if (hasLock && !hasMods) {
      items.push({
        label: 'node_modules ausente',
        ok: false,
        hint: 'Ejecuta:  bun install',
      })
    } else {
      items.push({
        label: 'bun.lock ausente — puede que no estés en el directorio correcto',
        ok: false,
        warn: true,
        hint: `Directorio actual: ${root}`,
      })
    }

    // 3. API keys  (~/.orchestos/.env)
    let envContent = ''
    if (existsSync(envPath)) {
      try { envContent = readFileSync(envPath, 'utf8') } catch { /* */ }
    }
    const hasOR  = /^OPENROUTER_API_KEY\s*=\s*.+/m.test(envContent)
    const hasANT = /^ANTHROPIC_API_KEY\s*=\s*.+/m.test(envContent)
    const hasOAI = /^OPENAI_API_KEY\s*=\s*.+/m.test(envContent)

    if (hasOR) {
      items.push({ label: 'OPENROUTER_API_KEY  (requerida)', ok: true })
    } else {
      items.push({
        label: 'OPENROUTER_API_KEY faltante  (requerida)',
        ok: false,
        hint: `Añade en ${envPath}:\n      OPENROUTER_API_KEY=sk-or-...`,
      })
    }
    if (hasANT) {
      items.push({ label: 'ANTHROPIC_API_KEY  (opcional)', ok: true })
    } else {
      items.push({
        label: 'ANTHROPIC_API_KEY no configurada  (opcional — necesaria para executor: anthropic)',
        ok: true,
        warn: true,
        hint: `Añade en ${envPath}:\n      ANTHROPIC_API_KEY=sk-ant-...`,
      })
    }
    if (hasOAI) {
      items.push({ label: 'OPENAI_API_KEY  (opcional)', ok: true })
    } else {
      items.push({
        label: 'OPENAI_API_KEY no configurada  (opcional — necesaria para embeddings OpenAI)',
        ok: true,
        warn: true,
        hint: `Añade en ${envPath}:\n      OPENAI_API_KEY=sk-...`,
      })
    }

    // 4. tasks.yaml
    if (existsSync(join(root, 'tasks.yaml'))) {
      items.push({ label: 'tasks.yaml encontrado', ok: true })
    } else {
      items.push({
        label: 'tasks.yaml no encontrado',
        ok: false,
        hint: 'Crea uno con:  orchestos task init',
      })
    }

    // 5. Base de datos
    if (existsSync(dbPath)) {
      items.push({ label: `Base de datos (db.sqlite)`, ok: true })
    } else {
      items.push({
        label: 'db.sqlite no inicializada',
        ok: false,
        hint: 'Se crea automáticamente al ejecutar cualquier comando orchestos',
      })
    }

    // 6. Índice de código (proyecto en DB)
    let indexed = false
    try {
      const { getProject } = require('./db/projects.ts') as typeof import('./db/projects.ts')
      const proj = getProject(root)
      indexed = !!proj
    } catch { /* DB may not exist yet */ }
    if (indexed) {
      items.push({ label: 'Proyecto indexado en el code graph', ok: true })
    } else {
      items.push({
        label: 'Proyecto no indexado',
        ok: false,
        warn: true,
        hint: `Indexa con:  orchestos index ${root}`,
      })
    }

    // ── render ─────────────────────────────────────────────────────────────────
    const LINE = '─'.repeat(52)
    console.log()
    console.log(`${BOLD}OrchestOS — Setup Check${RESET}`)
    console.log('═'.repeat(52))
    console.log()

    const failures: CheckItem[] = []
    for (const item of items) {
      const icon = item.ok ? (item.warn ? WARN : OK) : FAIL
      console.log(`  ${icon}  ${item.label}`)
      if (!item.ok && item.hint) {
        for (const line of item.hint.split('\n')) {
          console.log(`     ${DIM}${line}${RESET}`)
        }
      }
      if (!item.ok) failures.push(item)
    }

    console.log()
    console.log(DIM + LINE + RESET)
    const criticalFails = failures.filter(f => !f.warn).length
    if (criticalFails === 0) {
      console.log(`  ${OK}  ${GREEN}${BOLD}Todo listo.${RESET}  Abre el dashboard con:  ${BOLD}orchestos dashboard${RESET}`)
    } else {
      console.log(`  ${FAIL}  ${RED}${criticalFails} item${criticalFails > 1 ? 's' : ''} pendiente${criticalFails > 1 ? 's' : ''}.${RESET}  Resuélvelos y vuelve a ejecutar:  ${BOLD}orchestos setup${RESET}`)
    }
    console.log()
  })

// ── dashboard ──────────────────────────────────────────────────────────────────
program
  .command('dashboard')
  .description('Start the local dashboard server')
  .option('--port <n>', 'Port to listen on', '4242')
  .action(async (opts: { port?: string }) => {
    const { startServer } = await import('./dashboard/server.ts')
    const port = parseInt(opts.port ?? '4242')

    // I3: Auto-run bun install if lockfile exists but node_modules missing
    const root = resolve('.')
    const hasLock = existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))
    const hasMods = existsSync(join(root, 'node_modules'))
    if (hasLock && !hasMods) {
      console.log('[dashboard] node_modules missing — running bun install...')
      const proc = Bun.spawnSync(['bun', 'install'], { cwd: root })
      if (proc.exitCode === 0) {
        console.log('[dashboard] bun install completed successfully.')
      } else {
        console.error(`[dashboard] bun install failed (exit ${proc.exitCode}): ${proc.stderr.toString()}`)
        console.error('[dashboard] Run "bun install" manually in the project directory.')
      }
    }

    const { url } = startServer(port)
    console.log(`[dashboard] Open ${url} in your browser`)
    await new Promise(() => {}) // keep process alive
  })

program.parse()

// ── helpers ───────────────────────────────────────────────────────────────────
import { printGraphSummary } from './run/graph-summary.ts'

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

function resolveIndexRoot(targetPath?: string, projectName?: string): string {
  if (!projectName) return resolve(targetPath ?? '.')
  const rows = listProjects()
  for (const row of rows) {
    const profile = JSON.parse(row.stack_profile) as StackProfile
    if (profile.manifest.name === projectName || row.path === projectName) return row.path
  }
  return resolve(projectName)
}

async function ensureProject(root: string) {
  const existing = getProject(root)
  if (existing) return existing
  const profile = await buildProfile(root)
  const agentsMd = generateAgentsMd(profile)
  upsertProject(root, profile, agentsMd)
  const created = getProject(root)
  if (!created) throw new Error(`[index] failed to save project context for ${root}`)
  return created
}

function explainTaskRun(root: string, taskId: string, projectId?: string) {
  const file = loadTasks(root)
  const t = file.tasks.find(x => x.id === taskId)
  if (!t) {
    console.error(`[task] Task "${taskId}" not found`)
    process.exit(1)
  }

  const taskClass        = classifyTask(t.description)
  const cfgPath          = join(root, 'orchestos.config.yaml')
  const cfgFound         = existsSync(cfgPath)
  const cfg              = loadOrcheConfig(root)
  const route            = autoRoute(t, cfg, cfgFound)
  const model            = route?.model ?? resolveModel(taskClass)
  const providerName     = route?.provider ?? t.executor
  const modelDisplay     = route ? `${providerName}/${model} [${route.role}]` : `${model} (${taskClass})`
  const suggestions = projectId
    ? suggestContext(projectId, t.description, { topN: 5 })
    : []
  const implicitInput = t.input.length === 0 ? suggestions.map(s => s.path) : []
  const inputSource = t.input.length > 0 ? 'explicit' : implicitInput.length > 0 ? 'graph' : 'none'

  console.log(`\n[task:explain] ${t.id}`)
  console.log(`description: ${t.description}`)
  console.log(`status:      ${t.status}`)
  console.log(`executor:    ${providerName}`)
  console.log(`model:       ${modelDisplay}`)
  console.log(`outputs:     ${t.output.join(', ')}`)

  console.log(`\n## Files`)
  console.log(`input used (${inputSource}): ${formatList(t.input.length > 0 ? t.input : implicitInput)}`)
  if (!projectId) {
    console.log(`graph suggestions: (none - run "orchestos init" or "orchestos index" first)`)
  } else {
    console.log(`graph suggestions: ${formatList(suggestions.map(s => `${s.path} score=${s.score}`))}`)
  }

  console.log(`\n## Checks`)
  if (t.checks && t.checks.length > 0) {
    for (const c of t.checks) {
      const expect = c.expect_exit ?? 0
      const timeout = c.timeout_ms ? ` timeout=${c.timeout_ms}ms` : ''
      const cwd = c.cwd ? ` cwd=${c.cwd}` : ''
      console.log(`- ${c.cmd} (expect exit ${expect}${cwd}${timeout})`)
    }
  } else {
    console.log('(none)')
  }

  console.log(`\n## Acceptance criteria`)
  if (t.acceptance_criteria && t.acceptance_criteria.length > 0) {
    for (const c of t.acceptance_criteria) console.log(`- ${c}`)
  } else {
    console.log('(none)')
  }

  // Constitution
  const cst = loadConstitution(root)
  console.log(`\n## Constitution`)
  if (cst) {
    console.log(`loaded: ${cst.ruleCount} rules (${cst.forbidden.length} forbidden, ${cst.require_confirmation.length} require confirmation, ${cst.allowed.length} allowed)`)
  } else {
    console.log(`(none — create with: orchestos constitution init)`)
  }

  console.log(`\n[task:explain] dry-run only - no LLM call, no files written, no task status changes.`)
}

async function runClarifyMode(
  root: string,
  taskId: string,
  projectId: string | undefined,
  orcheConfig: import('./config/schema.ts').OrcheConfig,
  orcheConfigFound: boolean,
): Promise<void> {
  const { createInterface } = await import('readline')
  const file = loadTasks(root)
  const t = file.tasks.find(x => x.id === taskId)
  if (!t) {
    console.error(`[task] Task "${taskId}" not found`)
    process.exit(1)
  }

  console.log(`\n[task:clarify] ${t.id}`)
  console.log(`description: ${t.description}`)
  console.log(`executor:    ${t.executor}`)
  console.log(`outputs:     ${t.output.join(', ')}`)

  const flagged = needsClarify(t)
  if (flagged) {
    console.log(`\n⚠  Ambiguity detected: ${clarifyReason(t)}`)
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer: string = await new Promise(resolve => {
    rl.question('\nAny clarifications for the agent? (press Enter to run as-is): ', resolve)
  })
  rl.close()

  const clarification = answer.trim()

  const taskWithClarification: import('./tasks/schema.ts').Task = clarification
    ? { ...t, description: `${t.description}\n\nUser clarification: ${clarification}` }
    : t

  const projectContext = loadContext(root)
  const project = projectId ? { id: projectId } : getProject(root)
  const log = new RunLogger(root, taskId)

  console.log(`\n[task:clarify] Running ${taskId}${clarification ? ' with clarification' : ''}...`)
  updateTaskStatus(root, taskId, { status: 'running' })

  const result = await runTask({
    projectRoot: root,
    contextText: projectContext,
    task: taskWithClarification,
    projectId: project?.id,
    logger: log,
    orcheConfig,
    orcheConfigFound,
  })

  if (result.status === 'done') {
    updateTaskStatus(root, taskId, { status: 'done', run_id: result.runId, qa_verdict: 'pass', retry_reason: undefined })
    console.log(`[task] ✓ ${taskId} done · QA pass`)
  } else if (result.status === 'retry') {
    updateTaskStatus(root, taskId, { status: 'pending', retry_count: t.retry_count + 1, retry_reason: result.retryReason })
    console.log(`[task] ↺ ${taskId} retry · ${result.retryReason}`)
  } else if (result.status === 'pending') {
    updateTaskStatus(root, taskId, { status: 'pending', retry_reason: result.retryReason })
    console.log(`[task] ⏸ ${taskId} pending · ${result.retryReason}`)
  } else {
    updateTaskStatus(root, taskId, { status: 'failed', retry_reason: result.retryReason })
    console.log(`[task] ✗ ${taskId} failed · ${result.retryReason}`)
  }
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : '(none)'
}

type StoredCheck = {
  cmd: string
  exitCode: number
  elapsedMs: number
  timedOut?: boolean
}

function printRunDetail(r: import('./db/runs.ts').RunRecord) {
  const checks = parseJson<StoredCheck[]>(r.checks_json, [])
  const allowed = parseJson<string[]>(r.allowed_outputs, [])
  const attempted = parseJson<string[]>(r.files_attempted, [])
  const authorized = parseJson<string[]>(r.files_authorized, [])
  const blocked = parseJson<string[]>(r.files_blocked, [])
  const snapshotBefore = parseJson<Record<string, string | null>>(r.snapshot_before, {})
  const snapshotAfter = parseJson<Record<string, string | null>>(r.snapshot_after, {})

  console.log(`\n## Provider`)
  console.log(`executor: ${r.provider ?? '-'}   model: ${r.model}   class: ${r.task_class}`)
  console.log(`run: ${r.id}   task: ${r.task_id ?? '-'}   status: ${r.status}   date: ${r.created_at}`)
  console.log(`prompt: ${r.prompt}`)
  const constitutionInfo = (r as any).constitution_rules != null
    ? `constitution: loaded (${(r as any).constitution_rules} rules)`
    : `constitution: none`
  console.log(constitutionInfo)
  const contextInfo = (r as any).context_source
    ? `context: ${(r as any).context_source} (${(r as any).context_tokens ?? '?'} tokens)`
    : `context: AGENTS.md`
  console.log(contextInfo)

  const contextWarnings = parseJson<Array<{ code: string; severity: string; message: string }>>((r as any).context_warnings_json, [])
  if (contextWarnings.length > 0) {
    console.log(`\n## Context monitor warnings`)
    for (const w of contextWarnings) {
      console.log(`[${w.severity.toUpperCase()}] ${w.code}: ${w.message}`)
    }
  }

  console.log(`\n## Checks (deterministic)`)
  if (checks.length === 0) {
    console.log('(none)')
  } else {
    for (const c of checks) {
      const pass = !c.timedOut && c.exitCode === 0
      const status = c.timedOut ? 'timeout' : `exit ${c.exitCode}`
      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${c.cmd} - ${status}, ${formatElapsed(c.elapsedMs)}`)
    }
  }

  console.log(`\n## Acceptance criteria (LLM)`)
  if (!r.qa_verdict) {
    console.log('(not run)')
  } else {
    console.log(`[${r.qa_verdict === 'pass' ? 'PASS' : 'FAIL'}] ${r.qa_reason ?? '(no reason recorded)'}`)
  }

  console.log(`\n## Files`)
  console.log(`allowed:    ${formatList(allowed)}`)
  console.log(`attempted:  ${formatList(attempted)}`)
  console.log(`written:    ${formatList(authorized)}`)
  console.log(`blocked:    ${formatList(blocked)}`)
  if (Object.keys(snapshotBefore).length > 0) console.log(`snap_before:${JSON.stringify(snapshotBefore)}`)
  if (Object.keys(snapshotAfter).length > 0) console.log(`snap_after: ${JSON.stringify(snapshotAfter)}`)
  if (r.result) console.log(`result:     ${r.result}`)

  console.log(`\n## Cost`)
  const breakdown = parseCostBreakdownJson((r as any).cost_breakdown_json)
  if (breakdown.length > 1) {
    const header = `  ${'agent'.padEnd(22)} ${'model'.padEnd(28)} ${'in'.padStart(8)} ${'out'.padStart(8)} ${'cost'.padStart(10)}`
    console.log(header)
    console.log(`  ${'─'.repeat(header.length - 2)}`)
    for (const e of breakdown) {
      const costStr = `$${e.costUsd.toFixed(6)}`
      console.log(`  ${e.label.padEnd(22)} ${e.model.padEnd(28)} ${String(e.inputTokens).padStart(8)} ${String(e.outputTokens).padStart(8)} ${costStr.padStart(10)}`)
    }
    console.log(`  ${'─'.repeat(header.length - 2)}`)
  }
  console.log(`input: ${r.input_tokens} tokens   output: ${r.output_tokens} tokens   $${r.usd_cost.toFixed(6)}   elapsed: ${formatElapsed(r.elapsed_ms)}`)
  console.log()
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function formatElapsed(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}
