/** UI.8.6 — `permissionMode` por proyecto: GET lo devuelve, PUT lo valida y lo escribe en el YAML. */
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
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
