/* ============================================================
   OrchestOS — app shell, navigation, panels, API fetching
   ============================================================ */

const state = {
  screen: 'runner',
  memScope: 'all',
  openRun: null,
  openSpec: null,
  archOpen: false,

  runs: [],
  tasks: [],
  instincts: [],
  specs: [],
  memory: [],

  runsStatus: 'loading',
  tasksStatus: 'loading',
  instinctsStatus: 'loading',
  specsStatus: 'loading',
  memoryStatus: 'loading',
};

const NAV = [
  { id: 'runner',    icon: ICON.play,     tip: 'Runner' },
  { id: 'tasks',     icon: ICON.tasks,    tip: 'Tasks' },
  { id: 'memory',    icon: ICON.memory,   tip: 'Memory' },
  { id: 'instincts', icon: ICON.instinct, tip: 'Instincts' },
  { id: 'runs',      icon: ICON.runs,     tip: 'Runs' },
  { id: 'specs',     icon: ICON.specs,    tip: 'Specs' },
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
  async fetchAll() {
    await Promise.all([
      this.fetchRuns(),
      this.fetchTasks(),
      this.fetchInstincts(),
      this.fetchSpecs(),
      this.fetchMemory(),
    ]);
    this.rerender();
    Term.render();
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
    state.screen = id;
    state.openRun = null; state.openSpec = null;
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
    document.getElementById('main').append(this.backdrop, this.el);
  },
  openTask(t) {
    const v = STATUS_BADGE[t.status] || 'gray';
    this.el.innerHTML = `
      <div class="sp-head">
        <span class="badge ${v}"><span class="d"></span>${esc(t.status)}</span>
        <h3 class="mono" style="font-size:13px">${esc(t.id)}</h3>
        <button class="sp-close">${ICON.x}</button>
      </div>
      <div class="sp-body">
        <div class="sp-section"><div class="label">Description</div><div class="val">${esc(t.description)}</div></div>
        <div class="sp-meta">
          ${t.skill ? `<div><div class="label">Skill</div><span class="badge blue square">${esc(t.skill)}</span></div>` : ''}
          <div><div class="label">Executor</div><div class="val mono" style="font-size:13px">${esc(t.executor || '—')}</div></div>
          <div><div class="label">QA Verdict</div>${t.qaVerdict ? `<span class="badge ${t.qaVerdict === 'pass' ? 'green' : 'red'}">${t.qaVerdict}</span>` : '<span class="muted mono" style="font-size:13px">—</span>'}</div>
          <div><div class="label">Retries</div><div class="val mono" style="font-size:13px">↻ ${t.retryCount}</div></div>
        </div>
        ${t.runId ? `<div class="sp-section"><div class="label">Last Run</div><div class="val mono" style="font-size:13px;color:var(--accent)">${esc(t.runId)}</div></div>` : ''}
      </div>
      <div class="sp-foot">
        <span class="muted" style="font-size:12px">Use the CLI to control task execution.</span>
      </div>`;
    this.el.querySelector('.sp-close').addEventListener('click', () => this.close());
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
  openInstinct(st) {
    this.el.innerHTML = `<div class="modal">
      <div class="m-head"><span style="color:var(--accent)">${ICON.bolt}</span><h3>Add Instinct</h3>
        <button class="btn ghost sm" data-x>${ICON.x}</button></div>
      <div class="m-body">
        <div class="m-field"><label>Trigger — when this happens…</label>
          <input id="i-trig" placeholder="e.g. tests fail 2× on the same file"></div>
        <div class="m-field"><label>Action — …do this</label>
          <input id="i-act" placeholder="e.g. auto-run lint before the next retry"></div>
        <div class="muted" style="font-size:12px">New instincts enter as an unverified proposal at 0.50 confidence.</div>
        <div id="i-msg" style="font-size:12px;color:var(--error);display:none"></div>
      </div>
      <div class="m-foot"><button class="btn" data-x>Cancel</button>
        <button class="btn primary" data-add>${ICON.plus} Add Instinct</button></div>
    </div>`;
    this.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => this.close()));
    this.el.querySelector('[data-add]').addEventListener('click', async () => {
      const trig = this.el.querySelector('#i-trig').value.trim();
      const act  = this.el.querySelector('#i-act').value.trim();
      const msg  = this.el.querySelector('#i-msg');
      if (!trig || !act) { msg.textContent = 'Both fields are required.'; msg.style.display = ''; return; }
      /* No POST /api/instincts endpoint yet — show helpful message */
      msg.style.color = 'var(--warning)';
      msg.textContent = 'Adding instincts via the dashboard is not yet supported. Use: orchestos instinct add';
      msg.style.display = '';
    });
    requestAnimationFrame(() => this.el.classList.add('show'));
  },
  close() { this.el.classList.remove('show'); },
};

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  // Build sidebar
  const side = document.getElementById('sidebar');
  side.innerHTML = NAV.map(n =>
    `<div class="nav-icon" data-nav="${n.id}" data-tip="${n.tip}">${n.icon}</div>`
  ).join('') + '<div class="grow"></div>';
  side.querySelectorAll('.nav-icon').forEach(n => n.addEventListener('click', () => App.go(n.dataset.nav)));

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

document.addEventListener('DOMContentLoaded', boot);
