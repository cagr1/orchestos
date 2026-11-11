import { describe, expect, test } from 'bun:test'
import { badRequest, check, parseJson, parseYamlText, readBody, timeoutMs, z } from '../boundary'

const schema = z.object({ id: z.string(), n: z.number().int().min(0) }).strict()

describe('boundary', () => {
  test('check validates values and reports paths', () => {
    expect(check(schema, { id: 'a', n: 1 })).toEqual({ ok: true, data: { id: 'a', n: 1 } })
    const extra = check(schema, { id: 'a', n: 1, extra: true })
    expect(extra.ok).toBe(false)
    if (!extra.ok) expect(extra.error).toContain('extra')
    const negative = check(schema, { id: 'a', n: -1 })
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.error).toContain('n')
  })

  test('parseJson handles plain, fenced, and invalid JSON', () => {
    expect(parseJson(schema, '{"id":"a","n":1}').ok).toBe(true)
    expect(parseJson(schema, '```json\n{"id":"a","n":1}\n```').ok).toBe(true)
    const invalid = parseJson(schema, '{"id":')
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.error).toContain('invalid JSON')
  })

  test('parseYamlText handles valid and invalid YAML', () => {
    expect(parseYamlText(schema, 'id: a\nn: 1').ok).toBe(true)
    expect(parseYamlText(schema, 'id: [1').ok).toBe(false)
  })

  test('readBody handles valid JSON, malformed JSON, and schema failures', async () => {
    const valid = new Request('http://x', { method: 'POST', body: '{"id":"a","n":1}' })
    expect((await readBody(schema, valid)).ok).toBe(true)
    const malformed = await readBody(
      schema,
      new Request('http://x', { method: 'POST', body: 'nope' }),
    )
    expect(malformed).toEqual({ ok: false, error: 'invalid JSON body' })
    expect(
      (await readBody(schema, new Request('http://x', { method: 'POST', body: 'null' }))).ok,
    ).toBe(false)
  })

  test('badRequest returns a JSON 400 response', async () => {
    const response = badRequest('x')
    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(await response.json()).toEqual({ error: 'x' })
  })

  test('timeoutMs accepts only supported timer values', () => {
    for (const valid of [1, 2_147_483_647]) expect(timeoutMs.safeParse(valid).success).toBe(true)
    for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648]) {
      expect(timeoutMs.safeParse(invalid).success).toBe(false)
    }
  })

  test('un transform que lanza vuelve como ok:false, nunca escapa', () => {
    const throwing = z.string().transform(() => {
      throw new Error('fallo')
    })
    expect(check(throwing, 'x')).toEqual({ ok: false, error: 'fallo' })
    expect(parseJson(throwing, '"x"')).toEqual({ ok: false, error: 'fallo' })
  })
})
