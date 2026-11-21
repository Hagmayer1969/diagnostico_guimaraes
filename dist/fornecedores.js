(function () {
  'use strict';

  const S = window.SimuladorGuimaraes;
  const { esc, fmt, stack, bars } = window.ConsultaUI;
  const COR = window.SimplesUI.COR;
  const $ = (id) => document.getElementById(id);

  window.SimplesUI.iniciar(window.FornecedoresGuimaraes, {
    nome: 'fornecedores',
    rotulos: { credita: 'Fora do Simples: crédito integral', simples: 'Optantes do Simples: crédito só do DAS', pf: 'Pessoas físicas (CPF)' },
    notas: { credita: 'Saíram do Simples ou nunca optaram', pf: 'Produtores e outros fornecedores sem CNPJ' },
    reforma: { credita: 'Integral (CBS + IBS)', simples: 'Só o DAS (integral se Híbrido)' }
  });

  // Composição por valor: seção 2 do diagnóstico (p. 5).
  stack($('stack-valor'), $('legend-valor'), [
    { id: 'fora', label: 'Fora do Simples', note: '889 fornecedores · crédito integral', value: 89.66, display: 'R$ 89,66 mi', color: COR.credita },
    { id: 'grupo', label: 'Empresas do grupo (Híbrido)', note: '4 empresas · crédito integral', value: 7.38, display: 'R$ 7,38 mi', color: COR.pf },
    { id: 'simples', label: 'Simples tradicional', note: '538 fornecedores · crédito só do DAS', value: 5.52, display: 'R$ 5,52 mi', color: COR.simples },
    { id: 'nd', label: 'Não identificados', note: '435 fornecedores · a confirmar', value: 5.66, display: 'R$ 5,66 mi', color: COR.outro }
  ]);

  // Crédito por R$ 100 de compra.
  const anosTabela = [2027, 2029, 2033];
  $('credito-tabela').innerHTML = `<thead><tr><th scope="col">Regime do fornecedor</th><th scope="col" class="num">Hoje (PIS/COFINS)</th>${anosTabela.map((a) => `<th scope="col" class="num">${a} (CBS + IBS)</th>`).join('')}</tr></thead><tbody>
    <tr><td>Regime regular (Presumido ou Real)</td><td class="num">R$ 9,25</td>${anosTabela.map((a) => `<td class="num down">${fmt.brl(S.ALIQUOTA_IVA[a])}</td>`).join('')}</tr>
    <tr><td>Simples Híbrido</td><td class="num">R$ 9,25</td>${anosTabela.map((a) => `<td class="num down">${fmt.brl(S.ALIQUOTA_IVA[a])}</td>`).join('')}</tr>
    <tr><td>Simples tradicional e MEI</td><td class="num">R$ 9,25</td>${anosTabela.map(() => '<td class="num up">só o do DAS</td>').join('')}</tr>
  </tbody>`;

  // ------------------------------------------------------------ comparação de propostas
  let ano = 2027;
  let tratamento = 'geral';
  let aliquota = null;

  function chips(container, items, atual, onPick) {
    container.innerHTML = items.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(atual)}">${esc(l)}</button>`).join('');
    container.addEventListener('click', (event) => {
      const b = event.target.closest('button');
      if (!b) return;
      container.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onPick(b.dataset.v);
    });
  }
  chips($('sim-ano'), S.ANOS.map((a) => [a, a]), ano, (v) => { ano = Number(v); aliquota = null; comparar(); });
  chips($('sim-trat'), [['geral', 'Regra geral'], ['reducao60', 'Redução de 60%']], tratamento, (v) => { tratamento = v; aliquota = null; comparar(); });
  $('sim-aliq').addEventListener('input', (event) => {
    const v = Number(event.target.value);
    aliquota = event.target.value === '' || !Number.isFinite(v) ? null : Math.min(Math.max(v, 0), 60);
    comparar(false);
  });
  ['a-preco', 'a-icms', 'b-preco', 'b-icms', 'b-das', 'b-hibrido'].forEach((id) => $(id).addEventListener('input', () => comparar()));

  const num = (id, min = 0) => {
    const v = Number($(id).value);
    return Number.isFinite(v) && v >= min ? v : min;
  };

  function cartao(titulo, r, creditos, venceu, nota) {
    return `<div class="c-card${venceu ? ' win' : ''}"><span class="c-kicker">${esc(titulo)}${venceu ? '<span class="badge-win">menor custo</span>' : ''}</span>
      <h3>${fmt.brl(r.custo)} <small style="font-size:13px;color:var(--muted);font-weight:700">custo líquido em ${ano}</small></h3>
      <dl>
        <dt>Pago na nota</dt><dd>${fmt.brl(r.pago)}</dd>
        <dt>(−) Créditos (${creditos})</dt><dd>−${fmt.brl(r.credito)}</dd>
        <dt class="sum">= Custo líquido</dt><dd class="sum">${fmt.brl(r.custo)}</dd>
      </dl>
      ${nota ? `<p class="c-note">${nota}</p>` : ''}
    </div>`;
  }

  function comparar(syncAliq = true) {
    const padrao = S.aliquotaIVA(ano, tratamento);
    const aliq = aliquota ?? padrao;
    if (syncAliq) $('sim-aliq').value = String(Math.round(aliq * 100) / 100);
    $('sim-aliq-note').textContent = `Padrão do diagnóstico para ${ano}: ${fmt.rate(Math.round(padrao * 100) / 100)}. ICMS a ${fmt.pct(S.FATOR_ICMS[ano], 0)} do atual.`;
    const hibrido = $('b-hibrido').checked;
    $('b-preco').previousElementSibling.textContent = hibrido ? 'Preço sem CBS/IBS (R$)' : 'Total da nota (R$)';
    $('b-das').disabled = hibrido;

    const A = { tipo: 'regular', preco: num('a-preco', 0.01), icms: num('a-icms') };
    const B = { tipo: hibrido ? 'hibrido' : 'simples', preco: num('b-preco', 0.01), icms: num('b-icms'), creditoDas: num('b-das') };
    // A alíquota exibida já tem a redução embutida; o modelo aplica o tratamento sobre a alíquota cheia.
    const op = { ano, aliquota: aliq / (S.TRATAMENTO[tratamento] || 1), tratamento };
    const aAno = S.custoCompra({ ...A, ...op });
    const bAno = S.custoCompra({ ...B, ...op });
    const diff = bAno.custo - aAno.custo;
    const icmsB = (B.icms / 100) * S.FATOR_ICMS[ano];
    const pisCofinsHoje = (B.preco - B.preco * (B.icms / 100)) * (S.PIS_COFINS_CREDITO / 100);
    const notaB = hibrido
      ? 'No Híbrido o fornecedor destaca CBS/IBS por fora e a Guimarães credita tudo.'
      : `Pelas regras de hoje, esta mesma nota daria também ${fmt.brl(pisCofinsHoje)} de crédito de PIS/COFINS (9,25%), que deixa de existir.`;
    $('sim-versus').innerHTML = cartao('A · regime regular', aAno, 'ICMS + CBS/IBS', diff > 0.005, 'Preço sem CBS/IBS; a CBS/IBS vem por fora e volta inteira como crédito.')
      + cartao(`B · ${hibrido ? 'Simples Híbrido' : 'Simples tradicional'}`, bAno, hibrido ? 'ICMS + CBS/IBS' : 'ICMS + DAS', diff < -0.005, notaB);

    const empate = hibrido
      ? aAno.custo / (1 - icmsB)
      : S.precoEquivalenteSimples({ precoRegular: A.preco, icmsRegular: A.icms, icmsSimples: B.icms, creditoDas: B.creditoDas, ano, aliquota: op.aliquota, tratamento });
    const texto = `Para empatar com A em ${ano}, B precisa cobrar no máximo <strong>${fmt.brl(empate)}</strong>${hibrido ? ' sem CBS/IBS' : ' no total da nota'} (${fmt.signedPct(empate / B.preco - 1)} frente à proposta de B).`;
    $('sim-headline').innerHTML = `<span>${Math.abs(diff) < 0.005 ? 'Empate' : diff > 0 ? 'A compra de A sai mais barata' : 'A compra de B sai mais barata'}</span><p>${Math.abs(diff) < 0.005 ? 'As duas propostas têm o mesmo custo líquido.' : `Diferença de <strong>${fmt.brl(Math.abs(diff))}</strong> por compra depois dos créditos.`} ${texto} Não compare pelo valor da nota: a nota de A inclui ${fmt.brl(aAno.iva)} de CBS/IBS que a Guimarães recupera.</p>`;
  }
  comparar();

  // ------------------------------------------------------------ impacto na carteira
  const series = [
    { key: 'sem', name: 'Sem ação', color: COR.simples },
    { key: 'com', name: 'Cenário escolhido', color: COR.credita }
  ];
  $('c-legend').innerHTML = series.map((s) => `<span style="--seg:${s.color}"><i></i>${s.name}</span>`).join('');

  function carteira() {
    const base = num('c-base');
    const migra = num('c-migra') / 100;
    const das = num('c-das');
    $('c-migra-out').textContent = fmt.pct(migra, 0);
    const sem = S.creditoAnual(base, 'simples', 0);
    const resto = S.creditoAnual(base * (1 - migra), 'simples', das);
    const itens = S.ANOS.map((a, i) => ({ label: String(a), short: String(a), sem: sem[i].perda, com: resto[i].perda }));
    bars($('c-chart'), $('c-axis'), itens, { series, format: (v) => fmt.mi(v) });
    const totalSem = itens.reduce((s, it) => s + it.sem, 0);
    const totalCom = itens.reduce((s, it) => s + it.com, 0);
    $('c-headline').innerHTML = `<span>2027 a 2033</span><p>Sem ação, a Guimarães deixa de tomar <strong>${fmt.mi(totalSem)}</strong> de crédito em sete anos (${fmt.brl(itens[0].sem)} em 2027 e ${fmt.brl(itens[6].sem)} em 2033). No cenário escolhido, a perda é de <strong>${fmt.mi(totalCom)}</strong>, ${totalSem > 0 ? `${fmt.pct(1 - totalCom / totalSem)} menor` : 'sem diferença'}.</p>`;
  }
  ['c-base', 'c-migra', 'c-das'].forEach((id) => $(id).addEventListener('input', carteira));
  carteira();
})();
