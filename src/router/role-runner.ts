import { resolveRole } from '../config/load.ts'
import type { OrcheConfig, RoleAgent, RoleAssignment, RoleName } from '../config/schema.ts'
import { getProvider, type ProviderClient } from '../providers/index.ts'
import { runCodexChat } from '../run/executors/codex.ts'
import { runClaudeChat } from '../run/executors/external.ts'
import { runOpencodeChat } from '../run/executors/opencode.ts'

export interface RoleClient {
  role: RoleName
  agent: RoleAgent
  model: string
  effort?: string
  provider: ProviderClient
}

export interface RoleRunnerDeps {
  claude?: typeof runClaudeChat
  codex?: typeof runCodexChat
  opencode?: typeof runOpencodeChat
  getProvider?: typeof getProvider
}

export function clientFromAssignment(
  role: RoleName,
  a: RoleAssignment,
  opts: { cwd: string; timeoutMs?: number; deps?: RoleRunnerDeps },
): RoleClient {
  const deps = opts.deps ?? {}
  const providerName = `role:${a.agent}`
  const provider: ProviderClient = {
    name: providerName,
    async chat(input) {
      if (a.agent === 'api')
        return (deps.getProvider ?? getProvider)(a.provider ?? 'openrouter').chat(input)
      const userMessage = input.messages.map((m) => `## ${m.role}\n${m.content}`).join('\n\n')
      const timeout = opts.timeoutMs ?? 20 * 60_000
      const result =
        a.agent === 'claude'
          ? await (deps.claude ?? runClaudeChat)(
              opts.cwd,
              input.system,
              userMessage,
              timeout,
              a.model,
              a.effort,
            )
          : a.agent === 'codex'
            ? await (deps.codex ?? runCodexChat)(
                opts.cwd,
                input.system,
                userMessage,
                timeout,
                a.model,
                a.effort,
              )
            : await (deps.opencode ?? runOpencodeChat)(
                opts.cwd,
                input.system,
                userMessage,
                timeout,
                a.model,
              )
      return {
        text: result.text,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: result.model,
      }
    },
  }
  return { role, agent: a.agent, model: a.model, effort: a.effort, provider }
}

export function roleClient(
  cfg: OrcheConfig,
  role: RoleName,
  opts: { cwd: string; timeoutMs?: number; deps?: RoleRunnerDeps },
): RoleClient {
  return clientFromAssignment(role, resolveRole(cfg, role), opts)
}
