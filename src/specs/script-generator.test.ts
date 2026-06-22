import { describe, it, expect } from 'vitest';
import { generateScript, narrationTexts } from './script-generator.js';
import { VIDEO_TYPES } from './types.js';

describe('generateScript', () => {
  it('gera roteiro para todos os 7 tipos com hook + cta', () => {
    for (const tipo of VIDEO_TYPES) {
      const s = generateScript({ titulo: '5 formas de crescer no Instagram', tipo });
      expect(s.scenes.length).toBeGreaterThanOrEqual(4);
      expect(s.scenes[0].type).toBe('title');
      expect(s.scenes[s.scenes.length - 1].type).toBe('cta');
      // toda cena tem narração e legenda não vazias
      for (const sc of s.scenes) {
        expect(sc.narration.trim().length).toBeGreaterThan(0);
        expect(sc.caption.trim().length).toBeGreaterThan(0);
      }
      expect(s.promise.length).toBeGreaterThan(0);
    }
  });

  it('formato default: curso/tutorial → horizontal, resto → vertical', () => {
    expect(generateScript({ titulo: 'X', tipo: 'curso' }).format).toBe('horizontal');
    expect(generateScript({ titulo: 'X', tipo: 'tutorial' }).format).toBe('horizontal');
    expect(generateScript({ titulo: 'X', tipo: 'vendas' }).format).toBe('vertical');
  });

  it('--vertical/--horizontal sobrescrevem o default', () => {
    expect(generateScript({ titulo: 'X', tipo: 'curso', vertical: true }).format).toBe('vertical');
    expect(generateScript({ titulo: 'X', tipo: 'vendas', horizontal: true }).format).toBe('horizontal');
  });

  it('a marca escolhida aparece no spec e na narração da CTA', () => {
    const s = generateScript({ titulo: 'X', tipo: 'explicativo', brand: 'luxo-dourado' });
    expect(s.brand).toBe('luxo-dourado');
    const cta = s.scenes[s.scenes.length - 1];
    expect(cta.narration).toContain('LUXO');
  });

  it('transições especiais nos momentos-chave', () => {
    const s = generateScript({ titulo: '5 formas de X', tipo: 'explicativo' });
    expect(s.scenes[1].transIn).toBe('zoom');
    expect(s.scenes[s.scenes.length - 1].transIn).toBe('fadeBlack');
  });

  it('n_cenas controla a quantidade de cenas numeradas (explicativo)', () => {
    const s = generateScript({ titulo: 'X', tipo: 'explicativo', n_cenas: 3 });
    const topics = s.scenes.filter((x) => x.type === 'topic');
    expect(topics).toHaveLength(3);
  });

  it('roteiro próprio (userScenes) substitui o conteúdo gerado', () => {
    const s = generateScript({
      titulo: 'X', tipo: 'explicativo',
      userScenes: [{ type: 'lead', title: 'Minha cena', narration: 'fala', caption: 'cap' }],
    });
    // hook + 1 user scene + cta
    expect(s.scenes).toHaveLength(3);
    expect(s.scenes[1].title).toBe('Minha cena');
  });

  it('narrationTexts retorna uma fala por cena, em ordem', () => {
    const s = generateScript({ titulo: 'X', tipo: 'vendas' });
    expect(narrationTexts(s)).toEqual(s.scenes.map((x) => x.narration));
  });
});
