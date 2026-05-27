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
import { MAX_RETRIES } from './run/qa.ts'
import { RunLogger } from './run/logger.ts'
import { runTask } from './run/harness.ts'
import { insertRun } from './db/runs.ts'
import { loadTasks, saveTasks, tasksExist, updateTaskStatus, hashFile, tasksPath } from './tasks/loader.ts'
import { stringify as yamlStringify } from 'yaml'
import { readFileSync } from 'fs'
import { generateSummaryPdf } from './generators/summary-pdf.ts'
import { indexProject } from './graph/index.ts'

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
    const elapsed = Math.round(performance.now() - t0)
    console.log(`[init] ${profile.manifest.name} saved in ${elapsed}ms`)
    console.log(`  → AGENTS.md`)
    console.log(`  → context.json`)
    console.log(`  → ~/.orchestos/db.sqlite`)
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
  .action(async (targetPath?: string, opts?: { project?: string }) => {
    const root = resolveIndexRoot(targetPath, opts?.project)
    const project = await ensureProject(root)
    const t0 = performance.now()
    const result = await indexProject(root, project.id)
    const elapsed = Math.round(performance.now() - t0)
    console.log(`[index] indexed ${result.files} files, ${result.edges} edges in ${elapsed}ms`)
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
  .action((opts: { limit: string; detail?: string; export?: boolean }) => {
    const { listRuns, getRun } = require('./db/runs.ts')

    if (opts.detail) {
      const r = getRun(opts.detail)
      if (!r) { console.error(`[runs] Run not found: ${opts.detail}`); process.exit(1) }
      const icon = r.status === 'done' ? '✓' : '✗'
      console.log(`\n  ${icon} Run: ${r.id}`)
      console.log(`  ${'─'.repeat(60)}`)
      console.log(`  date:       ${r.created_at}`)
      console.log(`  task:       ${r.task_id ?? '-'}`)
      console.log(`  prompt:     ${r.prompt}`)
      console.log(`  model:      ${r.model} (${r.task_class})`)
      console.log(`  status:     ${r.status}`)
      console.log(`  qa_verdict: ${r.qa_verdict ?? '-'}`)
      if (r.qa_reason)  console.log(`  qa_reason:  ${r.qa_reason}`)
      console.log(`  tokens:     ${r.input_tokens} in / ${r.output_tokens} out`)
      console.log(`  cost:       $${r.usd_cost.toFixed(6)}`)
      console.log(`  elapsed:    ${r.elapsed_ms}ms`)
      if (r.checks_json) {
        const checks = JSON.parse(r.checks_json)
        console.log(`  checks:`)
        for (const c of checks) {
          const status = c.timedOut ? 'timeout' : `exit ${c.exitCode}`
          console.log(`    - ${c.cmd} -> ${status} (${c.elapsedMs}ms)`)
        }
      }
      if (r.allowed_outputs)  console.log(`  allowed:    ${JSON.parse(r.allowed_outputs).join(', ')}`)
      if (r.files_attempted)  console.log(`  attempted:  ${JSON.parse(r.files_attempted).join(', ')}`)
      if (r.files_authorized) console.log(`  authorized: ${JSON.parse(r.files_authorized).join(', ')}`)
      const blocked = r.files_blocked ? JSON.parse(r.files_blocked) : []
      if (blocked.length > 0) console.log(`  blocked:    ${blocked.join(', ')}  ← CONTRACT VIOLATION`)
      if (r.snapshot_before)  console.log(`  snap_before:${JSON.stringify(JSON.parse(r.snapshot_before), null, 0)}`)
      if (r.snapshot_after)   console.log(`  snap_after: ${JSON.stringify(JSON.parse(r.snapshot_after), null, 0)}`)
      if (r.result)           console.log(`  result:     ${r.result}`)
      console.log()
      return
    }

    if (opts.export) {
      const rows = listRuns(0)   // 0 = unlimited
      const outPath = join(resolve('.'), 'runs-export.json')
      writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf-8')
      console.log(`[runs] Exported ${rows.length} run(s) → ${outPath}`)
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
    const isNode   = manifest.runtime   === 'Node.js'
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
  .command('run [path]')
  .description('Execute the next pending task with contract enforcement')
  .option('--id <task-id>', 'Run a specific task by id')
  .option('--all', 'Run all pending tasks in dependency order')
  .action(async (targetPath?: string, opts?: { id?: string; all?: boolean }) => {
    const root = resolve(targetPath ?? '.')
    const projectContext = loadContext(root)

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

      // mark running + open log
      const log = new RunLogger(root, taskId)
      updateTaskStatus(root, taskId, { status: 'running' })
      console.log(`\n[task] Running: ${taskId}`)
      console.log(`  description: ${t.description}`)
      console.log(`  output:      ${t.output.join(', ')}`)

      const result = await runTask({ projectRoot: root, contextText: projectContext, task: t, logger: log })

      // map TaskResult → updateTaskStatus
      if (result.status === 'done') {
        updateTaskStatus(root, taskId, { status: 'done', run_id: result.runId, qa_verdict: 'pass', retry_reason: undefined })
        console.log(`[task] ✓ ${taskId} done · QA pass — ${result.qaReason}`)
        for (const f of result.filesWritten) console.log(`  → ${f}`)
        console.log(`  tokens: ${result.cost.inputTokens}/${result.cost.outputTokens} · $${result.cost.usd.toFixed(5)} · ${result.elapsedMs}ms`)
        return 'done'
      }

      if (result.status === 'retry') {
        const retryCount = t.retry_count + 1
        updateTaskStatus(root, taskId, { status: 'pending', qa_verdict: 'fail', retry_reason: result.retryReason, retry_count: retryCount })
        console.error(`[task] ✗ QA fail — ${result.qaReason}`)
        console.error(`  retry_count=${retryCount}/${MAX_RETRIES} → back to pending`)
        return 'retry'
      }

      // failed
      updateTaskStatus(root, taskId, { status: t.retry_count + 1 >= MAX_RETRIES ? 'failed_permanent' : 'failed', retry_reason: result.retryReason })
      console.error(`[task] ✗ ${taskId} failed — ${result.retryReason}`)
      return 'failed'
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
