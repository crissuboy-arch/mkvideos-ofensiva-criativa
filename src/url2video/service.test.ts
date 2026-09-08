import { describe, it, expect, vi } from 'vitest';

import { Url2VideoService } from './service.js';
import { Url2VideoValidationError, type Url2VideoDefaults } from './types.js';
import type { EngineJob, VideoEngine } from '../engines/types.js';

const DEF: Url2VideoDefaults = {
  engine: 'content2video', aspectRatio: '9:16',
  conversationStyle: 'popular', speechPace: 'natural', includeCta: true,
};

function fakeEngine(overrides: Partial<VideoEngine> = {}): VideoEngine {
  const job = (p: object): EngineJob => ({
    id: 'j1', type: 'generation', project: 'p', status: 'queued', stage: 's',
    phaseIndex: 0, phases: [], phaseTimings: [], aspectRatio: '9:16', includeCta: true,
    cancelable: true, retryable: false, resumeAvailable: false, skippedPhases: [],
    error: null, createdAt: '', updatedAt: '', totalDurationMs: 0, logs: [], ...p,
  });
  return {
    id: 'content2video', label: 'fake', capabilities: {} as never,
    health: vi.fn().mockResolvedValue({ id: 'content2video', available: true, ready: true, message: 'ok', checks: [] }),
    config: vi.fn().mockResolvedValue(null),
    createDirection: vi.fn().mockImplementation(async (i) => job({ stage: JSON.stringify(i) })),
    approveDirection: vi.fn().mockResolvedValue(job({ status: 'running' })),
    regenerateDirection: vi.fn().mockResolvedValue(job({})),
    listJobs: vi.fn().mockResolvedValue([]),
    cancelJob: vi.fn().mockResolvedValue(job({ status: 'cancelled' })),
    retryRender: vi.fn().mockResolvedValue(job({ type: 'render' })),
    listProjects: vi.fn().mockResolvedValue([]),
    editProject: vi.fn().mockResolvedValue(job({ type: 'edit' })),
    duplicateProject: vi.fn().mockResolvedValue(job({ type: 'duplicate' })),
    renderProject: vi.fn().mockResolvedValue(job({ type: 'render' })),
    openEditor: vi.fn().mockResolvedValue({ url: 'http://x' }),
    fetchMedia: vi.fn(),
    ...overrides,
  } as VideoEngine;
}

describe('Url2VideoService', () => {
  it('start valida a URL antes de chamar o motor', async () => {
    const engine = fakeEngine();
    const svc = new Url2VideoService(() => engine, DEF);
    await expect(svc.start({ url: 'nao-e-url' })).rejects.toBeInstanceOf(Url2VideoValidationError);
    expect(engine.createDirection).not.toHaveBeenCalled();
  });

  it('start normaliza e delega ao motor', async () => {
    const engine = fakeEngine();
    const svc = new Url2VideoService(() => engine, DEF);
    await svc.start({ url: 'https://a.com', formato: '16:9', ritmo: 'rapida' });
    expect(engine.createDirection).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://a.com/', aspectRatio: '16:9', speechPace: 'fast', includeCta: true,
    }));
  });

  it('edit/duplicate normalizam a instrução', async () => {
    const engine = fakeEngine();
    const svc = new Url2VideoService(() => engine, DEF);
    await svc.edit('meu-slug', { instrucoes: 'trocar o CTA' });
    expect(engine.editProject).toHaveBeenCalledWith('meu-slug', expect.objectContaining({ instructions: 'trocar o CTA' }));
    await expect(svc.duplicate('meu-slug', { instrucoes: 'x' })).rejects.toBeInstanceOf(Url2VideoValidationError);
  });

  it('status compõe health + defaults', async () => {
    const svc = new Url2VideoService(() => fakeEngine(), DEF);
    const s = await svc.status();
    expect(s).toMatchObject({ engine: 'content2video', defaults: DEF });
    expect(s.health.ready).toBe(true);
  });
});
