import { expect, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  changedChatDocuments,
  chatDirectory,
  documentsFromEnvelope,
  snapshotChatDocuments,
} from '../../chat/documents.ts'
import { orchestosDir } from '../../config/orchestos-home.ts'
import { createChatSession } from '../../db/chat-sessions.ts'
import {
  handleApiChatDocument,
  handleApiChatSessionArchive,
  handleApiChatSessionDelete,
} from '../handlers/chat-sessions.ts'

test('USO.11 detects new/modified nested documents by content and ignores symlinks/deletions', () => {
  const session = createChatSession({ agent: 'codex' })
  const root = chatDirectory(session.id, true)
  try {
    writeFileSync(join(root, 'same.txt'), 'same')
    writeFileSync(join(root, 'changed.txt'), 'old')
    writeFileSync(join(root, 'deleted.txt'), 'gone')
    const before = snapshotChatDocuments(root)
    writeFileSync(join(root, 'same.txt'), 'same')
    rmSync(join(root, 'deleted.txt'))
    writeFileSync(join(root, 'changed.txt'), 'new')
    mkdirSync(join(root, 'nested'))
    writeFileSync(join(root, 'nested', 'report.md'), '# report')
    symlinkSync(join(root, 'same.txt'), join(root, 'link.txt'))
    expect(changedChatDocuments(root, before)).toEqual([
      { name: 'changed.txt', path: 'changed.txt', size: 3 },
      { name: 'report.md', path: 'nested/report.md', size: 8 },
    ])
    expect(chatDirectory(session.id)).toBe(root)
    const envelope = JSON.stringify({ text: 'done', documents: changedChatDocuments(root, before) })
    expect(documentsFromEnvelope(envelope)).toHaveLength(2)
    expect(documentsFromEnvelope('{broken')).toBeUndefined()
    expect(documentsFromEnvelope('{"documents":[{"path":"a"}]}')).toBeUndefined()
  } finally {
    handleApiChatSessionDelete(new URL(`http://localhost/api/chat/sessions/${session.id}`))
  }
})

test('USO.11 an unreadable document does not block the snapshot', () => {
  const session = createChatSession({ agent: 'codex' })
  const root = chatDirectory(session.id, true)
  const locked = join(root, 'locked.txt')
  try {
    writeFileSync(locked, 'secret')
    chmodSync(locked, 0o000)
    const snapshot = snapshotChatDocuments(root)
    expect(snapshot.get('locked.txt')).toStartWith('stat:6:')
  } finally {
    chmodSync(locked, 0o600)
    handleApiChatSessionDelete(new URL(`http://localhost/api/chat/sessions/${session.id}`))
  }
})

test('USO.11 document endpoint confines paths/realpaths; archive preserves files and delete removes them', async () => {
  const session = createChatSession({ agent: 'claude' })
  const project = createChatSession({ agent: 'claude', projectId: null })
  const root = chatDirectory(session.id, true)
  const otherRoot = chatDirectory(project.id, true)
  writeFileSync(join(root, 'report.html'), '<script>alert(1)</script>')
  writeFileSync(join(otherRoot, 'secret.txt'), 'private')
  symlinkSync(otherRoot, join(root, 'escape'))
  symlinkSync(join(otherRoot, 'secret.txt'), join(root, 'escape.txt'))
  const url = (path: string) =>
    new URL(
      `http://localhost/api/chat/sessions/${session.id}/files?path=${encodeURIComponent(path)}`,
    )
  try {
    const response = handleApiChatDocument(url('report.html'))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(readFileSync(join(root, 'report.html'), 'utf8'))
    expect(response.headers.get('Content-Disposition')).toStartWith('attachment;')
    expect(response.headers.get('Content-Security-Policy')).toContain('sandbox')
    for (const path of [
      '',
      '../secret.txt',
      `../${project.id}/secret.txt`,
      join(otherRoot, 'secret.txt'),
      'escape/secret.txt',
      'escape.txt',
      'missing',
    ])
      expect(handleApiChatDocument(url(path)).status, path).toBe(404)
    expect(
      handleApiChatSessionArchive(
        new URL(`http://localhost/api/chat/sessions/${session.id}/archive`),
      ).status,
    ).toBe(200)
    expect(handleApiChatDocument(url('report.html')).status).toBe(200)
    expect(
      handleApiChatSessionDelete(new URL(`http://localhost/api/chat/sessions/${session.id}`))
        .status,
    ).toBe(200)
    expect(existsSync(root)).toBe(false)
    expect(existsSync(join(otherRoot, 'secret.txt'))).toBe(true)
    expect(handleApiChatDocument(url('report.html')).status).toBe(404)
  } finally {
    handleApiChatSessionDelete(new URL(`http://localhost/api/chat/sessions/${session.id}`))
    handleApiChatSessionDelete(new URL(`http://localhost/api/chat/sessions/${project.id}`))
  }
})

test('USO.11 refuses a symlinked chat root and invalid session paths', () => {
  const session = createChatSession({ agent: 'claude' })
  const other = createChatSession({ agent: 'claude' })
  const root = chatDirectory(other.id, true)
  symlinkSync(root, join(orchestosDir(), 'chats', session.id))
  try {
    expect(() => chatDirectory(session.id)).toThrow('Invalid chat directory')
    expect(() => chatDirectory('../escape', true)).toThrow('Invalid session id')
  } finally {
    handleApiChatSessionDelete(new URL(`http://localhost/api/chat/sessions/${session.id}`))
    handleApiChatSessionDelete(new URL(`http://localhost/api/chat/sessions/${other.id}`))
  }
})
