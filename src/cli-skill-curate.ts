import { Command } from 'commander'
import { stringify as yamlStringify } from 'yaml'
import type { SkillCurateResponse, SkillImportResponse, MutationResult } from './dashboard/types.ts'

export const DASHBOARD_URL = process.env.ORCHESTOS_API_URL || 'http://localhost:4242'

export async function callDashboardApi(path: string, body: unknown): Promise<Response> {
  const resp = await fetch(`${DASHBOARD_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return resp
}

export async function handleCurate(description: string, save?: boolean): Promise<void> {
  let resp: Response
  try {
    resp = await callDashboardApi('/api/skills/curate', { text: description })
  } catch {
    console.error(`[skill curate] Cannot connect to dashboard at ${DASHBOARD_URL}`)
    console.error(`  Start the dashboard: orchestos dashboard`)
    console.error(`  Or set ORCHESTOS_API_URL to your dashboard URL`)
    process.exit(1)
  }
  const data = await resp.json() as SkillCurateResponse
  if (!data.ok || !data.skill) {
    console.error(`[skill curate] Error: ${data.error ?? 'unknown'}`)
    process.exit(1)
  }
  const yaml = yamlStringify(data.skill, { lineWidth: 120 })
  console.log(yaml)

  if (save) {
    let saveResp: Response
    try {
      saveResp = await callDashboardApi('/api/skills', data.skill)
    } catch {
      console.error(`[skill curate] Cannot connect to dashboard at ${DASHBOARD_URL}`)
      process.exit(1)
    }
    const saveData = await saveResp.json() as MutationResult
    if (!saveData.ok) {
      console.error(`[skill curate] Save error: ${saveData.error ?? 'unknown'}`)
      process.exit(1)
    }
    console.log(`[skill curate] Saved as skills/${data.skill.id}.yaml`)
  }
}

export async function handleImport(url: string): Promise<void> {
  let resp: Response
  try {
    resp = await callDashboardApi('/api/skills/import', { type: 'url', url })
  } catch {
    console.error(`[skill import] Cannot connect to dashboard at ${DASHBOARD_URL}`)
    console.error(`  Start the dashboard: orchestos dashboard`)
    console.error(`  Or set ORCHESTOS_API_URL to your dashboard URL`)
    process.exit(1)
  }
  const data = await resp.json() as SkillImportResponse
  if (!data.ok || !data.skill) {
    console.error(`[skill import] Error: ${data.error ?? 'unknown'}`)
    process.exit(1)
  }
  if (data.normalized && data.warnings.length > 0) {
    for (const w of data.warnings) console.warn(`  [skill import] ${w}`)
  }

  let saveResp: Response
  try {
    saveResp = await callDashboardApi('/api/skills', data.skill)
  } catch {
    console.error(`[skill import] Cannot connect to dashboard at ${DASHBOARD_URL}`)
    process.exit(1)
  }
  const saveData = await saveResp.json() as MutationResult
  if (!saveData.ok) {
    console.error(`[skill import] Save error: ${saveData.error ?? 'unknown'}`)
    process.exit(1)
  }

  const label = data.normalized ? ' (normalized by AI)' : ''
  console.log(`[skill import] Imported and saved as skills/${data.skill.id}.yaml${label}`)
}

export function registerSkillCurateImportCommands(parent: Command): void {
  parent
    .command('curate <description>')
    .description('Generate a skill YAML from natural language via AI curator')
    .option('--save', 'Save the curated skill directly to skills/')
    .action(async (description: string, opts: { save?: boolean }) => {
      await handleCurate(description, opts.save)
    })

  parent
    .command('import <url>')
    .description('Import a skill from a URL — fetches, normalizes via AI, saves to skills/')
    .action(async (url: string) => {
      await handleImport(url)
    })
}
