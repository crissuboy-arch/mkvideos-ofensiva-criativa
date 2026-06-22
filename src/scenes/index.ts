// Registro de cenas: type → renderer. Fonte única para o composer e validações.

import { title, topic, lead, illus, quote } from './text.js';
import { bullets, cards, steps } from './lists.js';
import { term, compare, proof } from './data.js';
import { img, imgrow } from './media.js';
import { offer, cta } from './sales.js';
import type { SceneModule } from './types.js';
import type { SceneType } from '../specs/types.js';

export type { SceneModule, SceneCtx } from './types.js';

const ALL: SceneModule[] = [
  title, topic, lead, illus, quote,
  bullets, cards, steps,
  term, compare, proof,
  img, imgrow,
  offer, cta,
];

export const SCENES: Record<SceneType, SceneModule> = Object.fromEntries(
  ALL.map((m) => [m.type, m]),
) as Record<SceneType, SceneModule>;

/** Renderer de um tipo; cai em 'lead' (genérico) se o tipo for desconhecido. */
export function getScene(type: SceneType): SceneModule {
  return SCENES[type] ?? SCENES.lead;
}

/** CSS específico dos tipos usados (dedup por tipo). */
export function collectSceneCss(types: SceneType[], vertical: boolean): string {
  const seen = new Set<SceneType>();
  const out: string[] = [];
  for (const t of types) {
    if (seen.has(t)) continue;
    seen.add(t);
    const css = SCENES[t]?.css?.(vertical);
    if (css) out.push(css);
  }
  return out.join('\n');
}
