import { cliChatAdapterFor } from '../run/executors/chat-adapters.ts'
import { readCliHealth } from '../run/executors/cli-health.ts'
import { detectInstalledClis } from '../run/executors/cli-registry.ts'
import { readEnv } from './settings-store.ts'

export interface DefaultChatCli {
  id: string
  installed: boolean
  chat: boolean
  functional: boolean
}

export function resolveDefaultChatAgent(input: {
  configAgent?: string | null
  clis: DefaultChatCli[]
  hasOpenRouterKey: boolean
}): string | null {
  return (
    input.configAgent ||
    input.clis.find((cli) => cli.installed && cli.chat && cli.functional)?.id ||
    (input.hasOpenRouterKey ? 'api' : null)
  )
}

export interface DefaultChatAgentDeps {
  detect?: () => Pick<DefaultChatCli, 'id' | 'installed'>[]
  health?: () => Promise<Pick<DefaultChatCli, 'id' | 'functional'>[]>
  chat?: (id: string) => boolean
  key?: () => string | undefined
}

export async function readDefaultChatAgent(
  configAgent?: string | null,
  deps: DefaultChatAgentDeps = {},
): Promise<string | null> {
  if (configAgent) return configAgent
  const clis = (deps.detect ?? detectInstalledClis)()
  const health = await (deps.health ?? readCliHealth)()
  const key = deps.key ?? (() => readEnv().OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY)
  return resolveDefaultChatAgent({
    configAgent,
    clis: clis.map((cli) => ({
      ...cli,
      chat: (deps.chat ?? ((id) => !!cliChatAdapterFor(id)?.chat))(cli.id),
      functional: health.find((state) => state.id === cli.id)?.functional ?? false,
    })),
    hasOpenRouterKey: !!key(),
  })
}

export function aiSessionSetupCheck(agent: string | null, envPath: string) {
  return agent
    ? { label: `CLI de IA con sesión: ${agent}`, ok: true }
    : {
        label: 'Ninguna CLI de IA con sesión',
        ok: false,
        hint: `Instala e inicia sesión en Claude Code, Codex u OpenCode, o añade OPENROUTER_API_KEY en ${envPath}`,
      }
}

export const NO_AI_CHAT_MESSAGE =
  'No AI CLI is signed in (Claude Code, Codex, OpenCode…) and OPENROUTER_API_KEY is not set. Sign in to a CLI or add the key to ~/.orchestos/.env.'

export async function resolveChatErrorMessage(
  message: string,
  deps: DefaultChatAgentDeps = {},
): Promise<string> {
  if (
    message.startsWith('OPENROUTER_API_KEY not found.') &&
    !(await readDefaultChatAgent(undefined, deps))
  )
    return NO_AI_CHAT_MESSAGE
  return message
}
