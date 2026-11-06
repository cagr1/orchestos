import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

async function setupWithAgent(agent: string | null): Promise<string> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-setup-'))
  try {
    const root = join(home, 'project')
    mkdirSync(join(root, 'node_modules'), { recursive: true })
    writeFileSync(join(root, 'bun.lock'), '')
    writeFileSync(join(root, 'tasks.yaml'), 'tasks: []\n')
    const resolverPath = resolve('src/dashboard/default-chat-agent.ts')
    const preload = join(home, 'setup-preload.ts')
    writeFileSync(
      preload,
      `
      import { mock } from 'bun:test'
      const actual = await import(${JSON.stringify(resolverPath)})
      mock.module(${JSON.stringify(resolverPath)}, () => ({
        ...actual,
        readDefaultChatAgent: async () => ${JSON.stringify(agent)},
      }))
    `,
    )
    const proc = Bun.spawn(
      [process.execPath, '--preload', preload, resolve('src/cli.ts'), 'setup'],
      {
        cwd: root,
        env: {
          ...process.env,
          HOME: home,
          ORCHESTOS_HOME: home,
          OPENROUTER_API_KEY: '',
          ORCHESTOS_CLAUDE_USAGE_LIVE: '0',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(code).toBe(0)
    expect(stderr).not.toContain('error:')
    return stdout.replace(/\x1b\[[0-9;]*m/g, '')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

test('setup succeeds without an OpenRouter key when a CLI is signed in', async () => {
  const output = await setupWithAgent('codex')
  expect(output).toContain('✓  CLI de IA con sesión: codex')
  expect(output).toContain('!  OPENROUTER_API_KEY no configurada  (opcional)')
  expect(output).toContain('Todo listo.')
  expect(output).not.toContain('pendiente')
})

test('setup reports one pending item without a key or a signed-in CLI', async () => {
  const output = await setupWithAgent(null)
  expect(output).toContain('✗  Ninguna CLI de IA con sesión')
  expect(output).toContain(
    'Instala e inicia sesión en Claude Code, Codex u OpenCode, o añade OPENROUTER_API_KEY en ',
  )
  expect(output).toContain('1 item pendiente.')
})
