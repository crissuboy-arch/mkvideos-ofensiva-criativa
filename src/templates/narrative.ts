// Templates narrativos: storytelling, motivacional, novela-curta.
// Arco emocional com tensão crescente, virada e fecho — alta retenção.

import type { VideoTemplate, BuildCtx, BuildResult } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { pick, lower, fillT, cap, mk } from './phrases.js';

export const storytelling: VideoTemplate = {
  tipo: 'storytelling',
  label: 'Storytelling',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const beatCount = Math.max(Math.min(theme.n - 2, 3), 1);
    const BEAT_TITLE = ['O começo', 'O conflito', 'A escolha'];
    const BEAT_NARR = [
      'No começo, nada fazia sentido. Cada tentativa parecia um passo pra trás.',
      'Aí veio o momento em que quase tudo desabou — e desistir parecia o mais fácil.',
      'Foi uma escolha simples que mudou a direção. Pequena, mas decisiva.',
    ];
    const beats: SceneSpec[] = Array.from({ length: beatCount }, (_, i) => mk({
      type: 'topic', index: i + 1, title: pick(BEAT_TITLE, i), desc: pick(BEAT_NARR, i).split('.')[0] + '.',
      narration: pick(BEAT_NARR, i),
      caption: pick(BEAT_TITLE, i),
    }));
    const content: SceneSpec[] = [
      mk({ type: 'lead', eyebrow: 'A cena', title: 'Sem garantias, só vontade.', desc: 'Nenhum atalho, nenhuma certeza — apenas a teimosia de tentar mais uma vez.', narration: 'Não tinha garantia nenhuma. Só a teimosia de tentar mais uma vez.', caption: 'A cena' }),
      ...beats,
      mk({ type: 'illus', title: 'A virada', subtitle: 'foi aqui', desc: 'O instante em que tudo mudou de lugar.', narration: 'E então veio a virada. O instante em que tudo mudou de lugar.', caption: 'A virada' }),
      mk({ type: 'lead', eyebrow: 'A moral', title: 'A lição que ficou', desc: 'Comece pequeno, seja consistente e não pare no primeiro não.', narration: 'A lição? Comece pequeno, seja consistente e não pare no primeiro não.', caption: 'A moral' }),
    ];
    return {
      promise: 'Uma história curta — e o que ela ensina.',
      hook: {
        eyebrow: tema || 'História',
        title: cap(theme.titulo),
        subtitle: 'Fica até o fim',
        narration: fillT(pick([
          'Essa história sobre {t} parece comum — até a parte que ninguém espera.',
          'Tudo começou com {t}. O que veio depois eu não imaginava.',
          'Tem uma virada nessa história de {t} que talvez mude como você pensa.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Se essa história te tocou, deixa um comentário e segue pra próxima.',
    };
  },
};

export const motivacional: VideoTemplate = {
  tipo: 'motivacional',
  label: 'Motivacional',
  defaultScenes: 3,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const content: SceneSpec[] = [
      mk({ type: 'illus', title: 'Comece.', subtitle: 'agora, não amanhã', desc: 'O melhor momento já passou. O segundo melhor é agora.', narration: 'O melhor momento pra começar já passou. O segundo melhor momento é agora.', caption: 'Comece agora' }),
      mk({ type: 'quote', quote: { text: 'Disciplina é continuar mesmo quando a vontade já foi embora.', author: 'Lembrete' }, narration: 'Disciplina é continuar mesmo quando a vontade já foi embora. É isso que separa quem fala de quem faz.', caption: 'Disciplina' }),
      mk({ type: 'lead', eyebrow: 'A virada', title: 'Você está mais perto do que pensa.', desc: 'Um passo por dia, e em um mês você não se reconhece.', narration: 'Você está mais perto do que pensa. Um passo por dia, e em um mês você não se reconhece.', caption: 'A mensagem' }),
    ];
    return {
      promise: 'Um empurrão pra você agir hoje.',
      hook: {
        eyebrow: tema || 'Pra hoje',
        title: cap(theme.titulo),
        subtitle: 'Respira e assiste',
        narration: fillT(pick([
          'Se você precisava de um sinal sobre {t}, é esse aqui. Respira e assiste.',
          'Ninguém vai fazer por você. {t} começa no próximo minuto.',
          'Lê isso devagar: {t} não depende de sorte, depende do próximo passo.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Salva pra reler nos dias difíceis. E me segue pra mais.',
    };
  },
};

export const novelaCurta: VideoTemplate = {
  tipo: 'novela-curta',
  label: 'Novela curta',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const beatCount = Math.max(Math.min(theme.n - 1, 4), 2);
    const SCENE_T = ['Capítulo 1', 'O segredo', 'A traição', 'O reencontro'];
    const SCENE_N = [
      'Tudo parecia perfeito naquela noite. Parecia.',
      'Foi quando uma mensagem mudou tudo — e ninguém estava preparado.',
      'A verdade veio à tona da pior forma possível.',
      'No fim, o destino tinha um último plano guardado.',
    ];
    const beats: SceneSpec[] = Array.from({ length: beatCount }, (_, i) => mk({
      type: 'topic', index: i + 1, title: pick(SCENE_T, i), desc: pick(SCENE_N, i),
      narration: pick(SCENE_N, i),
      caption: pick(SCENE_T, i),
      transIn: i === beatCount - 1 ? 'zoom' : undefined,
    }));
    const content: SceneSpec[] = [
      ...beats,
      mk({ type: 'illus', title: 'Continua…', subtitle: 'parte 2 em breve', desc: 'A próxima vira a sua cabeça.', narration: 'E essa história ainda não acabou. A próxima parte vira sua cabeça.', caption: 'Continua…' }),
    ];
    return {
      promise: 'Uma história curta de virar o estômago — em poucos minutos.',
      hook: {
        eyebrow: tema || 'Novela',
        title: cap(theme.titulo),
        subtitle: 'Não pula nada',
        narration: fillT(pick([
          'Ninguém imaginava como essa história de {t} ia terminar. Não pula nada.',
          'Essa novela de {t} tem uma virada nos últimos segundos. Fica até o fim.',
          'O que aconteceu envolvendo {t} ninguém viu chegando.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Quer a parte 2? Comenta "2" e me segue pra não perder.',
    };
  },
};
