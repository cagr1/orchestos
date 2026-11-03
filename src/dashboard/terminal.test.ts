import { afterEach, describe, expect, test } from 'bun:test'
import {
  createTerminalSession,
  resolveOpenCodeCommand,
  resolveShellCommand,
  stopTerminalSessions,
} from './terminal.ts'

afterEach(async () => stopTerminalSessions())

describe('dashboard terminal sessions', () => {
  test('writes input to the process and receives terminal output', async () => {
    const output: string[] = []
    const session = createTerminalSession({
      cwd: process.cwd(),
      cols: 80,
      rows: 24,
      command: ['sh'],
      onData: (data) => output.push(new TextDecoder().decode(data)),
      onExit: () => {},
    })
    session.write('echo hola\n')
    for (let attempt = 0; attempt < 50 && !output.join('').includes('hola'); attempt++)
      await Bun.sleep(20)
    expect(output.join('')).toContain('hola')
    expect(() => session.resize(100, 40)).not.toThrow()
    await session.close()
    expect(() => process.kill(session.pid, 0)).toThrow()
  })

  test('stopTerminalSessions closes every live child', async () => {
    const make = () =>
      createTerminalSession({
        cwd: process.cwd(),
        cols: 80,
        rows: 24,
        command: ['sh'],
        onData: () => {},
        onExit: () => {},
      })
    const first = make()
    const second = make()
    await stopTerminalSessions()
    expect(() => process.kill(first.pid, 0)).toThrow()
    expect(() => process.kill(second.pid, 0)).toThrow()
  })

  test('reports a clear error when OpenCode is not on PATH', () => {
    expect(() => resolveOpenCodeCommand(() => null)).toThrow(
      'OpenCode no está instalado (no se encontró "opencode" en el PATH)',
    )
  })
})

describe('resolveShellCommand', () => {
  test('usa $SHELL con -l cuando existe', () => {
    expect(resolveShellCommand({ SHELL: '/bin/fish' }, () => true)).toEqual(['/bin/fish', '-l'])
  })
  test('sin $SHELL cae a /bin/zsh y luego /bin/sh', () => {
    expect(resolveShellCommand({}, (p) => p === '/bin/zsh')).toEqual(['/bin/zsh', '-l'])
    expect(resolveShellCommand({}, () => false)).toEqual(['/bin/sh', '-l'])
  })
  test('$SHELL inexistente o relativo se ignora', () => {
    expect(resolveShellCommand({ SHELL: '/nope/sh' }, (p) => p === '/bin/zsh')).toEqual([
      '/bin/zsh',
      '-l',
    ])
    expect(resolveShellCommand({ SHELL: 'zsh' }, () => true)).toEqual(['/bin/zsh', '-l'])
  })
})
