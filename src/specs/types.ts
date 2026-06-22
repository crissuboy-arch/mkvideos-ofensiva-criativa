// Tipos de domínio do motor universal de vídeos.
// O "spec" é a fonte de verdade: tipo de vídeo + formato + marca + cenas.
// Tudo offline e determinístico — nenhum campo aqui depende de IA/rede.

/** Formato de saída. vertical = 9:16 (Reels/Shorts/TikTok); horizontal = 16:9 (YouTube/aula). */
export type Format = 'vertical' | 'horizontal';

/** Tipos universais de vídeo (cada um tem uma "receita" de arco em src/templates). */
export type VideoType =
  | 'tiktok-viral'
  | 'curiosidades'
  | 'storytelling'
  | 'novela-curta'
  | 'motivacional'
  | 'autoridade'
  | 'vendas'
  | 'produto-digital'
  | 'anuncio'
  | 'explicativo'
  | 'curso'
  | 'tutorial'
  | 'bonequinhas-3d'
  | 'historias-infantis';

export const VIDEO_TYPES: VideoType[] = [
  'tiktok-viral', 'curiosidades', 'storytelling', 'novela-curta', 'motivacional',
  'autoridade', 'vendas', 'produto-digital', 'anuncio', 'explicativo',
  'curso', 'tutorial', 'bonequinhas-3d', 'historias-infantis',
];

/** Tipos profissionais de cena (cada um é um renderer em src/scenes). */
export type SceneType =
  | 'title'    // abertura / hook
  | 'topic'    // tópico numerado / seção
  | 'lead'     // frase de impacto + apoio
  | 'bullets'  // lista de pontos
  | 'cards'    // 2–3 cartões lado a lado
  | 'steps'    // passos sequenciais
  | 'term'     // termo + definição (glossário)
  | 'compare'  // antes/depois, A vs B
  | 'illus'    // ilustração tipográfica / destaque grande
  | 'img'      // imagem em destaque (figure) + legenda
  | 'imgrow'   // fileira de imagens
  | 'quote'    // citação
  | 'proof'    // prova social / números
  | 'offer'    // oferta (preço, bônus, urgência)
  | 'cta';     // chamada final de marca

export const SCENE_TYPES: SceneType[] = [
  'title', 'topic', 'lead', 'bullets', 'cards', 'steps', 'term',
  'compare', 'illus', 'img', 'imgrow', 'quote', 'proof', 'offer', 'cta',
];

/** Transições entre cenas. fade = corte limpo (default); o resto é momento-chave. */
export type TransType = 'fade' | 'push' | 'slideUp' | 'zoom' | 'wipe' | 'fadeBlack';

export interface Dimensions {
  w: number;
  h: number;
  vertical: boolean;
}

// ─── conteúdo estruturado por cena ───────────────────────────────────────────

export interface CardItem { title: string; desc?: string; }
export interface StepItem { title: string; desc?: string; }
export interface ProofItem { stat: string; label: string; }
export interface CompareSide { title: string; items: string[]; }

export interface OfferData {
  price?: string;
  was?: string;       // preço "de" (riscado)
  items?: string[];   // o que inclui / bônus
  urgency?: string;   // linha de urgência
}

/**
 * Uma cena resolvida. Campos de conteúdo são opcionais — cada renderer lê só o
 * que precisa. `narration` vira WAV (TTS); `audio_dur` é preenchido pelo pipeline.
 */
export interface SceneSpec {
  type: SceneType;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  desc?: string;
  index?: number;            // numeração (topic/steps)
  total?: number;
  bullets?: string[];
  cards?: CardItem[];
  steps?: StepItem[];
  term?: { word: string; definition: string };
  compare?: { left: CompareSide; right: CompareSide };
  quote?: { text: string; author?: string };
  proof?: ProofItem[];
  offer?: OfferData;
  image?: string;            // caminho relativo (fundo de cena ou figura)
  images?: string[];         // fileira (imgrow)
  transIn?: TransType;       // transição de entrada (a cena que sai herda)
  narration: string;         // texto para o TTS
  caption: string;           // legenda de rodapé
  audio_dur?: number;        // duração real do WAV (ffprobe) — preenchida no pipeline
}

/**
 * Roteiro completo, pronto para virar vídeo. `scenes` já vem ordenado e inclui
 * o hook (primeira) e a CTA (última) — não há cenas "mágicas" fora da lista.
 */
export interface ScriptSpec {
  titulo: string;
  tema: string;
  tipo: VideoType;
  format: Format;
  brand: string;             // id da marca (ver src/brands)
  hook: string;              // gancho (texto de abertura — informativo/derivável)
  promise: string;           // promessa do vídeo
  scenes: SceneSpec[];       // hook + conteúdo + cta, em ordem
}
