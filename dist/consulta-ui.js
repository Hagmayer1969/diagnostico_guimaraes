(function (root) {
  'use strict';

  // Utilitários comuns às páginas de consulta (produtos, clientes e fornecedores).

  const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = new Intl.NumberFormat('pt-BR');
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dec = (digits) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmt = {
    int: (n) => int.format(n),
    brl: (n) => brl.format(n),
    mi: (n) => `R$ ${dec(2).format(n / 1e6)} mi`,
    rate: (n) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n)}%`,
    pct: (n, digits = 1) => `${dec(digits).format(n * 100)}%`,
    signedPct: (n, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${dec(digits).format(Math.abs(n) * 100)}%`,
    signedBrl: (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${brl.format(Math.abs(n))}`
  };

  const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const cnpjMask = (d) => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  const ncmMask = (n) => (n && n.length === 8 ? `${n.slice(0, 4)}.${n.slice(4, 6)}.${n.slice(6)}` : n || '—');
  const plural = (n, one, many) => `${int.format(n)} ${n === 1 ? one : many}`;

  const store = {
    get(key, fallback) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        /* navegação privada: vale só para esta visita */
      }
    }
  };

  function downloadCSV(filename, header, rows) {
    const cell = (value) => {
      const text = String(value ?? '');
      return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = '﻿' + [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Dica flutuante para gráficos: segue o ponteiro e o foco do teclado.
  let tip;
  function showTip(html, target, event) {
    if (!tip) {
      tip = Object.assign(document.createElement('div'), { className: 'tip', role: 'tooltip' });
      document.body.append(tip);
    }
    tip.innerHTML = html;
    tip.hidden = false;
    const box = tip.getBoundingClientRect();
    let x, y;
    if (event && event.clientX) {
      x = event.clientX + 14;
      y = event.clientY - box.height - 12;
    } else {
      const r = target.getBoundingClientRect();
      x = r.left + r.width / 2 - box.width / 2;
      y = r.top - box.height - 8;
    }
    tip.style.left = `${Math.max(8, Math.min(x, window.innerWidth - box.width - 8))}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  }
  function hideTip() {
    if (tip) tip.hidden = true;
  }
  function bindTip(element, html) {
    element.addEventListener('pointermove', (event) => showTip(html(), element, event));
    element.addEventListener('pointerleave', hideTip);
    element.addEventListener('focus', () => showTip(html(), element));
    element.addEventListener('blur', hideTip);
  }

  // Barra de composição (parte do todo) com legenda e rótulos sempre visíveis.
  function stack(container, legend, segments, { onSelect, selected } = {}) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    container.innerHTML = '';
    legend.innerHTML = '';
    for (const s of segments) {
      const share = total ? s.value / total : 0;
      const bar = document.createElement('button');
      bar.type = 'button';
      bar.style.setProperty('--seg', s.color);
      bar.style.flex = `${Math.max(share, 0.004)} 1 0`;
      bar.setAttribute('aria-label', `${s.label}: ${int.format(s.value)} (${fmt.pct(share)})`);
      if (onSelect) bar.setAttribute('aria-pressed', String(selected === s.id));
      bindTip(bar, () => `<strong>${esc(s.label)}</strong><br>${int.format(s.value)} · ${fmt.pct(share)}${s.hint ? `<br>${esc(s.hint)}` : ''}`);
      if (onSelect) bar.addEventListener('click', () => onSelect(s.id));
      else bar.tabIndex = -1;
      container.append(bar);
      const li = document.createElement('li');
      li.style.setProperty('--seg', s.color);
      li.innerHTML = `<i aria-hidden="true"></i><span>${esc(s.label)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</span><strong>${esc(s.display ?? int.format(s.value))}</strong><span class="pct">${fmt.pct(share)}</span>`;
      legend.append(li);
    }
  }

  // Colunas verticais com uma ou mais séries (sempre a mesma escala).
  function bars(container, axis, items, { series, format = (v) => int.format(v), label = (it) => it.label, showValues = true }) {
    const max = Math.max(...items.flatMap((it) => series.map((s) => it[s.key])), 0) || 1;
    container.innerHTML = '';
    axis.innerHTML = '';
    container.classList.toggle('grouped', series.length > 1);
    for (const it of items) {
      const col = document.createElement('div');
      col.className = 'bar';
      col.tabIndex = 0;
      for (const s of series) {
        const h = (it[s.key] / max) * 100;
        const span = document.createElement('span');
        span.style.height = `${h}%`;
        span.style.setProperty('--bar', s.color);
        col.append(span);
      }
      if (showValues && series.length === 1) {
        const b = document.createElement('b');
        b.textContent = format(it[series[0].key]);
        col.style.setProperty('--h', `${(it[series[0].key] / max) * 100}%`);
        b.style.bottom = `calc(${(it[series[0].key] / max) * 100}% + 4px)`;
        col.append(b);
      }
      col.setAttribute('aria-label', `${label(it)}: ${series.map((s) => `${s.name} ${format(it[s.key])}`).join(', ')}`);
      bindTip(col, () => `<strong>${esc(label(it))}</strong>${series.map((s) => `<br>${esc(s.name)}: ${esc(format(it[s.key]))}`).join('')}`);
      container.append(col);
      const x = document.createElement('span');
      x.textContent = it.short ?? label(it);
      axis.append(x);
    }
  }

  // Painel lateral que vira gaveta em telas menores (mesmo comportamento do plano de ação).
  function sheet({ panel, close, backdrop, query = '(max-width: 1100px)' }) {
    const mode = window.matchMedia(query);
    let lastTrigger = null;
    function open(trigger) {
      lastTrigger = trigger || null;
      if (!mode.matches) return;
      panel.classList.add('open');
      backdrop.hidden = false;
      document.body.classList.add('sheet-open');
      close.focus();
    }
    function shut() {
      panel.classList.remove('open');
      backdrop.hidden = true;
      document.body.classList.remove('sheet-open');
      if (lastTrigger) lastTrigger.focus();
    }
    close.addEventListener('click', shut);
    backdrop.addEventListener('click', shut);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.classList.contains('open')) shut();
    });
    mode.addEventListener('change', () => { if (!mode.matches) shut(); });
    return { open, close: shut, isSheet: () => mode.matches };
  }

  root.ConsultaUI = Object.freeze({ esc, fmt, normalize, cnpjMask, ncmMask, plural, store, downloadCSV, bindTip, showTip, hideTip, stack, bars, sheet });
})(window);
