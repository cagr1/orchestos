import { afterEach, expect, it, spyOn } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { main } from './check-ui-text.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function git(root: string, ...args: string[]) {
  execFileSync('git', args, { cwd: root, stdio: 'pipe' })
}
function write(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
const app = 'src/dashboard/app/src/App.tsx'
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-ui-text-'))
  roots.push(root)
  git(root, 'init')
  write(root, 'PLAN.md', '# Plan\n')
  write(root, app, 'export const App = () => <div />\n')
  git(root, 'add', '.')
  git(
    root,
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'base',
  )
  return root
}
function stage(root: string, content: string, declaration?: string, path = app) {
  write(root, path, content)
  if (declaration) write(root, 'PLAN.md', `# Plan\n  Texto visible: ${declaration}\n`)
  git(root, 'add', '.')
}

it('fails for undeclared JSX text and reports its staged location', () => {
  const root = repo()
  stage(root, 'export const App = () => <span>Prueba</span>\n')
  const errors = spyOn(console, 'error')
  try {
    expect(main(root)).toBe(1)
    expect(errors.mock.calls.flat().join('\n')).toContain(`${app}:1: Prueba`)
  } finally {
    errors.mockRestore()
  }
})
it('accepts literal declarations ignoring case', () => {
  const root = repo()
  stage(
    root,
    'export const App = () => <span>Prueba</span>\n',
    'prueba — requiere explicación textual',
  )
  expect(main(root)).toBe(0)
})
it('ignores aria, className, data attributes and expression strings', () => {
  const root = repo()
  stage(
    root,
    'export const App = () => <span aria-label="Abrir" aria-description="Ayuda" className="foo" data-name="Bar">{"Expresión"}</span>\n',
  )
  expect(main(root)).toBe(0)
})
for (const attribute of ['title', 'placeholder', 'alt']) {
  it(`requires declaration of literal ${attribute}`, () => {
    const root = repo()
    stage(root, `export const App = () => <input ${attribute}="Reabrir" />\n`)
    expect(main(root)).toBe(1)
  })
}
it('ignores symbols, entities and numbers', () => {
  const root = repo()
  stage(root, 'export const App = () => <span>× · … 123 &times; &#215; &#xD7;</span>\n')
  expect(main(root)).toBe(0)
})
it('ignores test TSX files', () => {
  const root = repo()
  stage(root, '<span>Prueba</span>\n', undefined, 'src/dashboard/app/src/App.test.tsx')
  expect(main(root)).toBe(0)
})
it('passes with no UI changes', () => {
  const root = repo()
  write(root, 'README.md', 'Texto nuevo\n')
  git(root, 'add', '.')
  expect(main(root)).toBe(0)
})
it('detects standalone multiline JSX text and every missing literal', () => {
  const root = repo()
  stage(
    root,
    'export const App = () => (\n  <span title="Ayuda">\n    Prueba\n  </span>\n)\n',
    'Ayuda',
  )
  expect(main(root)).toBe(1)
})
it('uses staged contents and ignores unstaged declarations', () => {
  const root = repo()
  stage(root, '<span>Prueba</span>\n')
  write(root, app, '<span />\n')
  write(root, 'PLAN.md', '# Plan\nTexto visible: Prueba\n')
  expect(main(root)).toBe(1)
})
it('ignores text on unchanged lines', () => {
  const root = repo()
  stage(root, 'export const App = () => <span>Anterior</span>\n')
  git(
    root,
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'existing',
  )
  stage(root, 'export const App = () => <span>Anterior</span>\n// nuevo comentario\n')
  expect(main(root)).toBe(0)
})
it('requires an added declaration line, not an existing one', () => {
  const root = repo()
  write(root, 'PLAN.md', '# Plan\nTexto visible: Prueba\n')
  git(root, 'add', '.')
  git(
    root,
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'old declaration',
  )
  stage(root, '<span>Prueba</span>\n')
  expect(main(root)).toBe(1)
})
