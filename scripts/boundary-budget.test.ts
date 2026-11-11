import { describe, expect, test } from 'bun:test'
import { countBoundarySites } from './boundary-budget'

describe('countBoundarySites', () => {
  test('counts each category and ignores comment lines', () => {
    expect(
      countBoundarySites([
        {
          path: 'src/a.ts',
          text: "JSON.parse(x); JSON.parse(y)\nreq.json(); response.json()\nimport { parse } from 'yaml'\nparse(x)\n// JSON.parse(x) req.json() parse(x)\n/* JSON.parse(y) */",
        },
      ]),
    ).toEqual({ 'json-parse': 2, 'response-json': 2, 'yaml-parse': 1 })
  })

  test('ignores boundary code, tests, and dashboard app files', () => {
    expect(
      countBoundarySites(
        [
          'src/boundary/x.ts',
          'src/a/__tests__/b.ts',
          'src/a.test.ts',
          'src/dashboard/app/x.tsx',
        ].map((path) => ({
          path,
          text: "JSON.parse(x); req.json(); import { parse } from 'yaml'; parse(x)",
        })),
      ),
    ).toEqual({ 'json-parse': 0, 'response-json': 0, 'yaml-parse': 0 })
  })

  test('counts parse only in YAML importing files', () => {
    expect(
      countBoundarySites([
        { path: 'src/no-yaml.ts', text: 'parse(x); JSON.parse(x)' },
        {
          path: 'src/with-yaml.ts',
          text: "import yaml from 'yaml'\nyaml.parse(x); object.parse(x)",
        },
      ]),
    ).toEqual({ 'json-parse': 1, 'response-json': 0, 'yaml-parse': 1 })
  })

  test('recognizes parenthesized and computed JSON calls', () => {
    expect(
      countBoundarySites([
        { path: 'src/a.ts', text: 'JSON.parse\n(t); (JSON.parse)(t); JSON["parse"](t)' },
      ]),
    ).toEqual({ 'json-parse': 3, 'response-json': 0, 'yaml-parse': 0 })
  })

  test('counts fetch response calls with no arguments only', () => {
    expect(
      countBoundarySites([
        { path: 'src/a.ts', text: 'await (await fetch(u)).json(); x.json(arg)' },
      ]),
    ).toEqual({ 'json-parse': 0, 'response-json': 1, 'yaml-parse': 0 })
  })

  test('recognizes aliased and namespace YAML imports and ignores comments', () => {
    expect(
      countBoundarySites([
        {
          path: 'src/a.ts',
          text: "import { parse as load } from 'yaml'; load(t); import * as y from 'yaml'; y.parse(t); /* JSON.parse(t); r.json() */",
        },
      ]),
    ).toEqual({ 'json-parse': 0, 'response-json': 0, 'yaml-parse': 2 })
  })

  test('includes mts and excludes yaml parse without an import', () => {
    expect(
      countBoundarySites([
        { path: 'src/a.mts', text: 'JSON.parse(t)' },
        { path: 'src/b.cts', text: 'parse(t)' },
      ]),
    ).toEqual({ 'json-parse': 1, 'response-json': 0, 'yaml-parse': 0 })
  })
})
