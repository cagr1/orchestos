import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('AUD.25 purge releases hydration suppression after success and failure', async () => {
  // Execute the actual App callback with its collaborators replaced, avoiding a DOM mount of App.
  const app = readFileSync(join(import.meta.dir, '../app/src/App.tsx'), 'utf8')
  const start = app.indexOf('  const handlePurgeProjectData = async')
  const end = app.indexOf('  // Danger Zone - Reset OrchestOS', start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  const callback = app.slice(start, end).replace('(projectId: string)', '(projectId)')
  for (const fail of [false, true]) {
    const purgingProjectIds = { current: new Set<string>() }
    let deleting = new Set<string>()
    let observedBlocked = false
    const noop = () => {}
    const collaborators = {
      purgingProjectIds,
      flushSync: (fn: () => void) => fn(),
      setDeletingProjectIds: (fn: (current: Set<string>) => Set<string>) => {
        deleting = fn(deleting)
      },
      abortProjectHydrations: async () => {},
      purgeProjectData: async () => {
        observedBlocked = purgingProjectIds.current.has('project') && deleting.has('project')
        if (fail) throw new Error('purge failed')
      },
      listProjects: async () => [],
      setProjects: noop,
      setActiveProjectId: noop,
      updateDevTabs: noop,
      emptySessionTabs: noop,
      setRuns: noop,
      setThreads: noop,
      setMode: noop,
      previousMode: 'dev',
      reloadHistory: async () => {},
    }
    const purge = new Function(
      ...Object.keys(collaborators),
      `${callback}\nreturn handlePurgeProjectData`,
    )(...Object.values(collaborators))
    await purge('project')
    expect(observedBlocked).toBe(true)
    expect(purgingProjectIds.current.has('project')).toBe(false)
    expect(deleting.has('project')).toBe(false)
  }
})

test('AUD.25 UI handlers preserve cancel, failed drafts, executor defaults and kanban plans', async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      '-e',
      String.raw`
const { mock } = await import('bun:test')
const react = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
let states = [], refs = [], effects = [], stateIndex = 0, refIndex = 0
mock.module('react', () => ({ ...react,
  useEffect: effect => { effects.push(effect) },
  useRef: initial => { const i = refIndex++; return refs[i] ??= { current: initial } },
  useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
}))
function reset() { states = []; refs = []; effects = [] }
function render(Component, props) {
  stateIndex = 0; refIndex = 0; effects = []
  let tree
  function Capture() { tree = Component(props); return null }
  renderToStaticMarkup(react.createElement(Capture))
  return tree
}
function nodes(tree, predicate) {
  const found = []
  function visit(node) {
    react.Children.forEach(node, child => {
      if (!react.isValidElement(child)) return
      if (predicate(child)) found.push(child)
      visit(child.props.children)
    })
  }
  visit(tree)
  return found
}
const { ConfirmDialog } = await import(process.cwd() + '/src/dashboard/app/src/components/common/ConfirmDialog.tsx')
let confirmed = 0, cancelled = 0, prevented = 0
const dialog = render(ConfirmDialog, { title: 'Confirm', confirmLabel: 'Delete', onConfirm() { confirmed++ }, onCancel() { cancelled++ } })
const cancel = nodes(dialog, child => child.type === 'button' && child.props.children === 'Cancel')[0]
dialog.props.onKeyDown({ key: 'Enter', target: { closest: () => ({ tagName: 'BUTTON' }) }, preventDefault() { prevented++ }, stopPropagation() {} })
if (confirmed || prevented) throw new Error('Enter intercepted Cancel')
cancel.props.onClick()
if (cancelled !== 1) throw new Error('Cancel not activated')
dialog.props.onKeyDown({ key: 'Enter', target: { closest: () => null }, preventDefault() {}, stopPropagation() {} })
if (confirmed !== 1) throw new Error('Non-button Enter did not confirm')
const { InstinctsView } = await import(process.cwd() + '/src/dashboard/app/src/components/instincts/InstinctsView.tsx')
reset()
const props = { instincts: [], onApproveInstinct() {}, onRejectInstinct() {}, async onAddInstinct() { throw new Error('save failed') } }
render(InstinctsView, props)
states[1] = true; states[2] = 'trigger'; states[3] = 'action'
let tree = render(InstinctsView, props)
await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
tree = render(InstinctsView, props)
if (!nodes(tree, node => node.type === 'form').length || states[2] !== 'trigger' || states[3] !== 'action' || !nodes(tree, node => node.props.role === 'alert').some(node => node.props.children === 'save failed')) throw new Error('Instinct form lost failed draft')
props.onAddInstinct = async () => {}
tree = render(InstinctsView, props)
await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
if (states[1] || states[2] || states[3]) throw new Error('Successful instinct did not close/reset')
const { MemoryView } = await import(process.cwd() + '/src/dashboard/app/src/components/memory/MemoryView.tsx')
reset()
const memoryProps = { memories: [], async onResolveConflict() { throw new Error('resolve failed') } }
render(MemoryView, memoryProps)
states[1] = { id: 'conflict', topicKey: 'key' }; states[2] = 'resolution'
tree = render(MemoryView, memoryProps)
await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
tree = render(MemoryView, memoryProps)
if (!nodes(tree, node => node.type === 'form').length || states[2] !== 'resolution' || !nodes(tree, node => node.props.role === 'alert').some(node => node.props.children === 'resolve failed')) throw new Error('Memory form lost failed resolution')
const { validRoutingRule } = await import(process.cwd() + '/src/dashboard/app/src/components/settings/OrchestSettingsView.tsx')
if (!validRoutingRule({ match: { output: ['*.ts'] }, agent: 'codex', model: '' }, 'codex')) throw new Error('Executor model rule rejected')
if (validRoutingRule({ match: { output: ['*.ts'] }, agent: 'claude', model: '' }, 'codex')) throw new Error('Non-executor empty model accepted')
if (validRoutingRule({ match: {}, agent: 'codex', model: '' }, 'codex')) throw new Error('Empty match accepted')
const { PlanBoardView } = await import(process.cwd() + '/src/dashboard/app/src/components/plan/PlanBoardView.tsx')
reset()
const tasks = [{ id: 'failed-task', status: 'failed', description: 'failed task', output: [], input: [], depends_on: [], acceptance_criteria: [], retryCount: 1 }, { id: 'next-task', status: 'pending', description: 'next', output: [], input: [], depends_on: [], acceptance_criteria: [], retryCount: 0 }]
let explained = []
const planProps = { tasks, projectId: 'fixture', onRunTask() {}, async onExplainTask(id) { explained.push(id); return { task: id } } }
tree = render(PlanBoardView, planProps)
if (!nodes(tree, node => node.props.children === 'failed-task').length) throw new Error('Failed task invisible')
const plans = nodes(tree, node => node.props.title === 'Explain dry-run execution plan')
await plans[0].props.onClick()
tree = render(PlanBoardView, planProps)
await nodes(tree, node => node.props.title === 'Explain dry-run execution plan')[1].props.onClick()
if (explained.length !== 2 || states[7]?.task !== explained[1]) throw new Error('Kanban plan did not load current task')
console.log('ConfirmDialog Cancel/Enter: PASS\nInstinct form reject/success: PASS\nMemory form reject: PASS\nExecutor model validation: PASS\nFailed column + per-task plan load: PASS')
`,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  const [code, out, err] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  expect(code, err).toBe(0)
  expect(out).toContain('Failed column + per-task plan load: PASS')
  console.log(out)
}, 30_000)
