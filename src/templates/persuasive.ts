// Templates persuasivos: vendas, anúncio.
// Arco de oferta (problema → benefício → prova → oferta) gerado offline.

import type { VideoTemplate, BuildCtx, BuildResult } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { cap, mk } from './phrases.js';

function benefits(subject: string, n: number): string[] {
  const bank = [
    `Resolve ${subject} sem complicação`,
    'Economiza horas toda semana',
    'Resultado que dá pra ver',
    'Passo a passo e suporte de verdade',
    'Funciona mesmo começando do zero',
  ];
  return bank.slice(0, Math.min(Math.max(n, 3), bank.length));
}

const PROOF: { stat: string; label: string }[] = [
  { stat: '+1.200', label: 'clientes atendidos' },
  { stat: '4,9★', label: 'avaliação média' },
  { stat: '30 dias', label: 'garantia total' },
];

function offerScene(subject: string): SceneSpec {
  return mk({
    type: 'offer', title: 'Oferta de hoje',
    offer: {
      was: 'De R$ 497',
      price: 'R$ 97',
      items: ['Acesso completo', 'Bônus exclusivos', 'Garantia de 30 dias'],
      urgency: 'Vagas limitadas',
    },
    narration: `Por tempo limitado, você leva tudo o que precisa pra ${subject} por um valor simbólico. As vagas são limitadas.`,
    caption: 'Oferta de hoje',
  });
}

export const vendas: VideoTemplate = {
  tipo: 'vendas',
  label: 'Vendas',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const subject = theme.subject;
    const promise = `Existe um jeito mais simples de ${subject} — e ele cabe no seu dia.`;
    const content: SceneSpec[] = [
      mk({
        type: 'lead', eyebrow: 'O problema', title: `Cansado de tentar ${subject} e travar?`,
        desc: 'Você tenta, perde tempo e o resultado não vem. O problema não é você — é o método.',
        narration: `Você tenta ${subject}, perde tempo, e o resultado não vem. O problema não é você, é o método.`,
        caption: 'O problema',
      }),
      mk({
        type: 'bullets', eyebrow: 'O que você ganha', title: 'Por que isso funciona',
        bullets: benefits(subject, theme.n),
        narration: `Veja o que muda: ${benefits(subject, theme.n).join(', ')}.`,
        caption: 'O que você ganha',
      }),
      mk({
        type: 'proof', title: 'Quem já usou, aprova', proof: PROOF,
        narration: 'Não é promessa: são mais de mil clientes, avaliação quase perfeita e garantia total.',
        caption: 'Prova social',
      }),
      offerScene(subject),
    ];
    return {
      promise,
      hook: {
        eyebrow: tema || 'Atenção',
        title: cap(theme.titulo),
        subtitle: 'Assiste até o fim',
        narration: `${theme.titulo}. ${promise} Assiste até o fim.`,
        caption: theme.titulo,
      },
      content,
    };
  },
};

export const anuncio: VideoTemplate = {
  tipo: 'anuncio',
  label: 'Anúncio',
  defaultScenes: 3,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const subject = theme.subject;
    const promise = `${cap(subject)} ficou fácil. E começa agora.`;
    const content: SceneSpec[] = [
      mk({
        type: 'lead', eyebrow: 'Pra você que…', title: `Quer ${subject} sem enrolação?`,
        desc: 'Direto ao ponto, do jeito que cabe na sua rotina.',
        narration: `Pra você que quer ${subject} sem enrolação: chegou a forma mais direta de conseguir.`,
        caption: 'A promessa',
      }),
      mk({
        type: 'proof', proof: PROOF,
        narration: 'Mais de mil clientes, avaliação quase perfeita e garantia. A escolha é simples.',
        caption: 'Prova',
      }),
      offerScene(subject),
    ];
    return {
      promise,
      hook: {
        eyebrow: tema || 'Novo',
        title: cap(theme.titulo),
        subtitle: undefined,
        narration: `${theme.titulo}. ${promise}`,
        caption: theme.titulo,
      },
      content,
    };
  },
};
