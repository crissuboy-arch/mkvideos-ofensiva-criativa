import { describe, it, expect } from 'vitest';
import { compose } from './composer.js';
import { getBrand } from './brands/index.js';
import type { SceneSpec } from './specs/types.js';

function scene(partial: Partial<SceneSpec> & { type: SceneSpec['type'] }): SceneSpec {
  return { narration: 'x', caption: 'y', audio_dur: 3, ...partial };
}

describe('compose', () => {
  const scenes: SceneSpec[] = [
    scene({ type: 'title', eyebrow: 'IA', title: 'Como Vender Mais', subtitle: 'Salva esse vídeo' }),
    scene({ type: 'topic', index: 1, title: 'Primeiro Ponto', desc: 'Detalhe do ponto' }),
    scene({ type: 'bullets', title: 'Pilares', bullets: ['Um', 'Dois', 'Três'] }),
    scene({ type: 'cards', cards: [{ title: 'A', desc: 'a' }, { title: 'B', desc: 'b' }] }),
    scene({ type: 'proof', proof: [{ stat: '+300%', label: 'crescimento' }] }),
    scene({ type: 'cta', transIn: 'fadeBlack' }),
  ];

  it('gera HTML de composição com root e duração', () => {
    const { html, total } = compose({ scenes, brand: getBrand(), vertical: true });
    expect(total).toBeGreaterThan(0);
    expect(html).toContain('data-composition-id="main"');
    expect(html).toContain(`data-duration="${total}"`);
    expect(html).toContain('window.__timelines["main"]');
  });

  it('emite uma <section> e um <audio> por cena', () => {
    const { html } = compose({ scenes, brand: getBrand(), vertical: true });
    for (let i = 1; i <= scenes.length; i++) {
      expect(html).toContain(`id="s${i}"`);
      expect(html).toContain(`src="assets/audio/s${i}.wav"`);
      expect(html).toContain(`id="cap-${i}"`);
    }
  });

  it('a CTA mostra o nome da marca', () => {
    const { html } = compose({ scenes, brand: getBrand('luxo-dourado'), vertical: false });
    expect(html).toContain('LUXO');
    expect(html).toContain('oc-brand');
  });

  it('injeta CSS só dos tipos usados', () => {
    const { html } = compose({ scenes, brand: getBrand(), vertical: true });
    expect(html).toContain('.bullets');
    expect(html).toContain('.cards-grid');
    expect(html).toContain('.proof-grid');
    expect(html).not.toContain('.quote-text'); // quote não foi usado
  });

  it('formato muda dimensões do root', () => {
    const v = compose({ scenes, brand: getBrand(), vertical: true });
    const h = compose({ scenes, brand: getBrand(), vertical: false });
    expect(v.html).toContain('data-width="1080"');
    expect(h.html).toContain('data-width="1920"');
  });

  it('música opcional vira faixa 21', () => {
    const { html } = compose({ scenes, brand: getBrand(), vertical: true, music: { src: 'assets/audio/bg.wav', vol: 0.1 } });
    expect(html).toContain('id="bgm"');
    expect(html).toContain('data-track-index="21"');
  });
});
