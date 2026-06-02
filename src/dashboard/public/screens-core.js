/* ============================================================
   OrchestOS — screens: Runner, Tasks, Memory
   ============================================================ */
window.SCREENS = window.SCREENS || {};

/* ============================================================
   1 · RUNNER  (recent runs as live feed)
   ============================================================ */
SCREENS.runner = {
  render(st) {
    const runs = st.runs || [];

    let feedInner;
    if (st.runsStatus === 'loading') {
      feedInner = `<div class="placeholder" style="padding:34px"><div class="spinner"></div><h3>Loading…</h3></div>`;
    } else if (runs.length === 0) {
      feedInner = `<div class="placeholder" style="padding:34px"><div class="pic">${ICON.play}</div>
        <h3>No runs yet</h3><p>Use the CLI to execute tasks — completed runs will appear here.</p></div>`;
    } else {
      feedInner = `<div class="feed-body">` + runs.slice(0, 8).map(r => {
        const cls = r.status === 'done' ? 'ok' : r.status === 'failed' ? 'err' : 'run';
        const tag = r.taskId ? `[${r.taskId}]` : `[${r.id.slice(0, 8)}]`;
        const verdict = r.qaVerdict ? ` · qa:${esc(r.qaVerdict)}` : '';
        const cost = `$${Number(r.costUsd).toFixed(4)}`;
        const ts = (r.createdAt || '').slice(0, 19);
        return `<div class="feed-line ${cls}">
          <span class="ts">${esc(ts)}</span>
          <span class="msg"><span class="tag">${esc(tag)}</span> ${esc(r.model)}  ${esc(r.status)}${verdict}  ${esc(cost)}</span>
        </div>`;
      }).join('') + `</div>`;
    }

    const activeCount = (st.tasks || []).filter(t => t.status === 'running').length;

    return `<div class="screen">
      <div class="screen-head">
        <div class="lead"><h1>Runner</h1><p>Orchestrate agents from the CLI — monitor execution here.</p></div>
        <div class="tools">
          <button class="btn" data-act="refresh">${ICON.refresh} Refresh</button>
        </div>
      </div>
      <div class="runner-grid">
        <div class="compose">
          <textarea placeholder="Run tasks from the CLI:&#10;  orchestos task run --all&#10;  orchestos task run task-id&#10;&#10;Results appear in the feed below." readonly style="color:var(--text-faint);font-family:var(--mono);font-size:12.5px;cursor:default"></textarea>
          <div class="actions">
            <span class="hint">orchestos task run --all</span>
            <span class="spacer"></span>
            <span class="badge ${activeCount > 0 ? 'blue' : 'gray'}"><span class="d"></span>${activeCount > 0 ? activeCount + ' running' : 'idle'}</span>
          </div>
        </div>
        <div class="feed">
          <div class="feed-head">
            ${activeCount > 0 ? '<span class="live-dot"></span>' : ''}
            <h3>Recent Runs</h3>
            <span class="spacer"></span>
            <span class="badge gray">${runs.length} total</span>
          </div>
          ${feedInner}
        </div>
      </div>
    </div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
  },
};

/* ============================================================
   2 · TASKS  (Kanban)
   ============================================================ */
const KCOLS = [
  { k:'pending',  label:'Pending' },
  { k:'running',  label:'Running' },
  { k:'done',     label:'Done' },
  { k:'failed',   label:'Failed' },
  { k:'blocked',  label:'Blocked' },
];

SCREENS.tasks = {
  render(st) {
    const head = `<div class="screen-head">
      <div class="lead"><h1>Tasks</h1><p>Kanban of the current run. Click a card for details.</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} Refresh</button>
      </div>
    </div>`;

    if (st.tasksStatus === 'loading')
      return `<div class="screen">${head}${loadingState('Loading tasks…')}</div>`;
    if (st.tasksStatus === 'error')
      return `<div class="screen">${head}${errorState('Could not load tasks', 'GET /api/tasks returned an error. Is tasks.yaml present?')}</div>`;

    const tasks = st.tasks || [];
    if (tasks.length === 0)
      return `<div class="screen">${head}${emptyState(ICON.tasks, 'No tasks yet', 'Run a plan from the CLI to populate the board.')}</div>`;

    const cols = KCOLS.map(c => {
      const normalised = c.k === 'failed'
        ? tasks.filter(t => t.status === 'failed' || t.status === 'failed_permanent')
        : tasks.filter(t => t.status === c.k);
      const body = normalised.length
        ? normalised.map(t => this.card(t)).join('')
        : `<div class="kcol-empty">No tasks</div>`;
      return `<div class="kcol" data-k="${c.k}">
        <div class="kcol-head"><span class="dot"></span><h3>${c.label}</h3><span class="count">${normalised.length}</span></div>
        <div class="kcol-body">${body}</div>
      </div>`;
    }).join('');

    return `<div class="screen">${head}<div class="kanban">${cols}</div></div>`;
  },

  card(t) {
    const retryCls = t.retryCount >= 2 ? 'warn' : '';
    const skillBadge = t.skill ? `<span class="badge ${STATUS_BADGE[t.status] || 'gray'} square" style="font-size:9.5px;padding:1px 6px">${esc(t.skill)}</span>` : '';
    return `<div class="kcard" data-task="${esc(t.id)}">
      <div class="id"><span>${esc(t.id)}</span>${skillBadge}</div>
      <div class="desc">${esc(t.description)}</div>
      <div class="foot">
        ${t.executor ? `<span class="faint mono" style="font-size:10.5px">${esc(t.executor)}</span>` : ''}
        <span class="retry ${retryCls}">↻ ${t.retryCount}</span>
      </div>
    </div>`;
  },

  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelectorAll('[data-task]').forEach(c => c.addEventListener('click', () => {
      const t = (st.tasks || []).find(x => x.id === c.dataset.task);
      if (t) SidePanel.openTask(t);
    }));
  },
};

/* ============================================================
   3 · MEMORY
   ============================================================ */
SCREENS.memory = {
  render(st) {
    const head = `<div class="screen-head">
      <div class="lead"><h1>Memory</h1><p>Search the agent's working memory across scopes.</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} Refresh</button>
      </div>
    </div>`;

    const memory = st.memory || [];
    const scopes = ['all', 'session', 'project', 'global'];
    const counts = sc => sc === 'all' ? memory.length : memory.filter(m => m.scope === sc).length;
    const scopeList = scopes.map(sc => `
      <div class="scope-opt ${st.memScope === sc ? 'on' : ''}" data-sc="${sc}">
        <span class="sc-dot" ${sc === 'all' ? 'style="background:var(--text-faint)"' : ''}></span>
        <span style="text-transform:capitalize">${sc}</span>
        <span class="ct">${counts(sc)}</span>
      </div>`).join('');

    const left = `<div class="mem-search">
      <h3>Filter</h3>
      <div>
        <div style="font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-faint);margin-bottom:9px">Scope</div>
        <div class="scope-list">${scopeList}</div>
      </div>
    </div>`;

    let right;
    if (st.memoryStatus === 'loading') {
      right = loadingState('Loading memory…');
    } else if (st.memoryStatus === 'error') {
      right = errorState('Search failed', 'GET /api/memory returned an error.');
    } else if (memory.length === 0) {
      right = emptyState(ICON.memory, 'No memory entries yet', 'Run tasks to populate the memory store.');
    } else {
      const rows = memory.filter(m => st.memScope === 'all' || m.scope === st.memScope);
      right = rows.length
        ? `<div class="mem-results">` + rows.map(m => `
          <div class="mem-card" data-topic="${esc(m.topicKey)}">
            <div class="top">
              <span class="topic">${esc(m.topicKey)}</span>
              <span class="badge ${m.scope === 'session' ? 'amber' : m.scope === 'project' ? 'blue' : 'green'} square">${m.scope}</span>
              <span class="when">${esc((m.updatedAt || '').slice(0, 10))}</span>
            </div>
            <div class="preview">${esc(m.content)}</div>
            <div class="full-note"><span>↵ click to expand</span></div>
          </div>`).join('') + `</div>`
        : emptyState(ICON.memory, 'No matches', `No <b>${st.memScope}</b>-scoped entries.`);
    }

    return `<div class="screen">${head}<div class="mem-grid">${left}${right}</div></div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelectorAll('[data-sc]').forEach(s => s.addEventListener('click', () => {
      st.memScope = s.dataset.sc; App.rerender();
    }));
    root.querySelectorAll('[data-topic]').forEach(c => c.addEventListener('click', () => {
      c.classList.toggle('exp');
      const note = c.querySelector('.full-note span');
      if (note) note.textContent = c.classList.contains('exp') ? '↑ click to collapse' : '↵ click to expand';
    }));
  },
};
