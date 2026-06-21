// Gerador de roteiro offline: tema → gancho + promessa + cenas (narração + legenda) + CTA.
// Determinístico, sem IA. O usuário pode passar `userScenes` para usar o próprio roteiro.

import { parseTheme, cap } from './theme.js';
import { resolveFormat } from './formats.js';
import { getTemplate } from '../templates/index.js';
import { ctaNarration } from '../templates/phrases.js';
import { getBrand } from '../brands/index.js';
import type { ScriptSpec, SceneSpec, VideoType } from './types.js';

export interface GenerateScriptInput {
  titulo: string;
  tipo?: VideoType;
  tema?: string;          // eyebrow custom
  brand?: string;         // id da marca
  n_cenas?: number;       // override do nº de cenas de conteúdo
  vertical?: boolean;
  horizontal?: boolean;
  userScenes?: SceneSpec[]; // roteiro pronto (substitui o conteúdo gerado)
}

/** Eyebrow curto a partir do assunto (3 primeiras palavras). */
function deriveTema(subject: string): string {
  const words = subject.split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
  return cap(words || subject);
}

/**
 * Aplica transições especiais nos 2–3 momentos-chave (sem sobrescrever as que o
 * usuário já definiu): zoom na 1ª cena de conteúdo, push no meio, fadeBlack na CTA.
 */
function decorateTransitions(scenes: SceneSpec[]): SceneSpec[] {
  const n = scenes.length;
  const lastContent = n - 2; // antes da CTA
  const mid = Math.floor(n / 2);
  return scenes.map((s, i) => {
    if (s.transIn) return s;
    if (i === 1 && n >= 3) return { ...s, transIn: 'zoom' };
    if (i === mid && i > 1 && i < lastContent + 1) return { ...s, transIn: 'push' };
    if (i === n - 1) return { ...s, transIn: 'fadeBlack' };
    return s;
  });
}

export function generateScript(input: GenerateScriptInput): ScriptSpec {
  const tipo: VideoType = input.tipo ?? 'explicativo';
  const brand = getBrand(input.brand);
  const tpl = getTemplate(tipo);
  const theme = parseTheme(input.titulo, input.n_cenas, tpl.defaultScenes);
  const format = resolveFormat({ vertical: input.vertical, horizontal: input.horizontal, tipo });
  const tema = input.tema ?? deriveTema(theme.subject);

  const built = tpl.build({ theme, tema, brand, vertical: format === 'vertical' });

  const hookScene: SceneSpec = {
    type: 'title',
    eyebrow: built.hook.eyebrow,
    title: built.hook.title,
    subtitle: built.hook.subtitle,
    narration: built.hook.narration,
    caption: built.hook.caption,
  };

  const content = input.userScenes && input.userScenes.length ? input.userScenes : built.content;

  const ctaScene: SceneSpec = {
    type: 'cta',
    narration: ctaNarration(brand),
    caption: brand.instagram,
    transIn: 'fadeBlack',
  };

  const scenes = decorateTransitions([hookScene, ...content, ctaScene]);

  return {
    titulo: theme.titulo,
    tema,
    tipo,
    format,
    brand: brand.id,
    hook: built.hook.narration,
    promise: built.promise,
    scenes,
  };
}

/** Lista de textos de narração na ordem das cenas (para o pipeline de TTS). */
export function narrationTexts(script: ScriptSpec): string[] {
  return script.scenes.map((s) => s.narration);
}
