import { Worker } from 'node:worker_threads'
import type { CliTranscriptUsage } from './cli-transcripts-reader.ts'

type Pending = {
  resolve: (rows: CliTranscriptUsage[]) => void
  reject: (error: Error) => void
}

let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, Pending>()

function transcriptWorker(): Worker {
  if (worker) return worker
  const current = new Worker(new URL('./cli-transcripts-worker.ts', import.meta.url))
  worker = current
  const fail = (error: Error) => {
    if (worker !== current) return
    worker = undefined
    for (const request of pending.values()) request.reject(error)
    pending.clear()
    void current.terminate()
  }
  current.on('error', fail)
  current.on('exit', (code) => fail(new Error(`Transcript worker exited (${code})`)))
  current.on('message', (message: { id: number; rows?: CliTranscriptUsage[]; error?: string }) => {
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (message.error !== undefined) request.reject(new Error(message.error))
    else request.resolve(message.rows ?? [])
    if (!pending.size) current.unref()
  })
  current.unref()
  return current
}

/** Keep discovery, parsing and its in-memory file cache off the server's event loop. */
export function readCliTranscriptUsage(
  projectRoots: string[],
  agentHome?: string,
): Promise<CliTranscriptUsage[]> {
  return new Promise((resolve, reject) => {
    const current = transcriptWorker()
    const id = nextId++
    pending.set(id, { resolve, reject })
    current.ref()
    current.postMessage({ id, projectRoots, agentHome })
  })
}
