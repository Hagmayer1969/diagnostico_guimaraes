(function () {
  'use strict';

  const { AREAS, STEPS, MENSAGEM } = window.PlanoGuimaraes;
  const STORAGE_KEY = 'guimaraes-plano-concluidos';
  const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  const tree = document.getElementById('view-mapa');
  const svg = document.getElementById('map-lines');
  const timelineView = document.getElementById('view-prazo');
  const panel = document.getElementById('detail');
  const panelBody = document.getElementById('detail-body');
  const closeButton = document.getElementById('detail-close');
  const backdrop = document.getElementById('sheet-backdrop');
  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');
  const viewButtons = document.querySelectorAll('[data-view]');
  const sheetMode = window.matchMedia('(max-width: 1100px)');
  const stackedMode = window.matchMedia('(max-width: 760px)');

  const byId = new Map(STEPS.map((step) => [step.id, step]));
  const collapsed = new Set();
  let selectedId = null;
  let lastTrigger = null;
  let done = loadDone();

  function loadDone() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return new Set(Array.isArray(saved) ? saved.filter((id) => byId.has(id)) : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveDone() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
    } catch (error) {
      /* navegação privada: o progresso vale só para esta visita */
    }
  }

  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function parseDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function shortDate(step) {
    if (!step.prazo) return 'CONTÍNUO';
    const date = parseDate(step.prazo);
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  }

  function longDate(step) {
    if (!step.prazo) return step.prazoTexto;
    const date = parseDate(step.prazo);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  function deadlineStatus(step) {
    if (done.has(step.id)) return { text: 'Concluído', tone: 'done' };
    if (!step.prazo) return { text: 'Sem data final', tone: 'neutral' };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((parseDate(step.prazo) - today) / 86400000);
    if (days < 0) return { text: `Prazo passou há ${plural(-days, 'dia', 'dias')}`, tone: 'late' };
    if (days === 0) return { text: 'Prazo é hoje', tone: 'soon' };
    if (days === 1) return { text: 'Prazo é amanhã', tone: 'soon' };
    return { text: `Faltam ${plural(days, 'dia', 'dias')}`, tone: days <= 15 ? 'soon' : 'neutral' };
  }

  function stepsOf(areaId) {
    return STEPS.filter((step) => step.area === areaId);
  }

  function nodeButton(step, className) {
    return `<button type="button" class="node node-step ${className || ''}" data-id="${step.id}" aria-pressed="false">
      <span class="node-date">${esc(shortDate(step))}</span>
      <span class="node-title">${esc(step.titulo)}</span>
      <span class="node-check" aria-hidden="true">✓</span><span class="sr-only node-done-label"></span>
    </button>`;
  }

  function renderMap() {
    const branches = AREAS.map((area) => {
      const steps = stepsOf(area.id);
      return `<div class="branch" data-area="${area.id}">
        <button type="button" class="node node-area" data-area-toggle="${area.id}" aria-expanded="true">
          <span class="node-area-name">${esc(area.nome)}</span>
          <span class="node-area-count"></span>
          <span class="node-toggle" aria-hidden="true"></span>
        </button>
        <div class="leaves">${steps.map((step) => nodeButton(step)).join('')}</div>
      </div>`;
    }).join('');
    tree.insertAdjacentHTML('beforeend', `<div class="node node-root"><strong>Plano de ação</strong><span>Grupo Guimarães · ${STEPS.length} passos</span></div><div class="branches">${branches}</div>`);
  }

  function renderTimeline() {
    const sorted = STEPS.slice().sort((a, b) => {
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return a.prazo.localeCompare(b.prazo);
    });
    const groups = [];
    for (const step of sorted) {
      const key = step.prazo || 'continuo';
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.steps.push(step);
      else groups.push({ key, steps: [step] });
    }
    timelineView.innerHTML = `<ol class="timeline">${groups.map((group) => {
      const first = group.steps[0];
      const date = first.prazo ? parseDate(first.prazo) : null;
      const label = date
        ? `<strong>${date.getDate()}</strong><span>${MONTHS[date.getMonth()]} / ${date.getFullYear()}</span>`
        : '<strong>∞</strong><span>CONTÍNUO</span>';
      return `<li class="timeline-group"><div class="timeline-date">${label}</div><div class="timeline-steps">${group.steps.map((step) => `<div class="timeline-item" data-area="${step.area}">${nodeButton(step, 'node-wide')}<span class="timeline-owner">${esc(AREAS.find((a) => a.id === step.area).nome)}</span></div>`).join('')}</div></li>`;
    }).join('')}</ol>`;
  }

  function linkButtons(ids) {
    return ids.map((id) => `<button type="button" class="rel-link" data-goto="${id}"><span class="rel-date">${esc(shortDate(byId.get(id)))}</span>${esc(byId.get(id).titulo)}</button>`).join('');
  }

  function renderPanel(step) {
    const area = AREAS.find((a) => a.id === step.area);
    const status = deadlineStatus(step);
    const dependents = STEPS.filter((other) => (other.depende || []).includes(step.id)).map((other) => other.id);
    const needs = step.depende || [];
    const related = (step.relacionados || []).filter((id) => !needs.includes(id) && !dependents.includes(id));
    const isDone = done.has(step.id);

    const numbers = (step.numeros || []).length
      ? `<div class="detail-numbers">${step.numeros.map((n) => `<div><strong>${esc(n.valor)}</strong><span>${esc(n.rotulo)}</span></div>`).join('')}</div>`
      : '';

    const steps = step.passos.map((passo) => {
      const extra = passo.mensagem
        ? `<details class="message"><summary>Ver a mensagem pronta para envio</summary><pre id="message-text">${esc(MENSAGEM)}</pre><button type="button" class="copy-button" data-copy>Copiar mensagem</button></details>`
        : '';
      return `<li><div><strong>${esc(passo.t)}</strong>${passo.d ? `<p>${esc(passo.d)}</p>` : ''}${extra}</div></li>`;
    }).join('');

    const flow = (needs.length || dependents.length || related.length)
      ? `<div class="detail-flow">
          ${needs.length ? `<div><h4>Antes deste passo</h4>${linkButtons(needs)}</div>` : ''}
          ${dependents.length ? `<div><h4>Este passo libera</h4>${linkButtons(dependents)}</div>` : ''}
          ${related.length ? `<div><h4>Veja também</h4>${linkButtons(related)}</div>` : ''}
        </div>`
      : '';

    const links = step.links.map((link) => `<a href="${esc(link.href)}"${link.external ? ' target="_blank" rel="noopener"' : ''}>${esc(link.label)}${link.external ? ` <small>PDF p. ${link.page}</small>` : ' <span aria-hidden="true">→</span>'}</a>`).join('');

    panelBody.innerHTML = `
      <p class="detail-owner" data-area="${step.area}">${esc(area.nome)}</p>
      <h2 id="detail-title" tabindex="-1">${esc(step.titulo)}</h2>
      <div class="detail-chips">
        <span class="chip chip-date">Prazo: ${esc(longDate(step))}</span>
        <span class="chip chip-${status.tone}">${esc(status.text)}</span>
      </div>
      <div class="detail-done"><span>Concluído quando</span><strong>${esc(step.pronto)}</strong></div>
      ${numbers}
      <h3>Por que isso importa</h3>
      <p class="detail-why">${esc(step.porque)}</p>
      ${step.externo ? `<p class="detail-external"><strong>Atenção:</strong> ${esc(step.externo)}</p>` : ''}
      <h3>Passo a passo</h3>
      <ol class="detail-steps">${steps}</ol>
      ${flow}
      <button type="button" class="done-toggle ${isDone ? 'is-done' : ''}" data-toggle-done aria-pressed="${isDone}">${isDone ? '✓ Concluído — desmarcar' : 'Marcar como concluído'}</button>
      <div class="detail-links"><h4>Onde está no relatório</h4>${links}</div>`;
  }

  function renderEmptyPanel() {
    panelBody.innerHTML = `<div class="detail-empty"><span aria-hidden="true">◎</span><h2>Escolha um passo</h2><p>Toque em qualquer ponto do mapa para ver o prazo, o passo a passo e quando ele está concluído.</p></div>`;
  }

  function refreshNodes() {
    document.querySelectorAll('[data-id]').forEach((node) => {
      const id = node.dataset.id;
      node.setAttribute('aria-pressed', String(id === selectedId));
      node.classList.toggle('is-done', done.has(id));
      node.querySelector('.node-done-label').textContent = done.has(id) ? ' (concluído)' : '';
    });
    for (const area of AREAS) {
      const steps = stepsOf(area.id);
      const finished = steps.filter((step) => done.has(step.id)).length;
      const branch = tree.querySelector(`[data-area="${area.id}"]`);
      branch.querySelector('.node-area-count').textContent = `${plural(steps.length, 'passo', 'passos')}${finished ? ` · ${finished} concluído${finished > 1 ? 's' : ''}` : ''}`;
      branch.classList.toggle('collapsed', collapsed.has(area.id));
      branch.querySelector('.node-area').setAttribute('aria-expanded', String(!collapsed.has(area.id)));
    }
    progressText.textContent = `${done.size} de ${STEPS.length} passos concluídos`;
    progressFill.style.width = `${(done.size / STEPS.length) * 100}%`;
    drawLines();
  }

  function drawLines() {
    svg.innerHTML = '';
    if (stackedMode.matches || tree.hidden) return;
    const box = tree.getBoundingClientRect();
    if (!box.width) return;
    svg.setAttribute('width', box.width);
    svg.setAttribute('height', box.height);
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const point = (el, side) => {
      const r = el.getBoundingClientRect();
      return { x: (side === 'right' ? r.right : r.left) - box.left, y: r.top + r.height / 2 - box.top };
    };
    const paths = [];
    const connect = (from, to, active) => {
      const p = point(from, 'right');
      const q = point(to, 'left');
      const mid = (p.x + q.x) / 2;
      paths.push(`<path class="${active ? 'on' : ''}" d="M${p.x} ${p.y} C${mid} ${p.y} ${mid} ${q.y} ${q.x} ${q.y}"/>`);
    };
    const root = tree.querySelector('.node-root');
    tree.querySelectorAll('.branch').forEach((branch) => {
      const areaNode = branch.querySelector('.node-area');
      connect(root, areaNode, branch.querySelector(`[data-id="${selectedId}"]`) !== null);
      if (branch.classList.contains('collapsed')) return;
      branch.querySelectorAll('.leaves .node-step').forEach((leaf) => connect(areaNode, leaf, leaf.dataset.id === selectedId));
    });
    svg.innerHTML = paths.join('');
  }

  function setSheet(open) {
    panel.classList.toggle('open', open);
    backdrop.hidden = !open;
    document.body.classList.toggle('sheet-open', open);
  }

  function select(id, options = {}) {
    const step = byId.get(id);
    if (!step) return;
    selectedId = id;
    collapsed.delete(step.area);
    renderPanel(step);
    refreshNodes();
    if (options.updateHash !== false) history.replaceState(null, '', `#${id}`);
    if (sheetMode.matches) {
      setSheet(true);
      panel.scrollTop = 0;
      panelBody.querySelector('#detail-title').focus();
    } else if (options.focus) {
      panelBody.querySelector('#detail-title').focus({ preventScroll: true });
    }
  }

  function closeSheet() {
    setSheet(false);
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }

  function setView(view) {
    const isMap = view === 'mapa';
    tree.hidden = !isMap;
    timelineView.hidden = isMap;
    viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    if (isMap) drawLines();
  }

  function copyMessage(button) {
    const onCopied = () => {
      button.textContent = 'Mensagem copiada!';
      setTimeout(() => { button.textContent = 'Copiar mensagem'; }, 2200);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(MENSAGEM).then(onCopied, () => selectMessageText());
    } else {
      selectMessageText();
    }
  }

  function selectMessageText() {
    const text = document.getElementById('message-text');
    const range = document.createRange();
    range.selectNodeContents(text);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  document.addEventListener('click', (event) => {
    const stepNode = event.target.closest('[data-id]');
    if (stepNode) {
      lastTrigger = stepNode;
      select(stepNode.dataset.id);
      return;
    }
    const areaToggle = event.target.closest('[data-area-toggle]');
    if (areaToggle) {
      const id = areaToggle.dataset.areaToggle;
      if (collapsed.has(id)) collapsed.delete(id);
      else collapsed.add(id);
      refreshNodes();
      return;
    }
    const goto = event.target.closest('[data-goto]');
    if (goto) {
      select(goto.dataset.goto, { focus: true });
      const target = document.querySelector(`#view-mapa [data-id="${goto.dataset.goto}"]`);
      if (target && !tree.hidden && !sheetMode.matches) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    if (event.target.closest('[data-toggle-done]')) {
      if (done.has(selectedId)) done.delete(selectedId);
      else done.add(selectedId);
      saveDone();
      renderPanel(byId.get(selectedId));
      refreshNodes();
      panelBody.querySelector('[data-toggle-done]').focus({ preventScroll: true });
      return;
    }
    const copy = event.target.closest('[data-copy]');
    if (copy) {
      copyMessage(copy);
      return;
    }
    if (event.target.closest('[data-view]')) setView(event.target.closest('[data-view]').dataset.view);
  });

  closeButton.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('open')) closeSheet();
  });

  sheetMode.addEventListener('change', () => {
    if (!sheetMode.matches) setSheet(false);
  });
  stackedMode.addEventListener('change', drawLines);
  window.addEventListener('resize', drawLines);
  if ('ResizeObserver' in window) new ResizeObserver(drawLines).observe(tree);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLines);

  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!byId.has(id)) return false;
    setView('mapa');
    select(id, { updateHash: false, focus: true });
    const node = tree.querySelector(`[data-id="${id}"]`);
    if (node) requestAnimationFrame(() => node.scrollIntoView({ block: 'center' }));
    return true;
  }

  renderMap();
  renderTimeline();
  renderEmptyPanel();
  refreshNodes();
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();
