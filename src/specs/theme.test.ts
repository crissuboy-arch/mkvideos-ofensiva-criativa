import { describe, it, expect } from 'vitest';
import { parseTheme, spokenHandle, spokenUrl } from './theme.js';

describe('parseTheme', () => {
  it('extrai número, tipo de listagem e assunto', () => {
    const t = parseTheme('5 formas de ganhar dinheiro com IA');
    expect(t.n).toBe(5);
    expect(t.kind).toBe('forma');
    expect(t.subject).toBe('ganhar dinheiro com IA');
  });

  it('singulariza razões → razão e respeita limites 2..8', () => {
    expect(parseTheme('3 razões para investir').kind).toBe('razão');
    expect(parseTheme('99 passos').n).toBe(8);
    expect(parseTheme('1 dica').n).toBe(2);
  });

  it('título sem listagem: assunto = título, n = fallback', () => {
    const t = parseTheme('Como funciona o ChatGPT', undefined, 4);
    expect(t.kind).toBeUndefined();
    expect(t.subject).toBe('Como funciona o ChatGPT');
    expect(t.n).toBe(4);
  });

  it('override de n_cenas vence a detecção', () => {
    expect(parseTheme('5 formas de X', 7).n).toBe(7);
  });
});

describe('expansão para fala', () => {
  it('handle e url viram texto falável', () => {
    expect(spokenHandle('@ofensivacriativa')).toBe('arroba ofensivacriativa');
    expect(spokenUrl('links.ofensivacriativa.com')).toBe('links ponto ofensivacriativa ponto com');
  });
});
