// Subcomando `mkivideos diaria …` — Fase 1: coleta + portão, SEM vídeo.
// Uso:
//   mkivideos diaria coletar [--data YYYY-MM-DD] [--pasta <dir>] [--teste]
//   mkivideos diaria ficha <pasta-da-edicao> --base <ficha-base.json>
//   mkivideos diaria portao <ficha.json>
// Modo teste: SEM_GIT=1, SEM_PUBLICAR=1 ou --teste → a edição vai para
// o tmpdir e nada é escrito no repo. A Fase 1 nunca publica nem corre
// git em nenhum modo.

import { readFileSync } from 'node:fs';

import { hackerNewsAdapter } from './fontes/hackernews.js';
import { coletarEEditar, modoTeste } from './coleta.js';
import { fichaDeTop10, escreverFicha, lerFicha, lerTop10, type FichaBase } from './ficha.js';
import { validarFicha } from './portao.js';
import type { FonteAdapter, HttpGet } from './types.js';

const FONTES: Record<string, FonteAdapter> = {
  hackernews: hackerNewsAdapter,
};

function optVal(a: string[], n: string): string | undefined {
  const i = a.indexOf(n);
  return i >= 0 ? a[i + 1] : undefined;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

async function httpGetJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

export function diariaUsage(): string {
  return [
    'mkivideos diaria — Fase 1: coleta do Top 10 + portão de roteiro (sem vídeo)',
    '',
    '  mkivideos diaria coletar [--data YYYY-MM-DD] [--pasta <dir>] [--teste]',
    '      Coleta o Top 10 do dia (fonte: hackernews) e grava a edição em',
    '      edicoes/AAAA-MM-DD-top10-dia/ (top10.json, snapshot.json, rodada.log).',
    '  mkivideos diaria ficha <pasta-da-edicao> --base <ficha-base.json>',
    '      Constrói ficha.json a partir do top10.json + textos manuais.',
    '  mkivideos diaria portao <ficha.json>',
    '      Valida a ficha (ordem, tamanho, manchete, algarismos, tom, CTA).',
    '',
    '  Modo teste: SEM_GIT=1, SEM_PUBLICAR=1 ou --teste → edição no tmpdir.',
  ].join('\n');
}

export async function runDiariaCli(args: string[]): Promise<string> {
  const [sub, ...rest] = args;
  if (!sub) return diariaUsage();

  switch (sub) {
    case 'coletar': {
      const data = optVal(rest, '--data') ?? hoje();
      const teste = modoTeste(rest);
      const { dir, top10 } = await coletarEEditar(
        FONTES.hackernews,
        data,
        httpGetJson as HttpGet,
        { baseDir: optVal(rest, '--pasta'), teste },
      );
      const linhas = top10.itens.map(
        (i) => `  #${i.posicao} (${i.pontos} pts, ${i.comentarios} com.) ${i.titulo}`,
      );
      return [
        `edição: ${dir}${teste ? ' (modo teste: tmpdir, sem efeitos no repo)' : ''}`,
        `fonte: ${top10.fonte} | data: ${top10.data} | coletado: ${top10.coletadoEm}`,
        ...linhas,
      ].join('\n');
    }

    case 'ficha': {
      const pasta = rest[0];
      const basePath = optVal(rest, '--base');
      if (!pasta || !basePath) return 'uso: mkivideos diaria ficha <pasta-da-edicao> --base <ficha-base.json>';
      const top10 = lerTop10(`${pasta}/top10.json`);
      const base = JSON.parse(readFileSync(basePath, 'utf-8')) as FichaBase;
      const ficha = fichaDeTop10(top10, base);
      const caminho = escreverFicha(pasta, ficha);
      return `ficha escrita: ${caminho}\nvalida com: mkivideos diaria portao ${caminho}`;
    }

    case 'portao': {
      const caminho = rest[0];
      if (!caminho) return 'uso: mkivideos diaria portao <ficha.json>';
      const resultado = validarFicha(lerFicha(caminho));
      if (resultado.ok) return `PORTÃO APROVADO: ${caminho}`;
      throw new Error(
        `PORTÃO REPROVADO (${resultado.falhas.length} falhas):\n${resultado.falhas.map((f) => `  - ${f}`).join('\n')}`,
      );
    }

    default:
      return diariaUsage();
  }
}
