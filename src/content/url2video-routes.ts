// Rotas HTTP da aba "URL → Vídeo" do painel. Mantém o panel.ts enxuto:
// o painel só chama handleUrl2Video() e injeta o HTML de getUrl2VideoView().

import type http from 'node:http';

import type { Url2VideoService } from '../url2video/service.js';
import { Url2VideoValidationError } from '../url2video/types.js';
import { EngineError } from '../engines/types.js';

function json(res: http.ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function fail(res: http.ServerResponse, e: unknown): void {
  if (e instanceof Url2VideoValidationError) { json(res, 400, { error: e.message }); return; }
  if (e instanceof EngineError) { json(res, e.status, { error: e.message, code: e.code }); return; }
  json(res, 500, { error: (e as Error).message || 'erro interno' });
}

/**
 * Trata `/api/url2video/*`. Retorna `true` se consumiu a requisição.
 * O gate de token já foi aplicado pelo panel.ts.
 */
export async function handleUrl2Video(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  svc: Url2VideoService,
): Promise<boolean> {
  const { pathname } = url;
  if (!pathname.startsWith('/api/url2video')) return false;
  const m = req.method || 'GET';

  try {
    if (m === 'GET' && pathname === '/api/url2video/status') {
      json(res, 200, await svc.status());
      return true;
    }
    if (m === 'GET' && pathname === '/api/url2video/jobs') {
      json(res, 200, { jobs: await svc.listJobs() });
      return true;
    }
    if (m === 'GET' && pathname === '/api/url2video/projects') {
      json(res, 200, { projects: await svc.listProjects() });
      return true;
    }
    if (m === 'GET' && pathname === '/api/url2video/media') {
      const src = url.searchParams.get('src') || '';
      if (!/^project-media\/[a-z0-9-]+\/.+/i.test(src) || src.includes('..')) {
        json(res, 400, { error: 'caminho de mídia inválido' });
        return true;
      }
      const media = await svc.fetchMedia(src);
      res.writeHead(media.status, { 'Content-Type': media.contentType, 'Cache-Control': 'private, max-age=600' });
      media.body.pipe(res);
      return true;
    }

    if (m === 'POST' && pathname === '/api/url2video/jobs') {
      json(res, 202, { job: await svc.start(await readJson(req)) });
      return true;
    }

    const jobAction = pathname.match(/^\/api\/url2video\/jobs\/([\w-]+)\/(approve|regenerate|cancel|retry)$/);
    if (m === 'POST' && jobAction) {
      const [, id, action] = jobAction;
      if (action === 'approve') json(res, 202, { job: await svc.approve(id) });
      else if (action === 'regenerate') json(res, 202, { job: await svc.regenerate(id) });
      else if (action === 'cancel') json(res, 200, { job: await svc.cancel(id) });
      else {
        const mode = (await readJson(req)).mode === 'restart' ? 'restart' : 'resume';
        json(res, 202, { job: await svc.retry(id, mode) });
      }
      return true;
    }

    const projAction = pathname.match(/^\/api\/url2video\/projects\/([a-z0-9-]+)\/(edit|duplicate|render|editor)$/);
    if (m === 'POST' && projAction) {
      const [, slug, action] = projAction;
      if (action === 'render') json(res, 202, { job: await svc.render(slug) });
      else if (action === 'editor') json(res, 200, await svc.openEditor(slug));
      else {
        const b = await readJson(req);
        json(res, 202, { job: action === 'duplicate' ? await svc.duplicate(slug, b) : await svc.edit(slug, b) });
      }
      return true;
    }

    json(res, 404, { error: 'rota url2video não encontrada' });
    return true;
  } catch (e) {
    fail(res, e);
    return true;
  }
}
