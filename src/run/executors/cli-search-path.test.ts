import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultRunner } from '../../dashboard/chat-cli-models.ts'
import { handleApiClisGet, handleApiClisSet } from '../../dashboard/handlers/clis.ts'
import { applyCliSearchPath, type CliDiscoveryProbe, whichCli } from './cli-discovery.ts'
import { genericCliEngine } from './generic-cli.ts'

describe('applyCliSearchPath', () => {
  let dir: string
  let home: string
  let originalPath: string | undefined
  let originalHome: string | undefined
  const command = 'fake-cli-set21'

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'set21-bin-'))
    home = mkdtempSync(join(tmpdir(), 'set21-home-'))
    originalPath = process.env.PATH
    originalHome = process.env.ORCHESTOS_HOME
    process.env.ORCHESTOS_HOME = home
    writeFileSync(join(dir, command), '#!/bin/sh\necho fake-ok\n')
    chmodSync(join(dir, command), 0o755)
  })
  afterEach(() => {
    process.env.PATH = originalPath
    if (originalHome === undefined) process.env.ORCHESTOS_HOME = undefined
    else process.env.ORCHESTOS_HOME = originalHome
    rmSync(dir, { recursive: true, force: true })
    rmSync(home, { recursive: true, force: true })
  })

  it('un CLI que solo vive en el PATH del login shell se lanza y se marca instalado', async () => {
    expect(whichCli(command)).toBeNull()
    const probe: CliDiscoveryProbe = {
      env: { PATH: process.env.PATH, SHELL: '/bin/fake' },
      home,
      loginPath: () => dir,
      which: () => null,
    }
    applyCliSearchPath(probe)

    expect(whichCli(command)).toBe(join(dir, command))
    expect(await defaultRunner(command, [])).toEqual({ stdout: 'fake-ok\n', exitCode: 0 })

    await handleApiClisSet(
      new Request('http://localhost/api/clis', {
        method: 'PUT',
        body: JSON.stringify({ clis: [{ id: 'fake', label: 'Fake', command, args: [] }] }),
      }),
      home,
    )
    const listed = (await handleApiClisGet().json()).clis as { id: string; installed: boolean }[]
    expect(listed.find((cli) => cli.id === 'fake')?.installed).toBe(true)

    const engine = genericCliEngine({ id: 'fake', label: 'Fake', command, args: [] })
    const result = await engine
      .run(
        {
          worktree: true,
          effectiveRoot: home,
          task: { output: [] },
          model: 'default',
        } as never,
        {} as never,
      )
      .catch((error: Error) => error)
    // El spawn por nombre no falla con ENOENT; cualquier error posterior viene del diff, no del lanzamiento.
    if (result instanceof Error) expect(result.message).not.toContain('failed to spawn')
    else expect(result.finalText).toBe('fake-ok')
  })

  it('con el marcador heredado no se lanza el login shell', () => {
    let calls = 0
    applyCliSearchPath({
      env: { PATH: process.env.PATH, SHELL: '/bin/fake', ORCHESTOS_CLI_SEARCH_PATH: '1' },
      home,
      loginPath: () => {
        calls++
        return dir
      },
      which: () => null,
    })
    expect(calls).toBe(0)
    expect(whichCli(command)).toBeNull()
  })
})
