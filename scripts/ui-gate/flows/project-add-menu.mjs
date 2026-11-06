import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { run } from '../lib.mjs'

// ui:gate sets this server-side test flag; only it permits file://, while the UI
// and normal URL validation remain unchanged.
export default async function projectAddMenu({ page, api, step, shot, visible, hidden, cleanup }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-add-menu-')))
  const source = join(root, 'menu-fixture')
  const parent = join(root, 'clones')
  const destination = join(parent, 'menu-fixture')
  let projectId
  cleanup(async () => {
    if (projectId) {
      const removed = await api(`/api/projects/${projectId}/purge`, { method: 'POST' })
      if (!removed.ok) throw new Error(`project cleanup failed: ${removed.status}`)
    }
    const projects = (await api('/api/projects')).data
    if (projects.some((project) => project.path === destination))
      throw new Error('cloned project remains registered')
    rmSync(root, { recursive: true, force: true })
    if (existsSync(root)) throw new Error(`fixture remains: ${root}`)
  })
  mkdirSync(source)
  mkdirSync(parent)
  run('git', ['init', '-q'], source)
  writeFileSync(join(source, 'README.md'), 'UI.64 local clone fixture\n')
  run('git', ['add', 'README.md'], source)
  run(
    'git',
    [
      '-c',
      'user.name=Gate Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
    source,
  )

  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const add = page.getByRole('button', { name: 'Add or Upload Project', exact: true })
  const menu = page.getByRole('menu', { name: 'Add project', exact: true })
  await add.click()
  await step(
    'project menu offers both actions',
    (await visible(menu.getByRole('menuitem', { name: 'Open folder', exact: true }))) &&
      (await visible(menu.getByRole('menuitem', { name: 'Clone from URL', exact: true }))),
  )
  await shot('project-add-menu')
  await page.keyboard.press('Escape')
  await step(
    'Escape closes project menu and restores focus',
    (await hidden(menu)) && (await add.evaluate((button) => button === document.activeElement)),
  )
  await add.click()
  await page.keyboard.press('Tab')
  await step(
    'Tab closes project menu and restores focus',
    (await hidden(menu)) && (await add.evaluate((button) => button === document.activeElement)),
  )
  await add.click()
  await menu.getByRole('menuitem', { name: 'Clone from URL', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Clone from URL', exact: true })
  await dialog.getByLabel('Git URL', { exact: true }).fill(pathToFileURL(source).href)
  await dialog.getByLabel('Clone location', { exact: true }).fill(parent)
  await step(
    'clone dialog previews destination',
    (await dialog.getByLabel('Clone destination').innerText()) === destination,
  )
  await shot('clone-dialog')
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/projects/clone') && response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'Clone', exact: true }).click()
  const cloned = await response
  const project = await cloned.json()
  projectId = project.id
  const registered = (await api('/api/projects')).data
  await step(
    'local clone registers project',
    cloned.ok() && registered.some((row) => row.id === projectId && row.path === destination),
    JSON.stringify({ status: cloned.status(), project, destination, registered }),
  )
  await step(
    'clone contains committed file',
    existsSync(join(destination, '.git')) &&
      readFileSync(join(destination, 'README.md'), 'utf8') === 'UI.64 local clone fixture\n',
  )
  await step('clone dialog closes on success', await hidden(dialog))
  const projectButton = page.getByRole('button', { name: 'menu-fixture', exact: true })
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await step(
    'cloned project is active',
    (await visible(projectButton)) &&
      (await visible(page.getByRole('heading', { name: 'menu-fixture', exact: true }))),
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const newChat = page.getByRole('dialog')
  await newChat.getByRole('button', { name: 'menu-fixture', exact: true }).click()
  await newChat.getByRole('button', { name: /Codex/ }).first().click()
  await newChat.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const attach = page.getByRole('button', { name: 'Attach file', exact: true })
  await attach.click()
  const attachments = page.getByRole('menu', { name: 'Attach files', exact: true })
  await step(
    'clip offers upload and project files',
    (await visible(
      attachments.getByRole('menuitem', { name: 'Upload from computer', exact: true }),
    )) &&
      (await visible(
        attachments.getByRole('menuitem', { name: 'File from project', exact: true }),
      )),
  )
  await shot('attachment-menu')
  await attachments.getByRole('menuitem', { name: 'File from project', exact: true }).click()
  const files = page.getByRole('listbox', { name: 'Project files', exact: true })
  await step(
    'File from project opens existing reference picker',
    await visible(files.getByRole('option', { name: 'README.md', exact: true })),
  )
  await files.getByRole('option', { name: 'README.md', exact: true }).click()
  await step(
    'project reference inserted in composer',
    (await page.locator('textarea').last().inputValue()) === '@README.md ',
  )
  await page.locator('textarea').last().fill('')
  await attach.click()
  const chooser = page.waitForEvent('filechooser')
  await attachments.getByRole('menuitem', { name: 'Upload from computer', exact: true }).click()
  await step('Upload from computer opens system file picker', (await chooser).isMultiple())
}
