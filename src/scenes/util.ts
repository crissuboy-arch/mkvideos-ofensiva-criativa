// Utilidades compartilhadas pelos renderers de cena.

/** Escapa texto para HTML (conteúdo vindo do roteiro). */
export function esc(s = ''): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Seletor de id: idsel('s1','h') → '#s1-h'. */
export const idsel = (p: string, s: string): string => `#${p}-${s}`;

/** Escolhe tamanho por formato: px(vertical, valorVertical, valorHorizontal). */
export const px = (vertical: boolean, v: number, h: number): number => (vertical ? v : h);

/** hex (#RRGGBB) → "r,g,b" (para usar em rgba()). */
export function hexToRgb(hex: string): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
