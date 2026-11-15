import { afterEach, describe, expect, test } from 'bun:test'
import {
  createTerminalSession,
  resolveOpenCodeCommand,
  resolveShellCommand,
  stopTerminalSessions,
} from './terminal.ts'

afterEach(async () => stopTerminalSessions())

describe('dashboard terminal sessions', () => {
  test.each([
    ['changed', 'before', 'after', true],
    ['unchanged', 'same', 'same', false],
    ['unavailable', null, null, false],
    ['unavailable at exit', 'before', null, false],
    ['unavailable at start', null, 'after', false],
  ] as const)('reports binaryChanged when fingerprint is %s', async (_, before, after, changed) => {
    let calls = 0
    const result = await new Promise<{ code: number; binaryChanged: boolean }>((resolve) => {
      createTerminalSession({
        cwd: process.cwd(),
        cols: 80,
        rows: 24,
        command: [process.execPath, '-e', 'process.exit(0)'],
        fingerprint: (path) => {
          expect(path).toBe(process.execPath)
          return calls++ === 0 ? before : after
        },
        onData: () => {},
        onExit: (code, { binaryChanged }) => resolve({ code, binaryChanged }),
      })
    })
    expect(result).toEqual({ code: 0, binaryChanged: changed })
    expect(calls).toBe(2)
  })

  test('the platform shell (resolveShellCommand) runs commands in the PTY', async () => {
    let written = false
    const exited = new Promise<{ code: number; written: boolean }>((resolve) => {
      const session = createTerminalSession({
        cwd: process.cwd(),
        cols: 80,
        rows: 24,
        command: resolveShellCommand(),
        onData: () => {},
        onExit: (code) => resolve({ code, written }),
      })
      // `exit 7` solo da 7 si el shell interpreta lo escrito (sh, zsh, PowerShell y cmd lo respetan).
      setTimeout(() => {
        written = true
        session.write('exit 7\r')
      }, 500)
    })
    expect(await exited).toEqual({ code: 7, written: true })
  }, 15_000)

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

  test('launches OpenCode in standalone mode', () => {
    expect(resolveOpenCodeCommand(() => '/usr/bin/opencode')).toEqual([
      '/usr/bin/opencode',
      '--standalone',
    ])
  })
})

describe('resolveShellCommand', () => {
  const posix = (env: Record<string, string>, exists: (p: string) => boolean) =>
    resolveShellCommand(env, exists, 'darwin')
  test('usa $SHELL con -l cuando existe', () => {
    expect(posix({ SHELL: '/bin/fish' }, () => true)).toEqual(['/bin/fish', '-l'])
  })
  test('sin $SHELL cae a /bin/zsh y luego /bin/sh', () => {
    expect(posix({}, (p) => p === '/bin/zsh')).toEqual(['/bin/zsh', '-l'])
    expect(posix({}, () => false)).toEqual(['/bin/sh', '-l'])
  })
  test('$SHELL inexistente o relativo se ignora', () => {
    expect(posix({ SHELL: '/nope/sh' }, (p) => p === '/bin/zsh')).toEqual(['/bin/zsh', '-l'])
    expect(posix({ SHELL: 'zsh' }, () => true)).toEqual(['/bin/zsh', '-l'])
  })
  test('Windows: PowerShell 7, luego el de serie, luego COMSPEC', () => {
    const win = (env: Record<string, string>, found: string | null) =>
      resolveShellCommand(
        env,
        () => false,
        'win32',
        (bin) => (bin === found ? `C:\\${bin}.exe` : null),
      )
    expect(win({}, 'pwsh')).toEqual(['C:\\pwsh.exe', '-NoLogo'])
    expect(win({}, 'powershell')).toEqual(['C:\\powershell.exe', '-NoLogo'])
    expect(win({ COMSPEC: 'C:\\cmd.exe' }, null)).toEqual(['C:\\cmd.exe'])
    expect(win({}, null)).toEqual(['cmd.exe'])
  })
})
