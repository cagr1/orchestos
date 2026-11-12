/** UI.8.6 — `permissionMode` por proyecto: GET lo devuelve, PUT lo valida y lo escribe en el YAML. */
import { afterAll, describe, expect, it } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiConfigGet, handleApiConfigInit, handleApiConfigSet } from '../handlers/config.ts'

const root = mkdtempSync(join(tmpdir(), 'config-permission-mode-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const put = (body: unknown) =>
  handleApiConfigSet(
    new Request('http://localhost/api/config', { method: 'PUT', body: JSON.stringify(body) }),
    root,
  )

describe('permissionMode', () => {
  it('defaults to yolo, rejects unknown values, persists manual and clears on yolo', async () => {
    await handleApiConfigInit(root)
    const initial = (await (await handleApiConfigGet(root)).json()) as any
    expect(initial.permissionMode).toBe('yolo')
    expect(initial.permissions).toMatchObject({ mode: 'yolo', chat: 'read-only' })

    expect((await put({ permissionMode: 'ask' })).status).toBe(400)

    expect((await put({ permissionMode: 'manual' })).status).toBe(200)
    expect(readFileSync(join(root, 'orchestos.config.yaml'), 'utf8')).toMatch(
      /^permissionMode: manual$/m,
    )
    const manual = (await (await handleApiConfigGet(root)).json()) as any
    expect(manual.permissionMode).toBe('manual')
    expect(manual.permissions.mode).toBe('manual')

    expect((await put({ permissionMode: 'yolo' })).status).toBe(200)
    expect(readFileSync(join(root, 'orchestos.config.yaml'), 'utf8')).not.toContain(
      'permissionMode',
    )
  })
})

it('AUD.20 concurrent config updates preserve both fields', async () => {
  await handleApiConfigInit(root)
  const responses = await Promise.all([
    put({ permissionMode: 'manual' }),
    put({ roleAssignments: { executor: { agent: 'codex', model: 'gpt-5' } } }),
  ])
  expect(responses.map((r) => r.status)).toEqual([200, 200])
  const { parse } = await import('yaml')
  const config = parse(readFileSync(join(root, 'orchestos.config.yaml'), 'utf8'))
  expect(config.permissionMode).toBe('manual')
  expect(config.roles.executor).toEqual({ agent: 'codex', model: 'gpt-5' })
})

it('AUD.20-fix config updates preserve private destination permissions', async () => {
  const path = join(root, 'orchestos.config.yaml')
  await handleApiConfigInit(root)
  chmodSync(path, 0o600)
  expect((await put({ permissionMode: 'manual' })).status).toBe(200)
  expect(readFileSync(path, 'utf8')).toContain('permissionMode: manual')
  expect(statSync(path).mode & 0o7777).toBe(0o600)
})
