// Dashboard portável da fila — HTML autocontido + servidor HTTP sem dependências
// (node:http). Qualquer host pode: (a) importar só o HTML e plugar na própria rota,
// ou (b) usar createDashboardServer() pra subir um painel standalone.

import http from 'node:http';

import type { QueueStore } from './types.js';

/** Página autocontida que faz polling de /api/video-jobs a cada 5s. token vazio = sem auth. */
export function getVideoDashboardHtml(token = ''): string {
  return `<!DOCTYPE html>
<html lang="pt-br"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fila de Vídeos — mkivideos</title>
<style>
  body { font-family: system-ui, sans-serif; background:#0D1321; color:#F0EBD8; margin:0; padding:24px; }
  h1 { color:#FFC300; font-size:20px; }
  table { width:100%; border-collapse:collapse; margin-top:16px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid #3E5C76; font-size:14px; }
  th { color:#748CAB; font-weight:600; }
  .badge { padding:2px 8px; border-radius:10px; font-size:12px; }
  .queued{background:#3E5C76}.running{background:#FFC300;color:#0D1321}.done{background:#2EC4B6;color:#0D1321}
  .failed{background:#b00020}.canceled{background:#555}
  button { background:#1D2D44; color:#F0EBD8; border:1px solid #3E5C76; border-radius:6px; padding:4px 10px; cursor:pointer; }
  a { color:#FFC300; }
</style></head><body>
<h1>📋 Fila de Vídeos</h1>
<table><thead><tr><th>#</th><th>Skill</th><th>Entrada</th><th>Status</th><th>Resultado</th><th></th></tr></thead>
<tbody id="rows"><tr><td colspan="6">carregando…</td></tr></tbody></table>
<script>
const TOKEN = ${JSON.stringify(token)};
const qs = TOKEN ? ('?token=' + encodeURIComponent(TOKEN)) : '';
function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
async function load() {
  const r = await fetch('/api/video-jobs' + qs);
  const { jobs } = await r.json();
  document.getElementById('rows').innerHTML = jobs.map(function(j){
    var inp = esc((j.input||'').length > 50 ? j.input.slice(0,50)+'…' : (j.input||''));
    var res = j.result_path ? esc(j.result_path) : (j.error ? ('⚠ '+esc(j.error)) : '—');
    var btn = j.status === 'queued' ? '<button onclick="cancelJob('+j.id+')">cancelar</button>' : '';
    return '<tr><td>#'+j.id+'</td><td>'+esc(j.skill)+'</td><td>'+inp+'</td>'
      + '<td><span class="badge '+esc(j.status)+'">'+esc(j.status)+'</span></td><td>'+res+'</td><td>'+btn+'</td></tr>';
  }).join('') || '<tr><td colspan="6">Sem jobs ainda.</td></tr>';
}
async function cancelJob(id){
  await fetch('/api/video-jobs/'+id+'/cancel' + qs, {method:'POST'});
  load();
}
load(); setInterval(load, 5000);
</script></body></html>`;
}

export interface DashboardServerOptions {
  /** Se passado, o server já dá listen nessa porta. */
  port?: number;
  /** Se setado, exige ?token=… em todas as rotas. */
  token?: string;
}

/**
 * Servidor HTTP standalone (sem deps): serve `/videos`, `GET /api/video-jobs`,
 * `POST /api/video-jobs/:id/cancel`. Retorna o http.Server (chame .listen se não
 * passar `port`). Hosts com framework próprio podem ignorar isso e usar só o HTML.
 */
export function createDashboardServer(store: QueueStore, opts: DashboardServerOptions = {}): http.Server {
  const token = opts.token ?? '';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');

    if (token && url.searchParams.get('token') !== token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/videos') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getVideoDashboardHtml(token));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/video-jobs') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jobs: store.list() }));
      return;
    }

    const cancelMatch = url.pathname.match(/^\/api\/video-jobs\/(\d+)\/cancel$/);
    if (req.method === 'POST' && cancelMatch) {
      const ok = store.cancel(Number(cancelMatch[1]));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  if (opts.port) server.listen(opts.port);
  return server;
}
