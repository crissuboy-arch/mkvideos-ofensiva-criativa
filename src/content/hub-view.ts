// HTML + JS das abas Música + Videoclipe / Otimizar Vídeo / Legendar / Biblioteca
// do painel do MKVideos. Tokens visuais do próprio painel — as UIs originais dos
// módulos NÃO são servidas. Depende de: api(), esc(), qs, sep, TAB (definidos em panel.ts).

export const HUB_STYLE = `
  .hub fieldset{margin:6px 0}
  .hub .row{display:flex;gap:7px;flex-wrap:wrap;align-items:end}
  .hub textarea{width:100%;font-family:inherit;background:#172033;color:#E8ECF3;border:1px solid #2A3A5C;border-radius:6px;padding:5px}
  .hub .card{background:#141d2e;border:1px solid #243250;border-radius:8px;padding:8px 10px;margin:6px 0}
  .hub .muted{color:#8FA3BF;font-size:11px}
  .hub .pay{border-color:#E8C84A}
  .hub .cost{color:#E8C84A;font-weight:700}
  .hub table{width:100%;border-collapse:collapse}
  .hub td,.hub th{padding:4px 6px;border-bottom:1px solid #243250;font-size:12px;text-align:left}
  .hub pre{background:#0d1526;border:1px solid #243250;border-radius:6px;padding:6px;max-height:230px;overflow:auto;font-size:11px}
  .hub .leg-q{margin:2px 0 8px;font-weight:700;font-size:13px}
  .hub .leg-src{background:#0d1526;border:1px solid #243250;border-radius:8px;padding:10px 12px}
  .hub .leg-opt{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
  .hub .leg-opt input[type=file]{display:none}
  .hub .leg-ou{text-align:center;color:#8FA3BF;font-size:11px;margin:8px 0;letter-spacing:1px}
  .hub #leg-file-nome{font-size:12px}
  .hub .badge{padding:1px 6px;border-radius:8px;font-size:10px;background:#2A3A5C}
  .hub .badge.gratis{background:#1f5a4a;color:#bff}
  .hub .badge.pago{background:#E8C84A;color:#0D1321;font-weight:700}
`;

export const HUB_TAB_BUTTONS = `
  <button id="t-mvd" onclick="setTab('mvd')">Música + Videoclipe</button>
  <button id="t-otv" onclick="setTab('otv')">Otimizar Vídeo</button>
  <button id="t-leg" onclick="setTab('leg')">Legendar</button>
  <button id="t-bib" onclick="setTab('bib')">Biblioteca</button>`;

export const HUB_VIEWS_HTML = `
<div id="view-mvd" class="hub" style="display:none">
  <fieldset><legend>Novo — Música + Videoclipe</legend>
    <label>Ideia / prompt <textarea id="mvd-sol" rows="2" placeholder="música de virada, rock feminino, sobre quem constrói em silêncio"></textarea></label>
    <div class="row">
      <label>Estilo <input id="mvd-estilo" placeholder="(opcional)"></label>
      <label>Idioma <input id="mvd-idioma" placeholder="pt-BR"></label>
      <label>Slug <input id="mvd-slug" placeholder="(opcional)"></label>
      <button class="go" onclick="mvdPlano()">Criar plano (não gasta)</button>
    </div>
    <div class="muted" id="mvd-msg"></div>
  </fieldset>
  <div class="row"><input id="mvd-open" placeholder="slug para abrir"><button onclick="mvdOpen()">Abrir produção</button></div>
  <div id="mvd-detail"></div>
  <h4 style="font-size:12px;margin:8px 0 4px">Produções</h4>
  <div id="mvd-list" class="muted">carregando…</div>
</div>

<div id="view-otv" class="hub" style="display:none">
  <fieldset><legend>Novo — Otimizar Vídeo</legend>
    <div class="row">
      <label>Vídeo (URL ou caminho local) <input id="otv-fonte" size="44" placeholder="C:\\videos\\aula.mp4"></label>
      <button class="go" onclick="otvIngest()">Ingerir (não gasta)</button>
    </div>
    <div class="muted" id="otv-msg"></div>
  </fieldset>
  <div class="row"><input id="otv-open" placeholder="id para abrir"><button onclick="otvOpen()">Abrir</button></div>
  <div id="otv-detail"></div>
  <h4 style="font-size:12px;margin:8px 0 4px">Trabalhos</h4>
  <div id="otv-list" class="muted">carregando…</div>
</div>

<div id="view-leg" class="hub" style="display:none">
  <fieldset><legend>Nova — Legendar vídeo</legend>
    <p class="leg-q">De onde vem seu vídeo?</p>
    <div class="leg-src">
      <div class="leg-opt">
        <button type="button" class="go" onclick="document.getElementById('leg-file').click()">📁 Escolher vídeo do computador</button>
        <input type="file" id="leg-file" accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm" onchange="legArquivoEscolhido()">
        <span id="leg-file-nome" class="muted">nenhum arquivo escolhido</span>
      </div>
      <div class="leg-ou">OU</div>
      <div class="leg-opt">
        <label style="flex:1">Cole o link do YouTube aqui
          <input id="leg-yt" size="44" placeholder="https://www.youtube.com/watch?v=..." oninput="legYtDigitado()">
        </label>
      </div>
    </div>
    <div class="row" style="margin-top:8px">
      <label>Título (opcional) <input id="leg-titulo" placeholder="(opcional)"></label>
      <button id="leg-criar" class="go" onclick="legCriarProjeto()">Criar projeto de legenda</button>
    </div>
    <div class="muted" id="leg-msg"></div>
  </fieldset>
  <div class="row"><input id="leg-open" placeholder="id para abrir"><button onclick="legOpen()">Abrir</button></div>
  <div id="leg-detail"></div>
  <h4 style="font-size:12px;margin:8px 0 4px">Projetos de legenda</h4>
  <div id="leg-list" class="muted">carregando…</div>
</div>

<div id="view-bib" class="hub" style="display:none">
  <div class="row"><button onclick="bibLoad()">↻ Atualizar biblioteca</button></div>
  <div id="bib-list" class="muted">carregando…</div>
</div>`;

export const HUB_SCRIPT = `
function hubErr(e){return (e&&e.error)?e.error:(e&&e.message)||'erro';}
async function hubPost(p,body){return api(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});}
function mediaUrl(src){return '/api/hub/media'+qs+sep+'src='+encodeURIComponent(src);}

// ---- Música + Videoclipe ----
async function mvdPlano(){
  const msg=document.getElementById('mvd-msg');msg.textContent='criando plano…';
  const r=await hubPost('/api/hub/musicavideo/plano',{solicitacao:document.getElementById('mvd-sol').value,estilo:document.getElementById('mvd-estilo').value,idioma:document.getElementById('mvd-idioma').value,slug:document.getElementById('mvd-slug').value});
  msg.textContent=(r.stdout||r.stderr||r.error||'').slice(0,400);mvdList();
}
async function mvdList(){
  try{const {itens}=await api('/api/hub/musicavideo/lista');
    document.getElementById('mvd-list').innerHTML=(itens||[]).map(i=>'<div class="card"><b>'+esc(i.titulo||i.slug)+'</b> <span class="muted">'+esc(i.slug)+' · '+JSON.stringify(i.estados||{})+' · US$'+i.custo_gasto_usd+'</span> <button onclick="mvdOpen(\\''+i.slug+'\\')">abrir</button></div>').join('')||'<span class="muted">nenhuma produção</span>';
  }catch(e){document.getElementById('mvd-list').textContent=hubErr(e);}
}
async function mvdOpen(slug){
  slug=slug||document.getElementById('mvd-open').value.trim();if(!slug)return;
  const d=await api('/api/hub/musicavideo/producao'+qs.replace('?','?')+sep+'slug='+encodeURIComponent(slug)).catch(e=>({error:hubErr(e)}));
  const box=document.getElementById('mvd-detail');
  if(d.error){box.textContent=d.error;return;}
  const partes=['musica','capa','clipe'];
  const est=d.estado?d.estado.partes:{};
  let h='<div class="card"><b>'+esc(slug)+'</b><pre>'+esc(JSON.stringify(d.estado&&d.estado.custo_total_usd||{}, null, 1))+'</pre>';
  for(const p of partes){const e=est[p]||{};
    h+='<div class="row"><span>'+p+': <b>'+esc(e.estado||'—')+'</b> (est. US$'+(e.custo_estimado_usd||0)+')</span>';
    if(e.estado==='planejado')h+=' <button onclick="mvdAct(\\''+slug+'\\',\\'ok\\',\\''+p+'\\')">ok (portão do plano)</button>';
    if(e.estado==='aprovado'||e.estado==='erro')h+=' <button class="pay" onclick="mvdFaz(\\''+slug+'\\',\\''+p+'\\')">FAZER — gasta</button>';
    if(e.estado==='revisao'){h+=' <button onclick="mvdAprova(\\''+slug+'\\',\\''+p+'\\')">aprovar artefato</button> <button onclick="mvdReprova(\\''+slug+'\\',\\''+p+'\\')">reprovar</button>';}
    h+='</div>';
  }
  if(d.custo)h+='<div class="cost">custo estimado das partes pendentes: US$ '+d.custo.estimatedUsd.toFixed(4)+' ('+esc(d.custo.phase)+')</div>';
  h+='</div>';
  box.innerHTML=h;
}
async function mvdAct(slug,act,parte){const r=await hubPost('/api/hub/musicavideo/'+act,{slug,parte});alert((r.stdout||r.stderr||r.error||'ok').slice(0,300));mvdOpen(slug);}
async function mvdFaz(slug,parte){
  const d=await api('/api/hub/musicavideo/producao'+qs+sep+'slug='+encodeURIComponent(slug));
  const usd=d.custo?d.custo.estimatedUsd:0;
  if(!confirm('Isto vai GASTAR ~US$ '+usd.toFixed(4)+' (parte: '+parte+'). Confirmar?'))return;
  const r=await hubPost('/api/hub/musicavideo/faz',{slug,parte,confirm:true});
  alert((r.stdout||r.stderr||r.error||'iniciado').slice(0,400));mvdOpen(slug);
}
async function mvdAprova(slug,parte){const f=prompt('faixa 1 ou 2 (só para música; vazio = padrão)','');const r=await hubPost('/api/hub/musicavideo/aprova',{slug,parte,faixa:f==='1'?1:f==='2'?2:undefined});alert((r.stdout||r.stderr||r.error||'ok').slice(0,300));mvdOpen(slug);}
async function mvdReprova(slug,parte){const shots=prompt('shots a reprovar (ex: 4,17,23) — vazio reprova tudo','');const r=await hubPost('/api/hub/musicavideo/reprova',{slug,parte,shots});alert((r.stdout||r.stderr||r.error||'ok').slice(0,300));mvdOpen(slug);}

// ---- Otimizar Vídeo ----
async function otvIngest(){
  const msg=document.getElementById('otv-msg');msg.textContent='ingerindo…';
  const r=await hubPost('/api/hub/otimizevideo/ingest',{fonte:document.getElementById('otv-fonte').value});
  msg.textContent=('id: '+(r.id||'?')+' — '+(r.stdout||r.stderr||r.error||'')).slice(0,400);otvList();
}
async function otvList(){try{const {ids}=await api('/api/hub/otimizevideo/lista');document.getElementById('otv-list').innerHTML=(ids||[]).map(i=>'<div class="card">'+esc(i)+' <button onclick="otvOpen(\\''+i+'\\')">abrir</button></div>').join('')||'<span class="muted">nenhum</span>';}catch(e){document.getElementById('otv-list').textContent=hubErr(e);}}
async function otvOpen(id){
  id=id||document.getElementById('otv-open').value.trim();if(!id)return;
  const st=await api('/api/hub/otimizevideo/status'+qs+sep+'id='+encodeURIComponent(id)).catch(e=>({error:hubErr(e)}));
  const box=document.getElementById('otv-detail');
  if(st.error){box.textContent=st.error;return;}
  const fases=[['transcrever','groq — pago'],['cenas','local'],['classificar','glm — pago (modo B/C)'],['pontuar','glm — pago'],['selecionar','local, grátis'],['render','local, grátis'],['narrar','inemavox local']];
  let h='<div class="card"><b>'+esc(id)+'</b> <span class="muted">gasto real US$'+st.custoTotalUsd+'</span><pre>'+esc(JSON.stringify(st.artefatos,null,1))+'</pre>';
  h+='<div class="row">'+fases.map(f=>'<button class="'+(f[1].indexOf('pago')>=0?'pay':'')+'" onclick="otvFase(\\''+id+'\\',\\''+f[0]+'\\')">'+f[0]+'<br><small>'+f[1]+'</small></button>').join('')+'</div>';
  if(st.outputMp4)h+='<div><a target="_blank" href="'+mediaUrl(st.outputMp4)+'">▶ output.mp4</a></div>';
  h+='</div>';box.innerHTML=h;
}
async function otvFase(id,fase){
  const paga=['transcrever','classificar','pontuar','substituir'].indexOf(fase)>=0;
  let body={id,fase,modo:'A'};
  if(fase==='pontuar'||fase==='classificar')body.provedor='glm';
  if(fase==='transcrever')body.provedor='groq';
  if(paga){if(!confirm('A fase "'+fase+'" pode gerar cobrança de LLM/API. Confirmar o gasto?'))return;body.confirm=true;}
  const r=await hubPost('/api/hub/otimizevideo/fase',body);
  alert((r.stdout||r.stderr||r.error||'ok').slice(0,400));otvOpen(id);
}

// ---- Legendar ----
let legFile=null;
function legArquivoEscolhido(){
  const i=document.getElementById('leg-file');
  legFile=(i.files&&i.files[0])||null;
  document.getElementById('leg-file-nome').textContent=legFile?legFile.name:'nenhum arquivo escolhido';
  if(legFile)document.getElementById('leg-yt').value='';
}
function legYtDigitado(){
  if(document.getElementById('leg-yt').value.trim()&&legFile){
    legFile=null;document.getElementById('leg-file').value='';
    document.getElementById('leg-file-nome').textContent='nenhum arquivo escolhido';
  }
}
async function legCriarProjeto(){
  const msg=document.getElementById('leg-msg');
  const btn=document.getElementById('leg-criar');
  const titulo=document.getElementById('leg-titulo').value.trim();
  const yt=document.getElementById('leg-yt').value.trim();
  let r;
  btn.disabled=true;
  try{
    if(legFile){
      if(!/\\.(mp4|mov|avi|mkv|webm)$/i.test(legFile.name)){msg.textContent='formato não aceito. Use MP4, MOV, AVI, MKV ou WebM.';return;}
      msg.textContent='enviando "'+legFile.name+'" ('+(legFile.size/1048576).toFixed(1)+' MB)…';
      const u='/api/hub/legendas/upload'+qs+sep+'name='+encodeURIComponent(legFile.name)+(titulo?'&titulo='+encodeURIComponent(titulo):'');
      r=await fetch(u,{method:'POST',headers:{'Content-Type':legFile.type||'application/octet-stream'},body:legFile}).then(x=>x.json());
    }else if(yt){
      msg.textContent='importando do YouTube… isso pode levar de 1 a 3 minutos.';
      r=await hubPost('/api/hub/legendas/youtube',{url:yt,titulo});
    }else{
      msg.textContent='escolha um vídeo do computador OU cole um link do YouTube.';return;
    }
    if(!r||r.error){msg.textContent='erro: '+((r&&r.error)||'falha na importação');return;}
    msg.textContent='projeto criado: '+(r.title||r.id);
    legFile=null;
    document.getElementById('leg-file').value='';document.getElementById('leg-yt').value='';
    document.getElementById('leg-titulo').value='';
    document.getElementById('leg-file-nome').textContent='nenhum arquivo escolhido';
    legList();if(r.id)legOpen(r.id);
  }catch(e){msg.textContent='erro: '+hubErr(e);}
  finally{btn.disabled=false;}
}
async function legList(){try{const {itens}=await api('/api/hub/legendas/lista');document.getElementById('leg-list').innerHTML=(itens||[]).map(p=>'<div class="card"><b>'+esc(p.title)+'</b> <span class="muted">'+esc(p.id)+' · '+p.cueCount+' legendas'+(p.burnedVideoPath?' · ✔queimado':'')+'</span> <button onclick="legOpen(\\''+p.id+'\\')">abrir</button></div>').join('')||'<span class="muted">nenhum</span>';}catch(e){document.getElementById('leg-list').textContent=hubErr(e);}}
async function legOpen(id){
  id=id||document.getElementById('leg-open').value.trim();if(!id)return;
  const d=await api('/api/hub/legendas/projeto'+qs+sep+'id='+encodeURIComponent(id)).catch(e=>({error:hubErr(e)}));
  const box=document.getElementById('leg-detail');
  if(d.error){box.textContent=d.error;return;}
  const p=d.projeto||{};
  let h='<div class="card"><b>'+esc(p.title||id)+'</b> <span class="muted">'+esc(p.transcriptProvider||'sem transcrição')+'</span>';
  h+='<div class="row"><button onclick="legTranscrever(\\''+id+'\\')">Transcrever…</button>';
  h+='<button onclick="legSync(\\''+id+'\\')">Sincronizar (deslocar)</button>';
  h+='<button class="go" onclick="legQueimar(\\''+id+'\\')">Queimar legenda no vídeo</button>';
  if(p.burnedVideoPath)h+=' <a target="_blank" href="'+mediaUrl(p.burnedVideoPath)+'">▶ final legendado</a>';
  h+='</div>';
  h+='<textarea id="leg-srt-'+id+'" rows="10">'+esc(d.srt||'')+'</textarea><button onclick="legSalvarSrt(\\''+id+'\\')">Salvar legendas editadas</button>';
  h+='</div>';box.innerHTML=h;
}
function legCusto(pr){
  if(pr.kind==='local')return 'grátis';
  if(pr.estimatedUsd==null)return 'estimativa indisponível';
  if(pr.estimatedUsd>=0.0001)return '~US$ '+Number(pr.estimatedUsd).toFixed(4);
  return '< US$ 0,0001';
}
async function legTranscrever(id){
  const box=document.getElementById('leg-detail');
  box.innerHTML='<div class="card">carregando opções de transcrição…</div>';
  let p;
  try{p=await api('/api/hub/legendas/transcricao-plano'+qs+sep+'id='+encodeURIComponent(id));}
  catch(e){box.innerHTML='<div class="card">erro: '+esc(hubErr(e))+' <button onclick="legOpen(\\''+id+'\\')">voltar</button></div>';return;}
  if(!p||p.error){box.innerHTML='<div class="card">erro: '+esc((p&&p.error)||'falha ao ler o plano')+' <button onclick="legOpen(\\''+id+'\\')">voltar</button></div>';return;}
  const local=(p.providers||[]).find(x=>x.kind==='local'&&x.available);
  const groq=(p.providers||[]).find(x=>x.id==='groq');
  let h='<div class="card"><b>Transcrever — de onde vem o texto?</b>';
  h+='<div class="muted">Duração do vídeo: '+esc(p.durationLabel||'desconhecida')+' · provedor recomendado: <b>'+esc(p.recommendedProviderId||'—')+'</b></div>';
  h+='<table><thead><tr><th>Provedor</th><th>Tipo</th><th>Custo estimado</th><th>Situação</th></tr></thead><tbody>';
  for(const pr of (p.providers||[])){
    const tag=pr.kind==='local'?'<span class="badge gratis">LOCAL/GRÁTIS</span>':'<span class="badge pago">PAGO</span>';
    const custo=legCusto(pr);
    const sit=pr.available?'<span style="color:#2EC4B6">pronto</span>':('<span class="muted">indisponível — '+esc(pr.missing||'')+'</span>');
    h+='<tr><td><b>'+esc(pr.label)+'</b><br><span class="muted">'+esc(pr.note||'')+'</span></td><td>'+tag+'</td><td>'+custo+'</td><td>'+sit+'</td></tr>';
  }
  h+='</tbody></table>';
  h+='<div class="row" style="margin-top:8px">';
  if(local)h+='<button class="go" onclick="legFazTranscricao(\\''+id+'\\',\\''+local.id+'\\',false)">Usar opção grátis/local — '+esc(local.label)+'</button>';
  if(groq&&groq.available)h+='<button class="pay" onclick="legFazTranscricao(\\''+id+'\\',\\'groq\\',true)">Usar Groq (pago · '+esc(legCusto(groq))+')</button>';
  h+='<button onclick="legOpen(\\''+id+'\\')">Cancelar</button>';
  h+='</div>';
  if(!local)h+='<div class="pay card" style="margin-top:8px">Nenhum provedor local pronto. '+esc(p.localHint||'')+'</div>';
  if(groq&&!groq.available)h+='<div class="muted" style="margin-top:4px">Groq indisponível: '+esc(groq.missing||'')+'</div>';
  h+='</div>';
  box.innerHTML=h;
}
async function legFazTranscricao(id,provedor,pago){
  const box=document.getElementById('leg-detail');
  box.innerHTML='<div class="card">transcrevendo com <b>'+esc(provedor)+'</b>… isso pode levar alguns minutos.</div>';
  const r=await hubPost('/api/hub/legendas/transcrever',{id,provedor,confirm:pago===true});
  if(r.error){
    box.innerHTML='<div class="card">erro: '+esc(r.error)+' <button onclick="legTranscrever(\\''+id+'\\')">voltar às opções</button></div>';
    return;
  }
  const n=r.cues?r.cues.length:(r.project&&r.project.cueCount);
  alert((n!=null?n:'?')+' legendas geradas com '+provedor);
  legOpen(id);
}
async function legSalvarSrt(id){const srt=document.getElementById('leg-srt-'+id).value;const r=await hubPost('/api/hub/legendas/cues',{id,srt});alert(r.error?r.error:'salvo ('+r.cueCount+' legendas)');legOpen(id);}
async function legSync(id){const s=prompt('deslocar as legendas em quantos segundos? (ex: -0.5 ou 1.2)','0');if(s===null)return;const r=await hubPost('/api/hub/legendas/sincronizar',{id,segundos:Number(s)});alert(r.error?r.error:'ok');legOpen(id);}
async function legQueimar(id){const r=await hubPost('/api/hub/legendas/queimar',{id});alert(r.error?('erro: '+r.error):('MP4 legendado: '+r.burnedVideoPath));legOpen(id);}

// ---- Biblioteca ----
async function bibLoad(){
  try{const {items}=await api('/api/hub/biblioteca');
    document.getElementById('bib-list').innerHTML='<table><thead><tr><th>Fonte</th><th>Título</th><th>Tamanho</th><th>Quando</th><th></th></tr></thead><tbody>'+
    (items||[]).map(i=>'<tr><td>'+esc(i.source)+'</td><td>'+esc(i.title)+'</td><td>'+(i.sizeBytes/1048576).toFixed(1)+' MB</td><td class="muted">'+esc(i.modifiedAt.slice(0,16).replace('T',' '))+'</td><td><a target="_blank" href="'+mediaUrl(i.videoPath)+'">▶ abrir</a></td></tr>').join('')+
    '</tbody></table>'+((items||[]).length?'':'<span class="muted">biblioteca vazia</span>');
  }catch(e){document.getElementById('bib-list').textContent=hubErr(e);}
}
`;
