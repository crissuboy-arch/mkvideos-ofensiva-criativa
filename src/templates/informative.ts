// Templates informativos: explicativo, curso, tutorial.
// Ganchos fortes, anáfora (anti-repetição do tema), curiosidade/tensão, CTA natural.

import type { VideoTemplate, BuildCtx, BuildResult } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { pick, lower, fillT, cap, kindLabel, mk, CURIOSITY, TENSION, CTA_BRIDGES } from './phrases.js';

const CONCEITO = ['O fundamento', 'Como funciona de verdade', 'O ponto que vira a chave', 'Onde quase todo mundo erra', 'Como aplicar hoje', 'Pra ir além'];
const PINGPONG = [...CURIOSITY, ...TENSION];

function topicTitle(kind: string | undefined, i: number): string {
  return kind ? `${cap(kind)} ${i}` : pick(CONCEITO, i - 1);
}

const recapLead = (): SceneSpec => mk({
  type: 'lead', eyebrow: 'Resumo',
  title: 'Você já tem o mapa.',
  desc: 'Agora é aplicar um passo de cada vez — e não parar no primeiro tropeço.',
  narration: 'Recapitulando rápido: o mapa tá na sua mão. Aplica um passo de cada vez e a diferença aparece.',
  caption: 'Resumo',
});

export const explicativo: VideoTemplate = {
  tipo: 'explicativo',
  label: 'Explicativo',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const HOOKS = [
      'Para de rolar. Em menos de um minuto você sai daqui entendendo {t} de um jeito que ninguém te explicou.',
      'Todo mundo fala de {t} — mas quase ninguém entende a parte que realmente importa.',
      'Se {t} sempre te confundiu, presta atenção: o problema não é você, é como te ensinaram.',
      'Existe um jeito simples de sacar {t}. E é quase o oposto do que parece.',
    ];
    const content: SceneSpec[] = [];
    for (let i = 1; i <= theme.n; i++) {
      const title = topicTitle(theme.kind, i);
      content.push(mk({
        type: 'topic', index: i, title, desc: pick(PINGPONG, i - 1),
        narration: i === 1
          ? `Primeiro, o essencial. ${title}: ${pick(CURIOSITY, i - 1)}`
          : `${kindLabel(theme.kind)} ${i}: ${title}. ${pick(PINGPONG, i - 1)}`,
        caption: title,
      }));
    }
    content.push(recapLead());
    return {
      promise: `Entender ${t} de verdade — sem enrolação.`,
      hook: {
        eyebrow: tema,
        title: cap(theme.titulo),
        subtitle: 'Fica até o fim',
        narration: fillT(pick(HOOKS, s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: pick(CTA_BRIDGES, s),
    };
  },
};

export const curso: VideoTemplate = {
  tipo: 'curso',
  label: 'Curso / Aula',
  defaultScenes: 5,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const stepCount = Math.max(theme.n, 3);
    const steps = Array.from({ length: stepCount }, (_, i) => ({
      title: theme.kind ? `${cap(theme.kind)} ${i + 1}` : `Etapa ${i + 1}`,
      desc: pick(PINGPONG, i),
    }));
    const content: SceneSpec[] = [
      mk({
        type: 'bullets', eyebrow: 'Nesta aula', title: 'O que você sai sabendo',
        bullets: ['O conceito — e por que importa', 'Como aplicar na prática', 'Os erros que travam todo mundo'],
        narration: 'Em três blocos: o conceito, a prática e os erros que mais travam. Sem encher linguiça.',
        caption: 'Objetivos da aula',
      }),
      mk({
        type: 'steps', title: 'O passo a passo', steps,
        narration: 'Agora o passo a passo, na ordem certa, pra você conseguir reproduzir sozinho.',
        caption: 'Passo a passo',
      }),
      mk({
        type: 'term', eyebrow: 'guarda isso',
        term: { word: cap(theme.subject).split(' ')[0], definition: 'O conceito central que sustenta tudo que vimos.' },
        narration: 'Esse conceito é a base. Entendeu ele, o resto encaixa.',
        caption: 'Conceito-chave',
      }),
      recapLead(),
    ];
    return {
      promise: `Dominar ${t} do zero ao avançado nesta aula.`,
      hook: {
        eyebrow: tema || 'Aula',
        title: cap(theme.titulo),
        subtitle: 'Aula prática',
        narration: fillT(pick([
          'Essa é a aula que eu queria ter assistido quando comecei com {t}.',
          'Se você quer aprender {t} do jeito certo, senta que a aula vai começar.',
          'Em poucos minutos você sai do zero ao avançado em {t}. Bora.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Quer a próxima aula? Me segue que tem mais.',
    };
  },
};

export const tutorial: VideoTemplate = {
  tipo: 'tutorial',
  label: 'Tutorial',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const stepCount = Math.max(theme.n, 3);
    const steps = Array.from({ length: stepCount }, (_, i) => ({ title: `Passo ${i + 1}`, desc: pick(PINGPONG, i) }));
    const content: SceneSpec[] = [
      mk({
        type: 'steps', eyebrow: 'Passo a passo', title: 'Faz junto comigo', steps,
        narration: 'Faz junto comigo, na ordem. Se travar, é só voltar um passo.',
        caption: 'Passo a passo',
      }),
      mk({
        type: 'lead', eyebrow: 'Dica de ouro', title: 'O atalho que poupa seu tempo',
        desc: 'Quando empacar, confira o passo anterior antes de seguir — quase sempre o erro está ali.',
        narration: 'Dica de ouro: quando empacar, volta um passo. Quase sempre o erro tá ali.',
        caption: 'Dica de ouro',
      }),
    ];
    return {
      promise: `Conseguir ${t} hoje mesmo, seguindo o passo a passo.`,
      hook: {
        eyebrow: tema || 'Tutorial',
        title: cap(theme.titulo),
        subtitle: 'Salva pra fazer depois',
        narration: fillT(pick([
          'Salva esse vídeo: é o passo a passo de {t} que funciona de verdade.',
          'Quer {t} sem se perder no caminho? Faz exatamente isso aqui.',
          'Em poucos passos você consegue {t}. Vou te mostrar do jeito mais simples.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Deu certo? Salva e me segue pra mais tutoriais assim.',
    };
  },
};
