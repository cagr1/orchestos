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
   2 · TASKS  (Table + compose bar)
   ============================================================ */
SCREENS.tasks = {
  render(st) {
    // H1 — two-phase compose: input → AI draft preview → confirm
    const draft = st.naturalDraft;
    const compose = draft
      ? `<div class="compose-bar compose-preview">
          <div class="draft-header">
            <span class="draft-label">${ICON.bolt} Borrador generado por IA — revisa y confirma</span>
            <button class="btn ghost sm" data-act="draft-cancel">Cancelar</button>
          </div>
          <div class="draft-fields">
            <div class="draft-field">
              <label>ID de tarea</label>
              <input id="draft-id" class="draft-input mono" value="${esc(draft.id)}">
            </div>
            <div class="draft-field" style="flex:2">
              <label>Descripción</label>
              <input id="draft-desc" class="draft-input" value="${esc(draft.description)}">
            </div>
          </div>
          <div class="draft-fields" style="margin-top:8px">
            <div class="draft-field" style="flex:2">
              <label>Archivos a crear o modificar <span class="muted">(uno por línea · opcional)</span></label>
              <textarea id="draft-output" class="draft-input" rows="2">${esc((draft.output || []).join('\n'))}</textarea>
            </div>
            <div class="draft-field">
              <label>${t('tasks.draft.field.executor')}</label>
              <select id="draft-exec" class="draft-input">
                <option value="openrouter" ${draft.executor === 'openrouter' ? 'selected' : ''}>${t('modal.task.exec.or')}</option>
                <option value="anthropic" ${draft.executor === 'anthropic' ? 'selected' : ''}>${t('modal.task.exec.ant')}</option>
                <option value="openai" ${draft.executor === 'openai' ? 'selected' : ''}>${t('modal.task.exec.oai')}</option>
              </select>
            </div>
          </div>
          <div class="compose-actions" style="margin-top:10px">
            <div id="compose-msg" style="font-size:12px;display:none;flex:1"></div>
            <span style="flex:1"></span>
            <button class="btn ghost" data-act="draft-cancel">Cancelar</button>
            <button class="btn primary" data-act="draft-confirm">${ICON.play} Confirmar y ejecutar</button>
          </div>
        </div>`
      : `<div class="compose-bar">
          <textarea id="compose-input" rows="2" placeholder="${t('tasks.compose.placeholder')}"></textarea>
          <div class="compose-actions">
            <div id="compose-id-preview" class="compose-hint muted"></div>
            <button class="btn primary" data-act="create-run">${ICON.play} ${t('tasks.compose.btn.run')}</button>
            <button class="btn ghost" data-act="new-task">${ICON.plus} ${t('btn.advanced')}</button>
          </div>
          <div id="compose-msg" style="font-size:12px;display:none;margin-top:6px"></div>
        </div>`;

    const head = `<div class="screen-head">
      <div class="lead"><h1>${t('tasks.title')}</h1><p>${t('tasks.subtitle')}</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} ${t('btn.refresh')}</button>
      </div>
    </div>`;

    if (st.tasksStatus === 'loading')
      return `<div class="screen">${head}${compose}${loadingState(t('tasks.loading'))}</div>`;
    if (st.tasksStatus === 'error')
      return `<div class="screen">${head}${compose}${errorState(t('tasks.err.title'), t('tasks.err.body'))}</div>`;

    const allTasks = st.tasks || [];
    if (allTasks.length === 0)
      return `<div class="screen">${head}${compose}${emptyState(ICON.tasks, t('tasks.empty.title'), t('tasks.empty.body'))}</div>`;

    // C2 — filter tabs
    const counts = { all: allTasks.length, pending: 0, running: 0, done: 0, failed: 0 };
    allTasks.forEach(t => {
      const k = (t.status === 'failed_permanent' ? 'failed' : t.status);
      if (k in counts) counts[k]++;
    });
    const filterLabels = {
      all: t('tasks.filter.all'), pending: t('tasks.filter.pending'),
      running: t('tasks.filter.running'), done: t('tasks.filter.done'), failed: t('tasks.filter.failed'),
    };
    const tabs = Object.entries(filterLabels).map(([k, label]) =>
      `<button class="filter-tab ${st.taskFilter === k ? 'active' : ''}" data-filter="${k}">
        ${label} <span class="tab-ct">${counts[k] || 0}</span>
      </button>`
    ).join('');

    // C1 — apply filter then sort
    const normalize = s => (s === 'failed_permanent' ? 'failed' : s);
    let tasks = st.taskFilter === 'all'
      ? allTasks
      : allTasks.filter(t => normalize(t.status) === st.taskFilter);

    const { col, dir } = st.taskSort;
    if (col) {
      const mul = dir === 'asc' ? 1 : -1;
      tasks = [...tasks].sort((a, b) => {
        if (col === 'status') return mul * normalize(a.status).localeCompare(normalize(b.status));
        if (col === 'retries') return mul * ((a.retryCount || 0) - (b.retryCount || 0));
        if (col === 'qa') return mul * (a.qaVerdict || '').localeCompare(b.qaVerdict || '');
        return 0;
      });
    }

    const sortIcon = c => col === c ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';

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

    return `<div class="screen">${head}${compose}
      <div class="filter-tabs" style="margin-bottom:12px">${tabs}</div>
      <div class="card" style="overflow:hidden">
        <table class="tbl">
          <thead><tr>
            <th class="sortable" data-sort="status" style="width:140px">${t('tasks.col.status')}<span class="sort-arrow">${sortIcon('status')}</span></th>
            <th style="width:200px">${t('tasks.col.id')}</th>
            <th>${t('tasks.col.desc')}</th>
            <th style="width:110px">${t('tasks.col.executor')}</th>
            <th class="sortable" data-sort="retries" style="width:68px;text-align:right">${t('tasks.col.retries')}<span class="sort-arrow">${sortIcon('retries')}</span></th>
            <th class="sortable" data-sort="qa" style="width:72px">${t('tasks.col.qa')}<span class="sort-arrow">${sortIcon('qa')}</span></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  },

  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelector('[data-act="new-task"]')?.addEventListener('click', () => Modal.openTask());

    const input = root.querySelector('#compose-input');
    const preview = root.querySelector('#compose-id-preview');
    const msg = root.querySelector('#compose-msg');

    input?.addEventListener('input', () => {
      const id = descToId(input.value);
      preview.textContent = id ? `ID: ${id}` : '';
    });

    // Phase 1 — call /api/natural → show draft preview
    root.querySelector('[data-act="create-run"]')?.addEventListener('click', async () => {
      const desc = input?.value.trim();
      if (!desc) {
        msg.textContent = 'Escribe una descripción primero.';
        msg.style.color = 'var(--error)'; msg.style.display = ''; return;
      }
      const btn = root.querySelector('[data-act="create-run"]');
      btn.disabled = true;
      btn.textContent = '⏳ Generando borrador…';
      msg.style.display = 'none';
      try {
        const res = await fetch('/api/natural', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: desc }),
        });
        if (!res.ok) {
          const e = await res.json();
          // fallback: skip AI, create directly with basic slug
          st.naturalDraft = { id: descToId(desc), description: desc, output: [], executor: 'openrouter' };
        } else {
          st.naturalDraft = await res.json();
        }
        App.rerender();
      } catch {
        // fallback on network error
        st.naturalDraft = { id: descToId(desc), description: desc, output: [], executor: 'openrouter' };
        App.rerender();
      } finally { if (btn) { btn.disabled = false; } }
    });

    // Phase 1 — cancel preview
    root.querySelector('[data-act="draft-cancel"]')?.addEventListener('click', () => {
      st.naturalDraft = null;
      App.rerender();
    });

    // Phase 2 — confirm draft → create + run
    root.querySelector('[data-act="draft-confirm"]')?.addEventListener('click', async () => {
      const id   = root.querySelector('#draft-id')?.value.trim();
      const desc = root.querySelector('#draft-desc')?.value.trim();
      const outRaw = root.querySelector('#draft-output')?.value.trim() || '';
      const executor = root.querySelector('#draft-exec')?.value || 'openrouter';
      const output = outRaw.split('\n').map(s => s.trim()).filter(Boolean);
      const msg2 = root.querySelector('#compose-msg');
      if (!id || !desc) {
        if (msg2) { msg2.textContent = 'ID y descripción son obligatorios.'; msg2.style.color = 'var(--error)'; msg2.style.display = 'flex'; }
        return;
      }
      const btn = root.querySelector('[data-act="draft-confirm"]');
      btn.disabled = true;
      try {
        const createRes = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, description: desc, output, executor }),
        });
        if (!createRes.ok) {
          const e = await createRes.json();
          if (msg2) { msg2.textContent = e.error || 'Error al crear la tarea.'; msg2.style.color = 'var(--error)'; msg2.style.display = 'flex'; }
          return;
        }
        const created = await createRes.json();
        const taskId = created.id || id;
        await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run`, { method: 'POST' });
        st.naturalDraft = null;
        await App.fetchTasks();
        App.rerender();
      } catch {
        if (msg2) { msg2.textContent = 'Error de conexión.'; msg2.style.color = 'var(--error)'; msg2.style.display = 'flex'; }
      } finally { if (btn) btn.disabled = false; }
    });

    // C2 — filter tabs
    root.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
      st.taskFilter = btn.dataset.filter;
      App.rerender();
    }));

    // C1 — sortable headers
    root.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (st.taskSort.col === col) {
        st.taskSort.dir = st.taskSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        st.taskSort = { col, dir: 'asc' };
      }
      App.rerender();
    }));

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
      <div class="lead"><h1>${t('memory.title')}</h1><p>${t('memory.subtitle')}</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} ${t('btn.refresh')}</button>
      </div>
    </div>`;

    const memory = st.memory || [];
    const scopes = ['all', 'session', 'project', 'global'];
    const scopeLabel = sc => t(`memory.scope.${sc}`);
    const counts = sc => sc === 'all' ? memory.length : memory.filter(m => m.scope === sc).length;
    const scopeList = scopes.map(sc => `
      <div class="scope-opt ${st.memScope === sc ? 'on' : ''}" data-sc="${sc}">
        <span class="sc-dot" ${sc === 'all' ? 'style="background:var(--text-faint)"' : ''}></span>
        <span>${scopeLabel(sc)}</span>
        <span class="ct">${counts(sc)}</span>
      </div>`).join('');

    const left = `<div class="mem-search">
      <h3>${t('memory.filter')}</h3>
      <div class="mem-query-wrap">
        <input id="mem-query" class="mem-query-input" type="search"
          placeholder="${t('memory.search.ph')}"
          value="${esc(st.memQuery || '')}">
      </div>
      <div>
        <div style="font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-faint);margin-bottom:9px">${t('memory.scope')}</div>
        <div class="scope-list">${scopeList}</div>
      </div>
    </div>`;

    let right;
    if (st.memoryStatus === 'loading') {
      right = loadingState(t('memory.loading'));
    } else if (st.memoryStatus === 'error') {
      right = errorState('Memory', t('memory.err'));
    } else if (memory.length === 0) {
      right = emptyState(ICON.memory, t('memory.empty.title'), t('memory.empty.body'));
    } else {
      const q = (st.memQuery || '').toLowerCase().trim();
      let rows = memory.filter(m => st.memScope === 'all' || m.scope === st.memScope);
      if (q) rows = rows.filter(m =>
        (m.topicKey || '').toLowerCase().includes(q) ||
        (m.content  || '').toLowerCase().includes(q)
      );
      const scopeCls = sc => sc === 'session' ? 'amber' : sc === 'project' ? 'blue' : 'green';
      right = rows.length
        ? `<div class="mem-results">` + rows.map(m => `
          <div class="mem-card" data-topic="${esc(m.topicKey)}">
            <div class="top">
              <span class="topic">${esc(m.topicKey)}</span>
              <span class="badge ${scopeCls(m.scope)} square">${scopeLabel(m.scope)}</span>
              <span class="when">${esc((m.updatedAt || '').slice(0, 10))}</span>
            </div>
            <div class="preview">${esc(m.content)}</div>
            <div class="full-note"><span>${t('common.expand')}</span></div>
          </div>`).join('') + `</div>`
        : emptyState(ICON.memory, t('memory.no.title'), q ? t('memory.no.body', esc(q)) : t('memory.empty.body'));
    }

    return `<div class="screen">${head}<div class="mem-grid">${left}${right}</div></div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelectorAll('[data-sc]').forEach(s => s.addEventListener('click', () => {
      st.memScope = s.dataset.sc; App.rerender();
    }));
    const qInput = root.querySelector('#mem-query');
    qInput?.addEventListener('input', () => {
      // Save cursor position before rerender destroys the DOM
      const pos = qInput.selectionStart;
      st.memQuery = qInput.value;
      App.rerender();
      // Restore focus + cursor to the new input after paint
      requestAnimationFrame(() => {
        const ni = document.getElementById('mem-query');
        if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch {} }
      });
    });
    root.querySelectorAll('[data-topic]').forEach(c => c.addEventListener('click', () => {
      c.classList.toggle('exp');
      const note = c.querySelector('.full-note span');
      if (note) note.textContent = c.classList.contains('exp') ? t('common.collapse') : t('common.expand');
    }));
  },
};
