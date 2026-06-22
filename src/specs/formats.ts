// Resolução de formato → dimensões + default por tipo de vídeo.

import type { Format, VideoType, Dimensions } from './types.js';

/** Dimensões do canvas para o formato. */
export function dims(format: Format): Dimensions {
  return format === 'vertical'
    ? { w: 1080, h: 1920, vertical: true }
    : { w: 1920, h: 1080, vertical: false };
}

/**
 * Formato default por tipo de vídeo. Curso/tutorial nascem 16:9 (tela/aula);
 * o resto nasce 9:16 (feed). O usuário sempre pode forçar com --vertical/--horizontal.
 */
export function defaultFormatFor(tipo: VideoType): Format {
  return tipo === 'curso' || tipo === 'tutorial' ? 'horizontal' : 'vertical';
}

/** Normaliza flags do CLI em um Format. `--horizontal` vence; senão default do tipo. */
export function resolveFormat(opts: {
  vertical?: boolean;
  horizontal?: boolean;
  tipo: VideoType;
}): Format {
  if (opts.horizontal) return 'horizontal';
  if (opts.vertical) return 'vertical';
  return defaultFormatFor(opts.tipo);
}
