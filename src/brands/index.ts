// API pública das marcas.

import { BRANDS } from './presets.js';
import type { Brand } from './types.js';

export type { Brand, Palette, Fonts } from './types.js';
export { BRANDS } from './presets.js';

export const DEFAULT_BRAND = 'ofensiva-criativa';

/** Resolve uma marca por id (case-insensitive). Cai no default se não existir. */
export function getBrand(id?: string): Brand {
  if (!id) return BRANDS[DEFAULT_BRAND];
  const key = id.toLowerCase().trim();
  return BRANDS[key] ?? BRANDS[DEFAULT_BRAND];
}

/** true se o id corresponde a uma marca conhecida. */
export function isKnownBrand(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(BRANDS, id.toLowerCase().trim());
}

export function listBrands(): Brand[] {
  return Object.values(BRANDS);
}

export function brandIds(): string[] {
  return Object.keys(BRANDS);
}
