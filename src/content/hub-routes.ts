// Rotas HTTP das abas Música + Videoclipe / Otimizar Vídeo / Legendar /
// Biblioteca. Delegam aos serviços já testados. O gate de custo vive nos
// serviços — aqui só repassamos `confirm` do corpo da requisição.

import type http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { musicavideo } from '../musicavideo/service.js';
import { otimizevideo } from '../otimizevideo/service.js';
import { legendas } from '../legendas/service.js';
import { scanLibrary, isLibraryPathAllowed } from '../biblioteca/index.js';
import { parseSrt } from '../legendas/srt.js';
import { costLedger } from '../cost/gate.js';
import { CostAuthorizationRequiredError, CostCeilingExceededError } from '../cost/types.js';
import type { ParteMusicavideo } from '../musicavideo/types.js';
import type { ModoOtv } from '../otimizevideo/types.js';

function json(res: http.ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 4e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function fail(res: http.ServerResponse, e: unknown): void {
  if (e instanceof CostAuthorizationRequiredError || e instanceof CostCeilingExceededError) {
    json(res, 402, { error: e.message, code: 'PAYMENT_CONFIRM_REQUIRED' });
    return;
  }
  json(res, 500, { error: (e as Error).message || 'erro interno' });
}
const isParte = (v: unknown): v is ParteMusicavideo => v === 'musica' || v === 'capa' || v === 'clipe';
const s = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function handleHub(
  req: http.IncomingMessage, res: http.ServerResponse, url: URL,
): Promise<boolean> {
  const { pathname } = url;
  if (!pathname.startsWith('/api/hub')) return false;
  const m = req.method || 'GET';
  const q = (k: string): string => url.searchParams.get(k) || '';

  try {
    // ── status / custo ──────────────────────────────────────────────────────
    if (m === 'GET' && pathname === '/api/hub/status') {
      json(res, 200, { costLedger: costLedger() });
      return true;
    }

    // ── biblioteca ──────────────────────────────────────────────────────────
    if (m === 'GET' && pathname === '/api/hub/biblioteca') {
      json(res, 200, { items: scanLibrary() });
      return true;
    }
    if (m === 'GET' && pathname === '/api/hub/media') {
      const src = q('src');
      if (!src || !isLibraryPathAllowed(src) || !existsSync(src)) { json(res, 400, { error: 'caminho inválido' }); return true; }
      const ext = path.extname(src).toLowerCase();
      const mime = { '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.srt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': statSync(src).size, 'Cache-Control': 'private, max-age=600' });
      createReadStream(src).pipe(res);
      return true;
    }

    // ── Música + Videoclipe ─────────────────────────────────────────────────
    if (pathname.startsWith('/api/hub/musicavideo')) {
      const svc = musicavideo();
      const sub = pathname.slice('/api/hub/musicavideo/'.length);
      if (m === 'GET' && sub === 'lista') { json(res, 200, { itens: svc.indice(Number(q('n')) || 20) }); return true; }
      if (m === 'GET' && sub === 'producao') {
        const slug = q('slug');
        json(res, 200, {
          estado: svc.estado(slug), plano: svc.plano(slug), planoMd: svc.planoMd(slug),
          pacoteMd: svc.pacoteMd(slug), artefatos: Object.keys(svc.artefatos(slug)),
          custo: (() => { try { return svc.estimarCusto(slug); } catch { return null; } })(),
        });
        return true;
      }
      const b = m === 'POST' ? await readJson(req) : {};
      if (m === 'POST' && sub === 'plano') { json(res, 202, await svc.criarPlano({ solicitacao: s(b.solicitacao), slug: s(b.slug) || undefined, estilo: s(b.estilo) || undefined, idioma: s(b.idioma) || undefined, ritmo: (s(b.ritmo) || undefined) as never })); return true; }
      if (m === 'POST' && sub === 'ajusta' && isParte(b.parte)) { json(res, 202, await svc.ajusta(s(b.slug), b.parte, s(b.instrucao), b.refaz === true)); return true; }
      if (m === 'POST' && sub === 'ok' && isParte(b.parte)) { json(res, 202, await svc.ok(s(b.slug), b.parte)); return true; }
      if (m === 'POST' && sub === 'faz') {
        json(res, 202, await svc.faz({ slug: s(b.slug), partes: isParte(b.parte) ? [b.parte] : undefined, confirmado: b.confirm === true, semRevisao: b.semRevisao === true }));
        return true;
      }
      if (m === 'POST' && sub === 'revisa') { json(res, 200, await svc.revisa(s(b.slug), isParte(b.parte) ? b.parte : undefined)); return true; }
      if (m === 'POST' && sub === 'aprova' && isParte(b.parte)) { json(res, 202, await svc.aprova(s(b.slug), b.parte, b.faixa === 1 || b.faixa === 2 ? b.faixa : undefined)); return true; }
      if (m === 'POST' && sub === 'reprova' && isParte(b.parte)) { json(res, 202, await svc.reprova(s(b.slug), b.parte, s(b.shots) || undefined)); return true; }
      json(res, 404, { error: 'rota musicavideo não encontrada' });
      return true;
    }

    // ── Otimizar Vídeo ──────────────────────────────────────────────────────
    if (pathname.startsWith('/api/hub/otimizevideo')) {
      const svc = otimizevideo();
      const sub = pathname.slice('/api/hub/otimizevideo/'.length);
      if (m === 'GET' && sub === 'lista') { json(res, 200, { ids: svc.lista() }); return true; }
      if (m === 'GET' && sub === 'status') { json(res, 200, svc.status(q('id'))); return true; }
      const b = m === 'POST' ? await readJson(req) : {};
      if (m === 'POST' && sub === 'ingest') { json(res, 202, await svc.ingest(s(b.fonte), b.forcar === true)); return true; }
      if (m === 'POST' && sub === 'fase') {
        const id = s(b.id), prov = s(b.provedor), confirm = b.confirm === true, modo = (s(b.modo) || 'A') as ModoOtv;
        const alvo = Number(b.alvo) || undefined;
        const fase = s(b.fase);
        const r =
          fase === 'transcrever' ? await svc.transcrever(id, prov || 'groq', confirm, b.forcar === true) :
          fase === 'cenas' ? await svc.cenasLocais(id, b.forcar === true) :
          fase === 'classificar' ? await svc.classificarCenas(id, prov || 'glm', confirm, b.forcar === true) :
          fase === 'pontuar' ? await svc.pontuar(id, modo, prov || 'glm', confirm, alvo, b.forcar === true) :
          fase === 'selecionar' ? await svc.selecionar(id, modo, alvo) :
          fase === 'render' ? await svc.render(id, b.rapido === true) :
          fase === 'narrar' ? await svc.narrar(id, prov || 'inemavox') :
          fase === 'substituir' ? await svc.substituir(id, prov || 'fal', confirm, b.forcar === true) :
          null;
        if (!r) { json(res, 400, { error: `fase desconhecida: ${fase}` }); return true; }
        json(res, 202, r);
        return true;
      }
      json(res, 404, { error: 'rota otimizevideo não encontrada' });
      return true;
    }

    // ── Legendar ────────────────────────────────────────────────────────────
    if (pathname.startsWith('/api/hub/legendas')) {
      const svc = legendas();
      const sub = pathname.slice('/api/hub/legendas/'.length);
      if (m === 'GET' && sub === 'lista') { json(res, 200, { itens: svc.list() }); return true; }
      if (m === 'GET' && sub === 'projeto') { json(res, 200, { projeto: svc.get(q('id')), srt: svc.srtText(q('id')) }); return true; }
      // Plano de transcrição — só descreve provedores/custo; não executa nada.
      if (m === 'GET' && sub === 'transcricao-plano') { json(res, 200, await svc.transcribePlan(q('id'))); return true; }

      // A) upload de arquivo local — o corpo da requisição é o binário do vídeo
      //    (sem multipart). Nome e título vêm na query; validação vive no serviço.
      if (m === 'POST' && sub === 'upload') {
        try {
          const declared = Number(req.headers['content-length']) || undefined;
          const project = await svc.createFromUpload(req, q('name') || 'video.mp4', q('titulo') || undefined, declared);
          json(res, 201, project);
        } catch (e) {
          json(res, 400, { error: (e as Error).message || 'falha no upload' });
        }
        return true;
      }

      const b = m === 'POST' ? await readJson(req) : {};

      // B) link do YouTube — baixa via yt-dlp e cria o projeto.
      if (m === 'POST' && sub === 'youtube') {
        try {
          json(res, 201, await svc.createFromYoutube(s(b.url), s(b.titulo) || undefined));
        } catch (e) {
          json(res, 400, { error: (e as Error).message || 'falha ao importar do YouTube' });
        }
        return true;
      }

      if (m === 'POST' && sub === 'novo') { json(res, 201, svc.create(s(b.video), s(b.titulo) || undefined)); return true; }
      if (m === 'POST' && sub === 'transcrever') { json(res, 202, await svc.transcribe(s(b.id), { provider: s(b.provedor) || undefined, confirmed: b.confirm === true })); return true; }
      if (m === 'POST' && sub === 'cues') { json(res, 200, svc.setCues(s(b.id), parseSrt(s(b.srt)))); return true; }
      if (m === 'POST' && sub === 'sincronizar') { json(res, 200, { cues: svc.shift(s(b.id), Number(b.segundos) || 0) }); return true; }
      if (m === 'POST' && sub === 'estilo') { json(res, 200, svc.setStyle(s(b.id), (b.style ?? {}) as Record<string, never>)); return true; }
      if (m === 'POST' && sub === 'queimar') { json(res, 202, await svc.burn(s(b.id), { width: Number(b.largura) || undefined, height: Number(b.altura) || undefined })); return true; }
      if (m === 'POST' && sub === 'softsub') { json(res, 202, await svc.softSub(s(b.id))); return true; }
      json(res, 404, { error: 'rota legendas não encontrada' });
      return true;
    }

    json(res, 404, { error: 'rota hub não encontrada' });
    return true;
  } catch (e) {
    fail(res, e);
    return true;
  }
}
