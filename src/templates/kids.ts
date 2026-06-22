// Templates criativos: bonequinhas-3d (showcase/how-to) e historias-infantis.
// Tom leve; CTA suave (sem venda agressiva), ideal para esses nichos.

import type { VideoTemplate, BuildCtx, BuildResult } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { pick, lower, fillT, cap, mk } from './phrases.js';

export const bonequinhas3d: VideoTemplate = {
  tipo: 'bonequinhas-3d',
  label: 'Bonequinhas 3D',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const steps = [
      { title: 'Escolha o personagem', desc: 'Defina estilo, roupa e pose.' },
      { title: 'Monte o prompt', desc: 'Descreva detalhes: 3D, fofo, iluminação suave.' },
      { title: 'Gere e ajuste', desc: 'Refina até ficar do seu jeitinho.' },
    ];
    const content: SceneSpec[] = [
      mk({ type: 'steps', eyebrow: 'Passo a passo', title: 'Como eu faço', steps, narration: 'É mais fácil do que parece: escolhe o personagem, monta o prompt com os detalhes e gera. Depois é só ajustar.', caption: 'Como fazer' }),
      mk({ type: 'illus', title: 'Olha que fofo!', subtitle: 'ficou perfeita', desc: 'Resultado em minutos.', narration: 'Olha que fofura ficou. E foi em poucos minutos, do jeitinho que eu queria.', caption: 'Resultado' }),
    ];
    return {
      promise: 'O passo a passo pra criar a sua — rapidinho.',
      hook: {
        eyebrow: tema || 'Bonequinha 3D',
        title: cap(theme.titulo),
        subtitle: 'olha que fofa',
        narration: fillT(pick([
          'Olha que bonequinha 3D eu fiz: {t}. E você também consegue — te mostro como.',
          'Todo mundo pediu o passo a passo de {t}. Chegou a hora.',
          'Em poucos minutos dá pra criar {t} em 3D. Vem que eu te ensino.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Faz a sua e me marca! E segue que todo dia tem uma nova.',
    };
  },
};

export const historiasInfantis: VideoTemplate = {
  tipo: 'historias-infantis',
  label: 'Histórias infantis',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const beatCount = Math.max(Math.min(theme.n - 1, 3), 2);
    const BEAT_T = ['O início', 'A aventura', 'O perigo'];
    const BEAT_N = [
      'Num lugar bem distante, tudo era calmo e feliz.',
      'Até que um dia, surgiu uma grande aventura pela frente.',
      'Mas no caminho apareceu um perigo — e foi preciso muita coragem.',
    ];
    const beats: SceneSpec[] = Array.from({ length: beatCount }, (_, i) => mk({
      type: 'topic', index: i + 1, title: pick(BEAT_T, i), desc: pick(BEAT_N, i),
      narration: pick(BEAT_N, i),
      caption: pick(BEAT_T, i),
    }));
    const content: SceneSpec[] = [
      mk({ type: 'lead', eyebrow: 'Era uma vez', title: 'Bem, bem distante…', desc: 'Onde nossa história começa.', narration: 'Era uma vez, num lugar bem, bem distante, onde a nossa história vai começar.', caption: 'Era uma vez' }),
      ...beats,
      mk({ type: 'lead', eyebrow: 'A lição', title: 'E todos aprenderam…', desc: 'Que ser gentil e corajoso vale a pena.', narration: 'E assim todos aprenderam que ser gentil e corajoso sempre vale a pena.', caption: 'A lição' }),
    ];
    return {
      promise: 'Uma historinha cheia de aventura e uma lição no final.',
      hook: {
        eyebrow: tema || 'Historinha',
        title: cap(theme.titulo),
        subtitle: 'pra toda a família',
        narration: fillT(pick([
          'Quer ouvir uma historinha sobre {t}? Então chega mais perto.',
          'Hoje a história é sobre {t}. Prepara a pipoca e vem!',
          'Era uma vez uma aventura sobre {t}. Vamos juntos?',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Gostou? Amanhã tem outra historinha. É só seguir!',
    };
  },
};
