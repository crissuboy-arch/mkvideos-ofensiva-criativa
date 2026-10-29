// Adaptador Hacker News (fonte A, assumida como primeira — ver relatório
// da Fase 1; trocar de fonte = outro adaptador, sem mexer no resto).
// API oficial do Hacker News (Firebase): gratuita, sem chave, sem login.
//   https://hacker-news.firebaseio.com/v0/topstories.json
//   https://hacker-news.firebaseio.com/v0/item/<id>.json
// O ranking devolve topstories por pontos; a coleta tira um RETRATO a
// uma hora fixa (16h, como o Nei) porque a front page muda ao longo
// do dia — sem retrato, o ranking não é reprodutível.

import type { FonteAdapter, HttpGet, ItemBruto } from '../types.js';

const BASE = 'https://hacker-news.firebaseio.com/v0';

/** Palavras-chave do filtro, TRANSPARENTES e documentadas: o Top 10 é
 * sobre IA e ferramentas para criadores e marketing — o público dela,
 * não o do Nei (programadores). A lista vive aqui, não escondida num
 * prompt. Palavras de uma só palavra casam por palavra inteira (para
 * «ai» não casar com «said»); frases casam por inclusão. */
export const PALAVRAS_CHAVE = [
  'ia', 'inteligência artificial', 'inteligencia artificial', 'ai', 'llm',
  'gpt', 'chatgpt', 'claude', 'openai', 'machine learning', 'deep learning',
  'agente', 'agent', 'automação', 'automacao', 'automation',
  'ferramenta', 'ferramentas', 'tool', 'tools', 'criador', 'criadores',
  'creator', 'creators', 'marketing',
  'anúncio', 'anúncios', 'anuncio', 'anuncios', 'ads', 'vídeo', 'vídeos',
  'video', 'videos', 'youtube', 'instagram',
  'tiktok', 'prompt', 'prompts', 'chatbot', 'assistente', 'assistant',
  'gerador', 'generator', 'edição', 'edicao', 'editing', 'design',
  'imagem', 'image', 'voz', 'voice', 'áudio', 'audio',
  'conteúdo', 'conteudo', 'content', 'social', 'startup',
  'negócio', 'negocio', 'vendas', 'sales', 'seo', 'e-commerce',
  'ecommerce', 'loja', 'robô', 'robo', 'robot', 'agentes', 'agents',
];

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Diz se o título passa no filtro de nicho (IA / criadores / marketing). */
export function casaFiltro(titulo: string): boolean {
  const norm = normalizar(titulo);
  const palavras = new Set(norm.split(/[^a-z0-9]+/).filter(Boolean));
  return PALAVRAS_CHAVE.some((chave) => {
    const nc = normalizar(chave);
    return nc.includes(' ') ? norm.includes(nc) : palavras.has(nc);
  });
}

interface HnItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  type?: string;
  text?: string;
}

function resumoDe(item: HnItem): string {
  const base = item.title ?? '';
  if (!item.text) return base;
  const texto = item.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return texto ? `${base} — ${texto.slice(0, 200)}` : base;
}

async function buscarJson(httpGet: HttpGet, url: string): Promise<unknown> {
  return httpGet(url);
}

/** Varre os topstories até `limiteIds`, filtra pelo nicho e ordena por
 * pontos (desempate: comentários). Devolve no máximo 10 itens brutos. */
export async function coletarHackerNews(
  httpGet: HttpGet,
  opts: { limiteIds?: number; lote?: number } = {},
): Promise<ItemBruto[]> {
  const limiteIds = opts.limiteIds ?? 150;
  const lote = opts.lote ?? 20;
  const ids = (await buscarJson(httpGet, `${BASE}/topstories.json`)) as number[];
  if (!Array.isArray(ids)) throw new Error('topstories não devolveu uma lista de ids');
  const alvos = ids.slice(0, limiteIds);

  const itens: HnItem[] = [];
  for (let i = 0; i < alvos.length; i += lote) {
    const bloco = await Promise.all(
      alvos.slice(i, i + lote).map((id) => buscarJson(httpGet, `${BASE}/item/${id}.json`)),
    );
    for (const raw of bloco) {
      const item = raw as HnItem | null;
      if (item && item.type === 'story' && item.title) itens.push(item);
    }
  }

  const filtrados = itens.filter((item) => casaFiltro(item.title as string));
  filtrados.sort((a, b) => {
    const porPontos = (b.score ?? 0) - (a.score ?? 0);
    return porPontos !== 0 ? porPontos : (b.descendants ?? 0) - (a.descendants ?? 0);
  });

  return filtrados.slice(0, 10).map((item) => ({
    titulo: item.title as string,
    resumo: resumoDe(item),
    url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
    pontos: item.score ?? 0,
    comentarios: item.descendants ?? 0,
    fonteId: String(item.id),
  }));
}

export const hackerNewsAdapter: FonteAdapter = {
  id: 'hackernews',
  coletar: (_data, httpGet) => coletarHackerNews(httpGet),
};
