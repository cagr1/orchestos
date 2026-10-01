import { afterEach, describe, expect, test } from 'bun:test'
import { createTerminalSession, resolveOpenCodeCommand, stopTerminalSessions } from './terminal.ts'

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
