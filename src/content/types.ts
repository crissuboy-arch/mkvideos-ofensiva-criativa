// Domínio do Painel de Produção de Conteúdo (uso interno).
// Centro de controle operacional: planejar, cadastrar e disparar a geração.

import type { VideoType } from '../specs/types.js';

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook';
export type Language = 'pt' | 'es' | 'en';

/** Pipeline editorial: ideia → roteiro → gerando → renderizando → pronto → publicado. */
export type ContentStatus = 'ideia' | 'roteiro' | 'gerando' | 'renderizando' | 'pronto' | 'publicado';

export const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'facebook'];
export const LANGUAGES: Language[] = ['pt', 'es', 'en'];
export const CONTENT_STATUSES: ContentStatus[] = [
  'ideia', 'roteiro', 'gerando', 'renderizando', 'pronto', 'publicado',
];

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook',
};
export const LANGUAGE_LABEL: Record<Language, string> = {
  pt: 'Português', es: 'Espanhol', en: 'Inglês',
};

export interface ContentItem {
  id: number;
  tema: string;
  tipo: VideoType;
  plataforma: Platform;
  idioma: Language;
  produto: string | null;       // produto associado
  publish_date: string | null;  // YYYY-MM-DD
  publish_time: string | null;  // HH:MM
  status: ContentStatus;
  marca: string | null;         // id da marca (para a geração)
  video_path: string | null;    // resultado do render
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
  publish_date?: string | null;
  publish_time?: string | null;
  status?: ContentStatus;
  marca?: string | null;
}

/** Campos editáveis após criação. */
export type ContentPatch = Partial<Omit<ContentItem, 'id' | 'created_at' | 'updated_at'>>;

export interface ContentFilters {
  plataforma?: Platform;
  idioma?: Language;
  status?: ContentStatus;
  tipo?: VideoType;
}

export interface DashboardCounts {
  pending: number;    // ideia/roteiro/gerando/renderizando
  ready: number;      // pronto
  published: number;  // publicado
  thisWeek: number;   // publish_date dentro da semana atual
}

/** Status considerados "pendentes" (em produção, ainda não prontos). */
export const PENDING_STATUSES: ContentStatus[] = ['ideia', 'roteiro', 'gerando', 'renderizando'];

/** Formato sugerido pela plataforma (YouTube → 16:9; o resto → 9:16). */
export function platformFormat(p: Platform): 'vertical' | 'horizontal' {
  return p === 'youtube' ? 'horizontal' : 'vertical';
}

/** Validação leve dos enums (entrada de UI/API). */
export function isPlatform(v: string): v is Platform { return (PLATFORMS as string[]).includes(v); }
export function isLanguage(v: string): v is Language { return (LANGUAGES as string[]).includes(v); }
export function isStatus(v: string): v is ContentStatus { return (CONTENT_STATUSES as string[]).includes(v); }
