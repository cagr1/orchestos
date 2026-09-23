function basename(path) {
  const clean = path.replace(/[\\/]$/, '')
  return clean.split(/[\\/]/).pop() || path
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default async function smoke({ page, api, step, shot, visible }) {
  await step(
    'home',
    await visible(page.getByRole('button', { name: 'Chat', exact: true })),
    'Chat visible',
  )
  await step(
    'home-dev',
    await visible(page.getByRole('button', { name: 'Dev', exact: true })),
    'Dev visible',
  )
  await shot('chat')

  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await step(
    'dev-view',
    await visible(page.getByRole('heading', { name: 'OrchestOS Dev', exact: true })),
    'OrchestOS Dev visible',
  )
  await shot('dev')

  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await step('chat-composer', await visible(page.locator('textarea')), 'chat composer visible')
  await shot('chat-returned')

  const projectsResponse = await api('/api/projects')
  const projects = Array.isArray(projectsResponse.data) ? projectsResponse.data : []
  const projectNames = projects
    .map((project) => basename(project.path))
    .filter((name) => name.length > 0)
  let currentProjectName = null

  if (projectNames.length > 0) {
    const projectNamePattern = new RegExp(`^(?:${projectNames.map(escapeRegExp).join('|')})$`)
    const mainSidebar = page.locator('aside').filter({
      has: page.getByRole('button', { name: 'Settings', exact: true }),
    })
    const projectInSidebar = mainSidebar.getByText(projectNamePattern)
    await visible(projectInSidebar)
    for (const projectName of projectNames) {
      if (await mainSidebar.getByText(projectName, { exact: true }).isVisible()) {
        currentProjectName = projectName
        break
      }
    }
    currentProjectName ||= projectNames[0]
  }

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await step(
    'settings-view',
    projectNames.length > 0
      ? await visible(page.getByRole('heading', { name: currentProjectName, exact: true }))
      : await visible(page.getByRole('heading', { name: 'Appearance', exact: true })),
    projectNames.length > 0 ? 'current project section visible' : 'Appearance visible',
  )
  await shot('settings')

  await page.getByRole('button', { name: 'General', exact: true }).click()
  await step(
    'settings-general',
    await visible(page.getByRole('heading', { name: 'Appearance', exact: true })),
    'Appearance visible',
  )
  await shot('settings-general')
}
