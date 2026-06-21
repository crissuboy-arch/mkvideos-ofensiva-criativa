// Contrato de um renderer de cena. Cada cena devolve HTML interno (sem wrapper) e
// uma lista de linhas GSAP. O composer cuida do wrapper, Ken Burns, transições e legenda.

import type { SceneSpec, SceneType } from '../specs/types.js';
import type { Brand } from '../brands/types.js';
import type { Motion } from '../engine/motion.js';

export interface SceneCtx {
  i: number;                    // número da cena (1-based)
  p: string;                    // prefixo de id, ex.: "s1"
  m: Motion;                    // vocabulário de movimento (ajustado ao formato)
  vertical: boolean;
  brand: Brand;
  start: number;                // tempo absoluto de início
  end: number;
  dur: number;
  at: (d: number) => number;    // start + d (arredondado)
}

export interface SceneModule {
  type: SceneType;
  /** HTML interno da cena (usa ctx.p como prefixo dos ids). */
  html(spec: SceneSpec, ctx: SceneCtx): string;
  /** Linhas GSAP da cena (compostas a partir de ctx.m / ctx.at). */
  anim(spec: SceneSpec, ctx: SceneCtx): string[];
  /** CSS específico do tipo (palette via vars). Opcional. */
  css?(vertical: boolean): string;
}
