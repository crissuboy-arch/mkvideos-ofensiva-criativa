// Templates informativos: explicativo, curso, tutorial.
// Geram um arco didático offline a partir do tema (assunto + nº de cenas).

import type { VideoTemplate, BuildCtx, BuildResult } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { pick, kindLabel, cap, mk } from './phrases.js';

const CONCEITO = ['O princípio', 'Como funciona', 'O ponto-chave', 'Na prática', 'Onde aplicar', 'Indo além'];
const DESC = [
  'É aqui que a maioria trava — e onde está a maior parte do resultado.',
  'Parece simples, mas muda tudo quando você aplica de verdade.',
  'Esse é o detalhe que separa quem entende de quem só repete.',
  'Domine isto e o resto fica muito mais fácil.',
  'Poucos param pra pensar nisso, e é justamente o que faz diferença.',
  'Com isso no lugar, você ganha velocidade sem perder qualidade.',
];

function topicTitle(kind: string | undefined, i: number): string {
  return kind ? `${cap(kind)} ${i}` : pick(CONCEITO, i - 1);
}

function recap(subject: string): SceneSpec {
  return mk({
    type: 'lead',
    eyebrow: 'Resumo',
    title: `Agora você entende ${subject}.`,
    desc: 'Revê os pontos, aplica um de cada vez e compartilha com quem precisa.',
    narration: `Recapitulando: agora você entende ${subject}. Aplica um ponto de cada vez e a diferença aparece rápido.`,
    caption: 'Resumo',
  });
}

export const explicativo: VideoTemplate = {
  tipo: 'explicativo',
  label: 'Explicativo',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const subject = theme.subject;
    const promise = `Em poucos minutos você vai entender ${subject} de verdade.`;
    const content: SceneSpec[] = [];
    for (let i = 1; i <= theme.n; i++) {
      const title = topicTitle(theme.kind, i);
      content.push(mk({
        type: 'topic', index: i, title, desc: pick(DESC, i - 1),
        narration: `${kindLabel(theme.kind)} ${i}: ${title}. ${pick(DESC, i - 1)}`,
        caption: title,
      }));
    }
    content.push(recap(subject));
    return {
      promise,
      hook: {
        eyebrow: tema,
        title: cap(theme.titulo),
        subtitle: 'Salva esse vídeo',
        narration: `${theme.titulo}. ${promise} Salva esse vídeo pra não esquecer.`,
        caption: theme.titulo,
      },
      content,
    };
  },
};

export const curso: VideoTemplate = {
  tipo: 'curso',
  label: 'Curso / Aula',
  defaultScenes: 5,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const subject = theme.subject;
    const promise = `Ao final desta aula você vai dominar ${subject} do zero ao avançado.`;
    const stepCount = Math.max(theme.n, 3);
    const steps = Array.from({ length: stepCount }, (_, i) => ({
      title: theme.kind ? `${cap(theme.kind)} ${i + 1}` : `Etapa ${i + 1}`,
      desc: pick(DESC, i),
    }));
    const content: SceneSpec[] = [
      mk({
        type: 'bullets', eyebrow: 'Objetivos da aula', title: 'O que você vai aprender',
        bullets: ['O conceito e por que importa', 'Como aplicar na prática', 'Os erros mais comuns'],
        narration: `Nesta aula você vai aprender o conceito de ${subject}, como aplicar na prática e os erros mais comuns.`,
        caption: 'Objetivos da aula',
      }),
      mk({
        type: 'steps', title: 'O passo a passo', steps,
        narration: `Vamos pelo passo a passo, na ordem, pra você conseguir reproduzir ${subject} sozinho.`,
        caption: 'Passo a passo',
      }),
      mk({
        type: 'term', eyebrow: 'conceito-chave',
        term: { word: cap(subject).split(' ')[0], definition: `O conceito central que sustenta ${subject}.` },
        narration: `Guarda este conceito-chave: ele sustenta tudo o que vimos sobre ${subject}.`,
        caption: 'Conceito-chave',
      }),
      recap(subject),
    ];
    return {
      promise,
      hook: {
        eyebrow: tema || 'Aula',
        title: cap(theme.titulo),
        subtitle: 'Módulo prático',
        narration: `${theme.titulo}. ${promise}`,
        caption: theme.titulo,
      },
      content,
    };
  },
};

export const tutorial: VideoTemplate = {
  tipo: 'tutorial',
  label: 'Tutorial',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const subject = theme.subject;
    const promise = `Siga estes passos e você consegue ${subject} hoje mesmo.`;
    const stepCount = Math.max(theme.n, 3);
    const steps = Array.from({ length: stepCount }, (_, i) => ({
      title: `Passo ${i + 1}`,
      desc: pick(DESC, i),
    }));
    const content: SceneSpec[] = [
      mk({
        type: 'steps', eyebrow: 'Passo a passo', title: `Como ${subject}`, steps,
        narration: `Vou te mostrar o passo a passo pra ${subject}. Faz junto comigo.`,
        caption: `Como ${subject}`,
      }),
      mk({
        type: 'lead', eyebrow: 'Dica de ouro', title: 'O detalhe que poupa seu tempo',
        desc: 'Quando travar, volte um passo e confira o anterior antes de seguir.',
        narration: 'Uma dica de ouro: quando travar, volte um passo e confira o anterior antes de seguir.',
        caption: 'Dica de ouro',
      }),
    ];
    return {
      promise,
      hook: {
        eyebrow: tema || 'Tutorial',
        title: cap(theme.titulo),
        subtitle: 'Passo a passo',
        narration: `${theme.titulo}. ${promise}`,
        caption: theme.titulo,
      },
      content,
    };
  },
};
