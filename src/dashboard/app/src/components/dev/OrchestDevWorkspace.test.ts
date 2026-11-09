import { expect, test } from 'bun:test'
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sendMessage } from '../../api/chat'
import type { AgentItem, ChatAttachment, ProjectItem } from '../../types/orchestos'
import { AgentComposer, type AgentComposerProps } from '../common/AgentComposer'
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
