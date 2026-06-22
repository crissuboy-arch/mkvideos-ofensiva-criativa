// Domínio do Centro de Operações de Conteúdo (uso interno).
// Planejar, cadastrar, agendar, gerar, publicar (via worker + publishers mock) e medir.

import type { VideoType } from '../specs/types.js';

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook';
export type Language = 'pt' | 'es' | 'en';

/** Pipeline editorial: ideia → roteiro → gerando → renderizando → pronto → agendado → publicado. */
export type ContentStatus =
  | 'ideia' | 'roteiro' | 'gerando' | 'renderizando' | 'pronto' | 'agendado' | 'publicado';

/** Eventos registrados no log (tudo em banco). */
export type LogEvent = 'geracao' | 'renderizacao' | 'agendamento' | 'publicacao' | 'erro';

export const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'facebook'];
export const LANGUAGES: Language[] = ['pt', 'es', 'en'];
export const CONTENT_STATUSES: ContentStatus[] = [
  'ideia', 'roteiro', 'gerando', 'renderizando', 'pronto', 'agendado', 'publicado',
];

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook',
};
export const LANGUAGE_LABEL: Record<Language, string> = {
  pt: 'Português', es: 'Espanhol', en: 'Inglês',
};

export const DEFAULT_TZ = 'America/Sao_Paulo';

export interface ContentItem {
  id: number;
  tema: string;
  tipo: VideoType;
  plataforma: Platform;
  idioma: Language;
  produto: string | null;
  account_id: number | null;    // conta destino
  publish_date: string | null;  // YYYY-MM-DD  (data_publicacao)
  publish_time: string | null;  // HH:MM       (hora_publicacao)
  timezone: string | null;
  status: ContentStatus;
  marca: string | null;
  video_path: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

export interface ContentInput {
  tema: string;
  tipo?: VideoType;
  plataforma: Platform;
  idioma?: Language;
  produto?: string | null;
  account_id?: number | null;
  publish_date?: string | null;
  publish_time?: string | null;
  timezone?: string | null;
  status?: ContentStatus;
  marca?: string | null;
}

export type ContentPatch = Partial<Omit<ContentItem, 'id' | 'created_at' | 'updated_at'>>;

export interface ContentFilters {
  plataforma?: Platform;
  idioma?: Language;
  status?: ContentStatus;
  tipo?: VideoType;
  produto?: string;   // busca por substring
}

/** Uma variação de lote: só muda tema / idioma / data. */
export interface BatchVariation {
  tema?: string;
  idioma?: Language;
  publish_date?: string | null;
}

// ── contas ───────────────────────────────────────────────────────────────────

export interface Account {
  id: number;
  nome: string;
  plataforma: Platform;
  idioma: Language;
  ativo: number;        // 0 | 1
  created_at: number;
}

export interface AccountInput {
  nome: string;
  plataforma: Platform;
  idioma: Language;
  ativo?: boolean;
}

// ── logs ─────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: number;
  content_id: number | null;
  event: LogEvent;
  detail: string | null;
  created_at: number;
}

// ── dashboard / métricas ──────────────────────────────────────────────────────

export interface DashboardCounts {
  pending: number;    // ideia/roteiro/gerando/renderizando
  ready: number;      // pronto
  scheduled: number;  // agendado
  published: number;  // publicado
  thisWeek: number;   // publish_date dentro da semana atual
}

export interface Metrics {
  created: number;
  published: number;
  scheduled: number;
  byPlatform: Record<Platform, number>;
}

/** Status "em produção" (ainda não prontos). */
export const PENDING_STATUSES: ContentStatus[] = ['ideia', 'roteiro', 'gerando', 'renderizando'];

/** Formato sugerido pela plataforma (YouTube → 16:9; o resto → 9:16). */
export function platformFormat(p: Platform): 'vertical' | 'horizontal' {
  return p === 'youtube' ? 'horizontal' : 'vertical';
}

export function isPlatform(v: string): v is Platform { return (PLATFORMS as string[]).includes(v); }
export function isLanguage(v: string): v is Language { return (LANGUAGES as string[]).includes(v); }
export function isStatus(v: string): v is ContentStatus { return (CONTENT_STATUSES as string[]).includes(v); }
