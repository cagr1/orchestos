import { expect, test } from 'bun:test'
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sendMessage } from '../../api/chat'
import type {
  AgentItem,
  ChatAttachment,
  ChatMessage,
  ProjectItem,
  TaskItem,
} from '../../types/orchestos'
import { AgentComposer, type AgentComposerProps } from '../common/AgentComposer'
import { TaskCard } from '../thread/TaskCard'
import { OrchestDevWorkspace } from './OrchestDevWorkspace'

type WorkspaceProps = Parameters<typeof OrchestDevWorkspace>[0]

function composerFromWorkspace(props: WorkspaceProps) {
  let tree: ReactNode
  function Capture() {
    // Capture the workspace's real element tree without mounting its polling children.
    tree = OrchestDevWorkspace(props) as ReactElement
    return null
  }
  renderToStaticMarkup(createElement(Capture))
  let found: { element: ReactElement<AgentComposerProps>; ancestors: unknown[] } | undefined
  function visit(node: ReactNode, ancestors: unknown[] = []) {
    Children.forEach(node, (child, index) => {
      if (!isValidElement<{ children?: ReactNode }>(child)) return
      const path = [...ancestors, child.type, child.key ?? index]
      if (child.type === AgentComposer)
        found = { element: child as ReactElement<AgentComposerProps>, ancestors: path }
      else visit(child.props.children, path)
    })
  }
  visit(tree)
  if (!found) throw new Error('Dev composer missing')
  return found
}

const project = { id: 'project-1', name: 'Project', agents: [] } as ProjectItem
const agent = {
  id: 'session-1',
  projectId: project.id,
  agent: 'codex',
  model: 'gpt-6-luna',
} as AgentItem

test('Dev keeps the composer in the same React position while the selected agent hydrates', () => {
  const pending = composerFromWorkspace({ activeProject: project, activeAgent: null })
  const hydrated = composerFromWorkspace({ activeProject: project, activeAgent: agent })
  expect(hydrated.ancestors).toEqual(pending.ancestors)
  expect(pending.element.props.projectId).toBe(project.id)
  expect(hydrated.element.props.projectId).toBe(project.id)
  expect(hydrated.element.props.contextSessionId).toBe(agent.id)
})

test('Dev forwards both uploaded server IDs and approval controls through its send callback', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ path: string; init?: RequestInit }> = []
  globalThis.fetch = (async (path, init) => {
    calls.push({ path: String(path), init })
    return Response.json({ text: 'ok' })
  }) as typeof fetch
  const attachments: ChatAttachment[] = [
    {
      id: 'att_text',
      fileId: 'server-text',
      name: 'token.txt',
      size: '1 KB',
      type: 'file',
      status: 'ready',
    },
    {
      id: 'att_image',
      fileId: 'server-image',
      name: 'word.png',
      size: '1 KB',
      type: 'image',
      status: 'ready',
    },
  ]
  try {
    const { element } = composerFromWorkspace({
      activeProject: project,
      activeAgent: agent,
      onSendMessage: async (content, files, cli, model, effort, approvalMode) => {
        expect(files).toBe(attachments)
        await sendMessage({
          sessionId: agent.id,
          projectId: project.id,
          message: content,
          attachments: files,
          agent: cli,
          model,
          effort,
          approvalMode,
        })
        return true
      },
    })
    expect(
      await element.props.onSendMessage(
        'Read these',
        attachments,
        'codex',
        'gpt-6-luna',
        'medium',
        false,
        'supervised',
      ),
    ).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/api/chat')
    expect(new Headers(calls[0].init?.headers).get('x-orchestos-project-id')).toBe(project.id)
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      sessionId: agent.id,
      message: 'Read these',
      agent: 'codex',
      model: 'gpt-6-luna',
      effort: 'medium',
      approvalMode: 'supervised',
      fileIds: ['server-text', 'server-image'],
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

function cardsFromWorkspace(props: WorkspaceProps) {
  let tree: ReactNode
  function Capture() {
    tree = OrchestDevWorkspace(props) as ReactElement
    return null
  }
  renderToStaticMarkup(createElement(Capture))
  const cards: ReactElement<Parameters<typeof TaskCard>[0]>[] = []
  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode }>(child)) return
      if (child.type === TaskCard) cards.push(child as ReactElement<Parameters<typeof TaskCard>[0]>)
      else visit(child.props.children)
    })
  }
  visit(tree)
  return cards
}

const heldMessage: ChatMessage = {
  id: '10',
  role: 'assistant',
  content: 'Created task',
  timestamp: '12:00',
  taskId: 'task-1',
  taskHeld: true,
  proposedTask: { id: 'task-1', description: 'Update the file', output: ['file.ts'] },
}

test('Dev renders a held task and forwards all task actions in its project', async () => {
  const actions: unknown[][] = []
  const cards = cardsFromWorkspace({
    activeProject: project,
    activeAgent: agent,
    messages: [heldMessage],
    onApproveHeldTask: (id) => {
      actions.push(['approve', id])
    },
    onRejectHeldTask: (id) => {
      actions.push(['reject', id])
    },
    onRetryTask: (id) => {
      actions.push(['retry', id])
    },
    onCommitRunTask: (id, files) => {
      actions.push(['commit', id, files])
    },
    onViewEvidence: (id) => {
      actions.push(['evidence', id])
    },
  })
  expect(cards).toHaveLength(1)
  const { props } = cards[0]
  expect(props.card).toMatchObject({
    taskId: 'task-1',
    state: 'held',
    description: 'Update the file',
  })
  expect(props.projectId).toBe(project.id)
  props.onApprove?.()
  props.onReject?.()
  props.onRetry?.()
  props.onCommit?.(['file.ts'])
  props.onViewEvidence?.('run-1')
  await new Promise<void>((resolve) => queueMicrotask(resolve))
  expect(actions).toEqual([
    ['approve', 'task-1'],
    ['reject', 'task-1'],
    ['retry', 'task-1'],
    ['commit', 'task-1', ['file.ts']],
    ['evidence', 'run-1'],
  ])
})

test('Dev follows running tasks, approvals and the latest report without duplicate cards', () => {
  const report: ChatMessage = {
    ...heldMessage,
    id: '11',
    taskHeld: false,
    proposedTask: undefined,
    taskReport: { outcome: 'failed', runId: 'run-1', dirtyFiles: ['file.ts'] },
  }
  const task = { id: 'task-1', status: 'running', runId: 'run-1', sessionId: agent.id } as TaskItem
  const cards = cardsFromWorkspace({
    activeProject: project,
    activeAgent: agent,
    messages: [heldMessage, report],
    tasks: [task],
    approvals: { 'run-1': [] },
  })
  expect(cards).toHaveLength(1)
  expect(cards[0].props.card.state).toBe('running')
  expect(cards[0].props.activeRunId).toBe('run-1')
  expect(cards[0].props.approvals).toEqual([])
  const finished = cardsFromWorkspace({
    activeProject: project,
    activeAgent: agent,
    messages: [heldMessage, report],
  })
  expect(finished[0].props.card.state).toBe('failed')
  expect(finished[0].props.card.reports).toHaveLength(1)
  expect(
    cardsFromWorkspace({
      activeProject: project,
      activeAgent: agent,
      messages: [{ ...heldMessage, taskDeleted: true }],
    }),
  ).toHaveLength(0)
  expect(cardsFromWorkspace({ activeProject: project, messages: [heldMessage] })).toHaveLength(0)
})
