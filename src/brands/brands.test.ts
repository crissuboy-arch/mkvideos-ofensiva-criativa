import { describe, it, expect } from 'vitest';
import { getBrand, isKnownBrand, listBrands, brandIds, DEFAULT_BRAND } from './index.js';

describe('brands', () => {
  it('expõe os 7 presets', () => {
    expect(listBrands()).toHaveLength(7);
    expect(brandIds()).toEqual([
      'ofensiva-criativa', 'cliente', 'curso', 'produto',
      'dark-premium', 'clean-branco', 'luxo-dourado',
    ]);
  });

  it('default é ofensiva-criativa', () => {
    expect(getBrand().id).toBe(DEFAULT_BRAND);
    expect(getBrand().name).toBe('OFENSIVA CRIATIVA');
  });

  it('resolve por id case-insensitive', () => {
    expect(getBrand('Luxo-Dourado').id).toBe('luxo-dourado');
  });

  it('cai no default em marca desconhecida', () => {
    expect(getBrand('inexistente').id).toBe(DEFAULT_BRAND);
    expect(isKnownBrand('inexistente')).toBe(false);
    expect(isKnownBrand('produto')).toBe(true);
  });

  it('toda marca tem paleta completa e fontes', () => {
    for (const b of listBrands()) {
      for (const k of ['bg', 'bg2', 'bg3', 'fg', 'muted', 'accent', 'accent2', 'code'] as const) {
        expect(b.palette[k]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
      expect(b.fonts.title).toBeTruthy();
      expect(b.name.length).toBeGreaterThan(0);
    }
  });
});
