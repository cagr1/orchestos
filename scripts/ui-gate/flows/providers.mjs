import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { run } from '../lib.mjs'

export default async function providers({ page, api, step, shot, cleanup, restartDashboard }) {
  const fixture = mkdtempSync(join(tmpdir(), 'orchestos-ui-providers-'))
  const home = join(fixture, 'home')
  const binary = join(fixture, 'claude')
  mkdirSync(home)
  writeFileSync(
    join(home, '.claude.json'),
    JSON.stringify({
      oauthAccount: {
        emailAddress: 'carlos@example.test',
        organizationType: 'claude_pro',
      },
    }),
  )
  // A deterministic CLI probe: no real provider or account is invoked by this flow.
  writeFileSync(
    binary,
    `#!/bin/sh
case "$1" in
--version) echo "Claude fixture 1.2.3";;
--help) echo "  --model <model> (e.g. 'sonnet', 'opus')";;
esac
`,
    { mode: 0o755 },
  )
  const codexBinary = join(fixture, 'codex')
  writeFileSync(codexBinary, '#!/bin/sh\necho \"Codex fixture 1.2.3\"\n', {
    mode: 0o755,
  })
  const preload = join(fixture, 'probe.ts')
  writeFileSync(
    preload,
    `
import { systemCliDiscoveryProbe } from ${JSON.stringify(resolve('src/run/executors/cli-discovery.ts'))}
import { systemProviderProbe } from ${JSON.stringify(resolve('src/dashboard/handlers/providers.ts'))}
const discovery = { home: ${JSON.stringify(home)}, loginPath: () => null,
  which: (binary) => binary === 'claude' ? ${JSON.stringify(binary)} : binary === 'codex' ? ${JSON.stringify(codexBinary)} : null }
Object.assign(systemCliDiscoveryProbe, discovery)
Object.assign(systemProviderProbe, discovery, { env: { ...process.env, CODEX_HOME: ${JSON.stringify(join(home, '.codex'))} } })
`,
  )
  const previousOptions = process.env.BUN_OPTIONS
  const root = join(fixture, 'project')
  mkdirSync(root)
  writeFileSync(join(root, 'README.md'), '# Providers fixture\n')
  run('git', ['init', '-q'], root)
  run('bun', ['run', resolve('src/cli.ts'), 'init', root], process.cwd())
  writeFileSync(
    join(root, 'orchestos.config.yaml'),
    'roles:\n  executor: { agent: claude, model: sonnet }\n',
  )
  const project = ((await api('/api/projects')).data ?? []).find((entry) => entry.path === root)
  if (!project) throw new Error('Provider fixture project was not registered')
  const headers = { 'x-orchestos-project-id': project.id }
  const visibility = (await api('/api/clis')).data.hiddenClis ?? []
  cleanup(async () => {
    if (previousOptions === undefined) delete process.env.BUN_OPTIONS
    else process.env.BUN_OPTIONS = previousOptions
    await restartDashboard()
    try {
      await api('/api/clis', {
        method: 'PUT',
        body: JSON.stringify({ hiddenClis: visibility }),
        headers: { 'Content-Type': 'application/json' },
      })
      await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
        method: 'POST',
      })
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })
  process.env.BUN_OPTIONS = `${previousOptions ?? ''} --preload=${preload}`.trim()
  await restartDashboard()
  const squash = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
  const open = async (section) => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(root), exact: true }).click()
    const started = Date.now()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: section, exact: true }).click()
    await page.getByText('Loading live settings…', { exact: true }).waitFor({ state: 'hidden' })
    return Date.now() - started
  }
  let usagePending = false
  await page.route('**/api/usage', async (route) => {
    usagePending = true
    await new Promise((resolve) => setTimeout(resolve, 8_000))
    await route.continue().catch(() => {})
    usagePending = false
  })
  await page.route('**/api/providers', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    await route.continue().catch(() => {})
  })
  const settingsReadyMs = await open('General')
  await step(
    'General and navigation load while Usage is still pending (delayed 8 s)',
    usagePending && (await page.getByText('Language', { exact: true }).isVisible()),
    `settingsReadyMs=${settingsReadyMs} usagePending=${usagePending}`,
  )
  await page.getByRole('button', { name: 'Providers', exact: true }).click()
  await step(
    'Providers shows a header loading indicator without an empty Installed group',
    (await page.locator('[data-page-header]').getByRole('status').isVisible()) &&
      (await page.getByText('Installed (0)', { exact: true }).count()) === 0,
  )
  const claude = page.locator('[data-provider-id="claude"]')
  const codex = page.locator('[data-provider-id="codex"]')
  const gemini = page.locator('[data-provider-id="gemini"]')
  await claude.waitFor()
  await page.unroute('**/api/providers')
  await page.unroute('**/api/usage')
  await step(
    'installed Claude and missing Gemini are grouped separately',
    (await claude.getAttribute('data-provider-installed')) === 'true' &&
      (await gemini.getAttribute('data-provider-installed')) === 'false' &&
      (await gemini.getByRole('link', { name: /How to install|Cómo instalar/ }).isVisible()),
  )
  const chatModels = ((await api('/api/chat/cli-models')).data ?? []).find(
    (entry) => entry.id === 'claude',
  )?.models
  const modelCount = chatModels?.length ?? 0
  await step(
    'version, masked account, plan and model count are shown',
    /1.2.3/.test(await claude.innerText()) &&
      !/Claude fixture/.test(await claude.innerText()) &&
      /c•••@example.test/.test(await claude.innerText()) &&
      !/carlos@example.test/.test(await claude.innerText()) &&
      /pro/.test(await claude.innerText()) &&
      modelCount > 0 &&
      new RegExp(`\\b${modelCount} (models|modelos)`).test(await claude.innerText()),
  )
  await step(
    'only Executor row has the default model selector',
    (await page.locator('[data-provider-id] select').count()) === 1 &&
      (await claude.locator('select').inputValue()) === 'sonnet' &&
      (await codex.getAttribute('data-provider-installed')) === 'true' &&
      (await codex.locator('select').count()) === 0,
  )
  await step(
    'missing session offers a copyable login command',
    /Signed out|Sin sesión/.test(await codex.innerText()) &&
      (await codex.getByText('codex login', { exact: true }).isVisible()) &&
      (await codex.getByRole('button', { name: /Copy command|Copiar comando/ }).isVisible()),
  )
  const chosen = await claude
    .locator('select')
    .locator('option')
    .evaluateAll(
      (options, current) =>
        options
          .map((o) => ({ value: o.value, label: o.textContent.trim() }))
          .find((o) => o.value && o.value !== current),
      await claude.locator('select').inputValue(),
    )
  if (!chosen) throw new Error('Claude model select has no alternative option')
  const [saved] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith('/api/config') && res.request().method() === 'PUT',
    ),
    claude.locator('select').selectOption(chosen.value),
  ])
  if (!saved.ok()) throw new Error('Default model save failed')
  await open('Providers')
  await step(
    'default model persists after reload',
    (await claude.locator('select').inputValue()) === chosen.value &&
      (await api('/api/config', { headers })).data.roleAssignments.executor.model === chosen.value,
  )
  await shot('providers')
  const refreshed = page.waitForResponse((res) => res.url().includes('/api/providers?refresh=1'))
  await page.getByRole('button', { name: /Refresh providers|Refrescar providers/ }).click()
  await step('refresh requests a fresh provider probe', (await refreshed).ok())
  const hidden = page.waitForResponse(
    (res) => res.url().endsWith('/api/clis') && res.request().method() === 'PUT',
  )
  await claude.getByRole('switch').uncheck()
  if (!(await hidden).ok()) throw new Error('Visibility save failed')
  await open('Providers')
  await step(
    'picker visibility persists after reload',
    !(await claude.getByRole('switch').isChecked()) &&
      (await api('/api/clis')).data.hiddenClis.includes('claude'),
  )
  await open('Model routing')
  const executor = page.locator('[data-settings-anchor="routing-executor"]')
  await step(
    'Model routing shares Executor model and retains hidden current agent',
    squash(await executor.getByLabel('Executor model', { exact: true }).innerText()) ===
      squash(chosen.value.replace(/^claude-/, '')) &&
      /Claude/.test(await executor.getByLabel('Executor agent').innerText()),
  )
  const reviewer = page.locator('[data-settings-anchor="routing-reviewer"]')
  await reviewer.getByLabel('Reviewer agent').click()
  await step(
    'hidden CLI is absent from other role pickers after reload',
    (await reviewer.getByRole('button', { name: 'claude', exact: true }).count()) === 0 &&
      (await reviewer.getByRole('button', { name: 'gemini', exact: true }).count()) === 0,
  )
  await shot('providers-hidden-routing')
  // No project task is run: this flow verifies configuration and its real UI consumer.
  await step(
    'Executor role remains assigned on disk',
    /agent: claude/.test(readFileSync(join(root, 'orchestos.config.yaml'), 'utf8')),
  )
}
