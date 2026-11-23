const test = require('node:test');
const assert = require('node:assert/strict');
const { BASE, calculate } = require('../dist/calculator-model.js');

test('os valores originais reproduzem os totais anuais publicados', () => {
  const scenarios = [
    calculate('receita-guimaraes', { receita: BASE.receitaGuimaraes }),
    calculate('bases', { vendas: BASE.vendasCBSIBS, compras: BASE.comprasCBSIBS }),
    calculate('receita-grupo', { receita: BASE.receitaGrupo })
  ];
  for (const result of scenarios) {
    assert.deepEqual(result.years.map((year) => year.difference), Array(7).fill(0));
  }
  assert.equal(scenarios[0].years[0].scenario, 667473277);
  assert.equal(scenarios[0].years[6].scenario, 303565540);
  assert.equal(scenarios[2].years[0].scenario, 839219658);
  assert.equal(scenarios[2].years[6].scenario, 585371017);
});

test('cenário de receita aplica a proporção sem alterar o ponto de partida', () => {
  const result = calculate('receita-guimaraes', { receita: BASE.receitaGuimaraes * 2 });
  assert.equal(result.years[0].scenario, BASE.guimaraes[0] * 2);
  assert.equal(result.years[6].scenario, BASE.guimaraes[6] * 2);
  assert.equal(BASE.guimaraes[0], 667473277);
});

test('alteração de bases afeta apenas o IVA pelas alíquotas anuais do relatório', () => {
  const plusOneHundredThousand = calculate('bases', {
    vendas: BASE.vendasCBSIBS + 10000000,
    compras: BASE.comprasCBSIBS
  });
  assert.equal(plusOneHundredThousand.years[0].difference, 1120000);
  assert.equal(plusOneHundredThousand.years[2].difference, 1297000);
  assert.equal(plusOneHundredThousand.years[6].difference, 2890000);

  const extraPurchases = calculate('bases', {
    vendas: BASE.vendasCBSIBS,
    compras: BASE.comprasCBSIBS + 10000000
  });
  assert.equal(extraPurchases.years[0].difference, -1120000);
});

test('a base líquida publicada reproduz o IVA de 2027 e 2033 (p. 12)', () => {
  const net = BASE.vendasCBSIBS - BASE.comprasCBSIBS;
  assert.equal(net, 1050399793);
  assert.equal(Math.round(net * 1120 / 10000), 117644777);
  assert.equal(Math.round(net * 1770 / 10000), 185920763);
});

test('rejeita valores inválidos', () => {
  assert.throws(() => calculate('receita-grupo', { receita: -1 }), RangeError);
  assert.throws(() => calculate('bases', { vendas: Number.NaN, compras: 1 }), RangeError);
});
