(function (root) {
  'use strict';

  // All monetary values are integer centavos transcribed from the supplied PDF.
  const BASE = Object.freeze({
    receitaGuimaraes: 11721736926,
    receitaGrupo: 12491018603,
    vendasCBSIBS: 9889177061,
    // Vendas menos a base de CBS/IBS da p. 12 (margem anual R$ 21.482.973,83 − crédito novo R$ 10.978.975,90).
    comprasCBSIBS: 8838777268,
    guimaraes: Object.freeze([667473277, 667473277, 631082503, 594691730, 558300956, 521910182, 303565540]),
    grupo: Object.freeze([839219658, 839219658, 813142440, 787834505, 762526569, 737218632, 585371017]),
    // CBS + IBS in basis points, following pages 12 and 13 of the report: CBS 11,2% every year,
    // IBS treated as 0 in 2027–2028, then 10% to 40% of the 17,7% full rate and 17,7% in 2033.
    aliquotasIVA: Object.freeze([1120, 1120, 1297, 1474, 1651, 1828, 2890])
  });

  const YEARS = Object.freeze([2027, 2028, 2029, 2030, 2031, 2032, 2033]);

  function validateCents(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} deve ser um valor monetário não negativo.`);
  }

  function roundRatio(numerator, denominator) {
    const signed = BigInt(numerator);
    const divisor = BigInt(denominator);
    const absolute = signed < 0n ? -signed : signed;
    const rounded = (absolute + divisor / 2n) / divisor;
    return Number(signed < 0n ? -rounded : rounded);
  }

  function calculate(mode, input) {
    let published;
    let scenario;
    let premise;

    if (mode === 'receita-guimaraes') {
      validateCents(input.receita, 'Receita');
      published = BASE.guimaraes;
      scenario = published.map((value) => roundRatio(BigInt(value) * BigInt(input.receita), BASE.receitaGuimaraes));
      premise = 'A carga publicada da Guimarães varia na mesma proporção que a receita bruta. Perfil de vendas, custos, créditos e alíquotas permanecem como no relatório.';
    } else if (mode === 'receita-grupo') {
      validateCents(input.receita, 'Receita');
      published = BASE.grupo;
      scenario = published.map((value) => roundRatio(BigInt(value) * BigInt(input.receita), BASE.receitaGrupo));
      premise = 'A carga consolidada publicada varia na mesma proporção que a receita total. A participação das cinco empresas e as operações entre elas permanecem constantes.';
    } else if (mode === 'bases') {
      validateCents(input.vendas, 'Base de vendas');
      validateCents(input.compras, 'Base de compras');
      published = BASE.guimaraes;
      const originalNet = BASE.vendasCBSIBS - BASE.comprasCBSIBS;
      const newNet = input.vendas - input.compras;
      const deltaNet = newNet - originalNet;
      scenario = published.map((value, index) => value + roundRatio(BigInt(deltaNet) * BigInt(BASE.aliquotasIVA[index]), 10000));
      premise = 'Apenas a variação da base líquida de CBS/IBS altera os totais publicados. ICMS e demais parcelas ficam fixos; as alíquotas seguem o diagnóstico.';
    } else {
      throw new RangeError('Tipo de cenário inválido.');
    }

    if (scenario.some((value) => !Number.isSafeInteger(value))) throw new RangeError('Valor fora do intervalo suportado.');

    return {
      mode,
      years: YEARS.map((year, index) => ({
        year,
        published: published[index],
        scenario: scenario[index],
        difference: scenario[index] - published[index]
      })),
      premise,
      requiresFiscalReview: scenario.some((value) => value < 0) || (mode === 'bases' && input.vendas < input.compras)
    };
  }

  const api = Object.freeze({ BASE, YEARS, calculate });
  root.GuimaraesCalculator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
