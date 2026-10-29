// Diária MKVideos — Fase 1 (coleta + portão de roteiro, SEM vídeo).
// Adaptação da arquitetura do gitbombando (licença MIT): nenhum código
// copiado de lá; só o desenho (coleta → ficha → portão → edição).
// Regras desta fase: sem HeyGen, sem Claude/Codex, sem yt-pubx, sem
// publicação, sem timer. A publicação futura é sempre com go por edição.

/** Um item bruto vindo de uma fonte, antes de receber posição. */
export interface ItemBruto {
  /** Título original, na língua da fonte. */
  titulo: string;
  /** Resumo bruto (ex.: título + excerto). A reescrita em português
   * simples é trabalho do roteiro (Fase 2 / decisão D3), não da coleta. */
  resumo: string;
  url: string;
  /** Pontos da fonte (ex.: score do Hacker News). */
  pontos: number;
  /** Comentários / discussão na fonte. */
  comentarios: number;
  /** Identificador do item na fonte (ex.: id do Hacker News). */
  fonteId: string;
}

/** Um item do Top 10, já com posição de ranking (#1 = mais pontos). */
export interface TopItem extends ItemBruto {
  /** Posição de ranking, 1..10 (#1 = primeiro). */
  posicao: number;
}

/** Resultado de uma coleta: o Top 10 em ordem de ranking. */
export interface Top10 {
  /** Id do adaptador de fonte (ex.: 'hackernews'). */
  fonte: string;
  /** Data da edição, YYYY-MM-DD. */
  data: string;
  /** Momento da coleta (ISO). O retrato é o que torna o ranking
   * reprodutível: a fonte muda ao longo do dia. */
  coletadoEm: string;
  /** Itens em ordem de ranking: itens[0].posicao === 1. */
  itens: TopItem[];
}

/** Ficha de roteiro de uma edição (ainda sem motor de IA — Fase 1).
 * Os itens ficam em ORDEM DE APRESENTAÇÃO (#10 → #1), que é a ordem
 * em que são ditos no vídeo. A ficha pode ser preenchida à mão a
 * partir do Top 10 coletado; o motor de roteiro é decisão D3 futura. */
export interface Ficha {
  /** Data da edição, YYYY-MM-DD. */
  data: string;
  /** Só 'dia' nesta fase (semana/mês ficam para depois da diária provar). */
  modo: 'dia';
  /** Id do adaptador de fonte do Top 10. */
  fonte: string;
  /** Manchete do vídeo (≤ 6 palavras, portão). */
  manchete: string;
  /** Gancho de abertura (falado). */
  gancho: string;
  /** Panorama geral (falado). */
  panorama: string;
  /** Itens em ordem de apresentação: itens[0].posicao === 10 e
   * itens[9].posicao === 1, sem faltas nem repetidos (portão). */
  itens: FichaItem[];
  /** Pergunta final (falada, fecha o vídeo). */
  perguntaFinal: string;
  /** Chamada final configurável (ex.: perfil/loja dela). OBRIGATÓRIA.
   * O CTA do Nei (inema.club) é PROIBIDO — o portão falha se aparecer. */
  cta: string;
}

/** Um item da ficha: o TopItem + o texto falado dele. */
export interface FichaItem extends TopItem {
  /** Texto falado sobre este item (números por extenso, sem algarismos). */
  fala: string;
}

/** Adaptador de fonte trocável. Trocar de fonte = implementar esta
 * interface e registá-la no CLI; nada mais muda. A fonte A (Hacker
 * News) foi assumida como primeira porque a dona ainda não confirmou
 * A/B/C em definitivo — ver relatório da Fase 1. */
export interface FonteAdapter {
  /** Id estável da fonte (ex.: 'hackernews'). */
  id: string;
  /** Coleta os itens brutos do dia, já ordenados por relevância
   * (maior primeiro). Não atribui posições — isso é do coletor. */
  coletar(data: string, httpGet: HttpGet): Promise<ItemBruto[]>;
}

/** GET mínimo injetável (para testes não baterem na rede). */
export type HttpGet = (url: string) => Promise<unknown>;

/** Resultado do portão: lista de falhas (vazia = aprovado). */
export interface GateResult {
  ok: boolean;
  falhas: string[];
}
