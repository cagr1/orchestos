import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function devCodexSkills({ page, api, step, shot, cleanup, expectHttpError }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-cmd2-')))
  cleanup(() => rmSync(root, { recursive: true, force: true }))
  const name = 'catalog-probe'
  const description = 'A project skill for the Codex catalog gate'
  const skillDir = join(root, '.agents', 'skills', name)
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\nFixture for catalog discovery.\n`,
  )
  run('git', ['init', '-q'], root)
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeGateRoles(root)
  const project = (await api('/api/projects')).data.find((item) => item.path === root)
  if (!project) throw new Error('Catalog fixture project was not registered')
  const codexHome = join(root, '.orchestos', 'agent-home', 'codex')
  mkdirSync(codexHome, { recursive: true })
  writeFileSync(join(codexHome, 'auth.json'), '{}\n')
  const headers = { 'x-orchestos-project-id': project.id, 'Content-Type': 'application/json' }
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
      headers,
    })
    if (!purged.ok) throw new Error(`Catalog fixture purge failed: ${purged.status}`)
    const remaining = await api('/api/projects')
    if (remaining.data.some((item) => item.id === project.id))
      throw new Error('Catalog fixture project remains after purge')
  })
  const session = await api('/api/chat/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ agent: 'codex', projectId: project.id, title: 'Codex catalog gate' }),
  })
  if (!session.ok || !session.data.id) throw new Error('Catalog fixture session was not created')
  await page.evaluate(
    ({ projectId, sessionId }) =>
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId })),
    { projectId: project.id, sessionId: session.data.id },
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  const catalogResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === '/api/chat/cli-commands' &&
      url.searchParams.get('cli') === 'codex' &&
      url.searchParams.get('projectId') === project.id
    )
  })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.locator(`[data-session-tab="${session.data.id}"]`).waitFor()
  const catalog = await (await catalogResponse).json()
  await step(
    'project catalog includes compact and the enabled fixture skill',
    catalog.some((entry) => entry.name === 'compact' && entry.kind === 'rpc') &&
      catalog.some(
        (entry) =>
          entry.name === name && entry.description === description && entry.source === 'skill',
      ),
    JSON.stringify(catalog.filter((entry) => entry.name === name || entry.name === 'compact')),
  )
  const composer = page.locator('[data-composer-region] textarea')
  await composer.fill('/catalog')
  const option = page.getByRole('button', { name: '/catalog-probe Skill', exact: true })
  await option.waitFor()
  const group = page.locator('div.uppercase').filter({ hasText: /^Codex$/ })
  await step(
    'Dev shows the skill in the CODEX group',
    (await group.isVisible()) && (await option.isVisible()),
  )
  await shot('codex-skill-menu')
  await option.click()
  await step(
    'selecting a skill inserts the slash command',
    (await composer.inputValue()) === `/${name} `,
  )

  // Observe the regular browser request and simulate a rejected send before it starts a turn.
  const isSend = (url) => new URL(url).pathname === '/api/chat'
  expectHttpError(/\/api\/chat(?:\?|$)/)
  await page.route(
    (url) => isSend(url),
    (route) => route.fulfill({ status: 422, json: { error: 'Fixture rejected this send' } }),
  )
  const draft = '/CATALOG-PROBE  one two '
  await composer.fill(draft)
  const sent = page.waitForResponse(
    (response) => isSend(response.url()) && response.request().method() === 'POST',
  )
  await composer.press('Enter')
  const response = await sent
  const payload = response.request().postDataJSON()
  await step(
    'ordinary POST uses the catalog name and preserves argument spacing',
    payload.message === '$catalog-probe  one two' &&
      payload.sessionId === session.data.id &&
      response.request().headers()['x-orchestos-project-id'] === project.id,
    JSON.stringify({ message: payload.message, status: response.status() }),
  )
  await page.waitForFunction(
    (expected) => document.querySelector('[data-composer-region] textarea')?.value === expected,
    draft,
  )
  await step(
    'a rejected send restores the original slash draft',
    (await composer.inputValue()) === draft,
  )
}
