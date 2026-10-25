import { execFileSync } from 'node:child_process'

export default async function chatTimeout(ctx) {
  const { page, step, shot, api, cleanup, databasePath } = ctx
  if (process.env.ORCHESTOS_CHAT_TURN_TIMEOUT_MS !== '4000')
    throw new Error('chat-timeout requires ORCHESTOS_CHAT_TURN_TIMEOUT_MS=4000')
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Codex/ }).first().click()
  const created = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat/sessions',
  )
  await dialog.getByRole('button', { name: 'Start Chat', exact: true }).click()
  const session = await (await created).json()
  const headers = session.projectId ? { 'x-orchestos-project-id': session.projectId } : {}
  const scope = session.projectId ? '' : '?project=none'
  cleanup(() => api(`/api/chat/sessions/${session.id}${scope}`, { method: 'DELETE', headers }))
  ctx.expectHttpError(/\/api\/chat(?:\?|$)/)
  const prompt =
    'Write a very detailed 20000 word history of mathematics. Think carefully for at least ten seconds before answering; then write the complete essay.'
  await page.locator('textarea').last().fill(prompt)
  const completed = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
    { timeout: 60000 },
  )
  await page.getByRole('button', { name: 'Send message', exact: true }).last().click()
  const waiting = page
    .locator('[data-thread-working]')
    .filter({ hasText: /Request sent to .* — no response yet, no error reported by Codex\s+2 s/ })
  await waiting.waitFor({ state: 'visible', timeout: 30000 })
  await step(
    'live no-response counter reaches two seconds',
    /Codex\s+2 s/.test(await waiting.innerText()) && !/\d+s ago/.test(await waiting.innerText()),
    await waiting.innerText(),
  )
  await shot('timeout-waiting')
  const response = await completed
  const body = await response.json()
  await step(
    'real Codex turn times out with a classified failure',
    response.status() === 502 && body.notice?.kind === 'timeout',
    JSON.stringify(body),
  )
  const notice = page.locator('[data-thread-notice="timeout"]')
  await notice.waitFor({ state: 'visible', timeout: 15000 })
  await step(
    'timeout message and Details remain visible in the turn',
    (await notice.innerText()).includes(body.notice.message) &&
      (await notice.getByText('Details', { exact: true }).isVisible()),
    await notice.innerText(),
  )
  await step(
    'notice without reasoning has no Thought heading',
    (await page.getByText(/^Thought(?: for .*)?$/).count()) === 0,
    await notice.locator('..').innerText(),
  )
  await step(
    'failed user message remains visible',
    await page.locator('div.max-w-2xl').filter({ hasText: prompt }).isVisible(),
    prompt,
  )
  await shot('timeout-failed')
  await notice.getByText('Details', { exact: true }).click()
  await step(
    'raw CLI timeout is expandable',
    (await notice.locator('pre').innerText()).includes('4000ms'),
    await notice.locator('pre').innerText(),
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.locator(`[data-thread-id="${session.id}"]`).click()
  await notice.waitFor({ state: 'visible', timeout: 15000 })
  await step(
    'reload restores failed user message and classified timeout',
    (await page.locator('div.max-w-2xl').filter({ hasText: prompt }).isVisible()) &&
      (await notice.innerText()).includes(body.notice.message),
    await notice.innerText(),
  )
  await step(
    'reload keeps the notice without a Thought heading',
    (await page.getByText(/^Thought(?: for .*)?$/).count()) === 0,
    await notice.locator('..').innerText(),
  )
  await shot('timeout-reloaded')
  const counts = JSON.parse(
    execFileSync(
      'bun',
      [
        '-e',
        `
    import { Database } from 'bun:sqlite'
    const db = new Database(${JSON.stringify(databasePath)}, { readonly: true })
    console.log(JSON.stringify(db.query("SELECT turn_id, count(*) AS n FROM chat_turn_steps WHERE session_id = ? AND type = 'notice' AND json_extract(detail, '$.kind') = 'timeout' GROUP BY turn_id").all(${JSON.stringify(session.id)})))
    db.close()
  `,
      ],
      { encoding: 'utf8' },
    ),
  )
  await step(
    'database stores exactly one timeout notice for the turn',
    counts.length === 1 && counts[0].n === 1,
    JSON.stringify(counts),
  )
}
