// Testes da diária — Fase 1 (coleta + portão). Sem rede: o fetch do HN
// é sempre injetado (stub). Estilo do repo: vitest, um describe por unidade.

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { casaFiltro, coletarHackerNews } from './fontes/hackernews.js';
import {
  montarTop10,
  escreverEdicao,
  coletarEEditar,
  modoTeste,
} from './coleta.js';
import { fichaDeTop10, textoFalado, type FichaBase } from './ficha.js';
import { validarFicha } from './portao.js';
import type { Ficha, FonteAdapter, Top10 } from './types.js';

// ── ajudas ────────────────────────────────────────────────────────────────

const NOMES = ['Alfa', 'Beta', 'Gama', 'Delta', 'Épsilon', 'Zeta', 'Eta', 'Teta', 'Iota', 'Capa'];

function top10Fake(): Top10 {
  return {
    fonte: 'teste',
    data: '2026-10-29',
    coletadoEm: '2026-10-29T16:00:00.000Z',
    itens: NOMES.map((nome, i) => ({
      titulo: `Ferramenta ${nome}`,
      resumo: `Resumo da ferramenta ${nome}.`,
      url: `https://exemplo.com/${nome.toLowerCase()}`,
      pontos: 100 - i * 10,
      comentarios: i,
      fonteId: String(i + 1),
      posicao: i + 1,
    })),
  };
}

const FRASE = 'você pode usar esta ferramenta todos os dias para criar mais rápido. ';
const FRASE_SEM_VOCE = 'esta ferramenta ajuda a criar mais rápido e com mais qualidade todos os dias. ';

function fichaValida(patch: Partial<Ficha> = {}, falasOverride?: Record<number, string>): Ficha {
  const falas: Record<number, string> = {};
  for (let p = 1; p <= 10; p++) falas[p] = falasOverride?.[p] ?? FRASE.repeat(2);
  const base: FichaBase = {
    manchete: 'Dez ferramentas de IA para criadores',
    gancho: FRASE.repeat(3),
    panorama: FRASE.repeat(3),
    perguntaFinal: 'você vai testar qual delas ainda hoje? Conta para mim.',
    cta: 'https://exemplo.com/cta',
    falas,
  };
  const ficha = fichaDeTop10(top10Fake(), base);
  return { ...ficha, ...patch };
}

function stubHttp(itens: Record<number, unknown>, topIds: number[]) {
  return async (url: string): Promise<unknown> => {
    if (url.endsWith('topstories.json')) return topIds;
    const m = url.match(/item\/(\d+)\.json/);
    if (m) return itens[Number(m[1])] ?? null;
    throw new Error(`url inesperado no stub: ${url}`);
  };
}

const ENV_ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

// ── filtro Hacker News ────────────────────────────────────────────────────

describe('casaFiltro', () => {
  it('aceita IA / ferramentas / marketing (PT e EN, singular e plural)', () => {
    expect(casaFiltro('New AI video editor for creators')).toBe(true);
    expect(casaFiltro('Ferramentas de IA para criadores')).toBe(true);
    expect(casaFiltro('Best marketing tools of the year')).toBe(true);
    expect(casaFiltro('Show HN: meu agente de automação')).toBe(true);
  });

  it('não casa por substring: "said" não é "ai"', () => {
    expect(casaFiltro('I said goodbye to my old workflow')).toBe(false);
    expect(casaFiltro('Rust compiler internals')).toBe(false);
  });
});

describe('coletarHackerNews', () => {
  it('filtra, ordena por pontos (desempate: comentários) e limita a 10', async () => {
    const itens = {
      1: { id: 1, type: 'story', title: 'AI video editor', score: 10, descendants: 1, url: 'https://a.test' },
      2: { id: 2, type: 'story', title: 'Rust compiler internals', score: 500, descendants: 99, url: 'https://b.test' },
      3: { id: 3, type: 'story', title: 'Marketing tools for creators', score: 20, descendants: 9, url: 'https://c.test' },
      4: { id: 4, type: 'story', title: 'Marketing tools for creators', score: 20, descendants: 3, url: 'https://d.test' },
      5: { id: 5, type: 'comment', title: 'AI is great', score: 999, descendants: 0 },
    };
    const brutos = await coletarHackerNews(stubHttp(itens, [1, 2, 3, 4, 5]));
    // Só 1, 3 e 4 passam (2 fora do nicho, 5 não é story).
    expect(brutos.map((b) => b.fonteId)).toEqual(['3', '4', '1']);
    expect(brutos[0].pontos).toBe(20);
    expect(brutos[0].comentarios).toBe(9);
  });

  it('usa a página do item quando não há url externa (Ask HN)', async () => {
    const itens = {
      7: { id: 7, type: 'story', title: 'Ask HN: Best AI tools for video?', score: 42, descendants: 8 },
    };
    const brutos = await coletarHackerNews(stubHttp(itens, [7]));
    expect(brutos).toHaveLength(1);
    expect(brutos[0].url).toBe('https://news.ycombinator.com/item?id=7');
  });
});

// ── coleta / snapshot ─────────────────────────────────────────────────────

describe('montarTop10', () => {
  it('atribui posições 1..10 em ordem', () => {
    const top10 = montarTop10('teste', '2026-10-29', top10Fake().itens.map(({ posicao: _p, ...r }) => r));
    expect(top10.itens.map((i) => i.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('recusa menos de 10 itens', () => {
    const poucos = top10Fake().itens.slice(0, 9).map(({ posicao: _p, ...r }) => r);
    expect(() => montarTop10('teste', '2026-10-29', poucos)).toThrow(/precisa de 10/);
  });
});

describe('escreverEdicao', () => {
  it('grava top10.json, snapshot.json e rodada.log na pasta da edição', () => {
    const base = mkdtempSync(path.join(tmpdir(), 'diaria-teste-'));
    const dir = escreverEdicao(base, top10Fake());
    expect(dir).toBe(path.join(base, 'edicoes/2026-10-29-top10-dia'));
    const top10 = JSON.parse(readFileSync(path.join(dir, 'top10.json'), 'utf-8')) as Top10;
    expect(top10.itens).toHaveLength(10);
    const snap = JSON.parse(readFileSync(path.join(dir, 'snapshot.json'), 'utf-8')) as {
      fonteIds: string[];
    };
    expect(snap.fonteIds).toHaveLength(10);
    expect(readFileSync(path.join(dir, 'rodada.log'), 'utf-8')).toMatch(/coleta fonte=teste itens=10/);
  });
});

describe('modoTeste', () => {
  it('forçado por SEM_GIT=1, SEM_PUBLICAR=1 ou --teste; falso sem eles', () => {
    delete process.env.SEM_GIT;
    delete process.env.SEM_PUBLICAR;
    expect(modoTeste([])).toBe(false);
    expect(modoTeste(['--teste'])).toBe(true);
    process.env.SEM_GIT = '1';
    expect(modoTeste([])).toBe(true);
    delete process.env.SEM_GIT;
    process.env.SEM_PUBLICAR = '1';
    expect(modoTeste([])).toBe(true);
  });
});

describe('coletarEEditar em modo teste', () => {
  it('escreve no tmpdir, não no repo', async () => {
    const adapter: FonteAdapter = {
      id: 'stub',
      coletar: async () => top10Fake().itens.map(({ posicao: _p, ...r }) => r),
    };
    const { dir, top10 } = await coletarEEditar(adapter, '2026-10-29', async () => ({}), { teste: true });
    expect(dir.startsWith(tmpdir())).toBe(true);
    expect(top10.itens).toHaveLength(10);
    expect(existsSync(path.join(dir, 'top10.json'))).toBe(true);
  });
});

// ── ficha ─────────────────────────────────────────────────────────────────

describe('fichaDeTop10', () => {
  it('põe os itens em ordem de apresentação #10 → #1', () => {
    const ficha = fichaValida();
    expect(ficha.itens.map((i) => i.posicao)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(ficha.itens[0].titulo).toBe('Ferramenta Capa');
    expect(ficha.itens[9].titulo).toBe('Ferramenta Alfa');
  });

  it('usa o resumo quando não há fala manual para o item', () => {
    const ficha = fichaDeTop10(top10Fake(), {
      manchete: 'Dez ferramentas de IA para criadores',
      gancho: 'gancho',
      panorama: 'panorama',
      perguntaFinal: 'pergunta?',
      cta: 'https://exemplo.com/cta',
    });
    expect(ficha.itens[0].fala).toBe('Resumo da ferramenta Capa.');
  });
});

describe('textoFalado', () => {
  it('junta manchete, gancho, panorama, falas e pergunta final', () => {
    const ficha = fichaValida();
    const texto = textoFalado(ficha);
    expect(texto.startsWith('Dez ferramentas de IA para criadores')).toBe(true);
    expect(texto.endsWith('Conta para mim.')).toBe(true);
    expect(texto.length).toBeGreaterThanOrEqual(1300);
    expect(texto.length).toBeLessThanOrEqual(2500);
  });
});

// ── portão ────────────────────────────────────────────────────────────────

describe('validarFicha', () => {
  it('aprova uma ficha válida', () => {
    expect(validarFicha(fichaValida()).ok).toBe(true);
  });

  it('reprova ordem errada, repetidos e faltas', () => {
    const ordemErrada = fichaValida();
    ordemErrada.itens.reverse();
    expect(validarFicha(ordemErrada).falhas.join(' ')).toMatch(/ordem errada/);

    const repetido = fichaValida();
    repetido.itens[1].posicao = 10;
    expect(validarFicha(repetido).falhas.join(' ')).toMatch(/repetidas/);

    const falta = fichaValida();
    falta.itens[0].posicao = 5;
    expect(validarFicha(falta).falhas.join(' ')).toMatch(/em falta/);
  });

  it('reprova menos de 10 itens', () => {
    const ficha = fichaValida();
    ficha.itens = ficha.itens.slice(0, 9);
    expect(validarFicha(ficha).falhas.join(' ')).toMatch(/precisa de 10/);
  });

  it('reprova manchete com mais de 6 palavras', () => {
    const ficha = fichaValida({ manchete: 'Uma manchete muito longa com sete palavras aqui' });
    expect(validarFicha(ficha).falhas.join(' ')).toMatch(/manchete com 8 palavras/);
  });

  it('reprova texto curto e texto longo', () => {
    const curto = fichaValida({}, Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 'você vê.'])));
    expect(validarFicha(curto).falhas.join(' ')).toMatch(/precisa de 1300–2500/);
    const longo = fichaValida({}, Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, FRASE.repeat(6)])));
    expect(validarFicha(longo).falhas.join(' ')).toMatch(/precisa de 1300–2500/);
  });

  it('reprova algarismos na fala', () => {
    const ficha = fichaValida();
    ficha.itens[0].fala = `${FRASE.repeat(2)} versão 2 lançada agora.`;
    expect(validarFicha(ficha).falhas.join(' ')).toMatch(/algarismos na fala/);
  });

  it('reprova fala sem "você"', () => {
    const semVoce = fichaValida(
      {
        gancho: FRASE_SEM_VOCE.repeat(3),
        panorama: FRASE_SEM_VOCE.repeat(3),
        perguntaFinal: 'Conta qual delas vais testar ainda hoje.',
      },
      Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, FRASE_SEM_VOCE.repeat(2)])),
    );
    expect(validarFicha(semVoce).falhas.join(' ')).toMatch(/sem "você"/);
  });

  it('reprova CTA ausente e CTA do Nei', () => {
    expect(validarFicha(fichaValida({ cta: '' })).falhas.join(' ')).toMatch(/CTA ausente/);
    expect(validarFicha(fichaValida({ cta: 'https://inema.club' })).falhas.join(' ')).toMatch(/CTA proibido/);
  });

  it('reprova inema.club escondido no texto falado', () => {
    const ficha = fichaValida({ panorama: `${FRASE.repeat(3)} Vê mais em inema.club todos os dias.` });
    expect(validarFicha(ficha).falhas.join(' ')).toMatch(/proibido/);
  });

  it('reprova item sem fala e pergunta final vazia', () => {
    const ficha = fichaValida();
    ficha.itens[3].fala = '';
    expect(validarFicha(ficha).falhas.join(' ')).toMatch(/sem fala/);
    expect(validarFicha(fichaValida({ perguntaFinal: '' })).falhas.join(' ')).toMatch(/pergunta final vazia/);
  });
});
