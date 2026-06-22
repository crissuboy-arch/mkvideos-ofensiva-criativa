// Registro dos templates de tipo de vídeo (14 — 7 originais + 7 nichos).

import { explicativo, curso, tutorial } from './informative.js';
import { vendas, anuncio, produtoDigital } from './persuasive.js';
import { storytelling, motivacional, novelaCurta } from './narrative.js';
import { tiktokViral, curiosidades, autoridade } from './viral.js';
import { bonequinhas3d, historiasInfantis } from './kids.js';
import type { VideoTemplate } from './types.js';
import type { VideoType } from '../specs/types.js';

export type { VideoTemplate, BuildCtx, BuildResult, HookSpec } from './types.js';

const ALL: VideoTemplate[] = [
  tiktokViral, curiosidades, storytelling, novelaCurta, motivacional,
  autoridade, vendas, produtoDigital, anuncio, explicativo,
  curso, tutorial, bonequinhas3d, historiasInfantis,
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
