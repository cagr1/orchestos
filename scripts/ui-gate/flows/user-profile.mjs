import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export default async function userProfile({
  page,
  base,
  api,
  step,
  shot,
  visible,
  hidden,
  cleanup,
  databasePath,
  restartDashboard,
}) {
  const profilePath = join(dirname(databasePath), 'profile.json')
  const previous = existsSync(profilePath) ? readFileSync(profilePath) : null
  cleanup(() => {
    if (previous) writeFileSync(profilePath, previous)
    else rmSync(profilePath, { force: true })
    if (previous ? !readFileSync(profilePath).equals(previous) : existsSync(profilePath))
      throw new Error('profile fixture cleanup failed')
  })
  rmSync(profilePath, { force: true })
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  const question = page.getByText('Do you write code?', { exact: true })
  await step('empty Chat asks about coding', await visible(question))
  await shot('user-profile-question')
  const chooseNo = page.waitForResponse(
    (response) => response.url().endsWith('/api/profile') && response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: "I don't write code", exact: true }).click()
  const noResponse = await chooseNo
  await step('No endpoint succeeds', noResponse.ok() && (await noResponse.json()).codes === false)
  await step('answer hides the card', await hidden(question))
  await step(
    'No persists globally',
    JSON.parse(readFileSync(profilePath, 'utf8')).codes === false &&
      (await api('/api/profile')).codes === false,
  )
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'General', exact: true }).click()
  const choices = page.getByRole('radiogroup', { name: 'I write code', exact: true })
  await step(
    'General shows No',
    await visible(choices.getByRole('radio', { name: 'No', exact: true, checked: true })),
  )
  await shot('user-profile-settings-no')
  const chooseYes = page.waitForResponse(
    (response) => response.url().endsWith('/api/profile') && response.request().method() === 'PUT',
  )
  await choices.getByRole('radio', { name: 'Yes', exact: true }).click()
  const yesResponse = await chooseYes
  await step('Yes endpoint succeeds', yesResponse.ok() && (await yesResponse.json()).codes === true)
  await page.waitForFunction(
    () =>
      document.querySelector(
        '[role="radiogroup"][aria-label="I write code"] [role="radio"][aria-checked="true"]',
      )?.textContent === 'Yes',
  )
  await step('Yes persists globally', JSON.parse(readFileSync(profilePath, 'utf8')).codes === true)
  await shot('user-profile-settings-yes')
  await restartDashboard()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'General', exact: true }).click()
  await step(
    'Yes survives server restart',
    (await visible(choices.getByRole('radio', { name: 'Yes', exact: true, checked: true }))) &&
      (await api('/api/profile')).codes === true,
  )
}
