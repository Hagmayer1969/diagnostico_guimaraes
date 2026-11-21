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
  assert.equal(scenarios[0].years[0].scenario, 647177188);
  assert.equal(scenarios[0].years[6].scenario, 249832917);
  assert.equal(scenarios[2].years[0].scenario, 818923569);
  assert.equal(scenarios[2].years[6].scenario, 531638394);
});

test('cenário de receita aplica a proporção sem alterar o ponto de partida', () => {
  const result = calculate('receita-guimaraes', { receita: BASE.receitaGuimaraes * 2 });
  assert.equal(result.years[0].scenario, BASE.guimaraes[0] * 2);
  assert.equal(result.years[6].scenario, BASE.guimaraes[6] * 2);
  assert.equal(BASE.guimaraes[0], 647177188);
});

test('alteração de bases afeta apenas o IVA pelas alíquotas anuais do relatório', () => {
  const plusOneHundredThousand = calculate('bases', {
    vendas: BASE.vendasCBSIBS + 10000000,
    compras: BASE.comprasCBSIBS
  });
  assert.equal(plusOneHundredThousand.years[0].difference, 1130000);
  assert.equal(plusOneHundredThousand.years[2].difference, 1307000);
  assert.equal(plusOneHundredThousand.years[6].difference, 2900000);

  const extraPurchases = calculate('bases', {
    vendas: BASE.vendasCBSIBS,
    compras: BASE.comprasCBSIBS + 10000000
  });
  assert.equal(extraPurchases.years[0].difference, -1130000);
});

test('a base líquida publicada reproduz o IVA de 2027', () => {
  const net = BASE.vendasCBSIBS - BASE.comprasCBSIBS;
  assert.equal(net, 861492818);
  assert.equal(Math.round(net * 1130 / 10000), 97348688);
});

test('rejeita valores inválidos', () => {
  assert.throws(() => calculate('receita-grupo', { receita: -1 }), RangeError);
  assert.throws(() => calculate('bases', { vendas: Number.NaN, compras: 1 }), RangeError);
});
