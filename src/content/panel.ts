// Painel de Produção de Conteúdo — servidor HTTP sem deps (node:http) + HTML
// autocontido. Centro de controle operacional: planejar, cadastrar, acompanhar
// status e disparar a geração no motor (botão "Gerar Vídeo").

import http from 'node:http';

import type { SqliteContentStore } from './store.js';
import type { ContentItem, ContentStatus, ContentInput, ContentPatch } from './types.js';
import {
  PLATFORMS, LANGUAGES, CONTENT_STATUSES, PLATFORM_LABEL, LANGUAGE_LABEL,
  isPlatform, isLanguage, isStatus,
} from './types.js';
import { VIDEO_TYPES } from '../specs/types.js';
import { brandIds } from '../brands/index.js';

export interface PanelOptions {
  port?: number;
  token?: string;
  /** Dispara a geração do vídeo do item. Recebe callback de mudança de fase. */
  generate?: (item: ContentItem, ctx: { onPhase: (s: ContentStatus) => void }) => Promise<string>;
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function sanitizeInput(b: Record<string, unknown>): ContentInput | null {
  const tema = typeof b.tema === 'string' ? b.tema.trim() : '';
  const plataforma = String(b.plataforma ?? '');
  if (!tema || !isPlatform(plataforma)) return null;
  const tipo = (VIDEO_TYPES as string[]).includes(String(b.tipo)) ? (b.tipo as ContentInput['tipo']) : 'explicativo';
  const idioma = isLanguage(String(b.idioma)) ? (b.idioma as ContentInput['idioma']) : 'pt';
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    tema, tipo, plataforma, idioma,
    produto: str(b.produto),
    publish_date: str(b.publish_date),
    publish_time: str(b.publish_time),
    marca: str(b.marca),
    status: isStatus(String(b.status)) ? (b.status as ContentStatus) : 'ideia',
  };
}

function sanitizePatch(b: Record<string, unknown>): ContentPatch {
  const p: ContentPatch = {};
  if (typeof b.tema === 'string' && b.tema.trim()) p.tema = b.tema.trim();
  if ((VIDEO_TYPES as string[]).includes(String(b.tipo))) p.tipo = b.tipo as ContentPatch['tipo'];
  if (isPlatform(String(b.plataforma))) p.plataforma = b.plataforma as ContentPatch['plataforma'];
  if (isLanguage(String(b.idioma))) p.idioma = b.idioma as ContentPatch['idioma'];
  if (isStatus(String(b.status))) p.status = b.status as ContentStatus;
  for (const k of ['produto', 'publish_date', 'publish_time', 'marca'] as const) {
    if (k in b) p[k] = (typeof b[k] === 'string' && (b[k] as string).trim()) ? (b[k] as string).trim() : null;
  }
  return p;
}

const json = (res: http.ServerResponse, code: number, data: unknown): void => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

export function createPanelServer(store: SqliteContentStore, opts: PanelOptions = {}): http.Server {
  const token = opts.token ?? '';
  let generating: number | null = null; // trava simples: 1 geração por vez

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const { pathname } = url;

    if (token && url.searchParams.get('token') !== token) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    // páginas
    if (req.method === 'GET' && (pathname === '/' || pathname === '/painel')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getPanelHtml(token));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/options') {
      return json(res, 200, {
        tipos: VIDEO_TYPES,
        plataformas: PLATFORMS.map((p) => ({ id: p, label: PLATFORM_LABEL[p] })),
        idiomas: LANGUAGES.map((l) => ({ id: l, label: LANGUAGE_LABEL[l] })),
        status: CONTENT_STATUSES,
        marcas: brandIds(),
      });
    }

    if (req.method === 'GET' && pathname === '/api/dashboard') {
      return json(res, 200, store.dashboard());
    }

    if (req.method === 'GET' && pathname === '/api/items') {
      const f = {
        plataforma: url.searchParams.get('plataforma') || undefined,
        idioma: url.searchParams.get('idioma') || undefined,
        status: url.searchParams.get('status') || undefined,
      };
      const items = store.list({
        plataforma: f.plataforma && isPlatform(f.plataforma) ? f.plataforma : undefined,
        idioma: f.idioma && isLanguage(f.idioma) ? f.idioma : undefined,
        status: f.status && isStatus(f.status) ? f.status : undefined,
      });
      return json(res, 200, { items, generating });
    }

    if (req.method === 'POST' && pathname === '/api/items') {
      const input = sanitizeInput(await readJson(req));
      if (!input) return json(res, 400, { error: 'tema e plataforma são obrigatórios' });
      return json(res, 200, { id: store.create(input) });
    }

    const idItem = pathname.match(/^\/api\/items\/(\d+)$/);
    if (req.method === 'POST' && idItem) {
      const id = Number(idItem[1]);
      const ok = store.update(id, sanitizePatch(await readJson(req)));
      return json(res, ok ? 200 : 404, { ok });
    }

    const idDelete = pathname.match(/^\/api\/items\/(\d+)\/delete$/);
    if (req.method === 'POST' && idDelete) {
      return json(res, 200, { ok: store.remove(Number(idDelete[1])) });
    }

    const idGerar = pathname.match(/^\/api\/items\/(\d+)\/gerar$/);
    if (req.method === 'POST' && idGerar) {
      const id = Number(idGerar[1]);
      const item = store.get(id);
      if (!item) return json(res, 404, { error: 'não existe' });
      if (!opts.generate) return json(res, 501, { error: 'geração não configurada' });
      if (generating !== null) return json(res, 409, { error: 'ocupado', busy: generating });

      generating = id;
      store.update(id, { status: 'gerando', error: null });
      json(res, 202, { ok: true });

      opts.generate(item, { onPhase: (s) => store.update(id, { status: s }) })
        .then((videoPath) => store.update(id, { status: 'pronto', video_path: videoPath, error: null }))
        .catch((e) => store.update(id, { status: 'roteiro', error: String((e as Error).message || e).slice(0, 300) }))
        .finally(() => { generating = null; });
      return;
    }

    return json(res, 404, { error: 'Not found' });
  });

  if (opts.port) server.listen(opts.port);
  return server;
}

// ─── HTML autocontido (funcional, sem foco em design) ────────────────────────

export function getPanelHtml(token = ''): string {
  return `<!DOCTYPE html>
<html lang="pt-br"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Painel de Produção — mkivideos</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0D1321;color:#E8ECF3;margin:0;padding:16px 20px;font-size:14px}
  h1{font-size:18px;margin:0 0 12px}h2{font-size:14px;color:#8FA3BF;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.05em}
  .cards{display:flex;gap:12px;flex-wrap:wrap}
  .card{background:#172033;border:1px solid #2A3A5C;border-radius:8px;padding:12px 16px;min-width:120px}
  .card .n{font-size:26px;font-weight:700}.card.pending .n{color:#FFC300}.card.ready .n{color:#2EC4B6}.card.pub .n{color:#7FB3FF}.card.week .n{color:#E8C84A}
  .card .l{color:#8FA3BF;font-size:12px}
  .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}
  input,select,button{background:#172033;color:#E8ECF3;border:1px solid #2A3A5C;border-radius:6px;padding:6px 8px;font-size:13px}
  button{cursor:pointer}button:hover{border-color:#5B7299}
  button.go{background:#1f3a2e;border-color:#2EC4B6}button.pub{background:#1f2f4a;border-color:#7FB3FF}button.del{background:#3a1f24;border-color:#b05}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #243250;font-size:13px;vertical-align:top}
  th{color:#8FA3BF;font-weight:600}
  .badge{padding:1px 7px;border-radius:9px;font-size:11px;background:#2A3A5C}
  .s-ideia{background:#3A3F4C}.s-roteiro{background:#4a3d1f}.s-gerando{background:#FFC300;color:#0D1321}.s-renderizando{background:#E8C84A;color:#0D1321}.s-pronto{background:#1f5a4a;color:#bff}.s-publicado{background:#1f3a5a;color:#bdf}
  .cal-day{background:#141d2e;border:1px solid #243250;border-radius:8px;padding:8px 12px;margin-bottom:8px}
  .cal-day .d{color:#FFC300;font-weight:600;margin-bottom:4px}
  .cal-row{display:flex;gap:8px;font-size:12px;color:#B9C4D6;padding:2px 0}
  .tabs{display:flex;gap:6px;margin:8px 0}.tabs button.active{border-color:#FFC300;color:#FFC300}
  a{color:#7FB3FF}.muted{color:#8FA3BF}
  fieldset{border:1px solid #2A3A5C;border-radius:8px;margin:8px 0;padding:10px 12px}
  fieldset .row{display:flex;gap:8px;flex-wrap:wrap;align-items:end}
  label{display:flex;flex-direction:column;font-size:11px;color:#8FA3BF;gap:3px}
</style></head><body>
<h1>🎬 Painel de Produção de Conteúdo</h1>

<div class="cards" id="cards"></div>

<fieldset>
  <legend>Cadastrar conteúdo</legend>
  <div class="row">
    <label>Tema<input id="f-tema" placeholder="Ex.: 5 formas de vender mais" size="34"></label>
    <label>Tipo<select id="f-tipo"></select></label>
    <label>Plataforma<select id="f-plataforma"></select></label>
    <label>Idioma<select id="f-idioma"></select></label>
    <label>Produto<input id="f-produto" placeholder="(opcional)" size="16"></label>
    <label>Data<input id="f-date" type="date"></label>
    <label>Hora<input id="f-time" type="time"></label>
    <label>Marca<select id="f-marca"></select></label>
    <button onclick="criar()">+ Adicionar</button>
  </div>
</fieldset>

<div class="bar">
  <strong>Filtros:</strong>
  <select id="flt-plataforma" onchange="load()"><option value="">Todas plataformas</option></select>
  <select id="flt-idioma" onchange="load()"><option value="">Todos idiomas</option></select>
  <select id="flt-status" onchange="load()"><option value="">Todos status</option></select>
  <button onclick="load()">↻ Atualizar</button>
  <span class="muted" id="busy"></span>
</div>

<div class="tabs">
  <button id="tab-lista" class="active" onclick="setTab('lista')">Lista</button>
  <button id="tab-cal" onclick="setTab('cal')">Calendário</button>
</div>

<div id="view-lista"></div>
<div id="view-cal" style="display:none"></div>

<script>
const TOKEN=${JSON.stringify(token)};
const qs=TOKEN?('?token='+encodeURIComponent(TOKEN)):'';
const PL=${JSON.stringify(PLATFORM_LABEL)}, LG=${JSON.stringify(LANGUAGE_LABEL)};
let OPTS={tipos:[],plataformas:[],idiomas:[],status:[],marcas:[]}, TAB='lista';
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function api(path,opt){return fetch(path+qs,opt).then(r=>r.json());}

function fillSelect(el,items,getV,getL,placeholder){
  el.innerHTML=(placeholder?'<option value="">'+placeholder+'</option>':'')+items.map(i=>'<option value="'+esc(getV(i))+'">'+esc(getL(i))+'</option>').join('');
}
async function boot(){
  OPTS=await api('/api/options');
  fillSelect(document.getElementById('f-tipo'),OPTS.tipos,x=>x,x=>x);
  fillSelect(document.getElementById('f-plataforma'),OPTS.plataformas,x=>x.id,x=>x.label);
  fillSelect(document.getElementById('f-idioma'),OPTS.idiomas,x=>x.id,x=>x.label);
  fillSelect(document.getElementById('f-marca'),OPTS.marcas,x=>x,x=>x,'(padrão)');
  fillSelect(document.getElementById('flt-plataforma'),OPTS.plataformas,x=>x.id,x=>x.label,'Todas plataformas');
  fillSelect(document.getElementById('flt-idioma'),OPTS.idiomas,x=>x.id,x=>x.label,'Todos idiomas');
  fillSelect(document.getElementById('flt-status'),OPTS.status.map(s=>({id:s,label:s})),x=>x.id,x=>x.label,'Todos status');
  load();
}
function setTab(t){TAB=t;
  document.getElementById('view-lista').style.display=t==='lista'?'':'none';
  document.getElementById('view-cal').style.display=t==='cal'?'':'none';
  document.getElementById('tab-lista').className=t==='lista'?'active':'';
  document.getElementById('tab-cal').className=t==='cal'?'active':'';
}
function statusSelect(it){
  return '<select onchange="setStatus('+it.id+',this.value)">'+OPTS.status.map(s=>'<option '+(s===it.status?'selected':'')+'>'+s+'</option>').join('')+'</select>';
}
async function load(){
  const d=await api('/api/dashboard');
  document.getElementById('cards').innerHTML=
    card('pending','Pendentes',d.pending)+card('ready','Prontos',d.ready)+card('pub','Publicados',d.published)+card('week','Esta semana',d.thisWeek);
  const p=document.getElementById('flt-plataforma').value, i=document.getElementById('flt-idioma').value, s=document.getElementById('flt-status').value;
  const q=[]; if(p)q.push('plataforma='+p); if(i)q.push('idioma='+i); if(s)q.push('status='+s);
  const sep=TOKEN?'&':'?';
  const r=await fetch('/api/items'+qs+(q.length?(sep+q.join('&')):''));
  const {items,generating}=await r.json();
  document.getElementById('busy').textContent=generating?('⏳ gerando #'+generating+'…'):'';
  renderList(items); renderCal(items);
}
function card(cls,label,n){return '<div class="card '+cls+'"><div class="n">'+n+'</div><div class="l">'+label+'</div></div>';}
function renderList(items){
  const rows=items.map(it=>{
    const vid=it.video_path?('<a href="#" title="'+esc(it.video_path)+'">✔ vídeo</a>'):(it.error?('<span class="muted" title="'+esc(it.error)+'">erro</span>'):'—');
    const gerar=(it.status==='ideia'||it.status==='roteiro')?'<button class="go" onclick="gerar('+it.id+')">Gerar Vídeo</button>':'';
    const pub=it.status==='pronto'?'<button class="pub" onclick="setStatus('+it.id+',\\'publicado\\')">Publicar</button>':'';
    return '<tr><td>'+(esc(it.publish_date)||'—')+'</td><td>'+(esc(it.publish_time)||'')+'</td>'
      +'<td>'+esc(it.tema)+'</td><td>'+esc(it.tipo)+'</td><td>'+esc(PL[it.plataforma]||it.plataforma)+'</td>'
      +'<td>'+esc(LG[it.idioma]||it.idioma)+'</td><td>'+(esc(it.produto)||'—')+'</td>'
      +'<td>'+statusSelect(it)+'</td><td>'+vid+'</td>'
      +'<td>'+gerar+' '+pub+' <button class="del" onclick="excluir('+it.id+')">✕</button></td></tr>';
  }).join('');
  document.getElementById('view-lista').innerHTML=
    '<table><thead><tr><th>Data</th><th>Hora</th><th>Tema</th><th>Tipo</th><th>Plataforma</th><th>Idioma</th><th>Produto</th><th>Status</th><th>Vídeo</th><th>Ações</th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="10" class="muted">Sem itens. Cadastre acima.</td></tr>')+'</tbody></table>';
}
function renderCal(items){
  const dated=items.filter(it=>it.publish_date).sort((a,b)=>(a.publish_date+a.publish_time).localeCompare(b.publish_date+b.publish_time));
  const byDay={};
  dated.forEach(it=>{(byDay[it.publish_date]=byDay[it.publish_date]||[]).push(it);});
  const days=Object.keys(byDay).sort();
  document.getElementById('view-cal').innerHTML=days.length?days.map(d=>
    '<div class="cal-day"><div class="d">📅 '+esc(d)+'</div>'+byDay[d].map(it=>
      '<div class="cal-row"><span>'+(esc(it.publish_time)||'--:--')+'</span><span class="badge s-'+it.status+'">'+it.status+'</span>'
      +'<span>'+esc(PL[it.plataforma]||it.plataforma)+'</span><span>'+esc(LG[it.idioma]||it.idioma)+'</span><span>'+esc(it.tema)+'</span></div>'
    ).join('')+'</div>'
  ).join(''):'<p class="muted">Nenhum item com data de publicação.</p>';
}
async function criar(){
  const body={tema:val('f-tema'),tipo:val('f-tipo'),plataforma:val('f-plataforma'),idioma:val('f-idioma'),
    produto:val('f-produto'),publish_date:val('f-date'),publish_time:val('f-time'),marca:val('f-marca')};
  if(!body.tema){alert('Informe o tema');return;}
  const r=await api('/api/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(r.error){alert(r.error);return;}
  document.getElementById('f-tema').value='';document.getElementById('f-produto').value='';
  load();
}
function val(id){return document.getElementById(id).value;}
async function setStatus(id,status){await api('/api/items/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});load();}
async function gerar(id){const r=await api('/api/items/'+id+'/gerar',{method:'POST'});if(r&&r.error){alert('Não foi possível gerar: '+r.error);}load();}
async function excluir(id){if(!confirm('Excluir item #'+id+'?'))return;await api('/api/items/'+id+'/delete',{method:'POST'});load();}
boot(); setInterval(load,5000);
</script></body></html>`;
}
