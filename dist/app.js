const reportUrl = 'assets/Diagnostico_Guimaraes_v59_CORRIGIDO.pdf';

const views = {
  guimaraes: {
    name: 'Guimarães',
    values: [6.61060866, 6.47177188, 6.47177188, 6.07442761, 5.67708334, 5.27973907, 4.88239480, 2.49832917],
    changes: ['Base do período analisado', '−2,1% em relação a hoje', '−2,1% em relação a hoje', '−8,1% em relação a hoje', '−14,1% em relação a hoje', '−20,1% em relação a hoje', '−26,1% em relação a hoje', '−62,2% em relação a hoje'],
    descriptions: [
      'Base de 12 meses: ICMS apurado, PIS/COFINS e IPI. O PRODEC é tratado separadamente como saída de caixa.',
      'A CBS substitui PIS/COFINS, enquanto o ICMS permanece integral. A carga projetada fica próxima da atual.',
      'A CBS e o IBS seguem a primeira fase da transição; o ICMS continua integral.',
      'O ICMS cai para 90% e o IBS entra com 10% da alíquota plena estimada.',
      'O ICMS cai para 80% e o IBS passa a 20% da alíquota plena estimada.',
      'O ICMS cai para 70% e o IBS passa a 30% da alíquota plena estimada.',
      'O ICMS cai para 60% e o IBS passa a 40% da alíquota plena estimada.',
      'O ICMS é extinto na simulação; permanecem CBS e IBS, com crédito sobre uma base mais ampla de compras.'
    ],
    hero: ['R$ 6,61 mi', 'R$ 6,47 mi', 'R$ 2,50 mi'],
    insight: 'Na Guimarães, a queda projetada em 2033 é de 62,2% frente à base atual.',
    note: 'Projeção para a Guimarães: ICMS, PIS/COFINS e IPI hoje; ICMS, CBS e IBS nos anos seguintes.',
    page: 13
  },
  grupo: {
    name: 'Grupo consolidado',
    values: [7.64338413, 8.18923569, 8.18923569, 7.89502698, 7.60851109, 7.32199520, 7.03547930, 5.31638394],
    changes: ['Base do período analisado', '+7,1% em relação a hoje', '+7,1% em relação a hoje', '+3,3% em relação a hoje', '−0,5% em relação a hoje', '−4,2% em relação a hoje', '−8,0% em relação a hoje', '−30,4% em relação a hoje'],
    descriptions: [
      'Soma da carga sobre consumo da Guimarães e do DAS das outras quatro empresas no período analisado.',
      'As quatro empresas do Simples Híbrido projetam aumento de carga; o grupo, somado, fica acima da base atual.',
      'A carga consolidada permanece no patamar projetado para 2027.',
      'O início da redução do ICMS aproxima a carga do grupo do nível atual.',
      'A projeção consolidada passa ligeiramente abaixo da base atual.',
      'A substituição gradual do ICMS pelo IBS amplia a redução projetada para o grupo.',
      'O grupo continua a reduzir a carga projetada ao longo da transição.',
      'Com o IBS pleno estimado, a carga consolidada projetada fica 30,4% abaixo da base atual.'
    ],
    hero: ['R$ 7,64 mi', 'R$ 8,19 mi', 'R$ 5,32 mi'],
    insight: 'No grupo consolidado, a carga sobe 7,1% em 2027 e cai 30,4% até 2033.',
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
