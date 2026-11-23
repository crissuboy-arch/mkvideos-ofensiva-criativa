// API de integração para o ScalaFlow — o ScalaFlow pede um vídeo de vendas
// por projeto e o MKVideos produz com o mesmo motor do painel.
//
// Segurança: só ativa com MKVIDEOS_API_KEY definida no ambiente (fail-closed:
// sem chave, as rotas não existem). Autenticação: Authorization: Bearer
// <MKVIDEOS_API_KEY>, comparada em tempo constante.
//
// Rotas:
//   POST /api/scalaflow/projects/:projectId/videos  → { jobId, status }
//   GET  /api/scalaflow/jobs/:jobId                 → estado real do trabalho
//   GET  /api/scalaflow/jobs/:jobId/download        → MP4 (quando pronto)
//
// Os trabalhos vivem na tabela scalaflow_jobs (mesmo SQLite do painel) e o
// vídeo é gerado pelo item de conteúdo correspondente — fica visível no
// painel, organizado por projeto (produto = "scalaflow:<projectId>").

import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';

import type { SqliteContentStore } from './store.js';
import type { ContentItem } from './types.js';
import { VIDEO_TYPES } from '../specs/types.js';

export interface ScalaflowCtx {
  store: SqliteContentStore;
  apiKey: string;
  /** Tenta arrancar já a geração do item. Devolve false se o motor está ocupado. */
  tryStartGeneration: (itemId: number) => boolean;
}

export interface ScalaflowHandler {
  handle: (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => Promise<boolean>;
  /** Chamado quando uma geração termina — desvia o próximo trabalho da fila. */
  notifyIdle: () => void;
}

interface JobRow {
  id: string;
  project_id: string;
  content_id: number;
  created_at: number;
}

const json = (res: http.ServerResponse, code: number, data: unknown): void => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function authorized(req: http.IncomingMessage, apiKey: string): boolean {
  const h = req.headers.authorization ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token || !apiKey) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(apiKey);
  return a.length === b.length && timingSafeEqual(a, b);
}

type JobStatus = 'queued' | 'running' | 'done' | 'error';

function statusOf(item: ContentItem): JobStatus {
  if (item.status === 'pronto' && item.video_path) return 'done';
  if (item.error) return 'error';
  if (item.status === 'gerando' || item.status === 'renderizando') return 'running';
  return 'queued';
}

export function createScalaflowHandler(ctx: ScalaflowCtx): ScalaflowHandler {
  const { store, apiKey } = ctx;
  store.raw.exec(`
    CREATE TABLE IF NOT EXISTS scalaflow_jobs (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      content_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scalaflow_project ON scalaflow_jobs(project_id);
  `);

  const queue: number[] = []; // content_ids à espera de vez
  let draining = false;

  const drain = (): void => {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        const next = queue[0];
        if (!ctx.tryStartGeneration(next)) break; // ocupado — tenta no notifyIdle
        queue.shift();
      }
    } finally {
      draining = false;
    }
  };

  const getJob = (id: string): JobRow | null =>
    (store.raw.prepare(`SELECT * FROM scalaflow_jobs WHERE id = ?`).get(id) as JobRow | undefined) ?? null;

  const jobView = (job: JobRow): Record<string, unknown> => {
    const item = store.get(job.content_id);
    if (!item) return { jobId: job.id, projectId: job.project_id, status: 'error', error: 'item removido' };
    const status = statusOf(item);
    return {
      jobId: job.id,
      projectId: job.project_id,
      itemId: item.id,
      status,
      ...(status === 'done' ? { videoPath: item.video_path } : {}),
      ...(status === 'error' ? { error: item.error } : {}),
      createdAt: job.created_at,
    };
  };

  const handle = async (req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> => {
    const { pathname } = url;
    if (!pathname.startsWith('/api/scalaflow/')) return false;
    if (!apiKey) return false; // fail-closed: sem chave configurada, a API não existe
    if (!authorized(req, apiKey)) { json(res, 401, { error: 'Unauthorized' }); return true; }
    const m = req.method || 'GET';

    const create = pathname.match(/^\/api\/scalaflow\/projects\/([^/]+)\/videos$/);
    if (m === 'POST' && create) {
      const projectId = decodeURIComponent(create[1]).slice(0, 120);
      const b = await readJson(req);
      const titulo = str(b.titulo);
      if (!titulo) { json(res, 400, { error: 'titulo é obrigatório' }); return true; }

      const tipoRaw = str(b.tipo).toLowerCase();
      const tipo = tipoRaw === 'vsl'
        ? 'vendas'
        : (VIDEO_TYPES as string[]).includes(tipoRaw) ? (tipoRaw as ContentItem['tipo']) : 'vendas';
      const formato = str(b.formato);
      const plataforma = formato === '16:9' || formato.toLowerCase() === 'horizontal' ? 'youtube' : 'tiktok';

      // Sem roteiro explícito, compõe o roteiro a partir dos materiais do
      // produto (descrição/oferta/público) — um parágrafo por bloco.
      let roteiro = str(b.roteiro) || null;
      if (!roteiro) {
        const parts = [str(b.descricao), str(b.publico) ? `Feito para ${str(b.publico)}.` : '', str(b.oferta)].filter(Boolean);
        roteiro = parts.length ? parts.join('\n\n') : null;
      }

      const itemId = store.create({
        tema: titulo,
        tipo,
        plataforma,
        idioma: 'pt',
        produto: `scalaflow:${projectId}`,
        marca: str(b.marca) || null,
        roteiro,
        imagens_dir: str(b.imagens_dir) || null,
        voz: str(b.voz) || null,
        status: 'ideia',
      });
      const jobId = randomUUID();
      store.raw.prepare(`INSERT INTO scalaflow_jobs (id, project_id, content_id, created_at) VALUES (?,?,?,?)`)
        .run(jobId, projectId, itemId, Math.floor(Date.now() / 1000));
      store.logEvent(itemId, 'geracao', `pedido ScalaFlow (projeto ${projectId}, job ${jobId})`);
      queue.push(itemId);
      drain();
      const item = store.get(itemId);
      json(res, 202, { jobId, projectId, itemId, status: item ? statusOf(item) : 'queued' });
      return true;
    }

    const jobMatch = pathname.match(/^\/api\/scalaflow\/jobs\/([^/]+)(\/download)?$/);
    if (m === 'GET' && jobMatch) {
      const job = getJob(decodeURIComponent(jobMatch[1]));
      if (!job) { json(res, 404, { error: 'job não existe' }); return true; }
      if (!jobMatch[2]) { json(res, 200, jobView(job)); return true; }
      // download
      const item = store.get(job.content_id);
      if (!item || statusOf(item) !== 'done' || !item.video_path || !existsSync(item.video_path)) {
        json(res, 409, { error: 'vídeo ainda não está pronto', status: item ? statusOf(item) : 'error' });
        return true;
      }
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': statSync(item.video_path).size,
        'Content-Disposition': `attachment; filename="scalaflow-${job.id}.mp4"`,
      });
      createReadStream(item.video_path).pipe(res);
      return true;
    }

    json(res, 404, { error: 'Not found' });
    return true;
  };

  return { handle, notifyIdle: drain };
}
