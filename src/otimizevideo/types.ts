// Tipos do adapter otimizevideo (Otimizar Vídeo). Ver modules/otimizevideo/ORIGEM.md.

export type ModoOtv = 'A' | 'B' | 'C' | 'N';
export const MODOS_OTV: ModoOtv[] = ['A', 'B', 'C', 'N'];

export type FaseOtv =
  | 'ingest' | 'transcrever' | 'cenas' | 'classificar' | 'unidades'
  | 'pontuar' | 'selecionar' | 'substituir' | 'render' | 'narrar';

/** Segmento de `plan.json` — timestamps vêm SEMPRE da transcrição real, nunca do LLM. */
export interface SegmentoPlano {
  in: number;
  out: number;
  unidades: number[];
  visual: string;
  motivo: string;
  texto: string;
  estender_s?: number;
  substituir?: string;
}

export interface PlanoOtv {
  modo: ModoOtv;
  alvo_s: number;
  total_s: number;
  manchete?: string;
  segmentos: SegmentoPlano[];
  [k: string]: unknown;
}

export interface CustoFase {
  uso?: { cost?: number; [k: string]: unknown };
  quando?: string;
  [k: string]: unknown;
}

export interface StatusOtv {
  id: string;
  dir: string;
  artefatos: Record<string, boolean>;
  plano: { modo: ModoOtv; total_s: number; segmentos: number; alvo_s: number } | null;
  custos: Record<string, CustoFase>;
  custoTotalUsd: number;
  outputMp4: string | null;
}
