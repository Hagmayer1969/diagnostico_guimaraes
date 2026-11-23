(function (root) {
  'use strict';

  // Perfil e consulta de CNPJs pela situação no Simples (clientes e fornecedores).
  const { esc, fmt, cnpjMask, plural, downloadCSV, stack, bars } = root.ConsultaUI;
  const COR = { credita: '#2f74c0', simples: '#b07a12', pf: '#a0479a', outro: '#bdb8ad' };
  const PAGE = 100;

  function iniciar(D, cfg) {
    const $ = (id) => document.getElementById(id);
    const ano = (data) => (data ? Number(data.slice(-4)) : null);
    const linhas = D.linhas.map(([cnpj, sit, opcao, exclusao, mei, opcaoMei, exclusaoMei]) => ({ cnpj, sit, opcao, exclusao, mei: mei === 1, opcaoMei, exclusaoMei }));
    const porCnpj = new Map(linhas.map((l) => [l.cnpj, l]));
    const conta = (fn) => linhas.filter(fn).length;
    const n = {
      O: conta((l) => l.sit === 'O'), mei: conta((l) => l.mei), X: conta((l) => l.sit === 'X'), N: conta((l) => l.sit === 'N'),
      raizes: new Set(linhas.map((l) => l.cnpj.slice(0, 8))).size
    };
    const referencia = D.meta.referencia;
    const anoRef = Number(referencia.slice(-4));

    // ------------------------------------------------ indicadores do topo
    const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    set('m-total', fmt.int(D.meta.consultados));
    set('m-optantes', fmt.int(n.O));
    set('m-optantes-pct', fmt.pct(n.O / D.meta.consultados));
    set('m-regular', fmt.int(n.X + n.N));
    set('m-cpf', fmt.int(D.meta.cpfs));
    set('m-ref', referencia);

    // ------------------------------------------------ composição
    stack($('stack-perfil'), $('legend-perfil'), [
      { id: 'credita', label: cfg.rotulos.credita, note: cfg.notas.credita, value: n.X + n.N, color: COR.credita },
      { id: 'simples', label: cfg.rotulos.simples, note: `${fmt.int(n.mei)} são MEI`, value: n.O, color: COR.simples },
      { id: 'pf', label: cfg.rotulos.pf, note: cfg.notas.pf, value: D.meta.cpfs, color: COR.pf },
      { id: 'outro', label: 'Cadastro inválido', note: 'Documento que não é CNPJ nem CPF válido', value: D.meta.invalidos, color: COR.outro }
    ]);

    const kpis = [
      ['O', fmt.int(n.O), `optantes do Simples, ${fmt.int(n.mei)} deles MEI`],
      ['X', fmt.int(n.X), 'já saíram do Simples e hoje estão no regime regular'],
      ['N', fmt.int(n.N), 'nunca optaram pelo Simples (Lucro Presumido ou Real)'],
      ['recentes', fmt.int(conta((l) => l.sit === 'X' && ano(l.exclusao) >= anoRef - 1)), `saíram do Simples em ${anoRef - 1} ou ${anoRef}`],
      ['novos', fmt.int(conta((l) => l.sit === 'O' && ano(l.opcao) >= anoRef - 1)), `entraram no Simples em ${anoRef - 1} ou ${anoRef}`],
      ['todos', fmt.int(n.raizes), `empresas diferentes (raiz do CNPJ) em ${fmt.int(linhas.length)} estabelecimentos`]
    ];
    $('kpis-perfil').innerHTML = kpis.map(([f, v, t]) => `<button type="button" class="kpi" data-filtro="${f}"><strong>${v}</strong><span>${esc(t)}</span></button>`).join('');
    $('kpis-perfil').addEventListener('click', (event) => {
      const b = event.target.closest('[data-filtro]');
      if (!b) return;
      filtro.value = b.dataset.filtro;
      q.value = '';
      limite = PAGE;
      render();
      $('consulta').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ------------------------------------------------ movimento por ano
    const inicio = anoRef - 10;
    const anos = [];
    for (let a = inicio; a <= anoRef; a++) anos.push(a);
    const mov = anos.map((a) => ({
      label: String(a), short: `'${String(a).slice(2)}`,
      saidas: conta((l) => l.sit === 'X' && ano(l.exclusao) === a),
      entradas: conta((l) => l.sit === 'O' && ano(l.opcao) === a)
    }));
    const series = [
      { key: 'saidas', name: 'Saíram do Simples (hoje no regime regular)', color: COR.credita },
      { key: 'entradas', name: 'Entraram no Simples (optantes hoje)', color: COR.simples }
    ];
    $('mov-legend').innerHTML = series.map((s) => `<span style="--seg:${s.color}"><i></i>${s.name}</span>`).join('');
    bars($('mov-chart'), $('mov-axis'), mov, { series });

    // ------------------------------------------------ consulta
    const q = $('cnpj-q');
    const filtro = $('cnpj-filtro');
    const tbody = $('cnpj-body');
    const more = $('cnpj-more');
    const count = $('cnpj-count');
    let limite = PAGE;
    let atual = [];

    function situacao(l) {
      // Optante com exclusão já registrada (31/12/2026 na base 10/2026): deixa de ser optante no dia seguinte.
      if (l.sit === 'O') return `Optante desde ${l.opcao}${l.mei ? ' · MEI' : ''}${l.exclusao ? ` · exclusão em ${l.exclusao}` : ''}`;
      if (l.sit === 'X') return `Não optante · saiu em ${l.exclusao}`;
      return 'Nunca optou pelo Simples';
    }
    const reforma = (l) => (l.sit === 'O' ? cfg.reforma.simples : cfg.reforma.credita);
    const tagClass = (l) => (l.sit === 'O' ? 'simples' : 'credita');

    function passa(l, f) {
      if (f === 'todos') return true;
      if (f === 'O' || f === 'X' || f === 'N') return l.sit === f;
      if (f === 'mei') return l.mei;
      if (f === 'recentes') return l.sit === 'X' && ano(l.exclusao) >= anoRef - 1;
      if (f === 'novos') return l.sit === 'O' && ano(l.opcao) >= anoRef - 1;
      return true;
    }

    function buscar() {
      const texto = q.value.trim();
      const f = filtro.value;
      if (!texto) return linhas.filter((l) => passa(l, f));
      const tokens = texto.split(/[\s,;]+/).map((t) => t.replace(/\D/g, '')).filter(Boolean);
      const completos = tokens.filter((t) => t.length === 14);
      if (completos.length > 1 || (completos.length === 1 && tokens.length === 1)) {
        // Lista colada: mantém a ordem e mostra o que não foi encontrado.
        return completos.map((c) => porCnpj.get(c) || { cnpj: c, faltando: true }).filter((l) => l.faltando || passa(l, f));
      }
      return linhas.filter((l) => passa(l, f) && tokens.every((t) => l.cnpj.includes(t)));
    }

    function render() {
      atual = buscar();
      const achados = atual.filter((l) => !l.faltando).length;
      const faltando = atual.length - achados;
      count.textContent = `${plural(achados, 'CNPJ', 'CNPJs')}${faltando ? ` · ${plural(faltando, 'não consta', 'não constam')} na planilha` : ''}`;
      if (!atual.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty">Nenhum CNPJ encontrado. Digite parte do número, a raiz (8 dígitos) ou cole uma lista de CNPJs.</td></tr>`;
        more.hidden = true;
        return;
      }
      tbody.innerHTML = atual.slice(0, limite).map((l) => l.faltando
        ? `<tr class="miss"><td class="cnpj">${cnpjMask(l.cnpj)}</td><td colspan="4">Não está na planilha de ${cfg.nome}</td></tr>`
        : `<tr><td class="cnpj">${cnpjMask(l.cnpj)}</td><td>${esc(situacao(l))}</td><td>${l.mei ? `Sim, desde ${esc(l.opcaoMei)}${l.exclusaoMei ? ` · desenquadramento em ${esc(l.exclusaoMei)}` : ''}` : l.exclusaoMei ? `Saiu em ${esc(l.exclusaoMei)}` : 'Não'}</td><td>${l.cnpj.slice(8, 12) === '0001' ? 'Matriz' : 'Filial'}</td><td><span class="tag ${tagClass(l)}">${esc(reforma(l))}</span></td></tr>`).join('');
      more.hidden = atual.length <= limite;
      more.textContent = `Mostrar mais ${Math.min(PAGE, atual.length - limite)} de ${fmt.int(atual.length - limite)}`;
    }

    let timer;
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { limite = PAGE; render(); }, 120); });
    filtro.addEventListener('change', () => { limite = PAGE; render(); });
    more.addEventListener('click', () => { limite += PAGE; render(); });
    $('cnpj-export').addEventListener('click', () => {
      downloadCSV(`guimaraes-${cfg.nome}-simples-${filtro.value}.csv`,
        ['CNPJ', 'Situação no Simples', 'Data opção', 'Data exclusão', 'MEI', 'Estabelecimento', 'Na Reforma'],
        atual.map((l) => (l.faltando ? [cnpjMask(l.cnpj), 'Não está na planilha', '', '', '', '', ''] : [cnpjMask(l.cnpj), situacao(l), l.opcao, l.exclusao, l.mei ? 'Sim' : 'Não', l.cnpj.slice(8, 12) === '0001' ? 'Matriz' : 'Filial', reforma(l)])));
    });
    render();

    return { n, linhas };
  }

  root.SimplesUI = Object.freeze({ iniciar, COR });
})(window);
