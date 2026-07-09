/* ============================================================
   OrchestOS — screens: Project, Instincts, Runs, Specs
   ============================================================ */
window.SCREENS = window.SCREENS || {};

/* ============================================================
   PROJECT — CONSTITUTION.md (editable) + CONTEXT.md (read-only)
   ============================================================ */
// B.1 (Mes 18) — vista de solo lectura de chat_task_bar_events, para que
// Carlos vea la evidencia del gate B.1.b sin depender de un query manual.
function renderChatEvidence(st) {
  const summary = st.chatTaskBarEventsSummary || { totalMessages: 0, barShownCount: 0, barHiddenCount: 0, clickCount: 0 };
  const events = st.chatTaskBarEvents || [];

  const summaryLine = `<div class="proj-helper">${t('project.chatEvidence.helper')}</div>
    <div class="chat-evidence-summary">
      <span><b>${summary.totalMessages}</b> ${t('project.chatEvidence.messages')}</span>
      <span><b>${summary.barHiddenCount}</b> ${t('project.chatEvidence.barHidden')}</span>
      <span><b>${summary.barShownCount}</b> ${t('project.chatEvidence.barShown')}</span>
      <span><b>${summary.clickCount}</b> ${t('project.chatEvidence.clicks')}</span>
    </div>`;

  const rows = events.map(e => {
    if (e.kind === 'click') {
      return `<tr class="chat-evidence-click"><td colspan="3">${t('project.chatEvidence.clickRow')}</td><td>${esc(formatLocalDate(e.created_at))}</td></tr>`;
    }
    const barLabel = e.bar_shown === 1 ? t('project.chatEvidence.shown') : t('project.chatEvidence.hidden');
    return `<tr>
      <td>${esc(e.message || '')}</td>
      <td>${e.history_len ?? ''}</td>
      <td>${barLabel}</td>
      <td>${esc(formatLocalDate(e.created_at))}</td>
    </tr>`;
  }).join('');

  const table = events.length === 0
    ? `<p class="muted">${t('project.chatEvidence.empty')}</p>`
    : `<table class="tbl">
        <thead><tr>
          <th>${t('project.chatEvidence.colMessage')}</th>
          <th>${t('project.chatEvidence.colHistoryLen')}</th>
          <th>${t('project.chatEvidence.colBar')}</th>
          <th>${t('project.chatEvidence.colWhen')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

  return `<div class="proj-editor-wrap">${summaryLine}${table}</div>`;
}

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
      <button class="proj-tab ${tab === 'chat-evidence' ? 'active' : ''}" data-tab="chat-evidence">
        ${t('project.tab.chatEvidence')}
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

    if (tab === 'chat-evidence') {
      const isLoading = st.chatTaskBarEventsStatus === 'loading' || st.chatTaskBarEventsStatus === 'idle';
      const body = isLoading
        ? loadingState(t('project.loading'))
        : renderChatEvidence(st);
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
            <div class="tools">
              <button class="btn" data-act="regenerate">${ICON.refresh} ${t('project.context.regenerate')}</button>
              <button class="btn ghost" data-act="detect">${ICON.refresh} ${t('project.detect')}</button>
              <button class="btn ghost" data-act="index">${ICON.refresh} ${t('project.index')}</button>
            </div>
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
      } else if (btn.dataset.tab === 'chat-evidence') {
        // Siempre refresca (no solo idle) — a diferencia de constitution/context,
        // este dato cambia en cada mensaje real que Carlos manda al chat.
        st.chatTaskBarEventsStatus = 'idle';
        App.rerender();
        App.fetchChatTaskBarEvents().then(() => App.rerender());
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

    // E.8 (Mes 18) — orchestos detect [path]: regenera AGENTS.md + context.json.
    // Destructivo: sobreescribe AGENTS.md por completo con contenido auto-generado,
    // perdiendo cualquier edición manual (reglas de proyecto, instrucciones custom).
    // Mismo comportamiento que `orchestos detect` en CLI — se descubrió al verificar
    // este botón en vivo (2026-07-07): pisó el AGENTS.md real del propio repo.
    root.querySelector('[data-act="detect"]')?.addEventListener('click', async (e) => {
      if (!confirm(t('project.detect.confirm'))) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await fetch('/api/project/detect', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          showToast(`${t('project.detect.done')} — ${data.name} (${data.runtime}/${data.framework}, ${data.elapsedMs}ms)`);
          await App.fetchContext();
          App.rerender();
        } else {
          showToast(data.error || t('project.detect.err'), 'error');
        }
      } catch {
        showToast(t('project.detect.err'), 'error');
      } finally {
        btn.disabled = false;
      }
    });

    // E.8 — orchestos index [path]: indexa el proyecto en el code graph (S21)
    root.querySelector('[data-act="index"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await fetch('/api/project/index', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          showToast(`${t('project.index.done')} — ${data.files} files, ${data.edges} edges (${data.elapsedMs}ms)`);
        } else {
          showToast(data.error || t('project.index.err'), 'error');
        }
      } catch {
        showToast(t('project.index.err'), 'error');
      } finally {
        btn.disabled = false;
      }
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
    const confInput = i.verified
      ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
           <input type="range" min="0" max="1" step="0.05" value="${i.confidence}"
             data-conf-id="${esc(i.id)}" style="width:90px;accent-color:var(--accent)">
           <span class="mono faint" style="font-size:11px" data-conf-val="${esc(i.id)}">${Math.round(i.confidence * 100)}%</span>
         </div>`
      : '';
    const actions = !i.verified
      ? `<div class="inline-actions">
           <button class="btn success sm" data-approve="${esc(i.id)}">${ICON.check} ${t('instincts.btn.approve')}</button>
           <button class="btn danger sm" data-reject="${esc(i.id)}">${ICON.x} ${t('instincts.btn.reject')}</button>
         </div>`
      : `<span class="badge ${v.cls} instinct-state"><span class="d"></span>${v.txt}</span>`;
    return `<tr class="${!i.verified ? 'proposal' : ''}">
      <td><span class="mono" style="color:var(--text)">${esc(i.trigger)}</span></td>
      <td class="muted">${esc(i.action)}</td>
      <td>${this.confBar(i.confidence)}${confInput}</td>
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
        <button class="btn ghost" data-act="propose-instinct">${ICON.instinct} Proponer</button>
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

    root.querySelectorAll('[data-conf-id]').forEach(slider => {
      const id = slider.dataset.confId;
      const valEl = root.querySelector(`[data-conf-val="${id}"]`);
      let debounce;
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        if (valEl) valEl.textContent = Math.round(v * 100) + '%';
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
          await fetch(`/api/instincts/${encodeURIComponent(id)}/confidence`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confidence: v }),
          });
          await App.fetchInstincts();
        }, 600);
      });
    });

    root.querySelector('[data-act="propose-instinct"]')?.addEventListener('click', () => Modal.openPropose());
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
    /* G.4 / B.2 — engine + iteraciones derivados server-side en RunRow desde costBreakdown[0].label.
       Label canónico: "single-shot" | "agentic (N rounds)" | "external (claude-code, N turn[s])".
       Para runs legacy sin breakdown persistido, ambos campos vienen como null y mostramos "unknown". */
    const engineLabel = r.engine
      ? (r.engine === 'single-shot'
          ? t('runs.detail.engine.single-shot')
          : r.engine === 'agentic'
          ? t('runs.detail.engine.agentic')
          : t('runs.detail.engine.external'))
      : '—';
    const iterationsLabel = r.iterations != null
      ? (r.engine === 'agentic'
          ? `${r.iterations} ${r.iterations === 1 ? 'round' : 'rounds'}`
          : r.engine === 'external'
          ? `${r.iterations} ${r.iterations === 1 ? 'turn' : 'turns'}`
          : String(r.iterations))
      : '—';
    const engineBadgeClass = r.engine === 'agentic' ? 'blue' : r.engine === 'external' ? 'purple' : 'gray';
    const engine = `<div class="grp"><h4>${t('runs.detail.engine')}</h4>
       <div class="kv"><span class="k">${t('runs.detail.engine.type')}</span>
         <span class="v"><span class="badge ${engineBadgeClass}">${esc(engineLabel)}</span></span></div>
       <div class="kv"><span class="k">${t('runs.detail.iterations')}</span><span class="v">${esc(iterationsLabel)}</span></div>
     </div>`;

    /* C.1 — "info de proceso" del subproceso externo. Solo se muestra cuando
       engine === 'external' Y el primer cost entry trae binary+args (los runs
       legacy de B.2 pre-C.1 no los tienen, y single-shot/agentic nunca los
       tendran). La línea de comandos se reconstruye a partir de los args
       persistidos (el system prompt fue reemplazado por `<contract>` en
       external.ts:60 para no inflar la DB). */
    const processGroup = (() => {
      if (r.engine !== 'external') return ''
      const proc = r.costBreakdown && r.costBreakdown[0]
      if (!proc || !proc.binary || !proc.args) return ''
      const cmdline = `${proc.binary} ${proc.args.join(' ')}`
      return `<div class="grp"><h4>${t('runs.detail.process')}</h4>
         <div class="kv"><span class="k">${t('runs.detail.process.binary')}</span><span class="v">${esc(proc.binary)}</span></div>
         <div class="kv"><span class="k">${t('runs.detail.process.cmd')}</span><span class="v"><code title="${esc(t('runs.detail.process.cmd.tip'))}" style="font-size:11.5px;word-break:break-all">${esc(cmdline)}</code></span></div>
       </div>`
    })()

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

    return `<tr class="detail-row"><td colspan="7"><div class="detail">${engine}${processGroup}${bd}${warns}${qa}${meta}</div></td></tr>`;
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
        <button class="btn" data-act="runs-analyze" ${st.runsAnalyzeStatus === 'loading' ? 'disabled' : ''}>${ICON.bolt || ''} ${t('runs.analyze.btn')}</button>
        <button class="btn" data-act="refresh">${ICON.refresh} ${t('btn.refresh')}</button>
      </div>
    </div>`;

    const runsExplainer = `<div class="spec-explainer">
      <span class="spec-explainer-icon">${ICON.runs}</span>
      <div><strong>${t('runs.explainer.title')}</strong> ${t('runs.explainer.body')}</div>
    </div>`;

    // Bloque E (Mes 18, ex-IDEAS #9b) — equivalente a `orchestos runs --analyze`,
    // sin botón manual hasta hoy (solo se disparaba por hook automático).
    const analyzePanel = (() => {
      if (st.runsAnalyzeStatus === 'loading') return `<div class="proj-helper">${t('runs.analyze.loading')}</div>`;
      if (st.runsAnalyzeStatus === 'error') return `<div class="proj-helper" style="border-left-color:var(--error)">${t('runs.analyze.error')}</div>`;
      const result = st.runsAnalyzeResult;
      if (!result) return '';
      if (result.message) return `<div class="proj-helper">${esc(result.message)}</div>`;
      if (!result.suggestions || result.suggestions.length === 0) return `<div class="proj-helper">${t('runs.analyze.none')}</div>`;
      const items = result.suggestions.map(s =>
        `<div class="kv"><span class="k">[${esc(s.confidence)}] ${esc(s.pattern)} (${s.frequency}x)</span><span class="v">${esc(s.fix_hint)}</span></div>`
      ).join('');
      const proposalsNote = result.proposals && result.proposals.length > 0
        ? `<div class="muted" style="font-size:12px;margin-top:6px">${t('runs.analyze.proposals', result.proposals.length)}</div>`
        : '';
      return `<div class="grp" style="margin-bottom:16px"><h4>${t('runs.analyze.title')}</h4>${items}${proposalsNote}</div>`;
    })();

    if (st.runsStatus === 'loading')
      return `<div class="screen">${head}${runsExplainer}${loadingState(t('runs.loading'))}</div>`;
    if (st.runsStatus === 'error')
      return `<div class="screen">${head}${runsExplainer}${errorState(t('runs.err.title'), t('runs.err.body'))}</div>`;

    const allRuns = st.runs || [];
    if (allRuns.length === 0)
      return `<div class="screen">${head}${runsExplainer}${analyzePanel}${emptyState(ICON.runs, t('runs.empty.title'), t('runs.empty.body'))}</div>`;

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
      const main = `<tr class="row ${open ? 'open' : ''}" data-run="${esc(r.id)}" tabindex="0">
        <td><span class="badge ${STATUS_BADGE[r.status] || 'gray'}"><span class="d"></span>${esc(r.status)}</span></td>
        <td class="mono">${r.taskId ? esc(r.taskId) : '<span class="faint">—</span>'}</td>
        <td class="mono">${esc(r.model)}</td>
        <td class="num">${fmt(r.inputTokens)} <span class="faint">/</span> ${fmt(r.outputTokens)}</td>
        <td class="num">${usd(r.costUsd)}</td>
        <td>${this.warnCell(warnCount)}</td>
        <td class="mono faint">${esc(formatLocalDate(r.createdAt, { seconds: true }))}</td>
      </tr>`;
      return main + (open ? this.detail(r) : '');
    }).join('');

    return `<div class="screen">${head}${runsExplainer}${analyzePanel}
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
    root.querySelector('[data-act="runs-analyze"]')?.addEventListener('click', async () => {
      st.runsAnalyzeStatus = 'loading';
      st.runsAnalyzeResult = null;
      App.rerender();
      try {
        const res = await fetch('/api/runs/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!res.ok) throw new Error(String(res.status));
        st.runsAnalyzeResult = await res.json();
        st.runsAnalyzeStatus = 'ok';
      } catch {
        st.runsAnalyzeStatus = 'error';
      }
      App.rerender();
    });

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

    root.querySelectorAll('[data-run]').forEach(tr => {
      tr.addEventListener('click', () => {
        st.openRun = st.openRun === tr.dataset.run ? null : tr.dataset.run;
        App.rerender();
      });
      tr.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tr.click(); }
      });
    });
  },
};

/* ============================================================
   5b · GRAPH RUNNER (Mes 14 / C2)
   ============================================================ */
const GRAPH_OUTCOME_COLOR = {
  completed: 'green',
  rate_limited_then_completed: 'green',
  failed_permanent: 'red',
  blocked: 'amber',
  skipped_circuit_breaker: 'gray',
};

SCREENS.graph = {
  _timer: null,

  /* Mirrors src/run/graph-summary.ts: bucket entries by outcome + retryCount. */
  buckets(result, taskRows) {
    const retryById = new Map((taskRows || []).map(t => [t.id, t.retryCount]));
    const alone = [], retried = [], blocked = [], unfinished = [];
    for (const e of result.tasks) {
      const rc = retryById.get(e.id) ?? 0;
      if (e.outcome === 'completed' && rc === 0) alone.push(e);
      else if (e.outcome === 'completed' || e.outcome === 'rate_limited_then_completed') retried.push(e);
      else if (e.outcome === 'failed_permanent' || e.outcome === 'blocked') blocked.push(e);
      else unfinished.push(e);
    }
    return { alone, retried, blocked, unfinished };
  },

  resultRow(e) {
    const retryBtn = e.outcome === 'failed_permanent' || e.outcome === 'blocked'
      ? `<button class="btn ghost sm" data-act="graph-retry" data-task-id="${esc(e.id)}">${ICON.refresh} ${t('tasks.diagnose.retry')}</button>`
      : '';
    return `<tr>
      <td class="mono">${esc(e.id)}</td>
      <td><span class="badge ${GRAPH_OUTCOME_COLOR[e.outcome] || 'gray'} square">${esc(e.outcome)}</span></td>
      <td class="num">${usd(e.usd_cost)}</td>
      <td class="num">${fmt(e.tokens.input)} <span class="faint">/</span> ${fmt(e.tokens.output)}</td>
      <td class="num">${fmt(e.elapsed_ms)}</td>
      ${e.error ? `<td class="faint" style="max-width:320px">${esc(e.error)}</td>` : '<td></td>'}
      <td>${retryBtn}</td>
    </tr>`;
  },

  resultBucket(title, entries) {
    if (entries.length === 0) return '';
    return `<div class="grp"><h4>${title} (${entries.length})</h4>
      <table class="tbl"><tbody>${entries.map(e => this.resultRow(e)).join('')}</tbody></table>
    </div>`;
  },

  resultPanel(run) {
    if (run.phase === 'error') {
      return `<div class="card" style="margin-top:16px"><div class="placeholder">
        <h3>${t('graph.err.run', esc(run.error))}</h3>
      </div></div>`;
    }
    if (run.phase !== 'done' || !run.result) return '';
    const r = run.result;
    const b = this.buckets(r, run.tasks);
    const total = r.tasks.length;
    const autonomous = b.alone.length + b.retried.length;
    const pct = total > 0 ? ((autonomous / total) * 100).toFixed(1) : '100.0';
    const breaker = r.circuit_break_reason
      ? `<div class="warn-item"><span class="badge amber square">⏹</span><span style="color:var(--text)">${t('graph.circuitBreak', esc(r.circuit_break_reason))}</span></div>`
      : '';
    return `<div class="card" style="margin-top:16px">
      <div class="grp">
        <h4>${t('graph.result.title')}</h4>
        <div class="kv"><span class="k">★</span><span class="v">${t('graph.autonomy', autonomous, total, pct)}</span></div>
        <div class="kv"><span class="k">Σ</span><span class="v">${t('graph.totals', total, usd(r.aggregated_cost), fmt(r.aggregated_ms))}</span></div>
        ${breaker}
      </div>
      ${this.resultBucket(t('graph.bucket.alone'), b.alone)}
      ${this.resultBucket(t('graph.bucket.retried'), b.retried)}
      ${this.resultBucket(t('graph.bucket.blocked'), b.blocked)}
      ${this.resultBucket(t('graph.bucket.unfinished'), b.unfinished)}
    </div>`;
  },

  render(st) {
    const run = st.graphRun;
    const isRunning = run?.phase === 'running';
    const liveIndicator = isRunning
      ? `<span class="live-indicator"><span class="live-dot"></span>${t('graph.running')}</span>`
      : `<span class="live-indicator idle">${t('graph.idle')}</span>`;

    const head = `<div class="screen-head">
      <div class="lead"><h1>${t('graph.title')}</h1><p>${t('graph.subtitle')}</p></div>
      <div class="tools">
        ${liveIndicator}
        <label style="display:flex;align-items:center;gap:4px;font-size:12px">${t('graph.maxCost')}
          <input type="number" id="graph-max-cost" placeholder="${t('graph.maxCostHint')}" step="any" min="0" style="width:90px;padding:4px 6px;font-size:12px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px">${t('graph.maxMinutes')}
          <input type="number" id="graph-max-minutes" placeholder="${t('graph.maxMinutesHint')}" step="1" min="0" style="width:80px;padding:4px 6px;font-size:12px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">
        </label>
        <button class="btn primary" data-act="run-graph" ${isRunning || st.graphLaunching ? 'disabled' : ''}>${ICON.play} ${t('graph.runBtn')}</button>
      </div>
    </div>`;

    const explainer = `<div class="spec-explainer">
      <span class="spec-explainer-icon">${ICON.graph}</span>
      <div><strong>${t('graph.explainer.title')}</strong> ${t('graph.explainer.body')}</div>
    </div>`;

    if (st.graphStatus === 'loading')
      return `<div class="screen">${head}${explainer}${loadingState()}</div>`;
    if (st.graphStatus === 'error')
      return `<div class="screen">${head}${explainer}${errorState(t('graph.err.title'), t('graph.err.body'))}</div>`;

    const tasks = run?.tasks || [];
    if (tasks.length === 0)
      return `<div class="screen">${head}${explainer}${emptyState(ICON.graph, t('graph.empty.title'), t('graph.empty.body'))}</div>`;

    const rows = tasks.map(task => `<tr data-task="${esc(task.id)}">
      <td><span class="badge ${STATUS_BADGE[task.status] || 'gray'}"><span class="d"></span>${esc(task.status)}</span></td>
      <td class="mono" style="white-space:nowrap">${esc(task.id)}</td>
      <td style="color:var(--text-muted)">${esc(task.description)}</td>
      <td class="mono faint">${esc(task.executor || '—')}</td>
      <td class="num">${task.retryCount}</td>
    </tr>`).join('');

    return `<div class="screen">${head}${explainer}
      <div class="card" style="overflow:hidden">
        <table class="tbl">
          <thead><tr>
            <th style="width:90px">${t('tasks.col.status')}</th>
            <th>${t('tasks.col.id')}</th>
            <th>${t('tasks.col.desc')}</th>
            <th>${t('tasks.col.executor')}</th>
            <th style="width:80px">${t('tasks.col.retries')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${this.resultPanel(run)}
    </div>`;
  },

  wire(root, st) {
    root.querySelector('[data-act="run-graph"]')?.addEventListener('click', async () => {
      if (!confirm(t('graph.confirm'))) return;
      const maxCostEl = document.getElementById('graph-max-cost');
      const maxMinutesEl = document.getElementById('graph-max-minutes');
      const body = {};
      if (maxCostEl && maxCostEl.value !== '') body.maxCost = Number(maxCostEl.value);
      if (maxMinutesEl && maxMinutesEl.value !== '') body.maxMinutes = Number(maxMinutesEl.value);
      st.graphLaunching = true;
      App.rerender();
      try {
        const res = await fetch('/api/run/graph', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
        if (res.status === 409) {
          showToast(t('graph.alreadyRunning'), 'error');
        } else if (!res.ok) {
          showToast(t('graph.err.body'), 'error');
        }
      } catch {
        showToast(t('graph.err.body'), 'error');
      } finally {
        st.graphLaunching = false;
        await App.fetchGraphStatus();
        App.rerender();
      }
    });

    // C2 — retry button per row (failed_permanent / blocked)
    root.querySelectorAll('[data-act="graph-retry"]').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      btn.disabled = true;
      btn.textContent = t('tasks.diagnose.retrying');
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (res.ok) {
          showToast(t('tasks.diagnose.retry.ok'));
          await App.fetchGraphStatus();
          App.rerender();
        } else {
          showToast(t('tasks.diagnose.retry.err'), 'error');
        }
      } catch {
        showToast(t('tasks.diagnose.retry.err'), 'error');
      }
    }));

    // C2 — poll while a run is in progress; stop once done/error or screen changes
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(async () => {
      if (state.screen !== 'graph') { clearInterval(this._timer); this._timer = null; return; }
      if (state.graphRun?.phase !== 'running') return;
      await App.fetchGraphStatus();
      App.rerender();
    }, 3000);
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
  // E.9 (Mes 18) — equivalente de `orchestos config init/show`.
  routingPanel(st) {
    const cfg = st.orcheConfig;
    if (st.orcheConfigStatus === 'loading' || st.orcheConfigStatus === 'idle') {
      return `<div class="card settings-card">${loadingState(t('common.loading'))}</div>`;
    }
    if (st.orcheConfigStatus === 'error' || !cfg) {
      return `<div class="card settings-card">${errorState(t('settings.routing.err.title'), t('settings.routing.err.body'))}</div>`;
    }

    const sourceLine = cfg.configFound
      ? `<span class="badge green square" title="${esc(cfg.source)}">${ICON.check} ${t('settings.routing.customFound')}</span>`
      : `<span class="badge gray square">${t('settings.routing.defaults')}</span>`;

    // Fix real (2026-07-08): esto era de solo lectura — Carlos no tenía forma
    // de cambiar el modelo por rol, ni desde el CLI ni desde el dashboard.
    // Asume siempre provider 'openrouter' al guardar, igual que el resto de
    // los selectores de modelo de la app (chat, composer, diagnose).
    const ROLE_LABELS = { planner: 'Planner', executor_heavy: 'Executor (heavy)', executor_light: 'Executor (light)', default: 'Default' };
    const stripProvider = v => (v && v.startsWith('openrouter/')) ? v.slice('openrouter/'.length) : (v || '');
    const roleRows = `<div class="role-grid">` + Object.keys(ROLE_LABELS).map(role => {
      const val = stripProvider(cfg.roles[role]);
      return `<div class="draft-field">
        <label>${esc(ROLE_LABELS[role])}</label>
        ${buildModelSelect(`role-${role}`, val, st.orModels, st.localModels)}
      </div>`;
    }).join('') + `<div class="draft-field role-grid-full">
        <label>QA judge <span class="muted">(${t('settings.routing.qa.hint')})</span></label>
        ${buildModelSelect('role-qa', stripProvider(cfg.roles.qa), st.orModels, st.localModels, { allowEmpty: true, emptyLabel: t('settings.routing.qa.auto') })}
      </div></div>`;

    const pendingRows = (cfg.pendingRouting || []).length === 0
      ? `<p class="muted" style="margin:0;font-size:12.5px">${t('settings.routing.noPending')}</p>`
      : `<table class="tbl"><thead><tr><th>${t('settings.routing.col.task')}</th><th>${t('settings.routing.col.model')}</th></tr></thead><tbody>
          ${cfg.pendingRouting.map(r => `<tr><td class="mono">${esc(r.id)}</td><td class="mono" style="font-size:12px">${esc(r.model)}</td></tr>`).join('')}
        </tbody></table>`;

    const initBtn = cfg.configFound
      ? ''
      : `<button class="btn primary" data-act="config-init">${ICON.plus} ${t('settings.routing.initBtn')}</button>`;

    return `<div class="card settings-card">
        <div class="settings-header"><h3>${t('settings.routing.title')}</h3></div>
        <div class="kv"><span class="k">${t('settings.routing.source')}</span><span class="v">${sourceLine}</span></div>
        ${initBtn ? `<div class="settings-foot" style="margin-top:8px">${initBtn}</div>` : ''}
      </div>
      <div class="card settings-card settings-card-roles">
        <div class="settings-header"><h3>${t('settings.routing.roles')}</h3></div>
        ${roleRows}
        <div class="settings-foot" style="margin-top:8px">
          <span id="routing-save-msg" style="font-size:12px;display:none"></span>
          <span style="flex:1"></span>
          <button class="btn primary" data-act="save-routing">${ICON.check} ${t('settings.routing.save')}</button>
        </div>
      </div>
      <div class="card settings-card">
        <div class="settings-header"><h3>${t('settings.routing.pending')}</h3></div>
        ${pendingRows}
      </div>`;
  },

  render(st) {
    const keys = st.settings || {};
    const lang = getLang();
    const theme = getTheme();
    const THEME_LABELS = { orchestos: 'settings.theme.orchestos', dark2026: 'settings.theme.dark2026', bright: 'settings.theme.bright' };
    const themePicker = `<div class="card settings-card">
      <div class="settings-header"><h3>${t('settings.theme.title')}</h3></div>
      <div class="theme-picker">
        ${THEMES.map(id => `<button class="theme-opt ${theme === id ? 'active' : ''}" data-theme-opt="${id}">
          <span class="theme-swatch" data-swatch="${id}"><span class="sw-side"></span><span class="sw-main"><span class="sw-dot"></span></span></span>
          <span class="theme-opt-label">${t(THEME_LABELS[id])}</span>
        </button>`).join('')}
      </div>
    </div>`;
    const setupTitle = st.setup?.criticalMissing ? t('setup.title') : t('settings.title');
    const setupSubtitle = st.setup?.criticalMissing ? t('setup.subtitle') : t('settings.subtitle');
    const head = `<div class="screen-head">
      <div class="lead"><h1>${setupTitle}</h1><p>${setupSubtitle}</p></div>
    </div>`;
    const sec = state.settingsSection || 'general';
    const navItem = (id, icon, label) =>
      `<button class="settings-nav-item${sec === id ? ' active' : ''}" data-settings-sec="${id}">${icon}<span>${esc(label)}</span></button>`;

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
      <div class="settings-shell">
        <nav class="settings-nav">
          ${navItem('general', ICON.sliders, t('settings.nav.general'))}
          ${navItem('keys', ICON.bolt, t('settings.nav.keys'))}
          ${navItem('routing', ICON.runs, t('settings.nav.routing'))}
          ${navItem('health', ICON.runs, t('settings.nav.health'))}
          ${navItem('project', ICON.project, t('settings.nav.project'))}
          ${navItem('lang', ICON.globe, t('settings.nav.lang'))}
        </nav>

        <div class="settings-panels">

          <section class="settings-panel${sec === 'general' ? ' active' : ''}" data-panel="general">
            ${this.setupChecklist(st)}
            ${themePicker}
          </section>

          <section class="settings-panel${sec === 'keys' ? ' active' : ''}" data-panel="keys">
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
          </section>

          <section class="settings-panel${sec === 'health' ? ' active' : ''}" data-panel="health">
            ${this.healthBlocks(st) || `<div class="card settings-card">${loadingState(t('common.loading'))}</div>`}
          </section>

          <section class="settings-panel${sec === 'routing' ? ' active' : ''}" data-panel="routing">
            ${this.routingPanel(st)}
          </section>

          <section class="settings-panel${sec === 'project' ? ' active' : ''}" data-panel="project">
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
            <div class="card settings-card">
              <div class="settings-header"><h3 class="danger-title">${t('settings.reset.title')}</h3></div>
              <div class="settings-danger-body">
                <p class="muted" style="margin:0 0 14px;font-size:12.5px">${t('settings.reset.desc')}</p>
                <button class="btn danger" data-act="system-reset">${ICON.trash} ${t('settings.reset.btn')}</button>
              </div>
            </div>
          </section>

          <section class="settings-panel${sec === 'lang' ? ' active' : ''}" data-panel="lang">
            <div class="card settings-card">
              <div class="settings-header"><h3>${t('settings.lang.title')}</h3></div>
              <div class="lang-selector">
                <button class="lang-opt ${lang === 'en' ? 'active' : ''}" data-lang="en">English</button>
                <button class="lang-opt ${lang === 'es' ? 'active' : ''}" data-lang="es">Español</button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>`;
  },

  wire(root, st) {
    // settings sub-nav — local toggle (no rerender) so unsaved key inputs survive
    root.querySelectorAll('[data-settings-sec]').forEach(btn => btn.addEventListener('click', () => {
      const sec = btn.dataset.settingsSec;
      state.settingsSection = sec;
      root.querySelectorAll('[data-settings-sec]').forEach(b => b.classList.toggle('active', b.dataset.settingsSec === sec));
      root.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('active', p.dataset.panel === sec));
      if (sec === 'routing') {
        App.fetchOrcheConfig().then(() => App.rerender());
        if (state.orModels === null) loadOrModels().then(() => App.rerender());
      }
    }));

    // (el combo de modelo se carga solo al abrirse — wiring genérico en boot(), app.js)

    root.querySelector('[data-act="save-routing"]')?.addEventListener('click', async () => {
      const roles = {};
      ['planner', 'executor_heavy', 'executor_light', 'default'].forEach(role => {
        const el = root.querySelector(`#role-${role}`);
        if (el?.value) roles[role] = el.value;
      });
      // qa siempre se manda, incluso vacío ("(auto)") — es el único rol que
      // puede limpiarse explícitamente de vuelta a auto-resuelto.
      const qaEl = root.querySelector('#role-qa');
      if (qaEl) roles.qa = qaEl.value;
      const btn = root.querySelector('[data-act="save-routing"]');
      btn.disabled = true;
      try {
        const res = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roles }),
        });
        if (res.ok) {
          showToast(t('settings.routing.saveDone'));
          await App.fetchOrcheConfig();
          App.rerender();
        } else {
          const data = await res.json();
          showToast(data.error || t('settings.routing.saveErr'), 'error');
        }
      } catch {
        showToast(t('settings.routing.saveErr'), 'error');
      } finally {
        btn.disabled = false;
      }
    });

    root.querySelector('[data-act="config-init"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await fetch('/api/config/init', { method: 'POST' });
        if (res.ok) {
          showToast(t('settings.routing.initDone'));
          await App.fetchOrcheConfig();
          App.rerender();
        } else {
          const data = await res.json();
          showToast(data.error || t('settings.routing.initErr'), 'error');
        }
      } catch {
        showToast(t('settings.routing.initErr'), 'error');
      } finally {
        btn.disabled = false;
      }
    });

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

    root.querySelector('[data-act="system-reset"]')?.addEventListener('click', async () => {
      if (!confirm(t('settings.reset.confirm'))) return;
      const btn = root.querySelector('[data-act="system-reset"]');
      btn.disabled = true;
      try {
        const res = await fetch('/api/system/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true }),
        });
        if (res.ok) {
          const s = await res.json();
          showToast(t('settings.reset.ok', s.runsDeleted, s.instinctsDeleted, s.tasksReset));
          await App.fetchAll();
        } else {
          showToast(t('settings.reset.err'), 'error');
        }
      } catch {
        showToast(t('settings.reset.err'), 'error');
      } finally { btn.disabled = false; }
    });

    // Language selector
    root.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      App.rerender();
    }));

    // Theme selector
    root.querySelectorAll('[data-theme-opt]').forEach(btn => btn.addEventListener('click', () => {
      setTheme(btn.dataset.themeOpt);
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
      ? `<div class="stat-box ${s.clarify === 'pending' ? 'bad' : 'ok'}"><div class="n" style="font-size:15px;margin-top:5px">${esc(s.clarify)}</div><div class="l">${t('specs.clarify')}</div></div>`
      : '';
    const canApprove = s.status === 'draft' && s.clarify !== 'pending';
    const canArchive = s.status !== 'archived';
    const actions = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${canApprove ? `<button class="btn sm" data-spec-act="approve" data-spec-id="${esc(s.id)}">${ICON.check} ${t('specs.btn.approve')}</button>` : ''}
      <button class="btn sm ghost" data-spec-act="lint" data-spec-id="${esc(s.id)}">${ICON.search} Lint</button>
      ${canArchive ? `<button class="btn sm ghost" data-spec-act="archive" data-spec-id="${esc(s.id)}">${ICON.inbox} ${t('specs.btn.archive')}</button>` : ''}
    </div>`;
    return `<tr class="detail-row"><td colspan="5"><div class="spec-detail">
      <div class="stat-box ${s.lintFindings > 0 ? 'bad' : 'ok'}"><div class="n">${s.lintFindings}</div><div class="l">${t('specs.stat.lintFindings')}</div></div>
      <div class="stat-box ${s.deltaIssues > 0 ? 'bad' : 'ok'}"><div class="n">${s.deltaIssues}</div><div class="l">${t('specs.stat.deltaIssues')}</div></div>
      <div class="stat-box"><div class="n" style="font-size:15px;margin-top:5px">${s.hasCapabilities ? `<span class="cap-yes">${ICON.check} ${t('specs.cap.defined')}</span>` : `<span class="cap-no">${ICON.x} ${t('specs.cap.missing')}</span>`}</div><div class="l">${t('specs.col.caps')}</div></div>
      ${clarifyBadge}
      ${actions}
    </div></td></tr>`;
  },
  row(s, st) {
    const open = st.openSpec === s.id;
    const date = formatLocalDate(s.createdAt, { dateOnly: true });
    const main = `<tr class="row ${open ? 'open' : ''}" data-spec="${esc(s.id)}" tabindex="0">
      <td class="mono" style="color:var(--text)">${esc(s.id)}</td>
      <td><span class="badge ${STATUS_BADGE[s.status] || 'gray'} square">${esc(s.status)}</span></td>
      <td>${this.lintBadge(s)}</td>
      <td>${s.hasCapabilities ? `<span class="cap-yes mono" style="font-size:12px">${ICON.check} ${t('specs.cap.yes')}</span>` : `<span class="cap-no mono" style="font-size:12px">— ${t('specs.cap.no')}</span>`}</td>
      <td class="mono faint" style="display:flex;align-items:center;justify-content:space-between;gap:10px">${date}</td>
    </tr>`;
    return main + (open ? this.detail(s) : '');
  },
  render(st) {
    // G1 — banner explicativo siempre visible
    const whatIsSpec = `<div class="spec-explainer">
      <span class="spec-explainer-icon">${ICON.specs}</span>
      <div>
        <strong>${t('specs.what.title')}</strong>
        ${t('specs.what.body')}
      </div>
    </div>`;

    const head = `<div class="screen-head">
      <div class="lead"><h1>${t('specs.title')}</h1><p>${t('specs.subtitle')}</p></div>
      <div class="tools">
        <button class="btn" data-act="refresh">${ICON.refresh} ${t('btn.refresh')}</button>
        <button class="btn primary" data-act="new-spec">${ICON.plus} ${t('specs.btn.new')}</button>
      </div>
    </div>`;

    if (st.specsStatus === 'loading')
      return `<div class="screen">${head}${whatIsSpec}${loadingState(t('specs.loading'))}</div>`;
    if (st.specsStatus === 'error')
      return `<div class="screen">${head}${whatIsSpec}${errorState(t('specs.err.title'), t('specs.err.body'))}</div>`;

    const specs = st.specs || [];
    if (specs.length === 0)
      return `<div class="screen">${head}${whatIsSpec}${emptyState(ICON.specs, t('specs.empty.title'), t('specs.empty.body'))}</div>`;

    const active = specs.filter(s => s.status !== 'archived');
    const archived = specs.filter(s => s.status === 'archived');

    const table = list => `<div class="card" style="overflow:hidden"><table class="tbl">
        <thead><tr><th>${t('specs.col.id')}</th><th style="width:110px">${t('specs.col.status')}</th><th style="width:130px">Lint</th><th style="width:110px">${t('specs.col.caps')}</th><th style="width:140px">${t('specs.col.date')}</th></tr></thead>
        <tbody>${list.map(s => this.row(s, st)).join('')}</tbody></table></div>`;

    const archSection = archived.length ? `
      <div class="section-title collapsible ${st.archOpen ? '' : 'closed'}" data-arch>
        <span class="chev">${ICON.chev}</span><span>${t('specs.archived')}</span><span class="ct">${archived.length}</span>
      </div>
      ${st.archOpen ? table(archived) : ''}` : '';

    return `<div class="screen">${head}${whatIsSpec}${table(active)}${archSection}</div>`;
  },
  wire(root, st) {
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());

    // G2 — Nueva Spec button
    root.querySelector('[data-act="new-spec"]')?.addEventListener('click', () => Modal.openSpecDraft(st));

    root.querySelectorAll('[data-spec]').forEach(tr => {
      tr.addEventListener('click', () => {
        st.openSpec = st.openSpec === tr.dataset.spec ? null : tr.dataset.spec;
        App.rerender();
      });
      tr.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tr.click(); }
      });
    });
    root.querySelector('[data-arch]')?.addEventListener('click', () => { st.archOpen = !st.archOpen; App.rerender(); });

    root.querySelectorAll('[data-spec-act]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const act = btn.dataset.specAct;
        const id = btn.dataset.specId;
        if (act === 'approve') {
          fetch(`/api/specs/${encodeURIComponent(id)}/approve`, { method: 'POST' })
            .then(r => r.json())
            .then(d => { if (d.ok) { App.fetchAll(); showToast(t('specs.toast.approved', id)); } else showToast(d.error || t('specs.toast.approveErr'), 'error'); });
        } else if (act === 'lint') {
          fetch(`/api/specs/${encodeURIComponent(id)}/lint`)
            .then(r => r.json())
            .then(d => {
              if (d.findings && d.findings.length === 0) showToast(t('specs.toast.lintOk', d.structuredCount));
              else showToast(t('specs.toast.lintFindings', d.findings.length, id), 'error');
            });
        } else if (act === 'archive') {
          fetch(`/api/specs/${encodeURIComponent(id)}/archive`, { method: 'POST' })
            .then(r => r.json())
            .then(d => { if (d.ok) { App.fetchAll(); showToast(t('specs.toast.archived', id)); } else showToast(d.error || t('specs.toast.archiveErr'), 'error'); });
        }
      });
    });
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
        <button class="btn" data-act="discover-skills">${ICON.search} ${t('skills.btn.discover')}</button>
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

    const registrySkills = st.registrySkills || [];
    const registrySection = registrySkills.length === 0 ? '' : `
      <div class="skills-registry-section">
        <div class="screen-head" style="margin-top:24px">
          <div class="lead"><h2>${t('skills.registry.title')}</h2><p>${t('skills.registry.subtitle')}</p></div>
          <button class="btn ghost sm" data-act="refresh-registry">${ICON.refresh}</button>
        </div>
        <div class="skills-grid">${registrySkills.map(s => `<div class="skill-card" data-reg-skill="${esc(s.id)}">
          <div class="skill-card-main">
            <div class="skill-card-name">${esc(s.name)} <span class="badge gray square">registry</span></div>
            <div class="skill-card-desc">${esc(s.description || s.id)}</div>
            <div class="skill-card-targets"><span class="badge blue square">${esc(s.source)}</span></div>
          </div>
          <div class="skill-card-actions">
            <button class="btn primary sm" data-act="import-reg-skill" data-skill="${esc(s.id)}">${ICON.inbox} ${t('skills.registry.btn.import')}</button>
          </div>
          <div class="skill-card-msg" id="msg-reg-${esc(s.id)}" style="display:none"></div>
        </div>`).join('')}</div>
      </div>`;

    return `<div class="screen">${head}<div class="skills-grid">${cards}</div>${proSection}${registrySection}</div>`;
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
        if (skill) Modal.openEditSkill(skill);
      });
    });

    root.querySelector('[data-act="new-skill"]')?.addEventListener('click', () => {
      Modal.openNewSkill();
    });
    root.querySelector('[data-act="import-skill"]')?.addEventListener('click', () => {
      Modal.openImportSkill();
    });

    root.querySelector('[data-act="discover-skills"]')?.addEventListener('click', async () => {
      const btn = root.querySelector('[data-act="discover-skills"]');
      btn.disabled = true;
      btn.innerHTML = `${ICON.refresh} ${t('common.loading')}`;
      await App.fetchRegistrySkills();
      btn.disabled = false;
      btn.innerHTML = `${ICON.search} ${t('skills.btn.discover')}`;
    });

    root.querySelector('[data-act="refresh-registry"]')?.addEventListener('click', () => {
      App.fetchRegistrySkills();
    });

    root.querySelectorAll('[data-act="import-reg-skill"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.skill;
        const msg = document.getElementById(`msg-reg-${id}`);
        btn.disabled = true;
        try {
          const res = await fetch(`/api/skills/registry/${encodeURIComponent(id)}/import`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.ok) {
            await Promise.all([App.fetchSkills(), App.fetchRegistrySkills()]);
            App.rerender();
          } else if (msg) {
            msg.textContent = data.error || t('skills.registry.err');
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
