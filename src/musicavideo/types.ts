// Tipos do adapter musicavideo (Música + Videoclipe). Espelham estado.json/
// plano.json do CLI vendorizado (modules/musicavideo) — ver ORIGEM.md lá.

export type ParteMusicavideo = 'musica' | 'capa' | 'clipe';
export const PARTES_MUSICAVIDEO: ParteMusicavideo[] = ['musica', 'capa', 'clipe'];

export type EstadoParte =
  | 'planejado' | 'aprovado' | 'gerando' | 'revisao' | 'pronto' | 'erro';

export interface ParteEstado {
  estado: EstadoParte;
  aprovado_em: string | null;
  ajustes: number;
  tentativas: number;
  custo_estimado_usd: number;
  custo_real_usd: number;
  artefato: string | null;
  erro: string | null;
  meta: Record<string, unknown>;
}

export interface EstadoMusicavideo {
  schema_version: string;
  slug: string;
  atualizado_em: string;
  fase: string;
  telegram: boolean;
  teto_usd: number | null;
  partes: Record<ParteMusicavideo, ParteEstado>;
  custo_total_usd: { estimado: number; gasto: number };
  historico: { quando: string; evento: string; detalhe: string }[];
}

/** `plano.json` — schema aberto do upstream; só tipamos os campos que lemos. */
export interface PlanoMusicavideo {
  slug: string;
  titulo?: string;
  musica: { motor: string; params?: Record<string, unknown>; letra?: string; estilo?: string };
  capa: { motor: string; params?: Record<string, unknown> };
  clipe: { motor: string; decupagem: { duracao_s: number }[] };
  [k: string]: unknown;
}

export interface PlanoInput {
  solicitacao: string;
  slug?: string;
  pesquisa?: boolean;
  estilo?: string;
  idioma?: string;
  letraArquivo?: string;
  letraFinal?: boolean;
  faixaProntaArquivo?: string;
  motor?: Record<ParteMusicavideo, string>;
  ritmo?: 'auto' | 'calmo' | 'padrao' | 'variado' | 'dinamico';
  forca?: boolean;
}

export interface FazInput {
  slug: string;
  partes?: ParteMusicavideo[];
  /** Autorização do MKVideos (gate próprio, além do --autorizo-pago do CLI). */
  confirmado: boolean;
  motorOverride?: Partial<Record<ParteMusicavideo, string>>;
  semRevisao?: boolean;
}

/** Uma linha de `index.jsonl` (lida direto — mais robusto que parsear stdout). */
export interface IndiceLinha {
  slug: string;
  mvd: string | null;
  titulo: string;
  criado_em: string;
  solicitacao: string;
  estilo_ref?: string;
  genero?: string;
  bpm?: number;
  tom?: string;
  motores: Record<ParteMusicavideo, string>;
  estados: Record<ParteMusicavideo, EstadoParte>;
  origem?: string | null;
  custo_gasto_usd: number;
  tags?: string[];
}
