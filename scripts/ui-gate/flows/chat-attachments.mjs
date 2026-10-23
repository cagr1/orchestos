import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { run, writeGateRoles } from '../lib.mjs'

function plain(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/[*_]/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function waitFor(predicate, timeout = 180_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const result = await predicate()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return null
}

export default async function chatAttachments({ page, api, step, shot, visible, cleanup }) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'orchestos-ui-chat-attachments-'))
  writeFileSync(join(projectRoot, 'README.md'), '# Chat attachments\n')
  writeFileSync(join(projectRoot, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], projectRoot)
  run('git', ['add', 'README.md', '.gitignore'], projectRoot)
  run(
    'git',
    [
      '-c',
      'user.name=ui-gate',
      '-c',
      'user.email=ui-gate@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ],
    projectRoot,
  )
  const repoRoot = process.cwd()
  run('bun', ['run', join(repoRoot, 'src/cli.ts'), 'init', projectRoot], repoRoot)
  writeFileSync(
    join(projectRoot, 'tasks.yaml'),
    stringifyYaml({ version: 1, project: basename(projectRoot), tasks: [] }),
  )
  writeGateRoles(projectRoot)
  const configPath = join(projectRoot, 'orchestos.config.yaml')
  const config = parseYaml(readFileSync(configPath, 'utf8'))
  config.roles.orchestrator = { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' }
  writeFileSync(configPath, stringifyYaml(config))

  const projects = await api('/api/projects')
  const project = (projects.data ?? []).find((item) => item.path === projectRoot)
  if (!project) throw new Error(`temporary project was not registered: ${projectRoot}`)
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  const projectButton = page.getByRole('button', { name: basename(projectRoot), exact: true })
  await step('temporary project visible', await visible(projectButton), basename(projectRoot))
  await projectButton.hover()
  await page.getByRole('button', { name: 'Launch new agent', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const codexOption = dialog.getByRole('button', { name: /Codex/ }).first()
  await step('Codex agent available', await visible(codexOption), 'Codex option')
  await codexOption.click()
  const startResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await dialog.getByRole('button', { name: 'Launch Agent', exact: true }).click()
  const session = await (await startResponse).json()
  if (session.agent !== 'codex')
    throw new Error(`Expected Codex session, received ${session.agent}`)

  const uploads = []
  const chatBodies = []
  page.on('request', (req) => {
    const path = new URL(req.url()).pathname
    if (req.method() !== 'POST') return
    if (path === '/api/chat/upload') uploads.push(req.url())
    if (path === '/api/chat') chatBodies.push(req.postData() ?? '')
  })

  const pass = async (label, composer, session) => {
    await composer.waitFor({ state: 'visible', timeout: 30_000 })
    const hex = () => Math.random().toString(16).slice(2, 10).toUpperCase()
    const token = `ATT-${hex()}`
    // Palabras reales y legibles: el modelo lee la imagen, no hace OCR de cadenas aleatorias.
    const lexicon = [
      'PINEAPPLE',
      'LANTERN',
      'WALRUS',
      'CACTUS',
      'VIOLIN',
      'GLACIER',
      'TURBINE',
      'MARBLE',
      'ORCHID',
      'HAMMOCK',
      'COMPASS',
      'FALCON',
    ]
    const pick = () => lexicon.splice(Math.floor(Math.random() * lexicon.length), 1)[0]
    const imageWords = [pick(), pick()]
    const word = imageWords.join(' ')

    uploads.length = 0
    chatBodies.length = 0

    // 1) .txt por el input del clip
    await page
      .locator('[data-composer-region] input[type=file]')
      .last()
      .setInputFiles({
        name: 'token.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(`Attachment reference code: ${token}\n`),
      })

    // 2) PNG generado en el navegador, entra por pegado (distinto camino que el .txt)
    await composer.focus()
    await page.evaluate(async (text) => {
      const canvas = document.createElement('canvas')
      canvas.width = 900
      canvas.height = 220
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#000'
      ctx.font = 'bold 72px sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 20, 110)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const file = new File([blob], 'word.png', { type: 'image/png' })
      const data = new DataTransfer()
      data.items.add(file)
      const target = document.activeElement
      target.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    }, word)

    const chips = page.locator('[data-attachment-name][data-attachment-status]:visible')
    const ready = await waitFor(async () => {
      const statuses = await chips.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-attachment-status')),
      )
      return statuses.length === 2 && statuses.every((status) => status === 'ready')
        ? statuses
        : null
    }, 30_000)
    await step(
      `${label}: both attachments reach ready`,
      Boolean(ready),
      JSON.stringify(
        ready ??
          (await chips.evaluateAll((nodes) =>
            nodes.map((node) => [
              node.getAttribute('data-attachment-name'),
              node.getAttribute('data-attachment-status'),
              node.textContent,
            ]),
          )),
      ),
    )
    const send = page.getByRole('button', { name: 'Send message', exact: true }).last()
    await composer.fill(
      'Reply with the reference code from the attached text file and the two words in the attached image.',
    )
    const sendEnabled = await waitFor(async () => (await send.isEnabled()) || null, 30_000)
    await step(`${label}: Send is enabled with ready attachments`, Boolean(sendEnabled), 'enabled')
    await step(
      `${label}: 2 uploads observed`,
      uploads.length === 2,
      `${uploads.length} POST /api/chat/upload`,
    )
    await shot(`chat-attachments-composer-${label}`)

    const startedAt = Date.now()
    let sent = false
    while (!sent && Date.now() - startedAt < 60_000) {
      const request = page
        .waitForRequest(
          (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/chat',
          { timeout: 5_000 },
        )
        .then(() => true)
        .catch(() => false)
      await composer.press('Enter')
      sent = await request
    }
    if (!sent) throw new Error(`${label}: chat send request was not observed`)
    const sentBody = JSON.parse(chatBodies.at(-1) ?? '{}')
    const fileIds = Array.isArray(sentBody.fileIds) ? sentBody.fileIds : []
    await step(
      `${label}: POST /api/chat carries 2 server fileIds`,
      fileIds.length === 2 &&
        fileIds.every((id) => typeof id === 'string' && !id.startsWith('att_')),
      JSON.stringify(fileIds),
    )

    const done = await waitFor(async () => {
      const timeline = await api(`/api/chat/sessions/${encodeURIComponent(session.id)}/timeline`, {
        headers: { 'x-orchestos-project-id': project.id },
      })
      return !timeline.data?.pending &&
        timeline.data?.messages?.some((message) => message.role === 'assistant')
        ? timeline.data
        : null
    }, 240_000)
    if (!done) throw new Error(`${label}: Codex did not answer the attachment turn`)
    // El timeline del backend termina antes de que la UI pinte la respuesta: esperar a que
    // la última respuesta contenga lo esperado o quede estable.
    {
      const reply = page.locator('div.prose').last()
      await reply.waitFor({ state: 'visible', timeout: 60_000 })
      const wanted = [token, ...imageWords].map((item) => item.toLowerCase())
      let previous = ''
      let stableSince = Date.now()
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        const current = plain((await reply.innerText()).trim()).toLowerCase()
        if (wanted.every((item) => current.includes(item))) break
        if (current !== previous) {
          previous = current
          stableSince = Date.now()
        } else if (current && Date.now() - stableSince > 4000) break
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    const answer = plain(
      (await page.locator('div.prose').allInnerTexts()).at(-1) ?? '',
    ).toLowerCase()
    await step(
      `${label}: answer contains the token and the image word`,
      answer.includes(token.toLowerCase()) &&
        imageWords.every((item) => answer.includes(item.toLowerCase())),
      `token=${token} word=${word}; answer=${answer.slice(0, 160)}`,
    )

    const sentChips = page.locator('[data-attachment-name]:not([data-attachment-status]):visible')
    const names = await sentChips.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-attachment-name')),
    )
    // La miniatura puede estar recargando justo al terminar el turno: se espera a que se estabilice.
    const imageLoaded = Boolean(
      await waitFor(
        () =>
          page
            .locator('[data-attachment-name="word.png"]:not([data-attachment-status]):visible')
            .evaluateAll(
              (nodes) =>
                nodes.length > 0 &&
                nodes.every((node) => {
                  const img = node.querySelector('img')
                  return (
                    Boolean(img) &&
                    img.complete &&
                    img.naturalWidth > 0 &&
                    !node.querySelector('[role=status]')
                  )
                }),
            )
            .catch(() => false),
        10_000,
      ),
    )
    await step(
      `${label}: sent message keeps 2 attachments, image thumbnail loaded, after the turn`,
      names.length === 2 &&
        names.includes('token.txt') &&
        names.includes('word.png') &&
        imageLoaded,
      JSON.stringify({ names, imageLoaded }),
    )
    await shot(`chat-attachments-thread-${label}`)
  }

  const devComposer = page.locator('textarea').last()
  await pass('Dev', devComposer, session)

  // Segunda pasada en modo Chat: mismo proyecto, otro componente (OrchestChatView) y otra fusión.
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const chatDialog = page.getByRole('dialog')
  await chatDialog.getByRole('button', { name: /Codex/ }).first().click()
  const chatStart = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/chat/sessions',
  )
  await chatDialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const chatSession = await (await chatStart).json()
  await chatDialog.waitFor({ state: 'hidden', timeout: 15_000 })
  const chatComposer = page.locator('textarea').last()
  await pass('Chat', chatComposer, chatSession)
}
