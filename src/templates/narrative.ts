// Templates narrativos: storytelling, motivacional.
// Arco emocional (contexto → conflito → virada → mensagem) gerado offline.

import type { VideoTemplate, BuildCtx, BuildResult } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { pick, cap, mk } from './phrases.js';

const BEATS = [
  'No começo, nada fazia sentido.',
  'Cada tentativa parecia um passo pra trás.',
  'Foi quando uma escolha simples mudou a direção.',
  'O que parecia o fim era só o começo.',
];

export const storytelling: VideoTemplate = {
  tipo: 'storytelling',
  label: 'Storytelling',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const subject = theme.subject;
    const promise = `Uma história curta sobre ${subject} — e o que ela ensina.`;
    const beatCount = Math.max(Math.min(theme.n - 2, 3), 1);
    const beats: SceneSpec[] = Array.from({ length: beatCount }, (_, i) => mk({
      type: 'topic', index: i + 1, title: pick(['O começo', 'O conflito', 'A escolha'], i),
      desc: pick(BEATS, i),
      narration: pick(BEATS, i),
      caption: pick(['O começo', 'O conflito', 'A escolha'], i),
    }));
    const content: SceneSpec[] = [
      mk({
        type: 'lead', eyebrow: 'A cena', title: `Tudo começou com ${subject}.`,
        desc: 'Sem garantias, sem atalhos — só vontade de fazer dar certo.',
        narration: `Tudo começou com ${subject}. Sem garantias, sem atalhos, só vontade de fazer dar certo.`,
        caption: 'A cena',
      }),
      ...beats,
      mk({
        type: 'illus', title: 'A virada', subtitle: 'foi aqui',
        desc: 'O momento em que tudo mudou.',
        narration: 'E então veio a virada — o momento em que tudo mudou.',
        caption: 'A virada',
      }),
      mk({
        type: 'lead', eyebrow: 'A moral', title: 'O que essa história ensina',
        desc: 'Comece pequeno, seja consistente, e não pare no primeiro não.',
        narration: 'A moral é simples: comece pequeno, seja consistente, e não pare no primeiro não.',
        caption: 'A moral',
      }),
    ];
    return {
      promise,
      hook: {
        eyebrow: tema || 'História',
        title: cap(theme.titulo),
        subtitle: 'Fica até o fim',
        narration: `${theme.titulo}. ${promise}`,
        caption: theme.titulo,
      },
      content,
    };
  },
};

export const motivacional: VideoTemplate = {
  tipo: 'motivacional',
  label: 'Motivacional',
  defaultScenes: 3,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const subject = theme.subject;
    const promise = `Um empurrão pra você agir em ${subject} hoje.`;
    const content: SceneSpec[] = [
      mk({
        type: 'illus', title: 'Comece.', subtitle: 'agora, não amanhã',
        desc: 'O melhor momento já passou. O segundo melhor é agora.',
        narration: 'O melhor momento pra começar já passou. O segundo melhor momento é agora.',
        caption: 'Comece agora',
      }),
      mk({
        type: 'quote',
        quote: { text: `Disciplina é fazer ${subject} mesmo quando a vontade some.`, author: 'Lembrete diário' },
        narration: `Disciplina é fazer ${subject} mesmo quando a vontade some. É isso que separa quem fala de quem faz.`,
        caption: 'Disciplina',
      }),
      mk({
        type: 'lead', eyebrow: 'A mensagem', title: 'Você está mais perto do que pensa',
        desc: 'Um passo por dia, e em um mês você não se reconhece.',
        narration: 'Você está mais perto do que pensa. Um passo por dia, e em um mês você não se reconhece.',
        caption: 'A mensagem',
      }),
    ];
    return {
      promise,
      hook: {
        eyebrow: tema || 'Pra hoje',
        title: cap(theme.titulo),
        subtitle: 'Respira e assiste',
        narration: `${theme.titulo}. ${promise}`,
        caption: theme.titulo,
      },
      content,
    };
  },
};
