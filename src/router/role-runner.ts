import { resolveRole } from '../config/load.ts'
import type { OrcheConfig, RoleAgent, RoleAssignment, RoleName } from '../config/schema.ts'
import { getProvider, type ProviderClient } from '../providers/index.ts'
import { type CliRoleDeps, cliChatAdapterFor } from '../run/executors/chat-adapters.ts'

interface RoleClient {
  role: RoleName
  agent: RoleAgent
  model: string
  effort?: string
  provider: ProviderClient
}

interface RoleRunnerDeps extends CliRoleDeps {
  getProvider?: typeof getProvider
}

export function clientFromAssignment(
  role: RoleName,
  a: RoleAssignment,
  opts: { cwd: string; projectRoot?: string; timeoutMs?: number; deps?: RoleRunnerDeps },
): RoleClient {
  const deps = opts.deps ?? {}
  const providerName = `role:${a.agent}`
  const provider: ProviderClient = {
    name: providerName,
    async chat(input) {
      if (a.agent === 'api')
        return (deps.getProvider ?? getProvider)(a.provider ?? 'openrouter').chat(input, {
          projectRoot: opts.projectRoot ?? opts.cwd,
        })
      const userMessage = input.messages.map((m) => `## ${m.role}\n${m.content}`).join('\n\n')
      const timeout = opts.timeoutMs ?? 20 * 60_000
      const adapter = cliChatAdapterFor(a.agent)
      if (!adapter) throw new Error(`chat no soportado: ${a.agent}`)
      const result = await adapter.runRole({
        cwd: opts.cwd,
        projectRoot: opts.projectRoot,
        system: input.system,
        message: userMessage,
        timeout,
        model: a.model,
        effort: a.effort,
        deps,
      })
      return {
        text: result.text,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: result.model,
        usd: result.usd,
      }
    },
  }
  return { role, agent: a.agent, model: a.model, effort: a.effort, provider }
}

export function roleClient(
  cfg: OrcheConfig,
  role: RoleName,
  opts: { cwd: string; projectRoot?: string; timeoutMs?: number; deps?: RoleRunnerDeps },
): RoleClient {
  return clientFromAssignment(role, resolveRole(cfg, role), opts)
}
