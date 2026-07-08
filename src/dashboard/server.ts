import { serveStatic, errorResponse, isSameOrigin } from './http.ts'
import { handleApiMemory, handleApiMemoryConflicts } from './handlers/memory.ts'
import { handleApiRuns, handleApiRunsAnalyze } from './handlers/runs.ts'
import { handleApiInstincts, handleApiInstinctsApprove, handleApiInstinctsReject, handleApiInstinctsCreate, handleApiInstinctsPropose, handleApiInstinctsSetConfidence } from './handlers/instincts.ts'
import { handleApiSpecsDraft, handleApiSpecs, handleApiSpecsCreate, handleApiSpecsApprove, handleApiSpecsLint, handleApiSpecsArchive } from './handlers/specs.ts'
import { handleApiTasks, handleApiTasksCreate, handleApiTasksRun, handleApiTasksDelete, handleApiTasksDiagnose, handleApiTasksExplain } from './handlers/tasks.ts'
import { handleApiRunGraph, handleApiRunGraphStatus } from './handlers/run-graph.ts'
import { handleApiProjectConstitutionGet, handleApiProjectConstitutionPut, handleApiProjectContextGet, handleApiProjectContextRegenerate, handleApiProjectDetect, handleApiProjectIndex, handleApiNatural } from './handlers/project.ts'
import { handleApiSettingsGet, handleApiSetup, handleApiSettingsPost, handleApiHealth, handleApiSetupApiKey, handleApiProvidersLocal } from './handlers/setup.ts'
import { handleApiChatUpload, handleApiChatModels, handleApiChat, handleApiChatTaskBarClick, handleApiChatTaskBarEvents } from './handlers/chat.ts'
import { handleApiSkillsList, handleApiSkillsGet, handleApiSkillsExport, handleApiSkillsCreate, handleApiSkillsUpdate, handleApiSkillsDelete, handleApiSkillsBuild, handleApiSkillsProList, handleApiSkillsProImport, handleApiSkillsImport, handleApiSkillsCurate, handleApiSkillsRegistryList, handleApiSkillsRegistryImport } from './handlers/skills.ts'
import { handleApiSystemReset, handleApiSystemEnginesExternalAvailability } from './handlers/system.ts'
import { handleApiConfigGet, handleApiConfigInit, handleApiConfigSet } from './handlers/config.ts'
import { handleApiContextSuggest } from './handlers/context-suggest.ts'
import { DEFAULT_PORT } from './types.ts'

export async function route(req: Request, port: number): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method

  if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && !isSameOrigin(req, port)) {
    return errorResponse('Forbidden', 403)
  }

  if (method === 'POST' && url.pathname === '/api/runs/analyze') {
    return handleApiRunsAnalyze(req)
  }
  if (method === 'GET' && (url.pathname === '/api/runs' || url.pathname.startsWith('/api/runs/'))) {
    return handleApiRuns(url)
  }
  if (method === 'GET' && url.pathname === '/api/tasks') {
    return handleApiTasks()
  }
  if (method === 'POST' && url.pathname === '/api/tasks') {
    return handleApiTasksCreate(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/tasks\/[^/]+\/run$/)) {
    return handleApiTasksRun(req, url)
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/tasks\/[^/]+$/)) {
    return handleApiTasksDelete(url)
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/tasks\/[^/]+\/diagnose$/)) {
    return handleApiTasksDiagnose(url)
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/tasks\/[^/]+\/explain$/)) {
    return handleApiTasksExplain(url)
  }
  if (method === 'POST' && url.pathname === '/api/run/graph') {
    return handleApiRunGraph(req)
  }
  if (method === 'GET' && url.pathname === '/api/run/graph/status') {
    return handleApiRunGraphStatus()
  }
  if (method === 'GET' && url.pathname === '/api/instincts') {
    return handleApiInstincts()
  }
  if (method === 'POST' && url.pathname === '/api/instincts') {
    return handleApiInstinctsCreate(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/instincts\/([^/]+)\/approve$/)) {
    return handleApiInstinctsApprove(url)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/instincts\/([^/]+)\/reject$/)) {
    return handleApiInstinctsReject(url)
  }
  if (method === 'POST' && url.pathname === '/api/instincts/propose') {
    return handleApiInstinctsPropose(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/instincts\/([^/]+)\/confidence$/)) {
    return handleApiInstinctsSetConfidence(req, url)
  }

  if (method === 'GET' && url.pathname === '/api/skills') {
    return handleApiSkillsList()
  }
  if (method === 'GET' && url.pathname === '/api/skills/registry') {
    return handleApiSkillsRegistryList()
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/skills\/registry\/([^/]+)\/import$/)) {
    return handleApiSkillsRegistryImport(req, url)
  }
  if (method === 'GET' && url.pathname === '/api/skills/pro') {
    return handleApiSkillsProList()
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsGet(url)
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/skills\/([^/]+)\/export$/)) {
    return handleApiSkillsExport(url)
  }
  if (method === 'POST' && url.pathname === '/api/skills') {
    return handleApiSkillsCreate(req)
  }
  if (method === 'PUT' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsUpdate(req, url)
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsDelete(req, url)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/skills\/([^/]+)\/build$/)) {
    return handleApiSkillsBuild(url)
  }
  if (method === 'POST' && url.pathname === '/api/skills/curate') {
    return handleApiSkillsCurate(req)
  }
  if (method === 'POST' && url.pathname === '/api/skills/import') {
    return handleApiSkillsImport(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/skills\/pro\/([^/]+)\/import$/)) {
    return handleApiSkillsProImport(url)
  }

  if (method === 'GET' && url.pathname === '/api/project/constitution') {
    return handleApiProjectConstitutionGet()
  }
  if (method === 'PUT' && url.pathname === '/api/project/constitution') {
    return handleApiProjectConstitutionPut(req)
  }
  if (method === 'GET' && url.pathname === '/api/project/context') {
    return handleApiProjectContextGet()
  }
  if (method === 'POST' && url.pathname === '/api/project/context/regenerate') {
    return handleApiProjectContextRegenerate()
  }
  if (method === 'POST' && url.pathname === '/api/project/detect') {
    return await handleApiProjectDetect()
  }
  if (method === 'POST' && url.pathname === '/api/project/index') {
    return await handleApiProjectIndex()
  }
  if (method === 'POST' && url.pathname === '/api/natural') {
    return handleApiNatural(req)
  }
  if (method === 'GET' && url.pathname === '/api/chat/models') {
    return handleApiChatModels()
  }
  if (method === 'POST' && url.pathname === '/api/chat/upload') {
    return handleApiChatUpload(req)
  }
  if (method === 'POST' && url.pathname === '/api/chat') {
    return handleApiChat(req)
  }
  if (method === 'POST' && url.pathname === '/api/chat/task-bar-click') {
    return handleApiChatTaskBarClick()
  }
  if (method === 'GET' && url.pathname === '/api/chat/task-bar-events') {
    return handleApiChatTaskBarEvents()
  }
  if (method === 'GET' && url.pathname === '/api/specs') {
    return handleApiSpecs()
  }
  if (method === 'POST' && url.pathname === '/api/specs/draft') {
    return handleApiSpecsDraft(req)
  }
  if (method === 'POST' && /^\/api\/specs\/[^/]+$/.test(url.pathname)) {
    return handleApiSpecsCreate(req)
  }
  if (method === 'POST' && url.pathname.endsWith('/approve')) {
    return handleApiSpecsApprove(req)
  }
  if (method === 'GET' && url.pathname.endsWith('/lint')) {
    return handleApiSpecsLint(req)
  }
  if (method === 'POST' && url.pathname.endsWith('/archive')) {
    return handleApiSpecsArchive(req)
  }
  if (method === 'GET' && url.pathname === '/api/memory/conflicts') {
    return handleApiMemoryConflicts(url)
  }
  if (method === 'GET' && url.pathname === '/api/memory') {
    return handleApiMemory(url)
  }
  if (method === 'GET' && url.pathname === '/api/settings') {
    return await handleApiSettingsGet()
  }
  if (method === 'GET' && url.pathname === '/api/setup') {
    return handleApiSetup()
  }
  if (method === 'GET' && url.pathname === '/api/health') {
    return handleApiHealth()
  }
  if (method === 'GET' && url.pathname === '/api/providers/local') {
    return handleApiProvidersLocal()
  }
  if (method === 'POST' && url.pathname === '/api/setup/api-key') {
    return await handleApiSetupApiKey(req)
  }
  if (method === 'POST' && url.pathname === '/api/settings') {
    return handleApiSettingsPost(req)
  }
  if (method === 'POST' && url.pathname === '/api/system/reset') {
    return handleApiSystemReset(req)
  }
  if (method === 'GET' && url.pathname === '/api/system/engines/external/availability') {
    return handleApiSystemEnginesExternalAvailability()
  }
  if (method === 'GET' && url.pathname === '/api/config') {
    return await handleApiConfigGet()
  }
  if (method === 'POST' && url.pathname === '/api/config/init') {
    return await handleApiConfigInit()
  }
  if (method === 'PUT' && url.pathname === '/api/config') {
    return await handleApiConfigSet(req)
  }
  if (method === 'GET' && url.pathname === '/api/context/suggest') {
    return await handleApiContextSuggest(url)
  }

  if (method === 'GET') {
    return serveStatic(url.pathname)
  }

  return errorResponse('Method not allowed', 405)
}

export function startServer(port = DEFAULT_PORT): { server: any; url: string } {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    // Default idle timeout (10s) is too short for routes that call an LLM with
    // retries (curator, registry import normalization) or fetch external
    // registries before normalizing — those can legitimately take 15-30s.
    // Without this, Bun kills the connection before the response is delivered
    // even though the handler keeps running and completes the work server-side.
    idleTimeout: 60,
    fetch: (req) => route(req, port),
  })
  const url = `http://localhost:${server.port}`
  console.log(`[dashboard] Server running at ${url}`)
  return { server, url }
}

if (import.meta.main) {
  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT))
  startServer(port)
}
