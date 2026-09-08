import { describe, it, expect } from 'vitest';

import { validateUrl, normalizeRequest, normalizeTransform } from './validate.js';
import { Url2VideoValidationError, type Url2VideoDefaults } from './types.js';

const DEF: Url2VideoDefaults = {
  engine: 'content2video',
  aspectRatio: '9:16',
  conversationStyle: 'popular',
  speechPace: 'natural',
  includeCta: true,
};

describe('url2video/validate', () => {
  it('validateUrl exige http(s) absoluto', () => {
    expect(validateUrl('https://exemplo.com/a')).toBe('https://exemplo.com/a');
    expect(() => validateUrl('exemplo.com')).toThrow(Url2VideoValidationError);
    expect(() => validateUrl('ftp://x/y')).toThrow(Url2VideoValidationError);
    expect(() => validateUrl('')).toThrow(Url2VideoValidationError);
  });

  it('normalizeRequest aplica defaults e aliases', () => {
    const r = normalizeRequest({ url: 'https://a.com', formato: 'horizontal', estilo: 'tecnico', ritmo: 'calma', cta: '0' }, DEF);
    expect(r).toMatchObject({
      url: 'https://a.com/', aspectRatio: '16:9', conversationStyle: 'technical',
      speechPace: 'calm', includeCta: false,
    });
  });

  it('normalizeRequest rejeita objetivo gigante', () => {
    expect(() => normalizeRequest({ url: 'https://a.com', objetivo: 'x'.repeat(4001) }, DEF))
      .toThrow(Url2VideoValidationError);
  });

  it('normalizeTransform exige instrução mínima', () => {
    expect(() => normalizeTransform({ instrucoes: 'x' }, DEF)).toThrow(Url2VideoValidationError);
    const t = normalizeTransform({ instrucoes: 'tira a cena de preços', formato: '16:9' }, DEF);
    expect(t).toMatchObject({ instructions: 'tira a cena de preços', aspectRatio: '16:9', includeCta: true });
  });
});
