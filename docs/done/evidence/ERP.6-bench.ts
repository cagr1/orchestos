// ERP.6 — mismo pedido directo al CLI y por el chat de OrchestOS. Uso: bun bench.ts <port> <reps>
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO = '/Users/carlosgallardo/Projects/projects/orchestos'
const PROJECT = '73903c93c6bd19e0'
const PORT = process.argv[2] ?? '4343'
const REPS = Number(process.argv[3] ?? 3)
const PROMPTS = {
  trivial: 'Responde solo: ok',
  tools:
    'Usa tus herramientas para encontrar dónde se define la función contextWindowFor en este repo y dime en una línea el archivo y qué devuelve.',
}
const CLAUDE_MODEL = 'claude-sonnet-5',
  CODEX_MODEL = 'gpt-6-luna',
  EFFORT = 'medium'
const H = { 'x-orchestos-project-id': PROJECT, 'Content-Type': 'application/json' }
const lines = (p: string) =>
  readFileSync(p, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)]
      } catch {
        return []
      }
    })
function findFile(dir: string, pred: (n: string) => boolean): string | null {
  if (!existsSync(dir)) return null
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) {
      const r = findFile(f, pred)
      if (r) return r
    } else if (pred(e.name)) return f
  }
  return null
}
function claudeCalls(evts: any[]) {
  const seen = new Map<string, number>()
  for (const e of evts)
    if (e.type === 'assistant' && e.message?.usage && e.parent_tool_use_id == null) {
      const u = e.message.usage
      seen.set(
        e.message.id,
        u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
      )
    }
  return [...seen.values()]
}
function codexCalls(rollout: string) {
  return lines(rollout)
    .filter((e) => e.payload?.type === 'token_count' && e.payload.info)
    .map((e) => ({
      prompt: e.payload.info.last_token_usage.input_tokens,
      total: e.payload.info.total_token_usage,
    }))
}
async function directClaude(prompt: string) {
  const t = Date.now()
  const p = Bun.spawnSync(
    [
      'claude',
      '-p',
      prompt,
      '--model',
      CLAUDE_MODEL,
      '--effort',
      EFFORT,
      '--output-format',
      'stream-json',
      '--verbose',
    ],
    { cwd: REPO, env: process.env },
  )
  const ms = Date.now() - t
  const evts = p.stdout
    .toString()
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)]
      } catch {
        return []
      }
    })
  const r = evts.find((e) => e.type === 'result')
  const calls = claudeCalls(evts)
  const u = r?.usage ?? {}
  return {
    ms,
    calls: calls.length,
    firstPrompt: calls[0],
    lastPrompt: calls.at(-1),
    totalIn:
      (u.input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0) +
      (u.cache_creation_input_tokens ?? 0),
    out: u.output_tokens,
    usd: r?.total_cost_usd,
    text: String(r?.result ?? '').slice(0, 160),
  }
}
async function directCodex(prompt: string) {
  const t = Date.now()
  const p = Bun.spawnSync(
    [
      'codex',
      'exec',
      '--json',
      '-m',
      CODEX_MODEL,
      '-c',
      `model_reasoning_effort=${EFFORT}`,
      '--sandbox',
      'read-only',
      prompt,
    ],
    { cwd: REPO, env: process.env },
  )
  const ms = Date.now() - t
  const evts = p.stdout
    .toString()
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)]
      } catch {
        return []
      }
    })
  const thread = evts.find((e) => e.type === 'thread.started')?.thread_id
  const msg =
    evts.filter((e) => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item
      ?.text ?? ''
  const rollout = findFile(
    join(process.env.CODEX_HOME ?? join(process.env.HOME!, '.codex'), 'sessions'),
    (n) => n.endsWith(`${thread}.jsonl`),
  )
  const calls = rollout ? codexCalls(rollout) : []
  const tot = calls.at(-1)?.total ?? {}
  return {
    ms,
    calls: calls.length,
    firstPrompt: calls[0]?.prompt,
    lastPrompt: calls.at(-1)?.prompt,
    totalIn: tot.input_tokens,
    out: tot.output_tokens,
    text: msg.slice(0, 160),
  }
}
async function viaChat(agent: 'claude' | 'codex', prompt: string) {
  const model = agent === 'claude' ? CLAUDE_MODEL : CODEX_MODEL
  const s = (
    await (
      await fetch(`http://localhost:${PORT}/api/chat/sessions`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify({ agent, mode: 'code' }),
      })
    ).json()
  ).id
  const t = Date.now()
  const res: any = await (
    await fetch(`http://localhost:${PORT}/api/chat`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        sessionId: s,
        history: [],
        message: prompt,
        requestKey: crypto.randomUUID(),
        agent,
        model,
        effort: EFFORT,
      }),
    })
  ).json()
  const ms = Date.now() - t
  const db = new (await import('bun:sqlite')).Database(
    join(process.env.HOME!, '.orchestos/db.sqlite'),
    { readonly: true },
  )
  const run: any = db
    .query(
      'SELECT r.* FROM chat_turns t JOIN runs r ON r.id = t.run_id WHERE t.session_id = ? ORDER BY t.created_at DESC LIMIT 1',
    )
    .get(s)
  db.close()
  let calls: number[] = []
  if (agent === 'claude') {
    const f = findFile(
      join(process.env.HOME!, '.claude/projects'),
      (n) => n === `${run?.cli_session_id}.jsonl`,
    )
    if (f) calls = claudeCalls(lines(f))
  } else {
    const f = findFile(join(REPO, '.orchestos/agent-home/codex/sessions'), (n) =>
      n.endsWith(`${run?.cli_session_id}.jsonl`),
    )
    if (f) calls = codexCalls(f).map((c) => c.prompt)
  }
  await fetch(`http://localhost:${PORT}/api/chat/sessions/${s}`, { method: 'DELETE', headers: H })
  return {
    ms,
    calls: calls.length,
    firstPrompt: calls[0],
    lastPrompt: calls.at(-1),
    totalIn: run ? run.input_tokens + run.cache_read_tokens + run.cache_write_tokens : null,
    out: run?.output_tokens,
    usd: run?.usd_cost,
    contextTokens: run?.context_tokens,
    text: String(res.text ?? res.error ?? '').slice(0, 160),
  }
}
const out: any[] = []
for (const [name, prompt] of Object.entries(PROMPTS))
  for (let i = 0; i < REPS; i++) {
    for (const [mode, fn] of [
      ['direct-claude', () => directClaude(prompt)],
      ['orchestos-claude', () => viaChat('claude', prompt)],
      ['direct-codex', () => directCodex(prompt)],
      ['orchestos-codex', () => viaChat('codex', prompt)],
    ] as const) {
      const r = await fn()
      const row = { prompt: name, rep: i + 1, mode, ...r }
      out.push(row)
      console.log(JSON.stringify(row))
    }
  }
await Bun.write('/tmp/erp6/results.json', JSON.stringify(out, null, 2))
