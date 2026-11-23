import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { SqliteContentStore } from './store.js';
import { createPanelServer } from './panel.js';
import type { ContentItem } from './types.js';

const KEY = 'chave-de-teste-scalaflow-32-caracteres-minimo';
const MP4_BYTES = Buffer.from('FAKE-MP4-BYTES-PARA-TESTE');

let dir: string;
let store: SqliteContentStore;
let server: http.Server;
let base: string;
let releaseFirst: (() => void) | null = null;
let generateCalls: number[] = [];

async function startServer(withKey: boolean): Promise<{ server: http.Server; base: string }> {
  store = new SqliteContentStore(':memory:');
  generateCalls = [];
  const srv = createPanelServer(store, {
    scalaflowApiKey: withKey ? KEY : undefined,
    generate: async (item: ContentItem) => {
      generateCalls.push(item.id);
      if (item.tema === 'BLOQUEADO') {
        await new Promise<void>((r) => { releaseFirst = r; });
      }
      const p = join(dir, `video-${item.id}.mp4`);
      writeFileSync(p, MP4_BYTES);
      return p;
    },
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as AddressInfo).port;
  return { server: srv, base: `http://127.0.0.1:${port}` };
}

const auth = { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

async function postJob(baseUrl: string, projectId: string, body: Record<string, unknown>, headers: Record<string, string> = auth) {
  const res = await fetch(`${baseUrl}/api/scalaflow/projects/${projectId}/videos`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function getJob(baseUrl: string, jobId: string) {
  const res = await fetch(`${baseUrl}/api/scalaflow/jobs/${jobId}`, { headers: auth });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function untilDone(baseUrl: string, jobId: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 50; i++) {
    const { body } = await getJob(baseUrl, jobId);
    if (body.status === 'done' || body.status === 'error') return body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('job nunca terminou');
}

describe('API ScalaFlow', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'mkv-scalaflow-'));
    ({ server, base } = await startServer(true));
  });
  afterAll(async () => { await new Promise((r) => server.close(r)); store.close(); });

  it('rejeita sem chave e com chave errada (401)', async () => {
    const noAuth = await fetch(`${base}/api/scalaflow/jobs/qualquer`, {});
    expect(noAuth.status).toBe(401);
    const wrong = await fetch(`${base}/api/scalaflow/jobs/qualquer`, { headers: { authorization: 'Bearer errada' } });
    expect(wrong.status).toBe(401);
  });

  it('exige titulo (400)', async () => {
    const { status } = await postJob(base, 'proj-1', { descricao: 'sem título' });
    expect(status).toBe(400);
  });

  it('cria o trabalho, gera e entrega o MP4', async () => {
    const { status, body } = await postJob(base, 'proj-1', {
      titulo: 'VSL do Produto X', tipo: 'vsl', formato: '9:16',
      descricao: 'Descrição do produto.', oferta: 'Acesso completo por R$ 29,90.', publico: 'iniciantes',
    });
    expect(status).toBe(202);
    const jobId = String(body.jobId);
    expect(jobId.length).toBeGreaterThan(10);

    const done = await untilDone(base, jobId);
    expect(done.status).toBe('done');
    expect(done.projectId).toBe('proj-1');

    const item = store.get(Number(done.itemId));
    expect(item?.produto).toBe('scalaflow:proj-1');
    expect(item?.tipo).toBe('vendas');
    expect(item?.roteiro).toContain('Descrição do produto.');
    expect(item?.roteiro).toContain('R$ 29,90');

    const dl = await fetch(`${base}/api/scalaflow/jobs/${jobId}/download`, { headers: auth });
    expect(dl.status).toBe(200);
    expect(Buffer.from(await dl.arrayBuffer()).equals(MP4_BYTES)).toBe(true);
  });

  it('fila: o segundo trabalho espera o primeiro terminar', async () => {
    const first = await postJob(base, 'proj-2', { titulo: 'BLOQUEADO' });
    const second = await postJob(base, 'proj-2', { titulo: 'Segundo vídeo' });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);

    await new Promise((r) => setTimeout(r, 60));
    const secondNow = await getJob(base, String(second.body.jobId));
    expect(secondNow.body.status).toBe('queued');

    releaseFirst?.();
    const doneFirst = await untilDone(base, String(first.body.jobId));
    const doneSecond = await untilDone(base, String(second.body.jobId));
    expect(doneFirst.status).toBe('done');
    expect(doneSecond.status).toBe('done');
    expect(generateCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('download antes de pronto devolve 409 e job inexistente 404', async () => {
    const { body } = await postJob(base, 'proj-3', { titulo: 'BLOQUEADO' });
    const dl = await fetch(`${base}/api/scalaflow/jobs/${body.jobId}/download`, { headers: auth });
    expect(dl.status).toBe(409);
    releaseFirst?.();
    const nf = await fetch(`${base}/api/scalaflow/jobs/nao-existe`, { headers: auth });
    expect(nf.status).toBe(404);
  });
});

describe('API ScalaFlow desligada sem chave', () => {
  it('sem MKVIDEOS_API_KEY as rotas não existem (404)', async () => {
    const off = await startServer(false);
    try {
      const res = await fetch(`${off.base}/api/scalaflow/jobs/x`, { headers: auth });
      expect(res.status).toBe(404);
    } finally {
      await new Promise((r) => off.server.close(r));
      store.close();
    }
  });
});
