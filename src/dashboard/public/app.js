/* ============================================================
   OrchestOS — app shell, navigation, panels, API fetching
   ============================================================ */

const state = {
  screen: 'tasks',
  memScope: 'all',
  openRun: null,
  openSpec: null,
  openDiagnose: null,
  diagnoseCache: {},
  archOpen: false,

  runs: [],
  tasks: [],
  instincts: [],
  specs: [],
  memory: [],
  settings: null,
  setup: null,
  health: null,

  runsStatus: 'loading',
  tasksStatus: 'loading',
  instinctsStatus: 'loading',
  specsStatus: 'loading',
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

  projectTab: 'constitution',
  constitutionContent: null,
  contextContent: null,
  constitutionStatus: 'idle',
  contextStatus: 'idle',
  projectSaveState: 'idle',  // 'idle' | 'saving' | 'saved' | 'error'

  chatHistory: [],
  chatPending: false,
  chatModel: 'deepseek/deepseek-v4-flash',
  chatFileId: null,
  chatFileMeta: null,  // { filename, type, preview } from upload
  chatToTask: null,   // non-null = condensed chat text to pre-fill compose bar
  orModels: null,   // null = not fetched, [] = loading, [...] = loaded (shared: chat + tasks)
  localModels: null, // null = not checked, [] = none available, [...] = Ollama models

};

const NAV = [
  { id: 'tasks',     icon: ICON.tasks,    key: 'nav.tasks' },
  { id: 'runs',      icon: ICON.runs,     key: 'nav.runs',     operator: true },
  { id: 'memory',    icon: ICON.memory,   key: 'nav.memory',   operator: true },
  { id: 'project',   icon: ICON.project,  key: 'nav.project' },
  { id: 'instincts', icon: ICON.instinct, key: 'nav.instincts' },
  { id: 'specs',     icon: ICON.specs,    key: 'nav.specs',    operator: true },
  { id: 'settings',  icon: ICON.settings, key: 'nav.settings' },
  { id: 'chat',      icon: ICON.chat,     key: 'nav.chat' },
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
    this.rerender();
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
  async fetchMemory() {
    try {
      const res = await fetch('/api/memory');
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
  async fetchAll() {
    await Promise.all([
      this.fetchRuns(),
      this.fetchTasks(),
      this.fetchInstincts(),
      this.fetchSpecs(),
      this.fetchMemory(),
      this.fetchSettings(),
      this.fetchSetup(),
      this.fetchHealth(),
    ]);
    if (!state.setupRedirectDone && state.setup?.criticalMissing) {
      state.screen = 'settings';
      state.setupRedirectDone = true;
    }
    // C4/F5 — adaptive startup: Control Center if attention, else mode-aware default
    if (!state.attentionRedirectDone && !state.setup?.criticalMissing && state.health) {
      const costThreshold = parseFloat(localStorage.getItem('orchestos-cost-threshold') || '0.50');
      const hasAttention = state.health.attentionCount > 0 || state.health.costLast7d > costThreshold;
      if (hasAttention) {
        state.screen = 'settings'; // Control Center — priority in both modes
      } else {
        // F5 — advanced mode starts on Runs (familiar for the dev); normal mode stays on Tasks
        const mode = localStorage.getItem('orchestos-mode') || 'normal';
        if (mode === 'advanced') state.screen = 'runs';
      }
      state.attentionRedirectDone = true;
    }
    this.rerender();
    Term.render();
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

  rerender() {
    const main = document.getElementById('main');
    const sc = SCREENS[state.screen];
    main.innerHTML = sc.render(state);
    sc.wire(main, state);
    this.syncHeader();
    this.syncNav();
  },
  go(id) {
    // stop auto-refresh when leaving Runs or Settings
    if (SCREENS.runs._timer) { clearInterval(SCREENS.runs._timer); SCREENS.runs._timer = null; }
    if (SCREENS.settings._timer) { clearInterval(SCREENS.settings._timer); SCREENS.settings._timer = null; }
    state.screen = id;
    state.openRun = null; state.openSpec = null;
    // lazy-load project content on first visit
    if (id === 'project') {
      const tab = state.projectTab || 'constitution';
      if (tab === 'constitution' && state.constitutionStatus === 'idle') {
        this.fetchConstitution().then(() => this.rerender());
      } else if (tab === 'context' && state.contextStatus === 'idle') {
        this.fetchContext().then(() => this.rerender());
      }
    }
    this.rerender();
  },
  syncNav() {
    document.querySelectorAll('.nav-icon').forEach(n =>
      n.classList.toggle('active', n.dataset.nav === state.screen));
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
   Terminal footer — shows recent runs
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
      const ts = (r.createdAt || '').slice(0, 19);
      return `<div class="ln ${cls}">${sym}  ${esc(r.id)}${task}  ${esc(r.model)}${qa}${cost}  <span class="dim">${esc(ts)}</span></div>`;
    }).join('');
  },
  toggle() { document.getElementById('terminal').classList.toggle('collapsed'); },
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
      </div>
      <div class="sp-foot">
        <span class="muted" style="font-size:12px;flex:1">${t2('panel.cli.hint')} <span class="mono">orchestos task run --id ${esc(t.id)}</span></span>
        <button class="btn danger sm sp-delete" style="margin-left:8px">${ICON.trash}</button>
      </div>`;
    this.el.querySelector('.sp-close').addEventListener('click', () => this.close());
    this.el.querySelector('.sp-delete').addEventListener('click', async () => {
      if (!confirm(`Delete task "${t.id}"? This cannot be undone.`)) return;
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(t.id)}`, { method: 'DELETE' });
        if (res.ok) { this.close(); await App.fetchTasks(); App.rerender(); }
        else { const e = await res.json(); alert(e.error || 'Delete failed'); }
      } catch { alert('Connection error'); }
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
    this.el.querySelector('[data-load-models]')?.addEventListener('click', async () => {
      await loadOrModels();
      this.openTask();
    });

    // Auto-load if not yet fetched
    if (state.orModels === null) {
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
};

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

/* Returns HTML for a model selector widget.
   withSearch=true adds a filter input (used in chat; skipped in draft/modal).
   If orModels is null → fallback list + load button.
   If orModels is [] → loading spinner text. */
function buildModelSelect(inputId, currentVal, models, localModels, withSearch) {
  const val = currentVal || 'deepseek/deepseek-v4-flash';
  const locals = Array.isArray(localModels) && localModels.length > 0 ? localModels : [];

  if (models === null) {
    // Fallback: KNOWN_MODELS + any locals already available
    const fallbackCloud = KNOWN_MODELS.map(m => ({ ...m }));
    const opts = buildModelOpts(locals, fallbackCloud, val, '');
    return `<div style="display:flex;gap:8px;align-items:center">
      <select id="${inputId}" class="model-sel">${opts}</select>
      <button class="btn ghost sm" data-load-models style="white-space:nowrap">${t('chat.models.load')} ↓</button>
    </div>`;
  }
  if (models.length === 0) {
    return `<span class="muted" style="font-size:12px">${t('common.loading')}</span>`;
  }
  // Ensure current value is present even if not returned by OpenRouter
  const allCloud = models.some(m => m.id === val) ? models : [{ id: val, name: val, priceIn: 0 }, ...models];
  const opts = buildModelOpts(locals, allCloud, val, '');
  if (withSearch) {
    return `<div class="model-select-wrap">
      <input type="text" class="model-search" data-model-search placeholder="${t('chat.models.search')}">
      <select id="${inputId}" class="model-sel">${opts}</select>
    </div>`;
  }
  return `<select id="${inputId}" class="model-sel">${opts}</select>`;
}

async function loadOrModels() {
  if (state.orModels && state.orModels.length > 0) return;
  state.orModels = [];
  try {
    const res = await fetch('/api/chat/models');
    if (res.ok) {
      state.orModels = await res.json();
    } else {
      state.orModels = null;
    }
  } catch {
    state.orModels = null;
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
function buildNav() {
  const mode = localStorage.getItem('orchestos-mode') || 'normal';
  const isAdv = mode === 'advanced';
  const side = document.getElementById('sidebar');

  const mainNav = NAV.filter(n => n.id !== 'settings');
  const bottomNav = NAV.filter(n => n.id === 'settings');

  const navItem = n => {
    if (n.operator && !isAdv) return '';
    const badge = n.operator ? '<span class="nav-adv-badge">adv</span>' : '';
    const cls = n.operator ? ' operator' : '';
    return `<div class="nav-icon${cls}" data-nav="${n.id}" data-tip="${t(n.key)}">${n.icon}${badge}</div>`;
  };

  const tipKey = isAdv ? 'nav.mode.disable' : 'nav.mode.enable';
  const modeBtn = `<div class="nav-icon nav-mode-btn${isAdv ? ' active' : ''}" id="navModeBtn" data-tip="${t(tipKey)}">${ICON.sliders}</div>`;

  side.innerHTML = mainNav.map(navItem).join('') +
    '<div class="grow"></div>' + modeBtn + bottomNav.map(navItem).join('');

  if (isAdv) {
    requestAnimationFrame(() => {
      side.querySelectorAll('.nav-icon.operator').forEach(el => el.classList.add('visible'));
    });
  }

  side.querySelectorAll('.nav-icon[data-nav]').forEach(n =>
    n.addEventListener('click', () => App.go(n.dataset.nav)));

  document.getElementById('navModeBtn').addEventListener('click', () => {
    const cur = localStorage.getItem('orchestos-mode') || 'normal';
    const next = cur === 'advanced' ? 'normal' : 'advanced';
    localStorage.setItem('orchestos-mode', next);
    if (next === 'normal') {
      const opIds = NAV.filter(n => n.operator).map(n => n.id);
      if (opIds.includes(state.screen)) App.go('tasks');
    }
    buildNav();
    App.syncNav();
  });
}

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  // Build sidebar
  buildNav();

  // Terminal toggle
  document.getElementById('termBar').addEventListener('click', () => Term.toggle());

  // Panels
  SidePanel.init();
  Modal.init();

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
