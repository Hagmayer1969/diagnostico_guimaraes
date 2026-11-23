const reportUrl = 'assets/Diagnostico_Guimaraes_v59_CORRIGIDO.pdf';

const views = {
  guimaraes: {
    name: 'Guimarães',
    values: [6.61060866, 6.67473277, 6.67473277, 6.31082503, 5.94691730, 5.58300956, 5.21910182, 3.03565540],
    changes: ['Base do período analisado', '+1,0% em relação a hoje', '+1,0% em relação a hoje', '−4,5% em relação a hoje', '−10,0% em relação a hoje', '−15,5% em relação a hoje', '−21,0% em relação a hoje', '−54,1% em relação a hoje'],
    descriptions: [
      'Base de 12 meses: ICMS apurado, PIS/COFINS e IPI. O PRODEC é tratado separadamente como saída de caixa.',
      'A CBS substitui PIS/COFINS, enquanto o ICMS permanece integral. A carga projetada fica um pouco acima da atual.',
      'Igual a 2027: a CBS segue no lugar de PIS/COFINS, o IBS ainda é tratado como 0 e o ICMS continua integral.',
      'O ICMS cai para 90% e o IBS entra com 10% da alíquota plena estimada.',
      'O ICMS cai para 80% e o IBS passa a 20% da alíquota plena estimada.',
      'O ICMS cai para 70% e o IBS passa a 30% da alíquota plena estimada.',
      'O ICMS cai para 60% e o IBS passa a 40% da alíquota plena estimada.',
      'O ICMS é extinto na simulação; permanecem CBS e IBS. O IBS pleno é mais baixo que o ICMS que ele substitui.'
    ],
    hero: ['R$ 6,61 mi', 'R$ 6,67 mi', 'R$ 3,04 mi'],
    insight: 'Na Guimarães, a queda projetada em 2033 é de 54,1% frente à base atual.',
    note: 'Projeção para a Guimarães: ICMS, PIS/COFINS e IPI hoje; ICMS, CBS e IBS nos anos seguintes.',
    page: 13
  },
  grupo: {
    name: 'Grupo consolidado',
    values: [7.64338413, 8.39219658, 8.39219658, 8.13142440, 7.87834505, 7.62526569, 7.37218632, 5.85371017],
    changes: ['Base do período analisado', '+9,8% em relação a hoje', '+9,8% em relação a hoje', '+6,4% em relação a hoje', '+3,1% em relação a hoje', '−0,2% em relação a hoje', '−3,5% em relação a hoje', '−23,4% em relação a hoje'],
    descriptions: [
      'Soma da carga sobre consumo da Guimarães e do DAS das outras quatro empresas no período analisado.',
      'As quatro empresas do Simples Híbrido projetam aumento de carga; o grupo, somado, fica acima da base atual.',
      'A carga consolidada permanece no patamar projetado para 2027.',
      'O início da redução do ICMS aproxima a carga do grupo do nível atual.',
      'A substituição gradual do ICMS pelo IBS continua aproximando a carga do grupo do nível atual.',
      'A projeção consolidada passa ligeiramente abaixo da base atual.',
      'O grupo continua a reduzir a carga projetada ao longo da transição.',
      'Com o IBS pleno estimado, a carga consolidada projetada fica 23,4% abaixo da base atual.'
    ],
    hero: ['R$ 7,64 mi', 'R$ 8,39 mi', 'R$ 5,85 mi'],
    insight: 'No grupo consolidado, a carga sobe 9,8% em 2027 e cai 23,4% até 2033.',
    note: 'Grupo consolidado: Guimarães e as outras quatro empresas. O efeito do Simples Híbrido muda a leitura de 2027.',
    page: 14
  }
};

const years = ['Hoje', '2027', '2028', '2029', '2030', '2031', '2032', '2033'];
let activeView = 'guimaraes';
let activeIndex = 1;

const formatMillions = (value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;

function renderView() {
  const data = views[activeView];
  document.querySelectorAll('[data-view]').forEach((button) => {
    const selected = button.dataset.view === activeView;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  document.getElementById('hero-current').textContent = data.hero[0];
  document.getElementById('hero-2027').textContent = data.hero[1];
  document.getElementById('hero-2033').textContent = data.hero[2];
  document.getElementById('hero-insight').textContent = data.insight;
  document.getElementById('chart-note').textContent = data.note;

  const max = Math.max(...data.values);
  const chart = document.getElementById('bar-chart');
  chart.replaceChildren();
  data.values.forEach((value, index) => {
    const column = document.createElement('div');
    column.className = 'bar-column';
    const label = document.createElement('span');
    label.className = 'bar-value';
    label.textContent = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bar-button${index === activeIndex ? ' active' : ''}${index === 0 ? ' today' : ''}`;
    button.style.setProperty('--h', `${Math.round((value / max) * 78)}%`);
    button.setAttribute('aria-label', `${data.name}, ${years[index]}: ${formatMillions(value)}. ${data.changes[index]}.`);
    button.setAttribute('aria-pressed', String(index === activeIndex));
    button.addEventListener('click', () => {
      activeIndex = index;
      renderView();
    });
    const year = document.createElement('span');
    year.className = 'bar-year';
    year.textContent = years[index];
    column.append(label, button, year);
    chart.append(column);
  });

  document.getElementById('selected-year').textContent = years[activeIndex];
  document.getElementById('selected-value').textContent = formatMillions(data.values[activeIndex]);
  document.getElementById('selected-change').textContent = data.changes[activeIndex];
  document.getElementById('selected-description').textContent = data.descriptions[activeIndex];
  document.getElementById('selected-source').href = `${reportUrl}#page=${activeIndex === 0 ? 3 : data.page}`;
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    activeView = button.dataset.view;
    renderView();
  });
});

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.getElementById('primary-nav');
menuToggle.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
});
navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Abrir menu');
}));

document.querySelectorAll('.topic').forEach((topic) => {
  topic.addEventListener('toggle', () => {
    if (topic.open) document.querySelectorAll('.topic').forEach((other) => { if (other !== topic) other.open = false; });
  });
});

renderView();

const calculator = window.GuimaraesCalculator;
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const calculatorInputs = {
  'receita-guimaraes': [document.getElementById('calc-receita-guimaraes')],
  bases: [document.getElementById('calc-vendas'), document.getElementById('calc-compras')],
  'receita-grupo': [document.getElementById('calc-receita-grupo')]
};
const initialValues = {
  'calc-receita-guimaraes': '117.217.369,26',
  'calc-vendas': '98.891.770,61',
  'calc-compras': '88.387.772,68',
  'calc-receita-grupo': '124.910.186,03'
};
let calculatorMode = 'receita-guimaraes';

function parseCents(text) {
  const value = text.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ''] = value.replaceAll('.', '').split(',');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

function formatCents(cents) {
  return currencyFormatter.format(cents / 100);
}

function renderCalculator() {
  const activeInputs = calculatorInputs[calculatorMode];
  const values = activeInputs.map((input) => parseCents(input.value));
  activeInputs.forEach((input, index) => input.setAttribute('aria-invalid', String(values[index] === null)));

  const error = document.getElementById('calculator-error');
  const comparison = document.getElementById('calculator-comparison');
  const rows = document.getElementById('calculator-rows');
  if (values.includes(null)) {
    error.textContent = 'Informe um valor válido em reais, com até duas casas decimais. Exemplo: 120.000.000,00';
    error.hidden = false;
    document.getElementById('calc-result-2027').textContent = '—';
    document.getElementById('calc-result-2033').textContent = '—';
    comparison.textContent = 'Aguardando valores válidos para calcular o cenário.';
    comparison.classList.remove('warning');
    rows.replaceChildren();
    return;
  }

  error.hidden = true;
  let result;
  try {
    result = calculator.calculate(calculatorMode, calculatorMode === 'bases'
      ? { vendas: values[0], compras: values[1] }
      : { receita: values[0] });
  } catch (cause) {
    error.textContent = cause.message;
    error.hidden = false;
    return;
  }

  document.getElementById('calculator-premise').textContent = result.premise;
  document.getElementById('calculator-scope').textContent = calculatorMode === 'receita-grupo' ? 'Grupo consolidado' : 'Guimarães';
  document.getElementById('calc-result-2027').textContent = formatCents(result.years[0].scenario);
  document.getElementById('calc-result-2033').textContent = formatCents(result.years[6].scenario);

  const difference2027 = result.years[0].difference;
  comparison.classList.toggle('warning', result.requiresFiscalReview);
  if (result.requiresFiscalReview) {
    comparison.textContent = 'Este cenário pode gerar saldo credor ou total negativo. O diagnóstico não modela sua compensação; é necessária revisão fiscal.';
  } else if (result.years.every((year) => year.difference === 0)) {
    comparison.textContent = 'Com os valores originais, o cenário reproduz os totais publicados no relatório.';
  } else {
    const change = difference2027 === 0 ? 'sem diferença' : `${difference2027 > 0 ? 'acima' : 'abaixo'} do relatório em ${formatCents(Math.abs(difference2027))}`;
    comparison.textContent = `Em 2027, o cenário fica ${change}. Confira as premissas antes de usar o resultado para decidir.`;
  }

  rows.replaceChildren();
  result.years.forEach((year) => {
    const row = document.createElement('tr');
    const columns = [String(year.year), formatCents(year.published), formatCents(year.scenario), year.difference === 0 ? '—' : `${year.difference > 0 ? '+' : '−'} ${formatCents(Math.abs(year.difference))}`];
    columns.forEach((content, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = content;
      if (index === 2) cell.className = 'scenario-value';
      if (index === 3 && year.difference !== 0) cell.className = year.difference > 0 ? 'positive' : 'negative';
      row.append(cell);
    });
    rows.append(row);
  });
}

document.querySelectorAll('[data-calc-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    calculatorMode = button.dataset.calcMode;
    document.querySelectorAll('[data-calc-mode]').forEach((modeButton) => {
      const active = modeButton.dataset.calcMode === calculatorMode;
      modeButton.classList.toggle('active', active);
      modeButton.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-calc-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.calcPanel !== calculatorMode;
    });
    Object.values(calculatorInputs).flat().forEach((input) => input.removeAttribute('aria-invalid'));
    renderCalculator();
  });
});

Object.values(calculatorInputs).flat().forEach((input) => {
  input.addEventListener('input', renderCalculator);
  input.addEventListener('blur', () => {
    const cents = parseCents(input.value);
    if (cents !== null) input.value = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    renderCalculator();
  });
});

document.getElementById('calculator-reset').addEventListener('click', () => {
  for (const [id, value] of Object.entries(initialValues)) document.getElementById(id).value = value;
  renderCalculator();
});

renderCalculator();

const videoDialog = document.getElementById('video-dialog');
const presentationVideo = document.getElementById('presentation-video');
document.querySelector('[data-open-video]').addEventListener('click', () => {
  videoDialog.showModal();
  presentationVideo.play().catch(() => {});
});
document.querySelector('[data-close-video]').addEventListener('click', () => videoDialog.close());
videoDialog.addEventListener('click', (event) => {
  if (event.target === videoDialog) videoDialog.close();
});
videoDialog.addEventListener('close', () => presentationVideo.pause());
