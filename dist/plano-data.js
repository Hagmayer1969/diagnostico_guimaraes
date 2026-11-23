(function (root) {
  'use strict';

  // Conteúdo transcrito do relatório (seção 15, p. 19, e as seções citadas em cada passo).
  // Nenhum valor, prazo ou regra foi acrescentado além do que está no PDF.
  const PDF = 'assets/Diagnostico_Guimaraes_v59_CORRIGIDO.pdf';
  const pdf = (page, label) => ({ label, href: `${PDF}#page=${page}`, page, external: true });

  const AREAS = Object.freeze([
    { id: 'diretoria', nome: 'Diretoria' },
    { id: 'fiscal', nome: 'Contabilidade e Fiscal' },
    { id: 'comercial', nome: 'Comercial e Compras' }
  ]);

  const MENSAGEM = [
    'Assunto: Reforma Tributária — regime a partir de 2027',
    '',
    'Olá, [nome], tudo bem?',
    '',
    'Estamos nos preparando para a Reforma Tributária (IBS e CBS) e queremos confirmar com nossos principais parceiros: a partir de janeiro/2027, sua empresa pretende continuar no Simples Nacional tradicional ou optar pelo Simples Híbrido?',
    '',
    'A informação não muda nossa relação comercial. Serve para os dois lados saberem com antecedência como ficará o crédito de IBS e CBS nas notas entre nós.',
    '',
    'Pode responder com uma das opções:',
    '( ) Vamos optar pelo Simples Híbrido',
    '( ) Vamos permanecer no Simples tradicional',
    '( ) Ainda não decidimos — previsão: ____',
    '',
    'Obrigado e estamos à disposição.'
  ].join('\n');

  const STEPS = Object.freeze([
    {
      id: 'fispq',
      area: 'fiscal',
      titulo: 'Enviar a FISPQ da água sanitária',
      resumo: 'Definir o NCM antes de ajustar o enquadramento e a tributação no cadastro.',
      prazo: '2026-11-30',
      pronto: 'NCM definido',
      porque: 'O Anexo VIII dá redução de 60% à água sanitária classificada no NCM 3808.94.19. A água sanitária vendida está cadastrada no 2828.90.19 e sai sem a redução. Com a FISPQ, o NCM correto é definido e o cadastro é ajustado antes de jan/2027.',
      numeros: [
        { valor: '4,52%', rotulo: 'CBS + IBS em 2027 se a redução se aplicar (regra geral: 11,3%)' },
        { valor: 'R$ 4,27', rotulo: 'total da nota em 2033 com a redução (R$ 4,93 sem ela)' }
      ],
      passos: [
        { t: 'Reúna a FISPQ ou o laudo da água sanitária', d: 'O documento é fornecido pela Guimarães.' },
        { t: 'Envie o documento à contabilidade até 30/11/2026' },
        { t: 'Aguarde a definição do NCM', d: 'Com o NCM definido, o cadastro pode ser corrigido no próximo passo do plano.' }
      ],
      links: [pdf(7, 'Produtos e classificação fiscal (seção 4)'), pdf(19, 'Plano de ação (seção 15)')]
    },
    {
      id: 'sankhya-ncm',
      area: 'fiscal',
      titulo: 'Corrigir NCM e cClassTrib no Sankhya',
      resumo: 'Revisar água sanitária, desinfetantes e os 14 itens com cadastro incompleto ou incorreto.',
      prazo: '2026-12-15',
      pronto: 'Cadastro atualizado',
      porque: 'Hoje a água sanitária vendida sai sem a redução a que pode ter direito, e os desinfetantes saem com uma redução que a lei não dá (cClassTrib 200035). A emissão com cClassTrib errado gera cobrança da diferença com multa.',
      numeros: [
        { valor: '14', rotulo: 'itens com NCM ausente ou incorreto' }
      ],
      depende: ['fispq'],
      passos: [
        { t: 'Ajuste a água sanitária conforme o NCM definido', d: 'Produtos vendidos: códigos 585, 586, 587 e 611, hoje no NCM 2828.90.19.' },
        { t: 'Corrija os desinfetantes, limpadores e multiuso', d: 'Hoje estão no 3808.94.19 e o sistema sugere redução de 60% (cClassTrib 200035). O Anexo VIII nomeia só a água sanitária: eles ficam sem a redução.' },
        { t: 'Corrija os 14 itens com NCM ausente ou incorreto', d: '2 com NCM "00000000" (Embalagem Azul Bebê 2L e Embalagem Azul 2L) · 10 sem NCM (ribbons, reagentes de laboratório, chapas de papelão, filme stretch) · 2 com NCM provavelmente errado (um amaciante e um produto automotivo no NCM de desinfetantes).' },
        { t: 'Aproveite para classificar aromatizadores e itens monofásicos na tabela de cClassTrib', d: 'Aromatizadores e itens de perfumaria (hoje monofásicos) seguem a regra geral: 11,3% em 2027 e 29,0% em 2033. Achado de prioridade baixa (seção 14).' },
        { t: 'Confirme o resultado: cadastro atualizado' }
      ],
      links: [pdf(7, 'Produtos e classificação fiscal (seção 4)'), pdf(18, 'Riscos e oportunidades (seção 14)')]
    },
    {
      id: 'hibrido-decisao',
      area: 'diretoria',
      titulo: 'Revisar a opção pelo Simples Híbrido',
      resumo: 'Confirmar ou cancelar a escolha das quatro empresas após a definição da alíquota da CBS.',
      prazo: '2026-12-20',
      pronto: 'Opção confirmada no Portal do Simples',
      porque: 'As quatro empresas (L Química, Laguna, CBL e LM Embalagens) passam a pagar CBS e IBS sobre todo o faturamento e, como o custo delas é quase só folha, não têm crédito para abater: a carga delas sobe R$ 684.688,34 em 2027. A Guimarães ganha R$ 151.220,22 de crédito, e o efeito líquido no grupo é de −R$ 533.468,12 em 2027.',
      numeros: [
        { valor: '+R$ 684.688,34', rotulo: 'carga das quatro empresas em 2027' },
        { valor: '−R$ 533.468,12', rotulo: 'efeito líquido da estrutura no grupo em 2027' }
      ],
      externo: 'Depende da alíquota definitiva da CBS: o Senado tem até 15/12/2026 para fixar o valor. Os números do diagnóstico usam 11,3% (referência do TCU).',
      passos: [
        { t: 'Aguarde a alíquota definitiva da CBS', d: 'Resolução do Senado, até 15/12/2026. Se o valor mudar, o Núcleo Reforma refaz as projeções.' },
        { t: 'Compare as duas opções com a alíquota definitiva', d: 'No Simples tradicional, a Guimarães só creditaria a CBS/IBS embutida no DAS. A comparação será refeita com a alíquota definitiva.' },
        { t: 'Decida, empresa por empresa, entre manter ou cancelar o Híbrido', d: 'L Química, Laguna, CBL e LM Embalagens.' },
        { t: 'Confirme a opção no Portal do Simples' }
      ],
      links: [pdf(14, 'Empresas do grupo e Simples Híbrido (seção 11)'), pdf(21, 'Pendências (seção 17)')]
    },
    {
      id: 'caixa-prodec',
      area: 'diretoria',
      titulo: 'Incluir as parcelas do PRODEC no caixa',
      resumo: 'Lançar as parcelas de 2027 a 2030 no planejamento e confirmar se há correção ou juros.',
      prazo: '2026-12-31',
      pronto: 'Fluxo de caixa com as parcelas lançadas',
      porque: 'O ICMS postergado volta a ser pago entre jul/2027 e abr/2030: R$ 5,45 mi, com pico de R$ 2,12 mi em 2029. Somado aos tributos, o desembolso anual chega a R$ 8.430.761,91 em 2029, contra R$ 5.490.962,49 pagos nos últimos 12 meses.',
      numeros: [
        { valor: 'R$ 5,45 mi', rotulo: 'parcelas nominais, jul/2027 a abr/2030' },
        { valor: 'R$ 8.430.761,91', rotulo: 'maior desembolso anual projetado, em 2029' }
      ],
      passos: [
        { t: 'Lance no fluxo de caixa as parcelas de cada mês de 2027 a 2030', d: 'Totais por ano: 2027 R$ 979.176,55 · 2028 R$ 1.663.654,14 · 2029 R$ 2.119.936,88 · 2030 R$ 684.196,64. O valor de cada mês está na tabela da seção 8.' },
        { t: 'Some as parcelas aos tributos sobre consumo projetados de cada ano', d: 'É o desembolso total: o PRODEC fica fora da carga tributária, mas sai do caixa.' },
        { t: 'Confirme no termo do benefício se as parcelas têm correção ou juros', d: 'Os valores do diagnóstico são nominais. O termo do benefício é fornecido pela Guimarães.' },
        { t: 'Confira o resultado: fluxo de caixa com as parcelas lançadas' }
      ],
      links: [{ label: 'Entender a conta do PRODEC', href: 'prodec.html' }, pdf(11, 'PRODEC (seção 8)'), pdf(19, 'Plano de ação (seção 15)')]
    },
    {
      id: 'ipi-saldo',
      area: 'fiscal',
      titulo: 'Usar o saldo credor de IPI',
      resumo: 'Aproveitar o saldo antes de o IPI ser zerado em 2027.',
      prazo: '2026-12-31',
      pronto: 'Saldo zerado',
      porque: 'Em 30/09/2026 a Guimarães tem R$ 38.976,27 de IPI credor. O IPI é zerado em 2027, e o saldo precisa ser usado ou ressarcido antes disso.',
      numeros: [
        { valor: 'R$ 38.976,27', rotulo: 'IPI credor em 30/09/2026' }
      ],
      passos: [
        { t: 'Confirme o saldo credor de IPI', d: 'R$ 38.976,27 em 30/09/2026. PIS, COFINS e ICMS corrente não têm saldo parado.' },
        { t: 'Escolha entre usar o saldo ou pedir ressarcimento', d: 'Os dois caminhos valem; o que importa é fazer antes de o IPI ser zerado em 2027.' },
        { t: 'Conclua até 31/12/2026: saldo zerado' }
      ],
      links: [pdf(8, 'De onde vem o crédito (seção 5)'), pdf(19, 'Plano de ação (seção 15)')]
    },
    {
      id: 'consulta-clientes',
      area: 'comercial',
      titulo: 'Consultar os maiores clientes do Simples',
      resumo: 'Perguntar se vão continuar no Simples tradicional ou optar pelo Híbrido.',
      prazo: '2026-12-31',
      pronto: 'Respostas registradas',
      porque: 'A resposta de cada cliente muda a forma como ele compara preço. Os clientes do Simples somam 18,2% das vendas e sentem o preço total da nota.',
      numeros: [
        { valor: '2.107', rotulo: 'CNPJs optantes do Simples na base de clientes' }
      ],
      passos: [
        { t: 'Escolha para quem enviar primeiro', d: 'Os clientes optantes do Simples com maior faturamento (2.107 CNPJs optantes na base).' },
        { t: 'Envie a mensagem pronta', mensagem: true },
        { t: 'Registre cada resposta em uma planilha', d: 'Nome, CNPJ, papel (cliente ou fornecedor), regime hoje, resposta e data.' },
        { t: 'Revise a planilha a cada 30 dias', d: 'As respostas atualizam as seções 2, 3 e 13 do diagnóstico.' }
      ],
      relacionados: ['consulta-fornecedores'],
      links: [pdf(20, 'Comunicação sobre o Simples Híbrido (seção 16)'), pdf(18, 'Riscos e oportunidades (seção 14)')]
    },
    {
      id: 'precos',
      area: 'diretoria',
      titulo: 'Aprovar a política de preços de 2027',
      resumo: 'Decidir por canal entre manter a margem ou manter o total da nota, já com CBS por fora e IPI zerado.',
      prazo: '2027-01-31',
      pronto: 'Tabela de 2027 aprovada',
      porque: 'Em 2027 o PIS/COFINS sai, o IPI é zerado e a CBS e o IBS entram por fora, sobre o valor sem ICMS. A nota passa a ter uma linha a mais, e a tabela de preços de 2027 ainda está sem a CBS por fora e sem a extinção do IPI.',
      numeros: [
        { valor: 'R$ 2.951.381,05', rotulo: 'IPI destacado nas vendas em 12 meses (espaço de preço)' }
      ],
      depende: ['consulta-clientes'],
      relacionados: ['mapear-canal'],
      passos: [
        { t: 'Entenda o que muda na nota', d: 'Hoje o ICMS (12%) e o PIS/COFINS (9,25%) estão dentro do preço e o IPI vai por fora. Em 2027, a CBS e o IBS (11,3%) entram por fora e o IPI é zerado.' },
        { t: 'Escolha, para cada canal, a opção A ou a B', d: 'A · Manter a margem: a nota fica um pouco mais barata (desinfetante −6,2%; água sanitária −1,7%). B · Manter o total da nota: a diferença do IPI vira margem (no desinfetante, de R$ 0,31 para R$ 0,61 por unidade).' },
        { t: 'Considere como cada canal compara o preço', d: 'Cliente fora do Simples compara pelo valor sem CBS/IBS: A ou B têm o mesmo efeito para ele, e quem decide é a margem da Guimarães. Cliente do Simples compara pelo total da nota: a consulta da seção 16 ajuda a decidir. Pessoa física compara pelo total da nota: política de preço própria.' },
        { t: 'Aprove a tabela de 2027' }
      ],
      links: [pdf(16, 'Formação de preço (seção 13)'), pdf(17, 'Formação de preço — continuação')]
    },
    {
      id: 'xml-teste',
      area: 'fiscal',
      titulo: 'Emitir notas de teste com CBS/IBS',
      resumo: 'Enviar o XML para validação antes de as notas de 2027 começarem.',
      prazo: '2027-01-31',
      pronto: 'XML validado',
      porque: 'A emissão de nota com CBS/IBS no Sankhya ainda não foi testada na Guimarães. O teste mostra se as notas de 2027 saem corretas, e o Núcleo Reforma valida o NCM da água sanitária e o cadastro de produtos junto com o XML de teste.',
      depende: ['sankhya-ncm'],
      passos: [
        { t: 'Emita notas de teste com CBS/IBS no Sankhya', d: 'Com o NCM e o cClassTrib já corrigidos no cadastro. Responsáveis: TI da Guimarães e contabilidade.' },
        { t: 'Envie o XML para validação' },
        { t: 'Registre o resultado: XML validado' }
      ],
      links: [pdf(19, 'Plano de ação (seção 15)'), pdf(21, 'Pendências (seção 17)')]
    },
    {
      id: 'consulta-fornecedores',
      area: 'comercial',
      titulo: 'Consultar os maiores fornecedores do Simples',
      resumo: 'Enviar a mesma consulta aos fornecedores do Simples tradicional.',
      prazo: '2027-01-31',
      pronto: 'Respostas registradas',
      porque: 'A resposta do fornecedor muda o crédito da Guimarães. Hoje as compras do Simples tradicional fora do grupo dão crédito integral de PIS/COFINS; com a Reforma, só dá crédito o CBS/IBS pago no DAS.',
      numeros: [
        { valor: '538', rotulo: 'fornecedores do Simples tradicional' },
        { valor: 'R$ 5,52 mi', rotulo: 'compras por ano desses fornecedores' }
      ],
      passos: [
        { t: 'Escolha para quem enviar primeiro', d: 'Os 538 fornecedores do Simples tradicional, começando pelos de maior valor (R$ 5,52 mi por ano no total).' },
        { t: 'Envie a mesma mensagem pronta da consulta aos clientes', mensagem: true },
        { t: 'Registre cada resposta na mesma planilha', d: 'Nome, CNPJ, papel (cliente ou fornecedor), regime hoje, resposta e data.' },
        { t: 'Revise a planilha a cada 30 dias', d: 'As respostas atualizam as seções 2, 3 e 13 do diagnóstico.' }
      ],
      relacionados: ['consulta-clientes'],
      links: [pdf(20, 'Comunicação sobre o Simples Híbrido (seção 16)'), pdf(8, 'De onde vem o crédito (seção 5)')]
    },
    {
      id: 'mapear-canal',
      area: 'comercial',
      titulo: 'Mapear as vendas por canal',
      resumo: 'Separar vendas fora do Simples, para o Simples e para pessoa física.',
      prazo: '2027-01-31',
      pronto: 'Relatório entregue',
      porque: 'O canal define como o cliente compara o preço: quem está fora do Simples compara o valor sem CBS/IBS; o cliente do Simples e a pessoa física comparam o total da nota. Os clientes do Simples somam 18,2% das vendas.',
      numeros: [
        { valor: '18,2%', rotulo: 'das vendas são para clientes do Simples' }
      ],
      relacionados: ['precos'],
      passos: [
        { t: 'Separe as vendas em três canais', d: 'Fora do Simples, Simples e pessoa física.' },
        { t: 'Entregue o relatório', d: 'O passo termina quando o relatório é entregue.' },
        { t: 'Leve o relatório para a decisão de preços de 2027', d: 'A política de preço é decidida por canal.' }
      ],
      links: [pdf(17, 'Formação de preço — continuação'), pdf(19, 'Plano de ação (seção 15)')]
    },
    {
      id: 'despesas-nota',
      area: 'fiscal',
      titulo: 'Garantir nota fiscal nas despesas com crédito',
      resumo: 'Comissões, merchandising, feiras e sistemas passam a dar crédito, mas só com nota.',
      prazo: null,
      prazoTexto: 'Contínuo',
      pronto: 'Despesas sem nota zeradas',
      porque: 'Com a CBS e o IBS, despesas com nota que hoje não dão crédito passam a dar: R$ 10.978.975,90 de base por ano. A maior é a comissão de representantes (R$ 3.198.262,76), paga a pessoas jurídicas com NFS-e.',
      numeros: [
        { valor: 'R$ 10.978.975,90', rotulo: 'base anual de despesas que passam a dar crédito' },
        { valor: 'R$ 1.229.645,30', rotulo: 'crédito em 2027 (R$ 3.172.924,04 em 2033)' }
      ],
      passos: [
        { t: 'Liste as despesas que passam a dar crédito', d: 'Comissões, merchandising, feiras, sistemas, manutenção de veículos e outras.' },
        { t: 'Garanta a nota fiscal em cada pagamento' },
        { t: 'Acompanhe até zerar as despesas sem nota', d: 'Este passo não tem data final: é um controle contínuo.' }
      ],
      links: [pdf(8, 'De onde vem o crédito (seção 5)'), pdf(9, 'PIS e COFINS hoje e a CBS em 2027 (seção 6)')]
    }
  ]);

  const api = Object.freeze({ PDF, AREAS, STEPS, MENSAGEM });
  root.PlanoGuimaraes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
