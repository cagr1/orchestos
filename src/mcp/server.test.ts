import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runToolLoop } from '../providers/tool-call.ts'
import { buildCodexChatArgs } from '../run/executors/codex.ts'
import {
  claudeEventToStep,
  codexEventToStep,
  readonlyCommandTarget,
} from '../run/executors/step-event.ts'
import {
  claudeMcpArgs,
  codexExecMcpArgs,
  codexMcpThreadConfig,
  createTaskApiTool,
  type TaskProposal,
  taskProposalFromStep,
} from './adapters.ts'
import { CREATE_TASK_RESPONSE, parseCreateTaskArgs } from './server.ts'

const SERVER = join(import.meta.dir, 'server.ts')

async function talk(args: string[], requests: object[]): Promise<any[]> {
  const proc = Bun.spawn([process.execPath, SERVER, ...args], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  proc.stdin.write(`${requests.map((r) => JSON.stringify(r)).join('\n')}\n`)
  proc.stdin.end()
  const out = await new Response(proc.stdout).text()
  await proc.exited
  return out
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
}

const validArgs = { title: 'Create hello', description: 'Create hello.txt', outputs: ['hello.txt'] }

describe('servidor MCP de OrchestOS (stdio real)', () => {
  test('initialize, tools/list y tools/call; las notificaciones no tienen respuesta', async () => {
    const replies = await talk(
      [],
      [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'create_task', arguments: validArgs },
        },
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'create_task', arguments: { ...validArgs, outputs: [] } },
        },
        { jsonrpc: '2.0', id: 5, method: 'nope' },
      ],
    )
    expect(replies).toHaveLength(5)
    expect(replies[0].result.serverInfo.name).toBe('orchestos')
    expect(replies[0].result.protocolVersion).toBe('2025-03-26')
    expect(replies[1].result.tools.map((t: any) => t.name)).toEqual(['create_task'])
    expect(replies[1].result.tools[0].inputSchema.required).toEqual([
      'title',
      'description',
      'outputs',
    ])
    expect(replies[2].result).toEqual({
      content: [{ type: 'text', text: CREATE_TASK_RESPONSE }],
      isError: false,
    })
    expect(replies[3].result.isError).toBe(true)
    expect(replies[4].error.code).toBe(-32601)
  })

  test('tools/list solo lista las herramientas pedidas; la no ofrecida es desconocida', async () => {
    const [list, call] = await talk(
      ['--tools', 'run_readonly', '--root', process.cwd()],
      [
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'create_task', arguments: validArgs },
        },
      ],
    )
    expect(list.result.tools.map((t: any) => t.name)).toEqual(['run_readonly'])
    expect(call.error.code).toBe(-32602)
  })

  test('create_task puede listar herramientas sin acceder a SQLite', async () => {
    const proc = Bun.spawn(
      [process.execPath, SERVER, '--tools', 'create_task', '--root', process.cwd()],
      {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, ORCHESTOS_HOME: '/dev/null' },
      },
    )
    proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n`)
    proc.stdin.end()
    const [out, err, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(exitCode, err).toBe(0)
    expect(JSON.parse(out).result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'create_task',
    ])
  })

  test('run_readonly por stdio real: git log -1 responde con el SHA del repo', async () => {
    const sha = (await Bun.$`git rev-parse --short HEAD`.cwd(process.cwd()).text()).trim()
    const [reply, denied] = await talk(
      ['--tools', 'create_task,run_readonly', '--root', process.cwd()],
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'run_readonly',
            arguments: { argv: ['git', 'log', '-1', '--format=%h'] },
          },
        },
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'run_readonly', arguments: { argv: ['sh', '-c', 'id'] } },
        },
      ],
    )
    expect(reply.result.isError).toBe(false)
    expect(reply.result.content[0].text.trim().split('\n')[0]).toBe(sha)
    expect(denied.result.isError).toBe(true)
  })

  test('sin --tools solo create_task', async () => {
    const [reply] = await talk(
      [],
      [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'create_task', arguments: validArgs },
        },
      ],
    )
    expect(reply.result.isError).toBe(false)
  })
})

describe('parseCreateTaskArgs', () => {
  test('normaliza y valida', () => {
    expect(parseCreateTaskArgs({ ...validArgs, outputs: [' a.txt ', ''] })).toEqual({
      ok: true,
      args: { ...validArgs, outputs: ['a.txt'] },
    })
    for (const bad of [
      null,
      { ...validArgs, title: '' },
      { ...validArgs, description: 3 },
      { ...validArgs, outputs: 'a.txt' },
      { ...validArgs, outputs: [] },
      { ...validArgs, outputs: ['/etc/passwd'] },
      { ...validArgs, outputs: ['../x'] },
    ])
      expect(parseCreateTaskArgs(bad).ok).toBe(false)
  })

  test('acceptance_criteria opcional: válido pasa, inválido falla', () => {
    expect(
      parseCreateTaskArgs({ ...validArgs, acceptance_criteria: [' el botón existe '] }),
    ).toEqual({ ok: true, args: { ...validArgs, acceptance_criteria: ['el botón existe'] } })
    expect(parseCreateTaskArgs(validArgs)).toEqual({ ok: true, args: validArgs })
    for (const bad of ['x', [''], ['  '], [3]])
      expect(parseCreateTaskArgs({ ...validArgs, acceptance_criteria: bad }).ok).toBe(false)
  })
})

describe('adaptadores MCP — líneas de stream reales', () => {
  test('claude: tool_use mcp__orchestos__create_task (claude 2.1.302)', async () => {
    const line = await Bun.file(
      join(import.meta.dir, '__fixtures__', 'claude-create-task-assistant.json'),
    ).json()
    const proposals = claudeEventToStep(line)
      .map(taskProposalFromStep)
      .filter((p) => p !== null)
    expect(proposals).toEqual([
      {
        ok: true,
        args: {
          title: 'Create hello.txt',
          description:
            'Create a file named hello.txt in the project root containing exactly the text: hi',
          outputs: ['hello.txt'],
        },
      },
    ])
  })

  test('claude: argumentos inválidos se reportan, no se descartan', () => {
    expect(
      taskProposalFromStep({
        type: 'tool_use',
        label: 'mcp__orchestos__create_task',
        detail: JSON.stringify({ title: 'x' }),
      }),
    ).toMatchObject({ ok: false })
    expect(taskProposalFromStep({ type: 'tool_use', label: 'Read', detail: '{}' })).toBeNull()
  })

  test('claude y codex reciben el servidor por su mecanismo', () => {
    const offer = { tools: ['create_task', 'run_readonly'], root: '/proj' }
    const args = claudeMcpArgs(offer)
    expect(args[0]).toBe('--mcp-config')
    expect(JSON.parse(args[1]!).mcpServers.orchestos.args).toEqual([
      SERVER,
      '--tools',
      'create_task,run_readonly',
      '--root',
      '/proj',
    ])
    expect(args.slice(2)).toEqual([
      '--allowedTools',
      'mcp__orchestos__create_task',
      'mcp__orchestos__run_readonly',
    ])
    expect((codexMcpThreadConfig(offer) as any).mcp_servers.orchestos.args[0]).toBe(SERVER)
  })
})

describe('AT.20 ronda 2', () => {
  test('codex exec: item mcp_tool_call real (codex-cli 0.163.0) llega como paso create_task', async () => {
    const line = (
      await Bun.file(
        join(import.meta.dir, '__fixtures__', 'codex-exec-create-task-completed.jsonl'),
      ).text()
    ).trim()
    const proposals = codexEventToStep(JSON.parse(line))
      .map(taskProposalFromStep)
      .filter((p) => p !== null)
    expect(proposals).toEqual([
      {
        ok: true,
        args: {
          title: 'Create hello.txt',
          description: 'Create hello.txt containing hi',
          outputs: ['hello.txt'],
        },
      },
    ])
  })

  test('codex exec: el servidor va por -c solo si se ofrece la herramienta', () => {
    const offer = { tools: ['create_task'], root: '/proj' }
    const mcp = codexExecMcpArgs(offer)
    expect(mcp.filter((a) => a === '-c')).toHaveLength(3)
    expect(mcp[1]).toBe(`mcp_servers.orchestos.command=${JSON.stringify(process.execPath)}`)
    expect(mcp[3]).toBe(
      `mcp_servers.orchestos.args=${JSON.stringify([SERVER, '--tools', 'create_task', '--root', '/proj'])}`,
    )
    expect(mcp[5]).toBe('mcp_servers.orchestos.default_tools_approval_mode="approve"')
    expect(buildCodexChatArgs('p', undefined, undefined, [], offer).join(' ')).toContain(
      'mcp_servers.orchestos.command',
    )
    expect(buildCodexChatArgs('p').join(' ')).not.toContain('mcp_servers')
  })

  test('chat por API: create_task pasa por el tool loop y entrega la propuesta', async () => {
    const proposals: TaskProposal[] = []
    const api = createTaskApiTool((p) => proposals.push(p))
    const bodies: any[] = []
    const realFetch = globalThis.fetch
    const prevKey = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'test'
    let round = 0
    globalThis.fetch = (async (_url: unknown, init: any) => {
      bodies.push(JSON.parse(init.body))
      round++
      const message =
        round === 1
          ? {
              content: null,
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: {
                    name: 'create_task',
                    arguments: JSON.stringify({
                      title: 'Hello',
                      description: 'Create hello.txt',
                      outputs: ['hello.txt'],
                    }),
                  },
                },
              ],
            }
          : { content: 'Proposed.' }
      return new Response(JSON.stringify({ choices: [{ message }], usage: {} }))
    }) as typeof fetch
    try {
      const result = await runToolLoop('openrouter', 'm/x', {
        system: 's',
        messages: [{ role: 'user', content: 'make hello.txt' }],
        tools: [api.tool],
        executeTool: api.execute,
      })
      expect(result.text).toBe('Proposed.')
      expect(bodies[0].tools[0].function.name).toBe('create_task')
      expect(bodies[1].messages.at(-1).content).toBe(CREATE_TASK_RESPONSE)
      expect(proposals).toEqual([
        {
          ok: true,
          args: { title: 'Hello', description: 'Create hello.txt', outputs: ['hello.txt'] },
        },
      ])
      expect(await api.execute('create_task', { title: 'x' }, 'c')).toContain('[Error:')
      expect(proposals.at(-1)).toMatchObject({ ok: false })
    } finally {
      globalThis.fetch = realFetch
      if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY
      else process.env.OPENROUTER_API_KEY = prevKey
    }
  })
})

describe('AT.21 fila del hilo', () => {
  test('run_readonly muestra el comando como target, en claude y en el helper', () => {
    const steps = claudeEventToStep({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 't1',
            name: 'mcp__orchestos__run_readonly',
            input: { argv: ['git', 'log', '-1'] },
          },
        ],
      },
    })
    expect(steps[0]?.target).toBe('git log -1')
    expect(readonlyCommandTarget('mcp__orchestos__create_task', { argv: ['x'] })).toBeUndefined()
    expect(readonlyCommandTarget('mcp__orchestos__run_readonly', { argv: [1] })).toBeUndefined()
  })
})
