import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'ignore' })
}

export default async function orchestration({ page, api, step, shot, cleanup }) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-ui-orch-'))
  writeFileSync(join(root, 'README.md'), '# Orchestration UI gate\n')
  writeFileSync(join(root, '.gitignore'), '.orchestos/\n')
  run('git', ['init', '-q'], root)
  run('git', ['add', '-A'], root)
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
    root,
  )
  run('bun', ['run', join(process.cwd(), 'src/cli.ts'), 'init', root], process.cwd())
  const listed = await api('/api/projects')
  const project = (listed.data ?? []).find((item) => item.path === root)
  if (!project) throw new Error(`temporary project not registered: ${root}`)
  const headers = { 'x-orchestos-project-id': project.id }
  const waitForPolicy = async (predicate) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await api('/api/orchestration', { headers })
      if (response.status === 200 && predicate(response.data)) return response
      await delay(100)
    }
    return api('/api/orchestration', { headers })
  }
  cleanup(async () => {
    await api(`/api/projects/${encodeURIComponent(project.id)}/purge`, { method: 'POST' })
    rmSync(root, { recursive: true, force: true })
  })

  const openProjectSettings = async () => {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Dev', exact: true }).click()
    await page.getByRole('button', { name: basename(root), exact: true }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('heading', { name: 'Orquestación', exact: true }).waitFor()
  }
  const settings = () =>
    page
      .getByRole('heading', { name: 'Orquestación', exact: true })
      .locator('xpath=ancestor::section[1]')
  const inputs = () => settings().getByRole('spinbutton')
  const enabledSwitch = () => settings().getByRole('checkbox')

  await openProjectSettings()
  await enabledSwitch().check()
  await step(
    'activar solo habilita límites sin guardar defaults',
    (await enabledSwitch().isChecked()) &&
      (await api('/api/orchestration', { headers })).data.enabled === false,
  )
  await inputs().nth(0).fill('2')
  await inputs().nth(1).fill('7')
  await settings().getByRole('button', { name: 'Guardar', exact: true }).click()
  const saved = await waitForPolicy(
    (value) => value.enabled && value.maxConcurrent === 2 && value.maxTotal === 7,
  )
  await step(
    'guardar ON por la UI persiste los dos límites',
    saved.status === 200 &&
      saved.data.enabled &&
      saved.data.maxConcurrent === 2 &&
      saved.data.maxTotal === 7,
    JSON.stringify(saved.data),
  )

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('heading', { name: 'Orquestación', exact: true }).waitFor()
  await step(
    'límites 2 y 7 se muestran tras recargar',
    (await inputs().nth(0).inputValue()) === '2' && (await inputs().nth(1).inputValue()) === '7',
  )

  await inputs().nth(1).fill('')
  await settings().getByRole('button', { name: 'Guardar', exact: true }).click()
  await settings().getByRole('alert').waitFor()
  const unchanged = await api('/api/orchestration', { headers })
  await step(
    'guardar con un límite vacío muestra error y conserva 2/7 en GET',
    unchanged.status === 200 && unchanged.data.maxConcurrent === 2 && unchanged.data.maxTotal === 7,
    JSON.stringify(unchanged.data),
  )

  await settings().getByText('Llamadas adicionales', { exact: true }).waitFor()
  await step(
    'la UI declara codex y opencode no garantizados',
    (await settings()
      .getByText(/codex: no garantizado/i)
      .count()) > 0 &&
      (await settings()
        .getByText(/opencode: no garantizado/i)
        .count()) > 0,
  )

  await inputs().nth(1).fill('7')
  await settings().getByRole('button', { name: 'Guardar', exact: true }).click()
  await waitForPolicy((value) => value.enabled && value.maxConcurrent === 2 && value.maxTotal === 7)
  await enabledSwitch().uncheck()
  await waitForPolicy((value) => !value.enabled)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByRole('button', { name: basename(root), exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('heading', { name: 'Orquestación', exact: true }).waitFor()
  const off = await api('/api/orchestration', { headers })
  await step(
    'apagar desde la UI persiste OFF tras recargar',
    !(await enabledSwitch().isChecked()) && off.status === 200 && off.data.enabled === false,
    JSON.stringify(off.data),
  )
  await shot('orchestration-settings')
}
