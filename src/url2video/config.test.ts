import { describe, it, expect } from 'vitest';

import { normalizeAspect, normalizePace, normalizeStyle, loadDefaults } from './config.js';

describe('url2video/config normalização', () => {
  it('normalizeAspect aceita aliases', () => {
    expect(normalizeAspect('9:16', '16:9')).toBe('9:16');
    expect(normalizeAspect('vertical', '16:9')).toBe('9:16');
    expect(normalizeAspect('horizontal', '9:16')).toBe('16:9');
    expect(normalizeAspect('16x9', '9:16')).toBe('16:9');
    expect(normalizeAspect('lixo', '9:16')).toBe('9:16');
    expect(normalizeAspect(undefined, '16:9')).toBe('16:9');
  });

  it('normalizeStyle aceita rótulos PT', () => {
    expect(normalizeStyle('simples', 'natural')).toBe('popular');
    expect(normalizeStyle('técnico', 'popular')).toBe('technical');
    expect(normalizeStyle('technical', 'popular')).toBe('technical');
    expect(normalizeStyle('xxx', 'natural')).toBe('natural');
  });

  it('normalizePace aceita rótulos PT', () => {
    expect(normalizePace('calma', 'natural')).toBe('calm');
    expect(normalizePace('rápida', 'natural')).toBe('fast');
    expect(normalizePace('', 'natural')).toBe('natural');
  });

  it('loadDefaults lê do ambiente com fallback', () => {
    expect(loadDefaults({}).aspectRatio).toBe('9:16');
    const d = loadDefaults({
      MKIVIDEOS_URL2VIDEO_FORMAT: '16:9',
      MKIVIDEOS_URL2VIDEO_STYLE: 'tecnico',
      MKIVIDEOS_URL2VIDEO_PACE: 'rapida',
      MKIVIDEOS_URL2VIDEO_CTA: '0',
    } as NodeJS.ProcessEnv);
    expect(d).toMatchObject({ aspectRatio: '16:9', conversationStyle: 'technical', speechPace: 'fast', includeCta: false });
  });
});
