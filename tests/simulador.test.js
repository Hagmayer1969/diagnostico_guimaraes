const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../dist/simulador-model.js');

const cents = (value) => Math.round(value * 100) / 100;
// O PDF soma parcelas já arredondadas (ex.: 4,99 + 0,50 = 5,49); o simulador soma os valores exatos.
const perto = (value, esperado) => assert.ok(Math.abs(value - esperado) < 0.015, `${value} ≉ ${esperado}`);

test('opção A reproduz as notas da seção 13 (desinfetante e água sanitária)', () => {
  const d27 = S.simularPreco(S.PRODUTOS.desinfetante, 2027, 'margem');
  assert.equal(cents(d27.hoje.preco), 5.57);
  assert.equal(cents(d27.hoje.icms), 0.67);
  assert.equal(cents(d27.hoje.pisCofins), 0.52);
  assert.equal(cents(d27.hoje.total), 5.85);
  assert.equal(cents(d27.hoje.liquido), 4.39);
  assert.equal(cents(d27.nota.preco), 4.99);
  assert.equal(cents(d27.nota.iva), 0.5);
  perto(d27.nota.total, 5.49);
  assert.equal(cents(d27.margem), 0.31);

  const d33 = S.simularPreco(S.PRODUTOS.desinfetante, 2033, 'margem');
  assert.equal(cents(d33.nota.preco), 4.39);
  assert.equal(cents(d33.nota.iva), 1.27);
  perto(d33.nota.total, 5.67);

  assert.equal(cents(S.notaHoje(S.PRODUTOS.agua).total), 4.86);
  perto(S.simularPreco(S.PRODUTOS.agua, 2027, 'margem').nota.total, 4.78);
  perto(S.simularPreco(S.PRODUTOS.agua, 2033, 'margem').nota.total, 4.93);
  perto(S.simularPreco(S.PRODUTOS.agua, 2033, 'margem', { tratamento: 'reducao60' }).nota.total, 4.27);
});

// A p. 17 publica R$ 0,61 e R$ 1,14; pelo mesmo cálculo da opção A, a margem fica R$ 0,60 e R$ 1,13.
test('opção B mantém o total da nota e aproxima as margens da p. 17', () => {
  const d = S.simularPreco(S.PRODUTOS.desinfetante, 2027, 'total');
  assert.equal(cents(d.nota.total), cents(d.hoje.total));
  assert.ok(Math.abs(d.margem - 0.61) < 0.015);
  assert.ok(Math.abs(S.simularPreco(S.PRODUTOS.agua, 2027, 'total').margem - 1.14) < 0.015);
});

test('opção C deixa o custo do cliente do Lucro Real igual ao de hoje', () => {
  for (const ano of S.ANOS) {
    const r = S.simularPreco(S.PRODUTOS.desinfetante, ano, 'neutro');
    const real = r.clientes.find((c) => c.id === 'real');
    assert.ok(Math.abs(real.variacao) < 1e-9, `${ano}`);
  }
});

test('cliente que não credita sente o total da nota; quem credita, o valor líquido', () => {
  const r = S.simularPreco(S.PRODUTOS.desinfetante, 2027, 'margem');
  const simples = r.clientes.find((c) => c.id === 'simples');
  const real = r.clientes.find((c) => c.id === 'real');
  assert.equal(cents(simples.reforma), cents(r.nota.total));
  assert.equal(cents(real.reforma), cents(r.nota.liquido));
});

test('carteira pondera a variação de custo pela participação nas vendas', () => {
  const mix = { real: 81.8, simples: 18.2 };
  const r = S.simularCarteira(S.PRODUTOS.desinfetante, 2027, 'margem', mix);
  const esperado = 0.818 * r.clientes[0].variacao + 0.182 * r.clientes[3].variacao;
  assert.ok(Math.abs(r.variacaoCarteira - esperado) < 1e-12);
});

test('compras do Simples tradicional perdem o crédito: R$ 623.760 em 2027 e R$ 1,6 mi em 2033 (R$ 5,52 mi da seção 2)', () => {
  const linhas = S.creditoAnual(5520000, 'simples', 0);
  assert.equal(Math.round(linhas[0].perda), 623760);
  assert.equal(Math.round(linhas[6].perda), 1600800);
});

test('fornecedor regular: custo líquido é o preço sem ICMS; preço de empate do Simples é coerente', () => {
  const regular = S.custoCompra({ tipo: 'regular', preco: 100, icms: 12, ano: 2027 });
  assert.equal(cents(regular.custo), 88);
  assert.equal(cents(regular.pago), cents(100 + 88 * 0.113));
  const empate = S.precoEquivalenteSimples({ precoRegular: 100, icmsRegular: 12, icmsSimples: 0, creditoDas: 0, ano: 2027 });
  assert.equal(cents(empate), 88);
  const hoje = S.custoCompra({ tipo: 'simples', preco: 100, icms: 0, ano: 'hoje' });
  assert.equal(cents(hoje.custo), 90.75);
});
