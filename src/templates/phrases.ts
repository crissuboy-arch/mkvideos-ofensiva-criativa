// Helpers e bancos de frase compartilhados pelos templates (offline, determinístico).

import type { Brand } from '../brands/types.js';
import type { SceneSpec } from '../specs/types.js';
import { spokenHandle, spokenUrl, cap } from '../specs/theme.js';

export { cap };

/** Pega o item i de um banco circular (determinístico). */
export function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

/** Rótulo de listagem: "Forma"/"Passo"/… ou "Ponto" quando não detectado. */
export function kindLabel(kind?: string): string {
  return kind ? cap(kind) : 'Ponto';
}

/** Narração padrão da CTA, derivada da marca (expandida para fala). */
export function ctaNarration(brand: Brand): string {
  return `Isso é ${brand.name}. ${brand.tagline}. Me siga em ${spokenHandle(brand.instagram)}. Acesse: ${spokenUrl(brand.site)}.`;
}

/** Monta uma SceneSpec preenchendo narration/caption obrigatórios. */
export function mk(partial: Partial<SceneSpec> & { type: SceneSpec['type']; narration: string; caption: string }): SceneSpec {
  return partial;
}
