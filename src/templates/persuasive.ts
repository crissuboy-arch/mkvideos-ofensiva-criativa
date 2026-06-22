// Templates persuasivos: vendas, anúncio, produto-digital.
// Arco problema → desejo → prova → oferta. Benefícios sem repetir o tema literal.

import type { VideoTemplate, BuildCtx, BuildResult } from './types.js';
import type { SceneSpec } from '../specs/types.js';
import { pick, lower, fillT, cap, mk } from './phrases.js';

// Benefícios genéricos por RESULTADO (não injetam o tema → zero repetição).
const BENEFITS = [
  'Resultado em dias, não em meses',
  'Sem precisar começar do zero',
  'Passo a passo, do básico ao avançado',
  'Funciona mesmo na correria do dia a dia',
  'Suporte de verdade quando você travar',
];

const PROOF: { stat: string; label: string }[] = [
  { stat: '+1.200', label: 'pessoas já aplicaram' },
  { stat: '4,9★', label: 'avaliação média' },
  { stat: '30 dias', label: 'de garantia' },
];

function offerScene(): SceneSpec {
  return mk({
    type: 'offer', title: 'Só hoje',
    offer: { was: 'De R$ 497', price: 'R$ 97', items: ['Acesso completo', 'Bônus exclusivos', 'Garantia de 30 dias'], urgency: 'Vagas limitadas' },
    narration: 'Hoje você entra por um valor simbólico, com tudo incluso e garantia. Mas as vagas fecham rápido.',
    caption: 'Oferta de hoje',
  });
}

export const vendas: VideoTemplate = {
  tipo: 'vendas',
  label: 'Vendas',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const content: SceneSpec[] = [
      mk({
        type: 'lead', eyebrow: 'A real', title: 'O problema não é você.',
        desc: 'Você tenta, se esforça, e o resultado não vem. Faltou o método certo — não força de vontade.',
        narration: 'Se você se esforça e o resultado não vem, o problema não é você. É o método. E isso tem conserto.',
        caption: 'O problema',
      }),
      mk({
        type: 'bullets', eyebrow: 'O que muda', title: 'Por que isso funciona',
        bullets: BENEFITS.slice(0, Math.min(Math.max(theme.n, 3), BENEFITS.length)),
        narration: 'Olha o que muda na prática: resultado mais rápido, sem começar do zero, com um caminho claro pra seguir.',
        caption: 'O que você ganha',
      }),
      mk({
        type: 'proof', title: 'Quem aplicou, aprova', proof: PROOF,
        narration: 'E não é promessa: mais de mil pessoas já aplicaram, com nota quase perfeita e garantia.',
        caption: 'Prova social',
      }),
      offerScene(),
    ];
    return {
      promise: `Um caminho mais simples pra ${t} — que cabe na sua rotina.`,
      hook: {
        eyebrow: tema || 'Atenção',
        title: cap(theme.titulo),
        subtitle: 'Assiste até o fim',
        narration: fillT(pick([
          'Se você já tentou {t} e travou, esse vídeo vai doer — no bom sentido.',
          'Para tudo: tem um jeito mais simples de {t}, e ninguém te contou.',
          'Você está a um método de distância de {t}. Assiste até o fim.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'O link tá aqui embaixo. Mas decide rápido — vaga limitada é vaga limitada.',
    };
  },
};

export const anuncio: VideoTemplate = {
  tipo: 'anuncio',
  label: 'Anúncio',
  defaultScenes: 3,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const content: SceneSpec[] = [
      mk({
        type: 'lead', eyebrow: 'Pra você que…', title: 'Chega de complicar.',
        desc: 'A forma mais direta — do jeito que cabe na sua rotina.',
        narration: 'Chega de complicar. Esse é o caminho mais direto, do jeito que cabe no seu dia.',
        caption: 'A promessa',
      }),
      mk({ type: 'proof', proof: PROOF, narration: 'Mais de mil pessoas, nota quase perfeita, garantia. A escolha fica fácil.', caption: 'Prova' }),
      offerScene(),
    ];
    return {
      promise: `${cap(t)} ficou simples — e começa agora.`,
      hook: {
        eyebrow: tema || 'Novo',
        title: cap(theme.titulo),
        subtitle: undefined,
        narration: fillT(pick([
          'Quer {t} sem enrolação? Chegou a forma mais direta.',
          'Isso aqui muda {t} pra você. E começa agora.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Toca no link e garante o seu antes de fechar.',
    };
  },
};

export const produtoDigital: VideoTemplate = {
  tipo: 'produto-digital',
  label: 'Produto digital',
  defaultScenes: 4,
  build(ctx: BuildCtx): BuildResult {
    const { theme, tema } = ctx;
    const t = lower(theme.subject);
    const s = theme.titulo.length;
    const content: SceneSpec[] = [
      mk({
        type: 'lead', eyebrow: 'Imagina', title: 'E se fosse simples?',
        desc: 'Tudo organizado, no seu ritmo, sem ficar caçando informação solta na internet.',
        narration: 'Imagina ter tudo organizado, no seu ritmo, sem caçar informação solta por aí. É isso aqui.',
        caption: 'A promessa',
      }),
      mk({
        type: 'cards', eyebrow: 'O que tem dentro', title: 'O que você recebe',
        cards: [
          { title: 'Aulas diretas', desc: 'Sem enrolação, só o que aplica.' },
          { title: 'Materiais prontos', desc: 'Modelos pra usar hoje.' },
          { title: 'Comunidade', desc: 'Pra não travar sozinho.' },
        ],
        narration: 'Por dentro: aulas diretas, materiais prontos pra usar e uma comunidade pra você nunca travar sozinho.',
        caption: 'O que vem dentro',
      }),
      mk({ type: 'proof', title: 'Resultados reais', proof: PROOF, narration: 'Os números falam: mais de mil alunos, nota quase perfeita e garantia total.', caption: 'Resultados' }),
      offerScene(),
    ];
    return {
      promise: `Tudo o que você precisa pra ${t}, num lugar só.`,
      hook: {
        eyebrow: tema || 'Lançamento',
        title: cap(theme.titulo),
        subtitle: 'Acesso imediato',
        narration: fillT(pick([
          'E se {t} estivesse a um clique de distância, tudo no mesmo lugar?',
          'Cansou de juntar pedaço de informação pra {t}? Eu organizei tudo pra você.',
          'O atalho pra {t} existe — e cabe na palma da sua mão.',
        ], s), t),
        caption: theme.titulo,
      },
      content,
      ctaBridge: 'Link na bio. Entra hoje que o bônus é por tempo limitado.',
    };
  },
};
