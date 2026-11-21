(function () {
  'use strict';

  const S = window.SimuladorGuimaraes;
  const { esc, fmt, store } = window.ConsultaUI;

  window.SimplesUI.iniciar(window.ClientesGuimaraes, {
    nome: 'clientes',
    rotulos: { credita: 'Fora do Simples: credita IBS e CBS', simples: 'Optantes do Simples: pagam o total', pf: 'Pessoas físicas (CPF)' },
    notas: { credita: 'Saíram do Simples ou nunca optaram', pf: 'Consumidor final; CPFs não são exibidos' },
    reforma: { credita: 'Credita IBS/CBS', simples: 'Não credita (salvo Híbrido)' }
  });

  // ------------------------------------------------------------ simulador
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'guimaraes-simulador-precos';
  const MIX_PADRAO = { real: 81.8, presumido: 0, hibrido: 0, simples: 18.2, pf: 0 };
  const salvo = store.get(STORAGE_KEY, {});
  const estado = {
    produto: S.PRODUTOS[salvo.produto] || salvo.produto === 'custom' ? salvo.produto : 'desinfetante',
    ano: S.ANOS.includes(salvo.ano) ? salvo.ano : 2027,
    tratamento: salvo.tratamento in S.TRATAMENTO ? salvo.tratamento : 'geral',
    aliquota: null,
    ajuste: 0,
    estrategia: 'margem',
    mix: { ...MIX_PADRAO, ...(salvo.mix && typeof salvo.mix === 'object' ? salvo.mix : {}) },
    custom: { ...{ preco: 10, ipi: 0, icms: 12, pisCofins: 8.14, cpv: 5, frete: 1, comissao: 0.4, despesas: 1 }, ...(salvo.custom || {}) }
  };

  function chips(container, items, atual, onPick) {
    container.innerHTML = items.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(atual)}">${esc(l)}</button>`).join('');
    container.onclick = (event) => {
      const b = event.target.closest('button');
      if (!b) return;
      container.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onPick(b.dataset.v);
    };
  }

  chips($('sim-produto'), [['desinfetante', 'Desinfetante 2L'], ['agua', 'Água sanitária 2L'], ['custom', 'Outro produto']], estado.produto, (v) => {
    estado.produto = v;
    $('sim-custom').hidden = v !== 'custom';
    atualizar();
  });
  chips($('sim-ano'), S.ANOS.map((a) => [a, a]), estado.ano, (v) => { estado.ano = Number(v); estado.aliquota = null; atualizar(); });
  chips($('sim-trat'), [['geral', 'Regra geral'], ['reducao60', 'Redução de 60%']], estado.tratamento, (v) => { estado.tratamento = v; estado.aliquota = null; atualizar(); });
  $('sim-custom').hidden = estado.produto !== 'custom';

  for (const input of $('sim-custom').querySelectorAll('input')) {
    input.value = estado.custom[input.dataset.k];
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (Number.isFinite(v) && v >= 0) estado.custom[input.dataset.k] = v;
      atualizar();
    });
  }
  $('sim-aliq').addEventListener('input', (event) => {
    const v = Number(event.target.value);
    estado.aliquota = event.target.value === '' || !Number.isFinite(v) ? null : Math.min(Math.max(v, 0), 60);
    atualizar(false);
  });
  $('sim-ajuste').addEventListener('input', (event) => { estado.ajuste = Number(event.target.value); atualizar(); });

  const perfis = S.PERFIS_CLIENTE;
  $('sim-mix').innerHTML = perfis.map((p) => `<label><span>${esc(p.nome)}</span><input type="number" min="0" max="100" step="0.1" data-perfil="${p.id}" value="${estado.mix[p.id]}" /></label>`).join('');
  $('sim-mix').addEventListener('input', (event) => {
    const input = event.target.closest('[data-perfil]');
    if (!input) return;
    const v = Number(input.value);
    estado.mix[input.dataset.perfil] = Number.isFinite(v) && v >= 0 ? v : 0;
    atualizar();
  });

  $('sim-matrix').addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-estrategia]');
    if (!row) return;
    estado.estrategia = row.dataset.estrategia;
    atualizar();
  });
  $('sim-matrix').addEventListener('keydown', (event) => {
    const row = event.target.closest('tr[data-estrategia]');
    if (row && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      estado.estrategia = row.dataset.estrategia;
      atualizar();
      $('sim-matrix').querySelector(`tr[data-estrategia="${row.dataset.estrategia}"]`).focus();
    }
  });

  const produtoAtual = () => (estado.produto === 'custom' ? { nome: 'Outro produto', tratamento: 'geral', ...estado.custom } : S.PRODUTOS[estado.produto]);
  const varClass = (v) => (v > 0.0005 ? 'up' : v < -0.0005 ? 'down' : '');
  const varTxt = (v) => (Math.abs(v) < 0.0005 ? 'igual' : fmt.signedPct(v));

  function atualizar(syncAliq = true) {
    const produto = produtoAtual();
    const padrao = S.aliquotaIVA(estado.ano, estado.tratamento);
    const aliquota = estado.aliquota ?? padrao;
    if (syncAliq) $('sim-aliq').value = String(Math.round(aliquota * 100) / 100);
    $('sim-aliq-note').textContent = `Padrão do diagnóstico para ${estado.ano}: ${fmt.rate(Math.round(padrao * 100) / 100)}${estado.tratamento === 'reducao60' ? ' (com redução de 60%)' : ''}. ICMS a ${fmt.pct(S.FATOR_ICMS[estado.ano], 0)} do atual.`;
    $('sim-ajuste-out').textContent = fmt.signedPct(estado.ajuste / 100, 1).replace('+0,0%', '0%');
    const somaMix = Object.values(estado.mix).reduce((a, b) => a + b, 0);
    $('sim-mix-total').textContent = `Soma: ${fmt.rate(Math.round(somaMix * 10) / 10)}${Math.abs(somaMix - 100) > 0.05 ? ' — os pesos são normalizados para 100%' : ''}. Padrão: diagnóstico, set–out/2026.`;
    store.set(STORAGE_KEY, { produto: estado.produto, ano: estado.ano, tratamento: estado.tratamento, mix: estado.mix, custom: estado.custom });

    let resultados;
    try {
      resultados = S.ESTRATEGIAS.map((e) => ({ e, r: S.simularCarteira(produto, estado.ano, e.id, somaMix > 0 ? estado.mix : MIX_PADRAO, { tratamento: estado.tratamento, aliquota, ajuste: estado.ajuste }) }));
    } catch (error) {
      $('sim-headline').innerHTML = `<span>Revise os dados</span><p>${esc(error.message)}</p>`;
      return;
    }

    // Matriz das estratégias
    const head = `<thead><tr><th scope="col">Estratégia</th><th scope="col" class="num">Total da nota</th><th scope="col" class="num">Margem Guimarães</th>${perfis.map((p) => `<th scope="col" class="num">${esc(p.nome)}</th>`).join('')}<th scope="col" class="num">Carteira</th></tr></thead>`;
    const rows = resultados.map(({ e, r }) => `<tr data-estrategia="${e.id}" tabindex="0" class="${e.id === estado.estrategia ? 'on' : ''}" aria-selected="${e.id === estado.estrategia}">
      <td class="strat">${esc(e.nome)}<small>${e.id === 'ajuste' ? `líquido ${fmt.signedPct(estado.ajuste / 100)}` : ''}</small></td>
      <td class="num">${fmt.brl(r.nota.total)}<small class="${varClass(r.variacaoTotal)}">${varTxt(r.variacaoTotal)}</small></td>
      <td class="num">${fmt.brl(r.margem)}<small>${fmt.pct(r.margemPct)} da nota · ${r.variacaoMargem === null ? '—' : varTxt(r.variacaoMargem)}</small></td>
      ${r.clientes.map((c) => `<td class="num"><span class="${varClass(c.variacao)}">${varTxt(c.variacao)}</span><small>${fmt.brl(c.reforma)}</small></td>`).join('')}
      <td class="num"><span class="${varClass(r.variacaoCarteira)}">${varTxt(r.variacaoCarteira)}</span></td>
    </tr>`).join('');
    $('sim-matrix').innerHTML = `${head}<tbody>${rows}</tbody>`;
    $('sim-matrix-title').textContent = `${produto.nome} · ${estado.ano} · CBS + IBS ${fmt.rate(Math.round(aliquota * 100) / 100)}`;

    // Destaque
    const { e, r } = resultados.find((x) => x.e.id === estado.estrategia);
    const real = r.clientes.find((c) => c.id === 'real');
    const simples = r.clientes.find((c) => c.id === 'simples');
    const melhorMargem = resultados.reduce((a, b) => (b.r.margem > a.r.margem ? b : a));
    $('sim-headline').innerHTML = `<span>${esc(e.nome)}</span><p>A nota vai de <strong>${fmt.brl(r.hoje.total)}</strong> para <strong>${fmt.brl(r.nota.total)}</strong> (${varTxt(r.variacaoTotal)}) e a margem da Guimarães de <strong>${fmt.brl(r.margemHoje)}</strong> para <strong>${fmt.brl(r.margem)}</strong> por unidade. O cliente do Lucro Real tem custo ${real.variacao > 0.0005 ? 'maior' : real.variacao < -0.0005 ? 'menor' : 'igual'} (${varTxt(real.variacao)}); o do Simples, ${simples.variacao > 0.0005 ? 'maior' : simples.variacao < -0.0005 ? 'menor' : 'igual'} (${varTxt(simples.variacao)}). Na carteira, o custo médio dos clientes ${r.variacaoCarteira > 0.0005 ? 'sobe' : r.variacaoCarteira < -0.0005 ? 'cai' : 'fica igual'} ${Math.abs(r.variacaoCarteira) >= 0.0005 ? fmt.pct(Math.abs(r.variacaoCarteira)) : ''}.${melhorMargem.e.id !== e.id ? ` A maior margem entre as opções é a de ${esc(melhorMargem.e.nome.split(' · ')[0])} (${fmt.brl(melhorMargem.r.margem)}).` : ''}</p>`;

    // Nota
    const h = r.hoje;
    const n = r.nota;
    const linha = (rotulo, a, b, cls = '') => `<tr class="${cls}"><td>${rotulo}</td><td class="num">${a}</td><td class="num">${b}</td></tr>`;
    const neg = (v) => (v ? `−${fmt.brl(v)}` : '—');
    $('sim-nota-title').textContent = `${produto.nome}: hoje × ${estado.ano}`;
    $('sim-nota').innerHTML = `<thead><tr><th scope="col">Por unidade</th><th scope="col" class="num">Hoje</th><th scope="col" class="num">${estado.ano}</th></tr></thead><tbody>
      ${linha('Preço sem IPI e sem CBS/IBS', fmt.brl(h.preco), fmt.brl(n.preco))}
      ${linha(`(−) ICMS ${fmt.rate(produto.icms)} hoje`, neg(h.icms), S.FATOR_ICMS[estado.ano] ? neg(n.icms) : 'extinto')}
      ${linha(`(−) PIS/COFINS ${fmt.rate(produto.pisCofins)}`, neg(h.pisCofins), 'extinto')}
      ${linha('= Valor líquido de tributos', fmt.brl(h.liquido), fmt.brl(n.liquido), 'total')}
      ${linha('(−) Frete, comissão, despesas e custo', neg(r.custos), neg(r.custos))}
      ${linha('= Margem de contribuição', fmt.brl(r.margemHoje), fmt.brl(r.margem), 'total')}
      ${linha('(+) CBS + IBS por fora', '—', `${fmt.brl(n.iva)} <small>${fmt.rate(Math.round(n.aliquotaIva * 100) / 100)}</small>`)}
      ${linha(`(+) IPI ${fmt.rate(produto.ipi)}`, fmt.brl(h.ipi), 'zerado')}
      ${linha('= Total da nota', fmt.brl(h.total), fmt.brl(n.total), 'peak')}
    </tbody>`;
  }

  atualizar();
})();
