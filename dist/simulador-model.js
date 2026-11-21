(function (root) {
  'use strict';

  // Regras de cálculo dos simuladores de preço (clientes) e de compra (fornecedores).
  // Premissas do diagnóstico, seção 13 (p. 16–17) e seções 2, 5 e 10:
  //  - hoje o ICMS e o PIS/COFINS estão dentro do preço e o IPI vai por fora;
  //  - a partir de 2027 o PIS/COFINS sai, o IPI é zerado e a CBS/IBS entra por fora, sobre o valor sem ICMS;
  //  - de 2029 a 2032 o ICMS cai 10 pontos por ano (90%, 80%, 70%, 60%) e é extinto em 2033.
  const ANOS = Object.freeze([2027, 2028, 2029, 2030, 2031, 2032, 2033]);
  // CBS + IBS da regra geral, em %, iguais aos da calculadora da página inicial (p. 3 e 13).
  const ALIQUOTA_IVA = Object.freeze({ 2027: 11.3, 2028: 11.3, 2029: 13.07, 2030: 14.84, 2031: 16.61, 2032: 18.38, 2033: 29.0 });
  const FATOR_ICMS = Object.freeze({ 2027: 1, 2028: 1, 2029: 0.9, 2030: 0.8, 2031: 0.7, 2032: 0.6, 2033: 0 });
  const TRATAMENTO = Object.freeze({ geral: 1, reducao60: 0.4, zero: 0 });
  const PIS_COFINS_CREDITO = 9.25;

  // Produtos da seção 13, valores por unidade (tabela Atacarejo Externo SC 2026).
  const PRODUTOS = Object.freeze({
    desinfetante: Object.freeze({ nome: 'Desinfetante capim-limão 2L (cód. 1723)', preco: 5.5, ipi: 5, icms: 12, pisCofins: 8.14, frete: 0.55, comissao: 0.22, despesas: 0.55, cpv: 2.76, tratamento: 'geral' }),
    agua: Object.freeze({ nome: 'Água sanitária 2L (cód. 586)', preco: 4.79, ipi: 0, icms: 12, pisCofins: 8.14, frete: 0.48, comissao: 0.19, despesas: 0.48, cpv: 1.61, tratamento: 'geral' })
  });

  // O que cada perfil de cliente consegue creditar da nota da Guimarães.
  const PERFIS_CLIENTE = Object.freeze([
    { id: 'real', nome: 'Lucro Real', grupo: 'credita', hoje: { icms: true, pisCofins: true }, reforma: { icms: true, iva: true } },
    { id: 'presumido', nome: 'Lucro Presumido', grupo: 'credita', hoje: { icms: true, pisCofins: false }, reforma: { icms: true, iva: true } },
    { id: 'hibrido', nome: 'Simples Híbrido', grupo: 'credita', hoje: { icms: false, pisCofins: false }, reforma: { icms: false, iva: true } },
    { id: 'simples', nome: 'Simples tradicional e MEI', grupo: 'total', hoje: { icms: false, pisCofins: false }, reforma: { icms: false, iva: false } },
    { id: 'pf', nome: 'Pessoa física', grupo: 'total', hoje: { icms: false, pisCofins: false }, reforma: { icms: false, iva: false } }
  ]);

  const ESTRATEGIAS = Object.freeze([
    { id: 'margem', nome: 'A · Manter a margem', resumo: 'Mantém o valor líquido de tributos de hoje; a nota acompanha a mudança dos tributos.' },
    { id: 'total', nome: 'B · Manter o total da nota', resumo: 'O cliente paga o mesmo total de hoje; a diferença vira margem (ou perda).' },
    { id: 'neutro', nome: 'C · Custo igual para o Lucro Real', resumo: 'Preço em que o cliente do Lucro Real tem, depois dos créditos, o mesmo custo de hoje.' },
    { id: 'ajuste', nome: 'D · Ajuste livre', resumo: 'Parte da opção A e aplica a variação escolhida sobre o valor líquido.' }
  ]);

  const pct = (value) => value / 100;

  function aliquotaIVA(ano, tratamento = 'geral', aliquota) {
    const base = aliquota === undefined ? ALIQUOTA_IVA[ano] : aliquota;
    if (!(tratamento in TRATAMENTO)) throw new RangeError('Tratamento tributário inválido.');
    return base * TRATAMENTO[tratamento];
  }

  // Nota de hoje: preço sem IPI com ICMS e PIS/COFINS por dentro; IPI por fora.
  function notaHoje(produto) {
    const icms = produto.preco * pct(produto.icms);
    const pisCofins = produto.preco * pct(produto.pisCofins);
    const ipi = produto.preco * pct(produto.ipi);
    const liquido = produto.preco - icms - pisCofins;
    return { ano: 'hoje', preco: produto.preco, icms, pisCofins, ipi, iva: 0, aliquotaIva: 0, liquido, total: produto.preco + ipi };
  }

  // Nota de um ano da reforma a partir do valor líquido de tributos que a Guimarães quer receber.
  function notaReforma(liquido, ano, icmsNominal, aliquotaIva) {
    const icmsAliq = pct(icmsNominal) * FATOR_ICMS[ano];
    const preco = liquido / (1 - icmsAliq);
    const icms = preco - liquido;
    const iva = liquido * pct(aliquotaIva);
    return { ano, preco, icms, pisCofins: 0, ipi: 0, iva, aliquotaIva, liquido, total: preco + iva };
  }

  function liquidoParaTotal(total, ano, icmsNominal, aliquotaIva) {
    const icmsAliq = pct(icmsNominal) * FATOR_ICMS[ano];
    return total / (1 / (1 - icmsAliq) + pct(aliquotaIva));
  }

  // Custo efetivo do cliente: total da nota menos o que ele credita.
  function custoCliente(nota, perfil) {
    const regras = nota.ano === 'hoje' ? perfil.hoje : perfil.reforma;
    let credito = 0;
    if (regras.icms) credito += nota.icms;
    if (nota.ano === 'hoje' && regras.pisCofins) credito += (nota.preco - nota.icms) * pct(PIS_COFINS_CREDITO);
    if (nota.ano !== 'hoje' && regras.iva) credito += nota.iva;
    return { credito, custo: nota.total - credito };
  }

  function custos(produto) {
    return produto.frete + produto.comissao + produto.despesas + produto.cpv;
  }

  function simularPreco(produto, ano, estrategia, opcoes = {}) {
    if (!ANOS.includes(ano)) throw new RangeError('Ano fora da transição.');
    const aliquota = aliquotaIVA(ano, opcoes.tratamento || produto.tratamento || 'geral', opcoes.aliquota);
    const hoje = notaHoje(produto);
    let liquido;
    if (estrategia === 'margem') {
      liquido = hoje.liquido;
    } else if (estrategia === 'total') {
      liquido = liquidoParaTotal(hoje.total, ano, produto.icms, aliquota);
    } else if (estrategia === 'neutro') {
      // Para o Lucro Real, credita ICMS e CBS/IBS na reforma: o custo dele passa a ser o valor líquido.
      liquido = custoCliente(hoje, PERFIS_CLIENTE[0]).custo;
    } else if (estrategia === 'ajuste') {
      liquido = hoje.liquido * (1 + pct(opcoes.ajuste || 0));
    } else {
      throw new RangeError('Estratégia de preço inválida.');
    }
    const nota = notaReforma(liquido, ano, produto.icms, aliquota);
    const custoTotal = custos(produto);
    const margemHoje = hoje.liquido - custoTotal;
    const margem = nota.liquido - custoTotal;
    const clientes = PERFIS_CLIENTE.map((perfil) => {
      const antes = custoCliente(hoje, perfil).custo;
      const depois = custoCliente(nota, perfil).custo;
      return { id: perfil.id, nome: perfil.nome, grupo: perfil.grupo, hoje: antes, reforma: depois, variacao: depois / antes - 1 };
    });
    return {
      ano, estrategia, aliquota, hoje, nota, custos: custoTotal,
      margemHoje, margem, margemPctHoje: margemHoje / hoje.total, margemPct: margem / nota.total,
      variacaoMargem: margemHoje === 0 ? null : margem / margemHoje - 1,
      variacaoTotal: nota.total / hoje.total - 1,
      clientes
    };
  }

  // Carteira: média da variação de custo dos clientes e da margem, ponderada pela participação nas vendas.
  function simularCarteira(produto, ano, estrategia, mix, opcoes) {
    const resultado = simularPreco(produto, ano, estrategia, opcoes);
    const soma = Object.values(mix).reduce((a, b) => a + b, 0);
    if (soma <= 0) throw new RangeError('A participação nas vendas precisa somar mais que zero.');
    let variacao = 0;
    for (const cliente of resultado.clientes) variacao += (mix[cliente.id] || 0) / soma * cliente.variacao;
    return { ...resultado, variacaoCarteira: variacao };
  }

  // ------------------------------------------------------------- compras

  // Custo líquido de uma compra para a Guimarães (Lucro Real, não cumulativo), por R$ de preço.
  //  regular: preço com ICMS por dentro; CBS/IBS por fora a partir de 2027; credita tudo.
  //  simples: total da nota; credita o ICMS permitido e, na reforma, só a CBS/IBS paga no DAS.
  //  hibrido: Simples que recolhe CBS/IBS por fora; credita a CBS/IBS integral.
  function custoCompra({ tipo, preco, icms = 0, creditoDas = 0, ano, aliquota, tratamento = 'geral' }) {
    if (ano !== 'hoje' && !ANOS.includes(ano)) throw new RangeError('Ano fora da transição.');
    const fator = ano === 'hoje' ? 1 : FATOR_ICMS[ano];
    const icmsValor = preco * pct(icms) * fator;
    if (ano === 'hoje') {
      // Hoje toda compra para revenda/insumo dá 9,25% de PIS/COFINS, inclusive a do Simples.
      const pisCofins = (preco - icmsValor) * pct(PIS_COFINS_CREDITO);
      return { pago: preco, credito: icmsValor + pisCofins, custo: preco - icmsValor - pisCofins, iva: 0 };
    }
    const aliq = aliquotaIVA(ano, tratamento, aliquota);
    if (tipo === 'regular' || tipo === 'hibrido') {
      const iva = (preco - icmsValor) * pct(aliq);
      return { pago: preco + iva, credito: icmsValor + iva, custo: preco - icmsValor, iva };
    }
    if (tipo === 'simples') {
      const das = preco * pct(creditoDas);
      return { pago: preco, credito: icmsValor + das, custo: preco - icmsValor - das, iva: 0 };
    }
    throw new RangeError('Tipo de fornecedor inválido.');
  }

  // Preço máximo que o fornecedor do Simples pode cobrar para empatar com o do regime regular.
  function precoEquivalenteSimples({ precoRegular, icmsRegular, icmsSimples, creditoDas, ano, aliquota, tratamento }) {
    const alvo = custoCompra({ tipo: 'regular', preco: precoRegular, icms: icmsRegular, ano, aliquota, tratamento }).custo;
    const unitario = custoCompra({ tipo: 'simples', preco: 1, icms: icmsSimples, creditoDas, ano }).custo;
    return alvo / unitario;
  }

  // Crédito anual sobre uma base de compras, por ano da transição (só CBS/IBS).
  function creditoAnual(base, tipo, creditoDas = 0) {
    return ANOS.map((ano) => {
      const aliq = ALIQUOTA_IVA[ano];
      const credito = tipo === 'simples' ? base * pct(creditoDas) : base * pct(aliq);
      return { ano, aliquota: aliq, credito, perda: base * pct(aliq) - credito };
    });
  }

  const api = Object.freeze({
    ANOS, ALIQUOTA_IVA, FATOR_ICMS, TRATAMENTO, PIS_COFINS_CREDITO, PRODUTOS, PERFIS_CLIENTE, ESTRATEGIAS,
    aliquotaIVA, notaHoje, notaReforma, custoCliente, simularPreco, simularCarteira,
    custoCompra, precoEquivalenteSimples, creditoAnual
  });
  root.SimuladorGuimaraes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
