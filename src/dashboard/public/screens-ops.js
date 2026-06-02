/* ============================================================
   OrchestOS — screens: Instincts, Runs, Specs
   ============================================================ */
window.SCREENS = window.SCREENS || {};

/* ============================================================
   4 · INSTINCTS
   ============================================================ */
SCREENS.instincts = {
  verdict(i) {
    if (!i.verified) return { cls: 'amber', txt: 'PROPOSAL' };
    if (i.confidence >= 0.8) return { cls: 'green', txt: 'ACTIVE' };
    return { cls: 'gray', txt: 'INACTIVE' };
  },
  confBar(c) {
    const cls = c >= 0.8 ? 'hi' : c < 0.6 ? 'lo' : '';
    return `<div class="conf"><div class="track"><i class="${cls}" style="width:${Math.round(c * 100)}%"></i></div><span class="pct">${Number(c).toFixed(2)}</span></div>`;
  },
  row(i) {
    const v = this.verdict(i);
    const src = i.source === 'manual' ? 'blue' : 'orange';
    const actions = !i.verified
      ? `<div class="inline-actions">
           <button class="btn success sm" data-approve="${esc(i.id)}">${ICON.check} Approve</button>
           <button class="btn danger sm" data-reject="${esc(i.id)}">${ICON.x} Reject</button>
         </div>`
      : `<span class="badge ${v.cls}"><span class="d"></span>${v.txt}</span>`;
    return `<tr class="${!i.verified ? 'proposal' : ''}">
      <td><span class="mono" style="color:var(--text)">${esc(i.trigger)}</span></td>
      <td class="muted">${esc(i.action)}</td>
      <td>${this.confBar(i.confidence)}</td>
      <td><span class="badge ${src} square">${esc(i.source)}</span></td>
      <td style="text-align:right">${actions}</td>
    </tr>`;
  },
  render(st) {
    const head = `<div class="screen-head">
      <div class="lead"><h1>Instincts</h1><p>Learned triggers that steer how the orchestrator behaves.</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} Refresh</button>
        <button class="btn primary" data-act="add-instinct">${ICON.plus} Add Instinct</button>
      </div>
    </div>`;

    if (st.instinctsStatus === 'loading')
      return `<div class="screen">${head}${loadingState('Loading instincts…')}</div>`;
    if (st.instinctsStatus === 'error')
      return `<div class="screen">${head}${errorState('Could not load instincts', 'GET /api/instincts failed. Verify the instincts table migration has run.')}</div>`;

    const all = st.instincts || [];
    if (all.length === 0)
      return `<div class="screen">${head}${emptyState(ICON.instinct, 'No instincts yet', 'Add one manually, or let runs propose instincts automatically as patterns emerge.')}</div>`;

    const proposals = all.filter(i => !i.verified);
    const table = `<div class="card" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Trigger</th><th>Action</th><th style="width:150px">Confidence</th><th style="width:90px">Source</th><th style="width:170px;text-align:right">State</th></tr></thead>
        <tbody>${all.map(i => this.row(i)).join('')}</tbody>
      </table>
    </div>`;

    const proposalSection = proposals.length ? `
      <div class="section-title"><span>Pending Proposals</span><span class="ct">${proposals.length}</span></div>
      ${proposals.map(i => `
        <div class="proposal-card">
          <div class="pc-main">
            <div class="pc-trig"><span class="mono">${esc(i.trigger)}</span><span class="arrow">→</span><span class="muted">${esc(i.action)}</span></div>
            <div class="pc-meta"><span class="badge orange square">${esc(i.source)}</span>${this.confBar(i.confidence)}</div>
          </div>
          <div class="inline-actions">
            <button class="btn success sm" data-approve="${esc(i.id)}">${ICON.check} Approve</button>
            <button class="btn danger sm" data-reject="${esc(i.id)}">${ICON.x} Reject</button>
          </div>
        </div>`).join('')}` : '';

    return `<div class="screen">${head}${table}${proposalSection}</div>`;
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
      : `<div class="grp"><h4>Cost Breakdown</h4><div class="muted" style="font-size:12.5px">Single-agent run — total ${usd(r.costUsd)}.</div></div>`;

    /* contextWarnings: {code, severity: 'warning'|'critical'|'notice', message} */
    const warns = r.contextWarnings && r.contextWarnings.length
      ? `<div class="grp"><h4>Context Warnings</h4>` +
        r.contextWarnings.map(w => {
          const c = w.severity === 'critical' ? 'var(--error)' : w.severity === 'warning' ? 'var(--warning)' : 'var(--accent)';
          return `<div class="warn-item"><span class="badge square" style="color:${c};border-color:${c};background:transparent">${esc(w.severity)}</span><span style="color:var(--text)">${esc(w.message)}</span></div>`;
        }).join('') + `</div>`
      : `<div class="grp"><h4>Context Warnings</h4><div class="muted" style="font-size:12.5px">None — context stayed within budget.</div></div>`;

    const qa = r.qaVerdict
      ? `<div class="grp"><h4>QA Verdict</h4>
           <div class="kv"><span class="k">Verdict</span><span class="v"><span class="badge ${r.qaVerdict === 'pass' ? 'green' : 'red'}">${r.qaVerdict}</span></span></div>
         </div>`
      : '';

    const meta = `<div class="grp"><h4>Run Details</h4>
      ${r.skillId ? `<div class="kv"><span class="k">Skill</span><span class="v">${esc(r.skillId)}</span></div>` : ''}
      ${r.provider ? `<div class="kv"><span class="k">Provider</span><span class="v">${esc(r.provider)}</span></div>` : ''}
      ${r.elapsedMs ? `<div class="kv"><span class="k">Elapsed</span><span class="v">${(r.elapsedMs / 1000).toFixed(1)}s</span></div>` : ''}
    </div>`;

    return `<tr class="detail-row"><td colspan="7"><div class="detail">${bd}${warns}${qa}${meta}</div></td></tr>`;
  },
  render(st) {
    const head = `<div class="screen-head">
      <div class="lead"><h1>Runs</h1><p>Execution history with cost, tokens and QA outcomes.</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} Refresh</button>
      </div>
    </div>`;

    if (st.runsStatus === 'loading')
      return `<div class="screen">${head}${loadingState('Loading runs…')}</div>`;
    if (st.runsStatus === 'error')
      return `<div class="screen">${head}${errorState('Could not load runs', 'GET /api/runs returned an error. Is the SQLite store reachable?')}</div>`;

    const runs = st.runs || [];
    if (runs.length === 0)
      return `<div class="screen">${head}${emptyState(ICON.runs, 'No runs yet', 'Execute a task from the CLI — completed runs land here with full cost and QA detail.')}</div>`;

    const filters = `<div class="filters">
      <span class="filter-label">${runs.length} run${runs.length !== 1 ? 's' : ''}</span>
    </div>`;

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

    return `<div class="screen">${head}${filters}
      <div class="card" style="overflow:hidden">
        <table class="tbl">
          <thead><tr><th style="width:90px">Status</th><th>Task ID</th><th>Model</th><th>Tokens (in/out)</th><th>Cost</th><th style="width:80px">Warn</th><th>Date</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div></div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelectorAll('[data-run]').forEach(tr => tr.addEventListener('click', () => {
      st.openRun = st.openRun === tr.dataset.run ? null : tr.dataset.run;
      App.rerender();
    }));
  },
};

/* ============================================================
   6 · SPECS
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
    const head = `<div class="screen-head">
      <div class="lead"><h1>Specs</h1><p>Capability specs and their lint health.</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} Refresh</button>
      </div>
    </div>`;

    if (st.specsStatus === 'loading')
      return `<div class="screen">${head}${loadingState('Loading specs…')}</div>`;
    if (st.specsStatus === 'error')
      return `<div class="screen">${head}${errorState('Could not load specs', 'GET /api/specs failed. The specs/ directory may be missing or unreadable.')}</div>`;

    const specs = st.specs || [];
    if (specs.length === 0)
      return `<div class="screen">${head}${emptyState(ICON.specs, 'No specs yet', 'Specs are generated from approved plans. Run a project to create the first one.')}</div>`;

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

    return `<div class="screen">${head}${table(active)}${archSection}</div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelectorAll('[data-spec]').forEach(tr => tr.addEventListener('click', () => {
      st.openSpec = st.openSpec === tr.dataset.spec ? null : tr.dataset.spec;
      App.rerender();
    }));
    root.querySelector('[data-arch]')?.addEventListener('click', () => { st.archOpen = !st.archOpen; App.rerender(); });
  },
};
