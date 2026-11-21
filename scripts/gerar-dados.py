#!/usr/bin/env python3
"""Gera os arquivos de dados do site a partir das planilhas em fontes/.

  fontes/produtos-consulta-lote.xlsx   -> dist/produtos-data.js
  fontes/clientes-simples.xlsx         -> dist/clientes-data.js
  fontes/fornecedores-simples.xlsx     -> dist/fornecedores-data.js

Uso: python3 scripts/gerar-dados.py

Os valores são transcritos das planilhas sem recalcular alíquotas. CPFs (pessoas físicas
que aparecem como "CNPJ inválido") não são publicados: entram só na contagem.
"""
import json
import re
import shutil
from collections import OrderedDict
from pathlib import Path

import openpyxl
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
FONTES = ROOT / 'fontes'
DIST = ROOT / 'dist'

# Apontamentos do diagnóstico (seção 4, p. 7 do PDF).
AGUA_SANITARIA_VENDIDA = {'585', '586', '587', '611'}
AGUA_SANITARIA_INTERNA = '513'
NCM_PROVAVELMENTE_ERRADO = {'607', '580'}  # amaciante e lava-auto no NCM de desinfetantes
NCM_DESINFETANTES = '38089419'


def clean(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
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
        elif ncm == NCM_DESINFETANTES and codigo != AGUA_SANITARIA_INTERNA:
            flags.append('diag-desinf')
        if codigo == AGUA_SANITARIA_INTERNA:
            flags.append('diag-interna')
        if any(opcoes[i]['cst'] != '000' for i in ids):
            flags.append('alternativa')
        textos_alerta = ' '.join(texts.items[a] for i in ids for a in opcoes[i].get('alertas', []) + [opcoes[i].get('alertaCst')] if a is not None)
        if 'GTIN' in textos_alerta:
            flags.append('gtin')
        if re.search(r'reclassificad|adquirid[oa]s? por', textos_alerta):
            flags.append('destinacao')
        if codigo in imun:
            flags.append('imunidade')
        produto = [codigo, clean(row['DESCRICAO']), ncm, ids, flags]
        if codigo in imun:
            produto.append(imun[codigo])
        produtos.append(produto)

    payload = {
        'meta': {
            'fonte': 'Consulta em lote da Reforma Tributária (planilha 2986787847)',
            'anos': [int(a) for a in anos],
            'ufOrigem': clean(entradas['UFS ORIGEM'].iloc[0]),
            'ufDestino': clean(entradas['UFS DESTINO'].iloc[0]).split(','),
        },
        'alertaAno': alerta_ano,
        'perfis': perfis,
        'opcoes': opcoes,
        'produtos': produtos,
        'textos': texts.items,
    }
    write_module(DIST / 'produtos-data.js', 'ProdutosGuimaraes', payload,
                 'Classificação de IBS/CBS por produto, transcrita da consulta em lote (abas ENTRADAS, RESULTADO e IMUNIDADE).')
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


def build_simples(arquivo, destino, global_name, comment):
    df = pd.read_excel(FONTES / arquivo, sheet_name='Simples', dtype=str).fillna('')
    sobre = pd.read_excel(FONTES / arquivo, sheet_name='Sobre a base', dtype=str).fillna('')
    info = {clean(r['Item']): clean(r['Valor']) for _, r in sobre.iterrows() if clean(r['Item']) != 'Atenção'}
    atencao = [clean(r['Valor']) for _, r in sobre.iterrows() if clean(r['Item']) == 'Atenção']

    linhas, cpfs, cpfs_aparentes, invalidos = [], 0, 0, 0
    for _, row in df.iterrows():
        digitos = re.sub(r'\D', '', row['CNPJ'])
        if not row['Observação'] and digitos.startswith('000') and cpf_valido(digitos[3:]) and int(digitos[8:12]) > 20:
            # CPF completado com zeros que, por coincidência, passa no dígito do CNPJ. A "filial"
            # (ex.: 4069) não existe e a raiz 000… pode cruzar com uma empresa real do Simples.
            cpfs_aparentes += 1
            continue
        if row['Observação']:
            # "CNPJ inválido": na prática são CPFs completados com zeros. Não publicamos o número.
            if digitos.startswith('000') and cpf_valido(digitos[3:]):
                cpfs += 1
            else:
                invalidos += 1
            continue
        situacao = clean(row['Situação no Simples'])
        if row['Optante Simples'] == 'Sim':
            codigo = 'O'
        elif situacao.startswith('Não optante'):
            codigo = 'X'
        elif situacao.startswith('Não consta'):
            codigo = 'N'
        else:
            raise ValueError(f'Situação desconhecida: {situacao!r}')
        linhas.append([digitos, codigo, clean(row['Data opção Simples']), clean(row['Data exclusão Simples']),
                       1 if row['MEI'] == 'Sim' else 0, clean(row['Data opção MEI']), clean(row['Data exclusão MEI'])])

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
    shutil.copyfile(FONTES / 'produtos-consulta-lote.xlsx', PLANILHAS / 'guimaraes-produtos-consulta-lote.xlsx')
    for origem, destino in (('clientes-simples.xlsx', 'guimaraes-clientes-situacao-simples.xlsx'),
                            ('fornecedores-simples.xlsx', 'guimaraes-fornecedores-situacao-simples.xlsx')):
        wb = openpyxl.load_workbook(FONTES / origem)
        ws = wb['Simples']
        header = [c.value for c in ws[1]]
        col_doc, col_obs = header.index('CNPJ') + 1, header.index('Observação') + 1
        omitidos = 0
        for row in range(2, ws.max_row + 1):
            digitos = re.sub(r'\D', '', str(ws.cell(row, col_doc).value or ''))
            obs = ws.cell(row, col_obs).value
            if obs and digitos.startswith('000') and cpf_valido(digitos[3:]):
                ws.cell(row, col_doc).value = 'CPF omitido'
                ws.cell(row, col_obs).value = 'Pessoa física (CPF): número omitido'
                omitidos += 1
            elif not obs and digitos.startswith('000') and cpf_valido(digitos[3:]) and int(digitos[8:12]) > 20:
                ws.cell(row, col_doc).value = 'CPF omitido'
                ws.cell(row, col_obs).value = ('Pessoa física (CPF) completado com zeros: número omitido. A situação no Simples '
                                               'desta linha veio de uma empresa com a mesma raiz e não se aplica.')
                omitidos += 1
        wb.save(PLANILHAS / destino)
        print(f'{(PLANILHAS / destino).relative_to(ROOT)}: {omitidos} CPFs omitidos')


if __name__ == '__main__':
    build_produtos()
    build_simples('clientes-simples.xlsx', 'clientes-data.js', 'ClientesGuimaraes',
                  'Situação no Simples Nacional dos clientes da Guimarães (Receita Federal, dados abertos do CNPJ).')
    build_simples('fornecedores-simples.xlsx', 'fornecedores-data.js', 'FornecedoresGuimaraes',
                  'Situação no Simples Nacional dos fornecedores da Guimarães (Receita Federal, dados abertos do CNPJ).')
    exportar_planilhas()
