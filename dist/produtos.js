(function () {
  'use strict';

  const D = window.ProdutosGuimaraes;
  const { esc, fmt, normalize, ncmMask, plural, store, downloadCSV, stack, bars, sheet } = window.ConsultaUI;
  const T = (i) => (i === undefined || i === null ? '' : D.textos[i]);
  const ANOS = D.meta.anos;
  const STORAGE_KEY = 'guimaraes-produtos-revisao';
  const PAGE = 40;

  const REVISAO = [
    ['', 'Pendente'],
    ['geral', 'Confirmado: regra geral'],
    ['beneficio', 'Confirmado: aplicar o enquadramento'],
    ['equipe', 'Encaminhado à equipe fiscal']
  ];
  const STATUS = {
    alta: { label: 'Prioridade alta', short: 'Prioridade alta', color: '#a33a2a', tag: 'alta' },
    media: { label: 'A validar', short: 'A validar', color: '#b07a12', tag: 'media' },
    ok: { label: 'Regra geral, sem pendência', short: 'Regra geral', color: '#2f6b43', tag: 'ok' }
  };

  // ---------------------------------------------------------- modelo
  const produtos = D.produtos.map(([codigo, descricao, ncm, opcoes, flags, imunidade]) => {
    const opts = opcoes.map((id) => D.opcoes[id]);
    const has = (f) => flags.includes(f);
    const status = has('diag-agua') || has('diag-desinf') || has('diag-ncm') ? 'alta' : has('alternativa') || has('imunidade') ? 'media' : 'ok';
    const tipos = new Set(opts.filter((o) => o.cst !== '000').map((o) => (o.cst === '200' ? `200-${o.red}` : o.cst)));
    return {
      codigo, descricao, ncm, opts, flags, imunidade: imunidade || [], status, tipos,
      busca: normalize(`${codigo} ${descricao} ${ncm} ${ncmMask(ncm)}`),
      num: Number(codigo)
    };
  });
  const byCodigo = new Map(produtos.map((p) => [p.codigo, p]));
  const ordem = { alta: 0, media: 1, ok: 2 };
  produtos.sort((a, b) => ordem[a.status] - ordem[b.status] || a.num - b.num);

  let revisao = store.get(STORAGE_KEY, {});
  if (typeof revisao !== 'object' || Array.isArray(revisao)) revisao = {};

  const taxa = (opcao, ano) => {
    const [ibs, cbs] = D.perfis[opcao.perfil][ANOS.indexOf(ano)];
    return { ibs, cbs, total: Math.round((ibs + cbs) * 100) / 100 };
  };

  function tratamento(o) {
    if (o.cst === '000') return 'Regra geral';
    if (o.cst === '200') return o.red === 100 ? 'Alíquota zero' : `Redução de ${o.red}%`;
    if (o.cst === '410') return 'Imunidade';
    if (o.cst === '515') return `Diferimento${o.red ? ` com redução de ${o.red}%` : ''}`;
    if (o.cst === '550') return 'Suspensão';
    return T(o.cstDesc);
  }

  function motivos(p) {
    const list = [];
    const has = (f) => p.flags.includes(f);
    const alt = p.opts.filter((o) => o.cst !== '000');
    if (has('diag-agua')) list.push(['alta', 'Água sanitária vendida no NCM 2828.90.19: hoje sai na regra geral (cClassTrib 000001). O Anexo VIII dá redução de 60% à água sanitária classificada no 3808.94.19. A FISPQ define o NCM correto antes do ajuste no Sankhya.']);
    if (has('diag-desinf')) list.push(['alta', 'A consulta sugere redução de 60% (cClassTrib 200035) para o NCM 3808.94.19, mas o Anexo VIII nomeia só a água sanitária. Sem respaldo na descrição, a nota deve sair na regra geral, como apontado no diagnóstico.']);
    if (has('diag-ncm')) list.push(['alta', 'NCM provavelmente errado: o produto está no NCM de desinfetantes (3808.94.19) sem ser desinfetante. Corrigir o cadastro antes de definir o cClassTrib.']);
    if (has('diag-interna')) list.push(['info', 'Água sanitária a granel de uso interno: segundo o diagnóstico, não é vendida e não afeta a nota.']);
    if (alt.length && !has('diag-desinf')) list.push(['media', `O NCM aparece em ${plural(alt.length, 'enquadramento', 'enquadramentos')} com tratamento diferente da regra geral. O benefício só vale se a descrição do produto corresponder à descrição da lei — compare abaixo.`]);
    if (has('imunidade')) list.push(['media', `A consulta aponta imunidade ou não incidência (ICMS/Constituição) para ${p.imunidade.map((i) => i[0]).filter((v, i, a) => a.indexOf(v) === i).join(', ')}. Confirmar se o produto pertence ao segmento indicado.`]);
    if (has('gtin')) list.push(['info', 'Se o enquadramento com redução for confirmado, a NF-e precisa informar o GTIN (cEAN e cEANTrib).']);
    if (has('destinacao')) list.push(['info', 'O cClassTrib pode mudar conforme o comprador (por exemplo, administração pública ou entidade imune).']);
    return list;
  }

  // ---------------------------------------------------------- elementos
  const $ = (id) => document.getElementById(id);
  const q = $('q');
  const filtro = $('filtro');
  const anoSelect = $('ano');
  const results = $('results');
  const count = $('count');
  const more = $('more');
  const body = $('detail-body');
  const panel = sheet({ panel: $('detail'), close: $('detail-close'), backdrop: $('sheet-backdrop') });

  let ano = 2027;
  let limite = PAGE;
  let selecionado = null;
  let lista = [];

  anoSelect.innerHTML = ANOS.map((a) => `<option value="${a}"${a === ano ? ' selected' : ''}>Alíquotas de ${a}</option>`).join('');

  // ---------------------------------------------------------- panorama
  const total = (s) => produtos.filter((p) => p.status === s).length;
  const contagem = { alta: total('alta'), media: total('media'), ok: total('ok') };
  $('m-total').textContent = fmt.int(produtos.length);
  $('m-ncm').textContent = fmt.int(new Set(produtos.map((p) => p.ncm)).size);
  $('m-alta').textContent = fmt.int(contagem.alta);
  $('m-media').textContent = fmt.int(contagem.media);

  function desenharStatus() {
    const sel = filtro.value in STATUS ? filtro.value : null;
    stack($('stack-status'), $('legend-status'), Object.entries(STATUS).map(([id, s]) => ({
      id, label: s.label, value: contagem[id], color: s.color,
      note: id === 'alta' ? 'Água sanitária, desinfetantes e NCMs trocados' : id === 'media' ? 'NCM em anexo de benefício ou imunidade' : 'Sem enquadramento alternativo na consulta'
    })), { selected: sel, onSelect: (id) => aplicarFiltro(filtro.value === id ? 'todos' : id) });
  }

  const ALT = [
    ['cst:200-60', 'Possível redução de 60%'],
    ['cst:200-100', 'Possível alíquota zero'],
    ['cst:410', 'Possível imunidade'],
    ['cst:515', 'Diferimento'],
    ['cst:550', 'Suspensão'],
    ['gtin', 'Exigem GTIN na NF-e']
  ];
  $('kpis-alt').innerHTML = ALT.map(([key, label]) => `<button type="button" class="kpi" data-filtro="${key}"><strong>${fmt.int(produtos.filter((p) => passa(p, key)).length)}</strong><span>${label}</span></button>`).join('');
  $('kpis-alt').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filtro]');
    if (button) aplicarFiltro(button.dataset.filtro);
  });

  const perfilGeral = D.opcoes.find((o) => o.cst === '000').perfil;
  const perfil60 = D.opcoes.find((o) => o.cst === '200' && o.red === 60).perfil;
  const series = [
    { key: 'geral', name: 'Regra geral', color: '#2f74c0' },
    { key: 'red', name: 'Redução de 60%', color: '#b07a12' }
  ];
  $('rates-legend').innerHTML = series.map((s) => `<span style="--seg:${s.color}"><i></i>${s.name}</span>`).join('');
  bars($('rates-chart'), $('rates-axis'), ANOS.map((a, i) => ({
    label: String(a), short: String(a),
    geral: D.perfis[perfilGeral][i][0] + D.perfis[perfilGeral][i][1],
    red: D.perfis[perfil60][i][0] + D.perfis[perfil60][i][1]
  })), { series, format: (v) => fmt.rate(Math.round(v * 100) / 100) });

  // ---------------------------------------------------------- filtro e busca
  function passa(p, key) {
    if (key === 'todos') return true;
    if (key === 'revisar') return p.status !== 'ok';
    if (key in STATUS) return p.status === key;
    if (key === 'pendentes') return p.status !== 'ok' && !revisao[p.codigo];
    if (key === 'revisados') return Boolean(revisao[p.codigo]);
    if (key.startsWith('cst:')) return p.tipos.has(key.slice(4));
    return p.flags.includes(key);
  }

  function filtrar() {
    const termos = normalize(q.value).replace(/[.\-/]/g, ' ').split(/\s+/).filter(Boolean);
    const key = filtro.value;
    lista = produtos.filter((p) => {
      if (!passa(p, key)) return false;
      return termos.every((t) => p.busca.includes(t) || (/^\d+$/.test(t) && p.ncm.startsWith(t)));
    });
    // Código exato primeiro.
    const exato = termos.length === 1 ? lista.findIndex((p) => p.codigo === termos[0]) : -1;
    if (exato > 0) lista.unshift(...lista.splice(exato, 1));
  }

  function aplicarFiltro(key) {
    filtro.value = key;
    limite = PAGE;
    filtrar();
    render();
    desenharStatus();
    document.getElementById('consulta').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function tags(p) {
    const s = STATUS[p.status];
    const out = [`<span class="tag ${s.tag}">${s.short}</span>`];
    const estado = REVISAO.find(([v]) => v === revisao[p.codigo]);
    if (revisao[p.codigo]) out.push(`<span class="tag">${esc(estado ? estado[1].replace('Confirmado: ', '✓ ') : 'Revisado')}</span>`);
    return out.join('');
  }

  function render() {
    count.textContent = `${plural(lista.length, 'produto', 'produtos')}${filtro.value !== 'todos' || q.value ? ' no filtro' : ''}`;
    if (!lista.length) {
      results.innerHTML = '<li class="empty">Nenhum produto encontrado. Tente parte da descrição, o código ou os primeiros dígitos do NCM.</li>';
      more.hidden = true;
      return;
    }
    results.innerHTML = lista.slice(0, limite).map((p) => {
      const geral = taxa(p.opts[0], ano);
      const alt = p.opts.filter((o) => o.cst !== '000').map((o) => taxa(o, ano).total);
      const faixa = alt.length ? `<small>ou ${[...new Set(alt)].sort((a, b) => a - b).map(fmt.rate).join(' / ')}</small>` : `<small>${ano}</small>`;
      return `<li><button type="button" class="result" data-codigo="${esc(p.codigo)}" aria-pressed="${p.codigo === selecionado}">
        <span class="result-code">${esc(p.codigo)}</span>
        <span class="result-main"><strong>${esc(p.descricao)}</strong><small><span class="p-ncm">NCM ${ncmMask(p.ncm)}</span>${tags(p)}</small></span>
        <span class="result-rate"><strong>${fmt.rate(geral.total)}</strong>${faixa}</span>
      </button></li>`;
    }).join('');
    more.hidden = lista.length <= limite;
    more.textContent = `Mostrar mais ${Math.min(PAGE, lista.length - limite)} de ${fmt.int(lista.length - limite)}`;
  }

  // ---------------------------------------------------------- detalhe
  function tabelaAnos(o) {
    const head = ANOS.map((a) => `<th class="${a === ano ? 'on' : ''}">${String(a).slice(2)}</th>`).join('');
    const linha = (rotulo, k) => `<tr><td>${rotulo}</td>${ANOS.map((a) => `<td class="${a === ano ? 'on' : ''}">${fmt.rate(taxa(o, a)[k])}</td>`).join('')}</tr>`;
    return `<table class="rates"><caption class="sr-only">Alíquotas por ano</caption><thead><tr><th>Ano</th>${head}</tr></thead><tbody>${linha('IBS', 'ibs')}${linha('CBS', 'cbs')}${linha('Total', 'total')}</tbody></table>`;
  }

  function opcaoHTML(o, p) {
    const t = taxa(o, ano);
    const alt = o.cst !== '000';
    const extra = [];
    if (o.lc) extra.push(`<details><summary>Texto da Lei Complementar</summary><p>${esc(T(o.lc))}</p></details>`);
    const alertas = [...(o.alertas || []).map(T), T(o.alertaCst)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    if (alertas.length) extra.push(`<details><summary>${plural(alertas.length, 'alerta', 'alertas')} da consulta</summary>${alertas.map((a) => `<p>${esc(a)}</p>`).join('')}</details>`);
    return `<div class="option${alt ? ' alt' : ''}">
      <div class="option-top"><div><span class="c-kicker">${alt ? 'Enquadramento possível' : 'Classificação padrão'}</span><strong>${esc(tratamento(o))}</strong></div>
      <div class="option-rate"><strong>${fmt.rate(t.total)}</strong><small>IBS ${fmt.rate(t.ibs)} + CBS ${fmt.rate(t.cbs)} em ${ano}</small></div></div>
      ${alt && o.descLei !== undefined ? `<div class="compare"><b>Descrição na lei</b>${esc(T(o.descLei))}<b style="margin-top:8px">Descrição no cadastro</b>${esc(p.descricao)}</div>` : ''}
      <dl>
        <dt>CST</dt><dd>${esc(o.cst)} · ${esc(T(o.cstDesc))}</dd>
        <dt>cClassTrib</dt><dd>${esc(o.cct)} · ${esc(T(o.cctDesc))}</dd>
        ${o.red !== undefined ? `<dt>Redução</dt><dd>${o.red}% das alíquotas de IBS e CBS</dd>` : ''}
        ${o.item ? `<dt>Item / NCM</dt><dd>Item ${esc(o.item)}${o.ncmLegal ? ` · NCM na lei ${esc(o.ncmLegal)}` : ''}</dd>` : ''}
        <dt>Fundamento</dt><dd>${esc(T(o.fund))}${o.lcArt ? ` (${esc(o.lcArt)})` : ''}</dd>
      </dl>
      ${tabelaAnos(o)}
      ${extra.join('')}
    </div>`;
  }

  function detalhe(codigo, trigger) {
    const p = byCodigo.get(codigo);
    if (!p) return;
    selecionado = codigo;
    results.querySelectorAll('.result').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.codigo === codigo)));
    const s = STATUS[p.status];
    const pend = motivos(p);
    const alt = p.opts.filter((o) => o.cst !== '000');
    const reviewClass = p.status;
    const imun = p.imunidade.length ? `<div class="p-block"><h3>Imunidade e não incidência por destino</h3>${p.imunidade.map(([uf, seg, fund]) => `<div class="option"><div class="option-top"><strong>Destino ${esc(uf)}</strong></div><dl><dt>Segmento</dt><dd>${esc(T(seg))}</dd><dt>Fundamento</dt><dd>${esc(T(fund))}</dd></dl></div>`).join('')}</div>` : '';
    body.innerHTML = `
      <p class="detail-owner">Produto ${esc(p.codigo)} · NCM ${ncmMask(p.ncm)}</p>
      <h2 id="detail-title" tabindex="-1">${esc(p.descricao)}</h2>
      <div class="detail-chips"><span class="tag ${s.tag}">${s.label}</span><span class="chip">Origem ${esc(D.meta.ufOrigem)} → ${esc(D.meta.ufDestino.join(', '))}</span></div>
      <div class="review ${reviewClass}">
        <h4>${p.status === 'ok' ? 'Sem pendência na consulta' : 'O que a equipe precisa confirmar'}</h4>
        ${pend.length ? `<ul>${pend.map(([nivel, texto]) => `<li>${nivel === 'info' ? '<em>Observação:</em> ' : ''}${esc(texto)}</li>`).join('')}</ul>` : '<ul><li>A consulta devolve só a tributação integral (CST 000, cClassTrib 000001) para este NCM.</li></ul>'}
        <label for="rev-state">Situação da revisão (salva neste navegador)</label>
        <select class="select" id="rev-state">${REVISAO.map(([v, l]) => `<option value="${v}"${(revisao[p.codigo] || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      <div class="p-block"><h3>Classificação padrão</h3>${opcaoHTML(p.opts[0], p)}</div>
      ${alt.length ? `<div class="p-block"><h3>${plural(alt.length, 'enquadramento possível', 'enquadramentos possíveis')}</h3>${alt.map((o) => opcaoHTML(o, p)).join('')}</div>` : ''}
      ${imun}
      <div class="p-block"><h3>Alerta geral de ${ano}</h3><p class="detail-why">${esc(T(D.alertaAno[ANOS.indexOf(ano)]))}</p></div>`;
    $('rev-state').addEventListener('change', (event) => {
      if (event.target.value) revisao[p.codigo] = event.target.value;
      else delete revisao[p.codigo];
      store.set(STORAGE_KEY, revisao);
      const row = results.querySelector(`[data-codigo="${CSS.escape(p.codigo)}"] .result-main small`);
      if (row) row.innerHTML = `<span class="p-ncm">NCM ${ncmMask(p.ncm)}</span>${tags(p)}`;
    });
    if (panel.isSheet()) panel.open(trigger);
    else if (trigger) $('detail').scrollTop = 0;
    if (history.replaceState) history.replaceState(null, '', `#p-${p.codigo}`);
  }

  // ---------------------------------------------------------- exportação
  $('export').addEventListener('click', () => {
    const header = ['Código', 'Descrição', 'NCM', 'Prioridade', 'Revisão (este navegador)', `IBS+CBS ${ano} regra geral`, 'Enquadramentos possíveis', 'cClassTrib possíveis', 'O que confirmar'];
    const rows = lista.map((p) => {
      const alt = p.opts.filter((o) => o.cst !== '000');
      const estado = REVISAO.find(([v]) => v === (revisao[p.codigo] || ''));
      return [p.codigo, p.descricao, ncmMask(p.ncm), STATUS[p.status].label, estado ? estado[1] : '',
        fmt.rate(taxa(p.opts[0], ano).total), alt.map((o) => `${tratamento(o)} (${fmt.rate(taxa(o, ano).total)})`).join(' | '),
        alt.map((o) => o.cct).join(' | '), motivos(p).map(([, t]) => t).join(' | ')];
    });
    downloadCSV(`guimaraes-produtos-${filtro.value.replace(/[^a-z0-9-]/gi, '-')}-${ano}.csv`, header, rows);
  });

  // ---------------------------------------------------------- eventos
  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { limite = PAGE; filtrar(); render(); }, 120);
  });
  filtro.addEventListener('change', () => { limite = PAGE; filtrar(); render(); desenharStatus(); });
  anoSelect.addEventListener('change', () => {
    ano = Number(anoSelect.value);
    render();
    if (selecionado) detalhe(selecionado);
  });
  more.addEventListener('click', () => { limite += PAGE; render(); });
  results.addEventListener('click', (event) => {
    const button = event.target.closest('.result');
    if (button) detalhe(button.dataset.codigo, button);
  });

  filtrar();
  render();
  desenharStatus();
  const inicial = location.hash.match(/^#p-(.+)$/);
  if (inicial && byCodigo.has(decodeURIComponent(inicial[1]))) detalhe(decodeURIComponent(inicial[1]));
})();
