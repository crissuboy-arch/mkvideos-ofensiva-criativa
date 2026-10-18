import { describe, it, expect, beforeEach } from 'vitest';

import { listLayouts, layoutsHealth, composeLayout, FORMATS_16X9, FORMATS_9X16 } from './layouts.js';
import { EngineNotImplementedError } from '../types.js';

beforeEach(() => {
  delete process.env.LAYOUTS_DIR;
});

describe('formatos-layout (sem configuração)', () => {
  it('lista os 8 formatos 16:9 e os 12 formatos 9:16', () => {
    expect(FORMATS_16X9).toHaveLength(8);
    expect(FORMATS_9X16).toHaveLength(12);
    expect(listLayouts('9x16')).toContain('bolha');
    expect(listLayouts('16x9')).toContain('telejornal');
  });

  it('health() = indisponível com instrução de setup', async () => {
    const h = await layoutsHealth();
    expect(h.available).toBe(false);
    expect(h.message).toMatch(/LAYOUTS_DIR/);
  });

  it('composeLayout() nega sem LAYOUTS_DIR', async () => {
    await expect(
      composeLayout({ formato: 'bolha', aspecto: '9x16', cena: 'a.mp4', avatar: 'b.mp4', saida: 'c.mp4' }),
    ).rejects.toBeInstanceOf(EngineNotImplementedError);
  });

  it('composeLayout() rejeita formato inexistente', async () => {
    process.env.LAYOUTS_DIR = '/tmp';
    await expect(
      composeLayout({ formato: 'nao-existe', aspecto: '9x16', cena: 'a.mp4', avatar: 'b.mp4', saida: 'c.mp4' }),
    ).rejects.toThrow(/não existe em 9x16/);
  });
});
