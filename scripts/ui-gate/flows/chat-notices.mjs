// CHAT.3: real dashboard/browser; the invalid model is rejected by the real
// catalog validator. No CLI response or HTTP response is mocked.
export default async function chatNotices(ctx) {
  const { page, step, shot, api, cleanup } = ctx
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
  const composer = page.locator('textarea').last()
  await composer.fill('Reply with exactly: CHAT3 normal response')
  const completed = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
    { timeout: 150000 },
  )
  await page.getByRole('button', { name: 'Send message', exact: true }).last().click()
  const normal = await completed
  const normalBody = await normal.json()
  await step(
    'normal Codex turn completes',
    normal.ok() && normalBody.text?.includes('CHAT3 normal response'),
    JSON.stringify(normalBody),
  )
  const timeline = await api(`/api/chat/sessions/${session.id}/timeline${scope}`, { headers })
  const notices = timeline.data.turns
    .flatMap((turn) => turn.steps)
    .filter((item) => item.type === 'notice' && item.notice?.kind !== 'no-response')
  await step(
    'normal Codex turn shows no failure notice',
    notices.length === 0 && (await page.locator('[data-thread-notice]').count()) === 0,
    JSON.stringify(notices),
  )
  await shot('normal-turn-no-notice')
  ctx.expectHttpError(/\/api\/chat(?:\?|$)/)
  await page.route(/\/api\/chat(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.continue({
      postData: JSON.stringify({
        ...route.request().postDataJSON(),
        model: 'modelo-inexistente-xyz',
      }),
    })
  })
  await composer.fill('Reply with hello.')
  const response = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/chat',
  )
  await page.getByRole('button', { name: 'Send message', exact: true }).last().click()
  const failed = await response
  const body = await failed.json()
  const message = "Model 'modelo-inexistente-xyz' is not available for Codex CLI."
  const alert = page.getByRole('alert').filter({ hasText: message })
  await step(
    'invalid Codex model is classified by the real server',
    failed.status() === 400 && body.notice?.kind === 'invalid-model',
    JSON.stringify(body),
  )
  await step('classified failure is visible in the chat thread', await ctx.visible(alert), message)
  await shot('invalid-model-classified')
  await alert.getByText('Details', { exact: true }).click()
  await step(
    'original validation detail expands',
    await ctx.visible(alert.locator('pre')),
    body.notice?.detail,
  )
  await shot('invalid-model-detail')
}
