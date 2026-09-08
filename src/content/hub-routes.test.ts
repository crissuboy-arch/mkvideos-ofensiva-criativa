import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { CostAuthorizationRequiredError } from '../cost/types.js';

const { mvdSvc, otvSvc, legSvc } = vi.hoisted(() => ({
  mvdSvc: {
    indice: vi.fn().mockReturnValue([{ slug: 'a', titulo: 'A' }]),
    faz: vi.fn(),
    ok: vi.fn().mockResolvedValue({ code: 0, stdout: 'ok', stderr: '' }),
    estado: vi.fn(), plano: vi.fn(), planoMd: vi.fn(), pacoteMd: vi.fn(),
    artefatos: vi.fn().mockReturnValue({}), estimarCusto: vi.fn(),
  },
  otvSvc: { lista: vi.fn().mockReturnValue(['x1']), status: vi.fn().mockReturnValue({ id: 'x1' }) },
  legSvc: {
    list: vi.fn().mockReturnValue([]),
    createFromUpload: vi.fn(),
    createFromYoutube: vi.fn(),
    transcribePlan: vi.fn(),
    transcribe: vi.fn(),
  },
}));

vi.mock('../musicavideo/service.js', () => ({ musicavideo: () => mvdSvc }));
vi.mock('../otimizevideo/service.js', () => ({ otimizevideo: () => otvSvc }));
vi.mock('../legendas/service.js', () => ({ legendas: () => legSvc }));

import { handleHub } from './hub-routes.js';

describe('handleHub', () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      void handleHub(req, res, url).then((h) => { if (!h) { res.writeHead(404); res.end(); } });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('GET /api/hub/musicavideo/lista delega ao serviço', async () => {
    const res = await fetch(`${base}/api/hub/musicavideo/lista`);
    expect(res.status).toBe(200);
    expect((await res.json() as { itens: unknown[] }).itens).toHaveLength(1);
  });

  it('POST faz sem confirm → 402 PAYMENT_CONFIRM_REQUIRED', async () => {
    mvdSvc.faz.mockRejectedValueOnce(new CostAuthorizationRequiredError({
      module: 'musicavideo', phase: 'musica', providerId: 'kie', estimatedUsd: 0.08, billable: true,
    }));
    const res = await fetch(`${base}/api/hub/musicavideo/faz`, { method: 'POST', body: JSON.stringify({ slug: 'a', parte: 'musica' }) });
    expect(res.status).toBe(402);
    expect((await res.json() as { code: string }).code).toBe('PAYMENT_CONFIRM_REQUIRED');
    expect(mvdSvc.faz).toHaveBeenCalledWith(expect.objectContaining({ confirmado: false }));
  });

  it('POST faz com confirm:true passa confirmado:true ao serviço', async () => {
    mvdSvc.faz.mockResolvedValueOnce({ code: 0, stdout: 'iniciado', stderr: '' });
    const res = await fetch(`${base}/api/hub/musicavideo/faz`, { method: 'POST', body: JSON.stringify({ slug: 'a', parte: 'musica', confirm: true }) });
    expect(res.status).toBe(202);
    expect(mvdSvc.faz).toHaveBeenLastCalledWith(expect.objectContaining({ confirmado: true, partes: ['musica'] }));
  });

  it('GET /api/hub/otimizevideo/status', async () => {
    const res = await fetch(`${base}/api/hub/otimizevideo/status?id=x1`);
    expect((await res.json() as { id: string }).id).toBe('x1');
  });

  it('POST /api/hub/legendas/upload envia o corpo bruto ao serviço e devolve 201', async () => {
    legSvc.createFromUpload.mockResolvedValueOnce({ id: 'aula-01', title: 'Aula 01' });
    const res = await fetch(`${base}/api/hub/legendas/upload?name=aula.mp4&titulo=Aula%2001`, {
      method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: Buffer.from('bytes-de-video'),
    });
    expect(res.status).toBe(201);
    expect((await res.json() as { id: string }).id).toBe('aula-01');
    const [, name, titulo] = legSvc.createFromUpload.mock.calls[0];
    expect(name).toBe('aula.mp4');
    expect(titulo).toBe('Aula 01');
  });

  it('POST /api/hub/legendas/upload converte erro de validação em 400', async () => {
    legSvc.createFromUpload.mockRejectedValueOnce(new Error('formato não aceito (.exe).'));
    const res = await fetch(`${base}/api/hub/legendas/upload?name=x.exe`, { method: 'POST', body: Buffer.from('x') });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toMatch(/formato não aceito/);
  });

  it('POST /api/hub/legendas/youtube delega ao serviço', async () => {
    legSvc.createFromYoutube.mockResolvedValueOnce({ id: 'yt-proj', title: 'Meu Vídeo' });
    const res = await fetch(`${base}/api/hub/legendas/youtube`, {
      method: 'POST', body: JSON.stringify({ url: 'https://youtu.be/abc', titulo: '' }),
    });
    expect(res.status).toBe(201);
    expect(legSvc.createFromYoutube).toHaveBeenCalledWith('https://youtu.be/abc', undefined);
  });

  it('POST /api/hub/legendas/youtube converte falha em 400 amigável', async () => {
    legSvc.createFromYoutube.mockRejectedValueOnce(new Error('esse vídeo é privado.'));
    const res = await fetch(`${base}/api/hub/legendas/youtube`, {
      method: 'POST', body: JSON.stringify({ url: 'https://youtu.be/priv' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toMatch(/privado/);
  });

  it('GET /api/hub/legendas/transcricao-plano devolve o plano (sem executar nada)', async () => {
    legSvc.transcribePlan.mockResolvedValueOnce({
      durationLabel: '10:00', recommendedProviderId: 'whisper_local',
      providers: [{ id: 'whisper_local', kind: 'local', available: true, estimatedUsd: 0 }],
      localReady: true, localHint: '',
    });
    const res = await fetch(`${base}/api/hub/legendas/transcricao-plano?id=x`);
    expect(res.status).toBe(200);
    expect((await res.json() as { recommendedProviderId: string }).recommendedProviderId).toBe('whisper_local');
    expect(legSvc.transcribePlan).toHaveBeenCalledWith('x');
    expect(legSvc.transcribe).not.toHaveBeenCalled();
  });

  it('POST /api/hub/legendas/transcrever sem confirm → confirmed:false ao serviço', async () => {
    legSvc.transcribe.mockResolvedValueOnce({ project: {}, cues: [] });
    await fetch(`${base}/api/hub/legendas/transcrever`, { method: 'POST', body: JSON.stringify({ id: 'x', provedor: 'whisper_local' }) });
    expect(legSvc.transcribe).toHaveBeenLastCalledWith('x', expect.objectContaining({ provider: 'whisper_local', confirmed: false }));
  });

  it('POST /api/hub/legendas/transcrever com confirm:true → confirmed:true ao serviço', async () => {
    legSvc.transcribe.mockResolvedValueOnce({ project: {}, cues: [] });
    await fetch(`${base}/api/hub/legendas/transcrever`, { method: 'POST', body: JSON.stringify({ id: 'x', provedor: 'groq', confirm: true }) });
    expect(legSvc.transcribe).toHaveBeenLastCalledWith('x', expect.objectContaining({ provider: 'groq', confirmed: true }));
  });

  it('SEGURANÇA: serviço pago sem confirmação → 402 PAYMENT_CONFIRM_REQUIRED', async () => {
    legSvc.transcribe.mockRejectedValueOnce(new CostAuthorizationRequiredError({
      module: 'otimizevideo', phase: 'transcricao', providerId: 'groq', estimatedUsd: 0.04, billable: true,
    }));
    const res = await fetch(`${base}/api/hub/legendas/transcrever`, { method: 'POST', body: JSON.stringify({ id: 'x', provedor: 'groq' }) });
    expect(res.status).toBe(402);
    expect((await res.json() as { code: string }).code).toBe('PAYMENT_CONFIRM_REQUIRED');
  });

  it('rota fora de /api/hub não é tratada', async () => {
    const res = await fetch(`${base}/qualquer`);
    expect(res.status).toBe(404);
  });
});
