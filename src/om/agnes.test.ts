// src/om/agnes.test.ts — provedor Agnes com fetch mockado.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agnesImage, agnesVideo, agnesApiKey, AgnesError } from './agnes.js';

const realFetch = globalThis.fetch;

describe('om/agnes', () => {
  beforeEach(() => {
    process.env.AGNES_API_KEY = 'test-key';
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.AGNES_API_KEY;
    vi.useRealTimers();
  });

  it('agnesApiKey exige a chave', () => {
    delete process.env.AGNES_API_KEY;
    expect(() => agnesApiKey()).toThrow(/AGNES_API_KEY/);
  });

  it('agnesImage devolve bytes do b64_json', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ data: [{ b64_json: png }] }),
    } as unknown as Response);
    const buf = await agnesImage({ prompt: 'a phone on a desk' });
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('agnesImage faz retry em 503 e depois consegue', async () => {
    const png = Buffer.from([1, 2, 3]).toString('base64');
    let n = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      n++;
      if (n < 3) return { ok: false, status: 503, text: async () => '' } as unknown as Response;
      return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: png }] }) } as unknown as Response;
    });
    vi.useFakeTimers();
    const p = agnesImage({ prompt: 'x' });
    await vi.runAllTimersAsync();
    const buf = await p;
    expect(buf).toEqual(Buffer.from([1, 2, 3]));
    expect(n).toBe(3);
  });

  it('agnesImage lança em 400 (ex: prompt PT apanhado pelo filtro)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: async () => 'bad prompt',
    } as unknown as Response);
    await expect(agnesImage({ prompt: 'x' })).rejects.toThrow(AgnesError);
  });

  it('agnesVideo cria, faz poll e saca o mp4', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: unknown) => {
      calls.push(String(url));
      if (String(url).includes('/v1/videos')) {
        return { ok: true, status: 200, json: async () => ({ video_id: 'vid1' }) } as unknown as Response;
      }
      if (String(url).includes('agnesapi')) {
        return { ok: true, status: 200, json: async () => ({ status: 'succeeded', video_url: 'https://x/v.mp4' }) } as unknown as Response;
      }
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer } as unknown as Response;
    });
    const buf = await agnesVideo({ prompt: 'cat on beach', durationSec: 5, pollIntervalMs: 1 });
    expect(buf).toEqual(Buffer.from([4, 5, 6]));
    expect(calls.some((c) => c.includes('video_id=vid1'))).toBe(true);
  });
});
