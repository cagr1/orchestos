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
   2 · TASKS  (Table)
   ============================================================ */
SCREENS.tasks = {
  render(st) {
    const head = `<div class="screen-head">
      <div class="lead"><h1>Tasks</h1><p>Current task list. Click a row to inspect or delete.</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} Refresh</button>
        <button class="btn primary" data-act="new-task">${ICON.plus} New Task</button>
      </div>
    </div>`;

    if (st.tasksStatus === 'loading')
      return `<div class="screen">${head}${loadingState('Loading tasks…')}</div>`;
    if (st.tasksStatus === 'error')
      return `<div class="screen">${head}${errorState('Could not load tasks', 'GET /api/tasks returned an error. Is tasks.yaml present in the working directory?')}</div>`;

    const tasks = st.tasks || [];
    if (tasks.length === 0)
      return `<div class="screen">${head}${emptyState(ICON.tasks, 'No tasks yet', 'Click "New Task" to create one, or run: orchestos task init')}</div>`;

    const rows = tasks.map(t => {
      const MAX = 72;
      const desc = t.description.length > MAX ? t.description.slice(0, MAX - 1) + '…' : t.description;
      const qa = t.qaVerdict
        ? `<span class="badge ${t.qaVerdict === 'pass' ? 'green' : 'red'} square">${esc(t.qaVerdict)}</span>`
        : `<span class="faint">—</span>`;
      const retryCls = t.retryCount >= 2 ? 'style="color:var(--warning);font-weight:600"' : '';
      const skillBadge = t.skill
        ? `<span class="badge blue square" style="font-size:9.5px;padding:1px 5px;margin-left:5px">${esc(t.skill)}</span>`
        : '';
      return `<tr class="row" data-task="${esc(t.id)}" title="${esc(t.description)}">
        <td><span class="badge ${STATUS_BADGE[t.status] || 'gray'}"><span class="d"></span>${esc(t.status)}</span></td>
        <td class="mono" style="color:var(--text);white-space:nowrap">${esc(t.id)}${skillBadge}</td>
        <td style="max-width:400px;color:var(--text-muted)">${esc(desc)}</td>
        <td class="mono faint" style="white-space:nowrap">${esc(t.executor || '—')}</td>
        <td class="num" ${retryCls}>${t.retryCount}</td>
        <td>${qa}</td>
      </tr>`;
    }).join('');

    // summary chips
    const counts = { pending: 0, running: 0, done: 0, failed: 0 };
    tasks.forEach(t => {
      const k = (t.status === 'failed_permanent' ? 'failed' : t.status);
      if (k in counts) counts[k]++;
    });
    const chips = Object.entries(counts).map(([k, n]) =>
      `<span class="badge ${STATUS_BADGE[k] || 'gray'} square" style="gap:5px">${n} ${k}</span>`
    ).join('');

    return `<div class="screen">${head}
      <div class="filters" style="margin-bottom:12px">${chips}</div>
      <div class="card" style="overflow:hidden">
        <table class="tbl">
          <thead><tr>
            <th style="width:140px">Status</th>
            <th style="width:200px">ID</th>
            <th>Description</th>
            <th style="width:110px">Executor</th>
            <th style="width:68px;text-align:right">Retries</th>
            <th style="width:72px">QA</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  },

  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelector('[data-act="new-task"]')?.addEventListener('click', () => Modal.openTask());
    root.querySelectorAll('[data-task]').forEach(tr => tr.addEventListener('click', () => {
      const t = (st.tasks || []).find(x => x.id === tr.dataset.task);
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
