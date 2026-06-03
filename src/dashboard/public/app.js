/* ============================================================
   OrchestOS — app shell, navigation, panels, API fetching
   ============================================================ */

const state = {
  screen: 'tasks',
  memScope: 'all',
  openRun: null,
  openSpec: null,
  archOpen: false,

  runs: [],
  tasks: [],
  instincts: [],
  specs: [],
  memory: [],
  settings: null,

  runsStatus: 'loading',
  tasksStatus: 'loading',
  instinctsStatus: 'loading',
  specsStatus: 'loading',
  memoryStatus: 'loading',
  settingsStatus: 'idle',

  taskFilter: 'all',
  taskSort: { col: null, dir: 'asc' },
  memQuery: '',
  runsFilter: 'all',
  naturalDraft: null,
};

const NAV = [
  { id: 'tasks',     icon: ICON.tasks,    key: 'nav.tasks' },
  { id: 'runs',      icon: ICON.runs,     key: 'nav.runs' },
  { id: 'memory',    icon: ICON.memory,   key: 'nav.memory' },
  { id: 'instincts', icon: ICON.instinct, key: 'nav.instincts' },
  { id: 'specs',     icon: ICON.specs,    key: 'nav.specs' },
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
  async fetchAll() {
    await Promise.all([
      this.fetchRuns(),
      this.fetchTasks(),
      this.fetchInstincts(),
      this.fetchSpecs(),
      this.fetchMemory(),
      this.fetchSettings(),
    ]);
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
    // stop auto-refresh when leaving Runs
    if (SCREENS.runs._timer) { clearInterval(SCREENS.runs._timer); SCREENS.runs._timer = null; }
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
        <div class="m-field"><label>${t('modal.task.exec.label')}</label>
          <select id="t-exec">
            <option value="openrouter">${t('modal.task.exec.or')}</option>
            <option value="anthropic">${t('modal.task.exec.ant')}</option>
            <option value="openai">${t('modal.task.exec.oai')}</option>
          </select></div>
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
    this.el.querySelector('[data-add]').addEventListener('click', async () => {
      const desc = this.el.querySelector('#t-desc').value.trim();
      const id   = descToId(desc);
      const outRaw = this.el.querySelector('#t-out').value.trim();
      const executor = this.el.querySelector('#t-exec').value;
      const msg = this.el.querySelector('#t-msg');
      const output = outRaw.split('\n').map(s => s.trim()).filter(Boolean);
      if (!desc) {
        msg.textContent = 'La descripción es obligatoria.';
        msg.style.color = 'var(--error)'; msg.style.display = ''; return;
      }
      const btn = this.el.querySelector('[data-add]');
      btn.disabled = true;
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, description: desc, output, executor }),
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
   Boot
   ============================================================ */
function boot() {
  // Build sidebar
  const side = document.getElementById('sidebar');
  side.innerHTML = NAV.map(n =>
    `<div class="nav-icon" data-nav="${n.id}" data-tip="${t(n.key)}">${n.icon}</div>`
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
