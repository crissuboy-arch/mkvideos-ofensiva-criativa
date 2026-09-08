import { describe, it, expect } from 'vitest';

import { listProviders, getProvider, implementedProviderIds, plannedProviderIds } from './registry.js';
import { EngineNotImplementedError } from '../types.js';

describe('providers de mídia', () => {
  it('só hyperframes é implementado hoje', () => {
    expect(implementedProviderIds()).toEqual(['hyperframes']);
  });

  it('os provedores futuros estão listados mas não implementados', () => {
    const planned = plannedProviderIds();
    for (const id of ['kling', 'veo', 'runway', 'sora', 'avatar', 'image-gen', 'local-media'] as const) {
      expect(planned).toContain(id);
      expect(getProvider(id).implemented).toBe(false);
    }
  });

  it('generate() de um provedor planejado lança NOT_IMPLEMENTED', async () => {
    await expect(getProvider('kling').generate({
      brief: 'x', aspectRatio: '9:16', durationSeconds: 5,
    })).rejects.toBeInstanceOf(EngineNotImplementedError);
  });

  it('todos os provedores respondem health()', async () => {
    for (const p of listProviders()) {
      const h = await p.health();
      expect(h.id).toBe(p.id);
    }
  });
});
