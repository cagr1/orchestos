/* ============================================================
   OrchestOS — app shell, navigation, panels, API fetching
   ============================================================ */

const state = {
  screen: 'chat',
  memScope: 'all',
  openRun: null,
  openSpec: null,
  openSkill: null,
  openDiagnose: null,
  diagnoseCache: {},
  archOpen: false,

  runs: [],
  tasks: [],
  instincts: [],
  specs: [],
  skills: [],
  proSkills: [],
  registrySkills: [],
  memory: [],
  settings: null,
  setup: null,
  health: null,
  settingsSection: 'general',

  runsStatus: 'loading',
  tasksStatus: 'loading',
  instinctsStatus: 'loading',
  specsStatus: 'loading',
  skillsStatus: 'loading',
  proSkillsStatus: 'loading',
  registrySkillsStatus: 'idle',
  memoryStatus: 'loading',
  settingsStatus: 'idle',
  setupStatus: 'idle',
  healthStatus: 'idle',
  setupRedirectDone: false,
  attentionRedirectDone: false,

  taskFilter: 'all',
  taskSort: { col: null, dir: 'asc' },
  memQuery: '',
  runsFilter: 'all',
  naturalDraft: null,

  // v0.12 Bloque A — selección múltiple por tabla, una entrada por screen que
  // ya tiene borrado individual (runs/tasks/instincts/memory/specs). Un Set
  // vive en memoria del navegador, no persiste entre reloads (mismo criterio
  // que taskFilter/runsFilter — estado de UI transitorio, no dato real).
  bulkSelected: { tasks: new Set(), runs: new Set(), instincts: new Set(), memory: new Set(), specs: new Set() },
  // v0.12 Bloque C — visor de diff por run: qué archivos están expandidos (mostrando
  // el diff completo en vez de colapsado a las primeras líneas). Clave: `${runId}:${path}`.
  diffExpanded: new Set(),
  // v0.13 seed — panel derecho del header redesign (2026-07-13, captura de Carlos):
  // explorer/terminal/diff, un ícono de header por vista + un toggle. Abierto/tab
  // persisten en localStorage (mismo patrón que orchestos-sidebar).
  rightPanelOpen: localStorage.getItem('orchestos-rightpanel') === 'expanded',
  rightPanelTab: localStorage.getItem('orchestos-rightpanel-tab') || 'terminal',
  // Explorer: ruta del archivo abierto en preview (null = mostrando el árbol).
  explorerOpenFile: null,

  projectTab: 'constitution',
  constitutionContent: null,
  contextContent: null,
  constitutionStatus: 'idle',
  contextStatus: 'idle',
  projectSaveState: 'idle',  // 'idle' | 'saving' | 'saved' | 'error'

  chatHistory: [],
  chatPending: false,
  chatModel: 'deepseek/deepseek-v4-flash',
  chatEffort: localStorage.getItem('orchestos-chat-effort') || 'medium', // FRONT.1 — solo aplicado cuando el modelo elegido tiene supportsReasoning:true (BACK.4) · FRONT.2 — persistido en localStorage
  chatFiles: [], // Mes 19 Bloque B — array de { fileId, filename, type, preview }, antes chatFileId/chatFileMeta singular
  // 2026-07-13 — antes `chatToTask`: se consumía en el primer wire() de Tasks
  // y cualquier rerender posterior (poll 30s, loadOrModels) reconstruía el
  // textarea VACÍO — el seed del chat se perdía y el botón "crear tarea"
  // parecía no hacer nada. Ahora el borrador vive en state y se sincroniza
  // con el input en cada tecla, así sobrevive cualquier rerender.
  composeDraft: '',
  // B.3 (Mes 21) — mismo bug y mismo fix que composeDraft: el poll de 30s
  // reconstruía #chat-input vacío en medio de tipear, Send quedaba como no-op.
  chatDraft: '',
  // 2026-07-13 (corrección de Carlos) — pill único modelo+esfuerzo del composer:
  // null | 'root' | 'model' | 'effort'. Reemplaza al viejo chatModelComboOpen
  // (combobox de modelo separado del <select> de esfuerzo).
  chatFxView: null,
  chatAttachMenuOpen: false, // FRONT.9 — menú de tipo de adjunto (Imagen/Documento/URL)
  // 2026-07-08 — mismo patrón (antes chatModelComboOpen) pero genérico para todos
  // los demás selectores de modelo (draft composer, diagnose, roles de
  // Settings→Model routing, modal de crear tarea). Antes cada uno era un
  // <select> nativo con cientos de <option> sin filtro — Carlos lo reportó
  // como falta de intuición de diseño real. Un solo combo abierto a la vez.
  modelComboOpenKey: null,
  orModels: null,   // null = not fetched, [] = loading, [...] = loaded (shared: chat + tasks)
  orModelsAttempted: false, // true once a fetch (success or failure) has completed — prevents retry-loop on every rerender
  orModelsLastFetch: 0, // timestamp of last successful fetch (ms), for TTL
  localModels: null, // null = not checked, [] = none available, [...] = Ollama models

  graphStatus: 'idle',  // 'idle' | 'loading' | 'ok' | 'error'
  graphRun: null,       // GraphRunStatusResponse from GET /api/run/graph/status
  graphLaunching: false,
};

const NAV = [
  { id: 'chat',      icon: ICON.chat,     key: 'nav.chat' },
  { id: 'project',   icon: ICON.project,  key: 'nav.project' },
  { id: 'instincts', icon: ICON.instinct, key: 'nav.instincts' },
  { id: 'skills',    icon: ICON.flask,    key: 'nav.skills',   badge: true },
  { id: 'tasks',     icon: ICON.tasks,    key: 'nav.tasks',    operator: true },
  { id: 'runs',      icon: ICON.runs,     key: 'nav.runs',     operator: true },
  { id: 'graph',     icon: ICON.graph,    key: 'nav.graph',    operator: true },
  { id: 'memory',    icon: ICON.memory,   key: 'nav.memory',   operator: true },
  { id: 'specs',     icon: ICON.specs,    key: 'nav.specs',    operator: true },
  { id: 'settings',  icon: ICON.settings, key: 'nav.settings' },
];

/* ============================================================
   API fetching
   ============================================================ */
const App = {
  async fetchRuns() {
    try {
      const res = await fetch('/api/runs');
      if (!res.ok) throw new Error(res.status);
      state.runs = await res.json();
      state.runsStatus = 'ok';
    } catch {
      state.runsStatus = 'error';
    }
  },
  async fetchInstincts() {
    try {
      const res = await fetch('/api/instincts');
      if (!res.ok) throw new Error(res.status);
      state.instincts = await res.json();
      state.instinctsStatus = 'ok';
    } catch {
      state.instinctsStatus = 'error';
    }
    // Bug fix (2026-06-29): this used to call this.rerender() unconditionally —
    // fetchAll() polls every 30s regardless of which screen is active, and
    // rerender() replaces #main's entire innerHTML, silently wiping any
    // uncontrolled input (chat textarea, model combo search box, anything not
    // round-tripped through state) the user happened to be typing in at that
    // moment. No nav badge depends on instincts data, so only rerender when
    // the user is actually looking at the Instincts screen.
    if (state.screen === 'instincts') this.rerender();
  },
  async fetchSpecs() {
    try {
      const res = await fetch('/api/specs');
      if (!res.ok) throw new Error(res.status);
      state.specs = await res.json();
      state.specsStatus = 'ok';
    } catch {
      state.specsStatus = 'error';
    }
  },
  async fetchSkills() {
    try {
      const res = await fetch('/api/skills');
      if (!res.ok) throw new Error(res.status);
      state.skills = await res.json();
      state.skillsStatus = 'ok';
    } catch {
      state.skillsStatus = 'error';
    }
  },
  async fetchProSkills() {
    try {
      const res = await fetch('/api/skills/pro');
      if (!res.ok) throw new Error(res.status);
      state.proSkills = await res.json();
      state.proSkillsStatus = 'ok';
    } catch {
      state.proSkillsStatus = 'error';
    }
  },
  async fetchRegistrySkills() {
    try {
      const res = await fetch('/api/skills/registry');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.registrySkills = data.skills || [];
      state.registrySkillsStatus = 'ok';
    } catch {
      state.registrySkillsStatus = 'error';
    }
    this.rerender();
  },
  async fetchMemory(q) {
    try {
      const url = q ? `/api/memory?q=${encodeURIComponent(q)}` : '/api/memory';
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      state.memory = await res.json();
      state.memoryStatus = 'ok';
    } catch {
      state.memoryStatus = 'error';
    }
  },
  async fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(res.status);
      state.settings = await res.json();
      state.settingsStatus = 'ok';
    } catch {
      state.settingsStatus = 'error';
    }
  },
  async fetchSetup() {
    try {
      const res = await fetch('/api/setup');
      if (!res.ok) throw new Error(res.status);
      state.setup = await res.json();
      state.setupStatus = 'ok';
    } catch {
      state.setupStatus = 'error';
    }
  },
  async fetchHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(res.status);
      state.health = await res.json();
      state.healthStatus = 'ok';
    } catch {
      state.healthStatus = 'error';
    }
  },
  async fetchConstitution() {
    state.constitutionStatus = 'loading';
    try {
      const res = await fetch('/api/project/constitution');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.constitutionContent = data.content;
      state.constitutionStatus = 'ok';
    } catch {
      state.constitutionStatus = 'error';
    }
  },
  async fetchContext() {
    state.contextStatus = 'loading';
    try {
      const res = await fetch('/api/project/context');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.contextContent = data.content;
      state.contextStatus = 'ok';
    } catch {
      state.contextStatus = 'error';
    }
  },
  async fetchMemoryConflicts() {
    try {
      const res = await fetch('/api/memory/conflicts');
      state.memoryConflicts = res.ok ? await res.json() : [];
    } catch {
      state.memoryConflicts = [];
    }
  },
  async fetchOrcheConfig() {
    state.orcheConfigStatus = 'loading';
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error(res.status);
      state.orcheConfig = await res.json();
      state.orcheConfigStatus = 'ok';
    } catch {
      state.orcheConfigStatus = 'error';
    }
  },
  async fetchChatTaskBarEvents() {
    state.chatTaskBarEventsStatus = 'loading';
    try {
      const res = await fetch('/api/chat/task-bar-events');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.chatTaskBarEventsSummary = data.summary;
      state.chatTaskBarEvents = data.events;
      state.chatTaskBarEventsStatus = 'ok';
    } catch {
      state.chatTaskBarEventsStatus = 'error';
    }
  },
  async fetchAll() {
    await Promise.all([
      this.fetchRuns(),
      this.fetchTasks(),
      this.fetchInstincts(),
      this.fetchSpecs(),
      this.fetchSkills(),
      this.fetchProSkills(),
      this.fetchMemory(),
      this.fetchMemoryConflicts(),
      this.fetchSettings(),
      this.fetchSetup(),
      this.fetchHealth(),
    ]);
    if (!state.setupRedirectDone && state.setup?.criticalMissing) {
      state.screen = 'settings';
      state.setupRedirectDone = true;
    }
    // Home SIEMPRE es Chat, sin excepciones (decisión explícita de Carlos, reafirmada
    // 2026-07-07). El redirect a Settings por "urgent attention" ya se había eliminado;
    // el redirect a Runs en modo avanzado (F5, Mes 14) también se elimina acá — Carlos
    // fue explícito: "el home siempre debe ser el chat principal SIEMPRE", sin excepción
    // de modo. Solo el setup wizard (criticalMissing, arriba) sigue redirigiendo — sin
    // eso el chat ni siquiera funciona.
    state.attentionRedirectDone = true;
    // Bug fix (2026-06-29, ampliado 2026-07-08): fetchAll() runs every 30s via
    // setInterval (boot()), regardless of which screen is open. This used to
    // call this.rerender() unconditionally — rerender() replaces #main's
    // entire innerHTML, which silently wiped any uncontrolled input the user
    // was mid-typing in (chat textarea, model combo search box, any filter
    // input) every time the poll landed. Skip the destructive full rerender
    // while focus is inside #main's input/textarea/select — just keep the nav
    // badges (skills count) fresh instead. The next poll (or the user's own
    // next action, which already rerenders) picks up the fresh data once
    // they're done. Ampliado a SELECT (2026-07-08): el panel "Model routing"
    // (Settings) tiene selects de modelo por rol — sin este guard, un poll de
    // 30s mientras el usuario elige un modelo pero antes de guardar hacía
    // rerender() y le devolvía el valor al default, perdiendo la elección en
    // silencio (encontrado al verificar E.9/roles editables en vivo).
    const typingInMain = document.activeElement
      && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      && document.getElementById('main')?.contains(document.activeElement);
    if (typingInMain) {
      this.syncNav();
    } else {
      this.rerender();
    }
    // v0.13 seed — solo refresca la pestaña activa del panel derecho si está
    // abierto; Explorer no depende de state.runs, se refresca a sí mismo.
    if (state.rightPanelOpen && state.rightPanelTab !== 'explorer') RightPanel.render();
  },
  async fetchTasks() {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error(res.status);
      state.tasks = await res.json();
      state.tasksStatus = 'ok';
    } catch {
      state.tasksStatus = 'error';
    }
  },
  async fetchGraphStatus() {
    try {
      const res = await fetch('/api/run/graph/status');
      if (!res.ok) throw new Error(res.status);
      state.graphRun = await res.json();
      state.graphStatus = 'ok';
    } catch {
      state.graphStatus = 'error';
    }
  },

  rerender() {
    const main = document.getElementById('main');
    const sc = SCREENS[state.screen];
    main.innerHTML = sc.render(state);
    sc.wire(main, state);
    this.syncHeader();
    this.syncNav();
  },
  go(id) {
    // stop auto-refresh when leaving Runs, Settings or the Graph runner
    if (SCREENS.runs._timer) { clearInterval(SCREENS.runs._timer); SCREENS.runs._timer = null; }
    if (SCREENS.settings._timer) { clearInterval(SCREENS.settings._timer); SCREENS.settings._timer = null; }
    if (SCREENS.graph._timer) { clearInterval(SCREENS.graph._timer); SCREENS.graph._timer = null; }
    state.screen = id;
    state.openRun = null; state.openSpec = null; state.openSkill = null;
    // lazy-load project content on first visit
    if (id === 'project') {
      const tab = state.projectTab || 'constitution';
      if (tab === 'constitution' && state.constitutionStatus === 'idle') {
        this.fetchConstitution().then(() => this.rerender());
      } else if (tab === 'context' && state.contextStatus === 'idle') {
        this.fetchContext().then(() => this.rerender());
      }
    }
    // lazy-load graph runner status on first visit
    if (id === 'graph' && state.graphStatus === 'idle') {
      state.graphStatus = 'loading';
      this.fetchGraphStatus().then(() => this.rerender());
    }
    this.rerender();
  },
  syncNav() {
    document.querySelectorAll('.nav-icon').forEach(n =>
      n.classList.toggle('active', n.dataset.nav === state.screen));
    const sc = (state.skills || []).length;
    const badge = document.querySelector('[data-count="skills"]');
    if (badge) badge.textContent = sc;
  },
  syncHeader() {
    const running = (state.tasks || []).some(t => t.status === 'running');
    const active = (state.tasks || []).filter(t => t.status === 'running').length;
    const sb = document.getElementById('statusBadge');
    if (sb) { sb.dataset.state = running ? 'running' : 'idle'; sb.querySelector('.txt').textContent = running ? 'RUNNING' : 'IDLE'; }
    const ac = document.getElementById('activeCount');
    if (ac) ac.innerHTML = `<b>${active}</b> active`;
  },
};

/* ============================================================
   Terminal (right panel tab) — shows recent runs
   ============================================================ */
const Term = {
  render() {
    const body = document.getElementById('termBody');
    if (!body) return;
    const runs = state.runs || [];
    if (runs.length === 0) {
      body.innerHTML = `<div class="ln dim">  no runs yet — use the CLI to execute tasks</div>`;
      return;
    }
    body.innerHTML = runs.slice(0, 10).map(r => {
      const cls = r.status === 'failed' ? 'err' : r.status === 'done' ? '' : 'info';
      const sym = r.status === 'done' ? '✓' : r.status === 'failed' ? '✗' : '›';
      const qa  = r.qaVerdict ? `  qa:${esc(r.qaVerdict)}` : '';
      const cost = `  $${Number(r.costUsd).toFixed(4)}`;
      const task = r.taskId ? `  ${esc(r.taskId)}` : '';
      const ts = formatLocalDate(r.createdAt, { seconds: true });
      return `<div class="ln ${cls}">${sym}  ${esc(r.id)}${task}  ${esc(r.model)}${qa}${cost}  <span class="dim">${esc(ts)}</span></div>`;
    }).join('');
  },
};

/* ============================================================
   Right panel — explorer / terminal / diff (v0.13 seed, header redesign)
   ============================================================ */
const RightPanel = {
  render() {
    const body = document.getElementById('rightpanelBody');
    if (!body) return;
    if (state.rightPanelTab === 'explorer') { Explorer.render(); return; }
    if (state.rightPanelTab === 'diff') { this.renderDiff(); return; }
    this.renderTerminal();
  },
  renderTerminal() {
    const body = document.getElementById('rightpanelBody');
    body.innerHTML = `<div class="rp-terminal">
      <div class="rp-terminal-head">
        <span class="rp-terminal-label">${ICON.term} ${t('rp.terminal.title')}</span>
        <span class="live">● live</span>
      </div>
      <div class="rp-terminal-body" id="termBody"></div>
    </div>`;
    Term.render();
  },
  // Diff tab — reusa fileDiffs de la corrida más reciente que produjo alguno
  // (v0.12 Bloque C). No repite el motor: mismo `renderFileDiffGroup()` que
  // usa el detalle de Runs.
  renderDiff() {
    const body = document.getElementById('rightpanelBody');
    const runs = state.runs || [];
    const withDiff = runs.find(r => r.fileDiffs && r.fileDiffs.length);
    if (!withDiff) {
      body.innerHTML = `<div class="rp-explorer-empty">${t('rp.diff.empty')}</div>`;
      return;
    }
    const ts = formatLocalDate(withDiff.createdAt, { seconds: true });
    body.innerHTML = `<div class="rp-diff">
      <div class="rp-diff-meta">
        <span class="mono">${esc(withDiff.taskId || withDiff.id)}</span>
        <span>·</span><span>${esc(ts)}</span>
      </div>
      ${withDiff.fileDiffs.map(f => renderFileDiffEntry(withDiff.id, f)).join('')}
    </div>`;
  },
};

/* ============================================================
   Explorer (right panel tab) — árbol read-only del proyecto, un nivel
   por request (docs: src/dashboard/handlers/explorer.ts). Se maneja fuera
   del ciclo App.rerender() — igual que Term/SidePanel/Modal — porque su
   estado (directorios expandidos, archivo abierto) no debe reconstruirse
   en cada poll de 30s.
   ============================================================ */
const Explorer = {
  cache: {},
  async fetchDir(path) {
    if (this.cache[path]) return this.cache[path];
    try {
      const res = await fetch(`/api/explorer/tree?path=${encodeURIComponent(path)}`);
      if (!res.ok) return [];
      const data = await res.json();
      this.cache[path] = data.entries;
      return data.entries;
    } catch { return []; }
  },
  entryRow(e, depth) {
    const typeIc = e.type === 'dir'
      ? `<span class="exp-ic">${ICON.chevR}</span>`
      : `<span class="exp-ic"></span>`;
    const fileIc = `<span class="exp-type-ic">${e.type === 'dir' ? ICON.folder : ICON.file}</span>`;
    return `<div class="exp-row" data-exp-path="${esc(e.path)}" data-exp-type="${e.type}" data-exp-depth="${depth}" style="padding-left:${depth * 14 + 6}px" role="button" tabindex="0">${typeIc}${fileIc}<span class="exp-name">${esc(e.name)}</span></div>`;
  },
  async render() {
    const body = document.getElementById('rightpanelBody');
    if (!body) return;
    if (state.explorerOpenFile) { this.renderFile(state.explorerOpenFile); return; }
    const entries = await this.fetchDir('');
    body.innerHTML = entries.length
      ? `<div class="rp-explorer" id="explorerTree">${entries.map(e => this.entryRow(e, 0)).join('')}</div>`
      : `<div class="rp-explorer-empty">${t('rp.explorer.empty')}</div>`;
    this.wire();
  },
  wire() {
    const tree = document.getElementById('explorerTree');
    if (!tree) return;
    tree.querySelectorAll('.exp-row').forEach(row => {
      row.addEventListener('click', async () => {
        if (row.dataset.expType === 'file') {
          state.explorerOpenFile = row.dataset.expPath;
          this.render();
          return;
        }
        const depth = Number(row.dataset.expDepth);
        const next = row.nextElementSibling;
        if (next && next.classList.contains('exp-children')) {
          next.remove();
          row.classList.remove('open');
          return;
        }
        row.classList.add('open');
        const children = await this.fetchDir(row.dataset.expPath);
        const wrap = document.createElement('div');
        wrap.className = 'exp-children';
        wrap.innerHTML = children.map(c => this.entryRow(c, depth + 1)).join('');
        row.after(wrap);
        this.wire();
      });
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });
    });
  },
  async renderFile(path) {
    const body = document.getElementById('rightpanelBody');
    body.innerHTML = `<div class="rp-file-preview"><div class="rp-file-preview-head"><button class="rp-file-back" id="expBack">${ICON.chevR} ${t('rp.explorer.back')}</button><span class="rp-file-path mono">${esc(path)}</span></div><div class="rp-file-note">${t('rp.explorer.loading')}</div></div>`;
    document.getElementById('expBack').addEventListener('click', () => {
      state.explorerOpenFile = null;
      this.render();
    });
    try {
      const res = await fetch(`/api/explorer/file?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      const note = document.querySelector('.rp-file-preview .rp-file-note, .rp-file-preview pre');
      if (!note) return; // el usuario ya volvió al árbol antes de que respondiera
      if (data.binary) {
        note.outerHTML = `<div class="rp-file-note">${t('rp.explorer.binary')}</div>`;
      } else if (data.tooLarge) {
        note.outerHTML = `<div class="rp-file-note">${t('rp.explorer.toolarge')}</div>`;
      } else {
        note.outerHTML = `<pre>${esc(data.content)}</pre>`;
      }
    } catch {
      const note = document.querySelector('.rp-file-preview .rp-file-note');
      if (note) note.textContent = t('rp.explorer.error');
    }
  },
};

/* ============================================================
   Side panel (task details)
   ============================================================ */
const SidePanel = {
  el: null, backdrop: null,
  init() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'backdrop';
    this.backdrop.addEventListener('click', () => this.close());
    this.el = document.createElement('div');
    this.el.className = 'side-panel';
    // Append to body so rerender() on #main doesn't destroy the panel
    document.body.append(this.backdrop, this.el);
  },
  openTask(t) {
    const t2 = window.t;  // alias to avoid shadowing the task param
    const v = STATUS_BADGE[t.status] || 'gray';
    const outputList = (t.output || []).length
      ? `<div class="sp-section"><div class="label">${t2('panel.output')}</div><div class="val mono" style="font-size:12px">${(t.output || []).map(f => esc(f)).join('<br>')}</div></div>`
      : '';
    this.el.innerHTML = `
      <div class="sp-head">
        <span class="badge ${v}"><span class="d"></span>${esc(t.status)}</span>
        <h3 class="mono" style="font-size:13px">${esc(t.id)}</h3>
        <button class="sp-close">${ICON.x}</button>
      </div>
      <div class="sp-body">
        <div class="sp-section"><div class="label">${t2('panel.description')}</div><div class="val">${esc(t.description)}</div></div>
        ${outputList}
        <div class="sp-meta">
          ${t.skill ? `<div><div class="label">${t2('panel.skill')}</div><span class="badge blue square">${esc(t.skill)}</span></div>` : ''}
          <div><div class="label">${t2('panel.executor')}</div><div class="val mono" style="font-size:13px">${esc(t.executor || '—')}</div></div>
          <div><div class="label">${t2('panel.qa')}</div>${t.qaVerdict ? `<span class="badge ${t.qaVerdict === 'pass' ? 'green' : 'red'}">${t.qaVerdict}</span>` : '<span class="muted mono" style="font-size:13px">—</span>'}</div>
          <div><div class="label">${t2('panel.retries')}</div><div class="val mono" style="font-size:13px">↻ ${t.retryCount}</div></div>
        </div>
        ${t.runId ? `<div class="sp-section"><div class="label">${t2('panel.lastrun')}</div><div class="val mono" style="font-size:13px;color:var(--accent)">${esc(t.runId)}</div></div>` : ''}
        <div class="sp-section">
          <div class="label" style="margin-bottom:6px">Clarificación antes de ejecutar</div>
          <textarea id="sp-clarify" placeholder="Opcional: añade contexto o instrucciones adicionales para el agente…"></textarea>
          <button class="btn primary sm sp-run-clarify" style="margin-top:8px;width:100%">${ICON.send} Ejecutar con clarificación</button>
        </div>
        <div id="sp-explain-out" style="display:none"></div>
      </div>
      <div class="sp-foot">
        <button class="btn ghost sm sp-explain">${ICON.search} Explain</button>
        <span style="flex:1"></span>
        <button class="btn danger sm sp-delete">${ICON.trash}</button>
      </div>`;
    this.el.querySelector('.sp-close').addEventListener('click', () => this.close());
    this.el.querySelector('.sp-delete').addEventListener('click', async () => {
      const ok = await Modal.confirm(`Delete task "${t.id}"?`, t('bulk.confirm.body'), t('btn.confirm'));
      if (!ok) return;
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, { method: 'DELETE' });
        if (res.ok) { this.close(); await App.fetchTasks(); App.rerender(); }
        else { const e = await res.json(); showToast(e.error || 'Delete failed', 'error'); }
      } catch { showToast('Connection error', 'error'); }
    });
    this.el.querySelector('.sp-explain')?.addEventListener('click', async () => {
      const out = this.el.querySelector('#sp-explain-out');
      out.style.display = 'block';
      out.innerHTML = '<span class="muted" style="font-size:12px">Cargando…</span>';
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}/explain`);
        const d = await res.json();
        if (!res.ok) { out.innerHTML = `<span style="color:var(--error);font-size:12px">${esc(d.error || 'Error')}</span>`; return; }
        out.innerHTML = `<div class="sp-explain-card">
          <div class="sp-explain-row"><span class="sp-explain-k">Model</span><span class="sp-explain-v">${esc(d.model)}</span></div>
          <div class="sp-explain-row"><span class="sp-explain-k">Executor</span><span class="sp-explain-v">${esc(d.executor)}</span></div>
          <div class="sp-explain-row"><span class="sp-explain-k">Input (${esc(d.inputSource)})</span><span class="sp-explain-v">${d.inputFiles.length ? d.inputFiles.map(f => esc(f)).join(', ') : '—'}</span></div>
          <div class="sp-explain-row"><span class="sp-explain-k">Outputs</span><span class="sp-explain-v">${d.outputs.length ? d.outputs.map(f => esc(f)).join(', ') : '—'}</span></div>
          <div class="sp-explain-row"><span class="sp-explain-k">Checks</span><span class="sp-explain-v">${d.checks.length ? d.checks.map(c => esc(c.cmd)).join(', ') : '(none)'}</span></div>
          <div class="sp-explain-row"><span class="sp-explain-k">Criteria</span><span class="sp-explain-v">${d.acceptanceCriteria.length ? d.acceptanceCriteria.length + ' items' : '(none)'}</span></div>
          <div class="sp-explain-row"><span class="sp-explain-k">Constitution</span><span class="sp-explain-v">${d.constitution ? d.constitution.ruleCount + ' rules' : '(none)'}</span></div>
        </div>`;
      } catch { out.innerHTML = '<span style="color:var(--error);font-size:12px">Connection error</span>'; }
    });
    this.el.querySelector('.sp-run-clarify')?.addEventListener('click', async () => {
      const clarification = this.el.querySelector('#sp-clarify')?.value?.trim();
      const btn = this.el.querySelector('.sp-run-clarify');
      btn.disabled = true;
      try {
        const body = clarification ? { clarification } : {};
        const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}/run`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (res.ok) { this.close(); await App.fetchTasks(); App.rerender(); showToast('Tarea en cola ✓'); }
        else { const e = await res.json(); showToast(e.error || 'Error al ejecutar', 'error'); }
      } catch { showToast('Connection error', 'error'); }
      finally { btn.disabled = false; }
    });
    requestAnimationFrame(() => { this.el.classList.add('open'); this.backdrop.classList.add('show'); });
  },
  close() { this.el.classList.remove('open'); this.backdrop.classList.remove('show'); },
};

/* ============================================================
   Modal (add instinct)
   ============================================================ */
const Modal = {
  el: null,
  init() {
    this.el = document.createElement('div');
    this.el.className = 'modal-scrim';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', e => { if (e.target === this.el) this.close(); });
  },

  // v0.12 Bloque A (ex-IDEAS #18) — modal de confirmación genérico, reemplaza
  // los confirm()/prompt() nativos del navegador (regla: nunca alert/confirm
  // nativo en public/). Promesa que resuelve true/false — el llamador espera
  // el resultado antes de proceder, mismo contrato que confirm() nativo pero
  // sin bloquear el hilo ni verse como un diálogo del OS.
  confirm(title, body, confirmLabel) {
    return new Promise(resolve => {
      this.el.innerHTML = `<div class="modal" style="max-width:480px">
        <div class="m-head"><h3>${esc(title)}</h3><button class="btn ghost sm" data-x>${ICON.x}</button></div>
        <div class="m-body"><p style="margin:0;font-size:13px;color:var(--text-muted);line-height:1.5;white-space:pre-wrap;max-height:50vh;overflow-y:auto">${esc(body)}</p></div>
        <div class="m-foot"><button class="btn" data-cancel>${t('btn.cancel')}</button>
          <button class="btn danger" data-confirm>${esc(confirmLabel ?? t('btn.confirm'))}</button></div>
      </div>`;
      const settle = val => { this.close(); resolve(val); };
      this.el.querySelectorAll('[data-x],[data-cancel]').forEach(b => b.addEventListener('click', () => settle(false)));
      this.el.querySelector('[data-confirm]').addEventListener('click', () => settle(true));
      requestAnimationFrame(() => this.el.classList.add('show'));
    });
  },

  // v0.12 Bloque A — reemplaza el alert(text) usado como fallback cuando
  // navigator.clipboard.writeText() falla (permiso denegado/no soportado):
  // en vez de un diálogo nativo, un textarea de solo lectura ya seleccionado
  // para que el usuario copie a mano con Ctrl/Cmd+C.
  showCopyText(title, text) {
    this.el.innerHTML = `<div class="modal" style="max-width:480px">
      <div class="m-head"><h3>${esc(title)}</h3><button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body"><textarea readonly style="width:100%;min-height:80px;font-family:var(--mono);font-size:12.5px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:10px;color:var(--text)">${esc(text)}</textarea></div>
      <div class="m-foot"><button class="btn primary" data-x>${t('btn.confirm')}</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    requestAnimationFrame(() => {
      this.el.classList.add('show');
      const ta = this.el.querySelector('textarea');
      ta?.focus(); ta?.select();
    });
  },
  openInstinct() {
    this.el.innerHTML = `<div class="modal">
      <div class="m-head"><span style="color:var(--accent)">${ICON.bolt}</span><h3>${t('modal.inst.title')}</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body">
        <div class="m-field">
          <label>${t('modal.inst.when.label')}</label>
          <input id="i-trig" placeholder="${t('modal.inst.when.ph')}" autocomplete="off">
          <div class="m-hint">${t('modal.inst.when.hint')}</div>
        </div>
        <div class="m-field">
          <label>${t('modal.inst.what.label')}</label>
          <input id="i-act" placeholder="${t('modal.inst.what.ph')}" autocomplete="off">
          <div class="m-hint">${t('modal.inst.what.hint')}</div>
        </div>
        <div class="muted" style="font-size:12px;margin-top:4px">${t('modal.inst.note')}</div>
        <div id="i-msg" style="font-size:12px;display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>${t('btn.cancel')}</button>
        <button class="btn primary" data-add>${ICON.plus} ${t('modal.inst.btn.add')}</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    this.el.querySelector('[data-add]').addEventListener('click', async () => {
      const trig = this.el.querySelector('#i-trig').value.trim();
      const act  = this.el.querySelector('#i-act').value.trim();
      const msg  = this.el.querySelector('#i-msg');
      if (!trig || !act) { msg.textContent = t('modal.inst.err.req'); msg.style.color = 'var(--error)'; msg.style.display = ''; return; }
      const btn = this.el.querySelector('[data-add]');
      btn.disabled = true;
      try {
        const res = await fetch('/api/instincts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: trig, action: act }),
        });
        if (res.ok) {
          this.close();
          await App.fetchInstincts();
        } else {
          const e = await res.json();
          msg.textContent = e.error || 'Failed to add instinct.';
          msg.style.color = 'var(--error)';
          msg.style.display = '';
        }
      } catch {
        msg.textContent = 'Connection error.';
        msg.style.color = 'var(--error)';
        msg.style.display = '';
      } finally { btn.disabled = false; }
    });
    requestAnimationFrame(() => this.el.classList.add('show'));
  },

  openPropose() {
    this.el.innerHTML = `<div class="modal">
      <div class="m-head"><span style="color:var(--accent)">${ICON.instinct}</span><h3>Proponer instinct</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body">
        <div class="m-field">
          <label>Cuándo se aplica</label>
          <input id="p-trig" placeholder="Ej: When the agent sees a 500 error" autocomplete="off">
          <div class="m-hint">Condición que activa este comportamiento</div>
        </div>
        <div class="m-field">
          <label>Qué debe hacer el agente</label>
          <input id="p-act" placeholder="Ej: Log the error and retry once" autocomplete="off">
          <div class="m-hint">Acción concreta a tomar</div>
        </div>
        <div class="muted" style="font-size:12px;margin-top:4px">Se creará con confidence 0.6 y requerirá aprobación manual.</div>
        <div id="p-msg" style="font-size:12px;display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>${t('btn.cancel')}</button>
        <button class="btn primary" data-propose>${ICON.instinct} Proponer</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    this.el.querySelector('[data-propose]').addEventListener('click', async () => {
      const trig = this.el.querySelector('#p-trig').value.trim();
      const act  = this.el.querySelector('#p-act').value.trim();
      const msg  = this.el.querySelector('#p-msg');
      if (!trig || !act) { msg.textContent = 'Trigger y action son requeridos.'; msg.style.color = 'var(--error)'; msg.style.display = ''; return; }
      const btn = this.el.querySelector('[data-propose]');
      btn.disabled = true;
      try {
        const res = await fetch('/api/instincts/propose', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: trig, action: act }),
        });
        if (res.ok) { this.close(); await App.fetchInstincts(); showToast('Instinct propuesto — pendiente de aprobación'); }
        else { const e = await res.json(); msg.textContent = e.error || 'Error al proponer.'; msg.style.color = 'var(--error)'; msg.style.display = ''; }
      } catch { msg.textContent = 'Connection error.'; msg.style.color = 'var(--error)'; msg.style.display = ''; }
      finally { btn.disabled = false; }
    });
    requestAnimationFrame(() => this.el.classList.add('show'));
  },

  openTask() {
    const models = state.orModels;
    const modelOptions = buildModelSelect('t-model', null, models);
    this.el.innerHTML = `<div class="modal">
      <div class="m-head"><span style="color:var(--accent)">${ICON.tasks}</span><h3>${t('modal.task.title')}</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body">
        <div class="m-field"><label>${t('modal.task.desc.label')}</label>
          <textarea id="t-desc" rows="3" placeholder="${t('modal.task.desc.ph')}"></textarea></div>
        <div class="m-field" style="margin-top:2px">
          <span class="muted" style="font-size:11px">ID: </span>
          <span id="t-id-preview" class="mono muted" style="font-size:11px">—</span>
        </div>
        <div class="m-field"><label>${t('modal.task.out.label')}</label>
          <textarea id="t-out" rows="3" placeholder="${t('modal.task.out.ph')}"></textarea></div>
        <div class="m-field"><label>${t('modal.task.model.label')}</label>
          ${modelOptions}</div>
        <div id="t-msg" style="font-size:12px;display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>${t('btn.cancel')}</button>
        <button class="btn primary" data-add>${ICON.plus} ${t('modal.task.btn.create')}</button></div>
    </div>`;
    const descEl = this.el.querySelector('#t-desc');
    const previewEl = this.el.querySelector('#t-id-preview');
    descEl.addEventListener('input', () => {
      previewEl.textContent = descToId(descEl.value) || '—';
    });
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    // (el combo de modelo se carga solo al abrirse — wiring genérico en boot())

    // Auto-load if not yet fetched (only once — orModelsAttempted prevents a retry-loop when the fetch keeps failing)
    if (state.orModels === null && !state.orModelsAttempted) {
      loadOrModels().then(() => this.openTask());
    }
    this.el.querySelector('[data-add]').addEventListener('click', async () => {
      const desc = this.el.querySelector('#t-desc').value.trim();
      const id   = descToId(desc);
      const outRaw = this.el.querySelector('#t-out').value.trim();
      const modelId = this.el.querySelector('#t-model')?.value?.trim() || 'deepseek/deepseek-v4-flash';
      const executor = inferExecutor(modelId);
      const msg = this.el.querySelector('#t-msg');
      const output = outRaw.split('\n').map(s => s.trim()).filter(Boolean);
      if (!desc) {
        msg.textContent = t('modal.task.err.required');
        msg.style.color = 'var(--error)'; msg.style.display = ''; return;
      }
      const btn = this.el.querySelector('[data-add]');
      btn.disabled = true;
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, description: desc, output, executor, executor_model: modelId }),
        });
        if (res.ok) {
          this.close();
          await App.fetchTasks();
          App.rerender();
        } else {
          const e = await res.json();
          msg.textContent = e.error || 'Failed to create task.';
          msg.style.color = 'var(--error)'; msg.style.display = '';
        }
      } catch {
        msg.textContent = 'Connection error.';
        msg.style.color = 'var(--error)'; msg.style.display = '';
      } finally { btn.disabled = false; }
    });
    requestAnimationFrame(() => this.el.classList.add('show'));
  },

  openSkillDetail(skill) {
    const field = (label, val) => val ? `<div class="m-field"><label>${label}</label><div class="val mono" style="font-size:13px;line-height:1.5;white-space:pre-wrap">${esc(val)}</div></div>` : '';
    const listField = (label, items) => items && items.length ? `<div class="m-field"><label>${label}</label><div class="val" style="font-size:13px">${items.map(i => `<span class="badge blue square" style="margin:2px">${esc(i)}</span>`).join(' ')}</div></div>` : '';
    const examplesField = skill.examples && skill.examples.length ? `<div class="m-field"><label>${t('skills.detail.examples')}</label><div style="font-size:12px">${skill.examples.map(ex => `<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px;margin-bottom:6px"><b>${esc(ex.title)}</b><div class="muted" style="margin-top:4px">${esc(ex.input)}</div><div class="muted" style="margin-top:2px;color:var(--text)">→ ${esc(ex.output)}</div></div>`).join('')}</div></div>` : '';
    const langTargets = skill.language_targets ? Object.entries(skill.language_targets).map(([lang, cfg]) => `<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px;margin-bottom:4px"><b>${esc(lang)}</b>${cfg.verifiers ? `<div class="muted" style="margin-top:4px">${t('skills.detail.verifiers')}: ${cfg.verifiers.map(v => esc(v)).join(', ')}</div>` : ''}${cfg.anti_patterns ? `<div class="muted">${t('skills.detail.anti_patterns')}: ${cfg.anti_patterns.map(a => esc(a)).join(', ')}</div>` : ''}</div>`).join('') : '';
    const langSection = langTargets ? `<div class="m-field"><label>${t('skills.detail.language_targets')}</label>${langTargets}</div>` : '';

    this.el.innerHTML = `<div class="modal" style="width:520px;max-width:calc(100vw - 40px)">
      <div class="m-head"><span style="color:var(--accent)">${ICON.flask}</span><h3>${esc(skill.name)} <span class="muted" style="font-weight:400;font-size:12px">v${esc(skill.version)}</span></h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body" style="max-height:70vh;overflow-y:auto">
        ${field(t('skills.detail.id'), skill.id)}
        ${skill.description ? `<div class="m-field"><label>${t('skills.detail.description')}</label><div class="val" style="font-size:13px">${esc(skill.description)}</div></div>` : ''}
        ${listField(t('skills.detail.targets'), skill.targets)}
        ${field(t('skills.detail.instructions'), skill.instructions)}
        ${listField(t('skills.detail.verifiers'), skill.verifiers)}
        ${listField(t('skills.detail.when_to_use'), skill.when_to_use)}
        ${listField(t('skills.detail.anti_patterns'), skill.anti_patterns)}
        ${listField(t('skills.detail.inputs'), skill.inputs_required)}
        ${listField(t('skills.detail.tools'), skill.allowed_tools)}
        ${examplesField}
        ${langSection}
      </div>
      <div class="m-foot"><button class="btn" data-x>${t('skills.detail.close')}</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    requestAnimationFrame(() => this.el.classList.add('show'));
  },

  // ── Bloque D: New Skill modal (textarea + curate + form + preview) ──────
  openNewSkill() {
    this._curatedSkill = null;
    this._editingSkillId = null;
    this._renderNewSkillInput();
    requestAnimationFrame(() => this.el.classList.add('show'));
  },

  // ── Edit existing skill: reuses the New Skill form, prefilled, PUT on save ──
  // The skills list endpoint returns a truncated summary (instructionSummary,
  // no full instructions/verifiers/etc) — fetch the full detail before editing,
  // otherwise PUT fails validation with a field that looks populated in the list
  // but is empty in the real SkillDef.
  async openEditSkill(skillSummary) {
    this._curatedSkill = null;
    this._editingSkillId = skillSummary.id;
    this.el.innerHTML = `<div class="modal" style="width:400px">
      <div class="m-body" style="display:flex;align-items:center;gap:10px;padding:24px">
        <span class="spinner" style="width:16px;height:16px;border-width:2px"></span>
        <span>${t('skills.detail.loading')}</span>
      </div>
    </div>`;
    requestAnimationFrame(() => this.el.classList.add('show'));
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skillSummary.id)}`);
      const full = await res.json();
      if (!res.ok) throw new Error(full.error || 'Failed to load skill');
      this._curatedSkill = full;
      this._renderNewSkillForm();
    } catch {
      this.close();
    }
  },

  _renderNewSkillInput() {
    this.el.innerHTML = `<div class="modal" style="width:540px">
      <div class="m-head"><span style="color:var(--accent)">${ICON.flask}</span><h3>${t('modal.skill.title')}</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body" style="max-height:70vh;overflow-y:auto">
        <div class="m-field">
          <label>${t('modal.skill.textarea.label')}</label>
          <textarea id="ns-desc-input" rows="5" placeholder="${t('modal.skill.textarea.ph')}" style="resize:vertical"></textarea>
          <div class="m-hint">${t('modal.skill.textarea.hint')}</div>
        </div>
        <div id="ns-msg" style="font-size:12px;display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>${t('btn.cancel')}</button>
        <button class="btn primary" data-curate>${ICON.spark} ${t('modal.skill.btn.curate')}</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    this.el.querySelector('[data-curate]').addEventListener('click', async () => {
      const desc = this.el.querySelector('#ns-desc-input').value.trim();
      const msg  = this.el.querySelector('#ns-msg');
      if (!desc) { msg.textContent = t('modal.skill.err.empty'); msg.style.color = 'var(--error)'; msg.style.display = ''; return; }
      const btn = this.el.querySelector('[data-curate]');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;vertical-align:middle"></span>${t('modal.skill.curating')}`;
      msg.style.display = 'none';
      try {
        const res = await fetch('/api/skills/curate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: desc }),
        });
        const data = await res.json();
        if (data.ok && data.skill) {
          this._curatedSkill = data.skill;
          this._renderNewSkillForm();
        } else {
          msg.textContent = data.error || t('modal.skill.err.curate');
          msg.style.color = 'var(--error)'; msg.style.display = '';
          btn.disabled = false;
          btn.innerHTML = `${ICON.spark} ${t('modal.skill.btn.curate')}`;
        }
      } catch {
        msg.textContent = t('common.conn.error');
        msg.style.color = 'var(--error)'; msg.style.display = '';
        btn.disabled = false;
        btn.innerHTML = `${ICON.spark} ${t('modal.skill.btn.curate')}`;
      }
    });
  },

  _renderNewSkillForm() {
    const s = this._curatedSkill || {};
    const isEdit = !!this._editingSkillId;
    const targets = s.targets || [];
    const tClaude = targets.includes('claude') ? 'checked' : '';
    const tCursor = targets.includes('cursor') ? 'checked' : '';
    const tOpenai = targets.includes('openai') ? 'checked' : '';
    const listVal = (key) => esc((s[key] || []).join('\n'));
    const preview = this._yamlFromForm(s);
    this.el.innerHTML = `<div class="modal" style="width:640px">
      <div class="m-head"><span style="color:var(--accent)">${ICON.flask}</span><h3>${isEdit ? t('modal.skill.title.edit') : t('modal.skill.title')}</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body" style="max-height:65vh;overflow-y:auto">
        <div style="display:grid;grid-template-columns:1fr 100px;gap:12px">
          <div class="m-field" style="margin:0"><label>${t('modal.skill.form.id')}</label>
            <input id="ns-id" value="${esc(s.id || '')}" autocomplete="off" ${isEdit ? 'readonly disabled' : ''}></div>
          <div class="m-field" style="margin:0"><label>${t('modal.skill.form.version')}</label>
            <input id="ns-version" value="${esc(s.version || '1.0.0')}" autocomplete="off"></div>
        </div>
        <div class="m-field"><label>${t('modal.skill.form.name')}</label>
          <input id="ns-name" value="${esc(s.name || '')}" autocomplete="off"></div>
        <div class="m-field"><label>${t('modal.skill.form.description')}</label>
          <textarea id="ns-desc" rows="2" style="resize:vertical">${esc(s.description || '')}</textarea></div>
        <div class="m-field"><label>${t('modal.skill.form.targets')}</label>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer"><input type="checkbox" id="ns-t-claude" ${tClaude}> claude</label>
            <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer"><input type="checkbox" id="ns-t-cursor" ${tCursor}> cursor</label>
            <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer"><input type="checkbox" id="ns-t-openai" ${tOpenai}> openai</label>
          </div></div>
        <div class="m-field"><label>${t('modal.skill.form.instructions')}</label>
          <textarea id="ns-instructions" rows="5" style="resize:vertical;font-family:var(--mono);font-size:12px">${esc(s.instructions || '')}</textarea></div>
        <div class="m-field"><label>${t('modal.skill.form.when_to_use')}</label>
          <textarea id="ns-when" rows="3" style="resize:vertical">${listVal('when_to_use')}</textarea></div>
        <div class="m-field"><label>${t('modal.skill.form.anti_patterns')}</label>
          <textarea id="ns-anti" rows="3" style="resize:vertical">${listVal('anti_patterns')}</textarea></div>
        <div class="m-field"><label>${t('modal.skill.form.verifiers')}</label>
          <textarea id="ns-verifiers" rows="3" style="resize:vertical">${listVal('verifiers')}</textarea></div>
        <div class="m-field"><label>${t('modal.skill.form.inputs_required')}</label>
          <textarea id="ns-inputs" rows="2" style="resize:vertical">${listVal('inputs_required')}</textarea></div>
        <div class="m-field"><label>${t('modal.skill.form.allowed_tools')}</label>
          <textarea id="ns-tools" rows="2" style="resize:vertical">${listVal('allowed_tools')}</textarea></div>
        <details class="m-details" style="border:1px solid var(--border);border-radius:var(--radius);padding:10px;background:var(--bg);margin-top:4px">
          <summary style="cursor:pointer;font-size:12.5px;font-weight:500;color:var(--text-muted);user-select:none;display:flex;align-items:center;gap:6px">${ICON.chev} ${t('modal.skill.preview')}</summary>
          <pre id="ns-preview" style="margin:8px 0 0;font-size:11px;line-height:1.5;white-space:pre-wrap;overflow-x:auto;max-height:280px;background:var(--surface);padding:10px;border-radius:var(--radius);tab-size:2">${esc(preview)}</pre>
        </details>
        <div id="ns-msg" style="font-size:12px;display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>${t('btn.cancel')}</button>
        <button class="btn primary" data-save>${ICON.flask} ${isEdit ? t('modal.skill.btn.save.edit') : t('modal.skill.btn.save')}</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    const updatePreview = () => {
      const pre = this.el.querySelector('#ns-preview');
      if (pre) pre.textContent = this._yamlFromForm();
    };
    this.el.querySelectorAll('input, textarea').forEach(el => el.addEventListener('input', updatePreview));
    this.el.querySelector('[data-save]').addEventListener('click', async () => {
      const skill = this._gatherFormData();
      const msg   = this.el.querySelector('#ns-msg');
      if (!skill.id || !skill.name || !skill.description) {
        msg.textContent = 'ID, Name and Description are required.';
        msg.style.color = 'var(--error)'; msg.style.display = ''; return;
      }
      const btn = this.el.querySelector('[data-save]');
      btn.disabled = true;
      try {
        const url    = isEdit ? `/api/skills/${encodeURIComponent(this._editingSkillId)}` : '/api/skills';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(skill),
        });
        if (res.ok) { this.close(); await App.fetchSkills(); App.rerender(); }
        else { const e = await res.json(); msg.textContent = e.error || (isEdit ? t('modal.skill.err.update') : t('modal.skill.err.save')); msg.style.color = 'var(--error)'; msg.style.display = ''; btn.disabled = false; }
      } catch { msg.textContent = t('common.conn.error'); msg.style.color = 'var(--error)'; msg.style.display = ''; btn.disabled = false; }
    });
  },

  _gatherFormData() {
    const g = (id) => (this.el.querySelector(id)?.value || '').trim();
    const gl = (id) => g(id).split('\n').map(s => s.trim()).filter(Boolean);
    const targets = [];
    if (this.el.querySelector('#ns-t-claude')?.checked) targets.push('claude');
    if (this.el.querySelector('#ns-t-cursor')?.checked) targets.push('cursor');
    if (this.el.querySelector('#ns-t-openai')?.checked) targets.push('openai');
    return {
      id: g('#ns-id'), version: g('#ns-version') || '1.0.0', name: g('#ns-name'),
      description: g('#ns-desc'), targets, instructions: g('#ns-instructions'),
      when_to_use: gl('#ns-when'), anti_patterns: gl('#ns-anti'),
      verifiers: gl('#ns-verifiers'), inputs_required: gl('#ns-inputs'),
      allowed_tools: gl('#ns-tools'),
    };
  },

  _yamlFromForm(seed) {
    const d = seed || this._gatherFormData();
    if (!d) return '';
    const lines = [];
    const pushArr = (k, arr) => { if (arr && arr.length) { lines.push(k + ':'); arr.forEach(v => lines.push('  - ' + v)); } };
    const pushStr = (k, v) => { if (v) { if (v.includes('\n')) { lines.push(k + ': |'); v.split('\n').forEach(l => lines.push('  ' + l)); } else { lines.push(k + ': ' + v); } } };
    pushStr('id', d.id); pushStr('version', d.version);
    pushStr('name', d.name); pushStr('description', d.description);
    pushArr('targets', d.targets); pushStr('instructions', d.instructions);
    pushArr('when_to_use', d.when_to_use); pushArr('anti_patterns', d.anti_patterns);
    pushArr('verifiers', d.verifiers); pushArr('inputs_required', d.inputs_required);
    pushArr('allowed_tools', d.allowed_tools);
    return lines.join('\n');
  },

  // ── Bloque E: Import Skill modal (URL + YAML paste + preview + conflict) ──
  openImportSkill() {
    this._importSkill = null;
    this._importTab = 'url';
    this._importWarnings = [];
    this._importConflict = false;
    this._renderImportInput();
    requestAnimationFrame(() => this.el.classList.add('show'));
  },

  _renderImportInput() {
    const tabUrl = this._importTab === 'url';
    const tabYaml = this._importTab === 'yaml';
    const urlContent = tabUrl ? (this._importUrl || '') : '';
    const yamlContent = tabYaml ? (this._importYaml || '') : '';
    this.el.innerHTML = `<div class="modal" style="width:560px">
      <div class="m-head"><span style="color:var(--accent)">${ICON.inbox}</span><h3>${t('modal.import.title')}</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body" style="max-height:70vh;overflow-y:auto">
        <div style="display:flex;gap:0;margin-bottom:6px;border-bottom:1px solid var(--border)">
          <button class="btn ghost sm" data-tab="url" style="${tabUrl ? 'color:var(--accent);border-bottom:2px solid var(--accent);border-radius:0' : ''}">${t('modal.import.tab.url')}</button>
          <button class="btn ghost sm" data-tab="yaml" style="${tabYaml ? 'color:var(--accent);border-bottom:2px solid var(--accent);border-radius:0' : ''}">${t('modal.import.tab.yaml')}</button>
        </div>
        <div id="import-tab-url" style="display:${tabUrl ? '' : 'none'}">
          <div class="m-field">
            <label>${t('modal.import.url.label')}</label>
            <input id="imp-url" value="${esc(urlContent)}" placeholder="${t('modal.import.url.ph')}" autocomplete="off">
          </div>
        </div>
        <div id="import-tab-yaml" style="display:${tabYaml ? '' : 'none'}">
          <div class="m-field">
            <label>${t('modal.import.yaml.label')}</label>
            <textarea id="imp-yaml" rows="8" placeholder="${t('modal.import.yaml.ph')}" style="resize:vertical;font-family:var(--mono);font-size:12px">${esc(yamlContent)}</textarea>
          </div>
        </div>
        <div id="imp-msg" style="font-size:12px;display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>${t('btn.cancel')}</button>
        <button class="btn primary" data-validate>${ICON.search} ${tabUrl ? t('modal.import.btn.fetch') : t('modal.import.btn.validate')}</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    this.el.querySelectorAll('[data-tab]').forEach(b => {
      b.addEventListener('click', () => {
        this._importTab = b.dataset.tab;
        this._renderImportInput();
      });
    });
    this.el.querySelector('[data-validate]').addEventListener('click', async () => {
      const msg = this.el.querySelector('#imp-msg');
      const url = this.el.querySelector('#imp-url')?.value?.trim();
      const yaml = this.el.querySelector('#imp-yaml')?.value?.trim();
      const isUrl = this._importTab === 'url';
      if (isUrl) { this._importUrl = url; this._importYaml = ''; }
      else { this._importYaml = yaml; this._importUrl = ''; }
      if (!url && !yaml) {
        msg.textContent = t('modal.import.err.required');
        msg.style.color = 'var(--error)'; msg.style.display = ''; return;
      }
      const btn = this.el.querySelector('[data-validate]');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;vertical-align:middle"></span>${t('common.loading')}`;
      msg.style.display = 'none';
      try {
        const res = await fetch('/api/skills/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isUrl ? { type: 'url', url } : { type: 'yaml', yaml }),
        });
        const data = await res.json();
        if (data.ok && data.skill) {
          this._importSkill = data.skill;
          this._importWarnings = data.warnings || [];
          this._renderImportPreview();
        } else {
          msg.textContent = data.error || t('modal.import.err.parse');
          msg.style.color = 'var(--error)'; msg.style.display = '';
          btn.disabled = false;
          btn.innerHTML = `${ICON.search} ${isUrl ? t('modal.import.btn.fetch') : t('modal.import.btn.validate')}`;
        }
      } catch {
        msg.textContent = t('common.conn.error');
        msg.style.color = 'var(--error)'; msg.style.display = '';
        btn.disabled = false;
        btn.innerHTML = `${ICON.search} ${isUrl ? t('modal.import.btn.fetch') : t('modal.import.btn.validate')}`;
      }
    });
  },

  _renderImportPreview() {
    const s = this._importSkill || {};
    const warnings = this._importWarnings || [];
    const fields = [
      { label: 'ID', val: s.id },
      { label: t('modal.skill.form.version'), val: s.version },
      { label: t('modal.skill.form.name'), val: s.name },
      { label: t('modal.skill.form.description'), val: s.description },
      { label: t('modal.skill.form.targets'), val: (s.targets || []).join(', ') },
      { label: t('modal.skill.form.instructions'), val: s.instructions },
      { label: t('modal.skill.form.when_to_use'), val: (s.when_to_use || []).join('\n') },
      { label: t('modal.skill.form.anti_patterns'), val: (s.anti_patterns || []).join('\n') },
      { label: t('modal.skill.form.verifiers'), val: (s.verifiers || []).join('\n') },
      { label: t('modal.skill.form.inputs_required'), val: (s.inputs_required || []).join('\n') },
      { label: t('modal.skill.form.allowed_tools'), val: (s.allowed_tools || []).join('\n') },
    ].filter(f => f.val);
    const conflictId = this._importConflict ? this._importConflictId : '';
    this.el.innerHTML = `<div class="modal" style="width:580px">
      <div class="m-head"><span style="color:var(--accent)">${ICON.inbox}</span><h3>${t('modal.import.title')}</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body" style="max-height:65vh;overflow-y:auto">
        ${warnings.map(w => `<div style="font-size:12px;color:var(--warning);padding:6px 10px;background:var(--warning-dim);border-radius:var(--radius);margin-bottom:6px">${esc(w)}</div>`).join('')}
        <div style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:6px">${t('modal.import.preview')}</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:12.5px;line-height:1.6">
          ${fields.map(f => `<div style="margin-bottom:4px"><span class="muted">${esc(f.label)}:</span> <span style="white-space:pre-wrap;word-break:break-word">${esc(f.val)}</span></div>`).join('')}
        </div>
        <div id="imp-conflict" style="display:${this._importConflict ? '' : 'none'};margin-top:10px;padding:10px;background:var(--warning-dim);border:1px solid var(--warning);border-radius:var(--radius)">
          <div style="font-size:12px;color:var(--warning);margin-bottom:6px">${t('modal.import.conflict.title', esc(conflictId))}</div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${t('modal.import.conflict.rename')}</span>
            <input id="imp-rename" value="${esc(conflictId)}" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:6px 10px;font-size:13px;font-family:var(--mono)" autocomplete="off">
          </div>
        </div>
        <div id="imp-msg" style="font-size:12px;display:none;margin-top:6px"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>${t('btn.cancel')}</button>
        <button class="btn" data-back>${ICON.chevR} ${t('wizard.btn.back')}</button>
        <button class="btn primary" data-import>${ICON.flask} ${t('modal.import.btn.import')}</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    this.el.querySelector('[data-back]').addEventListener('click', () => {
      this._renderImportInput();
    });
    this.el.querySelector('[data-import]').addEventListener('click', async () => {
      const skill = { ...this._importSkill };
      if (this._importConflict) {
        const renamed = this.el.querySelector('#imp-rename')?.value?.trim();
        if (renamed) skill.id = renamed;
      }
      const msg = this.el.querySelector('#imp-msg');
      const btn = this.el.querySelector('[data-import]');
      btn.disabled = true;
      msg.style.display = 'none';
      try {
        const res = await fetch('/api/skills', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(skill),
        });
        if (res.ok) {
          this.close();
          await App.fetchSkills();
          App.rerender();
        } else if (res.status === 409) {
          this._importConflict = true;
          this._importConflictId = skill.id;
          this._renderImportPreview();
        } else {
          const e = await res.json();
          msg.textContent = e.error || t('modal.import.err.import');
          msg.style.color = 'var(--error)'; msg.style.display = '';
          btn.disabled = false;
        }
      } catch {
        msg.textContent = t('common.conn.error');
        msg.style.color = 'var(--error)'; msg.style.display = '';
        btn.disabled = false;
      }
    });
  },

  // ── E3: API key wizard ────────────────────────────────────────────────────
  openWizard() {
    this._wizStep = 1;
    this._wizProvider = 'openrouter';
    this._renderWizard();
    requestAnimationFrame(() => this.el.classList.add('show'));
  },

  _renderWizard() {
    const step = this._wizStep;
    const provider = this._wizProvider;

    // Step indicator dots
    const stepTitles = [t('wizard.step1.title'), t('wizard.step2.title'), t('wizard.step3.title')];
    const dots = stepTitles.map((s, i) => {
      const n = i + 1;
      const cls = n === step ? 'active' : n < step ? 'done' : '';
      const label = n < step ? '✓' : n;
      return (i > 0 ? '<span class="wiz-dot-sep">—</span>' : '') +
        `<span class="wiz-dot ${cls}" title="${esc(s)}">${label}</span>`;
    }).join('');

    // Provider dropdown
    const providerOpts = ['openrouter', 'anthropic', 'openai'].map(p =>
      `<option value="${p}" ${p === provider ? 'selected' : ''}>${esc(t('wizard.provider.' + p))}</option>`
    ).join('');

    // Per-provider instructions (static content — URL links, not user input)
    // All step strings are plain text — no HTML. Rendered via esc() into <li> elements.
    const PROVIDER_INFO = {
      openrouter: {
        url: 'https://openrouter.ai/keys',
        steps: ['Go to openrouter.ai', 'Sign up or log in', 'Click "API Keys" in the menu', 'Click "Create Key"', 'Copy the key that appears'],
      },
      anthropic: {
        url: 'https://console.anthropic.com/settings/keys',
        steps: ['Go to console.anthropic.com', 'Sign up or log in', 'Go to Settings → API Keys', 'Click "Create Key"', 'Copy the key'],
      },
      openai: {
        url: 'https://platform.openai.com/api-keys',
        steps: ['Go to platform.openai.com', 'Sign up or log in', 'Click "API keys" in the left menu', 'Click "Create new secret key"', 'Copy the key before closing the dialog'],
      },
    };

    let body = '', foot = '';

    if (step === 1) {
      body = `<p style="font-size:13.5px;line-height:1.6;color:var(--text-muted)">${esc(t('wizard.step1.body'))}</p>
        <div class="m-field">
          <label>${esc(t('wizard.step1.provider.label'))}</label>
          <select id="wiz-provider">${providerOpts}</select>
          <div class="m-hint">${esc(t('wizard.step1.provider.hint'))}</div>
        </div>`;
      foot = `<button class="btn" data-x>${esc(t('btn.cancel'))}</button>
        <button class="btn primary" data-wiz-next>${esc(t('wizard.btn.next'))} →</button>`;

    } else if (step === 2) {
      const info = PROVIDER_INFO[provider] || PROVIDER_INFO.openrouter;
      const listItems = info.steps.map(s => `<li>${esc(s)}</li>`).join('');
      body = `<p class="muted" style="font-size:13px">${esc(t('wizard.step2.intro'))}</p>
        <ol class="wiz-steps-list">${listItems}</ol>
        <a href="${esc(info.url)}" target="_blank" rel="noopener" class="btn ghost sm wiz-link"
           style="margin-top:4px;width:fit-content">${esc(t('wizard.step2.open'))} ↗</a>`;
      foot = `<button class="btn" data-wiz-back>← ${esc(t('wizard.btn.back'))}</button>
        <button class="btn primary" data-wiz-next>${esc(t('wizard.btn.next'))} →</button>`;

    } else {
      body = `<p class="muted" style="font-size:13px">${esc(t('wizard.step3.intro'))}</p>
        <div class="m-field">
          <label>${esc(t('wizard.step3.key.label'))}</label>
          <div class="wiz-key-row">
            <input type="password" id="wiz-key" placeholder="${esc(t('wizard.step3.key.ph'))}" autocomplete="new-password">
            <button class="btn ghost sm" id="wiz-toggle" type="button">${esc(t('wizard.step3.key.show'))}</button>
          </div>
        </div>
        <div id="wiz-msg" style="font-size:12px;display:none"></div>`;
      foot = `<button class="btn" data-wiz-back>← ${esc(t('wizard.btn.back'))}</button>
        <button class="btn primary" id="wiz-save">${esc(t('wizard.step3.btn.save'))}</button>`;
    }

    this.el.innerHTML = `<div class="modal wiz-modal">
      <div class="m-head">
        <span style="font-size:18px">🔑</span>
        <h3>${esc(t('wizard.title'))}</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button>
      </div>
      <div class="wiz-indicator">${dots}</div>
      <div class="m-body">${body}</div>
      <div class="m-foot">${foot}</div>
    </div>`;

    // Wire close
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));

    // Wire back / next
    this.el.querySelector('[data-wiz-back]')?.addEventListener('click', () => {
      this._wizStep--;
      this._renderWizard();
    });
    this.el.querySelector('[data-wiz-next]')?.addEventListener('click', () => {
      if (step === 1) this._wizProvider = this.el.querySelector('#wiz-provider').value;
      this._wizStep++;
      this._renderWizard();
    });

    // Step 3: show/hide toggle
    this.el.querySelector('#wiz-toggle')?.addEventListener('click', () => {
      const inp = this.el.querySelector('#wiz-key');
      const btn = this.el.querySelector('#wiz-toggle');
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? t('wizard.step3.key.show') : t('wizard.step3.key.hide');
    });

    // Step 3: verify and save
    this.el.querySelector('#wiz-save')?.addEventListener('click', async () => {
      const key = this.el.querySelector('#wiz-key')?.value.trim();
      const msg = this.el.querySelector('#wiz-msg');
      const btn = this.el.querySelector('#wiz-save');
      if (!key) {
        msg.textContent = t('wizard.step3.err.empty');
        msg.style.color = 'var(--error)'; msg.style.display = ''; return;
      }
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;vertical-align:middle"></span>${esc(t('wizard.step3.btn.verifying'))}`;
      msg.style.display = 'none';
      try {
        const res = await fetch('/api/setup/api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: this._wizProvider, key }),
        });
        const data = await res.json();
        if (data.valid) {
          this.close();
          await App.fetchAll();
          showToast(t('wizard.success'));
        } else {
          msg.textContent = data.error || t('wizard.step3.err.conn');
          msg.style.color = 'var(--error)'; msg.style.display = '';
          btn.disabled = false;
          btn.textContent = t('wizard.step3.btn.save');
        }
      } catch {
        msg.textContent = t('wizard.step3.err.conn');
        msg.style.color = 'var(--error)'; msg.style.display = '';
        btn.disabled = false;
        btn.textContent = t('wizard.step3.btn.save');
      }
    });
  },

  openSpecDraft(st) {
    const tasks = (st.tasks || []).filter(t => t.status !== 'done');
    const options = tasks.length
      ? tasks.map(t => `<option value="${esc(t.id)}" data-desc="${esc(t.description)}">${esc(t.id)} — ${esc(t.description.slice(0, 50))}</option>`).join('')
      : `<option value="" disabled>No hay tareas pendientes</option>`;
    this.el.innerHTML = `<div class="modal">
      <div class="m-head"><span style="color:var(--accent)">${ICON.specs}</span><h3>Nueva Spec</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body">
        <div class="m-field">
          <label>Tarea</label>
          <select id="sd-task">${options}</select>
          <div class="m-hint">El agente generará el contrato de calidad para esta tarea.</div>
        </div>
        <div class="m-field">
          <label>Descripción <span class="muted">(se auto-rellena al elegir tarea)</span></label>
          <textarea id="sd-desc" rows="3" placeholder="Describe qué debe lograr la tarea…"></textarea>
        </div>
        <div class="muted" style="font-size:12px">El borrador se genera con IA y queda en estado <b>draft</b> para que lo revises antes de aprobar.</div>
        <div id="sd-msg" style="font-size:12px;display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>Cancelar</button>
        <button class="btn primary" data-draft>${ICON.specs} Generar borrador</button></div>
    </div>`;
    // auto-fill description when task changes
    const sel = this.el.querySelector('#sd-task');
    const descEl = this.el.querySelector('#sd-desc');
    const fillDesc = () => {
      const opt = sel.options[sel.selectedIndex];
      if (opt?.dataset.desc) descEl.value = opt.dataset.desc;
    };
    if (sel) { fillDesc(); sel.addEventListener('change', fillDesc); }
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    this.el.querySelector('[data-draft]').addEventListener('click', async () => {
      const taskId = sel?.value.trim();
      const description = descEl?.value.trim();
      const msg = this.el.querySelector('#sd-msg');
      if (!taskId || !description) {
        msg.textContent = 'Elige una tarea y asegúrate de que tenga descripción.';
        msg.style.color = 'var(--error)'; msg.style.display = ''; return;
      }
      const btn = this.el.querySelector('[data-draft]');
      btn.disabled = true;
      msg.textContent = 'Generando borrador con IA…';
      msg.style.color = 'var(--accent)'; msg.style.display = '';
      try {
        const res = await fetch('/api/specs/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, description }),
        });
        if (res.ok) {
          this.close();
          await App.fetchSpecs();
          App.rerender();
        } else {
          const e = await res.json();
          msg.textContent = e.error || 'Error al generar el borrador.';
          msg.style.color = 'var(--error)'; msg.style.display = '';
        }
      } catch {
        msg.textContent = 'Error de conexión.';
        msg.style.color = 'var(--error)'; msg.style.display = '';
      } finally { btn.disabled = false; }
    });
    requestAnimationFrame(() => this.el.classList.add('show'));
  },

  close() { this.el.classList.remove('show'); },

  // 2026-07-12 — el palette busca todo, no solo pantallas: tareas, skills,
  // runs, instincts y memoria, todo ya vive en `state` (poll de 30s), así que
  // la búsqueda es 100% cliente, sin ida y vuelta al backend por tecla.
  // Cierra el gap con el buscador tipo Claude/Raycast que pedía Carlos.
  openCommandPalette() {
    const isAdv = (localStorage.getItem('orchestos-mode') || 'normal') === 'advanced';
    const screenItems = NAV.filter(n => !n.operator || isAdv).map(n => ({
      type: 'screen', icon: n.icon, label: t(n.key), sub: '',
      go: () => App.go(n.id),
    }));

    const entityItems = [];
    for (const tk of state.tasks || []) {
      entityItems.push({
        type: 'task', icon: ICON.tasks, label: tk.description, sub: tk.id,
        go: () => { App.go('tasks'); SidePanel.openTask(tk); },
      });
    }
    for (const sk of [...(state.skills || []), ...(state.proSkills || [])]) {
      entityItems.push({
        type: 'skill', icon: ICON.flask, label: sk.name, sub: sk.description,
        go: () => { App.go('skills'); this.openSkillDetail(sk); },
      });
    }
    for (const r of state.runs || []) {
      entityItems.push({
        type: 'run', icon: ICON.runs, label: r.taskId || r.id, sub: [r.model, r.status].filter(Boolean).join(' · '),
        go: () => { App.go('runs'); state.openRun = r.id; App.rerender(); },
      });
    }
    for (const ins of state.instincts || []) {
      entityItems.push({
        type: 'instinct', icon: ICON.instinct, label: ins.trigger, sub: ins.action,
        go: () => App.go('instincts'),
      });
    }
    for (const m of state.memory || []) {
      entityItems.push({
        type: 'memory', icon: ICON.memory, label: (m.content || '').replace(/\s+/g, ' ').trim().slice(0, 90), sub: m.topic_key || m.scope || '',
        go: () => App.go('memory'),
      });
    }

    const TYPE_LABEL = {
      task: t('cmdk.type.task'), skill: t('cmdk.type.skill'), run: t('cmdk.type.run'),
      instinct: t('cmdk.type.instinct'), memory: t('cmdk.type.memory'),
    };

    let selected = 0;
    let filtered = screenItems;

    const matches = (it, q) => (it.label || '').toLowerCase().includes(q) || (it.sub || '').toLowerCase().includes(q);

    // Screens primero (navegación pura), luego resultados de datos — con un
    // tope por tipo para que una query corta y frecuente (ej. "a") no ahogue
    // la lista con 200 memorias y nada más.
    const search = q => {
      if (!q) return screenItems;
      const hits = [];
      const counts = {};
      for (const it of [...screenItems, ...entityItems]) {
        if (!matches(it, q)) continue;
        counts[it.type] = (counts[it.type] || 0) + 1;
        if (it.type !== 'screen' && counts[it.type] > 8) continue;
        hits.push(it);
      }
      return hits;
    };

    // updateActive() solo togglea la clase — NO toca innerHTML. renderList()
    // reconstruye el DOM y solo se llama cuando `filtered` cambia de verdad
    // (input). Antes, mouseenter llamaba renderList() en cada hover: eso
    // reemplazaba el nodo bajo el cursor por uno nuevo, lo que dispara OTRO
    // mouseenter sobre el nodo nuevo → loop infinito de mouseenter que nunca
    // deja pasar un click real (reproducido: cientos de mouseenter, cero
    // clicks). Con el DOM estable, mousedown/mouseup ocurren sobre el MISMO
    // nodo y el click llega.
    const updateActive = () => {
      this.el.querySelectorAll('.cmdk-item').forEach((el, i) => el.classList.toggle('active', i === selected));
    };

    const renderList = () => {
      const list = this.el.querySelector('#cmdk-list');
      if (!list) return;
      list.innerHTML = filtered.length
        ? filtered.map((it, i) => `
          <div class="cmdk-item" data-i="${i}">
            <span class="cmdk-item-ic">${it.icon}</span>
            <span class="cmdk-item-body">
              <span class="cmdk-item-label">${esc(it.label || '')}</span>
              ${it.sub ? `<span class="cmdk-item-sub">${esc(it.sub)}</span>` : ''}
            </span>
            ${it.type !== 'screen' ? `<span class="cmdk-item-type">${TYPE_LABEL[it.type]}</span>` : ''}
          </div>`).join('')
        : `<div class="cmdk-empty">${t('cmdk.empty')}</div>`;
      updateActive();
      list.querySelectorAll('.cmdk-item').forEach(el => {
        el.addEventListener('click', () => { filtered[Number(el.dataset.i)]?.go(); this.close(); });
        el.addEventListener('mouseenter', () => { selected = Number(el.dataset.i); updateActive(); });
      });
    };

    this.el.innerHTML = `<div class="modal cmdk">
      <div class="cmdk-input-row">
        <span class="cmdk-search-ic">${ICON.search}</span>
        <input id="cmdk-input" type="text" placeholder="${t('cmdk.placeholder')}" autocomplete="off">
      </div>
      <div id="cmdk-list" class="cmdk-list"></div>
      <div class="cmdk-hint">${t('cmdk.hint')}</div>
    </div>`;

    renderList();
    const input = this.el.querySelector('#cmdk-input');
    input.addEventListener('input', () => {
      filtered = search(input.value.toLowerCase().trim());
      selected = 0;
      renderList();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected + 1, filtered.length - 1); updateActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(selected - 1, 0); updateActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[selected]?.go(); this.close(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    requestAnimationFrame(() => { this.el.classList.add('show'); input.focus(); });
  },
};

/* ============================================================
   v0.12 Bloque A — selección múltiple + borrado en lote (reusable)
   Una sola implementación para runs/tasks/instincts/memory/specs — el
   endpoint bulk-delete difiere por recurso, la UI (checkboxes + barra
   flotante + modal de confirmación) es idéntica en las 5 pantallas.
   ============================================================ */

function bulkSet(screen) { return state.bulkSelected[screen]; }

function bulkToggle(screen, id) {
  const s = bulkSet(screen);
  s.has(id) ? s.delete(id) : s.add(id);
  App.rerender();
}

function bulkToggleAll(screen, ids) {
  const s = bulkSet(screen);
  const allSelected = ids.length > 0 && ids.every(id => s.has(id));
  if (allSelected) ids.forEach(id => s.delete(id));
  else ids.forEach(id => s.add(id));
  App.rerender();
}

function bulkClear(screen) {
  bulkSet(screen).clear();
  App.rerender();
}

/** Barra flotante — solo se renderiza si hay selección activa en ese screen. */
function renderBulkBar(screen, resourceLabel) {
  const n = bulkSet(screen).size;
  if (n === 0) return '';
  return `<div class="bulk-bar" data-bulk-screen="${screen}">
    <span class="bulk-count">${t('bulk.selected', n)}</span>
    <span class="bulk-spacer"></span>
    <button class="btn ghost sm" data-bulk-clear="${screen}">${t('bulk.clear')}</button>
    <button class="btn danger sm" data-bulk-delete="${screen}">${ICON.trash || ''} ${t('bulk.delete', resourceLabel)}</button>
  </div>`;
}

/**
 * Wiring compartido de checkboxes + barra para una tabla ya renderizada.
 * `root` = contenedor del screen, `screen` = key en state.bulkSelected,
 * `endpoint` = URL del bulk-delete, `refetch` = función async que recarga
 * los datos de ese recurso, `resourceLabel` = plural para el copy de
 * confirmación (ej. "tasks"). Los ids se leen del DOM ya renderizado (no se
 * piden como parámetro) — así "seleccionar todo" siempre respeta el filtro/
 * tab activo del screen sin que cada pantalla tenga que duplicar su propia
 * lógica de filtrado acá.
 */
function wireBulkSelect(root, screen, endpoint, refetch, resourceLabel) {
  const visibleIds = () => [...root.querySelectorAll(`[data-bulk-row="${screen}"]`)].map(cb => cb.dataset.bulkId);
  root.querySelectorAll(`[data-bulk-row="${screen}"]`).forEach(cb => {
    cb.addEventListener('click', e => e.stopPropagation());
    cb.addEventListener('change', e => {
      e.stopPropagation();
      bulkToggle(screen, cb.dataset.bulkId);
    });
  });
  root.querySelector(`[data-bulk-all="${screen}"]`)?.addEventListener('click', e => e.stopPropagation());
  root.querySelector(`[data-bulk-all="${screen}"]`)?.addEventListener('change', e => {
    e.stopPropagation();
    bulkToggleAll(screen, visibleIds());
  });
  root.querySelector(`[data-bulk-clear="${screen}"]`)?.addEventListener('click', () => bulkClear(screen));
  root.querySelector(`[data-bulk-delete="${screen}"]`)?.addEventListener('click', async () => {
    const selected = [...bulkSet(screen)];
    if (selected.length === 0) return;
    const ok = await Modal.confirm(
      t('bulk.confirm.title', selected.length, resourceLabel),
      t('bulk.confirm.body'),
      t('bulk.confirm.btn', selected.length, resourceLabel),
    );
    if (!ok) return;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(t('bulk.done', data.deleted ?? selected.length));
        bulkClear(screen);
        await refetch();
        App.rerender();
      } else {
        showToast(data.error || t('bulk.err'), 'error');
      }
    } catch {
      showToast(t('bulk.err'), 'error');
    }
  });
}

/* ============================================================
   Shared model selector helpers (chat + tasks)
   ============================================================ */

/* Builds <optgroup> / <option> HTML for the model selector.
   Locals always first, then cloud. Optionally filtered by query string. */
function buildModelOpts(locals, cloudModels, val, query) {
  const q = (query || '').toLowerCase().trim();
  const matchLocal = locals.filter(m => !q || m.id.toLowerCase().includes(q));
  const matchCloud = cloudModels.filter(m =>
    !q || m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q)
  );
  let html = '';
  if (matchLocal.length > 0) {
    html += `<optgroup label="${esc(t('chat.local.group'))}">${matchLocal.map(m =>
      `<option value="${esc(m.id)}" ${m.id === val ? 'selected' : ''}>${esc(m.id.replace('ollama/', ''))} — ${t('chat.local.free')}</option>`
    ).join('')}</optgroup>`;
  }
  if (matchCloud.length > 0) {
    const grpLabel = matchLocal.length > 0 ? ` label="${esc(t('chat.cloud.group'))}"` : '';
    html += `<optgroup${grpLabel}>${matchCloud.map(m =>
      `<option value="${esc(m.id)}" ${m.id === val ? 'selected' : ''}>${esc(m.name || m.id)} — $${m.priceIn.toFixed(2)}/M</option>`
    ).join('')}</optgroup>`;
  }
  if (!html) html = `<option disabled>${esc(q ? 'No results' : t('common.loading'))}</option>`;
  return html;
}

/* Searchable model picker — trigger button + search-inside dropdown panel,
   same interaction pattern as buildModelCombo() (chat) but generalized to any
   caller via `inputId`/state.modelComboOpenKey instead of a single hardcoded
   field. Rewritten 2026-07-08: the previous version rendered a native
   <select> with every OpenRouter model as an unfiltered <option> wall (100s
   of entries, no way to search) — reported directly by Carlos as a concrete
   symptom of not reusing the app's own existing patterns (buildModelCombo
   already solved this for chat). Kept the exact same external contract
   (same `inputId`, value still readable via `document.getElementById(id).value`
   through a hidden input) so every existing caller (draft composer, diagnose
   panel, Settings→Model routing roles, create-task modal) needed zero changes
   at the call site — only this function's internals changed.
   opts.allowEmpty (QA role): currentVal vacío no cae al default
   'deepseek/deepseek-v4-flash' — se antepone una opción real vacía
   (opts.emptyLabel) que representa "sin configurar" de verdad. */
function buildModelSelect(inputId, currentVal, models, localModels, opts) {
  const allowEmpty = !!(opts && opts.allowEmpty);
  const isEmptyVal = allowEmpty && !currentVal;
  const val = currentVal || (allowEmpty ? '' : 'deepseek/deepseek-v4-flash');
  const locals = Array.isArray(localModels) && localModels.length > 0 ? localModels : [];
  const isLoading = Array.isArray(models) && models.length === 0;
  const cloudSource = models === null ? KNOWN_MODELS.map(m => ({ ...m })) : (Array.isArray(models) ? models : []);
  const allCloud = (!val || models === null || cloudSource.some(m => m.id === val))
    ? cloudSource
    : [{ id: val, name: val, priceIn: 0 }, ...cloudSource];
  const label = isLoading
    ? t('common.loading')
    : (isEmptyVal ? ((opts && opts.emptyLabel) || '—') : modelLabelFor(val, allCloud));
  const isOpen = state.modelComboOpenKey === inputId && !isLoading;
  const emptyOption = allowEmpty
    ? `<div class="model-combo-option${isEmptyVal ? ' active' : ''}" data-combo-option data-value="">${esc((opts && opts.emptyLabel) || '—')}</div>`
    : '';
  const panel = isOpen
    ? `<div class="model-combo-panel" data-combo-panel>
        <input type="text" class="model-combo-search" data-combo-search placeholder="${t('chat.models.search')}" autocomplete="off">
        <div class="model-combo-list" data-combo-list>${emptyOption}${buildComboOptions(locals, allCloud, val, '')}</div>
      </div>`
    : '';
  return `<div class="model-combo${isOpen ? ' open' : ''}" data-model-combo data-combo-id="${esc(inputId)}">
    <input type="hidden" id="${esc(inputId)}" value="${esc(val)}">
    <button type="button" class="model-combo-trigger" data-combo-trigger ${isLoading ? 'disabled' : ''}>
      <span class="model-combo-label">${esc(label)}</span>
      ${ICON.chev}
    </button>
    ${panel}
  </div>`;
}

/* FRONT.6 — display label for a model id: locals (Ollama) first, then the
   loaded cloud list if present, falling back to the curated KNOWN_MODELS list,
   and finally the raw id itself if nowhere found. */
function modelLabelFor(val, cloudPool) {
  if (val.startsWith('ollama/')) return `${val.replace('ollama/', '')} — ${t('chat.local.free')}`;
  const pool = Array.isArray(cloudPool) && cloudPool.length > 0 ? cloudPool : KNOWN_MODELS;
  const hit = pool.find(m => m.id === val);
  return hit ? (hit.name || hit.id) : val;
}

/* FRONT.6 — option list HTML for the chat model combobox panel (locals + cloud
   groups, filtered by query). Same matching rules as the old buildModelOpts,
   rendered as plain divs instead of <option> so it can live inside a custom
   dropdown panel instead of a native <select>. */
function buildComboOptions(locals, cloudModels, val, query) {
  const q = (query || '').toLowerCase().trim();
  const matchLocal = locals.filter(m => !q || m.id.toLowerCase().includes(q));
  const matchCloud = cloudModels.filter(m =>
    !q || m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q)
  );
  let html = '';
  if (matchLocal.length > 0) {
    html += `<div class="model-combo-group-label">${esc(t('chat.local.group'))}</div>` +
      matchLocal.map(m => `<div class="model-combo-option${m.id === val ? ' active' : ''}" data-combo-option data-value="${esc(m.id)}">
        <span class="model-combo-opt-name">${esc(m.id.replace('ollama/', ''))}</span>
        <span class="model-combo-price">${esc(t('chat.local.free'))}</span>
      </div>`).join('');
  }
  if (matchCloud.length > 0) {
    if (matchLocal.length > 0) html += `<div class="model-combo-group-label">${esc(t('chat.cloud.group'))}</div>`;
    html += matchCloud.map(m => `<div class="model-combo-option${m.id === val ? ' active' : ''}" data-combo-option data-value="${esc(m.id)}">
      <span class="model-combo-opt-name">${esc(m.name || m.id)}</span>
      <span class="model-combo-price">$${m.priceIn.toFixed(2)}/M</span>
    </div>`).join('');
  }
  if (!html) html = `<div class="model-combo-empty">${esc(q ? 'No results' : t('common.loading'))}</div>`;
  return html;
}

/* 2026-07-13 (corrección de Carlos) — pill único modelo+esfuerzo en el
   composer del chat (antes: combobox de modelo + <select> de esfuerzo, dos
   controles separados arriba de la pantalla). Un solo trigger ("DeepSeek V4
   · Medium ⌄") abre un menú de 2 niveles:
   - root: filas "Model >" / "Effort >" / "Reset to default"
   - model: reusa buildComboOptions() (mismo buscador que ya existía, la
     regla de [[reference-model-combo-pattern]] sigue intacta — nunca un
     <select> nativo con la lista completa sin buscador)
   - effort: 3 opciones con checkmark en la seleccionada (estilo del menú de
     Claude Code/Codex que trajo Carlos como referencia)
   `st.chatFxView` (null|'root'|'model'|'effort') controla cuál se muestra. */
function shortModelLabel(val, cloudPool) {
  const full = modelLabelFor(val, cloudPool);
  // OpenRouter nombra los modelos "Vendor: Model Name" — el prefijo del vendor
  // es redundante en el pill compacto del composer (ya se sabe por el ícono/
  // contexto), y sin recortarlo "DeepSeek: DeepSeek V4 Flash" se comía casi
  // todo el ancho disponible antes de llegar al esfuerzo.
  const withoutVendor = full.includes(': ') ? full.slice(full.indexOf(': ') + 2) : full;
  return withoutVendor.length > 18 ? withoutVendor.slice(0, 16) + '…' : withoutVendor;
}

function buildChatModelFx(st) {
  const val = st.chatModel || 'deepseek/deepseek-v4-flash';
  const locals = Array.isArray(st.localModels) && st.localModels.length > 0 ? st.localModels : [];
  const isLoading = Array.isArray(st.orModels) && st.orModels.length === 0;
  const cloudSource = st.orModels === null ? KNOWN_MODELS.map(m => ({ ...m })) : (Array.isArray(st.orModels) ? st.orModels : []);
  const allCloud = (st.orModels === null || cloudSource.some(m => m.id === val))
    ? cloudSource
    : [{ id: val, name: val, priceIn: 0 }, ...cloudSource];
  const modelLabel = isLoading ? t('common.loading') : shortModelLabel(val, allCloud);
  const effortAvailable = modelSupportsReasoning(val, st.orModels);
  const effortLabel = effortAvailable ? t('chat.effort.' + (st.chatEffort || 'medium')) : null;
  const triggerLabel = effortLabel ? `${modelLabel} · ${effortLabel}` : modelLabel;

  const view = st.chatFxView; // null | 'root' | 'model' | 'effort'
  let panel = '';
  if (view === 'root') {
    panel = `<div class="chat-modelfx-panel" data-modelfx-panel>
      <button type="button" class="chat-modelfx-item" data-modelfx-nav="model">
        <span class="k">${t('chat.modelfx.model')}</span>
        <span class="v">${esc(modelLabel)}</span>${ICON.chevR}
      </button>
      ${effortAvailable ? `<button type="button" class="chat-modelfx-item" data-modelfx-nav="effort">
        <span class="k">${t('chat.effort.label')}</span>
        <span class="v">${esc(effortLabel)}</span>${ICON.chevR}
      </button>` : ''}
      <div class="chat-modelfx-sep"></div>
      <button type="button" class="chat-modelfx-item chat-modelfx-reset" data-modelfx-reset>
        ${ICON.refresh}<span>${t('chat.modelfx.reset')}</span>
      </button>
    </div>`;
  } else if (view === 'model') {
    panel = `<div class="chat-modelfx-panel chat-modelfx-panel-wide" data-modelfx-panel>
      <button type="button" class="chat-modelfx-back" data-modelfx-back>${ICON.chevR}${t('chat.modelfx.back')}</button>
      <input type="text" class="model-combo-search" data-combo-search placeholder="${t('chat.models.search')}" autocomplete="off">
      <div class="model-combo-list" data-combo-list>${buildComboOptions(locals, allCloud, val, '')}</div>
    </div>`;
  } else if (view === 'effort') {
    panel = `<div class="chat-modelfx-panel" data-modelfx-panel>
      <button type="button" class="chat-modelfx-back" data-modelfx-back>${ICON.chevR}${t('chat.modelfx.back')}</button>
      ${['low', 'medium', 'high'].map(v => `<button type="button" class="chat-modelfx-item chat-modelfx-effort-opt${st.chatEffort === v ? ' active' : ''}" data-modelfx-effort="${v}">
        <span>${t('chat.effort.' + v)}</span>${st.chatEffort === v ? ICON.check : ''}
      </button>`).join('')}
    </div>`;
  }

  return `<div class="chat-modelfx${view ? ' open' : ''}" data-modelfx>
    <button type="button" class="chat-modelfx-trigger" data-modelfx-trigger ${isLoading ? 'disabled' : ''}>
      <span class="chat-modelfx-label">${esc(triggerLabel)}</span>${ICON.chev}
    </button>
    ${panel}
  </div>`;
}

/* FRONT.1 — true solo si `models` (state.orModels, datos reales de OpenRouter)
   tiene una entrada para modelId con supportsReasoning:true. Nunca asume
   soporte sin dato real (fallback KNOWN_MODELS/locals no lo declaran). */
function modelSupportsReasoning(modelId, models) {
  if (!Array.isArray(models)) return false;
  return !!models.find(m => m.id === modelId)?.supportsReasoning;
}

async function loadOrModels(force = false) {
  const now = Date.now();
  if (!force && state.orModels && state.orModels.length > 0) {
    if (state.orModelsLastFetch && (now - state.orModelsLastFetch) < 3600000) return;
  }
  state.orModels = [];
  try {
    const res = await fetch('/api/chat/models');
    if (res.ok) {
      state.orModels = await res.json();
      state.orModelsLastFetch = Date.now();
    } else {
      state.orModels = null;
    }
  } catch {
    state.orModels = null;
  } finally {
    state.orModelsAttempted = true;
  }
}

async function loadLocalModels() {
  if (state.localModels !== null) return;
  try {
    const res = await fetch('/api/providers/local');
    if (res.ok) {
      const data = await res.json();
      state.localModels = data.available ? data.models : [];
    } else {
      state.localModels = [];
    }
  } catch {
    state.localModels = [];
  }
}

/* ============================================================
   Nav builder — called on boot and on mode toggle
   ============================================================ */
function applySidebarMode() {
  const expanded = localStorage.getItem('orchestos-sidebar') === 'expanded';
  document.querySelector('.app').dataset.sidebar = expanded ? 'expanded' : 'collapsed';
  return expanded;
}

function buildNav() {
  const mode = localStorage.getItem('orchestos-mode') || 'normal';
  const isAdv = mode === 'advanced';
  const side = document.getElementById('sidebar');

  const mainNav = NAV.filter(n => n.id !== 'settings');
  const bottomNav = NAV.filter(n => n.id === 'settings');

  const navItem = n => {
    if (n.operator && !isAdv) return '';
    const badge = n.operator ? '<span class="nav-adv-badge">adv</span>' : '';
    const countBadge = n.badge ? `<span class="nav-count-badge" data-count="${n.id}">0</span>` : '';
    const cls = n.operator ? ' operator' : '';
    return `<div class="nav-icon${cls}" data-nav="${n.id}" data-tip="${t(n.key)}" role="button" tabindex="0">
      <span class="nav-ic">${n.icon}${badge}${countBadge}</span>
      <span class="nav-label">${t(n.key)}</span>
    </div>`;
  };

  const tipKey = isAdv ? 'nav.mode.disable' : 'nav.mode.enable';
  const modeBtn = `<div class="nav-icon nav-mode-btn${isAdv ? ' active' : ''}" id="navModeBtn" data-tip="${t(tipKey)}" role="button" tabindex="0">
    <span class="nav-ic">${ICON.sliders}</span>
    <span class="nav-label">${t(tipKey)}</span>
  </div>`;

  // 2026-07-13 (corrección de Carlos, ronda 2) — sin logo: solo el texto
  // "OrchestOS" totalmente a la izquierda, y search+collapse a la derecha
  // en la MISMA fila (nunca muestran label, solo ícono+tooltip — por eso no
  // usan `.nav-icon`/`.nav-label`, tienen su propia clase `.sidebar-toprow-btn`
  // así no heredan la regla que oculta el tooltip cuando el sidebar expande).
  // Colapsado: el texto y el botón de search desaparecen (CSS), solo queda
  // panel-left, centrado.
  const sbExpanded = document.querySelector('.app').dataset.sidebar === 'expanded';
  const kbdHint = navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K';
  const toprow = `<div class="sidebar-toprow">
    <b class="sidebar-brand-text">Orchest<span>OS</span></b>
    <div class="sidebar-toprow-icons">
      <div class="sidebar-toprow-btn sidebar-search-btn" id="navSearchBtn" data-tip="${t('nav.search')} (${kbdHint})" role="button" tabindex="0">${ICON.search}</div>
      <div class="sidebar-toprow-btn" id="navCollapseBtn" data-tip="${t(sbExpanded ? 'nav.sidebar.collapse' : 'nav.sidebar.expand')}" role="button" tabindex="0">${ICON.panelLeft}</div>
    </div>
  </div>`;

  side.innerHTML = toprow + '<div class="nav-sep"></div>' + mainNav.map(navItem).join('') +
    '<div class="grow"></div>' + modeBtn + bottomNav.map(navItem).join('');

  if (isAdv) {
    requestAnimationFrame(() => {
      side.querySelectorAll('.nav-icon.operator').forEach(el => el.classList.add('visible'));
    });
  }

  side.querySelectorAll('.nav-icon[data-nav]').forEach(n =>
    n.addEventListener('click', () => App.go(n.dataset.nav)));

  side.querySelectorAll('.nav-icon[role="button"], .sidebar-toprow-btn[role="button"]').forEach(n =>
    n.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); n.click(); }
    }));

  document.getElementById('navModeBtn').addEventListener('click', () => {
    const cur = localStorage.getItem('orchestos-mode') || 'normal';
    const next = cur === 'advanced' ? 'normal' : 'advanced';
    localStorage.setItem('orchestos-mode', next);
    if (next === 'normal') {
      const opIds = NAV.filter(n => n.operator).map(n => n.id);
      if (opIds.includes(state.screen)) App.go('chat');
    }
    buildNav();
    App.syncNav();
  });

  document.getElementById('navSearchBtn').addEventListener('click', () => Modal.openCommandPalette());

  document.getElementById('navCollapseBtn').addEventListener('click', () => {
    const appEl = document.querySelector('.app');
    const next = appEl.dataset.sidebar === 'expanded' ? 'collapsed' : 'expanded';
    appEl.dataset.sidebar = next;
    localStorage.setItem('orchestos-sidebar', next);
    buildNav();
    App.syncNav();
  });
}

/* ============================================================
   Header icons — solo el grupo derecho (explorer/terminal/diff/panel-right).
   panel-left+search viven en el sidebar ahora (2026-07-13, corrección de
   Carlos) — ver buildNav().
   ============================================================ */
function headerIconBtn(id, icon, tipKey, active) {
  return `<div class="header-icon-btn${active ? ' active' : ''}" id="${id}" data-tip="${t(tipKey)}" role="button" tabindex="0">${icon}</div>`;
}

function buildHeaderIcons() {
  const right = document.getElementById('headerRightIcons');
  if (!right) return;

  const rpOpen = state.rightPanelOpen;
  const tab = state.rightPanelTab;
  right.innerHTML =
    headerIconBtn('rpTabExplorer', ICON.folder, 'rp.tab.explorer', rpOpen && tab === 'explorer') +
    headerIconBtn('rpTabTerminal', ICON.term, 'rp.tab.terminal', rpOpen && tab === 'terminal') +
    headerIconBtn('rpTabDiff', ICON.diff, 'rp.tab.diff', rpOpen && tab === 'diff') +
    headerIconBtn('headerRightPanelToggle', ICON.panelRight, rpOpen ? 'rp.toggle.close' : 'rp.toggle.open', rpOpen);

  const openTab = tabName => {
    if (state.rightPanelOpen && state.rightPanelTab === tabName) {
      state.rightPanelOpen = false;
    } else {
      state.rightPanelOpen = true;
      state.rightPanelTab = tabName;
    }
    localStorage.setItem('orchestos-rightpanel', state.rightPanelOpen ? 'expanded' : 'collapsed');
    localStorage.setItem('orchestos-rightpanel-tab', state.rightPanelTab);
    syncRightPanel();
  };
  document.getElementById('rpTabExplorer').addEventListener('click', () => openTab('explorer'));
  document.getElementById('rpTabTerminal').addEventListener('click', () => openTab('terminal'));
  document.getElementById('rpTabDiff').addEventListener('click', () => openTab('diff'));
  document.getElementById('headerRightPanelToggle').addEventListener('click', () => {
    state.rightPanelOpen = !state.rightPanelOpen;
    localStorage.setItem('orchestos-rightpanel', state.rightPanelOpen ? 'expanded' : 'collapsed');
    syncRightPanel();
  });

  right.querySelectorAll('[role="button"]').forEach(n =>
    n.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); n.click(); }
    }));
}

/** Aplica el estado abierto/cerrado + tab activa del panel derecho al DOM. */
function syncRightPanel() {
  document.querySelector('.app').dataset.rightpanel = state.rightPanelOpen ? 'expanded' : 'collapsed';
  buildHeaderIcons();
  if (state.rightPanelOpen) RightPanel.render();
}

/* ============================================================
   Resize handles — sidebar (expandido) y panel derecho (2026-07-13,
   corrección de Carlos): ambos ajustables arrastrando, con un piso = el
   ancho por defecto de cada uno (nunca más angosto que lo que ya ships hoy)
   y un techo distinto — el derecho puede crecer bastante más porque ahí se
   lee diff/código, el izquierdo solo lleva íconos+labels cortos.
   ============================================================ */
function wireResizeHandle(handle, opts) {
  // opts: { min, max, sign (1 arrastra-derecha-agranda, -1 arrastra-izquierda-agranda),
  //         cssVar, target, storageKey }
  if (!handle) return;
  let dragging = false, startX = 0, startW = 0;

  const onMove = e => {
    if (!dragging) return;
    const delta = (e.clientX - startX) * opts.sign;
    const w = Math.max(opts.min, Math.min(opts.max, Math.round(startW + delta)));
    opts.target.style.setProperty(opts.cssVar, w + 'px');
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.classList.remove('resizing-ew');
    const current = getComputedStyle(opts.target).getPropertyValue(opts.cssVar).trim();
    if (current) localStorage.setItem(opts.storageKey, current.replace('px', ''));
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  // mousedown/mousemove/mouseup en vez de Pointer Events — más compatible
  // con automatización de browser (CDP no siempre dispara pointer events) y
  // funciona igual para mouse/trackpad real.
  handle.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.clientX;
    startW = parseInt(getComputedStyle(opts.target).getPropertyValue(opts.cssVar), 10) || opts.min;
    handle.classList.add('dragging');
    document.body.classList.add('resizing-ew');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
}

/** Restaura los anchos guardados (localStorage) ANTES del primer paint del grid. */
function applyResizedWidths() {
  const appEl = document.querySelector('.app');
  const SIDEBAR_MIN = 200, RIGHTPANEL_MIN = 360;
  const sw = parseInt(localStorage.getItem('orchestos-sidebar-width'), 10);
  if (sw >= SIDEBAR_MIN) appEl.style.setProperty('--sidebar-w-exp', sw + 'px');
  const rw = parseInt(localStorage.getItem('orchestos-rightpanel-width'), 10);
  if (rw >= RIGHTPANEL_MIN) appEl.style.setProperty('--rightpanel-w', rw + 'px');
}

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  // Sidebar collapsed/expanded mode (persisted)
  applySidebarMode();
  applyResizedWidths();

  // Build sidebar (brand + panel-left + search + nav) + header icons
  // (explorer/terminal/diff/panel-right) — 2026-07-13, corrección de Carlos.
  buildNav();
  buildHeaderIcons();

  // Panel derecho: aplica el estado persistido (localStorage) al primer render.
  document.querySelector('.app').dataset.rightpanel = state.rightPanelOpen ? 'expanded' : 'collapsed';
  if (state.rightPanelOpen) RightPanel.render();

  // Resize handles — piso = ancho por defecto de cada uno, techo distinto
  // (el derecho puede crecer más: ahí se lee diff/código).
  wireResizeHandle(document.getElementById('sidebarResizeHandle'), {
    min: 200, max: 320, sign: 1,
    cssVar: '--sidebar-w-exp', target: document.querySelector('.app'),
    storageKey: 'orchestos-sidebar-width',
  });
  wireResizeHandle(document.getElementById('rightpanelResizeHandle'), {
    min: 360, max: 720, sign: -1,
    cssVar: '--rightpanel-w', target: document.querySelector('.app'),
    storageKey: 'orchestos-rightpanel-width',
  });

  // Panels
  SidePanel.init();
  Modal.init();

  // Command palette (Cmd/Ctrl+K)
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      Modal.openCommandPalette();
    }
  });

  // FRONT.9 / 2026-07-13 — close the chat modelfx pill / attach menu on outside
  // click. Registered once here (not inside SCREENS.chat.wire(), which
  // reruns on every rerender) so it never stacks duplicate listeners.
  document.addEventListener('click', e => {
    if (state.chatFxView && !e.target.closest('[data-modelfx]')) {
      state.chatFxView = null;
      App.rerender();
    }
    if (state.chatAttachMenuOpen && !e.target.closest('[data-attach-menu]')) {
      state.chatAttachMenuOpen = false;
      App.rerender();
    }
  });

  // 2026-07-08 — generic wiring for every buildModelSelect() instance (draft
  // composer, diagnose panel, Settings→Model routing roles, create-task
  // modal). Registered once here, delegated on document — same reasoning as
  // the block above: these widgets can appear multiple times on one screen
  // (5 role selects in Model routing), so per-instance querySelector-based
  // wiring inside a screen's wire() would only ever bind the first one.
  // rerenderCurrentContext() picks App.rerender() for #main-scoped screens or
  // re-invokes the modal's own open function when the combo lives inside it
  // (Modal doesn't participate in App.rerender(), it redraws via innerHTML
  // directly in each openX() method).
  function rerenderCurrentContext(target) {
    if (target.closest('.modal-scrim')) { Modal.openTask(); return; }
    App.rerender();
  }
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-combo-trigger]');
    if (trigger) {
      e.stopPropagation();
      const wrap = trigger.closest('[data-model-combo]');
      const id = wrap && wrap.dataset.comboId;
      if (!id) return;
      const opening = state.modelComboOpenKey !== id;
      state.modelComboOpenKey = opening ? id : null;
      rerenderCurrentContext(trigger);
      if (opening) loadOrModels().then(() => { if (state.modelComboOpenKey === id) rerenderCurrentContext(trigger); });
      return;
    }
    const option = e.target.closest('[data-combo-option]');
    if (option && option.closest('[data-model-combo]')) {
      const wrap = option.closest('[data-model-combo]');
      const id = wrap.dataset.comboId;
      const hidden = id ? document.getElementById(id) : null;
      if (hidden) hidden.value = option.dataset.value;
      state.modelComboOpenKey = null;
      rerenderCurrentContext(option);
      return;
    }
    if (state.modelComboOpenKey && !e.target.closest('[data-model-combo]')) {
      state.modelComboOpenKey = null;
      rerenderCurrentContext(e.target);
    }
  });
  document.addEventListener('input', e => {
    const search = e.target.closest('[data-combo-search]');
    if (!search) return;
    const wrap = search.closest('[data-model-combo]');
    const list = wrap && wrap.querySelector('[data-combo-list]');
    if (!wrap || !list) return;
    const allCloud = Array.isArray(state.orModels) && state.orModels.length > 0 ? state.orModels : KNOWN_MODELS;
    const locals = Array.isArray(state.localModels) && state.localModels.length > 0 ? state.localModels : [];
    const hiddenId = wrap.dataset.comboId;
    const hidden = hiddenId ? document.getElementById(hiddenId) : null;
    list.innerHTML = buildComboOptions(locals, allCloud, hidden ? hidden.value : '', search.value);
  });

  // 2026-07-08 (Impeccable audit G.2, P1) — filas clicables de tabla
  // (Tasks/Runs/Specs, todas `tabindex="0"`) no tenían forma de abrirse con
  // teclado — Enter/Espacio no hacía nada pese a poder enfocarlas con Tab.
  // Mismo patrón que el sidebar (`[role="button"]` + keydown), delegado una
  // sola vez acá para cubrir las 3 tablas sin wiring por pantalla.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('tr[data-task], tr[data-run], tr[data-spec]');
    if (!row) return;
    e.preventDefault();
    row.click();
  });

  // First render with loading state, then fetch
  App.rerender();
  App.fetchAll();

  // Auto-refresh every 30s
  setInterval(() => App.fetchAll(), 30_000);
}

/** Simple toast notification — auto-dismisses after 3s */
function showToast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('show'); }, 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', boot);
