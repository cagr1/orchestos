import type { ChatAttachment, ChatMessage, ChatThread, ToolExecution } from '../types/orchestos';

export interface ChatSessionRow {
  id: string;
  projectId: string | null;
  agent: string;
  mode: 'chat' | 'code';
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  readBoundaryWarning?: string;
}

export interface ChatMessageRow {
  id: number;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  taskId: string | null;
  ocrUsed: string[];
  taskHeld: boolean;
  existingFiles: string[];
  createdAt: string;
}

export interface ChatModelOption {
  id: string;
  name: string;
  contextK: number;
  priceIn: number;
  supportsReasoning: boolean;
}

export const DEFAULT_CHAT_MODEL = 'deepseek/deepseek-v4-flash';

export interface ChatSendOptions {
  sessionId: string;
  message: string;
  agent?: string;
  model?: string;
  effort?: string;
  attachments?: ChatAttachment[];
}

export interface ChatSendResponse {
  text: string;
  model?: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; status: ToolExecution['status'] }>;
  autoTask?: { id: string; held?: boolean; existingFiles?: string[] } | null;
  readBoundaryWarning?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return body as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function toTimestamp(value: string): string {
  return new Date(value).toLocaleString([], { hour: '2-digit', minute: '2-digit' });
}

export function mapMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: String(row.id),
    role: row.role,
    content: row.content,
    timestamp: toTimestamp(row.createdAt),
    model: row.model ?? undefined,
    taskHeld: row.taskHeld || undefined,
    heldTask: row.taskHeld && row.taskId
      ? {
          taskId: row.taskId,
          taskDescription: row.content,
          actionRequired: 'Review the proposed task before execution.',
          estimatedImpact: row.existingFiles.length ? row.existingFiles.join(', ') : undefined,
        }
      : undefined,
  };
}

export function mapSessionToThread(session: ChatSessionRow, messages: ChatMessageRow[] = []): ChatThread {
  return {
    id: session.id,
    title: session.title,
    agent: session.agent,
    mode: session.mode === 'code' ? 'coder' : 'orchestrator',
    status: 'active',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    tokenCount: 0,
    costUsd: 0,
    messages: messages.map(mapMessage),
  };
}

export async function listSessions(project: string | null = 'none'): Promise<ChatThread[]> {
  const query = project === null ? '' : `?project=${encodeURIComponent(project)}`;
  const sessions = await request<ChatSessionRow[]>(`/api/chat/sessions${query}`);
  return sessions.map((session) => mapSessionToThread(session));
}

export async function listArchivedSessions(project?: string): Promise<ChatSessionRow[]> {
  const query = project ? `&project=${encodeURIComponent(project)}` : '';
  return request<ChatSessionRow[]>(`/api/chat/sessions?archived=1${query}`);
}

export async function archiveSession(sessionId: string): Promise<void> {
  await request(`/api/chat/sessions/${encodeURIComponent(sessionId)}/archive`, { method: 'POST' });
}

export async function restoreSession(sessionId: string): Promise<void> {
  await request(`/api/chat/sessions/${encodeURIComponent(sessionId)}/restore`, { method: 'POST' });
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessageRow[]> {
  return request<ChatMessageRow[]>(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`);
}

export async function loadThread(session: ChatSessionRow): Promise<ChatThread> {
  return mapSessionToThread(session, await getSessionMessages(session.id));
}

export async function createSession(params: {
  agent: string;
  projectId?: string | null;
  title?: string;
}): Promise<ChatThread> {
  const session = await request<ChatSessionRow>('/api/chat/sessions', jsonInit('POST', {
    agent: params.agent,
    projectId: params.projectId ?? null,
    mode: 'chat',
    title: params.title,
  }));
  return mapSessionToThread(session);
}

export async function renameSession(sessionId: string, title: string): Promise<ChatSessionRow> {
  return request<ChatSessionRow>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, jsonInit('PATCH', { title }));
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request<{ ok: true }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export async function getChatModels(): Promise<ChatModelOption[]> {
  return request<ChatModelOption[]>('/api/chat/models');
}

export async function uploadChatFile(file: File): Promise<ChatAttachment> {
  const body = new FormData();
  body.append('file', file);
  const uploaded = await request<{ fileId: string; filename: string; type: 'image' | 'text' }>('/api/chat/upload', {
    method: 'POST',
    body,
  });
  return {
    id: uploaded.fileId,
    name: uploaded.filename,
    size: `${(file.size / 1024).toFixed(1)} KB`,
    type: uploaded.type === 'image' ? 'image' : file.name.endsWith('.pdf') ? 'pdf' : 'file',
  };
}

export async function sendMessage(options: ChatSendOptions): Promise<ChatSendResponse> {
  const body: Record<string, unknown> = {
    sessionId: options.sessionId,
    history: [],
    message: options.message,
    requestKey: crypto.randomUUID(),
  };
  const agent = options.agent || 'api';
  if ((agent === 'api' || agent === 'claude') && options.model) body.model = options.model;
  if (options.attachments?.length) body.fileIds = options.attachments.map((attachment) => attachment.id);
  if (options.effort && (agent === 'api' || agent === 'claude')) body.effort = options.effort.toLowerCase();
  return request<ChatSendResponse>('/api/chat', jsonInit('POST', body));
}
