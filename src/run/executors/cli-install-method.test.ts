import { expect, test } from 'bun:test'
import { detectCliInstall } from './cli-install-method.ts'

function detect(
  id: string,
  path: string,
  managers = ['/prefix/bin/npm', '/home/me/.bun/bin/bun', '/opt/homebrew/bin/brew'],
) {
  return detectCliInstall(id, `/shim/${id}`, {
    realpath: () => path,
    exists: (path) => managers.includes(path),
    home: '/home/me',
    platform: 'darwin',
  })
}
test('verified Mac installs keep their own update paths', () => {
  expect(
    detect('claude', '/prefix/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe'),
  ).toMatchObject({
    method: 'npm',
    command: ['/shim/claude', 'update'],
    managerDir: '/prefix/bin',
    latest: { kind: 'npm', pkg: '@anthropic-ai/claude-code' },
  })
  expect(
    detect('codex', '/home/me/.codex/packages/standalone/releases/0.171.0/bin/codex'),
  ).toMatchObject({ method: 'standalone', command: ['/shim/codex', 'update'] })
  expect(detect('opencode', '/home/me/.opencode/bin/opencode')).toMatchObject({
    method: 'curl',
    command: ['/shim/opencode', 'upgrade', '--method', 'curl'],
    latest: { kind: 'github', repo: 'anomalyco/opencode' },
  })
  expect(detect('claude', '/home/me/.local/share/claude/versions/2.1.0')).toMatchObject({
    method: 'native',
    command: ['/shim/claude', 'update'],
  })
})
test('package managers use the detected executable and package', () => {
  for (const [id, pkg] of [
    ['claude', '@anthropic-ai/claude-code'],
    ['codex', '@openai/codex'],
    ['opencode', 'opencode-ai'],
  ] as const) {
    const npm = detect(id!, `/prefix/lib/node_modules/${pkg}/bin/cli`)
    expect(npm.command).toEqual(
      id === 'claude'
        ? ['/shim/claude', 'update']
        : id === 'opencode'
          ? ['/shim/opencode', 'upgrade', '--method', 'npm']
          : ['/prefix/bin/npm', 'install', '-g', `${pkg}@latest`],
    )
    const bun = detect(id!, `/home/me/.bun/install/global/node_modules/${pkg}/bin/cli`)
    expect(bun.method).toBe('bun')
    expect(bun.command).toEqual(
      id === 'opencode'
        ? ['/shim/opencode', 'upgrade', '--method', 'bun']
        : ['/home/me/.bun/bin/bun', 'add', '-g', `${pkg}@latest`],
    )
    if (id === 'opencode') expect(bun.latest).toEqual({ kind: 'npm', pkg })
    for (const directory of ['Cellar', 'Caskroom']) {
      const brew = detect(id!, `/opt/homebrew/${directory}/${id}/1.0/bin/cli`)
      expect(brew.method).toBe('brew')
      expect(brew.command).toEqual(
        id === 'opencode'
          ? ['/shim/opencode', 'upgrade', '--method', 'brew']
          : [
              '/opt/homebrew/bin/brew',
              'upgrade',
              ...(directory === 'Caskroom' ? ['--cask'] : []),
              id!,
            ],
      )
    }
  }
})
test('refuses missing managers, unknown paths, failed realpath and unsupported CLIs', () => {
  for (const path of [
    '/prefix/lib/node_modules/@openai/codex/bin/codex',
    '/home/me/.bun/install/global/node_modules/@openai/codex/bin/codex',
    '/opt/homebrew/Cellar/codex/1/bin/codex',
    '/random/codex',
    'C:\\bin\\codex.cmd',
  ]) {
    expect(detect('codex', path, [])).toMatchObject({
      method: 'unknown',
      command: null,
      latest: { kind: 'npm', pkg: '@openai/codex' },
    })
  }
  expect(detect('constructor', '/random/other')).toMatchObject({
    method: 'unknown',
    command: null,
    latest: null,
  })
  expect(detect('other', '/random/other')).toMatchObject({
    method: 'unknown',
    command: null,
    latest: null,
  })
  expect(
    detectCliInstall('codex', '/missing', {
      realpath: () => {
        throw new Error('missing')
      },
      exists: () => true,
      platform: 'darwin',
      home: '/home/me',
    }),
  ).toMatchObject({ method: 'unknown', command: null })
})
test('normalizes Windows separators without guessing shim layout', () => {
  expect(detect('codex', '\\prefix\\lib\\node_modules\\@openai\\codex\\bin\\codex')).toMatchObject({
    method: 'npm',
    realPath: '/prefix/lib/node_modules/@openai/codex/bin/codex',
  })
})
