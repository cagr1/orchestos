import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { run, writeGateRoles } from '../lib.mjs'

export default async function devFileEdit({
  page,
  api,
  step,
  shot,
  cleanup,
  hidden,
  consoleErrors,
  expectHttpError,
}) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-file-edit-'))
  writeFileSync(join(root, 'notes.txt'), 'Original notes\n')
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src/index.ts'), 'export const answer: number = 42\n')
  writeFileSync(join(root, 'binary.dat'), Buffer.from([65, 0, 66]))
  writeFileSync(join(root, 'large.txt'), 'x'.repeat(200_001))
  run('git', ['init', '-q'], root)
  run('git', ['add', '.'], root)
  run(
    'git',
    [
      '-c',
      'user.name=Gate',
      '-c',
      'user.email=gate@example.test',
      'commit',
      '-qm',
      'fixture baseline',
    ],
    root,
  )
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  writeGateRoles(root)
  const project = (await api('/api/projects')).data.find((item) => item.path === root)
  if (!project) throw new Error('fixture project missing')
  cleanup(async () => {
    const purged = await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, {
      method: 'POST',
    })
    if (!purged.ok) throw new Error(`purge failed: ${JSON.stringify(purged)}`)
    if ((await api('/api/projects')).data.some((item) => item.id === project.id))
      throw new Error('fixture project remains')
    const sessions = await api(`/api/chat/sessions?project=${encodeURIComponent(project.id)}`)
    if (sessions.data.length) throw new Error('fixture sessions remain')
    rmSync(root, { recursive: true, force: true })
  })
  const session = await api('/api/chat/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-orchestos-project-id': project.id },
    body: JSON.stringify({ projectId: project.id, agent: 'codex', title: 'Editor fixture' }),
  })
  if (!session.ok) throw new Error('fixture session missing')
  await page.evaluate(
    ({ projectId, sessionId }) => {
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ projectId, sessionId }))
      localStorage.removeItem('orchestos-dev-tabs')
      localStorage.removeItem('orchestos-dev-session-tabs')
      localStorage.removeItem('orchestos-dev-file-tabs')
    },
    { projectId: project.id, sessionId: session.data.id },
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  const tree = (path) => page.locator(`[data-explorer-file="${path}"]`)
  const tab = (path) => page.locator(`[data-file-tab="${path}"]`)
  const editor = page.locator('[data-file-editor] .cm-content')
  const dirty = page.locator('[data-file-dirty]')
  const conflict = page.locator('[data-file-conflict]')
  const text = async (value) => {
    await editor.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.insertText(value)
  }
  const assertText = async (value) => {
    await page.waitForFunction(
      (value) => document.querySelector('[data-file-editor] .cm-content')?.textContent === value,
      value,
    )
  }
  let diskTime = Date.now() / 1000 + 10
  const changeDisk = (content) => {
    writeFileSync(join(root, 'notes.txt'), content)
    diskTime += 10
    utimesSync(join(root, 'notes.txt'), diskTime, diskTime)
  }
  const focus = () => page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await tree('notes.txt').click()
  await assertText('Original notes')
  await shot('opened')
  await text('Saved from editor')
  await dirty.waitFor()
  await step(
    'editing marks tab and footer dirty',
    (await tab('notes.txt').getAttribute('data-dirty')) !== null &&
      (await dirty.innerText()).includes('Unsaved'),
  )
  await shot('dirty')
  await page.evaluate(() =>
    window.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's')
        window.__adeSavePrevented = event.defaultPrevented
    }),
  )
  await page.keyboard.press('ControlOrMeta+s')
  await dirty.waitFor({ state: 'detached' })
  await step(
    'save shortcut prevents browser save and persists text',
    (await tab('notes.txt').getAttribute('data-dirty')) === null &&
      readFileSync(join(root, 'notes.txt'), 'utf8') === 'Saved from editor' &&
      (await page.evaluate(() => window.__adeSavePrevented)) === true,
  )
  await shot('saved')

  await text('Draft survives tab switch')
  await page.getByRole('button', { name: 'src', exact: true }).click()
  await tree('src/index.ts').click()
  await assertText('export const answer: number = 42')
  await tab('notes.txt').click()
  await assertText('Draft survives tab switch')
  await step(
    'draft survives switching files and its preview tab is retained',
    (await tab('notes.txt').getAttribute('data-dirty')) !== null && (await dirty.count()) === 1,
  )
  await shot('draft-restored')

  changeDisk('External conflict')
  await focus()
  await conflict.waitFor()
  await step(
    'focus detects external changes without replacing draft',
    (await editor.textContent()) === 'Draft survives tab switch',
  )
  await shot('conflict')
  await conflict.getByRole('button', { name: 'Reload', exact: true }).click()
  await assertText('External conflict')
  await step(
    'Reload takes disk content and clears dirty state',
    (await hidden(conflict)) && (await hidden(dirty)),
  )
  await shot('reloaded')

  changeDisk('Automatic disk reload')
  await focus()
  await assertText('Automatic disk reload')
  await step(
    'clean buffer reloads automatically on focus',
    (await dirty.count()) === 0 && (await conflict.count()) === 0,
  )
  await shot('automatic-reload')

  await text('Keep my draft')
  changeDisk('Disk before keep mine')
  await focus()
  await conflict.waitFor()
  await conflict.getByRole('button', { name: 'Keep mine', exact: true }).click()
  await dirty.waitFor({ state: 'detached' })
  await step(
    'Keep mine saves using the disk mtime',
    readFileSync(join(root, 'notes.txt'), 'utf8') === 'Keep my draft' && (await hidden(conflict)),
  )
  await shot('kept-mine')

  await text('Draft before stale save')
  changeDisk('Disk wins stale save')
  expectHttpError(/\/api\/explorer\/file$/)
  const staleSave = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/explorer/file') && response.request().method() === 'PUT',
  )
  await page.keyboard.press('ControlOrMeta+s')
  const stale = await staleSave
  await conflict.waitFor()
  await step(
    '409 displays the conflict bar without overwriting the disk',
    stale.status() === 409 &&
      readFileSync(join(root, 'notes.txt'), 'utf8') === 'Disk wins stale save',
  )
  await shot('save-conflict')
  await conflict.getByRole('button', { name: 'Reload', exact: true }).click()
  await assertText('Disk wins stale save')

  await text('Save error draft')
  await page.route('**/api/explorer/file', (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Fixture save failure' }),
        })
      : route.continue(),
  )
  await page.keyboard.press('ControlOrMeta+s')
  await page.getByRole('alert').waitFor()
  await step(
    'save error is shown and the draft remains dirty',
    (await page.getByRole('alert').innerText()) === 'Fixture save failure' &&
      (await dirty.count()) === 1,
  )
  await shot('save-error')
  await page.unroute('**/api/explorer/file')

  const closeNotes = async () => {
    await tab('notes.txt').hover()
    await page.getByRole('button', { name: 'Close file tab notes.txt', exact: true }).click()
  }
  await closeNotes()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await step(
    'closing dirty tab asks before discarding',
    (await dialog.innerText()).includes('Discard unsaved changes to notes.txt?'),
  )
  await shot('discard-confirmation')
  await page.keyboard.press('Escape')
  await step(
    'Escape cancels and keeps draft',
    (await hidden(dialog)) &&
      (await tab('notes.txt').count()) === 1 &&
      (await editor.textContent()) === 'Save error draft',
  )
  const unloadBlocked = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  await step('beforeunload is blocked while any buffer is dirty', unloadBlocked)
  await closeNotes()
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click()
  await step(
    'Discard drops the buffer and closes its tab',
    (await hidden(tab('notes.txt'))) && (await hidden(dialog)),
  )
  await tree('notes.txt').click()
  await assertText('Disk wins stale save')
  await step(
    'reopening discarded file reads disk without stale save errors',
    (await dirty.count()) === 0 && (await page.getByRole('alert').count()) === 0,
  )
  await shot('discarded-and-reopened')

  await tree('binary.dat').click()
  await page.locator('[data-file-unavailable]').waitFor()
  await step(
    'binary file explains why no editor is shown',
    (await page.locator('[data-file-unavailable]').innerText()) === 'Binary file — not shown' &&
      (await editor.count()) === 0,
  )
  await shot('binary')
  await tree('large.txt').click()
  await page
    .locator('[data-file-unavailable]')
    .getByText('File too large to open (195 KB)', { exact: true })
    .waitFor()
  await step('oversize file explains why no editor is shown', (await editor.count()) === 0)
  await shot('too-large')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const sidebar = page.locator('aside').filter({
    has: page.getByRole('button', { name: 'Back to app', exact: true }),
  })
  await sidebar.getByRole('button', { name: 'Editor', exact: true }).click()
  const wrapRow = page.locator('[data-settings-anchor="editor-word-wrap"]')
  const fontRow = page.locator('[data-settings-anchor="editor-font-size"]')
  await wrapRow.getByRole('radio', { name: 'On', exact: true }).click()
  await fontRow.getByRole('button', { name: 'Increase Font size', exact: true }).click()
  await fontRow.getByRole('button', { name: 'Increase Font size', exact: true }).click()
  await fontRow.getByRole('button', { name: 'Increase Font size', exact: true }).click()
  await fontRow.getByRole('button', { name: 'Increase Font size', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Back to app', exact: true }).click()
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await tree('notes.txt').click()
  await assertText('Disk wins stale save')
  const longLine = 'a long editor line with several words '.repeat(12)
  await text(longLine)
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('[data-file-editor] .cm-content')).fontSize ===
      '16px',
  )
  await step(
    'word wrap and 16px font apply to the live editor',
    (await page
      .locator('[data-file-editor] .cm-scroller')
      .evaluate((el) => el.scrollWidth <= el.clientWidth)) &&
      (await page
        .locator('[data-file-editor] .cm-content')
        .evaluate((el) => getComputedStyle(el).fontSize)) === '16px',
  )
  await shot('editor-word-wrap')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Editor', exact: true }).click()
  const autoSaveRow = page.locator('[data-settings-anchor="editor-auto-save"]')
  await autoSaveRow.getByRole('radio', { name: 'After delay', exact: true }).click()
  const delayRow = page.locator('[data-settings-anchor="editor-auto-save-delay"]')
  while (!(await delayRow.innerText()).includes('500'))
    await delayRow.getByRole('button', { name: 'Decrease Auto save delay', exact: true }).click()
  await shot('editor-settings')
  await sidebar.getByRole('button', { name: 'Back to app', exact: true }).click()
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await tree('notes.txt').click()
  await page.waitForFunction(
    (prefix) =>
      document.querySelector('[data-file-editor] .cm-content')?.textContent?.startsWith(prefix),
    longLine.slice(0, 40),
  )
  await text('Automatically saved')
  await dirty.waitFor({ state: 'detached', timeout: 3000 })
  await step(
    '500ms auto save writes the draft without the shortcut',
    readFileSync(join(root, 'notes.txt'), 'utf8') === 'Automatically saved',
  )

  let delayedPut = true
  await page.route('**/api/explorer/file', async (route) => {
    if (route.request().method() === 'PUT' && delayedPut) {
      delayedPut = false
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    await route.continue()
  })
  await text('First automatic save')
  const automaticPut = page.waitForRequest(
    (request) => request.url().endsWith('/api/explorer/file') && request.method() === 'PUT',
  )
  await automaticPut
  await text('Latest automatic save')
  await dirty.waitFor({ state: 'detached', timeout: 5000 })
  await step(
    'automatic save retries the latest draft after a slow PUT',
    readFileSync(join(root, 'notes.txt'), 'utf8') === 'Latest automatic save',
  )
  await page.unroute('**/api/explorer/file')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Editor', exact: true }).click()
  await autoSaveRow.getByRole('radio', { name: 'Off', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Back to app', exact: true }).click()
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await tree('notes.txt').click()
  await page.waitForFunction(
    () =>
      document.querySelector('[data-file-editor] .cm-content')?.textContent ===
      'Latest automatic save',
  )
  delayedPut = true
  await page.route('**/api/explorer/file', async (route) => {
    if (route.request().method() === 'PUT' && delayedPut) {
      delayedPut = false
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    await route.continue()
  })
  await text('First shortcut save')
  const shortcutPut = page.waitForRequest(
    (request) => request.url().endsWith('/api/explorer/file') && request.method() === 'PUT',
  )
  await page.keyboard.press('ControlOrMeta+s')
  await shortcutPut
  await text('Latest shortcut save')
  await page.keyboard.press('ControlOrMeta+s')
  await dirty.waitFor({ state: 'detached', timeout: 5000 })
  await step(
    'save shortcut retries the latest draft after a slow PUT',
    readFileSync(join(root, 'notes.txt'), 'utf8') === 'Latest shortcut save',
  )
  await page.unroute('**/api/explorer/file')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Editor', exact: true }).click()
  await autoSaveRow.getByRole('radio', { name: 'After delay', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Back to app', exact: true }).click()
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await tree('notes.txt').click()
  await page.waitForFunction(
    () =>
      document.querySelector('[data-file-editor] .cm-content')?.textContent ===
      'Latest shortcut save',
  )

  await text('Conflict must not autosave')
  changeDisk('External content wins')
  await focus()
  await conflict.waitFor()
  await page.waitForTimeout(700)
  await step(
    'auto save waits for the user while a conflict is open',
    (await dirty.count()) === 1 &&
      readFileSync(join(root, 'notes.txt'), 'utf8') === 'External content wins',
  )
  await conflict.getByRole('button', { name: 'Reload', exact: true }).click()
  await assertText('External content wins')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Editor', exact: true }).click()
  while ((await delayRow.innerText()).includes('500'))
    await delayRow.getByRole('button', { name: 'Increase Auto save delay', exact: true }).click()
  await autoSaveRow.getByRole('radio', { name: 'Off', exact: true }).click()
  await wrapRow.getByRole('radio', { name: 'Off', exact: true }).click()
  for (let size = 16; size > 12; size -= 1)
    await fontRow.getByRole('button', { name: 'Decrease Font size', exact: true }).click()
  await step('0 console errors', consoleErrors().length === 0, consoleErrors().join('; ') || 'none')
}
