import { parentPort } from 'node:worker_threads'
import { readCliTranscriptUsage } from './cli-transcripts-reader.ts'

// Serialize requests so overlapping polls share the completed per-file cache.
let queue = Promise.resolve()
parentPort?.on('message', (request: { id: number; projectRoots: string[]; agentHome?: string }) => {
  queue = queue.then(async () => {
    try {
      const rows = await readCliTranscriptUsage(request.projectRoots, request.agentHome)
      parentPort?.postMessage({ id: request.id, rows })
    } catch (error) {
      parentPort?.postMessage({
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
})
