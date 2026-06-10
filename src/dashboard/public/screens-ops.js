/* ============================================================
   OrchestOS — screens: Project, Instincts, Runs, Specs
   ============================================================ */
window.SCREENS = window.SCREENS || {};

/* ============================================================
   PROJECT — CONSTITUTION.md (editable) + CONTEXT.md (read-only)
   ============================================================ */
SCREENS.project = {
  _saveTimer: null,

  render(st) {
    const tab = st.projectTab || 'constitution';

    const tabs = `<div class="proj-tabs">
      <button class="proj-tab ${tab === 'constitution' ? 'active' : ''}" data-tab="constitution">
        ${t('project.tab.constitution')}
      </button>
      <button class="proj-tab ${tab === 'context' ? 'active' : ''}" data-tab="context">
        ${t('project.tab.context')}
      </button>
    </div>`;

    const saveIndicator = st.projectSaveState === 'saving'
      ? `<span class="save-indicator saving">${t('project.saving')}</span>`
      : st.projectSaveState === 'saved'
        ? `<span class="save-indicator saved">${ICON.check} ${t('project.saved')}</span>`
        : st.projectSaveState === 'error'
          ? `<span class="save-indicator error">${t('project.save.err')}</span>`
          : '';

    const head = `<div class="screen-head">
      <div class="lead"><h1>${t('project.title')}</h1><p>${t('project.subtitle')}</p></div>
      <div class="tools" style="align-items:center">${saveIndicator}</div>
    </div>`;

    if (tab === 'constitution') {
      const content = st.constitutionContent ?? '';
      const isLoading = st.constitutionStatus === 'loading' || st.constitutionStatus === 'idle';
      const body = isLoading
        ? loadingState(t('project.loading'))
        : `<div class="proj-editor-wrap">
            <div class="proj-helper">${t('project.constitution.helper')}</div>
            <textarea id="constitution-editor" class="proj-editor" spellcheck="false">${esc(content)}</textarea>
          </div>`;
      return `<div class="screen">${head}${tabs}${body}</div>`;
    }

    // context tab
    const ctxContent = st.contextContent ?? '';
    const ctxLoading = st.contextStatus === 'loading' || st.contextStatus === 'idle';
    const body = ctxLoading
      ? loadingState(t('project.loading'))
      : `<div class="proj-editor-wrap">
          <div class="proj-helper">${t('project.context.helper')}</div>
          <textarea id="context-editor" class="proj-editor proj-editor-ro" spellcheck="false" readonly>${esc(ctxContent)}</textarea>
          <div class="proj-context-foot">
            <span class="muted" style="font-size:12px">${t('project.context.note')}</span>
            <button class="btn" data-act="regenerate">${ICON.refresh} ${t('project.context.regenerate')}</button>
          </div>
        </div>`;
    return `<div class="screen">${head}${tabs}${body}</div>`;
  },

  wire(root, st) {
    // Tab switching
    root.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
      st.projectTab = btn.dataset.tab;
      if (btn.dataset.tab === 'constitution' && st.constitutionStatus === 'idle') {
        App.fetchConstitution().then(() => App.rerender());
      } else if (btn.dataset.tab === 'context' && st.contextStatus === 'idle') {
        App.fetchContext().then(() => App.rerender());
      } else {
        App.rerender();
      }
    }));

    // Constitution editor — debounced auto-save (1 s)
    const editor = root.querySelector('#constitution-editor');
    if (editor) {
      editor.addEventListener('input', () => {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        st.projectSaveState = 'saving';
        this._saveTimer = setTimeout(async () => {
          try {
            const res = await fetch('/api/project/constitution', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: editor.value }),
            });
            st.constitutionContent = editor.value;
            st.projectSaveState = res.ok ? 'saved' : 'error';
          } catch {
            st.projectSaveState = 'error';
          }
          App.rerender();
        }, 1000);
      });
    }

    // Regenerate CONTEXT.md
    root.querySelector('[data-act="regenerate"]')?.addEventListener('click', async () => {
      const btn = root.querySelector('[data-act="regenerate"]');
      btn.disabled = true;
      btn.textContent = t('project.context.regenerating');
      await fetch('/api/project/context/regenerate', { method: 'POST' });
      // Wait 1.5 s for the CLI to write the file, then reload
      setTimeout(async () => {
        await App.fetchContext();
        App.rerender();
      }, 1500);
    });
  },
};

/* ============================================================
   4 · HÁBITOS DEL AGENTE  (Instincts — E1)
   ============================================================ */
SCREENS.instincts = {
  verdict(i) {
    if (!i.verified) return { cls: 'amber', txt: t('instincts.state.proposal') };
    if (i.confidence >= 0.8) return { cls: 'green', txt: t('instincts.state.active') };
    return { cls: 'gray', txt: t('instincts.state.inactive') };
  },
  confLabel(c) {
    if (c >= 0.8) return { cls: 'hi', txt: t('instincts.conf.high') };
    if (c < 0.6)  return { cls: 'lo', txt: t('instincts.conf.low') };
    return { cls: '',   txt: t('instincts.conf.med') };
  },
  confBar(c) {
    const { cls, txt } = this.confLabel(c);
    return `<div class="conf">
      <div class="track"><i class="${cls}" style="width:${Math.round(c * 100)}%"></i></div>
      <span class="pct">${t('instincts.conf.label')} <b>${txt}</b></span>
    </div>`;
  },
  row(i) {
    const v = this.verdict(i);
    const actions = !i.verified
      ? `<div class="inline-actions">
           <button class="btn success sm" data-approve="${esc(i.id)}">${ICON.check} ${t('instincts.btn.approve')}</button>
           <button class="btn danger sm" data-reject="${esc(i.id)}">${ICON.x} ${t('instincts.btn.reject')}</button>
         </div>`
      : `<span class="badge ${v.cls} instinct-state"><span class="d"></span>${v.txt}</span>`;
    return `<tr class="${!i.verified ? 'proposal' : ''}">
      <td><span class="mono" style="color:var(--text)">${esc(i.trigger)}</span></td>
      <td class="muted">${esc(i.action)}</td>
      <td>${this.confBar(i.confidence)}</td>
      <td style="text-align:right">${actions}</td>
    </tr>`;
  },
  render(st) {
    const head = `<div class="screen-head">
      <div class="lead">
        <h1>${t('instincts.title')}</h1>
        <p>${t('instincts.subtitle')}</p>
      </div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} ${t('btn.refresh')}</button>
        <button class="btn primary" data-act="add-instinct">${ICON.plus} ${t('instincts.btn.add')}</button>
      </div>
    </div>`;

    if (st.instinctsStatus === 'loading')
      return `<div class="screen">${head}${loadingState(t('instincts.loading'))}</div>`;
    if (st.instinctsStatus === 'error')
      return `<div class="screen">${head}${errorState(t('instincts.err.title'), t('instincts.err.body'))}</div>`;

    const all = st.instincts || [];
    if (all.length === 0)
      return `<div class="screen">${head}${emptyState(ICON.instinct, t('instincts.empty.title'), t('instincts.empty.body'))}</div>`;

    const proposals = all.filter(i => !i.verified);
    const active    = all.filter(i =>  i.verified && i.confidence >= 0.8);
    const inactive  = all.filter(i =>  i.verified && i.confidence < 0.8);

    const makeSection = (titleKey, ct, items) => items.length === 0 ? '' : `
      <div class="section-title"><span>${t(titleKey)}</span><span class="ct">${ct}</span></div>
      <div class="card" style="overflow:hidden;margin-bottom:16px">
        <table class="tbl">
          <thead><tr>
            <th>${t('instincts.col.when')}</th>
            <th>${t('instincts.col.what')}</th>
            <th style="width:180px">${t('instincts.col.conf')}</th>
            <th style="width:200px;text-align:right">${t('instincts.col.state')}</th>
          </tr></thead>
          <tbody>${items.map(i => this.row(i)).join('')}</tbody>
        </table>
      </div>`;

    const proposalCards = proposals.length ? `
      <div class="section-title"><span>${t('instincts.sec.proposals')}</span><span class="ct">${proposals.length}</span></div>
      ${proposals.map(i => `
        <div class="proposal-card">
          <div class="pc-main">
            <div class="pc-trig">
              <div class="pc-label">${t('instincts.col.when')}</div>
              <span>${esc(i.trigger)}</span>
            </div>
            <div class="pc-trig" style="margin-top:6px">
              <div class="pc-label">${t('instincts.col.what')}</div>
              <span class="muted">${esc(i.action)}</span>
            </div>
            <div class="pc-meta" style="margin-top:8px">${this.confBar(i.confidence)}</div>
          </div>
          <div class="inline-actions">
            <button class="btn success sm" data-approve="${esc(i.id)}">${ICON.check} ${t('instincts.btn.approve')}</button>
            <button class="btn danger sm" data-reject="${esc(i.id)}">${ICON.x} ${t('instincts.btn.reject')}</button>
          </div>
        </div>`).join('')}` : '';

    return `<div class="screen">${head}
      ${proposalCards}
      ${makeSection('instincts.sec.active', active.length, active)}
      ${makeSection('instincts.sec.inactive', inactive.length, inactive)}
    </div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelector('[data-act="add-instinct"]')?.addEventListener('click', () => Modal.openInstinct(st));
    root.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.approve;
      b.disabled = true;
      try {
        const res = await fetch(`/api/instincts/${encodeURIComponent(id)}/approve`, { method: 'POST' });
        if (res.ok) await App.fetchInstincts();
      } finally { b.disabled = false; }
    }));
    root.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.reject;
      b.disabled = true;
      try {
        const res = await fetch(`/api/instincts/${encodeURIComponent(id)}/reject`, { method: 'POST' });
        if (res.ok) await App.fetchInstincts();
      } finally { b.disabled = false; }
    }));
  },
};

/* ============================================================
   5 · RUNS
   ============================================================ */
SCREENS.runs = {
  _timer: null,
  warnCell(n) {
    return n > 0
      ? `<span class="warn-dot">${ICON.warn} ${n}</span>`
      : `<span class="warn-dot none">— 0</span>`;
  },
  detail(r) {
    /* costBreakdown: {label, model, inputTokens, outputTokens, costUsd} */
    const bd = r.costBreakdown && r.costBreakdown.length > 1
      ? `<div class="grp"><h4>Cost Breakdown</h4><div class="breakdown">` +
        r.costBreakdown.map(c => {
          const pct = r.costUsd > 0 ? Math.round(c.costUsd / r.costUsd * 100) : 0;
          return `<div class="row"><span class="muted">${esc(c.label)}</span>
            <div class="bar"><i style="width:${pct}%"></i></div>
            <span class="num">${usd(c.costUsd)}</span></div>`;
        }).join('') + `</div></div>`
      : `<div class="grp"><h4>${t('runs.detail.cost')}</h4><div class="muted" style="font-size:12.5px">${t('runs.detail.cost.single')} ${usd(r.costUsd)}.</div></div>`;

    /* contextWarnings: {code, severity: 'warning'|'critical'|'notice', message} */
    const warns = r.contextWarnings && r.contextWarnings.length
      ? `<div class="grp"><h4>${t('runs.detail.warnings')}</h4>` +
        r.contextWarnings.map(w => {
          const c = w.severity === 'critical' ? 'var(--error)' : w.severity === 'warning' ? 'var(--warning)' : 'var(--accent)';
          return `<div class="warn-item"><span class="badge square" style="color:${c};border-color:${c};background:transparent">${esc(w.severity)}</span><span style="color:var(--text)">${esc(w.message)}</span></div>`;
        }).join('') + `</div>`
      : `<div class="grp"><h4>${t('runs.detail.warnings')}</h4><div class="muted" style="font-size:12.5px">${t('runs.detail.no.warn')}</div></div>`;

    const qa = r.qaVerdict
      ? `<div class="grp"><h4>${t('runs.detail.qa')}</h4>
           <div class="kv"><span class="k">Verdict</span><span class="v"><span class="badge ${r.qaVerdict === 'pass' ? 'green' : 'red'}">${r.qaVerdict}</span></span></div>
         </div>`
      : '';

    const meta = `<div class="grp"><h4>${t('runs.detail.meta')}</h4>
      ${r.skillId ? `<div class="kv"><span class="k">${t('runs.detail.skill')}</span><span class="v">${esc(r.skillId)}</span></div>` : ''}
      ${r.provider ? `<div class="kv"><span class="k">${t('runs.detail.provider')}</span><span class="v">${esc(r.provider)}</span></div>` : ''}
      ${r.elapsedMs ? `<div class="kv"><span class="k">${t('runs.detail.elapsed')}</span><span class="v">${(r.elapsedMs / 1000).toFixed(1)}s</span></div>` : ''}
    </div>`;

    return `<tr class="detail-row"><td colspan="7"><div class="detail">${bd}${warns}${qa}${meta}</div></td></tr>`;
  },
  render(st) {
    const hasRunning = (st.runs || []).some(r => r.status === 'running');
    const liveIndicator = hasRunning
      ? `<span class="live-indicator"><span class="live-dot"></span>${t('runs.live')}</span>`
      : `<span class="live-indicator idle">${t('runs.idle')}</span>`;

    const head = `<div class="screen-head">
      <div class="lead"><h1>${t('runs.title')}</h1><p>${t('runs.subtitle')}</p></div>
      <div class="tools">
        ${liveIndicator}
        <button class="btn" data-act="refresh">${ICON.refresh} ${t('btn.refresh')}</button>
      </div>
    </div>`;

    const runsExplainer = `<div class="spec-explainer">
      <span class="spec-explainer-icon">${ICON.runs}</span>
      <div><strong>${t('runs.explainer.title')}</strong> ${t('runs.explainer.body')}</div>
    </div>`;

    if (st.runsStatus === 'loading')
      return `<div class="screen">${head}${runsExplainer}${loadingState(t('runs.loading'))}</div>`;
    if (st.runsStatus === 'error')
      return `<div class="screen">${head}${runsExplainer}${errorState(t('runs.err.title'), t('runs.err.body'))}</div>`;

    const allRuns = st.runs || [];
    if (allRuns.length === 0)
      return `<div class="screen">${head}${runsExplainer}${emptyState(ICON.runs, t('runs.empty.title'), t('runs.empty.body'))}</div>`;

    // F2 — filter tabs
    const counts = { all: allRuns.length, running: 0, done: 0, failed: 0 };
    allRuns.forEach(r => {
      const k = r.status === 'failed_permanent' ? 'failed' : r.status;
      if (k in counts) counts[k]++;
    });
    const tabLabels = {
      all: t('runs.filter.all'), running: t('runs.filter.running'),
      done: t('runs.filter.done'), failed: t('runs.filter.failed'),
    };
    const tabs = Object.entries(tabLabels).map(([k, label]) =>
      `<button class="filter-tab ${st.runsFilter === k ? 'active' : ''}" data-runs-filter="${k}">
        ${label} <span class="tab-ct">${counts[k] || 0}</span>
      </button>`
    ).join('');

    const runs = st.runsFilter === 'all'
      ? allRuns
      : allRuns.filter(r => (r.status === 'failed_permanent' ? 'failed' : r.status) === st.runsFilter);

    const rows = runs.map(r => {
      const open = st.openRun === r.id;
      const warnCount = (r.contextWarnings || []).length;
      const main = `<tr class="row ${open ? 'open' : ''}" data-run="${esc(r.id)}">
        <td><span class="badge ${STATUS_BADGE[r.status] || 'gray'}"><span class="d"></span>${esc(r.status)}</span></td>
        <td class="mono">${r.taskId ? esc(r.taskId) : '<span class="faint">—</span>'}</td>
        <td class="mono">${esc(r.model)}</td>
        <td class="num">${fmt(r.inputTokens)} <span class="faint">/</span> ${fmt(r.outputTokens)}</td>
        <td class="num">${usd(r.costUsd)}</td>
        <td>${this.warnCell(warnCount)}</td>
        <td class="mono faint">${esc((r.createdAt || '').slice(0, 19))}</td>
      </tr>`;
      return main + (open ? this.detail(r) : '');
    }).join('');

    return `<div class="screen">${head}${runsExplainer}
      <div class="filter-tabs" style="margin-bottom:12px">${tabs}</div>
      <div class="card" style="overflow:hidden">
        <table class="tbl">
          <thead><tr><th style="width:90px">${t('runs.col.status')}</th><th>${t('runs.col.taskid')}</th><th>${t('runs.col.model')}</th><th>${t('runs.col.tokens')}</th><th>${t('runs.col.cost')}</th><th style="width:80px">${t('runs.col.warn')}</th><th>${t('runs.col.date')}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div></div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());

    // F2 — filter tabs
    root.querySelectorAll('[data-runs-filter]').forEach(btn => btn.addEventListener('click', () => {
      st.runsFilter = btn.dataset.runsFilter;
      App.rerender();
    }));

    // F1 — auto-refresh every 5s while on Runs screen
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(async () => {
      if (state.screen !== 'runs') { clearInterval(this._timer); this._timer = null; return; }
      await App.fetchRuns();
      App.rerender();
    }, 5000);

    root.querySelectorAll('[data-run]').forEach(tr => tr.addEventListener('click', () => {
      st.openRun = st.openRun === tr.dataset.run ? null : tr.dataset.run;
      App.rerender();
    }));
  },
};

/* ============================================================
   6 · SETTINGS
   ============================================================ */
const KEY_DEFS = [
  { id: 'OPENROUTER_API_KEY', labelKey: 'settings.key.or.label',  descKey: 'settings.key.or.desc',  ph: 'sk-or-...' },
  { id: 'ANTHROPIC_API_KEY',  labelKey: 'settings.key.ant.label', descKey: 'settings.key.ant.desc', ph: 'sk-ant-...' },
  { id: 'OPENAI_API_KEY',     labelKey: 'settings.key.oai.label', descKey: 'settings.key.oai.desc', ph: 'sk-...' },
  { id: 'OLLAMA_HOST', labelKey: 'settings.key.oll.label', descKey: 'settings.key.oll.desc', ph: 'http://localhost:11434', special: 'ollama' },
];

SCREENS.settings = {
  _timer: null,
  itemBadge(item) {
    if (item.ok) return `<span class="badge green square">${ICON.check} Ready</span>`;
    if (item.critical) return `<span class="badge red square">${ICON.x} Required</span>`;
    return `<span class="badge amber square">${ICON.warn} Optional</span>`;
  },
  healthDot(status) {
    const colors = { green: 'var(--success)', amber: 'var(--warning)', red: 'var(--error)', neutral: 'var(--text-faint)' };
    const s = colors[status] || colors.neutral;
    return `<span class="health-dot" style="background:${s};box-shadow:0 0 6px ${s}"></span>`;
  },
  setupChecklist(st) {
    const setup = st.setup;
    if (st.setupStatus === 'loading' || st.setupStatus === 'idle') {
      return `<div class="card settings-card setup-card">${loadingState(t('setup.loading'))}</div>`;
    }
    if (st.setupStatus === 'error' || !setup) {
      return `<div class="card settings-card setup-card">${errorState(t('setup.err.title'), t('setup.err.body'))}</div>`;
    }

    const summary = setup.criticalMissing
      ? `<span class="badge red square">${ICON.warn} ${t('setup.summary.blocked')}</span>`
      : `<span class="badge green square">${ICON.check} ${t('setup.summary.ready')}</span>`;

    const rows = (setup.items || []).map(item => {
      const command = item.command
        ? `<code class="setup-command">${esc(item.command)}</code>`
        : '';
      const action = item.action === 'copy-command' && item.command
        ? `<button class="btn ghost sm" data-copy="${esc(item.command)}">${item.actionLabel || t('setup.copy')}</button>`
        : item.action === 'open-wizard'
          ? `<button class="btn ghost sm" data-open-wizard>${esc(item.actionLabel || t('setup.btn.configure'))}</button>`
          : item.action === 'save-settings'
            ? `<button class="btn ghost sm" data-focus-key>${item.actionLabel || t('settings.btn.save')}</button>`
            : '';
      return `<div class="setup-row ${item.ok ? 'ok' : item.critical ? 'critical' : 'optional'}">
        <div class="setup-icon">${item.ok ? ICON.check : item.critical ? ICON.x : ICON.warn}</div>
        <div class="setup-main">
          <div class="setup-title">${esc(item.label)}</div>
          <div class="setup-hint">${esc(item.hint)}</div>
          ${command}
        </div>
        <div class="setup-side">${this.itemBadge(item)}${action}</div>
      </div>`;
    }).join('');

    return `<div class="card settings-card setup-card">
      <div class="settings-header setup-header">
        <div>
          <h3>${t('setup.title')}</h3>
          <p class="muted" style="margin:0;font-size:12.5px">${t('setup.subtitle')}</p>
        </div>
        ${summary}
      </div>
      <div class="setup-list">${rows}</div>
    </div>`;
  },
  healthBlocks(st) {
    const h = st.health;
    if (!h) return '';
    const blocks = [
      {
        id: 'system', label: t('health.system'),
        status: h.system.ready ? 'green' : 'red',
        value: h.system.ready ? t('health.system.ok') : t('health.system.issues'),
      },
      {
        id: 'blocked', label: t('health.blocked'),
        status: h.blockedTasks.length > 0 ? 'red' : 'green',
        value: h.blockedTasks.length > 0 ? `${h.blockedTasks.length}` : t('health.blocked.ok'),
        link: h.blockedTasks.length > 0 ? 'tasks' : null,
        linkFilter: 'failed',
      },
      {
        id: 'pending', label: t('health.pending'),
        status: h.pendingApproval.unverifiedInstincts + h.pendingApproval.draftSpecs > 0 ? 'amber' : 'green',
        value: h.pendingApproval.unverifiedInstincts + h.pendingApproval.draftSpecs > 0
          ? `${h.pendingApproval.unverifiedInstincts + h.pendingApproval.draftSpecs}`
          : t('health.pending.ok'),
      },
      {
        id: 'cost', label: t('health.cost'),
        status: 'neutral',
        value: `$${h.costLast7d.toFixed(4)}`,
      },
      {
        id: 'learning', label: t('health.learning'),
        status: h.recentLearnings.length > 0 ? 'green' : 'neutral',
        value: h.recentLearnings.length > 0
          ? h.recentLearnings.map(l => esc(l.trigger)).join(', ')
          : t('health.no.learning'),
      },
    ];
    const rows = blocks.map(b => `
      <div class="health-row">
        <div class="health-dot-wrap">${this.healthDot(b.status)}</div>
        <div class="health-label">${esc(b.label)}</div>
        <div class="health-value">${esc(b.value)}</div>
        <div class="health-action">${b.link
          ? `<button class="btn ghost sm" data-nav="${esc(b.link)}" ${b.linkFilter ? `data-filter="${esc(b.linkFilter)}"` : ''}>${t('health.view')}</button>`
          : ''}</div>
      </div>`).join('');
    return `<div class="card settings-card health-card">
      <div class="settings-header">
        <h3>${t('health.title')}</h3>
      </div>
      <div class="health-list">${rows}</div>
    </div>`;
  },
  render(st) {
    const keys = st.settings || {};
    const lang = getLang();
    const setupTitle = st.setup?.criticalMissing ? t('setup.title') : t('settings.title');
    const setupSubtitle = st.setup?.criticalMissing ? t('setup.subtitle') : t('settings.subtitle');
    const head = `<div class="screen-head">
      <div class="lead"><h1>${setupTitle}</h1><p>${setupSubtitle}</p></div>
    </div>`;

    const keyRows = KEY_DEFS.map(def => {
      // D0-ext-2 — Ollama row: show probe result instead of env var status
      if (def.special === 'ollama') {
        const probe = keys['_ollama'] || { set: false, masked: '' };
        const override = keys['OLLAMA_HOST'] || { set: false, masked: '' };
        const badge = probe.set
          ? `<span class="badge green square" style="white-space:nowrap">${ICON.check} ${t('settings.key.oll.detected')}</span>`
          : `<span class="badge gray square" style="white-space:nowrap">— ${t('settings.key.oll.none')}</span>`;
        const detected = probe.set
          ? `<code class="key-masked">${esc(probe.masked)}</code>`
          : `<span class="faint" style="font-size:12px">${t('settings.key.oll.none')}</span>`;
        return `<div class="key-row">
          <div class="key-meta">
            <div class="key-label">${t(def.labelKey)}</div>
            <div class="key-desc">${t(def.descKey)}</div>
          </div>
          <div class="key-val">${badge}${detected}</div>
          <div class="key-input">
            <input type="text" id="k-${esc(def.id)}" placeholder="${t('settings.key.oll.override')}" value="${override.set ? esc(override.masked) : ''}" autocomplete="off">
          </div>
        </div>`;
      }
      const info = keys[def.id] || { set: false, masked: '' };
      const badge = info.set
        ? `<span class="badge green square" style="white-space:nowrap">${ICON.check} ${t('settings.status.set')}</span>`
        : `<span class="badge gray square" style="white-space:nowrap">— ${t('settings.status.unset')}</span>`;
      const masked = info.set
        ? `<code class="key-masked">${esc(info.masked)}</code>`
        : `<span class="faint" style="font-size:12px">${t('settings.status.unset')}</span>`;
      const wizardBtn = def.id === 'OPENROUTER_API_KEY' || def.id === 'ANTHROPIC_API_KEY' || def.id === 'OPENAI_API_KEY'
        ? `<button class="btn ghost sm" data-open-wizard style="white-space:nowrap">${t('settings.btn.change.key')}</button>`
        : '';
      return `<div class="key-row">
        <div class="key-meta">
          <div class="key-label">${t(def.labelKey)}</div>
          <div class="key-desc">${t(def.descKey)}</div>
        </div>
        <div class="key-val">${badge}${masked}</div>
        <div class="key-input" style="display:flex;gap:6px;align-items:center">
          <input type="password" id="k-${esc(def.id)}" placeholder="${esc(def.ph)}" autocomplete="new-password" style="flex:1">
          ${wizardBtn}
        </div>
      </div>`;
    }).join('');

    const cwd  = keys['_cwd']?.masked  || '—';
    const envF = keys['_envFile']?.masked || '~/.orchestos/.env';
    const envSet = keys['_envFile']?.set;

    return `<div class="screen">${head}
      ${this.setupChecklist(st)}
      ${this.healthBlocks(st)}
      <div class="settings-grid">

        <div class="card settings-card">
          <div class="settings-header">
            <h3>${t('settings.keys.title')}</h3>
            <p class="muted" style="margin:0;font-size:12.5px">${t('settings.keys.hint')} <code>${esc(envF)}</code>.</p>
          </div>
          <div class="key-list">${keyRows}</div>
          <div class="settings-foot">
            <span id="settings-msg" style="font-size:12px;display:none"></span>
            <span style="flex:1"></span>
            <button class="btn primary" data-save-keys>${ICON.check} ${t('settings.btn.save')}</button>
          </div>
        </div>

        <div class="settings-right-col">
          <div class="card settings-card">
            <div class="settings-header"><h3>${t('settings.project.title')}</h3></div>
            <div class="kv"><span class="k">${t('settings.project.cwd')}</span><span class="v mono" style="font-size:12px;word-break:break-all">${esc(cwd)}</span></div>
            <div class="kv"><span class="k">${t('settings.project.config')}</span>
              <span class="v mono" style="font-size:12px">${esc(envF)}
                ${envSet ? `<span class="badge green square" style="margin-left:6px">${ICON.check} ${t('settings.project.exists')}</span>` : `<span class="badge gray square" style="margin-left:6px">${t('settings.project.missing')}</span>`}
              </span>
            </div>
            <div class="kv"><span class="k">${t('settings.project.cli')}</span><span class="v mono" style="font-size:12px">orchestos dashboard --port 4242</span></div>
          </div>

          <div class="card settings-card" style="margin-top:16px">
            <div class="settings-header"><h3>${t('settings.lang.title')}</h3></div>
            <div class="lang-selector">
              <button class="lang-opt ${lang === 'en' ? 'active' : ''}" data-lang="en">🇺🇸 English</button>
              <button class="lang-opt ${lang === 'es' ? 'active' : ''}" data-lang="es">🇪🇸 Español</button>
            </div>
          </div>
        </div>

      </div>
    </div>`;
  },

  wire(root, st) {
    root.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy || '');
        const old = btn.textContent;
        btn.textContent = t('setup.copied');
        setTimeout(() => { btn.textContent = old; }, 1200);
      } catch {
        alert(btn.dataset.copy || '');
      }
    }));
    root.querySelectorAll('[data-open-wizard]').forEach(btn => btn.addEventListener('click', () => Modal.openWizard()));
    root.querySelectorAll('[data-focus-key]').forEach(btn => btn.addEventListener('click', () => {
      const el = root.querySelector('#k-OPENROUTER_API_KEY') || root.querySelector('.key-input input');
      if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }));

    root.querySelector('[data-save-keys]')?.addEventListener('click', async () => {
      const body = {};
      KEY_DEFS.forEach(def => {
        const el = root.querySelector('#k-' + def.id);
        if (el?.value) body[def.id] = el.value;
      });
      const msg = root.querySelector('#settings-msg');
      const btn = root.querySelector('[data-save-keys]');
      btn.disabled = true;
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          msg.textContent = t('settings.msg.saved');
          msg.style.color = 'var(--success)';
          msg.style.display = '';
          KEY_DEFS.forEach(def => { const el = root.querySelector('#k-' + def.id); if (el) el.value = ''; });
          await App.fetchSettings();
          await App.fetchSetup();
          App.rerender();
        } else {
          const e = await res.json();
          msg.textContent = e.error || t('settings.msg.error');
          msg.style.color = 'var(--error)';
          msg.style.display = '';
        }
      } catch {
        msg.textContent = t('common.conn.error');
        msg.style.color = 'var(--error)';
        msg.style.display = '';
      } finally { btn.disabled = false; }
    });

    // Language selector
    root.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      App.rerender();
    }));

    // C3 — health nav links
    root.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click', () => {
      const screen = btn.dataset.nav;
      const filter = btn.dataset.filter;
      if (screen === 'tasks' && filter) {
        state.taskFilter = filter;
      }
      state.screen = screen;
      App.rerender();
    }));

    // C3 — auto-refresh every 30s while the settings screen is visible
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(async () => {
      await Promise.all([App.fetchSetup(), App.fetchHealth()]);
      App.rerender();
    }, 30000);
  },
};

/* ============================================================
   7 · SPECS
   ============================================================ */
SCREENS.specs = {
  lintBadge(s) {
    return s.lintStatus === 'pass'
      ? `<span class="badge green square">${ICON.check} PASS</span>`
      : `<span class="badge red square">FAIL · ${s.lintFindings}</span>`;
  },
  detail(s) {
    const clarifyBadge = s.clarify !== 'none'
      ? `<div class="stat-box ${s.clarify === 'pending' ? 'bad' : 'ok'}"><div class="n" style="font-size:15px;margin-top:5px">${esc(s.clarify)}</div><div class="l">Clarify</div></div>`
      : '';
    return `<tr class="detail-row"><td colspan="5"><div class="spec-detail">
      <div class="stat-box ${s.lintFindings > 0 ? 'bad' : 'ok'}"><div class="n">${s.lintFindings}</div><div class="l">Lint findings</div></div>
      <div class="stat-box ${s.deltaIssues > 0 ? 'bad' : 'ok'}"><div class="n">${s.deltaIssues}</div><div class="l">Delta issues</div></div>
      <div class="stat-box"><div class="n" style="font-size:15px;margin-top:5px">${s.hasCapabilities ? `<span class="cap-yes">${ICON.check} Defined</span>` : `<span class="cap-no">${ICON.x} Missing</span>`}</div><div class="l">Capabilities</div></div>
      ${clarifyBadge}
    </div></td></tr>`;
  },
  row(s, st) {
    const open = st.openSpec === s.id;
    const date = (s.createdAt || '').slice(0, 10);
    const main = `<tr class="row ${open ? 'open' : ''}" data-spec="${esc(s.id)}">
      <td class="mono" style="color:var(--text)">${esc(s.id)}</td>
      <td><span class="badge ${STATUS_BADGE[s.status] || 'gray'} square">${esc(s.status)}</span></td>
      <td>${this.lintBadge(s)}</td>
      <td>${s.hasCapabilities ? `<span class="cap-yes mono" style="font-size:12px">${ICON.check} yes</span>` : `<span class="cap-no mono" style="font-size:12px">— no</span>`}</td>
      <td class="mono faint" style="display:flex;align-items:center;justify-content:space-between;gap:10px">${date}</td>
    </tr>`;
    return main + (open ? this.detail(s) : '');
  },
  render(st) {
    // G1 — banner explicativo siempre visible
    const whatIsSpec = `<div class="spec-explainer">
      <span class="spec-explainer-icon">${ICON.specs}</span>
      <div>
        <strong>¿Qué es una Spec?</strong>
        Una spec es el contrato de lo que debe hacer una tarea <em>antes</em> de ejecutarla.
        Define criterios de aceptación, archivos afectados y capacidades esperadas.
        El agente los verifica al terminar — si no los cumple, la tarea falla con detalle claro.
      </div>
    </div>`;

    const head = `<div class="screen-head">
      <div class="lead"><h1>Specs</h1><p>Contratos de calidad para cada tarea.</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} Refresh</button>
        <button class="btn primary" data-act="new-spec">${ICON.plus} Nueva Spec</button>
      </div>
    </div>`;

    if (st.specsStatus === 'loading')
      return `<div class="screen">${head}${whatIsSpec}${loadingState('Cargando specs…')}</div>`;
    if (st.specsStatus === 'error')
      return `<div class="screen">${head}${whatIsSpec}${errorState('No se pudieron cargar las specs', 'GET /api/specs falló. El directorio specs/ puede faltar o no ser accesible.')}</div>`;

    const specs = st.specs || [];
    if (specs.length === 0)
      return `<div class="screen">${head}${whatIsSpec}${emptyState(ICON.specs, 'Aún no hay specs', 'Pulsa "Nueva Spec", elige una tarea y el agente generará el contrato automáticamente.')}</div>`;

    const active = specs.filter(s => s.status !== 'archived');
    const archived = specs.filter(s => s.status === 'archived');

    const table = list => `<div class="card" style="overflow:hidden"><table class="tbl">
        <thead><tr><th>Spec ID</th><th style="width:110px">Status</th><th style="width:130px">Lint</th><th style="width:110px">Capabilities</th><th style="width:140px">Created</th></tr></thead>
        <tbody>${list.map(s => this.row(s, st)).join('')}</tbody></table></div>`;

    const archSection = archived.length ? `
      <div class="section-title collapsible ${st.archOpen ? '' : 'closed'}" data-arch>
        <span class="chev">${ICON.chev}</span><span>Archived</span><span class="ct">${archived.length}</span>
      </div>
      ${st.archOpen ? table(archived) : ''}` : '';

    return `<div class="screen">${head}${whatIsSpec}${table(active)}${archSection}</div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());

    // G2 — Nueva Spec button
    root.querySelector('[data-act="new-spec"]')?.addEventListener('click', () => Modal.openSpecDraft(st));

    root.querySelectorAll('[data-spec]').forEach(tr => tr.addEventListener('click', () => {
      st.openSpec = st.openSpec === tr.dataset.spec ? null : tr.dataset.spec;
      App.rerender();
    }));
    root.querySelector('[data-arch]')?.addEventListener('click', () => { st.archOpen = !st.archOpen; App.rerender(); });
  },
};

/* ============================================================
   SKILLS
   ============================================================ */
SCREENS.skills = {
  render(st) {
    const head = `<div class="screen-head">
      <div class="lead"><h1>${t('skills.title')}</h1><p>${t('skills.subtitle')}</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} ${t('btn.refresh')}</button>
        <button class="btn primary" data-act="new-skill">${ICON.plus} ${t('skills.btn.new')}</button>
        <button class="btn" data-act="import-skill">${ICON.inbox} ${t('skills.btn.import')}</button>
      </div>
    </div>`;

    if (st.skillsStatus === 'loading')
      return `<div class="screen">${head}${loadingState(t('skills.loading'))}</div>`;
    if (st.skillsStatus === 'error')
      return `<div class="screen">${head}${errorState(t('skills.err.title'), t('skills.err.body'))}</div>`;

    const skills = st.skills || [];
    if (skills.length === 0)
      return `<div class="screen">${head}${emptyState(ICON.flask, t('skills.empty.title'), t('skills.empty.body'))}</div>`;

    const cards = skills.map(s => `<div class="skill-card" data-skill="${esc(s.id)}">
      <div class="skill-card-main" data-skill-detail="${esc(s.id)}">
        <div class="skill-card-name">${esc(s.name)}</div>
        <div class="skill-card-desc">${esc(s.description)}</div>
        <div class="skill-card-targets">${s.targets.map(t2 => `<span class="badge blue square">${esc(t2)}</span>`).join('')}</div>
      </div>
      <div class="skill-card-actions">
        <button class="btn ghost sm" data-act="edit-skill" data-skill="${esc(s.id)}">${ICON.settings} ${t('skills.btn.edit')}</button>
        <button class="btn ghost sm" data-act="export-skill" data-skill="${esc(s.id)}">${ICON.inbox} ${t('skills.btn.export')}</button>
        <button class="btn ghost sm" data-act="copy-skill" data-skill="${esc(s.id)}">${ICON.copy} ${t('skills.btn.copy')}</button>
        <button class="btn ghost sm" data-act="build-skill" data-skill="${esc(s.id)}">${ICON.play} ${t('skills.btn.build')}</button>
        <button class="btn ghost sm" data-act="delete-skill" data-skill="${esc(s.id)}">${ICON.trash} ${t('skills.btn.delete')}</button>
      </div>
      <div class="skill-card-confirm" id="del-confirm-${esc(s.id)}" style="display:none">
        <span class="muted" style="font-size:12px;flex:1">${t('skills.delete.confirm', esc(s.name))}</span>
        <button class="btn danger sm" data-act="confirm-delete" data-skill="${esc(s.id)}">${t('skills.delete.btn')}</button>
        <button class="btn ghost sm" data-act="cancel-delete" data-skill="${esc(s.id)}">${t('btn.cancel')}</button>
      </div>
      <div class="skill-card-msg" id="msg-${esc(s.id)}" style="display:none"></div>
    </div>`).join('');

    const proSkills = st.proSkills || [];
    const proSection = proSkills.length === 0 ? '' : `
      <div class="skills-pro-section">
        <div class="screen-head" style="margin-top:24px">
          <div class="lead"><h2>${t('skills.pro.title')}</h2><p>${t('skills.pro.subtitle')}</p></div>
        </div>
        <div class="skills-grid">${proSkills.map(s => `<div class="skill-card" data-pro-skill="${esc(s.id)}">
          <div class="skill-card-main">
            <div class="skill-card-name">${esc(s.name)} <span class="badge gray square">pro</span></div>
            <div class="skill-card-desc">${esc(s.description)}</div>
            <div class="skill-card-targets">${s.targets.map(t2 => `<span class="badge blue square">${esc(t2)}</span>`).join('')}</div>
          </div>
          <div class="skill-card-actions">
            ${s.imported
              ? `<button class="btn ghost sm" disabled>${ICON.check} ${t('skills.pro.imported')}</button>`
              : `<button class="btn primary sm" data-act="import-pro-skill" data-skill="${esc(s.id)}">${ICON.inbox} ${t('skills.pro.btn.import')}</button>`}
          </div>
          <div class="skill-card-msg" id="msg-pro-${esc(s.id)}" style="display:none"></div>
        </div>`).join('')}</div>
      </div>`;

    return `<div class="screen">${head}<div class="skills-grid">${cards}</div>${proSection}</div>`;
  },

  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());

    root.querySelectorAll('[data-skill-detail]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.skillDetail;
        const skill = st.skills.find(s => s.id === id);
        if (skill) Modal.openSkillDetail(skill);
      });
    });

    root.querySelectorAll('[data-act="export-skill"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.skill;
        const a = document.createElement('a');
        a.href = `/api/skills/${encodeURIComponent(id)}/export`;
        a.download = `${id}.yaml`;
        a.click();
      });
    });

    root.querySelectorAll('[data-act="copy-skill"]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.skill;
        const orig = btn.innerHTML;
        btn.disabled = true;
        try {
          const res = await fetch(`/api/skills/${encodeURIComponent(id)}/export`);
          const yaml = await res.text();
          await navigator.clipboard.writeText(yaml);
          btn.innerHTML = `${ICON.check} ${t('skills.btn.copied')}`;
          setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
        } catch {
          btn.disabled = false;
        }
      });
    });

    root.querySelectorAll('[data-act="build-skill"]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.skill;
        const msg = document.getElementById(`msg-${id}`);
        btn.disabled = true;
        try {
          const res = await fetch(`/api/skills/${encodeURIComponent(id)}/build`, { method: 'POST' });
          const data = await res.json();
          if (msg) {
            msg.textContent = data.ok ? t('skills.build.ok', data.paths.join(', ')) : (data.error || t('skills.build.err'));
            msg.style.color = data.ok ? 'var(--success)' : 'var(--error)';
            msg.style.display = '';
            setTimeout(() => { msg.style.display = 'none'; }, 5000);
          }
        } catch {
          if (msg) { msg.textContent = t('common.conn.error'); msg.style.color = 'var(--error)'; msg.style.display = ''; }
        } finally { btn.disabled = false; }
      });
    });

    root.querySelectorAll('[data-act="delete-skill"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.skill;
        const confirmEl = document.getElementById(`del-confirm-${id}`);
        const actionsEl = btn.closest('.skill-card')?.querySelector('.skill-card-actions');
        if (confirmEl && actionsEl) { actionsEl.style.display = 'none'; confirmEl.style.display = 'flex'; }
      });
    });

    root.querySelectorAll('[data-act="cancel-delete"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.skill;
        const confirmEl = document.getElementById(`del-confirm-${id}`);
        const card = btn.closest('.skill-card');
        if (confirmEl && card) {
          confirmEl.style.display = 'none';
          const actionsEl = card.querySelector('.skill-card-actions');
          if (actionsEl) actionsEl.style.display = 'flex';
        }
      });
    });

    root.querySelectorAll('[data-act="confirm-delete"]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const id = btn.dataset.skill;
        const msg = document.getElementById(`msg-${id}`);
        try {
          const res = await fetch(`/api/skills/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: true }),
          });
          if (res.ok) {
            await App.fetchSkills();
            App.rerender();
          } else {
            const err = await res.json();
            if (msg) { msg.textContent = err.error || t('skills.delete.err'); msg.style.color = 'var(--error)'; msg.style.display = ''; }
          }
        } catch {
          if (msg) { msg.textContent = t('common.conn.error'); msg.style.color = 'var(--error)'; msg.style.display = ''; }
        }
      });
    });

    root.querySelectorAll('[data-act="edit-skill"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.skill;
        const skill = st.skills.find(s => s.id === id);
        if (skill) Modal.openSkillDetail(skill);
      });
    });

    root.querySelector('[data-act="new-skill"]')?.addEventListener('click', () => {
      Modal.openNewSkill();
    });
    root.querySelector('[data-act="import-skill"]')?.addEventListener('click', () => {
      Modal.openImportSkill();
    });

    root.querySelectorAll('[data-act="import-pro-skill"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.skill;
        const msg = document.getElementById(`msg-pro-${id}`);
        btn.disabled = true;
        try {
          const res = await fetch(`/api/skills/pro/${encodeURIComponent(id)}/import`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.ok) {
            await Promise.all([App.fetchSkills(), App.fetchProSkills()]);
            App.rerender();
          } else if (msg) {
            msg.textContent = data.error || t('skills.pro.err');
            msg.style.color = 'var(--error)';
            msg.style.display = '';
            btn.disabled = false;
          }
        } catch {
          if (msg) { msg.textContent = t('common.conn.error'); msg.style.color = 'var(--error)'; msg.style.display = ''; }
          btn.disabled = false;
        }
      });
    });
  },
};
