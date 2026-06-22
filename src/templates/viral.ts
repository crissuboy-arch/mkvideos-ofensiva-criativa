// Templates de engajamento: tiktok-viral, curiosidades, autoridade.
// Hook em 1 segundo, loop aberto, payoff rápido — desenhados para retenção.

import type { VideoTemplate, BuildCtx, BuildResult } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { pick, lower, fillT, cap, mk, CURIOSITY } from './phrases.js';

export const tiktokViral: VideoTemplate = {
  tipo: 'tiktok-viral',
  label: 'TikTok viral',
  defaultScenes: 3,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const points = Math.max(Math.min(theme.n, 4), 2);
    const bullets = Array.from({ length: points }, (_, i) => pick([
      'O que ninguém faz (e devia)',
      'O erro que parece certo',
      'O atalho que poucos conhecem',
      'A parte que muda tudo',
    ], i));
    const content: SceneSpec[] = [
      mk({ type: 'lead', eyebrow: 'Olha isso', title: 'Você faz isso errado.', desc: 'Provavelmente sem perceber — e é rápido de consertar.', narration: 'Provavelmente você faz isso errado e nem percebe. E é rápido de consertar. Olha só.', caption: 'Você faz errado' }),
      mk({ type: 'bullets', title: 'Em 3 segundos', bullets, narration: 'Em segundos: o que ninguém faz, o erro que parece certo, e o atalho que vira o jogo.', caption: 'Rapidinho' }),
      mk({ type: 'illus', title: 'É isso.', subtitle: 'simples assim', desc: 'Testa hoje e me conta.', narration: 'Pronto. Simples assim. Testa hoje e volta aqui pra me contar.', caption: 'É isso' }),
    ];
    return {
      promise: 'Um insight rápido que você vai querer testar agora.',
      hook: {
        eyebrow: tema || 'Espera',
        title: cap(theme.titulo),
        subtitle: 'não pula',
        narration: fillT(pick([
          'Para. Não pula esse. {t} em 15 segundos.',
          'Se você só assistir um vídeo hoje, que seja esse sobre {t}.',
          'Ninguém te falou isso sobre {t} — e muda tudo.',
          'Espera 3 segundos. O final desse sobre {t} vale a pena.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Segue que todo dia tem um desses. E manda pra um amigo.',
    };
  },
};

export const curiosidades: VideoTemplate = {
  tipo: 'curiosidades',
  label: 'Curiosidades',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const n = Math.max(Math.min(theme.n, 5), 3);
    const FACT = [
      'Esse aqui quase ninguém sabe.',
      'O número desse vai te assustar.',
      'Parece mentira, mas é real.',
      'Esse muda como você enxerga o assunto.',
      'Guarda esse pra contar pra alguém depois.',
    ];
    const content: SceneSpec[] = Array.from({ length: n }, (_, i) => mk({
      type: 'topic', index: i + 1, title: `Curiosidade ${i + 1}`, desc: pick(FACT, i),
      narration: `Número ${i + 1}: ${pick(FACT, i)} ${pick(CURIOSITY, i)}`,
      caption: `Curiosidade ${i + 1}`,
    }));
    content.push(mk({ type: 'illus', title: '🤯', subtitle: 'qual te pegou?', desc: 'Comenta o número que mais te surpreendeu.', narration: 'E aí, qual te pegou de surpresa? Comenta o número aqui embaixo.', caption: 'Qual te pegou?' }));
    return {
      promise: 'Fatos que vão mexer com a sua cabeça.',
      hook: {
        eyebrow: tema || 'Você sabia?',
        title: cap(theme.titulo),
        subtitle: 'o número 3 choca',
        narration: fillT(pick([
          'Aposto que você não sabia disso sobre {t}. Principalmente a número 3.',
          '{t} guarda segredos que quase ninguém conhece. Bora pros fatos.',
          'Esses fatos sobre {t} vão te deixar de queixo caído. Fica até o fim.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Segue pra ficar mais inteligente todo dia. E compartilha esse.',
    };
  },
};

export const autoridade: VideoTemplate = {
  tipo: 'autoridade',
  label: 'Autoridade',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const content: SceneSpec[] = [
      mk({ type: 'lead', eyebrow: 'Opinião impopular', title: 'Quase todo mundo erra nisso.', desc: 'E erra justamente por seguir o conselho mais repetido da internet.', narration: 'Vou ser direto: quase todo mundo erra nisso. E erra seguindo o conselho mais repetido por aí.', caption: 'Opinião impopular' }),
      mk({ type: 'bullets', eyebrow: 'O que funciona', title: 'O que eu faço diferente', bullets: ['Foco no que move o ponteiro', 'Menos teoria, mais decisão', 'Constância acima de motivação'], narration: 'Na prática, eu foco no que move o ponteiro, decido rápido e mantenho constância. Sem fórmula mágica.', caption: 'O método' }),
      mk({ type: 'proof', title: 'Por que me ouvir', proof: [{ stat: '8 anos', label: 'no jogo' }, { stat: '+500', label: 'casos na prática' }, { stat: '0', label: 'atalho mágico' }], narration: 'Não é teoria de quem nunca fez: são anos de prática e centenas de casos reais.', caption: 'Credibilidade' }),
      mk({ type: 'lead', eyebrow: 'Resumo', title: 'Simples — não fácil.', desc: 'O caminho é claro. Só exige você parar de adiar.', narration: 'O caminho é simples. Não é fácil. A diferença é parar de adiar.', caption: 'Resumo' }),
    ];
    return {
      promise: 'A visão de quem realmente faz — sem hype.',
      hook: {
        eyebrow: tema || 'Direto',
        title: cap(theme.titulo),
        subtitle: 'sem hype',
        narration: fillT(pick([
          'Opinião impopular sobre {t}: o que te vendem como verdade está te travando.',
          'Depois de anos com {t}, posso afirmar: quase tudo que falam por aí está errado.',
          'Vou te poupar 5 anos de erro com {t}. Presta atenção.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Se isso te abriu a cabeça, me segue. Aqui é direto, sem enrolação.',
    };
  },
};
