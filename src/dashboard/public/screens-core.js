/* ============================================================
   OrchestOS — screens: Runner, Tasks, Memory, Chat
   ============================================================ */
window.SCREENS = window.SCREENS || {};

// Bloque D (Mes 18, ex-IDEAS #21) — sugerencia de skill en el composer.
// 0 candidatos: sin campo (cero cambio visual). 1 candidato: pre-cargado,
// revisable. 2+ candidatos: "Ninguna" preseleccionada — nunca resolver el
// empate a ciegas, el usuario final elige. Ver docs/semantic-skill-selection-design.md.
function renderSkillSuggestion(draft) {
  const options = draft.skillOptions || [];
  if (options.length === 0) return '';
  const single = options.length === 1;
  const choices = options.map(o =>
    `<option value="${esc(o.id)}" ${single ? 'selected' : ''}>${esc(o.name)} — ${esc(o.description)}</option>`
  ).join('');
  return `<div class="draft-fields" style="margin-top:8px">
    <div class="draft-field" style="flex:1">
      <label>${t('tasks.draft.field.skill')}</label>
      <select id="draft-skill" class="draft-input">
        <option value="">${t('tasks.draft.skill.none')}</option>
        ${choices}
      </select>
    </div>
  </div>`;
}

// E.10 (Mes 18, paridad CLI↔Dashboard) — equivalente de `orchestos context suggest`.
// Lista clicable bajo el textarea de output; cada archivo sugerido se agrega al
// textarea con un click, sin pisar lo que el usuario ya haya escrito a mano.
function renderContextSuggestions(st) {
  if (st.contextSuggestStatus === 'loading') {
    return `<div class="muted" style="font-size:12px;margin-top:6px">${t('tasks.draft.suggestFiles.loading')}</div>`;
  }
  if (st.contextSuggestStatus === 'error') {
    return `<div class="muted" style="font-size:12px;margin-top:6px;color:var(--error)">${t('tasks.draft.suggestFiles.err')}</div>`;
  }
  const results = st.contextSuggestResults;
  if (!results) return '';
  if (results.length === 0) {
    return `<div class="muted" style="font-size:12px;margin-top:6px">${t('tasks.draft.suggestFiles.empty')}</div>`;
  }
  const tagFor = r => r.reason === 'direct' ? '●' : r.reason === 'embedding' ? '◆' : '○';
  const chips = results.map(r =>
    `<button type="button" class="btn ghost sm" data-suggest-file="${esc(r.path)}" style="font-family:var(--mono);font-size:11px">${tagFor(r)} ${esc(r.path)}</button>`
  ).join(' ');
  return `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${chips}</div>`;
}

/* ============================================================
   0 · CHAT
   ============================================================ */
// B.1 (Mes 19) — mismo tope que MAX_CHAT_ATTACHMENTS en handlers/chat.ts;
// el servidor valida igual, esto solo evita el viaje de red innecesario.
const MAX_CHAT_ATTACHMENTS = 5;

SCREENS.chat = {
  render(st) {
    const history = st.chatHistory || [];
    const thinkingBubble = st.chatPending
      ? `<div class="chat-msg assistant"><div class="chat-bubble chat-thinking"><span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>${t('chat.thinking')}</div></div>`
      : '';

    // El SVG anima vía SMIL (<animate>/<animateTransform>), no CSS — cargado
    // como <img> queda aislado del documento, así que la regla catch-all de
    // prefers-reduced-motion (styles.css) no puede alcanzarlo. Se resuelve acá:
    // con reduced-motion, se muestra la marca estática (mismo mark, sin loop).
    // Dos variantes por tema (mismo principio que `.logo-dark`/`.logo-light`
    // del header): AnimatedLogo.svg cicla negro↔azul (pensado para fondo
    // claro), AnimatedLogoDark.svg cicla blanco↔azul (fondo oscuro) — elegir
    // la incorrecta deja la fase oscura casi invisible contra su propio fondo.
    const prefersReducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isBrightTheme = document.documentElement.getAttribute('data-theme') === 'bright';
    const emptyMarkSrc = prefersReducedMotion
      ? `assets/${isBrightTheme ? 'logo_black' : 'logo_white'}.png`
      : `assets/${isBrightTheme ? 'AnimatedLogo' : 'AnimatedLogoDark'}.svg`;

    const msgs = history.length === 0
      ? `<div class="chat-empty"><img class="chat-empty-mark" src="${emptyMarkSrc}" alt="" aria-hidden="true"></div>`
      : history.map(m => {
          const text = esc(m.content).replace(/\n/g, '<br>');
          const modelTag = m.role === 'assistant' && m.model
            ? `<div class="chat-model-tag">${esc(m.model)}</div>` : '';
          // C.2 (Mes 19) — transparencia: si el modelo elegido no tenía visión,
          // el chat leyó la imagen con OCR en vez de descartarla en silencio.
          const ocrTag = m.role === 'assistant' && m.ocrUsed && m.ocrUsed.length
            ? `<div class="chat-ocr-tag">${ICON.image} ${t('chat.ocr.used', m.ocrUsed.join(', '))}</div>` : '';
          return `<div class="chat-msg ${m.role === 'user' ? 'user' : 'assistant'}"><div class="chat-bubble">${text}${ocrTag}${modelTag}</div></div>`;
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

    // D3/B.2 (Mes 19) — chips de adjuntos, ahora N en vez de uno solo.
    const chatFiles = st.chatFiles || [];
    const attachChips = chatFiles.length > 0
      ? `<div class="chat-attach-chips">${chatFiles.map(f => `
          <div class="chat-attach-chip">
            <span class="chat-attach-icon">${ICON.attachment}</span>
            <span class="chat-attach-name">${esc(f.filename)}</span>
            <span class="chat-attach-preview">${esc(f.preview || '')}</span>
            <button class="btn ghost sm" data-act="chat-file-remove" data-file-id="${esc(f.fileId)}" style="padding:1px 6px;font-size:14px;line-height:1">×</button>
          </div>`).join('')}</div>`
      : '';

    // D4 — "Create task" bar (visible after 3+ mensajes, red de respaldo).
    // J.1 (Mes 18) — B.1.b: si el clasificador semántico marcó el ÚLTIMO
    // mensaje como tarea, la barra aparece ya (sin esperar al conteo),
    // citando su `reason` en vez del hint genérico.
    const showByCount = history.length >= 3;
    const suggestion = !showByCount ? st.chatTaskSuggestion : null;
    const createTaskBar = (showByCount || suggestion)
      ? `<div class="chat-create-task-bar">
          <span class="chat-create-task-hint">${suggestion ? esc(suggestion.reason) : t('chat.createTaskHint')}</span>
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
        ${attachChips}
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
      const sentFileIds = (st.chatFiles || []).map(f => f.fileId);
      st.chatFiles = [];
      App.rerender();
      scrollBottom();
      try {
        const body = {
          history: st.chatHistory.slice(0, -1),
          message: msg,
          model: st.chatModel || 'deepseek/deepseek-v4-flash',
        };
        if (sentFileIds.length) body.fileIds = sentFileIds;
        // FRONT.1 — solo se manda si el control está visible (modelo con supportsReasoning:true)
        if (modelSupportsReasoning(st.chatModel, st.orModels)) body.effort = st.chatEffort || 'medium';
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          st.chatHistory.push({ role: 'assistant', content: data.text, model: data.model, ocrUsed: data.ocrUsed });
          // J.1 (Mes 18) — B.1.b: si el clasificador marcó el mensaje como
          // tarea, la barra aparece ya (sin esperar a 3+ mensajes) citando su reason.
          st.chatTaskSuggestion = data.taskSuggestion || null;
        } else {
          // J.2/J.3 (Mes 18) — antes se perdía el mensaje de error real del
          // servidor (imagen sin soporte de visión, contexto insuficiente) y
          // se mostraba siempre el mismo genérico.
          let data = null;
          try { data = await res.json(); } catch {}
          st.chatHistory.push({ role: 'assistant', content: (data && data.error) || t('chat.err.general') });
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
      st.chatFiles = [];
      st.chatTaskSuggestion = null;
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

    // D3/B.1 (Mes 19) — file input change → upload. Sigue siendo secuencial
    // contra el mismo endpoint (un archivo por request, decisión de A.1/B.1) —
    // ahora agrega al array en vez de reemplazar el adjunto único.
    root.querySelector('#chat-file-input')?.addEventListener('change', async () => {
      const input = root.querySelector('#chat-file-input');
      const file = input?.files?.[0];
      if (!file) return;
      st.chatFiles = st.chatFiles || [];
      if (st.chatFiles.length >= MAX_CHAT_ATTACHMENTS) {
        showToast(t('chat.file.maxReached'), 'error');
        input.value = '';
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      const clipBtn = root.querySelector('[data-act="chat-attach"]');
      if (clipBtn) clipBtn.disabled = true;
      try {
        const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          st.chatFiles.push({ fileId: data.fileId, filename: data.filename, type: data.type, preview: data.preview });
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

    // D3/B.2 (Mes 19) — remover un adjunto puntual (ahora hay N chips, cada
    // uno con su propio botón de quitar — mismo patrón de delegación por
    // querySelectorAll que ya usa el menú de tipo de adjunto arriba).
    root.querySelectorAll('[data-act="chat-file-remove"]').forEach(btn => btn.addEventListener('click', () => {
      const fileId = btn.dataset.fileId;
      st.chatFiles = (st.chatFiles || []).filter(f => f.fileId !== fileId);
      App.rerender();
    }));
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
      // B.1 (Mes 18) — gate de evidencia: registra que el usuario sí usó la barra.
      fetch('/api/chat/task-bar-click', { method: 'POST' }).catch(() => {});
      // D4 — seed the task composer with the last 3 user messages (concise, actionable).
      // The AI draft handler will turn this into a structured task — no need to dump the full conversation.
      const history = st.chatHistory || [];
      const seed = history
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content.trim())
        .filter(Boolean)
        .join('\n');
      st.composeDraft = seed || '';
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
        const ts = formatLocalDate(r.createdAt, { seconds: true });
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
  diagnoseDetail(d, st) {
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
        ${d.lastErrorResult ? `<div class="kv"><span class="k">${t('tasks.diagnose.lastError')}</span><div class="v"><pre style="white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto;background:var(--bg);padding:8px;border-radius:4px;margin:4px 0">${esc(d.lastErrorResult)}</pre></div></div>` : ''}
        <div class="diag-actions" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <div style="display:flex;gap:6px;align-items:center;flex:1;min-width:200px">
            <span style="font-size:12px;white-space:nowrap">${t('modal.task.model.label')}</span>
            ${buildModelSelect('diagnose-model', st.orModels?.length ? st.orModels[0]?.id : null, st.orModels, st.localModels)}
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn primary sm" data-act="retry" data-task-id="${esc(d.taskId)}">${ICON.refresh} ${t('tasks.diagnose.retry')}</button>
            <button class="btn ghost sm" data-act="make-habit" data-trigger="${esc(habitTrigger)}" data-action="${esc(d.suggestion)}">${ICON.bolt} ${t('tasks.diagnose.habit')}</button>
          </div>
        </div>
      </div>
    </div></td></tr>`;
  },

  render(st) {
    // H1 — two-phase compose: input → AI draft preview → confirm
    const draft = st.naturalDraft;
    const composeInitial = st.composeDraft || '';
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
              <button type="button" class="btn ghost sm" data-act="suggest-files" style="margin-top:4px">${ICON.bolt} ${t('tasks.draft.suggestFiles')}</button>
              ${renderContextSuggestions(st)}
            </div>
            <div class="draft-field">
              <label>${t('modal.task.model.label')}</label>
              ${buildModelSelect('draft-model', draft.executor_model || 'deepseek/deepseek-v4-flash', st.orModels)}
            </div>
            <div class="draft-field">
              <label>${t('tasks.draft.field.engine')}</label>
              <select id="draft-engine" class="draft-input" data-act="draft-engine">
                <option value="">${t('tasks.draft.engine.inherit')}</option>
                <option value="single-shot">${t('tasks.draft.engine.single-shot')}</option>
                <option value="agentic">${t('tasks.draft.engine.agentic')}</option>
                <option value="external">${t('tasks.draft.engine.external')}</option>
              </select>
              <div id="draft-engine-warning" class="draft-engine-warning" style="display:none"></div>
            </div>
          </div>
          ${renderSkillSuggestion(draft)}
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
      const main = `<tr class="row ${open ? 'open' : ''}" data-task="${esc(task.id)}" title="${esc(task.description)}" tabindex="0">
        <td><span class="badge ${STATUS_BADGE[task.status] || 'gray'}"><span class="d"></span>${esc(task.status)}</span></td>
        <td class="mono" style="color:var(--text);white-space:nowrap">${esc(task.id)}${skillBadge}</td>
        <td style="max-width:400px;color:var(--text-muted)">${esc(desc)}</td>
        <td class="mono faint" style="white-space:nowrap">${esc(task.executor || '—')}</td>
        <td class="num" ${retryCls}>${task.retryCount}</td>
        <td>${qa}</td>
        <td style="text-align:center;vertical-align:middle">${diagBtn}</td>
      </tr>`;
      const detail = open && cached && cached !== 'loading' ? this.diagnoseDetail(cached, st) : '';
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
      st.composeDraft = input.value; // sobrevive rerenders (poll 30s, loadOrModels)
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
        st.contextSuggestStatus = null;
        st.contextSuggestResults = null;
        App.rerender();
      } catch {
        // fallback on network error
        st.naturalDraft = { id: descToId(desc), description: desc, output: [], executor: 'openrouter' };
        st.contextSuggestStatus = null;
        st.contextSuggestResults = null;
        App.rerender();
      } finally { if (btn) { btn.disabled = false; } }
    });

    // Phase 1 — cancel preview
    root.querySelector('[data-act="draft-cancel"]')?.addEventListener('click', () => {
      st.naturalDraft = null;
      st.contextSuggestStatus = null;
      st.contextSuggestResults = null;
      App.rerender();
    });

    // (el combo de modelo se carga solo al abrirse — wiring genérico en boot(), app.js)

    // Auto-load models when draft is showing (only once — orModelsAttempted prevents a retry-loop when the fetch keeps failing)
    if (st.naturalDraft && st.orModels === null && !st.orModelsAttempted) {
      loadOrModels().then(() => App.rerender());
    }

    // C.2 — si el usuario selecciona `engine: external` en el composer,
    // consultamos /api/system/engines/external/availability y mostramos un
    // aviso inline si el binario `claude` no está. El endpoint es
    // cacheado en `st` para no martillar el backend si el usuario cambia
    // la selección varias veces antes de confirmar.
    const engineSel = root.querySelector('#draft-engine');
    const engineWarn = root.querySelector('#draft-engine-warning');
    if (engineSel && engineWarn) {
      const refreshEngineWarning = async () => {
        if (engineSel.value !== 'external') { engineWarn.style.display = 'none'; return }
        if (st.externalAvailability === undefined) {
          try {
            const r = await fetch('/api/system/engines/external/availability')
            st.externalAvailability = await r.json()
          } catch {
            st.externalAvailability = { available: false, path: null }
          }
        }
        if (st.externalAvailability.available) {
          engineWarn.style.display = 'none'
        } else {
          engineWarn.style.display = ''
          // t(key, ...args) usa placeholders {0}, {1}... ver i18n.js:1056
          engineWarn.innerHTML = `<span style="color:var(--warning)">${esc(t('tasks.draft.engine.external.unavailable', st.externalAvailability.installUrl ?? 'https://claude.com/download'))}</span>`
        }
      }
      engineSel.addEventListener('change', refreshEngineWarning)
      // Tambien al montar, por si la engine ya viene preseleccionada (draft re-abierto)
      refreshEngineWarning()
    }

    // E.10 — "Sugerir archivos" (context suggest, S24): pide sugerencias sobre
    // la descripción actual del draft, cae en silencio a keyword-only si no hay
    // proveedor de embeddings configurado (mismo comportamiento que la CLI).
    root.querySelector('[data-act="suggest-files"]')?.addEventListener('click', async () => {
      const desc = root.querySelector('#draft-desc')?.value.trim();
      if (!desc) return;
      st.contextSuggestStatus = 'loading';
      st.contextSuggestResults = null;
      App.rerender();
      try {
        const res = await fetch(`/api/context/suggest?task=${encodeURIComponent(desc)}&top=10`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        st.contextSuggestResults = data.results || [];
        st.contextSuggestStatus = 'ok';
      } catch {
        st.contextSuggestStatus = 'error';
      }
      App.rerender();
    });

    root.querySelectorAll('[data-suggest-file]').forEach(btn => btn.addEventListener('click', () => {
      const path = btn.dataset.suggestFile;
      const ta = root.querySelector('#draft-output');
      if (!ta) return;
      const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.includes(path)) lines.push(path);
      ta.value = lines.join('\n');
    }));

    // Phase 2 — confirm draft → create + run
    root.querySelector('[data-act="draft-confirm"]')?.addEventListener('click', async () => {
      const id   = root.querySelector('#draft-id')?.value.trim();
      const desc = root.querySelector('#draft-desc')?.value.trim();
      const outRaw = root.querySelector('#draft-output')?.value.trim() || '';
      const modelId = root.querySelector('#draft-model')?.value?.trim() || 'deepseek/deepseek-v4-flash';
      const engine = root.querySelector('#draft-engine')?.value || '';
      const skill = root.querySelector('#draft-skill')?.value || '';
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
        const createBody = { id, description: desc, output, executor, executor_model: modelId };
        if (engine === 'single-shot' || engine === 'agentic' || engine === 'external') createBody.engine = engine;
        if (skill) createBody.skill = skill;
        const createRes = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody),
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
        st.composeDraft = ''; // tarea creada — el borrador ya cumplió su función
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
      const modelSel = btn.closest('.diag-actions')?.querySelector('#diagnose-model');
      const model = modelSel ? modelSel.value : undefined;
      btn.disabled = true;
      btn.textContent = t('tasks.diagnose.retrying');
      try {
        const body = model ? { model } : {};
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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

    // Bloque E (Mes 18, ex-IDEAS #9b) — `orchestos memory conflicts` no tenía
    // ninguna superficie en el dashboard, ni siquiera de solo lectura.
    const conflicts = st.memoryConflicts || [];
    // I.5 (Mes 18) — el panel era de solo lectura: 5 conflictos sin ninguna
    // acción posible. "Resolve" marca el conflicto como revisado
    // (resolved_at) y lo saca de la lista; no borra las memory_entries.
    const conflictsPanel = conflicts.length === 0 ? '' : `<div class="proj-helper warn">
      <strong>${t('memory.conflicts.title', conflicts.length)}</strong>
      <div style="margin-top:6px;display:flex;flex-direction:column;gap:6px">${conflicts.map(c =>
        `<div style="display:flex;align-items:center;gap:10px;font-size:12.5px">
          <span style="flex:1">${esc(c.relation)}</span>
          <span class="muted">${esc(formatLocalDate(c.created_at, { dateOnly: true }))} · ${esc(c.confidence)}</span>
          <button class="btn sm" data-resolve-conflict="${esc(c.id)}">${t('memory.conflicts.resolve')}</button>
        </div>`
      ).join('')}</div>
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
      let rows = memory.filter(m => st.memScope === 'all' || m.scope === st.memScope);
      const q = st.memQuery || '';
      const scopeCls = sc => sc === 'session' ? 'amber' : sc === 'project' ? 'blue' : 'green';
      right = rows.length
        ? `<div class="mem-results">` + rows.map(m => `
          <div class="mem-card" data-topic="${esc(m.topicKey)}" data-mem-id="${esc(m.id)}" role="button" tabindex="0">
            <div class="top">
              <span class="topic">${esc(m.topicKey)}</span>
              <span class="badge ${scopeCls(m.scope)} square">${scopeLabel(m.scope)}</span>
              <span class="when">${esc((m.updatedAt || '').slice(0, 10))}</span>
            </div>
            <div class="preview">${esc(m.content)}</div>
            <div class="full-note">
              <span>${t('common.expand')}</span>
              <button class="btn danger sm mem-delete-btn" data-mem-act="delete" data-mem-id="${esc(m.id)}">${ICON.trash} ${t('memory.btn.delete')}</button>
            </div>
          </div>`).join('') + `</div>`
        : emptyState(ICON.memory, t('memory.no.title'), q ? t('memory.no.body', esc(q)) : t('memory.empty.body'));
    }

    return `<div class="screen">${head}${memExplainer}${conflictsPanel}<div class="mem-grid">${left}${right}</div></div>`;
  },
  wire(root, st) {
    let _searchTimer;
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => {
      st.memQuery = '';
      const qi = root.querySelector('#mem-query');
      if (qi) qi.value = '';
      App.fetchAll();
    });
    root.querySelectorAll('[data-sc]').forEach(s => s.addEventListener('click', () => {
      st.memScope = s.dataset.sc; App.rerender();
    }));
    root.querySelectorAll('[data-resolve-conflict]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.resolveConflict;
      b.disabled = true;
      try {
        const res = await fetch(`/api/memory/conflicts/${encodeURIComponent(id)}/resolve`, { method: 'POST' });
        if (res.ok) await App.fetchMemoryConflicts();
        App.rerender();
      } finally { b.disabled = false; }
    }));
    const qInput = root.querySelector('#mem-query');
    qInput?.addEventListener('input', () => {
      const q = qInput.value;
      st.memQuery = q;
      if (_searchTimer) clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => App.fetchMemory(q || undefined), 300);
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

    // I.8 (Mes 18) — borrar una memory entry desde la card expandida.
    root.querySelectorAll('[data-mem-act="delete"]').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(t('memory.delete.confirm'))) return;
      const id = btn.dataset.memId;
      btn.disabled = true;
      try {
        const res = await fetch(`/api/memory/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) await App.fetchMemory(st.memQuery || undefined);
        else showToast(t('memory.delete.err'), 'error');
        App.rerender();
      } finally {
        btn.disabled = false;
      }
    }));
  },
};
