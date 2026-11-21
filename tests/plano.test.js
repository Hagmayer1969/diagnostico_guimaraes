const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AREAS, STEPS } = require('../dist/plano-data.js');

const dist = path.join(__dirname, '..', 'dist');
const ids = new Set(STEPS.map((step) => step.id));

test('o plano tem os 11 passos da seção 15, em 3 áreas', () => {
  assert.equal(STEPS.length, 11);
  assert.equal(ids.size, STEPS.length);
  assert.deepEqual(AREAS.map((area) => STEPS.filter((step) => step.area === area.id).length), [3, 5, 3]);
});

test('todo passo tem prazo, critério de conclusão e passo a passo', () => {
  for (const step of STEPS) {
    assert.ok(step.prazo ? /^\d{4}-\d{2}-\d{2}$/.test(step.prazo) : step.prazoTexto, `${step.id}: prazo`);
    assert.ok(step.pronto && step.porque && step.resumo, `${step.id}: textos`);
    assert.ok(step.passos.length >= 3, `${step.id}: passos`);
    assert.ok(AREAS.some((area) => area.id === step.area), `${step.id}: área`);
  }
});

test('dependências e passos relacionados apontam para passos existentes e respeitam a ordem dos prazos', () => {
  for (const step of STEPS) {
    for (const other of [...(step.depende || []), ...(step.relacionados || [])]) {
      assert.ok(ids.has(other), `${step.id} -> ${other}`);
    }
    for (const dep of step.depende || []) {
      const before = STEPS.find((candidate) => candidate.id === dep);
      assert.ok(before.prazo && before.prazo <= step.prazo, `${step.id} vence antes de ${dep}`);
    }
  }
});

test('links para o PDF apontam para páginas que existem (o relatório tem 23)', () => {
  for (const step of STEPS) {
    assert.ok(step.links.length > 0, `${step.id}: sem fonte`);
    for (const link of step.links.filter((item) => item.external)) {
      assert.ok(link.page >= 1 && link.page <= 23, `${step.id}: página ${link.page}`);
      assert.ok(link.href.endsWith(`#page=${link.page}`));
    }
    for (const link of step.links.filter((item) => !item.external)) {
      assert.ok(fs.existsSync(path.join(dist, link.href)), `${step.id}: ${link.href}`);
    }
  }
});

test('os links "Ver detalhe" da página inicial abrem passos que existem no plano', () => {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const anchors = [...html.matchAll(/href="plano\.html#([a-z-]+)"/g)].map((match) => match[1]);
  assert.equal(anchors.length, 4);
  for (const anchor of anchors) assert.ok(ids.has(anchor), anchor);
  assert.ok(html.includes('href="plano.html">Ver plano completo'));
});
