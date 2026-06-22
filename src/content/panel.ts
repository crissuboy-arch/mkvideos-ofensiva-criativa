// Centro de Operações de Conteúdo — servidor HTTP sem deps (node:http) + HTML
// autocontido. Biblioteca, calendário (hoje/semana/mês), contas, métricas, logs,
// lotes (duplicar) e agendamento. O botão "Gerar Vídeo" chama o motor; o worker
// (scheduler) publica os agendados vencidos.

import http from 'node:http';

import type { SqliteContentStore } from './store.js';
import { ymd } from './store.js';
import type { ContentItem, ContentStatus, ContentInput, ContentPatch, BatchVariation } from './types.js';
import {
  PLATFORMS, LANGUAGES, CONTENT_STATUSES, PLATFORM_LABEL, LANGUAGE_LABEL, DEFAULT_TZ,
  isPlatform, isLanguage, isStatus,
} from './types.js';
import { VIDEO_TYPES } from '../specs/types.js';
import { brandIds } from '../brands/index.js';

export interface PanelOptions {
  port?: number;
  token?: string;
  /** Dispara a geração do vídeo do item; recebe callback de mudança de fase. */
  generate?: (item: ContentItem, ctx: { onPhase: (s: ContentStatus) => void }) => Promise<string>;
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function sanitizeInput(b: Record<string, unknown>): ContentInput | null {
  const tema = typeof b.tema === 'string' ? b.tema.trim() : '';
  const plataforma = String(b.plataforma ?? '');
  if (!tema || !isPlatform(plataforma)) return null;
  return {
    tema,
    tipo: (VIDEO_TYPES as string[]).includes(String(b.tipo)) ? (b.tipo as ContentInput['tipo']) : 'explicativo',
    plataforma,
    idioma: isLanguage(String(b.idioma)) ? (b.idioma as ContentInput['idioma']) : 'pt',
    produto: str(b.produto),
    account_id: num(b.account_id),
    publish_date: str(b.publish_date),
    publish_time: str(b.publish_time),
    timezone: str(b.timezone) ?? DEFAULT_TZ,
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
  if ('account_id' in b) p.account_id = num(b.account_id);
  for (const k of ['produto', 'publish_date', 'publish_time', 'timezone', 'marca'] as const) {
    if (k in b) p[k] = str(b[k]);
  }
  return p;
}

const json = (res: http.ServerResponse, code: number, data: unknown): void => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

export function createPanelServer(store: SqliteContentStore, opts: PanelOptions = {}): http.Server {
  const token = opts.token ?? '';
  let generating: number | null = null;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const { pathname } = url;
    const m = req.method || 'GET';

    if (token && url.searchParams.get('token') !== token) return json(res, 401, { error: 'Unauthorized' });

    if (m === 'GET' && (pathname === '/' || pathname === '/painel')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getPanelHtml(token));
      return;
    }

    if (m === 'GET' && pathname === '/api/options') {
      return json(res, 200, {
        tipos: VIDEO_TYPES,
        plataformas: PLATFORMS.map((p) => ({ id: p, label: PLATFORM_LABEL[p] })),
        idiomas: LANGUAGES.map((l) => ({ id: l, label: LANGUAGE_LABEL[l] })),
        status: CONTENT_STATUSES,
        marcas: brandIds(),
        tz: DEFAULT_TZ,
      });
    }

    if (m === 'GET' && pathname === '/api/dashboard') return json(res, 200, store.dashboard());
    if (m === 'GET' && pathname === '/api/metrics') return json(res, 200, store.metrics());

    if (m === 'GET' && pathname === '/api/items') {
      const g = (k: string): string | undefined => url.searchParams.get(k) || undefined;
      const items = store.list({
        plataforma: isP(g('plataforma')), idioma: isL(g('idioma')), status: isS(g('status')),
        tipo: (VIDEO_TYPES as string[]).includes(String(g('tipo'))) ? (g('tipo') as ContentItem['tipo']) : undefined,
        produto: g('produto'),
      });
      return json(res, 200, { items, generating });
    }

    if (m === 'GET' && pathname === '/api/calendar') {
      const start = url.searchParams.get('start') || ymd(new Date());
      const end = url.searchParams.get('end') || start;
      return json(res, 200, { items: store.calendarRange(start, end) });
    }

    if (m === 'GET' && pathname === '/api/logs') {
      const cid = url.searchParams.get('content_id');
      return json(res, 200, { logs: store.logs(cid ? Number(cid) : undefined) });
    }

    if (m === 'GET' && pathname === '/api/accounts') {
      return json(res, 200, { accounts: store.accountList(url.searchParams.get('ativo') === '1') });
    }

    if (m === 'POST' && pathname === '/api/accounts') {
      const b = await readJson(req);
      const nome = str(b.nome); const plataforma = String(b.plataforma); const idioma = String(b.idioma);
      if (!nome || !isPlatform(plataforma) || !isLanguage(idioma)) return json(res, 400, { error: 'dados inválidos' });
      return json(res, 200, { id: store.accountCreate({ nome, plataforma, idioma, ativo: b.ativo !== false }) });
    }

    const accId = pathname.match(/^\/api\/accounts\/(\d+)$/);
    if (m === 'POST' && accId) {
      const b = await readJson(req);
      const patch: Record<string, unknown> = {};
      if (str(b.nome)) patch.nome = str(b.nome);
      if (isPlatform(String(b.plataforma))) patch.plataforma = b.plataforma;
      if (isLanguage(String(b.idioma))) patch.idioma = b.idioma;
      if ('ativo' in b) patch.ativo = b.ativo ? 1 : 0;
      return json(res, 200, { ok: store.accountUpdate(Number(accId[1]), patch) });
    }
    const accDel = pathname.match(/^\/api\/accounts\/(\d+)\/delete$/);
    if (m === 'POST' && accDel) return json(res, 200, { ok: store.accountRemove(Number(accDel[1])) });

    if (m === 'POST' && pathname === '/api/items') {
      const input = sanitizeInput(await readJson(req));
      if (!input) return json(res, 400, { error: 'tema e plataforma são obrigatórios' });
      return json(res, 200, { id: store.create(input) });
    }

    const idItem = pathname.match(/^\/api\/items\/(\d+)$/);
    if (m === 'POST' && idItem) {
      return json(res, 200, { ok: store.update(Number(idItem[1]), sanitizePatch(await readJson(req))) });
    }

    const idDel = pathname.match(/^\/api\/items\/(\d+)\/delete$/);
    if (m === 'POST' && idDel) return json(res, 200, { ok: store.remove(Number(idDel[1])) });

    const idAg = pathname.match(/^\/api\/items\/(\d+)\/agendar$/);
    if (m === 'POST' && idAg) {
      const id = Number(idAg[1]);
      const it = store.get(id);
      if (!it) return json(res, 404, { error: 'não existe' });
      if (!it.publish_date) return json(res, 400, { error: 'defina data de publicação antes de agendar' });
      store.update(id, { status: 'agendado' });
      store.logEvent(id, 'agendamento', `${it.publish_date} ${it.publish_time ?? ''}`.trim());
      return json(res, 200, { ok: true });
    }

    const idDup = pathname.match(/^\/api\/items\/(\d+)\/duplicar$/);
    if (m === 'POST' && idDup) {
      const b = await readJson(req);
      const variacoes = Array.isArray(b.variacoes) ? (b.variacoes as BatchVariation[]).slice(0, 60) : [];
      if (!variacoes.length) return json(res, 400, { error: 'envie ao menos uma variação' });
      const ids = store.duplicate(Number(idDup[1]), variacoes);
      return json(res, 200, { ids });
    }

    const idGer = pathname.match(/^\/api\/items\/(\d+)\/gerar$/);
    if (m === 'POST' && idGer) {
      const id = Number(idGer[1]);
      const item = store.get(id);
      if (!item) return json(res, 404, { error: 'não existe' });
      if (!opts.generate) return json(res, 501, { error: 'geração não configurada' });
      if (generating !== null) return json(res, 409, { error: 'ocupado', busy: generating });

      generating = id;
      store.update(id, { status: 'gerando', error: null });
      store.logEvent(id, 'geracao', 'iniciada');
      json(res, 202, { ok: true });

      const onPhase = (s: ContentStatus): void => {
        store.update(id, { status: s });
        if (s === 'renderizando') store.logEvent(id, 'renderizacao', 'render iniciado');
      };
      opts.generate(item, { onPhase })
        .then((videoPath) => { store.update(id, { status: 'pronto', video_path: videoPath, error: null }); store.logEvent(id, 'renderizacao', `pronto: ${videoPath}`); })
        .catch((e) => { const msg = String((e as Error).message || e).slice(0, 300); store.update(id, { status: 'roteiro', error: msg }); store.logEvent(id, 'erro', msg); })
        .finally(() => { generating = null; });
      return;
    }

    return json(res, 404, { error: 'Not found' });
  });

  if (opts.port) server.listen(opts.port);
  return server;
}

const isP = (v?: string): ReturnType<typeof asPlat> => asPlat(v);
function asPlat(v?: string): ContentItem['plataforma'] | undefined { return v && isPlatform(v) ? v : undefined; }
const isL = (v?: string): ContentItem['idioma'] | undefined => (v && isLanguage(v) ? v : undefined);
const isS = (v?: string): ContentStatus | undefined => (v && isStatus(v) ? v : undefined);

// ─── HTML autocontido (funcional, sem foco em design) ────────────────────────

export function getPanelHtml(token = ''): string {
  return `<!DOCTYPE html>
<html lang="pt-br"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Centro de Operações — mkivideos</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0D1321;color:#E8ECF3;margin:0;padding:14px 18px;font-size:13px}
  h1{font-size:17px;margin:0 0 8px}
  .cards{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}
  .card{background:#172033;border:1px solid #2A3A5C;border-radius:8px;padding:9px 14px;min-width:96px}
  .card .n{font-size:22px;font-weight:700}.card .l{color:#8FA3BF;font-size:11px}
  .pending .n{color:#FFC300}.ready .n{color:#2EC4B6}.sched .n{color:#E8C84A}.pub .n{color:#7FB3FF}.week .n{color:#9EE6C9}
  .metrics{color:#8FA3BF;font-size:12px;margin:2px 0 10px}
  input,select,button,textarea{background:#172033;color:#E8ECF3;border:1px solid #2A3A5C;border-radius:6px;padding:5px 7px;font-size:12px}
  button{cursor:pointer}button:hover{border-color:#5B7299}
  button.go{border-color:#2EC4B6}button.ag{border-color:#E8C84A}button.del{border-color:#b05}
  .tabs{display:flex;gap:6px;margin:8px 0}.tabs button.active{border-color:#FFC300;color:#FFC300}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #243250;font-size:12px;vertical-align:top}
  th{color:#8FA3BF}
  .badge{padding:1px 6px;border-radius:8px;font-size:11px;background:#2A3A5C}
  .s-ideia{background:#3A3F4C}.s-roteiro{background:#4a3d1f}.s-gerando{background:#FFC300;color:#0D1321}.s-renderizando{background:#E8C84A;color:#0D1321}.s-pronto{background:#1f5a4a;color:#bff}.s-agendado{background:#5a521f;color:#ffe}.s-publicado{background:#1f3a5a;color:#bdf}
  fieldset{border:1px solid #2A3A5C;border-radius:8px;margin:8px 0;padding:8px 10px}
  fieldset .row{display:flex;gap:7px;flex-wrap:wrap;align-items:end}
  label{display:flex;flex-direction:column;font-size:10px;color:#8FA3BF;gap:2px}
  a{color:#7FB3FF}.muted{color:#8FA3BF}
  .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px}
  .cal .h{color:#8FA3BF;text-align:center;font-size:11px}
  .cal .d{background:#141d2e;border:1px solid #243250;border-radius:6px;min-height:54px;padding:4px 6px}
  .cal .d.empty{background:transparent;border:none}
  .cal .dn{color:#8FA3BF;font-size:11px}.cal .c{color:#FFC300;font-weight:700;font-size:16px}
  .cal-list .day{background:#141d2e;border:1px solid #243250;border-radius:6px;padding:6px 10px;margin-bottom:6px}
  .cal-list .day .d{color:#FFC300;font-weight:600}
</style></head><body>
<h1>🛰️ Centro de Operações de Conteúdo</h1>
<div class="cards" id="cards"></div>
<div class="metrics" id="metrics"></div>

<div class="tabs">
  <button id="t-lib" class="active" onclick="setTab('lib')">Biblioteca</button>
  <button id="t-cal" onclick="setTab('cal')">Calendário</button>
  <button id="t-acc" onclick="setTab('acc')">Contas</button>
  <button id="t-log" onclick="setTab('log')">Logs</button>
  <span class="muted" id="busy" style="margin-left:10px"></span>
</div>

<div id="view-lib">
  <fieldset><legend>Cadastrar conteúdo</legend><div class="row">
    <label>Tema<input id="f-tema" size="28" placeholder="Ex.: 5 formas de vender mais"></label>
    <label>Tipo<select id="f-tipo"></select></label>
    <label>Plataforma<select id="f-plataforma"></select></label>
    <label>Idioma<select id="f-idioma"></select></label>
    <label>Conta<select id="f-account"></select></label>
    <label>Produto<input id="f-produto" size="12" placeholder="(opc)"></label>
    <label>Data<input id="f-date" type="date"></label>
    <label>Hora<input id="f-time" type="time"></label>
    <label>Timezone<input id="f-tz" size="14"></label>
    <label>Marca<select id="f-marca"></select></label>
    <button onclick="criar()">+ Adicionar</button>
  </div></fieldset>

  <fieldset><legend>Filtros (biblioteca)</legend><div class="row">
    <select id="flt-plataforma" onchange="load()"><option value="">Plataforma</option></select>
    <select id="flt-idioma" onchange="load()"><option value="">Idioma</option></select>
    <select id="flt-tipo" onchange="load()"><option value="">Tipo</option></select>
    <select id="flt-status" onchange="load()"><option value="">Status</option></select>
    <input id="flt-produto" placeholder="produto…" oninput="debounced()">
    <button onclick="load()">↻</button>
  </div></fieldset>

  <fieldset><legend>Lote — duplicar (até ~30, variando tema | idioma | data)</legend><div class="row">
    <label>Base (#id)<input id="lote-base" size="6" placeholder="id"></label>
    <textarea id="lote-txt" rows="3" cols="48" placeholder="Um por linha:  tema | idioma | 2026-07-01"></textarea>
    <button onclick="duplicarLote()">Criar lote</button>
  </div></fieldset>

  <div id="lib-table"></div>
</div>

<div id="view-cal" style="display:none">
  <div class="tabs">
    <button id="c-hoje" class="active" onclick="setCal('hoje')">Hoje</button>
    <button id="c-semana" onclick="setCal('semana')">Semana</button>
    <button id="c-mes" onclick="setCal('mes')">Mês</button>
  </div>
  <div id="cal-body"></div>
</div>

<div id="view-acc" style="display:none">
  <fieldset><legend>Nova conta</legend><div class="row">
    <label>Nome<input id="a-nome" placeholder="TikTok PT"></label>
    <label>Plataforma<select id="a-plataforma"></select></label>
    <label>Idioma<select id="a-idioma"></select></label>
    <button onclick="addConta()">+ Conta</button>
  </div></fieldset>
  <div id="acc-table"></div>
</div>

<div id="view-log" style="display:none"><div id="log-table"></div></div>

<script>
const TOKEN=${JSON.stringify(token)};
const qs=TOKEN?('?token='+encodeURIComponent(TOKEN)):'';
const sep=TOKEN?'&':'?';
const PL=${JSON.stringify(PLATFORM_LABEL)}, LG=${JSON.stringify(LANGUAGE_LABEL)};
let OPTS={tipos:[],plataformas:[],idiomas:[],status:[],marcas:[],tz:'${DEFAULT_TZ}'};
let ACCOUNTS=[], TAB='lib', CAL='hoje', timer=null;
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function api(p,o){return fetch(p+qs,o).then(r=>r.json());}
function fill(el,items,gv,gl,ph){el.innerHTML=(ph?'<option value="">'+ph+'</option>':'')+items.map(i=>'<option value="'+esc(gv(i))+'">'+esc(gl(i))+'</option>').join('');}

async function boot(){
  OPTS=await api('/api/options');
  fill(document.getElementById('f-tipo'),OPTS.tipos,x=>x,x=>x);
  fill(document.getElementById('f-plataforma'),OPTS.plataformas,x=>x.id,x=>x.label);
  fill(document.getElementById('f-idioma'),OPTS.idiomas,x=>x.id,x=>x.label);
  fill(document.getElementById('f-marca'),OPTS.marcas,x=>x,x=>x,'(padrão)');
  fill(document.getElementById('a-plataforma'),OPTS.plataformas,x=>x.id,x=>x.label);
  fill(document.getElementById('a-idioma'),OPTS.idiomas,x=>x.id,x=>x.label);
  fill(document.getElementById('flt-plataforma'),OPTS.plataformas,x=>x.id,x=>x.label,'Plataforma');
  fill(document.getElementById('flt-idioma'),OPTS.idiomas,x=>x.id,x=>x.label,'Idioma');
  fill(document.getElementById('flt-tipo'),OPTS.tipos.map(t=>({id:t,l:t})),x=>x.id,x=>x.l,'Tipo');
  fill(document.getElementById('flt-status'),OPTS.status.map(s=>({id:s,l:s})),x=>x.id,x=>x.l,'Status');
  document.getElementById('f-tz').value=OPTS.tz;
  load();
}
function setTab(t){TAB=t;['lib','cal','acc','log'].forEach(x=>{document.getElementById('view-'+x).style.display=x===t?'':'none';document.getElementById('t-'+x).className=x===t?'active':'';});load();}
function setCal(c){CAL=c;['hoje','semana','mes'].forEach(x=>document.getElementById('c-'+x).className=x===c?'active':'');load();}
let dt=null;function debounced(){clearTimeout(dt);dt=setTimeout(load,350);}

async function load(){
  const d=await api('/api/dashboard');
  document.getElementById('cards').innerHTML=
    card('pending','Pendentes',d.pending)+card('ready','Prontos',d.ready)+card('sched','Agendados',d.scheduled)+card('pub','Publicados',d.published)+card('week','Esta semana',d.thisWeek);
  const mm=await api('/api/metrics');
  document.getElementById('metrics').textContent='Criados: '+mm.created+'  ·  '+OPTS.plataformas.map(p=>p.label+' '+(mm.byPlatform[p.id]||0)).join('  ·  ');
  ACCOUNTS=(await api('/api/accounts')).accounts;
  fill(document.getElementById('f-account'),ACCOUNTS,x=>x.id,x=>x.nome+(x.ativo?'':' (inativa)'),'(nenhuma)');
  if(TAB==='lib') await loadLib();
  if(TAB==='cal') await loadCal();
  if(TAB==='acc') renderAccounts();
  if(TAB==='log') await loadLogs();
}
function card(c,l,n){return '<div class="card '+c+'"><div class="n">'+n+'</div><div class="l">'+l+'</div></div>';}
function accName(id){const a=ACCOUNTS.find(x=>x.id===id);return a?a.nome:'';}

async function loadLib(){
  const q=[]; const f=id=>document.getElementById(id).value;
  if(f('flt-plataforma'))q.push('plataforma='+f('flt-plataforma'));
  if(f('flt-idioma'))q.push('idioma='+f('flt-idioma'));
  if(f('flt-tipo'))q.push('tipo='+f('flt-tipo'));
  if(f('flt-status'))q.push('status='+f('flt-status'));
  if(f('flt-produto'))q.push('produto='+encodeURIComponent(f('flt-produto')));
  const r=await fetch('/api/items'+qs+(q.length?sep+q.join('&'):''));
  const {items,generating}=await r.json();
  document.getElementById('busy').textContent=generating?('⏳ gerando #'+generating+'…'):'';
  const rows=items.map(it=>{
    const vid=it.video_path?'<a href="#" title="'+esc(it.video_path)+'">✔</a>':(it.error?'<span class="muted" title="'+esc(it.error)+'">erro</span>':'—');
    const ger=(it.status==='ideia'||it.status==='roteiro')?'<button class="go" onclick="gerar('+it.id+')">Gerar</button>':'';
    const ag=(it.status==='pronto')?'<button class="ag" onclick="agendar('+it.id+')">Agendar</button>':'';
    return '<tr><td>'+(esc(it.publish_date)||'—')+'</td><td>'+(esc(it.publish_time)||'')+'</td><td>#'+it.id+' '+esc(it.tema)+'</td>'
      +'<td>'+esc(it.tipo)+'</td><td>'+esc(PL[it.plataforma]||it.plataforma)+'</td><td>'+esc(LG[it.idioma]||it.idioma)+'</td>'
      +'<td>'+esc(accName(it.account_id)||'—')+'</td><td>'+(esc(it.produto)||'—')+'</td>'
      +'<td>'+statusSel(it)+'</td><td>'+vid+'</td>'
      +'<td>'+ger+' '+ag+' <button class="del" onclick="excluir('+it.id+')">✕</button></td></tr>';
  }).join('');
  document.getElementById('lib-table').innerHTML=
    '<table><thead><tr><th>Data</th><th>Hora</th><th>Tema</th><th>Tipo</th><th>Plat</th><th>Idioma</th><th>Conta</th><th>Produto</th><th>Status</th><th>Vídeo</th><th>Ações</th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="11" class="muted">Sem itens.</td></tr>')+'</tbody></table>';
}
function statusSel(it){return '<select onchange="setStatus('+it.id+',this.value)">'+OPTS.status.map(s=>'<option '+(s===it.status?'selected':'')+'>'+s+'</option>').join('')+'</select>';}

function isoLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function weekBounds(ref){const d=new Date(ref);const o=(d.getDay()+6)%7;const s=new Date(d);s.setDate(d.getDate()-o);const e=new Date(s);e.setDate(s.getDate()+6);return[s,e];}
async function loadCal(){
  const today=new Date();let start,end;
  if(CAL==='hoje'){start=end=isoLocal(today);}
  else if(CAL==='semana'){const[s,e]=weekBounds(today);start=isoLocal(s);end=isoLocal(e);}
  else{start=isoLocal(new Date(today.getFullYear(),today.getMonth(),1));end=isoLocal(new Date(today.getFullYear(),today.getMonth()+1,0));}
  const {items}=await fetch('/api/calendar'+qs+sep+'start='+start+'&end='+end).then(r=>r.json());
  const data=items||[];
  if(CAL==='mes')renderMonth(today,data); else renderCalList(data);
}
function byDay(items){const m={};items.forEach(it=>{(m[it.publish_date]=m[it.publish_date]||[]).push(it);});return m;}
function renderCalList(items){
  const m=byDay(items);const days=Object.keys(m).sort();
  document.getElementById('cal-body').innerHTML='<div class="cal-list">'+(days.length?days.map(d=>
    '<div class="day"><div class="d">📅 '+esc(d)+' — '+m[d].length+' vídeo(s)</div>'+m[d].map(it=>
      '<div class="muted">'+(esc(it.publish_time)||'--:--')+' · <span class="badge s-'+it.status+'">'+it.status+'</span> · '+esc(PL[it.plataforma]||it.plataforma)+' · '+esc(LG[it.idioma]||it.idioma)+' · '+esc(it.tema)+'</div>'
    ).join('')+'</div>').join(''):'<p class="muted">Nada agendado neste período.</p>')+'</div>';
}
function renderMonth(ref,items){
  const m=byDay(items);const y=ref.getFullYear(),mo=ref.getMonth();
  const first=new Date(y,mo,1);const offset=(first.getDay()+6)%7;const days=new Date(y,mo+1,0).getDate();
  const H=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  let cells=H.map(h=>'<div class="h">'+h+'</div>').join('');
  for(let i=0;i<offset;i++)cells+='<div class="d empty"></div>';
  for(let dd=1;dd<=days;dd++){const ds=isoLocal(new Date(y,mo,dd));const c=(m[ds]||[]).length;
    cells+='<div class="d"><div class="dn">'+dd+'</div>'+(c?'<div class="c">'+c+'</div>':'')+'</div>';}
  document.getElementById('cal-body').innerHTML='<div class="muted">'+(mo+1)+'/'+y+'</div><div class="cal">'+cells+'</div>';
}

function renderAccounts(){
  const rows=ACCOUNTS.map(a=>
    '<tr><td>#'+a.id+'</td><td>'+esc(a.nome)+'</td><td>'+esc(PL[a.plataforma]||a.plataforma)+'</td><td>'+esc(LG[a.idioma]||a.idioma)+'</td>'
    +'<td>'+(a.ativo?'✅':'⛔')+'</td><td><button onclick="toggleConta('+a.id+','+(a.ativo?0:1)+')">'+(a.ativo?'Desativar':'Ativar')+'</button> <button class="del" onclick="delConta('+a.id+')">✕</button></td></tr>'
  ).join('');
  document.getElementById('acc-table').innerHTML='<table><thead><tr><th>#</th><th>Nome</th><th>Plataforma</th><th>Idioma</th><th>Ativa</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="muted">Sem contas.</td></tr>')+'</tbody></table>';
}
async function loadLogs(){
  const {logs}=await api('/api/logs');
  document.getElementById('log-table').innerHTML='<table><thead><tr><th>Quando</th><th>Conteúdo</th><th>Evento</th><th>Detalhe</th></tr></thead><tbody>'
    +(logs.map(l=>'<tr><td>'+new Date(l.created_at*1000).toLocaleString()+'</td><td>'+(l.content_id?('#'+l.content_id):'—')+'</td><td><span class="badge">'+esc(l.event)+'</span></td><td class="muted">'+esc(l.detail)+'</td></tr>').join('')||'<tr><td colspan="4" class="muted">Sem logs.</td></tr>')+'</tbody></table>';
}

const v=id=>document.getElementById(id).value;
async function criar(){
  const body={tema:v('f-tema'),tipo:v('f-tipo'),plataforma:v('f-plataforma'),idioma:v('f-idioma'),account_id:v('f-account'),
    produto:v('f-produto'),publish_date:v('f-date'),publish_time:v('f-time'),timezone:v('f-tz'),marca:v('f-marca')};
  if(!body.tema){alert('Informe o tema');return;}
  const r=await api('/api/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(r.error){alert(r.error);return;}
  document.getElementById('f-tema').value='';document.getElementById('f-produto').value='';
  load();
}
async function setStatus(id,status){await api('/api/items/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});load();}
async function gerar(id){const r=await api('/api/items/'+id+'/gerar',{method:'POST'});if(r&&r.error)alert('Não gerou: '+r.error);load();}
async function agendar(id){const r=await api('/api/items/'+id+'/agendar',{method:'POST'});if(r&&r.error)alert(r.error);load();}
async function excluir(id){if(!confirm('Excluir #'+id+'?'))return;await api('/api/items/'+id+'/delete',{method:'POST'});load();}
async function duplicarLote(){
  const base=parseInt(v('lote-base'));if(!base){alert('Informe o #id base');return;}
  const variacoes=v('lote-txt').split('\\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    const[tema,idioma,data]=l.split('|').map(s=>(s||'').trim());
    const o={};if(tema)o.tema=tema;if(idioma)o.idioma=idioma;if(data)o.publish_date=data;return o;});
  if(!variacoes.length){alert('Adicione ao menos uma linha');return;}
  const r=await api('/api/items/'+base+'/duplicar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variacoes})});
  if(r.error){alert(r.error);return;}
  document.getElementById('lote-txt').value='';alert('Criados: '+(r.ids||[]).length);load();
}
async function addConta(){
  const body={nome:v('a-nome'),plataforma:v('a-plataforma'),idioma:v('a-idioma')};
  if(!body.nome){alert('Nome da conta');return;}
  const r=await api('/api/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(r.error){alert(r.error);return;}document.getElementById('a-nome').value='';load();
}
async function toggleConta(id,ativo){await api('/api/accounts/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ativo:!!ativo})});load();}
async function delConta(id){if(!confirm('Excluir conta #'+id+'?'))return;await api('/api/accounts/'+id+'/delete',{method:'POST'});load();}

boot(); setInterval(load,5000);
</script></body></html>`;
}
