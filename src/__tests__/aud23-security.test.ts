import { afterEach, expect, test } from 'bun:test'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { handleApiExplorerFile, handleApiExplorerTree } from '../dashboard/handlers/explorer.ts'
import { handleApiGitDiff } from '../dashboard/handlers/git-changes.ts'
import { envFilePath, writeEnv } from '../dashboard/settings-store.ts'
import { checkSsrSafe } from '../dashboard/ssrf.ts'
import { approvalPathWithin, decideApproval } from '../run/approvals.ts'
import { codexApprovalRequest } from '../run/executors/codex-approval.ts'
import { opencodeApprovalRequest } from '../run/executors/opencode-approval.ts'
import { redactSpawnArgs, startSpawnTrace } from '../run/executors/spawn-trace.ts'
import { realPathWithin, resolveProjectPath } from '../run/path-policy.ts'
import { buildPrompt } from '../run/prompt.ts'
import { findSecrets, redactSensitive } from '../security/secrets.ts'
import { resolveSkillPath } from '../skills/registry.ts'
import { listSpecs, loadSpec, saveSpec } from '../spec/store.ts'
import type { Task } from '../tasks/schema.ts'

const roots: string[] = []
// Marcadores partidos: un PEM literal en una línea dispara el propio check-secrets del pre-commit.
const PEM_BEGIN = `-----BEGIN RSA ${'PRIVATE'} KEY-----`
const PEM_END = `-----END RSA ${'PRIVATE'} KEY-----`

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aud23-'))
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function codex(root: string, command: string, actions: unknown[], cwd = root) {
  return codexApprovalRequest(
    'item/commandExecution/requestApproval',
    { command: `/bin/zsh -lc '${command}'`, commandActions: actions, cwd },
    {},
    root,
  )
}
for (const [label, command, actions] of [
  ['external action', 'cat ~/.ssh/id_rsa', [{ type: 'read', path: '/Users/x/.ssh/id_rsa' }]],
  ['missing read path', 'cat README.md', [{ type: 'read' }]],
  ['absolute token', 'cat /etc/passwd', [{ type: 'search' }]],
  ['home token', 'cat ~/.ssh/id_rsa', [{ type: 'search' }]],
  ['parent token', 'cat ../outside', [{ type: 'search' }]],
  ['quoted absolute token', 'cat "/etc/passwd"', [{ type: 'search' }]],
  ['long file option', 'rg needle --file=/etc/passwd', [{ type: 'search' }]],
  ['short file option', 'rg needle -f/etc/passwd', [{ type: 'search' }]],
  ['home file option', 'rg needle --file=~/private', [{ type: 'search' }]],
  ['quoted file option', 'rg needle --file="/etc/passwd"', [{ type: 'search' }]],
  ['quoted relative file option', 'rg needle --file="src/patterns"', [{ type: 'search' }]],
  ['variable expansion', 'cat $HOME/.ssh/id_rsa', [{ type: 'search' }]],
  ['braced variable', 'rg needle "${HOME}"', [{ type: 'search' }]],
  ['escaped absolute path', 'rg root \\/etc/passwd', [{ type: 'search' }]],
  ['brace expansion', 'cat {/etc/passwd,README.md}', [{ type: 'search' }]],
] as const) {
  test(`Codex asks for ${label}`, () => {
    const request = codex(fixture(), command, [...actions])
    expect(decideApproval('supervised', request, new Set())).toBe('ask')
  })
}
for (const command of ['cat leak.txt', 'rg needle --file=leak.txt', 'cat leak.tx?', 'cat leak*']) {
  test(`Codex asks when a plain argument is a symlink outside: ${command}`, () => {
    const root = fixture()
    const outside = fixture()
    writeFileSync(join(outside, 'secret'), 'x')
    symlinkSync(join(outside, 'secret'), join(root, 'leak.txt'))
    const request = codex(root, command, [{ type: 'search' }])
    expect(decideApproval('supervised', request, new Set())).toBe('ask')
  })
}
test('Codex allows an in-project search path', () => {
  const request = codex(fixture(), 'rg needle src/', [{ type: 'search' }])
  expect(decideApproval('supervised', request, new Set())).toBe('auto-approve')
})
for (const check of ['realPathWithin', 'approvalPathWithin', 'resolveProjectPath'] as const) {
  test(`${check} rejects a chained symlink followed by a parent segment`, () => {
    const root = fixture()
    const outside = fixture()
    mkdirSync(join(outside, 'dir'))
    symlinkSync(join(outside, 'dir'), join(root, 'inner'))
    symlinkSync('inner/../safe', join(root, 'escape'))
    if (check === 'realPathWithin') expect(realPathWithin(root, join(root, 'escape'))).toBe(false)
    else if (check === 'approvalPathWithin') expect(approvalPathWithin(root, 'escape')).toBe(false)
    else expect(() => resolveProjectPath(root, 'escape')).toThrow()
  })
}
for (const check of ['realPathWithin', 'approvalPathWithin'] as const) {
  test(`${check} resolves input parent segments after intermediate symlinks`, () => {
    const root = fixture()
    const outside = fixture()
    mkdirSync(join(outside, 'dir'))
    symlinkSync(join(outside, 'dir'), join(root, 'inner'))
    const target = `${root}/inner/../safe`
    expect(
      check === 'realPathWithin' ? realPathWithin(root, target) : approvalPathWithin(root, target),
    ).toBe(false)
  })
}
test('Codex allows an in-project read and rejects an external cwd with a saved grant', () => {
  const root = fixture()
  const safe = codex(root, 'cat README.md', [{ type: 'read', path: 'README.md' }])
  expect(decideApproval('supervised', safe, new Set())).toBe('auto-approve')
  const outside = codex(root, 'cat README.md', [{ type: 'read', path: 'README.md' }], fixture())
  expect(decideApproval('supervised', outside, new Set([`command:${outside.commandKey}`]))).toBe(
    'ask',
  )
})
test('command grants and read-only classification require withinProject', () => {
  for (const withinProject of [false, undefined]) {
    const request = {
      kind: 'command' as const,
      detail: { command: 'cat a' },
      commandKey: 'cat a',
      readOnly: true,
      withinProject,
    }
    expect(decideApproval('supervised', request, new Set(['command:cat a']))).toBe('ask')
  }
})
test('OpenCode does not discard an edit entry without a valid file', () => {
  const root = fixture()
  for (const file of [undefined, '', 42]) {
    const request = opencodeApprovalRequest(
      {
        id: 'p',
        sessionID: 's',
        action: 'edit',
        resources: [],
        metadata: { files: [{ file: join(root, 'safe') }, { file }] },
      },
      root,
    )
    expect(decideApproval('auto-edit', request, new Set())).toBe('ask')
  }
})
test('dangling symlinks cannot receive a write or approval grant', () => {
  const root = fixture()
  const outside = fixture()
  symlinkSync(join(outside, 'missing'), join(root, 'broken'))
  expect(approvalPathWithin(root, 'broken')).toBe(false)
  expect(approvalPathWithin(root, 'broken/child')).toBe(false)
  expect(() => resolveProjectPath(root, 'broken', 'write')).toThrow()
  expect(() => resolveProjectPath(root, 'broken/child', 'write')).toThrow()
})
for (const endpoint of ['tree', 'file', 'diff'] as const) {
  test(`${endpoint} rejects an external symlink with 403`, () => {
    const root = fixture()
    const outside = fixture()
    writeFileSync(join(outside, 'private'), 'OUTSIDE-CONTENT')
    symlinkSync(outside, join(root, 'escape'))
    const handler =
      endpoint === 'tree'
        ? handleApiExplorerTree
        : endpoint === 'file'
          ? handleApiExplorerFile
          : handleApiGitDiff
    const path = endpoint === 'tree' ? 'escape' : 'escape/private'
    expect(handler(new URL(`http://localhost/api?path=${path}`), root).status).toBe(403)
  })
}
test('a broken symlink does not break the explorer listing and has no size', async () => {
  const root = fixture()
  symlinkSync(join(root, 'missing'), join(root, 'broken'))
  const response = handleApiExplorerTree(new URL('http://localhost/api'), root, () => '')
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.entries).toEqual([{ name: 'broken', path: 'broken', type: 'file', ignored: false }])
})
test('spec reads and listings cannot follow external file or directory symlinks', () => {
  const root = fixture()
  const outside = fixture()
  saveSpec(outside, {
    frontmatter: { id: 'private', status: 'draft', createdAt: 'now', clarify: 'none' },
    body: 'OUTSIDE-CONTENT',
  })
  mkdirSync(join(root, '.orchestos/specs'), { recursive: true })
  symlinkSync(
    join(outside, '.orchestos/specs/private.md'),
    join(root, '.orchestos/specs/private.md'),
  )
  expect(() => loadSpec(root, 'private')).toThrow()
  expect(listSpecs(root)).toEqual([])
  const second = fixture()
  mkdirSync(join(second, '.orchestos'))
  symlinkSync(join(outside, '.orchestos/specs'), join(second, '.orchestos/specs'))
  expect(() => listSpecs(second)).toThrow()
})
test('project skill resolution rejects a symlink to an external skill', () => {
  const root = fixture()
  const outside = fixture()
  mkdirSync(join(root, 'skills'))
  writeFileSync(join(outside, 'private.yaml'), 'OUTSIDE-CONTENT')
  symlinkSync(join(outside, 'private.yaml'), join(root, 'skills/private.yaml'))
  expect(() => resolveSkillPath('private', root)).toThrow()
})
for (const input of ['../private', 'escape/private']) {
  test(`prompt omits unsafe input ${input} with a warning`, () => {
    const parent = fixture()
    const root = join(parent, 'project')
    mkdirSync(root)
    writeFileSync(join(parent, 'private'), 'OUTSIDE-CONTENT')
    symlinkSync(parent, join(root, 'escape'))
    const task: Task = {
      id: 't',
      description: 'read',
      executor: 'openrouter',
      input: [input],
      output: ['out'],
      depends_on: [],
      status: 'pending',
      retry_count: 0,
    }
    const prompt = buildPrompt(task, '', root, '')
    expect(prompt.userContent).not.toContain('OUTSIDE-CONTENT')
    expect(prompt.userContent).toContain('Warning:')
    expect(prompt.userContent).toContain(input)
  })
}
const secret = ['sk-or-v1-', 'test', '123456789012345678901234567890'].join('')
test('log redaction has no placeholder exemption while detection retains it', () => {
  expect(findSecrets(secret)).toEqual([])
  expect(redactSensitive(secret)).toBe('[REDACTED:provider-key]')
})
test('spawn arguments and stderr redact secrets before truncating or flattening', () => {
  expect(redactSpawnArgs([secret])).toEqual(['[REDACTED:provider-key]'])
  const logs: string[] = []
  const pem = [`${PEM_BEGIN}`, 'payload', `${PEM_END}`].join('\n')
  startSpawnTrace('fixture', 1, [], '.', {}, (line) => logs.push(line)).end(
    1,
    `${secret}\n${pem}`,
    false,
  )
  expect(logs[1]).not.toContain(secret)
  expect(logs[1]).not.toContain('payload')
})
test('writeEnv creates and replaces .env atomically with mode 600', () => {
  const previous = process.env.ORCHESTOS_HOME
  process.env.ORCHESTOS_HOME = fixture()
  try {
    writeEnv({ VALUE: 'first' })
    const path = envFilePath()
    expect(statSync(path).mode & 0o777).toBe(0o600)
    chmodSync(path, 0o644)
    const oldInode = statSync(path).ino
    writeEnv({ VALUE: 'second' })
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(statSync(path).ino).not.toBe(oldInode)
    expect(readFileSync(path, 'utf8')).toBe('VALUE=second\n')
    expect(readdirSync(join(process.env.ORCHESTOS_HOME!, '.orchestos'))).toEqual(['.env'])
  } finally {
    if (previous === undefined) delete process.env.ORCHESTOS_HOME
    else process.env.ORCHESTOS_HOME = previous
  }
})
test('public IPv4 cannot bypass the non-standard port policy', async () => {
  expect(await checkSsrSafe(new URL('http://8.8.8.8:8080'))).toContain('non-standard port')
})
test('the staged secret gate rejects a multiline PEM addition', () => {
  const root = fixture()
  function git(args: string[]) {
    const result = Bun.spawnSync(['git', ...args], { cwd: root })
    expect(result.exitCode).toBe(0)
  }
  git(['init', '-q'])
  const pem = [`${PEM_BEGIN}`, 'aGVsbG8=', `${PEM_END}`].join('\n')
  writeFileSync(join(root, 'key.pem'), `${pem}\n`)
  git(['add', '--', 'key.pem'])
  const result = Bun.spawnSync(
    ['bun', resolve(import.meta.dir, '../../scripts/check-secrets.ts'), '--staged'],
    { cwd: root },
  )
  expect(result.exitCode).toBe(1)
  expect(result.stderr.toString()).toContain('private-key')
})
