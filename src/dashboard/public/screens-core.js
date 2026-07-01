/* ============================================================
   OrchestOS — screens: Runner, Tasks, Memory, Chat
   ============================================================ */
window.SCREENS = window.SCREENS || {};

/* ============================================================
   0 · CHAT
   ============================================================ */
SCREENS.chat = {
  render(st) {
    const history = st.chatHistory || [];
    const thinkingBubble = st.chatPending
      ? `<div class="chat-msg assistant"><div class="chat-bubble chat-thinking"><span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>${t('chat.thinking')}</div></div>`
      : '';

    const msgs = history.length === 0
      ? `<div class="chat-empty"><p>${t('chat.empty')}</p></div>`
      : history.map(m => {
          const text = esc(m.content).replace(/\n/g, '<br>');
          const modelTag = m.role === 'assistant' && m.model
            ? `<div class="chat-model-tag">${esc(m.model)}</div>` : '';
          return `<div class="chat-msg ${m.role === 'user' ? 'user' : 'assistant'}"><div class="chat-bubble">${text}${modelTag}</div></div>`;
        }).join('') + thinkingBubble;

    // FRONT.6 — combobox de altura única (trigger + panel con búsqueda integrada), reemplaza
    // el viejo layout de dos filas (input de búsqueda arriba + <select> nativo + botón de refresh).
    const modelCombo = buildModelCombo(st.chatModel, st.orModels, st.localModels, st.chatModelComboOpen);

    // FRONT.1 — oculto/disabled salvo que el modelo elegido tenga supportsReasoning:true real (BACK.4)
    const effortSelect = modelSupportsReasoning(st.chatModel, st.orModels)
      ? `<select id="chat-effort-select" class="model-sel chat-effort-sel" title="${t('chat.effort.label')}">
          <option value="low" ${st.chatEffort === 'low' ? 'selected' : ''}>${t('chat.effort.low')}</option>
          <option value="medium" ${st.chatEffort === 'medium' ? 'selected' : ''}>${t('chat.effort.medium')}</option>
          <option value="high" ${st.chatEffort === 'high' ? 'selected' : ''}>${t('chat.effort.high')}</option>
        </select>`
      : '';

    // D0-3 — local model warning banner (shown once per session)
    const isLocalModel = (st.chatModel || '').startsWith('ollama/');
    const localWarnDismissed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ollama-warn-shown');
    const localWarnBanner = isLocalModel && !localWarnDismissed
      ? `<div class="local-model-warn" data-act="local-warn-dismiss">${t('chat.local.warn')} <button class="btn ghost sm" style="margin-left:8px;padding:1px 8px" data-act="local-warn-dismiss">×</button></div>`
      : '';

    const clearBtn = history.length > 0
      ? `<button class="btn ghost sm" data-act="chat-clear">${t('chat.clear')}</button>` : '';

    // D3 — attachment chip
    const attachChip = st.chatFileMeta
      ? `<div class="chat-attach-chip">
          <span class="chat-attach-icon">${ICON.attachment}</span>
          <span class="chat-attach-name">${esc(st.chatFileMeta.filename)}</span>
          <span class="chat-attach-preview">${esc(st.chatFileMeta.preview || '')}</span>
          <button class="btn ghost sm" data-act="chat-file-remove" style="padding:1px 6px;font-size:14px;line-height:1">×</button>
        </div>`
      : '';

    // D4 — "Create task" bar (visible after 4+ messages)
    const createTaskBar = history.length >= 3
      ? `<div class="chat-create-task-bar">
          <span class="chat-create-task-hint">${t('chat.createTaskHint')}</span>
          <button class="btn primary sm" data-act="chat-create-task">${ICON.tasks} ${t('chat.createTask')}</button>
        </div>`
      : '';

    return `<div class="screen chat-screen">
      <div class="screen-head">
        <div class="lead"><h1>${t('chat.title')}</h1><p>${t('chat.subtitle')}</p></div>
        <div class="tools" style="align-items:center;gap:8px">${modelCombo}${effortSelect}${clearBtn}</div>
      </div>
      ${localWarnBanner}
      <div class="chat-area" id="chat-area">${msgs}</div>
      ${createTaskBar}
      <div class="chat-input-bar">
        ${attachChip}
        <div class="chat-input-row">
          <div class="attach-menu-wrap" data-attach-menu>
            <button class="chat-icon-btn chat-attach-btn" data-act="chat-attach" title="${t('chat.btn.attach')}" aria-label="${t('chat.btn.attach')}">${ICON.plus}</button>
            ${st.chatAttachMenuOpen ? `<div class="attach-menu">
              <button class="attach-menu-item" data-attach-kind="image">${ICON.image}<span>${t('chat.attachMenu.image')}</span></button>
              <button class="attach-menu-item" data-attach-kind="doc">${ICON.specs}<span>${t('chat.attachMenu.doc')}</span></button>
              <button class="attach-menu-item" data-attach-kind="url">${ICON.globe}<span>${t('chat.attachMenu.url')}</span></button>
            </div>` : ''}
          </div>
          <textarea id="chat-input" rows="2" placeholder="${t('chat.placeholder')}" ${st.chatPending ? 'disabled' : ''}></textarea>
          <button class="chat-icon-btn chat-send-btn" data-act="chat-send" title="${t('chat.btn.send')}" aria-label="${t('chat.btn.send')}" ${st.chatPending ? 'disabled' : ''}>${ICON.send}</button>
        </div>
        <input type="file" id="chat-file-input" accept="image/*,.pdf,.txt,.md" style="display:none">
      </div>
    </div>`;
  },

  wire(root, st) {
    const scrollBottom = () => requestAnimationFrame(() => {
      const area = document.getElementById('chat-area');
      if (area) area.scrollTop = area.scrollHeight;
    });

    // FRONT.9 — auto-grow del textarea hasta max-height (CSS), igual que Hermes/ChatGPT.
    const textareaEl = root.querySelector('#chat-input');
    const autoGrowTextarea = () => {
      if (!textareaEl) return;
      // ver autoGrowCompose() más abajo — mismo guard defensivo contra
      // placeholders multilínea inflando scrollHeight con el campo vacío.
      if (!textareaEl.value) { textareaEl.style.height = ''; return; }
      textareaEl.style.height = 'auto';
      textareaEl.style.height = Math.min(textareaEl.scrollHeight, 120) + 'px';
    };
    textareaEl?.addEventListener('input', autoGrowTextarea);

    const send = async () => {
      const textarea = root.querySelector('#chat-input');
      const msg = textarea?.value.trim();
      if (!msg || st.chatPending) return;
      textarea.value = '';
      textarea.style.height = ''; // FRONT.9 — vuelve a la altura base de 2 filas
      st.chatHistory = st.chatHistory || [];
      st.chatHistory.push({ role: 'user', content: msg });
      st.chatPending = true;
      const sentFileId = st.chatFileId;
      const sentFileMeta = st.chatFileMeta;
      st.chatFileId = null;
      st.chatFileMeta = null;
      App.rerender();
      scrollBottom();
      try {
        const body = {
          history: st.chatHistory.slice(0, -1),
          message: msg,
          model: st.chatModel || 'deepseek/deepseek-v4-flash',
        };
        if (sentFileId) body.fileId = sentFileId;
        // FRONT.1 — solo se manda si el control está visible (modelo con supportsReasoning:true)
        if (modelSupportsReasoning(st.chatModel, st.orModels)) body.effort = st.chatEffort || 'medium';
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          st.chatHistory.push({ role: 'assistant', content: data.text, model: data.model });
        } else {
          st.chatHistory.push({ role: 'assistant', content: t('chat.err.general') });
        }
      } catch {
        st.chatHistory.push({ role: 'assistant', content: t('chat.err.conn') });
      } finally {
        st.chatPending = false;
        App.rerender();
        scrollBottom();
      }
    };

    root.querySelector('#chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    root.querySelector('[data-act="chat-send"]')?.addEventListener('click', send);
    root.querySelector('[data-act="chat-clear"]')?.addEventListener('click', () => {
      st.chatHistory = [];
      st.chatPending = false;
      st.chatFileId = null;
      st.chatFileMeta = null;
      App.rerender();
    });

    // FRONT.9 — el botón "+" ahora abre un menú de tipo de adjunto en vez de
    // disparar el file-picker directo (Imagen / Documento / URL).
    root.querySelector('[data-act="chat-attach"]')?.addEventListener('click', e => {
      e.stopPropagation();
      st.chatAttachMenuOpen = !st.chatAttachMenuOpen;
      App.rerender();
    });
    root.querySelectorAll('[data-attach-kind]').forEach(btn => btn.addEventListener('click', () => {
      const kind = btn.dataset.attachKind;
      st.chatAttachMenuOpen = false;
      const input = root.querySelector('#chat-file-input');
      if (kind === 'url') {
        // El chat ya puede leer una URL pegada en el mensaje (FETCH_URL_TOOL,
        // Mes 13) — no hace falta subir nada, solo guiar al usuario.
        App.rerender();
        const ta = document.getElementById('chat-input');
        ta?.focus();
        showToast(t('chat.attachMenu.urlHint'));
        return;
      }
      if (input) input.accept = kind === 'image' ? 'image/*' : '.pdf,.txt,.md';
      App.rerender();
      input?.click();
    }));

    // D3 — file input change → upload
    root.querySelector('#chat-file-input')?.addEventListener('change', async () => {
      const input = root.querySelector('#chat-file-input');
      const file = input?.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      const clipBtn = root.querySelector('[data-act="chat-attach"]');
      if (clipBtn) clipBtn.disabled = true;
      try {
        const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          st.chatFileId = data.fileId;
          st.chatFileMeta = { filename: data.filename, type: data.type, preview: data.preview };
        } else if (res.status === 413) {
          showToast(t('chat.file.tooLarge'), 'error');
        } else {
          showToast(t('chat.file.err'), 'error');
        }
      } catch {
        showToast(t('chat.file.err'), 'error');
      } finally {
        input.value = '';
        App.rerender();
      }
    });

    // D3 — remove attachment
    root.querySelector('[data-act="chat-file-remove"]')?.addEventListener('click', () => {
      st.chatFileId = null;
      st.chatFileMeta = null;
      App.rerender();
    });
    // FRONT.6 — model combobox: trigger toggles the panel open/closed. Opening
    // also triggers a silent refresh — loadOrModels() is already TTL-gated
    // internally (no-ops if the cache is fresh), so this replaces the old
    // manual refresh button without spamming the network on every open.
    root.querySelector('[data-combo-trigger]')?.addEventListener('click', e => {
      e.stopPropagation();
      const opening = !st.chatModelComboOpen;
      st.chatModelComboOpen = opening;
      App.rerender();
      if (opening) loadOrModels().then(() => { if (st.chatModelComboOpen) App.rerender(); });
    });
    root.querySelector('[data-combo-list]')?.addEventListener('click', e => {
      const opt = e.target.closest('[data-combo-option]');
      if (!opt) return;
      st.chatModel = opt.dataset.value;
      st.chatModelComboOpen = false;
      App.rerender(); // refresh warning banner + show/hide effort selector
    });
    // model search filter — patches the list in place (no full rerender, keeps input focus)
    root.querySelector('[data-combo-search]')?.addEventListener('input', e => {
      const q = e.target.value;
      const list = root.querySelector('[data-combo-list]');
      if (!list) return;
      const allCloud = Array.isArray(st.orModels) && st.orModels.length > 0 ? st.orModels : KNOWN_MODELS;
      const locals = Array.isArray(st.localModels) && st.localModels.length > 0 ? st.localModels : [];
      // Safe: all dynamic values (m.id, m.name) pass through esc(). query `q` is used only for filtering, never rendered.
      list.innerHTML = buildComboOptions(locals, allCloud, st.chatModel, q);
    });
    root.querySelector('#chat-effort-select')?.addEventListener('change', e => {
      st.chatEffort = e.target.value;
      localStorage.setItem('orchestos-chat-effort', e.target.value);
    });
    // D0-3 — dismiss local model warning
    root.querySelector('[data-act="local-warn-dismiss"]')?.addEventListener('click', () => {
      sessionStorage.setItem('ollama-warn-shown', '1');
      App.rerender();
    });

    // D4 — create task from conversation
    root.querySelector('[data-act="chat-create-task"]')?.addEventListener('click', () => {
      // D4 — seed the task composer with the last 3 user messages (concise, actionable).
      // The AI draft handler will turn this into a structured task — no need to dump the full conversation.
      const history = st.chatHistory || [];
      const seed = history
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content.trim())
        .filter(Boolean)
        .join('\n');
      st.chatToTask = seed || '';
      App.go('tasks');
    });

    // Auto-load models on first visit (only once — orModelsAttempted prevents a retry-loop when the fetch keeps failing)
    if (st.orModels === null && !st.orModelsAttempted) {
      loadOrModels().then(() => App.rerender());
    }
    // D0-3 — probe Ollama once per session
    if (st.localModels === null) {
      loadLocalModels().then(() => App.rerender());
    }

    scrollBottom();
  },
};

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
  diagnoseDetail(d) {
    const confKey = d.confidence === 'high' ? 'tasks.diagnose.conf.high'
      : d.confidence === 'medium' ? 'tasks.diagnose.conf.med'
      : 'tasks.diagnose.conf.low';
    // Human-readable pattern labels — covers all FailurePattern values
    const patternHuman = {
      deterministic_check:   t('tasks.diagnose.pattern.deterministic'),
      qa_specific_criterion: t('tasks.diagnose.pattern.qa'),
      parse_error:           t('tasks.diagnose.pattern.parse'),
      rate_limit:            t('tasks.diagnose.pattern.rate_limit'),
      scope_creep:           t('tasks.diagnose.pattern.scope'),
      context_overflow:      t('tasks.diagnose.pattern.context'),
      unknown:               t('tasks.diagnose.pattern.unknown'),
    };
    // patternLabel for HTML rendering — fallback escaped to prevent XSS
    const patternLabel = patternHuman[d.pattern] || esc(d.pattern);
    // habitTrigger for data-* attribute — uses raw strings (esc applied at the attribute site)
    const habitTrigger = `${t('tasks.diagnose.habit.trigger.prefix')} "${d.taskId}" (${patternHuman[d.pattern] || d.pattern})`;
    return `<tr class="detail-row"><td colspan="7"><div class="detail">
      <div class="grp"><h4>${t('tasks.diagnose.title')}</h4>
        <div class="kv"><span class="k">${t('tasks.diagnose.pattern')}</span><span class="v">${patternLabel}</span></div>
        <div class="kv"><span class="k">${t('tasks.diagnose.confidence')}</span><span class="v">${t(confKey)}</span></div>
        <div class="kv"><span class="k">${t('tasks.diagnose.suggestion')}</span><span class="v">${esc(d.suggestion)}</span></div>
        <div class="kv"><span class="k">${t('tasks.diagnose.details')}</span><span class="v">${esc(d.details)}</span></div>
        ${d.lastErrorResult ? `<div class="kv"><span class="k">${t('tasks.diagnose.lastError')}</span><div class="v"><pre style="white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto;background:#1a1a2e;padding:8px;border-radius:4px;margin:4px 0">${esc(d.lastErrorResult)}</pre></div></div>` : ''}
        <div class="diag-actions" style="margin-top:12px;display:flex;gap:8px">
          <button class="btn primary sm" data-act="retry" data-task-id="${esc(d.taskId)}">${ICON.refresh} ${t('tasks.diagnose.retry')}</button>
          <button class="btn ghost sm" data-act="make-habit" data-trigger="${esc(habitTrigger)}" data-action="${esc(d.suggestion)}">${ICON.bolt} ${t('tasks.diagnose.habit')}</button>
        </div>
      </div>
    </div></td></tr>`;
  },

  render(st) {
    // H1 — two-phase compose: input → AI draft preview → confirm
    const draft = st.naturalDraft;
    const composeInitial = st.chatToTask || '';
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
              <label>${t('modal.task.model.label')}</label>
              ${buildModelSelect('draft-model', draft.executor_model || 'deepseek/deepseek-v4-flash', st.orModels)}
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
          <textarea id="compose-input" rows="2" placeholder="${t('tasks.compose.placeholder')}">${composeInitial ? esc(composeInitial) : ''}</textarea>
          <div class="compose-actions">
            <div id="compose-id-preview" class="compose-hint muted"></div>
            <button class="chat-icon-btn chat-send-btn" data-act="create-run" title="${t('tasks.compose.btn.run')}" aria-label="${t('tasks.compose.btn.run')}">${ICON.send}</button>
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
    allTasks.forEach(task => {
      const k = (task.status === 'failed_permanent' ? 'failed' : task.status);
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
      : allTasks.filter(task => normalize(task.status) === st.taskFilter);

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

    const rows = tasks.map(task => {
      const MAX = 72;
      const desc = task.description.length > MAX ? task.description.slice(0, MAX - 1) + '…' : task.description;
      const qa = task.qaVerdict
        ? `<span class="badge ${task.qaVerdict === 'pass' ? 'green' : 'red'} square">${esc(task.qaVerdict)}</span>`
        : `<span class="faint">—</span>`;
      const retryCls = task.retryCount >= 2 ? 'style="color:var(--warning);font-weight:600"' : '';
      const skillBadge = task.skill
        ? `<span class="badge blue square" style="font-size:9.5px;padding:1px 5px;margin-left:5px">${esc(task.skill)}</span>`
        : '';
      const failed = task.status === 'failed' || task.status === 'failed_permanent';
      const open = st.openDiagnose === task.id;
      const cached = st.diagnoseCache[task.id];
      const loading = cached === 'loading';
      const diagBtn = failed
        ? (loading
          ? `<span class="spinner sm" style="display:inline-block;margin:0 auto" title="${t('tasks.diagnose.loading')}"></span>`
          : cached
            ? `<span class="diag-link" data-diag="${esc(task.id)}">${open ? '▲' : '▼'}</span>`
            : `<span class="diag-link" data-diag="${esc(task.id)}">${t('tasks.diagnose.btn')}</span>`)
        : '';
      const main = `<tr class="row ${open ? 'open' : ''}" data-task="${esc(task.id)}" title="${esc(task.description)}">
        <td><span class="badge ${STATUS_BADGE[task.status] || 'gray'}"><span class="d"></span>${esc(task.status)}</span></td>
        <td class="mono" style="color:var(--text);white-space:nowrap">${esc(task.id)}${skillBadge}</td>
        <td style="max-width:400px;color:var(--text-muted)">${esc(desc)}</td>
        <td class="mono faint" style="white-space:nowrap">${esc(task.executor || '—')}</td>
        <td class="num" ${retryCls}>${task.retryCount}</td>
        <td>${qa}</td>
        <td style="text-align:center;vertical-align:middle">${diagBtn}</td>
      </tr>`;
      const detail = open && cached && cached !== 'loading' ? this.diagnoseDetail(cached) : '';
      return main + detail;
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
            <th style="width:80px"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  },

  wire(root, st) {
    // D4 — consume chat-to-task draft after first render
    if (st.chatToTask) {
      st.chatToTask = null;
    }
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());
    root.querySelector('[data-act="new-task"]')?.addEventListener('click', () => Modal.openTask());

    const input = root.querySelector('#compose-input');
    const preview = root.querySelector('#compose-id-preview');
    const msg = root.querySelector('#compose-msg');

    // mismo auto-grow que el textarea del chat (FRONT.9/FRONT.10). Guard de
    // `!value` antes de medir scrollHeight: el placeholder de este campo es
    // multilínea (ver tasks.compose.placeholder, trae "Examples:" + 3 líneas)
    // y Chromium infla scrollHeight contando esas líneas del placeholder
    // incluso con el campo vacío — sin el guard, el cuadro arrancaba "grande"
    // antes de que el usuario escribiera nada.
    const autoGrowCompose = () => {
      if (!input) return;
      if (!input.value) { input.style.height = ''; return; }
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    };
    input?.addEventListener('input', () => {
      const id = descToId(input.value);
      preview.textContent = id ? `ID: ${id}` : '';
      autoGrowCompose();
    });
    autoGrowCompose(); // tamaño correcto al montar si ya trae texto (ej. seed desde el chat)

    // Phase 1 — call /api/natural → show draft preview
    root.querySelector('[data-act="create-run"]')?.addEventListener('click', async () => {
      const desc = input?.value.trim();
      if (!desc) {
        msg.textContent = 'Escribe una descripción primero.';
        msg.style.color = 'var(--error)'; msg.style.display = ''; return;
      }
      const btn = root.querySelector('[data-act="create-run"]');
      btn.disabled = true; // el ícono circular ya muestra el estado deshabilitado, sin texto de carga
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

    // load-models in draft preview
    root.querySelector('[data-load-models]')?.addEventListener('click', async () => {
      await loadOrModels();
      App.rerender();
    });
    root.querySelector('[data-refresh-models]')?.addEventListener('click', async () => {
      await loadOrModels(true);
      App.rerender();
    });
    root.querySelector('#draft-model')?.addEventListener('change', () => {});

    // Auto-load models when draft is showing (only once — orModelsAttempted prevents a retry-loop when the fetch keeps failing)
    if (st.naturalDraft && st.orModels === null && !st.orModelsAttempted) {
      loadOrModels().then(() => App.rerender());
    }

    // Phase 2 — confirm draft → create + run
    root.querySelector('[data-act="draft-confirm"]')?.addEventListener('click', async () => {
      const id   = root.querySelector('#draft-id')?.value.trim();
      const desc = root.querySelector('#draft-desc')?.value.trim();
      const outRaw = root.querySelector('#draft-output')?.value.trim() || '';
      const modelId = root.querySelector('#draft-model')?.value?.trim() || 'deepseek/deepseek-v4-flash';
      const executor = inferExecutor(modelId);
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
          body: JSON.stringify({ id, description: desc, output, executor, executor_model: modelId }),
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

    root.querySelectorAll('[data-task]').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('[data-diag]')) return;
      const t = (st.tasks || []).find(x => x.id === tr.dataset.task);
      if (t) SidePanel.openTask(t);
    }));

    // A3 — diagnose click
    root.querySelectorAll('[data-diag]').forEach(el => el.addEventListener('click', async e => {
      e.stopPropagation();
      const id = el.dataset.diag;
      if (st.diagnoseCache[id] && st.diagnoseCache[id] !== 'loading') {
        st.openDiagnose = st.openDiagnose === id ? null : id;
        App.rerender();
        return;
      }
      st.diagnoseCache[id] = 'loading';
      st.openDiagnose = id;
      App.rerender();
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/diagnose`);
        if (!res.ok) throw new Error(res.statusText);
        st.diagnoseCache[id] = await res.json();
      } catch {
        st.diagnoseCache[id] = null;
      }
      st.openDiagnose = id;
      App.rerender();
    }));

    // A4 — retry button
    root.querySelectorAll('[data-act="retry"]').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      btn.disabled = true;
      btn.textContent = t('tasks.diagnose.retrying');
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run`, { method: 'POST' });
        if (res.ok) {
          await App.fetchTasks();
          App.rerender();
          showToast(t('tasks.diagnose.retry.ok'));
        } else {
          showToast(t('tasks.diagnose.retry.err'), 'error');
        }
      } catch {
        showToast(t('tasks.diagnose.retry.err'), 'error');
      }
    }));

    // A4 — make-habit button
    root.querySelectorAll('[data-act="make-habit"]').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      const trigger = btn.dataset.trigger;
      const action = btn.dataset.action;
      try {
        const res = await fetch('/api/instincts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger, action }),
        });
        if (res.ok) {
          showToast(t('tasks.diagnose.habit.ok'));
        } else {
          showToast(t('tasks.diagnose.habit.err'), 'error');
        }
      } catch {
        showToast(t('tasks.diagnose.habit.err'), 'error');
      }
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

    const memExplainer = `<div class="spec-explainer">
      <span class="spec-explainer-icon">${ICON.memory}</span>
      <div><strong>${t('memory.explainer.title')}</strong> ${t('memory.explainer.body')}</div>
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
          <div class="mem-card" data-topic="${esc(m.topicKey)}" role="button" tabindex="0">
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

    return `<div class="screen">${head}${memExplainer}<div class="mem-grid">${left}${right}</div></div>`;
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
    root.querySelectorAll('[data-topic]').forEach(c => {
      c.addEventListener('click', () => {
        c.classList.toggle('exp');
        const note = c.querySelector('.full-note span');
        if (note) note.textContent = c.classList.contains('exp') ? t('common.collapse') : t('common.expand');
      });
      c.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); }
      });
    });
  },
};
