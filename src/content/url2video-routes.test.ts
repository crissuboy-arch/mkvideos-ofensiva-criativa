import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { handleUrl2Video } from './url2video-routes.js';
import type { Url2VideoService } from '../url2video/service.js';
import { Url2VideoValidationError } from '../url2video/types.js';
import { EngineError } from '../engines/types.js';

const job = { id: 'j1', project: 'p', status: 'queued' };

async function body(res: Response): Promise<Record<string, any>> {
  return (await res.json()) as Record<string, any>;
}

function fakeService(): Url2VideoService {
  return {
    status: vi.fn().mockResolvedValue({ engine: 'content2video', defaults: {}, health: { ready: false }, config: null }),
    listJobs: vi.fn().mockResolvedValue([job]),
    listProjects: vi.fn().mockResolvedValue([]),
    start: vi.fn().mockImplementation(async (raw: { url?: string }) => {
      if (!raw.url) throw new Url2VideoValidationError('Informe uma URL.');
      return job;
    }),
    approve: vi.fn().mockResolvedValue(job),
    render: vi.fn().mockImplementation(async () => { throw new EngineError('motor fora do ar', 'ENGINE_HTTP', 503); }),
  } as unknown as Url2VideoService;
}

describe('handleUrl2Video (rotas HTTP do painel)', () => {
  let server: http.Server;
  let base: string;
  let svc: Url2VideoService;

  beforeAll(async () => {
    svc = fakeService();
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      void handleUrl2Video(req, res, url, svc).then((handled) => {
        if (!handled) { res.writeHead(404); res.end(); }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('GET /api/url2video/status delega ao serviço', async () => {
    const res = await fetch(`${base}/api/url2video/status`);
    expect(res.status).toBe(200);
    expect((await body(res)).engine).toBe('content2video');
  });

  it('GET /api/url2video/jobs lista jobs', async () => {
    const res = await fetch(`${base}/api/url2video/jobs`);
    expect((await body(res)).jobs).toEqual([job]);
  });

  it('POST /api/url2video/jobs sem url → 400 com mensagem de validação', async () => {
    const res = await fetch(`${base}/api/url2video/jobs`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(400);
    expect((await body(res)).error).toMatch(/URL/);
  });

  it('POST /api/url2video/jobs com url → 202', async () => {
    const res = await fetch(`${base}/api/url2video/jobs`, { method: 'POST', body: JSON.stringify({ url: 'https://a.com' }) });
    expect(res.status).toBe(202);
    expect((await body(res)).job).toEqual(job);
  });

  it('POST /api/url2video/jobs/:id/approve delega', async () => {
    const res = await fetch(`${base}/api/url2video/jobs/j1/approve`, { method: 'POST' });
    expect(res.status).toBe(202);
    expect(svc.approve).toHaveBeenCalledWith('j1');
  });

  it('erro de motor vira o status HTTP do EngineError', async () => {
    const res = await fetch(`${base}/api/url2video/projects/algum-slug/render`, { method: 'POST' });
    expect(res.status).toBe(503);
    expect((await body(res)).code).toBe('ENGINE_HTTP');
  });

  it('GET /api/url2video/media rejeita caminho fora de project-media/', async () => {
    const res = await fetch(`${base}/api/url2video/media?src=../../etc/passwd`);
    expect(res.status).toBe(400);
  });

  it('rota fora de /api/url2video não é tratada (handled=false)', async () => {
    const res = await fetch(`${base}/outra-coisa`);
    expect(res.status).toBe(404);
  });
});
