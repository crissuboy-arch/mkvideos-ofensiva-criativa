import { describe, it, expect, beforeEach } from 'vitest';

import { LONGCAT_AVATAR_PROVIDER, LONGCAT_CLIP_PROVIDER } from './longcat.js';
import { EngineNotImplementedError } from '../types.js';

beforeEach(() => {
  delete process.env.LONGCAT_DIR;
  delete process.env.LONGCAT_PYTHON;
  delete process.env.LONGCAT_AVATAR_CHECKPOINT;
});

describe('LongCat providers (sem configuração)', () => {
  it('avatar: health() = indisponível com motivo claro', async () => {
    const h = await LONGCAT_AVATAR_PROVIDER.health();
    expect(h.id).toBe('avatar');
    expect(h.available).toBe(false);
    expect(h.message).toMatch(/LONGCAT_DIR/);
  });

  it('avatar: generate() nega com NOT_IMPLEMENTED e instruções', async () => {
    await expect(
      LONGCAT_AVATAR_PROVIDER.generate({ brief: 'x', aspectRatio: '9:16', durationSeconds: 5 }),
    ).rejects.toBeInstanceOf(EngineNotImplementedError);
  });

  it('avatar: sem photoPath/audioPath, generate() exige os campos', async () => {
    process.env.LONGCAT_DIR = '/tmp/inexistente-longcat';
    await expect(
      LONGCAT_AVATAR_PROVIDER.generate({ brief: 'x', aspectRatio: '9:16', durationSeconds: 5, options: {} }),
    ).rejects.toThrow(/LONGCAT_DIR|não configurado|não encontrado/);
  });

  it('clip: health() = indisponível (ponte de clip pendente de PoC)', async () => {
    const h = await LONGCAT_CLIP_PROVIDER.health();
    expect(h.id).toBe('longcat');
    expect(h.available).toBe(false);
  });

  it('clip: generate() nega com NOT_IMPLEMENTED explicando o PoC', async () => {
    await expect(
      LONGCAT_CLIP_PROVIDER.generate({ brief: 'um cão no parque', aspectRatio: '9:16', durationSeconds: 5 }),
    ).rejects.toThrow(/PoC|wrapper/i);
  });
});
