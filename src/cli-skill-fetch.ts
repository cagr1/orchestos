import { Command } from 'commander'
import { DASHBOARD_URL } from './cli-skill-curate.ts'
import type { RegistryListResponse, RegistryImportResponse } from './dashboard/types.ts'

async function callDashboardGet(path: string): Promise<Response> {
  const resp = await fetch(`${DASHBOARD_URL}${path}`, { method: 'GET' })
  return resp
}

async function callDashboardPost(path: string): Promise<Response> {
  const resp = await fetch(`${DASHBOARD_URL}${path}`, { method: 'POST' })
  return resp
}

export function registerSkillFetchCommands(skill: Command): void {
  skill
    .command('fetch')
    .description('List or import skills from the community registry')
    .option('--list', 'List all available skills from the registry')
    .option('--name <name>', 'Import a specific skill by ID from the registry')
    .action(async (opts) => {
      if (opts.list) {
        let resp: Response
        try {
          resp = await callDashboardGet('/api/skills/registry')
        } catch {
          console.error(`[skill fetch] Cannot connect to dashboard at ${DASHBOARD_URL}`)
          console.error(`  Start the dashboard: orchestos dashboard`)
          console.error(`  Or set ORCHESTOS_API_URL to your dashboard URL`)
          process.exit(1)
        }
        const data = await resp.json() as RegistryListResponse
        if (!data.ok) {
          console.error(`[skill fetch] Error: registry unavailable`)
          process.exit(1)
        }
        if (data.skills.length === 0) {
          console.log('[skill fetch] No skills found in registry.')
          return
        }
        for (const s of data.skills) {
          const desc = s.description ? ` — ${s.description.slice(0, 60)}` : ''
          console.log(`  ${s.id}${desc}`)
        }
        console.log(`\n  ${data.count} skills available. Use --name <id> to import one.`)
      } else if (opts.name) {
        const id = opts.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
        let resp: Response
        try {
          resp = await callDashboardPost(`/api/skills/registry/${encodeURIComponent(id)}/import`)
        } catch {
          console.error(`[skill fetch] Cannot connect to dashboard at ${DASHBOARD_URL}`)
          console.error(`  Start the dashboard: orchestos dashboard`)
          console.error(`  Or set ORCHESTOS_API_URL to your dashboard URL`)
          process.exit(1)
        }
        const data = await resp.json() as RegistryImportResponse
        if (data.ok) {
          const label = data.normalized ? ' (normalized by AI)' : ''
          console.log(`[skill fetch] Imported "${id}" → skills/${id}.yaml${label}`)
        } else {
          console.error(`[skill fetch] Error: ${data.error || 'import failed'}`)
          process.exit(1)
        }
      } else {
        console.error(`Usage: orchestos skill fetch [options]`)
        console.error(`  Use --list to see available skills from the registry`)
        console.error(`  Use --name <id> to import a specific skill`)
      }
    })
}
