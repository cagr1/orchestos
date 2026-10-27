import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { handleApiClisGet, handleApiClisSet } from '../handlers/clis.ts'

describe('custom CLI Settings', () => {
  let home: string
  let root: string
  let previous: string | undefined
  let globalPath: string
  const cli = { id: 'my-cli', label: 'My CLI', command: 'missing-cli-at113', args: ['{prompt}'] }
  const put = (clis: unknown) =>
    handleApiClisSet(
      new Request('http://localhost/api/clis', {
        method: 'PUT',
        body: JSON.stringify({ clis }),
      }),
      root,
    )
  beforeEach(() => {
    previous = process.env.ORCHESTOS_HOME
    home = mkdtempSync(join(tmpdir(), 'clis-settings-'))
    process.env.ORCHESTOS_HOME = home
    root = join(home, 'project')
    mkdirSync(root)
    globalPath = join(home, '.orchestos', 'config.yaml')
  })
  afterEach(() => {
    if (previous === undefined) delete process.env.ORCHESTOS_HOME
    else process.env.ORCHESTOS_HOME = previous
    rmSync(home, { recursive: true, force: true })
  })
  it('creates only global clis and GET detects installed via PATH', async () => {
    expect((await put([cli, { ...cli, id: 'bun-cli', command: process.execPath }])).status).toBe(
      200,
    )
    expect(Object.keys(parse(readFileSync(globalPath, 'utf8')))).toEqual(['clis'])
    const result = await handleApiClisGet().json()
    expect(result.hiddenClis).toEqual([])
    expect(result.clis).toEqual([
      { ...cli, installed: false },
      { ...cli, id: 'bun-cli', command: process.execPath, installed: true },
    ])
    expect(existsSync(join(root, 'orchestos.config.yaml'))).toBe(false)
  })
  it('preserves unrelated keys, comments, and the project file; removes empty list', async () => {
    mkdirSync(join(home, '.orchestos'))
    const original = '# global comment\nunknown: preserved # inline comment\n'
    writeFileSync(globalPath, original)
    const project = '# project untouched\nroles: {}\n'
    writeFileSync(join(root, 'orchestos.config.yaml'), project)
    expect((await put([cli])).status).toBe(200)
    expect(readFileSync(globalPath, 'utf8')).toContain(original.trim())
    expect((await put([])).status).toBe(200)
    expect(parse(readFileSync(globalPath, 'utf8')).clis).toBeUndefined()
    expect(readFileSync(globalPath, 'utf8')).toContain(original.trim())
    expect(readFileSync(join(root, 'orchestos.config.yaml'), 'utf8')).toBe(project)
  })
  it('persists hidden CLIs independently without changing declarations or project roles', async () => {
    expect((await put([cli])).status).toBe(200)
    const project = '# existing roles\nroles:\n  executor: { agent: codex, model: existing }\n'
    writeFileSync(join(root, 'orchestos.config.yaml'), project)
    const update = (hiddenClis: unknown) =>
      handleApiClisSet(
        new Request('http://localhost/api/clis', {
          method: 'PUT',
          body: JSON.stringify({ hiddenClis }),
        }),
        root,
      )
    expect((await update(['codex', 'codex'])).status).toBe(200)
    expect((await handleApiClisGet().json()).hiddenClis).toEqual(['codex'])
    expect(parse(readFileSync(globalPath, 'utf8')).clis).toEqual([cli])
    expect(readFileSync(join(root, 'orchestos.config.yaml'), 'utf8')).toBe(project)
    const original = readFileSync(globalPath, 'utf8')
    for (const invalid of [null, 'codex', [42], ['../codex']]) {
      expect((await update(invalid)).status).toBe(400)
      expect(readFileSync(globalPath, 'utf8')).toBe(original)
    }
    expect((await put([cli])).status).toBe(200)
    expect((await handleApiClisGet().json()).hiddenClis).toEqual(['codex'])
    expect((await update([])).status).toBe(200)
    expect((await handleApiClisGet().json()).hiddenClis).toEqual([])
  })
  it('rejects entire invalid lists with index and concrete cause', async () => {
    expect((await put([cli])).status).toBe(200)
    const original = readFileSync(globalPath, 'utf8')
    for (const [invalid, reason] of [
      [{ ...cli, id: 'claude' }, 'clis[1].id choca con "claude"'],
      [cli, 'clis[1].id choca con "my-cli"'],
      [{ ...cli, id: 'invalid-args', args: 'text' }, 'clis[1].args'],
      [{ ...cli, id: 'invalid-label', label: '' }, 'clis[1].label'],
      [{ ...cli, id: 'invalid-timeout', timeoutMs: 0 }, 'clis[1].timeoutMs'],
    ] as const) {
      const response = await put([cli, invalid])
      expect(response.status).toBe(400)
      expect((await response.json()).error).toContain(reason)
      expect(readFileSync(globalPath, 'utf8')).toBe(original)
    }
    expect((await put({})).status).toBe(400)
  })
  it('blocks removing effective Executor and task rule assignments', async () => {
    await put([cli])
    writeFileSync(
      join(root, 'orchestos.config.yaml'),
      `roles:\n  executor: { agent: my-cli, model: default }\n`,
    )
    let response = await put([])
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe(
      'Está asignado como Ejecutor: cambia el Ejecutor antes de quitarlo',
    )
    writeFileSync(
      join(root, 'orchestos.config.yaml'),
      `taskAgentRules:\n  - match: { output: ['*.md'] }\n    agent: my-cli\n    model: default\n`,
    )
    response = await put([])
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('regla')
    expect(parse(readFileSync(globalPath, 'utf8')).clis).toEqual([cli])
    writeFileSync(join(root, 'orchestos.config.yaml'), 'roles: {}\n')
    expect((await put([])).status).toBe(200)
  })
  it('fails closed on malformed YAML and malformed requests', async () => {
    mkdirSync(join(home, '.orchestos'))
    for (const yaml of ['[broken', '- sequence', 'scalar']) {
      writeFileSync(globalPath, yaml)
      expect((await put([cli])).status).toBe(400)
      expect(readFileSync(globalPath, 'utf8')).toBe(yaml)
    }
    expect(
      (
        await handleApiClisSet(
          new Request('http://localhost/api/clis', { method: 'PUT', body: '{' }),
          root,
        )
      ).status,
    ).toBe(400)
  })
})
