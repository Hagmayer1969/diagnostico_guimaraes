#!/usr/bin/env python3
"""Gera os arquivos de dados do site a partir das planilhas em fontes/.

  fontes/produtos-consulta-lote.xlsx               -> dist/produtos-data.js
  fontes/produtos-revisao-reducoes-11-2026.xlsx    -> dist/produtos-data.js (revisão item a item)
  fontes/clientes-simples-11-2026.xlsx             -> dist/clientes-data.js
  fontes/fornecedores-simples-11-2026.xlsx         -> dist/fornecedores-data.js

Uso: python3 scripts/gerar-dados.py

Os valores são transcritos das planilhas sem recalcular alíquotas. CPFs (pessoas físicas,
tipo "PF" na planilha) não são publicados: entram só na contagem.
"""
import json
import re
import shutil
from collections import OrderedDict
from datetime import datetime
from pathlib import Path

import openpyxl
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
FONTES = ROOT / 'fontes'
DIST = ROOT / 'dist'

# Apontamentos do diagnóstico (seção 4, p. 7 do PDF).
AGUA_SANITARIA_VENDIDA = {'585', '586', '587', '611'}
AGUA_SANITARIA_GRANEL = '513'
NCM_PROVAVELMENTE_ERRADO = {'607', '580'}  # amaciante e lava-auto no NCM de desinfetantes
NCM_DESINFETANTES = '38089419'

# Revisão das reduções de IBS e CBS (nov/2026), aba "Por produto".
REVISAO = 'produtos-revisao-reducoes-11-2026.xlsx'
# Itens da tabela "Água sanitária: onde está a redução" (aba Resumo da revisão).
REVISAO_AGUA_SANITARIA = {'513', '585', '586', '587', '611', '537', '593', '591', '609', '610', '612'}
# Observações em que a revisão manda corrigir ou conferir a NCM no cadastro.
REVISAO_NCM = re.compile(r'NCM errada|[Rr]evisar (a )?NCM|conferir a classificação|[Cc]onferir também a NCM|NCM .* inadequada')

CLIENTES = 'clientes-simples-11-2026.xlsx'
FORNECEDORES = 'fornecedores-simples-11-2026.xlsx'


def clean(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    if isinstance(value, datetime):
        return value.strftime('%d/%m/%Y')
    return re.sub(r'\s+', ' ', str(value)).strip()


def number(value):
    text = clean(value)
    if not text:
        return None
    n = float(text)
    return int(n) if n.is_integer() else n


class Strings:
    """Tabela de textos: cada texto longo é publicado uma vez e referenciado por índice."""

    def __init__(self):
        self.items = []
        self.index = {}

    def __call__(self, text):
        text = clean(text)
        if not text:
            return None
        if text not in self.index:
            self.index[text] = len(self.items)
            self.items.append(text)
        return self.index[text]


def write_module(path, global_name, payload, comment):
    body = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    path.write_text(
        '(function (root) {\n'
        "  'use strict';\n\n"
        f'  // {comment}\n'
        '  // Arquivo gerado por scripts/gerar-dados.py — não editar à mão.\n'
        f'  const api = Object.freeze({body});\n'
        f'  root.{global_name} = api;\n'
        "  if (typeof module !== 'undefined' && module.exports) module.exports = api;\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n",
        encoding='utf-8',
    )
    print(f'{path.relative_to(ROOT)}: {path.stat().st_size / 1024:.0f} KB')


# ---------------------------------------------------------------- produtos

def build_produtos():
    sheets = pd.read_excel(FONTES / 'produtos-consulta-lote.xlsx', sheet_name=None, dtype=str)
    entradas = sheets['ENTRADAS']
    resultado = sheets['RESULTADO'].fillna('')
    imunidade = sheets['IMUNIDADE'].fillna('')
    revisao = pd.read_excel(FONTES / REVISAO, sheet_name='Por produto', dtype=str).fillna('')

    anos = sorted(resultado['ANO TRANSICAO'].unique())
    texts = Strings()

    # Alerta geral de cada ano (o mesmo para todos os itens na regra geral).
    geral = resultado[resultado['CST IBS CBS'] == '000']
    alerta_ano = [texts(geral[geral['ANO TRANSICAO'] == ano]['ALERTA'].iloc[0]) for ano in anos]
    alertas_gerais = {texts.items[i] for i in alerta_ano}

    option_key = ['NCM LEGAL', 'ITEM DA REFORMA', 'CST IBS CBS', 'CCLASSTRIB', 'REDUCAO IBS/CBS']
    resultado = resultado.drop_duplicates(['CODIGO DO PRODUTO', 'ANO TRANSICAO'] + option_key)

    perfis, perfil_index = [], {}
    opcoes, opcao_index = [], {}
    produtos_opcoes = OrderedDict()

    for (codigo, *_), grupo in resultado.groupby(['CODIGO DO PRODUTO'] + option_key, sort=False):
        grupo = grupo.set_index('ANO TRANSICAO')
        taxas = tuple((number(grupo.loc[ano, 'ALIQUOTA IBS']), number(grupo.loc[ano, 'ALIQUOTA CBS'])) for ano in anos)
        if taxas not in perfil_index:
            perfil_index[taxas] = len(perfis)
            perfis.append([list(t) for t in taxas])
        first = grupo.iloc[0]
        alertas = [clean(a) for a in grupo['ALERTA'].unique()]
        especificos = [a for a in alertas if a and a not in alertas_gerais]
        opcao = {
            'cst': clean(first['CST IBS CBS']),
            'cstDesc': texts(first['DESCRICAO CST IBS CBS']),
            'cct': clean(first['CCLASSTRIB']),
            'cctDesc': texts(first['DESCRICAO CCLASSTRIB']),
            'red': number(first['REDUCAO IBS/CBS']),
            'item': clean(first['ITEM DA REFORMA']) or None,
            'ncmLegal': clean(first['NCM LEGAL']) or None,
            'descLei': texts(first['DESCRICAO DA REFORMA']),
            'fund': texts(first['FUNDAMENTO DA REFORMA']),
            'lc': texts(first['LC REDACAO']),
            'lcArt': clean(first['LC 2142025']) or None,
            'alertaCst': texts(first['ALERTA CST IBS CBS']),
            'alertas': [texts(a) for a in especificos],
            'perfil': perfil_index[taxas],
        }
        opcao = {k: v for k, v in opcao.items() if v not in (None, [])}
        key = json.dumps(opcao, sort_keys=True)
        if key not in opcao_index:
            opcao_index[key] = len(opcoes)
            opcoes.append(opcao)
        produtos_opcoes.setdefault(codigo, []).append(opcao_index[key])

    imun = {}
    for _, row in imunidade.iterrows():
        item = [clean(row['UF DESTINO']), texts(row['SEGMENTO']), texts(row['FUNDAMENTO DA REFORMA'])]
        lista = imun.setdefault(clean(row['CODIGO DO PRODUTO']), [])
        if item not in lista:
            lista.append(item)

    # Revisão item a item: [tratamento, CST, cClassTrib, observação] (textos por índice).
    revisados = {}
    for _, row in revisao.iterrows():
        codigo = clean(row['Código'])
        revisados[codigo] = [texts(row['Tratamento']), clean(row['CST']), clean(row['cClassTrib']), texts(row['Observação'])]

    produtos = []
    for _, row in entradas.iterrows():
        codigo = clean(row['CODIGO PRODUTO'])
        ncm = clean(row['NCM'])
        ids = produtos_opcoes[codigo]
        # Regra geral primeiro; depois os enquadramentos alternativos.
        ids.sort(key=lambda i: (opcoes[i]['cst'] != '000', i))
        flags = []
        if codigo in AGUA_SANITARIA_VENDIDA:
            flags.append('diag-agua')
        elif codigo in NCM_PROVAVELMENTE_ERRADO:
            flags.append('diag-ncm')
        elif ncm == NCM_DESINFETANTES and codigo != AGUA_SANITARIA_GRANEL:
            flags.append('diag-desinf')
        if codigo == AGUA_SANITARIA_GRANEL:
            flags.append('diag-granel')
        if any(opcoes[i]['cst'] != '000' for i in ids):
            flags.append('alternativa')
        textos_alerta = ' '.join(texts.items[a] for i in ids for a in opcoes[i].get('alertas', []) + [opcoes[i].get('alertaCst')] if a is not None)
        if 'GTIN' in textos_alerta:
            flags.append('gtin')
        if re.search(r'reclassificad|adquirid[oa]s? por', textos_alerta):
            flags.append('destinacao')
        if codigo in imun:
            flags.append('imunidade')
        if codigo in revisados:
            flags.append('revisado')
            if REVISAO_NCM.search(texts.items[revisados[codigo][3]] if revisados[codigo][3] is not None else ''):
                flags.append('rev-ncm')
            if codigo in REVISAO_AGUA_SANITARIA:
                flags.append('rev-agua')
        produto = [codigo, clean(row['DESCRICAO']), ncm, ids, flags]
        if codigo in imun:
            produto.append(imun[codigo])
        produtos.append(produto)

    faltando = set(revisados) - {p[0] for p in produtos}
    if faltando:
        raise ValueError(f'Produtos da revisão fora da consulta em lote: {sorted(faltando)}')

    payload = {
        'meta': {
            'fonte': 'Consulta em lote da Reforma Tributária (planilha 2986787847)',
            'revisao': 'Revisão das reduções de IBS e CBS (novembro de 2026)',
            'anos': [int(a) for a in anos],
            'ufOrigem': clean(entradas['UFS ORIGEM'].iloc[0]),
            'ufDestino': clean(entradas['UFS DESTINO'].iloc[0]).split(','),
        },
        'alertaAno': alerta_ano,
        'perfis': perfis,
        'opcoes': opcoes,
        'produtos': produtos,
        'revisao': revisados,
        'textos': texts.items,
    }
    write_module(DIST / 'produtos-data.js', 'ProdutosGuimaraes', payload,
                 'Classificação de IBS/CBS por produto, transcrita da consulta em lote (abas ENTRADAS, RESULTADO e IMUNIDADE) e da revisão das reduções (aba Por produto).')
    return payload


# ---------------------------------------------------------------- Simples

def cpf_valido(digitos):
    if len(digitos) != 11 or digitos == digitos[0] * 11:
        return False
    for n in (9, 10):
        soma = sum(int(digitos[i]) * (n + 1 - i) for i in range(n))
        if (soma * 10) % 11 % 10 != int(digitos[n]):
            return False
    return True


def cpf_aparente(digitos):
    """CPF completado com zeros que, por coincidência, passa no dígito do CNPJ.

    A "filial" (ex.: 4069) não existe e a raiz 000… pode cruzar com uma empresa real do Simples.
    """
    return len(digitos) == 14 and digitos.startswith('000') and cpf_valido(digitos[3:]) and int(digitos[8:12]) > 20


def resumo_simples(arquivo):
    """Lê a aba Resumo: pares Item/Valor de "Sobre a consulta" e os avisos de "Atenção"."""
    ws = openpyxl.load_workbook(FONTES / arquivo, read_only=True)['Resumo']
    info, atencao, bloco = {}, [], None
    for a, b, *_ in ws.iter_rows(values_only=True):
        a, b = clean(a), clean(b)
        if a in ('Sobre a consulta', 'Atenção', 'Quantidades'):
            bloco = a
        elif bloco == 'Sobre a consulta' and a and b:
            info[a] = b
        elif bloco == 'Atenção' and a.startswith('•'):
            atencao.append(a.lstrip('• ').strip())
    return info, atencao


def build_simples(arquivo, destino, global_name, comment):
    df = pd.read_excel(FONTES / arquivo, sheet_name='Situação', dtype=object)
    info, atencao = resumo_simples(arquivo)

    linhas, cpfs, cpfs_aparentes, invalidos = [], 0, 0, 0
    for _, row in df.iterrows():
        digitos = re.sub(r'\D', '', clean(row['CNPJ / CPF']))
        situacao = clean(row['Situação no Simples'])
        if clean(row['Tipo']) == 'PF':
            # CPF gravado no campo de CNPJ: não publicamos o número.
            cpfs += 1
            continue
        if situacao == 'Documento inválido':
            invalidos += 1
            continue
        if cpf_aparente(digitos):
            cpfs_aparentes += 1
            continue
        if clean(row['Optante']) == 'Sim':
            codigo = 'O'
        elif situacao.startswith('Não optante'):
            codigo = 'X'
        elif situacao.startswith('Não consta'):
            codigo = 'N'
        else:
            raise ValueError(f'Situação desconhecida: {situacao!r}')
        linhas.append([digitos, codigo, clean(row['Data opção Simples']), clean(row['Data exclusão Simples']),
                       1 if clean(row['MEI']) == 'Sim' else 0, clean(row['Data opção MEI']), clean(row['Data exclusão MEI'])])

    payload = {
        'meta': {
            'fonte': info.get('Fonte', ''),
            'referencia': info.get('Mês de referência da base', ''),
            'consulta': info.get('Consulta feita em', ''),
            'consultados': len(df),
            'cpfs': cpfs + cpfs_aparentes,
            'cpfsAparentes': cpfs_aparentes,
            'invalidos': invalidos,
            'atencao': atencao,
        },
        'campos': ['cnpj', 'situacao', 'opcao', 'exclusao', 'mei', 'opcaoMei', 'exclusaoMei'],
        'linhas': linhas,
    }
    write_module(DIST / destino, global_name, payload, comment)
    return payload


# ---------------------------------------------------------------- planilhas para download

PLANILHAS = DIST / 'assets' / 'planilhas'


def exportar_planilhas():
    """Copia as planilhas para o site. Nas de clientes e fornecedores, os CPFs são omitidos."""
    PLANILHAS.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(FONTES / REVISAO, PLANILHAS / 'guimaraes-produtos-revisao-reducoes.xlsx')
    for origem, destino in ((CLIENTES, 'guimaraes-clientes-situacao-simples.xlsx'),
                            (FORNECEDORES, 'guimaraes-fornecedores-situacao-simples.xlsx')):
        wb = openpyxl.load_workbook(FONTES / origem)
        ws = wb['Situação']
        header = [c.value for c in ws[1]]
        col_doc, col_tipo, col_obs = (header.index(h) + 1 for h in ('CNPJ / CPF', 'Tipo', 'Observação'))
        omitidos = 0
        for row in range(2, ws.max_row + 1):
            digitos = re.sub(r'\D', '', str(ws.cell(row, col_doc).value or ''))
            if ws.cell(row, col_tipo).value == 'PF':
                ws.cell(row, col_doc).value = 'CPF omitido'
                omitidos += 1
            elif cpf_aparente(digitos):
                ws.cell(row, col_doc).value = 'CPF omitido'
                ws.cell(row, col_obs).value = ('Pessoa física (CPF) completado com zeros: número omitido. A situação no Simples '
                                               'desta linha veio de uma empresa com a mesma raiz e não se aplica.')
                omitidos += 1
        wb.save(PLANILHAS / destino)
        print(f'{(PLANILHAS / destino).relative_to(ROOT)}: {omitidos} CPFs omitidos')


if __name__ == '__main__':
    build_produtos()
    build_simples(CLIENTES, 'clientes-data.js', 'ClientesGuimaraes',
                  'Situação no Simples Nacional dos clientes da Guimarães (Receita Federal, dados abertos do CNPJ).')
    build_simples(FORNECEDORES, 'fornecedores-data.js', 'FornecedoresGuimaraes',
                  'Situação no Simples Nacional dos fornecedores da Guimarães (Receita Federal, dados abertos do CNPJ).')
    exportar_planilhas()
