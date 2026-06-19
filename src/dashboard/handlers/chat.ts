import { resolve } from 'path'
import { chat as openrouterChat } from '../../providers/openrouter.ts'
import { loadContext } from '../../context/load.ts'
import { db } from '../../db/sqlite.ts'
import { listRuns } from '../../db/runs.ts'
import { loadTasks } from '../../tasks/loader.ts'
import { listSpecs } from '../../spec/store.ts'
import type { MemoryEntry } from '../../db/memory.ts'
import type { ChatUploadResponse, ChatFileType } from '../types.ts'
import { ollamaChat } from '../llm/clients.ts'
import { readEnv } from '../settings-store.ts'
import { jsonResponse, errorResponse } from '../http.ts'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const FILE_TTL_MS    = 30 * 60 * 1000

interface FileEntry {
  type: ChatFileType
  mimeType: string
  filename: string
  content: string
  preview: string
  expiresAt: number
}

const fileStore = new Map<string, FileEntry>()

function pruneExpiredFiles(): void {
  const now = Date.now()
  for (const [id, entry] of fileStore) {
    if (entry.expiresAt < now) fileStore.delete(id)
  }
}

function randomId(): string {
  return crypto.randomUUID()
}

function extractPdfText(buf: Buffer): string {
  const raw = buf.toString('latin1')
  const parts: string[] = []

  for (const m of raw.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g)) {
    const raw1 = m[1] ?? ''
    const s = raw1.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\\/g, '\\').replace(/\\([()])/g, '$1')
    if (s.trim()) parts.push(s)
  }

  for (const m of raw.matchAll(/\[([^\]]+)\]\s*TJ/g)) {
    for (const sm of (m[1] ?? '').matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g)) {
      const raw1 = sm[1] ?? ''
      const s = raw1.replace(/\\n/g, '\n').replace(/\\\\/g, '\\').replace(/\\([()])/g, '$1')
      if (s.trim()) parts.push(s)
    }
  }

  const text = parts.join(' ').replace(/\s{2,}/g, ' ').trim()
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, '').trim()
}

async function handleApiChatUpload(req: Request): Promise<Response> {
  pruneExpiredFiles()

  let formData: any
  try { formData = await req.formData() } catch { return errorResponse('Expected multipart/form-data', 400) }

  const file = formData.get('file') as File | null
  if (!file) return errorResponse('No file in form data', 400)
  if (file.size > MAX_FILE_BYTES) return errorResponse('File exceeds 10 MB limit', 413)

  const filename = file.name || 'upload'
  const mime = file.type || ''
  const buf = Buffer.from(await file.arrayBuffer())

  let type: ChatFileType
  let content: string
  let preview: string

  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(filename)) {
    type = 'image'
    content = `data:${mime || 'image/png'};base64,${buf.toString('base64')}`
    preview = mime || 'image'
  } else if (mime === 'application/pdf' || /\.pdf$/i.test(filename)) {
    type = 'text'
    const extracted = extractPdfText(buf)
    content = extracted.slice(0, 50_000)
    preview = content.slice(0, 200)
  } else {
    type = 'text'
    content = buf.toString('utf-8').slice(0, 50_000)
    preview = content.slice(0, 200)
  }

  const fileId = randomId()
  fileStore.set(fileId, { type, mimeType: mime, filename, content, preview, expiresAt: Date.now() + FILE_TTL_MS })

  const resp: ChatUploadResponse = { fileId, type, preview, filename }
  return jsonResponse(resp)
}

async function handleApiChatModels(): Promise<Response> {
  const apiKey = (() => {
    try { return readEnv()['OPENROUTER_API_KEY'] || process.env.OPENROUTER_API_KEY || '' } catch { return '' }
  })()
  if (!apiKey) return errorResponse('OPENROUTER_API_KEY not set', 400)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) return errorResponse(`OpenRouter error ${res.status}`, 502)
    const data = await res.json() as { data: { id: string; name: string; context_length: number; pricing: { prompt: string } }[] }
    const models = (data.data || [])
      .filter(m => m.pricing?.prompt !== undefined)
      .sort((a, b) => Number(a.pricing.prompt) - Number(b.pricing.prompt))
      .map(m => ({
        id: m.id,
        name: m.name,
        contextK: Math.round((m.context_length || 0) / 1000),
        priceIn: Number(m.pricing.prompt) * 1_000_000,
      }))
    return jsonResponse(models)
  } catch (e: any) {
    return errorResponse(`Failed to fetch models: ${e.message}`, 502)
  }
}

async function handleApiChat(req: Request): Promise<Response> {
  let body: { history: { role: string; content: string }[]; message: string; fileId?: string }
  try { body = (await req.json()) as { history: { role: string; content: string }[]; message: string; fileId?: string } } catch { return errorResponse('Invalid JSON', 400) }
  const message = body.message?.trim()
  if (!message) return errorResponse('message is required', 400)

  const history = Array.isArray(body.history) ? body.history.slice(-10) : []

  let attachedFile: FileEntry | null = null
  if (body.fileId) {
    pruneExpiredFiles()
    attachedFile = fileStore.get(body.fileId) ?? null
  }

  const root = resolve('.')
  const lines: string[] = []

  try {
    const file = loadTasks(root)
    const counts: Record<string, number> = { pending: 0, running: 0, done: 0, failed: 0 }
    for (const task of file.tasks as any[]) {
      const k = task.status === 'failed_permanent' ? 'failed' : task.status
      if (k in counts) { counts[k as string] = (counts[k as string] ?? 0) + 1 }
    }
    lines.push(`Tasks (${file.tasks.length} total — ${counts.pending} pending, ${counts.running} running, ${counts.done} done, ${counts.failed} failed):`)
    for (const task of file.tasks as any[]) {
      const qa = task.qa_verdict ? ` [qa:${task.qa_verdict}]` : ''
      const retries = task.retry_count > 0 ? ` [retries:${task.retry_count}]` : ''
      lines.push(`  - ${task.id} [${task.status}]${qa}${retries}: ${task.description}`)
    }
  } catch {}

  try {
    const recentRuns = listRuns(10)
    if (recentRuns.length > 0) {
      const totalCost = recentRuns.reduce((s, r) => s + Number(r.usd_cost), 0)
      lines.push(`\nRecent runs (last ${recentRuns.length}, total cost $${totalCost.toFixed(4)}):`)
      for (const r of recentRuns) {
        const qa = r.qa_verdict ? ` qa:${r.qa_verdict}` : ''
        lines.push(`  - ${r.task_id || r.id} | ${r.status}${qa} | ${r.model} | $${Number(r.usd_cost).toFixed(4)} | ${(r.created_at || '').slice(0, 16)}`)
      }
    }
  } catch {}

  try {
    const memRows = db.query<MemoryEntry, []>(
      'SELECT topic_key, scope, content FROM memory_entries ORDER BY updated_at DESC LIMIT 20'
    ).all()
    if (memRows.length > 0) {
      lines.push(`\nMemory (${memRows.length} entries):`)
      for (const m of memRows) {
        lines.push(`  - [${m.scope}] ${m.topic_key}: ${m.content.slice(0, 120)}`)
      }
    }
  } catch {}

  try {
    const specs = listSpecs(root, true)
    if (specs.length > 0) {
      lines.push(`\nSpecs (${specs.length}):`)
      for (const s of specs) {
        lines.push(`  - ${s.frontmatter.id} [${s.frontmatter.status}]`)
      }
    }
  } catch {}

  const projectCtx = loadContext(root)

  const ctx = lines.length ? `\nProject state:\n${lines.join('\n')}\n` : ''
  const projBlock = projectCtx ? `\nProject context:\n${projectCtx}\n` : ''
  const model = (body as any).model?.trim() || 'deepseek/deepseek-v4-flash'
  const isOllama = /^ollama\//.test(model)
  const modelLabel = isOllama
    ? `${model.replace('ollama/', '')} vía Ollama (local) — modelo local, los resultados pueden variar`
    : `${model} via OpenRouter`

  const systemPrompt = `You are the assistant of OrchestOS, an AI agent orchestrator. Answer questions about the project state, tasks, runs, memory, specs, and the system. Be concise and direct. If the user writes in Spanish, respond in Spanish.

You are running as model: ${modelLabel}.

Important: you cannot modify files or run code directly from this chat. However, OrchestOS CAN improve itself — the user can create a Task describing the improvement, and the agent executor will modify the codebase autonomously. That is the correct way to self-improve: Tasks → agent runs → code changes.${ctx}${projBlock}`

  const messages: { role: 'user' | 'assistant'; content: any }[] = history
    .filter(h => h.role === 'user' || h.role === 'assistant')
    .map(h => ({ role: h.role as 'user' | 'assistant', content: String(h.content) }))

  if (attachedFile) {
    if (attachedFile.type === 'image') {
      messages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: attachedFile.content } },
          { type: 'text', text: message },
        ],
      })
    } else {
      const label = attachedFile.filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'File'
      const textBlock = `[${label}: ${attachedFile.filename}]\n${attachedFile.content}\n[End of ${label}]\n\n`
      messages.push({ role: 'user', content: textBlock + message })
    }
  } else {
    messages.push({ role: 'user', content: message })
  }

  try {
    if (isOllama) {
      const bareModel = model.replace('ollama/', '')
      const resp = await ollamaChat({ model: bareModel, system: systemPrompt, messages })
      return jsonResponse({ text: resp.text, model: resp.model })
    }
    const resp = await openrouterChat({
      model,
      system: systemPrompt,
      messages,
    })
    return jsonResponse({ text: resp.text, model: resp.model })
  } catch (e: any) {
    return errorResponse(`Chat failed: ${e.message}`, 502)
  }
}

export { handleApiChatUpload, handleApiChatModels, handleApiChat }
