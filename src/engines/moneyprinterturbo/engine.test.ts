import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { engineIds, getEngine } from '../registry.js';
import { loadDefaults } from '../../url2video/config.js';
import { MoneyPrinterTurboEngine } from './engine.js';
import { _resetMptInflight } from './client.js';
import '../index.js';

const ENV = { MPT_API_BASE_URL: 'http://127.0.0.1:8080', MPT_API_KEY: 'teste-chave' };

function jsonRes(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('moneyprinterturbo engine', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    _resetMptInflight();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('regista-se ao lado do content2video sem mudar o default', () => {
    expect(engineIds()).toContain('content2video');
    expect(engineIds()).toContain('moneyprinterturbo');
    expect(getEngine('moneyprinterturbo').id).toBe('moneyprinterturbo');
    expect(loadDefaults({}).engine).toBe('content2video');
  });

  it('capacidades: sem URL → Vídeo, sem gate, sem editor', () => {
    const engine = new MoneyPrinterTurboEngine();
    expect(engine.capabilities.urlToVideo).toBe(false);
    expect(engine.capabilities.visualGate).toBe(false);
    expect(engine.capabilities.visualEditor).toBe(false);
    expect(engine.capabilities.clipProviders).toEqual([]);
  });

  it('createFromTheme submete e getJob normaliza estados', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'task-1' } }));
    const engine = new MoneyPrinterTurboEngine();
    const created = await engine.createFromTheme({ subject: 'Óbidos' }, ENV);
    expect(created.id).toBe('task-1');
    expect(created.status).toBe('queued');
    expect(created.aspectRatio).toBe('9:16');

    fetchMock.mockResolvedValue(jsonRes({
      status: 200, data: { task_id: 'task-1', state: 4, progress: 40 },
    }));
    await expect(engine.getJob('task-1', ENV)).resolves.toMatchObject({ status: 'running', stage: '40%' });

    fetchMock.mockResolvedValue(jsonRes({
      status: 200, data: { task_id: 'task-1', state: 1, videos: ['tasks/task-1/final.mp4'] },
    }));
    await expect(engine.getJob('task-1', ENV)).resolves.toMatchObject({ status: 'completed' });

    fetchMock.mockResolvedValue(jsonRes({
      status: 200, data: { task_id: 'task-1', state: -1, failed_stage: 'audio', error: 'sem voz' },
    }));
    await expect(engine.getJob('task-1', ENV)).resolves.toMatchObject({ status: 'failed', error: 'sem voz' });
  });

  it('listJobs devolve só as tarefas submetidas nesta instância', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'task-9' } }));
    const engine = new MoneyPrinterTurboEngine();
    await engine.createFromTheme({ subject: 'Óbidos' }, ENV);
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'task-9', state: 1 } }));
    const jobs = await engine.listJobs(ENV);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: 'task-9', status: 'completed', project: 'Óbidos' });
  });

  it('cancelJob apaga no motor e devolve cancelled', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'task-1' } }));
    const engine = new MoneyPrinterTurboEngine();
    await engine.createFromTheme({ subject: 'Óbidos' }, ENV);
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: {} }));
    const cancelled = await engine.cancelJob('task-1', ENV);
    expect(cancelled.status).toBe('cancelled');
    const [url, init] = fetchMock.mock.calls.at(-1) as [URL, RequestInit];
    expect(String(url)).toContain('/api/v1/tasks/task-1');
    expect(init.method).toBe('DELETE');
  });

  it('retry restart resubmete; resume não existe', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'task-1' } }));
    const engine = new MoneyPrinterTurboEngine();
    await engine.createFromTheme({ subject: 'Óbidos' }, ENV);
    await expect(engine.retryRender('task-1', 'resume', ENV)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'task-2' } }));
    const retried = await engine.retryRender('task-1', 'restart', ENV);
    expect(retried.id).toBe('task-2');
    expect(retried.status).toBe('queued');
    await expect(engine.retryRender('desconhecida', 'restart', ENV))
      .rejects.toMatchObject({ code: 'MPT_UNKNOWN_JOB' });
  });

  it('fluxo URL → Vídeo e projetos não existem neste motor', async () => {
    const engine = new MoneyPrinterTurboEngine();
    await expect(engine.createDirection({} as never)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(engine.approveDirection('x')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(engine.listProjects()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(engine.openEditor('x')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('downloadJobVideo exige conclusão e baixa o primeiro artefacto', async () => {
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'task-1' } }));
    const engine = new MoneyPrinterTurboEngine();
    await engine.createFromTheme({ subject: 'Óbidos' }, ENV);
    fetchMock.mockResolvedValue(jsonRes({ status: 200, data: { task_id: 'task-1', state: 4 } }));
    await expect(engine.downloadJobVideo('task-1', ENV)).rejects.toMatchObject({ code: 'MPT_NOT_COMPLETE' });
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(jsonRes({
      status: 200, data: { task_id: 'task-1', state: 1, videos: ['tasks/task-1/final.mp4'] },
    }));
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('mp4').buffer,
    } as unknown as Response);
    const buf = await engine.downloadJobVideo('task-1', ENV);
    expect(buf.toString()).toBe('mp4');
  });

  it('fetchMedia rejeita fuga do diretório', async () => {
    const engine = new MoneyPrinterTurboEngine();
    await expect(engine.fetchMedia('../segredo.mp4', ENV)).rejects.toMatchObject({ code: 'MPT_VALIDATION' });
  });

  it('health sem configuração: indisponível, sem rede', async () => {
    const engine = new MoneyPrinterTurboEngine();
    const health = await engine.health({});
    expect(health.available).toBe(false);
    expect(health.ready).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
