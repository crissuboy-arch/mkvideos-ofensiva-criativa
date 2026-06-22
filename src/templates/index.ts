// Registro dos 7 templates de tipo de vídeo.

import { explicativo, curso, tutorial } from './informative.js';
import { vendas, anuncio } from './persuasive.js';
import { storytelling, motivacional } from './narrative.js';
import type { VideoTemplate } from './types.js';
import type { VideoType } from '../specs/types.js';

export type { VideoTemplate, BuildCtx, BuildResult, HookSpec } from './types.js';

const ALL: VideoTemplate[] = [
  explicativo, vendas, curso, storytelling, tutorial, anuncio, motivacional,
];

export const TEMPLATES: Record<VideoType, VideoTemplate> = Object.fromEntries(
  ALL.map((t) => [t.tipo, t]),
) as Record<VideoType, VideoTemplate>;

/** Template de um tipo; cai em 'explicativo' se desconhecido. */
export function getTemplate(tipo: VideoType): VideoTemplate {
  return TEMPLATES[tipo] ?? TEMPLATES.explicativo;
}

export function listTemplates(): VideoTemplate[] {
  return ALL;
}
