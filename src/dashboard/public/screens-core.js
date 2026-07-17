/* ============================================================
   OrchestOS — screens: Runner, Tasks, Memory, Chat
   ============================================================ */
window.SCREENS = window.SCREENS || {};

// B.1 (Mes 21) — renderizado Markdown para burbujas del asistente.
// El contenido del LLM es dato externo: se sanitiza antes de inyectar al DOM.
// Solo se usa en mensajes del asistente; los del usuario quedan como texto plano.
const SAFE_MD_TAGS = new Set([
  'p','br','strong','em','b','i','s','del','code','pre','ul','ol','li',
  'h1','h2','h3','h4','blockquote','hr','a','span',
  'table','thead','tbody','tr','td','th'
]);

// B.2 (Mes 21) — highlight de task_id y nombre de modelo "dentro de la
// respuesta" como chip/badge. Lógica nueva (no solo estilo): se construye un
// índice de candidatos a partir de `state.tasks` + el catálogo de modelos
// (state.orModels + state.localModels), y SOLO se resalta lo que matchea
// contra ese índice. El LLM puede mencionar un id de tarea o de modelo por
// coincidencia sin que se vuelva chip — los falsos positivos desaparecen.
//
// Restricciones de seguridad (mismo principio que sanitize arriba):
//  - Solo texto (text nodes), nunca dentro de <code>/<pre> (el LLM podría
//    estar discutiendo el id literal) ni dentro de <a> (ya está linkeado).
//  - Word-boundary chequeado a mano (char antes/después no es [a-z0-9_]) —
//    los ids de modelo contienen "/" que no es word-char, así que \b no
//    alcanza para cubrirlos.
//  - El texto del chip se asigna con `textContent` (nunca innerHTML); los
//    data-attr vienen de state controlada (state.tasks + catálogo), no del
//    LLM, así que no hay superficie de inyección.
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function isWordChar(c) {
  return /[A-Za-z0-9_]/.test(c);
}

// Devuelve un Map<needle, {type, ...meta}> con todos los candidatos a
// resaltar. Orden importa: longest-first en el regex final para que
// "deepseek/deepseek-v4-flash" gane sobre cualquier prefijo accidental.
function buildHighlightIndex(st) {
  const idx = new Map();
  const add = (needle, meta) => {
    if (!needle || typeof needle !== 'string' || needle.length < 2) return;
    if (!idx.has(needle)) idx.set(needle, meta);
  };
  for (const t of (st && st.tasks) || []) {
    if (t && t.id) add(t.id, { type: 'task', id: t.id });
  }
  for (const m of ((st && st.orModels) || [])) {
    if (m && m.id) add(m.id, { type: 'model', id: m.id, name: m.name || m.id });
    if (m && m.name && m.name !== m.id) add(m.name, { type: 'model', id: m.id, name: m.name });
  }
  for (const m of ((st && st.localModels) || [])) {
    const id = typeof m === 'string' ? m : (m && m.id);
    if (id) add(id, { type: 'model', id, name: id });
  }
  return idx;
}

function highlightRefs(root, st) {
  const idx = buildHighlightIndex(st);
  if (idx.size === 0) return;
  const needles = [...idx.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(needles.map(escapeRegExp).join('|'), 'g');

  // No resaltar dentro de <code>/<pre> (texto literal) ni <a> (ya navega).
  const SKIP = new Set(['code', 'pre', 'a', 'script', 'style']);

  // Walk iterativo (no recursivo) para no romper al reemplazar text nodes.
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes[i];
      if (child.nodeType === 1 /* ELEMENT */) {
        const tag = child.tagName ? child.tagName.toLowerCase() : '';
        if (SKIP.has(tag)) continue;
        // No descender en spans que YA son chips nuestros (defensa contra
        // re-entrada si renderMarkdown se llamara dos veces por error).
        if (tag === 'span' && child.classList && child.classList.contains('md-chip')) continue;
        stack.push(child);
      } else if (child.nodeType === 3 /* TEXT */) {
        processTextNode(child, re, idx);
      }
    }
  }
}

function processTextNode(textNode, re, idx) {
  const text = textNode.nodeValue;
  if (!text || text.length < 2) return;

  // Reunir matches; filtrar los que tocan un word-char al lado (evita que
  // "deepseek/deepseek-v4-flash" matchee dentro de "mydeepseek/deepseek-v4-flash").
  re.lastIndex = 0;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = m.index > 0 ? text[m.index - 1] : '';
    const after = m.index + m[0].length < text.length ? text[m.index + m[0].length] : '';
    if (isWordChar(before) || isWordChar(after)) continue;
    matches.push({ start: m.index, end: m.index + m[0].length, meta: idx.get(m[0]) });
    if (m[0].length === 0) re.lastIndex++; // safety contra zero-width
  }
  if (matches.length === 0) return;

  // Reemplazar el text node por un fragment: texto plano + chips.
  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, match.start)));
    const span = document.createElement('span');
    span.className = `md-chip md-chip-${match.meta.type}`;
    span.textContent = text.slice(match.start, match.end);
    if (match.meta.type === 'task') {
      span.dataset.taskId = match.meta.id;
      span.setAttribute('role', 'button');
      span.setAttribute('tabindex', '0');
      span.title = t('chat.chip.openTask');
    } else {
      span.dataset.modelId = match.meta.id;
      span.setAttribute('role', 'button');
      span.setAttribute('tabindex', '0');
      span.title = match.meta.name && match.meta.name !== match.meta.id
        ? t('chat.chip.useModel') + ` — ${match.meta.name}`
        : t('chat.chip.useModel');
    }
    frag.appendChild(span);
    cursor = match.end;
  }
  if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
  textNode.parentNode.replaceChild(frag, textNode);
}

function renderMarkdown(raw, st) {
  const html = marked.parse(raw, { breaks: false, gfm: true });
  const root = document.createElement('div');
  root.innerHTML = html;
  (function sanitize(node) {
    for (const child of [...node.children]) {
      if (!SAFE_MD_TAGS.has(child.tagName.toLowerCase())) { child.remove(); continue; }
      for (const attr of [...child.attributes]) {
        if (attr.name.startsWith('on') ||
            (attr.name === 'href' && /^javascript:/i.test(attr.value))) {
          child.removeAttribute(attr.name);
        }
      }
      if (child.tagName.toLowerCase() === 'a') child.setAttribute('target', '_blank');
      sanitize(child);
    }
  })(root);
  // B.2 — después de sanitizar (no antes: si un padre inseguro fuera
  // removido, sus hijos ya no existen). El walk es sobre el DOM vivo, así
  // que el `root.innerHTML` final ya trae los <span class="md-chip">.
  highlightRefs(root, st);
  return `<div class="md-body">${root.innerHTML}</div>`;
}

// Bloque D (Mes 18, ex-IDEAS #21) — sugerencia de skill en el composer.
// 0 candidatos: sin campo (cero cambio visual). 1 candidato: pre-cargado,
// revisable. 2+ candidatos: "Ninguna" preseleccionada — nunca resolver el
// empate a ciegas, el usuario final elige. Ver docs/semantic-skill-selection-design.md.
function renderSkillSuggestion(draft) {
  const options = draft.skillOptions || [];
  if (options.length === 0) return '';
  const single = options.length === 1;
  // D.3 (Mes 22) — solo el nombre en el <option>; la descripción completa
  // hacía las opciones kilométricas e ilegibles. Queda como title (tooltip).
  const choices = options.map(o =>
    `<option value="${esc(o.id)}" title="${esc(o.description)}" ${single ? 'selected' : ''}>${esc(o.name)}</option>`
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
    // D.4 (Mes 22) — el server manda la causa real (ej. "Project not indexed
    // yet — run Index code graph first"); tragársela dejaba un error genérico
    // sin nada accionable.
    const reason = st.contextSuggestError || t('tasks.draft.suggestFiles.err');
    return `<div class="muted" style="font-size:12px;margin-top:6px;color:var(--error)">${esc(reason)}</div>`;
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
          const text = m.role === 'user'
            ? esc(m.content).replace(/\n/g, '<br>')
            : renderMarkdown(m.content, st); // B.2 — st alimenta el índice task_id + catálogo de modelos
          const modelTag = m.role === 'assistant' && m.model
            ? `<div class="chat-model-tag">${esc(m.model)}</div>` : '';
          // C.2 (Mes 19) — transparencia: si el modelo elegido no tenía visión,
          // el chat leyó la imagen con OCR en vez de descartarla en silencio.
          const ocrTag = m.role === 'assistant' && m.ocrUsed && m.ocrUsed.length
            ? `<div class="chat-ocr-tag">${ICON.image} ${t('chat.ocr.used', m.ocrUsed.join(', '))}</div>` : '';
          return `<div class="chat-msg ${m.role === 'user' ? 'user' : 'assistant'}"><div class="chat-bubble">${text}${ocrTag}${modelTag}</div></div>`;
        }).join('') + thinkingBubble;

    // 2026-07-13 (corrección de Carlos) — modelo+esfuerzo ahora es un solo pill
    // dentro del composer (ver chat-modelfx-row más abajo), no dos controles
    // separados arriba de la pantalla. buildChatModelFx() vive en app.js.
    const modelFx = buildChatModelFx(st);

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
        <div class="tools" style="align-items:center;gap:8px">${clearBtn}</div>
      </div>
      ${localWarnBanner}
      <div class="chat-area" id="chat-area">${msgs}</div>
      ${createTaskBar}
      <div class="chat-input-bar">
        ${attachChips}
        <div class="chat-composer">
          <textarea id="chat-input" rows="2" placeholder="${t('chat.placeholder')}" ${st.chatPending ? 'disabled' : ''}>${esc(st.chatDraft || '')}</textarea>
          <div class="chat-composer-row">
            <div class="attach-menu-wrap" data-attach-menu>
              <button class="chat-icon-btn chat-attach-btn" data-act="chat-attach" title="${t('chat.btn.attach')}" aria-label="${t('chat.btn.attach')}">${ICON.plus}</button>
              ${st.chatAttachMenuOpen ? `<div class="attach-menu">
                <button class="attach-menu-item" data-attach-kind="image">${ICON.image}<span>${t('chat.attachMenu.image')}</span></button>
                <button class="attach-menu-item" data-attach-kind="doc">${ICON.specs}<span>${t('chat.attachMenu.doc')}</span></button>
                <button class="attach-menu-item" data-attach-kind="url">${ICON.globe}<span>${t('chat.attachMenu.url')}</span></button>
              </div>` : ''}
            </div>
            <span class="chat-composer-spacer"></span>
            ${modelFx}
            <button class="chat-icon-btn chat-send-btn" data-act="chat-send" title="${t('chat.btn.send')}" aria-label="${t('chat.btn.send')}" ${st.chatPending ? 'disabled' : ''}>${ICON.send}</button>
          </div>
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
    // B.3 (Mes 21) — sincroniza cada tecla a state.chatDraft para sobrevivir
    // al poll de 30s (mismo patrón que composeDraft, línea ~872).
    textareaEl?.addEventListener('input', () => { st.chatDraft = textareaEl.value; });

    // 2026-07-14 (corrección de Carlos) — el botón de enviar arranca en
    // color "muted" y solo recupera su color de acento cuando hay texto,
    // sin depender de un rerender completo (perdería el foco/caret).
    const sendBtn = root.querySelector('.chat-send-btn[data-act="chat-send"]');
    const syncSendBtnState = () => sendBtn?.classList.toggle('has-text', !!textareaEl?.value.trim());
    textareaEl?.addEventListener('input', syncSendBtnState);
    syncSendBtnState();

    // B.2 (Mes 21) — click handlers de los chips dentro de la respuesta.
    // Task chip → abre la tarea en su side panel (Tasks screen). Model chip →
    // setea el modelo del chat + enfoca el composer para que el próximo
    // mensaje lo use. Mismo patrón de delegación que el resto de wire().
    root.querySelectorAll('.md-chip-task').forEach(chip => {
      const activate = (e) => {
        e.stopPropagation();
        const task = (st.tasks || []).find(x => x.id === chip.dataset.taskId);
        if (!task) return;
        App.go('tasks');
        SidePanel.openTask(task);
      };
      chip.addEventListener('click', activate);
      chip.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e); }
      });
    });
    root.querySelectorAll('.md-chip-model').forEach(chip => {
      const activate = (e) => {
        e.stopPropagation();
        const modelId = chip.dataset.modelId;
        if (!modelId) return;
        st.chatModel = modelId;
        App.rerender();
        requestAnimationFrame(() => {
          const ta = document.getElementById('chat-input');
          if (ta) { ta.focus(); scrollBottom(); }
        });
      };
      chip.addEventListener('click', activate);
      chip.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e); }
      });
    });

    const send = async () => {
      const textarea = root.querySelector('#chat-input');
      const msg = textarea?.value.trim();
      if (!msg || st.chatPending) return;
      textarea.value = '';
      st.chatDraft = ''; // mensaje enviado — el borrador ya cumplió su función
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
          // D.7 (Mes 22) — si el server ya creó+corrió la tarea sola, la barra
          // "Create task" quedaría redundante (o peor, invitaría a duplicarla)
          // — se omite. Refrescamos st.tasks para que el chip `task_id` que
          // aparece en el texto de la respuesta (autoTaskNote) sea clicable
          // de inmediato (highlightRefs necesita conocer el id).
          if (data.autoTask && data.autoTask.id) {
            st.chatTaskSuggestion = null;
            App.fetchTasks().then(() => App.rerender());
          } else {
            // J.1 (Mes 18) — B.1.b: si el clasificador marcó el mensaje como
            // tarea, la barra aparece ya (sin esperar a 3+ mensajes) citando su reason.
            st.chatTaskSuggestion = data.taskSuggestion || null;
          }
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
    // 2026-07-13 (corrección de Carlos) — pill único modelo+esfuerzo del
    // composer (buildChatModelFx() en app.js). Un solo trigger + un panel
    // de 2 niveles (root → model|effort), toda la navegación se delega
    // acá porque las 3 vistas nunca coexisten en el DOM al mismo tiempo.
    root.querySelector('[data-modelfx-trigger]')?.addEventListener('click', e => {
      e.stopPropagation();
      const opening = !st.chatFxView;
      st.chatFxView = opening ? 'root' : null;
      App.rerender();
      if (opening) loadOrModels().then(() => { if (st.chatFxView) App.rerender(); });
    });
    root.querySelector('[data-modelfx-panel]')?.addEventListener('click', e => {
      const nav = e.target.closest('[data-modelfx-nav]');
      if (nav) { st.chatFxView = nav.dataset.modelfxNav; App.rerender(); return; }
      const back = e.target.closest('[data-modelfx-back]');
      if (back) { st.chatFxView = 'root'; App.rerender(); return; }
      const reset = e.target.closest('[data-modelfx-reset]');
      if (reset) {
        st.chatEffort = 'medium';
        localStorage.setItem('orchestos-chat-effort', 'medium');
        st.chatFxView = null;
        App.rerender();
        return;
      }
      const effortOpt = e.target.closest('[data-modelfx-effort]');
      if (effortOpt) {
        st.chatEffort = effortOpt.dataset.modelfxEffort;
        localStorage.setItem('orchestos-chat-effort', st.chatEffort);
        st.chatFxView = null;
        App.rerender();
        return;
      }
      const modelOpt = e.target.closest('[data-combo-option]');
      if (modelOpt) {
        st.chatModel = modelOpt.dataset.value;
        st.chatFxView = null;
        App.rerender(); // refresh warning banner + show/hide effort item
      }
    });
    // model search filter (vista 'model') — patches the list in place (no full
    // rerender, keeps input focus), mismo patrón que ya usaba el combo viejo.
    root.querySelector('[data-modelfx-panel] [data-combo-search]')?.addEventListener('input', e => {
      const q = e.target.value;
      const list = root.querySelector('[data-modelfx-panel] [data-combo-list]');
      if (!list) return;
      const allCloud = Array.isArray(st.orModels) && st.orModels.length > 0 ? st.orModels : KNOWN_MODELS;
      const locals = Array.isArray(st.localModels) && st.localModels.length > 0 ? st.localModels : [];
      // Safe: all dynamic values (m.id, m.name) pass through esc(). query `q` is used only for filtering, never rendered.
      list.innerHTML = buildComboOptions(locals, allCloud, st.chatModel, q);
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
    if (d.error) {
      return `<tr class="detail-row"><td colspan="8"><div class="detail">
        <div class="grp"><h4>${t('tasks.diagnose.title')}</h4>
          <div class="kv"><span class="k" style="color:var(--error)">${t('tasks.diagnose.err')}</span><span class="v">${esc(d.error)}</span></div>
          <button type="button" class="btn ghost sm" style="margin-top:8px" data-copy="${esc(d.error)}">${ICON.copy} ${t('btn.copy')}</button>
        </div>
      </div></td></tr>`;
    }
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
    return `<tr class="detail-row"><td colspan="8"><div class="detail">
      <div class="grp"><h4>${t('tasks.diagnose.title')}</h4>
        <div class="kv"><span class="k">${t('tasks.diagnose.pattern')}</span><span class="v">${patternLabel}</span></div>
        <div class="kv"><span class="k">${t('tasks.diagnose.confidence')}</span><span class="v">${t(confKey)}</span></div>
        <div class="kv"><span class="k">${t('tasks.diagnose.suggestion')}</span><span class="v">${esc(d.suggestion)}</span></div>
        <div class="kv"><span class="k">${t('tasks.diagnose.details')}</span><span class="v">${esc(d.details)}</span></div>
        ${d.lastErrorResult ? `<div class="kv"><span class="k">${t('tasks.diagnose.lastError')}</span><div class="v">
          <pre style="white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto;background:var(--bg);padding:8px;border-radius:4px;margin:4px 0">${esc(d.lastErrorResult)}</pre>
          <button type="button" class="btn ghost sm" data-copy="${esc(d.lastErrorResult)}">${ICON.copy} ${t('btn.copy')}</button>
        </div></div>` : ''}
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
    // Bloque D (Mes 22) — simple por defecto: descripción editable (misma
    // ergonomía que el chat) + resumen de una línea con lo que OrchestOS ya
    // decidió. id/archivos/modelo/engine/skill viven colapsados en "Ajustes
    // avanzados" — el usuario final no necesita saber qué es un engine para
    // correr una tarea. Los IDs de los controles no cambian: draft-confirm
    // lee los mismos campos estén o no desplegados.
    const compose = draft
      ? `<div class="compose-bar compose-preview">
          <div class="draft-header">
            <span class="draft-label">${ICON.bolt} ${t('tasks.draft.label')}</span>
            <button class="btn ghost sm" data-act="draft-cancel">${t('tasks.draft.btn.cancel')}</button>
          </div>
          <div class="draft-main">
            <textarea id="draft-desc" class="draft-desc" rows="2">${esc(draft.description)}</textarea>
            <div class="draft-summary" id="draft-summary"></div>
          </div>
          <details class="draft-advanced" id="draft-advanced" ${st.draftAdvancedOpen ? 'open' : ''}>
            <summary>${t('tasks.draft.advanced')}</summary>
            <div class="draft-fields">
              <div class="draft-field">
                <label>${t('tasks.draft.field.id')}</label>
                <input id="draft-id" class="draft-input mono" value="${esc(draft.id)}">
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
              <div class="draft-field" id="draft-cli-effort-field" style="display:${draft.engine === 'external' ? '' : 'none'}">
                <label>${t('tasks.draft.field.cliEffort')}</label>
                <select id="draft-cli-effort" class="draft-input" data-act="draft-cli-effort">
                  <option value="">${t('tasks.draft.cliEffort.inherit')}</option>
                  <option value="low" ${draft.cli_effort === 'low' ? 'selected' : ''}>low</option>
                  <option value="medium" ${draft.cli_effort === 'medium' ? 'selected' : ''}>medium</option>
                  <option value="high" ${draft.cli_effort === 'high' ? 'selected' : ''}>high</option>
                  <option value="xhigh" ${draft.cli_effort === 'xhigh' ? 'selected' : ''}>xhigh</option>
                  <option value="max" ${draft.cli_effort === 'max' ? 'selected' : ''}>max</option>
                </select>
              </div>
            </div>
            <div class="draft-fields" style="margin-top:8px">
              <div class="draft-field" style="flex:2">
                <label>${t('tasks.draft.field.output')}</label>
                <textarea id="draft-output" class="draft-input" rows="2">${esc((draft.output || []).join('\n'))}</textarea>
                <button type="button" class="btn ghost sm" data-act="suggest-files" style="margin-top:4px;align-self:flex-start">${ICON.bolt} ${t('tasks.draft.suggestFiles')}</button>
                ${renderContextSuggestions(st)}
              </div>
            </div>
            ${renderSkillSuggestion(draft)}
          </details>
          <div class="compose-actions" style="margin-top:10px">
            <div id="compose-msg" style="font-size:12px;display:none;flex:1"></div>
            <span style="flex:1"></span>
            <button class="btn primary" data-act="draft-confirm">${ICON.play} ${t('tasks.draft.btn.confirm')}</button>
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

    // v0.12 / Bloque D.1.a — si tasks.yaml no existe, el composer no puede
    // funcionar (POST /api/tasks devuelve 404). En vez de esconder el botón
    // a secas, mostramos un empty state con CTA claro que llama a
    // POST /api/tasks/init. Es el cierre del gap "no-dev bloqueado antes de
    // crear su primera tarea". El `Modal.confirm()` en el handler es la red
    // de seguridad contra clicks accidentales.
    if (st.tasksYamlExists === false) {
      return `<div class="screen">${head}${emptyState(ICON.tasks, t('tasks.init.empty.title'), t('tasks.init.empty.body'))}<div style="text-align:center;margin-top:8px">
        <button class="btn primary" data-act="tasks-init">${ICON.plus} ${t('tasks.init.btn')}</button>
        <div id="tasks-init-msg" style="font-size:12px;display:none;margin-top:8px"></div>
      </div></div>`;
    }

    if (st.tasksYamlError) {
      return `<div class="screen">${head}${compose}${errorState(t('tasks.parseErr.title'), t('tasks.parseErr.body', esc(st.tasksYamlError)))}</div>`;
    }

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

    const tSel = bulkSet('tasks');
    const taskIds = tasks.map(task => task.id);
    const allTaskChecked = taskIds.length > 0 && taskIds.every(id => tSel.has(id));

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
        <td style="width:32px"><input type="checkbox" class="bulk-checkbox" data-bulk-row="tasks" data-bulk-id="${esc(task.id)}" ${tSel.has(task.id) ? 'checked' : ''}></td>
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
            <th style="width:32px"><input type="checkbox" class="bulk-checkbox" data-bulk-all="tasks" ${allTaskChecked ? 'checked' : ''}></th>
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
      ${renderBulkBar('tasks', t('bulk.resource.tasks'))}
    </div>`;
  },

  wire(root, st) {
    wireBulkSelect(root, 'tasks', '/api/tasks/bulk-delete', () => App.fetchTasks(), t('bulk.resource.tasks'));
    root.querySelector('[data-act="refresh"]')?.addEventListener('click', () => App.fetchAll());

    // v0.12 / Bloque D.1.a — CTA "Initialize tasks.yaml" del empty state de
    // archivo faltante. Modal.confirm() da la red de seguridad (mismo patrón
    // que el resto de acciones destructivas del Bloque A); on success,
    // refetchAll para que la sidebar de runs/health también reflejen el cambio.
    const initBtn = root.querySelector('[data-act="tasks-init"]');
    if (initBtn) initBtn.addEventListener('click', async () => {
      const ok = await Modal.confirm(t('tasks.init.confirm.title'), t('tasks.init.confirm.body'), t('tasks.init.btn'));
      if (!ok) return;
      const btn = initBtn;
      const msg = root.querySelector('#tasks-init-msg');
      btn.disabled = true;
      try {
        const result = await App.initTasksYaml();
        msg.textContent = t('tasks.init.ok', result.taskIds?.length || 0);
        msg.style.color = 'var(--accent)'; msg.style.display = '';
        showToast(t('tasks.init.toast', result.taskIds?.length || 0));
        App.rerender();
      } catch (e) {
        msg.textContent = e.message;
        msg.style.color = 'var(--error)'; msg.style.display = '';
      } finally { btn.disabled = false; }
    });

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

    // D.1 (Mes 22) — ergonomía del draft: la descripción crece como el chat,
    // el estado abierto/cerrado de "Ajustes avanzados" sobrevive rerenders
    // (suggest-files y el combo de modelo rerenderizan), y el resumen de una
    // línea refleja en vivo lo que se va a ejecutar.
    const draftDesc = root.querySelector('#draft-desc');
    if (draftDesc) {
      const growDesc = () => {
        draftDesc.style.height = 'auto';
        draftDesc.style.height = Math.min(draftDesc.scrollHeight, 180) + 'px';
      };
      draftDesc.addEventListener('input', growDesc);
      growDesc();
    }
    const advPanel = root.querySelector('#draft-advanced');
    advPanel?.addEventListener('toggle', () => { st.draftAdvancedOpen = advPanel.open; });
    const summaryEl = root.querySelector('#draft-summary');
    const updateDraftSummary = () => {
      if (!summaryEl || !st.naturalDraft) return;
      const id = root.querySelector('#draft-id')?.value.trim() || '';
      const modelId = root.querySelector('#draft-model')?.value || st.naturalDraft.executor_model || 'deepseek/deepseek-v4-flash';
      const engine = root.querySelector('#draft-engine')?.value || '';
      const skillSel = root.querySelector('#draft-skill');
      const skillName = skillSel && skillSel.value
        ? (skillSel.options[skillSel.selectedIndex]?.text || skillSel.value) : '';
      const files = (root.querySelector('#draft-output')?.value || '')
        .split('\n').map(s => s.trim()).filter(Boolean);
      const parts = [id, modelId.split('/').pop(), `engine: ${engine || 'auto'}`];
      if (skillName) parts.push(`skill: ${skillName}`);
      if (files.length) parts.push(t('tasks.draft.summary.files', String(files.length)));
      summaryEl.textContent = parts.filter(Boolean).join('  ·  ');
    };
    updateDraftSummary();
    ['#draft-id', '#draft-output'].forEach(sel =>
      root.querySelector(sel)?.addEventListener('input', updateDraftSummary));
    ['#draft-engine', '#draft-skill'].forEach(sel =>
      root.querySelector(sel)?.addEventListener('change', updateDraftSummary));

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

    // E.15 — cli_effort (claude --effort) solo tiene sentido con engine=external;
    // se oculta con las demás opciones para no confundir con el effort de 3
    // niveles del chat (mecanismo distinto, reasoning param de OpenRouter).
    const cliEffortField = root.querySelector('#draft-cli-effort-field');
    if (engineSel && cliEffortField) {
      const toggleCliEffort = () => { cliEffortField.style.display = engineSel.value === 'external' ? '' : 'none' };
      engineSel.addEventListener('change', toggleCliEffort);
      toggleCliEffort();
    }

    // E.10 — "Sugerir archivos" (context suggest, S24): pide sugerencias sobre
    // la descripción actual del draft, cae en silencio a keyword-only si no hay
    // proveedor de embeddings configurado (mismo comportamiento que la CLI).
    root.querySelector('[data-act="suggest-files"]')?.addEventListener('click', async () => {
      const desc = root.querySelector('#draft-desc')?.value.trim();
      if (!desc) return;
      st.contextSuggestStatus = 'loading';
      st.contextSuggestResults = null;
      st.contextSuggestError = null;
      App.rerender();
      try {
        const res = await fetch(`/api/context/suggest?task=${encodeURIComponent(desc)}&top=10`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          // D.4 — conservar la causa del server ("Project not indexed yet…"),
          // no reducirla a un error genérico.
          st.contextSuggestError = (data && data.error) || null;
          st.contextSuggestStatus = 'error';
        } else {
          st.contextSuggestResults = (data && data.results) || [];
          st.contextSuggestStatus = 'ok';
        }
      } catch {
        st.contextSuggestError = null;
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
      const cliEffort = root.querySelector('#draft-cli-effort')?.value || '';
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
        if (engine === 'external' && cliEffort) createBody.cli_effort = cliEffort;
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

    // Mes 22/E.7 — botón de copiar en el panel de diagnosis (Carlos: seleccionar
    // a mano el texto largo del error era tedioso). Mismo patrón data-copy que
    // ya usa screens-ops.js (skills), no uno nuevo.
    root.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(btn.dataset.copy || '');
        // innerHTML acá es seguro: ambos lados (`old` capturado del propio botón
        // que ESTE módulo renderizó, y el reemplazo `ICON.check + t(...)`) son
        // marcado propio estático — nunca `d.error`/`d.details`/contenido del
        // usuario, que van siempre por `esc()` en el render. textContent solo
        // (como screens-ops.js:1401) descartaría el ícono SVG para siempre en
        // el revert, porque su textContent no incluye el markup del ícono.
        const old = btn.innerHTML;
        btn.innerHTML = `${ICON.check} ${t('setup.copied')}`;
        setTimeout(() => { btn.innerHTML = old; }, 1200);
      } catch {
        Modal.showCopyText(t('setup.copyManually'), btn.dataset.copy || '');
      }
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
        if (!res.ok) {
          const e = await res.json().catch(() => null);
          throw new Error((e && e.error) || res.statusText);
        }
        st.diagnoseCache[id] = await res.json();
      } catch (err) {
        // Bug real (2026-07-16): antes esto guardaba `null` y el panel se
        // cerraba en silencio sin avisar nada — Carlos hizo click y "nunca
        // se abrió". Ahora se guarda el error para mostrarlo (Bloque F.4).
        st.diagnoseCache[id] = { error: err && err.message ? err.message : t('tasks.diagnose.err') };
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
      const mSel = bulkSet('memory');
      const rowIds = rows.map(m => m.id);
      const allMemChecked = rowIds.length > 0 && rowIds.every(id => mSel.has(id));
      const selectAllRow = rows.length ? `<label class="mem-select-all" style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);margin-bottom:8px;cursor:pointer">
        <input type="checkbox" class="bulk-checkbox" data-bulk-all="memory" ${allMemChecked ? 'checked' : ''}> ${t('bulk.selectAll')}
      </label>` : '';
      right = rows.length
        ? selectAllRow + `<div class="mem-results">` + rows.map(m => `
          <div class="mem-card" data-topic="${esc(m.topicKey)}" data-mem-id="${esc(m.id)}" role="button" tabindex="0">
            <div class="top">
              <input type="checkbox" class="bulk-checkbox" data-bulk-row="memory" data-bulk-id="${esc(m.id)}" ${mSel.has(m.id) ? 'checked' : ''}>
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

    return `<div class="screen">${head}${memExplainer}${conflictsPanel}<div class="mem-grid">${left}${right}</div>${renderBulkBar('memory', t('bulk.resource.memory'))}</div>`;
  },
  wire(root, st) {
    wireBulkSelect(root, 'memory', '/api/memory/bulk-delete', () => App.fetchMemory(st.memQuery || undefined), t('bulk.resource.memory'));
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
      const ok = await Modal.confirm(t('memory.delete.confirm'), t('bulk.confirm.body'), t('btn.confirm'));
      if (!ok) return;
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
