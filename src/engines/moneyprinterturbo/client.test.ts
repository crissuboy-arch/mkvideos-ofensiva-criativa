import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { EngineError, EngineNotAvailableError } from '../types.js';
import {
  _resetMptInflight, buildMptPtBrVerticalRequest, downloadMptArtifact,
  getMptTaskStatus, loadMptConfig, pollMptTask, submitMptVideo,
} from './client.js';

const ENV = { MPT_API_BASE_URL: 'http://127.0.0.1:8080', MPT_API_KEY: 'teste-chave' };

function jsonRes(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('moneyprinterturbo client', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    _resetMptInflight();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exige base e chave', () => {
    expect(() => loadMptConfig({})).toThrow(EngineNotAvailableError);
    expect(() => loadMptConfig({ MPT_API_BASE_URL: 'http://127.0.0.1:8080' }))
      .toThrow(EngineNotAvailableError);
  });

  it('rejeita http remoto e URLs com query', () => {
    expect(() => loadMptConfig({ ...ENV, MPT_API_BASE_URL: 'http://exemplo.com:8080' }))
      .toThrow(EngineError);
    expect(() => loadMptConfig({ ...ENV, MPT_API_BASE_URL: 'http://127.0.0.1:8080/?x=1' }))
      .toThrow(EngineError);
  });

  it('aceita http em loopback e https remoto', () => {
    expect(loadMptConfig(ENV).baseUrl).toBe('http://127.0.0.1:8080');
    expect(loadMptConfig({ ...ENV, MPT_API_BASE_URL: 'https://mpt.exemplo.com' }).baseUrl)
      .toBe('https://mpt.exemplo.com');
  });

  it('valida assunto na submissão', async () => {
    await expect(submitMptVideo({ video_subject: '  ' }, ENV)).rejects.toThrow(EngineError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fila cheia (429) não reenvia', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as unknown as Response);
    await expect(submitMptVideo({ video_subject: 'Teste' }, ENV))
      .rejects.toMatchObject({ code: 'MPT_QUEUE_FULL' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('envelope sem status 200 é rejeitado', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 500, data: null }));
    await expect(submitMptVideo({ video_subject: 'Teste' }, ENV))
      .rejects.toMatchObject({ code: 'MPT_REJECTED' });
  });

  it('submete e devolve task_id', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'abc-1' } }));
    await expect(submitMptVideo({ video_subject: 'Teste' }, ENV))
      .resolves.toEqual({ task_id: 'abc-1' });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.headers).toMatchObject({ 'x-api-key': 'teste-chave' });
  });

  it('limite local 0 bloqueia sem chamar a rede', async () => {
    await expect(submitMptVideo({ video_subject: 'Teste' }, { ...ENV, MPT_MAX_INFLIGHT: '0' }))
      .rejects.toMatchObject({ code: 'MPT_LIMIT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('valida id de tarefa e formato do estado', async () => {
    await expect(getMptTaskStatus('a/b', ENV)).rejects.toMatchObject({ code: 'MPT_VALIDATION' });
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'x' } }));
    await expect(getMptTaskStatus('x', ENV)).rejects.toMatchObject({ code: 'MPT_REJECTED' });
  });

  it('poll devolve COMPLETE e lança em FAILED com a etapa', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 't1', state: 1, videos: [] } }));
    await expect(pollMptTask('t1', { intervalMs: 250, maxWaitMs: 5000, env: ENV, sleep: async () => {} }))
      .resolves.toMatchObject({ task_id: 't1', state: 1 });
    fetchMock.mockResolvedValue(jsonRes({
      status: 200, data: { task_id: 't2', state: -1, failed_stage: 'audio', error: 'sem voz' },
    }));
    await expect(pollMptTask('t2', { intervalMs: 250, maxWaitMs: 5000, env: ENV, sleep: async () => {} }))
      .rejects.toThrow(/audio/);
  });

  it('poll expira sem estado terminal', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 't3', state: 4, progress: 10 } }));
    await expect(pollMptTask('t3', { intervalMs: 250, maxWaitMs: 1000, env: ENV }))
      .rejects.toMatchObject({ code: 'MPT_TIMEOUT' });
  });

  it('download rejeita fuga do diretório de tarefas', async () => {
    await expect(downloadMptArtifact('tasks/t1/../../etc/passwd', ENV))
      .rejects.toMatchObject({ code: 'MPT_VALIDATION' });
    await expect(downloadMptArtifact('/etc/passwd', ENV))
      .rejects.toMatchObject({ code: 'MPT_VALIDATION' });
    await expect(downloadMptArtifact('videos/outro.mp4', ENV))
      .rejects.toMatchObject({ code: 'MPT_VALIDATION' });
  });

  it('download usa o endpoint do motor com a chave', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('mp4').buffer,
    } as unknown as Response);
    const buf = await downloadMptArtifact('tasks/t1/final.mp4', ENV);
    expect(buf.toString()).toBe('mp4');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain('/api/v1/download/t1/final.mp4');
    expect(init.headers).toMatchObject({ 'x-api-key': 'teste-chave' });
  });

  it('builder PT-BR vertical: defaults e materiais locais', () => {
    const req = buildMptPtBrVerticalRequest({ subject: ' Óbidos ' });
    expect(req.video_language).toBe('pt-BR');
    expect(req.video_aspect).toBe('9:16');
    expect(req.subtitle_enabled).toBe(true);
    expect(req.video_source).toBeUndefined();
    const local = buildMptPtBrVerticalRequest({
      subject: 'Óbidos',
      materials: [{ url: '/tmp/clip-1.mp4', duration: 6 }],
    });
    expect(local.video_source).toBe('local');
    expect(local.video_materials).toHaveLength(1);
  });
});
