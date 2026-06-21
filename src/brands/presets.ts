// Presets de marca prontos. 'ofensiva-criativa' é o default (a marca do dono).
// Os demais são pontos de partida — edite name/tagline/slogan/site no seu projeto.

import type { Brand } from './types.js';

// Trio de fontes locais padrão (baixadas por fetch-fonts; sempre @font-face local).
const FONTS = { title: 'Sora', body: 'Inter', mono: 'JetBrains Mono' } as const;

export const ofensivaCriativa: Brand = {
  id: 'ofensiva-criativa',
  name: 'OFENSIVA CRIATIVA',
  tagline: 'Marketing Sem Filtro',
  slogan: 'Ajudo marcas a incomodarem a concorrência',
  instagram: '@ofensivacriativa',
  site: 'links.ofensivacriativa.com',
  fonts: { ...FONTS },
  palette: {
    bg: '#0A0F1E', bg2: '#141B2D', bg3: '#2A3A5C',
    fg: '#F5F0E8', muted: '#8896B0',
    accent: '#C9A227', accent2: '#E8C84A', code: '#5BC8AF',
  },
};

export const cliente: Brand = {
  id: 'cliente',
  name: 'SUA MARCA',
  tagline: 'Sua Tagline Aqui',
  slogan: 'Descreva em uma linha o que a sua marca faz',
  instagram: '@suamarca',
  site: 'suamarca.com',
  fonts: { ...FONTS },
  palette: {
    bg: '#0B1220', bg2: '#131C2E', bg3: '#2B3A52',
    fg: '#EAF0F7', muted: '#8A99AE',
    accent: '#3B82F6', accent2: '#60A5FA', code: '#34D399',
  },
};

export const curso: Brand = {
  id: 'curso',
  name: 'SEU CURSO',
  tagline: 'Aprenda na Prática',
  slogan: 'Domine o tema do zero ao avançado',
  instagram: '@seucurso',
  site: 'seucurso.com.br',
  fonts: { ...FONTS },
  palette: {
    bg: '#0E1325', bg2: '#181F38', bg3: '#303A5C',
    fg: '#F2F4FA', muted: '#99A2BC',
    accent: '#2DD4BF', accent2: '#5EEAD4', code: '#FBBF24',
  },
};

export const produto: Brand = {
  id: 'produto',
  name: 'SEU PRODUTO',
  tagline: 'Lançamento',
  slogan: 'A ferramenta que resolve o seu problema',
  instagram: '@seuproduto',
  site: 'seuproduto.com',
  fonts: { ...FONTS },
  palette: {
    bg: '#0C0A1E', bg2: '#161330', bg3: '#2E2752',
    fg: '#F4F1FF', muted: '#A29CC4',
    accent: '#8B5CF6', accent2: '#06B6D4', code: '#22D3EE',
  },
};

export const darkPremium: Brand = {
  id: 'dark-premium',
  name: 'DARK PREMIUM',
  tagline: 'Premium',
  slogan: 'Estética premium para marcas exigentes',
  instagram: '@suamarca',
  site: 'suamarca.com',
  fonts: { ...FONTS },
  palette: {
    bg: '#07090D', bg2: '#11151C', bg3: '#232A36',
    fg: '#EDF1F5', muted: '#7E8794',
    accent: '#56CCF2', accent2: '#A0E9FF', code: '#7DD3FC',
  },
};

export const cleanBranco: Brand = {
  id: 'clean-branco',
  name: 'SUA MARCA',
  tagline: 'Clean',
  slogan: 'Simplicidade que comunica',
  instagram: '@suamarca',
  site: 'suamarca.com',
  light: true,
  fonts: { ...FONTS },
  palette: {
    bg: '#FFFFFF', bg2: '#F4F5F7', bg3: '#E2E5EA',
    fg: '#14181F', muted: '#5B6472',
    accent: '#2563EB', accent2: '#1D4ED8', code: '#059669',
  },
};

export const luxoDourado: Brand = {
  id: 'luxo-dourado',
  name: 'LUXO',
  tagline: 'Exclusivo',
  slogan: 'Sofisticação em cada detalhe',
  instagram: '@sualuxo',
  site: 'sualuxo.com',
  fonts: { ...FONTS },
  palette: {
    bg: '#0B0A07', bg2: '#16130C', bg3: '#3A3015',
    fg: '#F7F1E1', muted: '#A8987A',
    accent: '#D4AF37', accent2: '#F0D77B', code: '#C9A227',
  },
};

/** Registro id → Brand. A ordem reflete a prioridade na documentação. */
export const BRANDS: Record<string, Brand> = {
  'ofensiva-criativa': ofensivaCriativa,
  'cliente': cliente,
  'curso': curso,
  'produto': produto,
  'dark-premium': darkPremium,
  'clean-branco': cleanBranco,
  'luxo-dourado': luxoDourado,
};
