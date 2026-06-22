// Helpers e bancos de frase compartilhados (offline, determinístico).
// Foco em retenção: ganchos fortes, curiosidade, tensão, CTAs naturais e
// ANTI-REPETIÇÃO do tema (anáfora rotativa + variação de construção).

import type { Brand } from '../brands/types.js';
import type { SceneSpec } from '../specs/types.js';
import type { ThemeInfo } from '../specs/theme.js';
import { spokenHandle, spokenUrl, cap } from '../specs/theme.js';

export { cap };

/** Pega o item i de um banco circular (determinístico). */
export function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

/** Minúscula na 1ª letra, para inserir o tema no meio de uma frase sem ficar torto. */
export function lower(s: string): string {
  if (!s) return s;
  // mantém siglas curtas em caixa (IA, SEO, CRM…)
  if (/^[A-ZÀ-Ý]{2,5}\b/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Substitui {t} pelo tema (já no caso certo) num template de frase. */
export function fillT(tpl: string, topic: string): string {
  return tpl.replace(/\{t\}/g, topic);
}

export function kindLabel(kind?: string): string {
  return kind ? cap(kind) : 'Ponto';
}

/**
 * Referência ao tema com ANÁFORA rotativa: a 1ª vez usa o tema; as próximas usam
 * "isso / esse caminho / esse método…". Evita repetir o tema literal toda hora.
 */
const ANAPHORA = ['isso', 'esse caminho', 'esse método', 'essa ideia', 'esse jogo', 'o que importa aqui'];
export function topicRef(theme: ThemeInfo, i: number): string {
  return i <= 0 ? lower(theme.subject) : pick(ANAPHORA, i - 1);
}

// ── bancos genéricos (reusados por vários templates) ─────────────────────────

/** Beats de curiosidade — abrem loop na cabeça de quem assiste. */
export const CURIOSITY = [
  'O detalhe que quase ninguém percebe.',
  'E o motivo vai te surpreender.',
  'Aqui é onde o jogo vira.',
  'Esse é o ponto que separa quem faz de quem só fala.',
  'Repara: muda tudo quando cai a ficha.',
  'Poucos chegam até aqui — e é exatamente o que faz a diferença.',
];

/** Beats de tensão — criam stakes e seguram a atenção. */
export const TENSION = [
  'É aqui que a maioria desiste.',
  'Erra isso e o resto não importa.',
  'Parece simples. Não é.',
  'Foi quando tudo quase deu errado.',
  'Ignora isso e você volta pra estaca zero.',
];

/** Pontes de CTA naturais — sem soar robô. */
export const CTA_BRIDGES = [
  'Se isso fez sentido, segue pra não perder o próximo.',
  'Salva esse vídeo — você vai querer rever.',
  'Comenta aqui o que você vai testar primeiro.',
  'Manda pra aquela pessoa que precisa ver isso.',
];

/** Narração-assinatura da marca (identidade), levada para a fala. */
export function brandSignoff(brand: Brand): string {
  return `${brand.name}. ${brand.tagline}. Me segue em ${spokenHandle(brand.instagram)}. ${spokenUrl(brand.site)}.`;
}

/** Monta uma SceneSpec preenchendo narration/caption obrigatórios. */
export function mk(partial: Partial<SceneSpec> & { type: SceneSpec['type']; narration: string; caption: string }): SceneSpec {
  return partial;
}
