import { expect, test } from 'bun:test'

test('AUD.24 running thread renders Stop and polls the timeline without a local send', async () => {
  // Isolate the effect harness: module mocks must never affect other component tests.
  const child = Bun.spawn(
    [
      process.execPath,
      '-e',
      `
    const { mock } = await import('bun:test')
    const react = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    let effects = [], stateIndex = 0
    const states = []
    mock.module('react', () => ({ ...react,
      useEffect: effect => { effects.push(effect) },
      useState: initial => {
        const index = stateIndex++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
      },
    }))
    const { OrchestChatView } = await import('./src/dashboard/app/src/components/chat/OrchestChatView.tsx')
    const { AgentComposer, ComposerSubmitButton } = await import('./src/dashboard/app/src/components/common/AgentComposer.tsx')
    globalThis.window = { addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {} }
    const requests = []
    let pending = true
    globalThis.fetch = async path => {
      requests.push(String(path))
      return Response.json(String(path).includes('/timeline')
        ? { pending, turns: [{ id: 'turn', status: pending ? 'pending' : 'completed', steps: [] }], messages: [] } : {})
    }
    let tree, settled = 0
    function Capture() {
      tree = OrchestChatView({ thread: { id: 'resumed', agent: 'codex', title: 'Recovered', messages: [], running: true }, onSendMessage() {}, onTurnSettled() { settled++ } })
      return null
    }
    function render() {
      stateIndex = 0
      effects = []
      renderToStaticMarkup(react.createElement(Capture))
    }
    render()
    const cleanups = effects.map(effect => effect())
    await new Promise(resolve => setImmediate(resolve))
    render()
    let composer
    function visit(node) {
      react.Children.forEach(node, child => {
        if (!react.isValidElement(child)) return
        if (child.type === AgentComposer) composer = child
        else visit(child.props.children)
      })
    }
    visit(tree)
    const html = renderToStaticMarkup(react.createElement(ComposerSubmitButton, { busy: composer.props.busy, onStop: composer.props.onStop, stopping: false, hasDraft: false, sendDisabled: true, onSend() {} }))
    pending = false
    const finalCleanups = effects.map(effect => effect())
    await new Promise(resolve => setImmediate(resolve))
    for (const cleanup of [...cleanups, ...finalCleanups]) if (typeof cleanup === 'function') cleanup()
    console.log(JSON.stringify({ busy: composer.props.busy, html, requests, settled }))
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
  const result = JSON.parse(out)
  expect(result.busy).toBe(true)
  expect(result.html).toContain('aria-label="Stop response"')
  expect(result.requests.some((path: string) => path.includes('/resumed/timeline'))).toBe(true)
  expect(result.settled).toBe(1)
}, 30_000)
