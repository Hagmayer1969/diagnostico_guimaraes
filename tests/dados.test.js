const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../dist/produtos-data.js');
const C = require('../dist/clientes-data.js');
const F = require('../dist/fornecedores-data.js');

function cpfValido(d) {
  if (/^(\d)\1+$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    if ((soma * 10) % 11 % 10 !== Number(d[n])) return false;
  }
  return true;
}

test('produtos: 2.829 itens, todos com regra geral e opções/perfis válidos', () => {
  assert.equal(P.produtos.length, 2829);
  assert.equal(new Set(P.produtos.map((p) => p[0])).size, 2829);
  for (const [codigo, , ncm, opcoes] of P.produtos) {
    assert.match(ncm, /^\d{8}$/, codigo);
    assert.ok(opcoes.length >= 1 && opcoes.every((i) => P.opcoes[i]), codigo);
    assert.equal(P.opcoes[opcoes[0]].cst, '000', `${codigo}: regra geral primeiro`);
  }
  for (const o of P.opcoes) {
    assert.equal(P.perfis[o.perfil].length, P.meta.anos.length);
    for (const k of ['cstDesc', 'cctDesc', 'fund', 'descLei', 'lc', 'alertaCst']) if (o[k] !== undefined) assert.ok(P.textos[o[k]]);
  }
});

test('produtos: apontamentos do diagnóstico (seção 4) estão marcados', () => {
  const flags = (codigo) => P.produtos.find((p) => p[0] === codigo)[4];
  for (const c of ['585', '586', '587', '611']) assert.ok(flags(c).includes('diag-agua'), c);
  for (const c of ['607', '580']) assert.ok(flags(c).includes('diag-ncm'), c);
  assert.ok(flags('1723').includes('diag-desinf'));
  assert.ok(!flags('513').includes('diag-desinf'));
  assert.ok(flags('513').includes('diag-granel'));
});

test('Simples: contagens batem com a aba "Sobre a base" e nenhum CPF é publicado', () => {
  for (const [D, total, optantes, nao] of [[C, 6003, 2105, 3011], [F, 3273, 1226, 2020]]) {
    assert.equal(D.meta.consultados, total);
    assert.equal(D.linhas.length + D.meta.cpfs + D.meta.invalidos, total);
    assert.equal(D.linhas.filter((l) => l[1] === 'O').length, optantes);
    assert.equal(D.linhas.filter((l) => l[1] !== 'O').length, nao);
    assert.ok(D.linhas.every((l) => /^\d{14}$/.test(l[0])));
    assert.ok(!D.linhas.some((l) => l[0].startsWith('000') && cpfValido(l[0].slice(3)) && Number(l[0].slice(8, 12)) > 20), 'CPF publicado');
  }
  assert.equal(C.meta.cpfs, 885);
  assert.equal(C.meta.cpfsAparentes, 54);
});

test('produtos: revisão das reduções (nov/2026) cobre os 327 itens e marca as NCMs a corrigir', () => {
  const codigos = new Set(P.produtos.map((p) => p[0]));
  const revisados = Object.keys(P.revisao);
  assert.equal(revisados.length, 327);
  assert.ok(revisados.every((c) => codigos.has(c)));
  const flags = (codigo) => P.produtos.find((p) => p[0] === codigo)[4];
  assert.equal(P.textos[P.revisao['513'][0]], 'Redução de 60%');
  assert.deepEqual(P.revisao['513'].slice(1, 3), ['200', '200035']);
  for (const c of ['551', '1686', '3204', '591', '578']) assert.ok(flags(c).includes('rev-ncm'), c);
  assert.ok(!flags('596').includes('rev-ncm'));
});
