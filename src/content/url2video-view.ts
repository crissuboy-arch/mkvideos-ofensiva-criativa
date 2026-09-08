// HTML + JS da aba "URL → Vídeo" do painel do MKVideos.
// Usa os tokens visuais do próprio painel (navy + #FFC300 + #2EC4B6) — a UI
// original do Content2Video NÃO é servida; esta é a identidade do MKVideos.

export const URL2VIDEO_STYLE = `
  #view-u2v .u2v-grid{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:14px;align-items:start}
  @media(max-width:820px){#view-u2v .u2v-grid{grid-template-columns:1fr}}
  #view-u2v .u2v-form label{margin-bottom:6px}
  #view-u2v textarea{width:100%;resize:vertical;font-family:inherit}
  #view-u2v .u2v-radios{display:flex;gap:8px}
  #view-u2v .u2v-radios label{flex-direction:row;align-items:center;gap:4px;color:#E8ECF3}
  #view-u2v .u2v-status{font-size:11px;margin:4px 0 8px}
  #view-u2v .u2v-status .ok{color:#2EC4B6}#view-u2v .u2v-status .bad{color:#FF8A8A}
  #view-u2v .job,#view-u2v .proj{background:#141d2e;border:1px solid #243250;border-radius:8px;padding:8px 10px;margin-bottom:8px}
  #view-u2v .job .top,#view-u2v .proj .top{display:flex;justify-content:space-between;gap:8px;align-items:center}
  #view-u2v .phases{list-style:none;display:flex;flex-wrap:wrap;gap:4px 10px;padding:0;margin:6px 0;font-size:11px;color:#8FA3BF}
  #view-u2v .phases li.done{color:#9EE6C9}#view-u2v .phases li.current{color:#FFC300;font-weight:700}
  #view-u2v .phases li.reused{color:#7FB3FF;font-style:italic}
  #view-u2v .gate{display:flex;gap:10px;margin-top:8px}
  #view-u2v .gate img{max-width:170px;border:1px solid #2A3A5C;border-radius:6px}
  #view-u2v .proj .renders a{display:inline-block;margin-right:8px}
  #view-u2v .proj .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  #view-u2v .u2v-cmd{margin-top:6px;display:none}
  #view-u2v .u2v-cmd.open{display:block}
`;

export const URL2VIDEO_TAB_BUTTON = `<button id="t-u2v" onclick="setTab('u2v')">URL → Vídeo</button>`;

export const URL2VIDEO_VIEW_HTML = `
<div id="view-u2v" style="display:none">
  <div class="u2v-status" id="u2v-status">verificando motor…</div>
  <div class="u2v-grid">
    <fieldset class="u2v-form"><legend>Novo vídeo a partir de uma URL</legend>
      <label>Link da página / artigo / produto
        <input id="u2v-url" type="url" placeholder="https://exemplo.com/materia">
      </label>
      <label>Objetivo do vídeo (opcional)
        <textarea id="u2v-obj" rows="2" maxlength="4000" placeholder="Ex.: explique para pequenos empresários, foco no impacto prático, sem sensacionalismo."></textarea>
      </label>
      <label>Formato
        <span class="u2v-radios">
          <label><input type="radio" name="u2v-fmt" value="9:16" checked> 9:16 vertical</label>
          <label><input type="radio" name="u2v-fmt" value="16:9"> 16:9 horizontal</label>
        </span>
      </label>
      <label>Estilo de linguagem
        <select id="u2v-style">
          <option value="popular">Popular e simples</option>
          <option value="natural">Conversa natural</option>
          <option value="technical">Técnico e detalhado</option>
        </select>
      </label>
      <label>Ritmo da narração
        <select id="u2v-pace">
          <option value="calm">Calma (-10%)</option>
          <option value="natural" selected>Natural</option>
          <option value="fast">Rápida (+12%)</option>
        </select>
      </label>
      <label>Preset visual
        <select id="u2v-preset"></select>
      </label>
      <label style="flex-direction:row;gap:6px;align-items:center;color:#E8ECF3">
        <input id="u2v-cta" type="checkbox" checked> Adicionar CTA da marca ao final
      </label>
      <button class="go" onclick="u2vStart()" id="u2v-go" style="margin-top:6px">Analisar e criar direção visual</button>
      <div class="muted" id="u2v-msg" style="font-size:11px;margin-top:4px"></div>
    </fieldset>

    <div>
      <h3 style="font-size:13px;margin:0 0 6px">Produção</h3>
      <div id="u2v-jobs"><span class="muted">Nenhuma produção nesta sessão.</span></div>
      <h3 style="font-size:13px;margin:12px 0 6px">Seus vídeos</h3>
      <div id="u2v-projects"><span class="muted">Nenhum projeto ainda.</span></div>
    </div>
  </div>
</div>`;

/** JS injetado no <script> do painel. Depende de: api(), esc(), qs, sep, TAB. */
export const URL2VIDEO_SCRIPT = `
let U2V_CFG=null;
async function u2vLoadStatus(){
  try{
    const s=await api('/api/url2video/status');
    U2V_CFG=s.config;
    const h=s.health||{};
    const el=document.getElementById('u2v-status');
    el.innerHTML = h.ready
      ? '<span class="ok">● motor pronto</span> — '+esc(h.message||'')+' · '+esc(s.engine)
      : '<span class="bad">● motor indisponível</span> — '+esc(h.message||'')+' (rode <code>mkivideos doctor</code>)';
    const sel=document.getElementById('u2v-preset');
    const presets=(U2V_CFG&&U2V_CFG.visualPresets)||[];
    sel.innerHTML=presets.length?presets.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join(''):'<option value="">(automático)</option>';
    if(U2V_CFG&&U2V_CFG.defaultVisualPresetId)sel.value=U2V_CFG.defaultVisualPresetId;
    const d=s.defaults||{};
    if(d.aspectRatio)document.querySelectorAll('input[name=u2v-fmt]').forEach(r=>r.checked=r.value===d.aspectRatio);
    if(d.conversationStyle)document.getElementById('u2v-style').value=d.conversationStyle;
    if(d.speechPace)document.getElementById('u2v-pace').value=d.speechPace;
    if(typeof d.includeCta==='boolean')document.getElementById('u2v-cta').checked=d.includeCta;
  }catch(e){ document.getElementById('u2v-status').innerHTML='<span class="bad">● '+esc(e.message)+'</span>'; }
}
async function u2vStart(){
  const btn=document.getElementById('u2v-go'), msg=document.getElementById('u2v-msg');
  const body={
    url:document.getElementById('u2v-url').value.trim(),
    objetivo:document.getElementById('u2v-obj').value.trim(),
    formato:(document.querySelector('input[name=u2v-fmt]:checked')||{}).value,
    estilo:document.getElementById('u2v-style').value,
    ritmo:document.getElementById('u2v-pace').value,
    preset:document.getElementById('u2v-preset').value,
    cta:document.getElementById('u2v-cta').checked
  };
  if(!body.url){msg.textContent='Informe a URL.';return;}
  btn.disabled=true;msg.textContent='Analisando a página e montando a direção visual…';
  try{
    await api('/api/url2video/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    document.getElementById('u2v-url').value='';document.getElementById('u2v-obj').value='';
    msg.textContent='Direção iniciada. A produção completa aguarda sua aprovação da cena-piloto.';
    u2vLoad();
  }catch(e){ msg.textContent='Erro: '+e.message; }
  finally{ btn.disabled=false; }
}
function u2vJobAction(id,action,mode){
  const body=mode?JSON.stringify({mode}):'{}';
  return api('/api/url2video/jobs/'+id+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body}).then(u2vLoad).catch(e=>alert(e.message));
}
function u2vProjAction(slug,action){
  return api('/api/url2video/projects/'+slug+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
}
async function u2vEditor(slug){
  try{ const r=await u2vProjAction(slug,'editor'); window.open(r.url,'_blank'); }
  catch(e){ alert(e.message); }
}
async function u2vRender(slug){
  try{ await u2vProjAction(slug,'render'); u2vLoad(); }catch(e){ alert(e.message); }
}
function u2vToggleCmd(slug,mode){
  const box=document.getElementById('u2v-cmd-'+slug);
  if(box){ box.dataset.mode=mode; box.classList.toggle('open'); }
}
async function u2vApplyCmd(slug){
  const box=document.getElementById('u2v-cmd-'+slug);
  const instr=box.querySelector('textarea').value.trim();
  if(instr.length<3){alert('Descreva a mudança.');return;}
  try{
    await api('/api/url2video/projects/'+slug+'/'+box.dataset.mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instrucoes:instr})});
    box.classList.remove('open');u2vLoad();
  }catch(e){ alert(e.message); }
}
function u2vPhases(job){
  return '<ol class="phases">'+job.phases.map((p,i)=>{
    const reused=(job.skippedPhases||[]).includes(i);
    const cls=reused?'reused':(i===job.phaseIndex?'current':(i<job.phaseIndex?'done':''));
    return '<li class="'+cls+'">'+esc(p)+(reused?' (reutilizada)':'')+'</li>';
  }).join('')+'</ol>';
}
function u2vRenderJobs(jobs){
  const box=document.getElementById('u2v-jobs');
  if(!jobs.length){box.innerHTML='<span class="muted">Nenhuma produção nesta sessão.</span>';return;}
  box.innerHTML=jobs.map(j=>{
    const gate=(j.status==='awaiting_approval'&&j.visualGatePreviewUrl)?
      '<div class="gate"><img src="/api/url2video/media'+qs+sep+'src='+encodeURIComponent(j.visualGatePreviewUrl.replace(/^\\//,''))+'" alt="cena-piloto">'
      +'<div><div class="muted">Preset: '+esc(j.visualPresetName||'—')+'</div>'
      +'<button class="go" onclick="u2vJobAction(\\''+j.id+'\\',\\'approve\\')">Aprovar visual e produzir</button> '
      +'<button onclick="u2vJobAction(\\''+j.id+'\\',\\'regenerate\\')">Atualizar cena-piloto</button></div></div>':'';
    const retry=j.retryable?
      (j.resumeAvailable
        ? '<button class="go" onclick="u2vJobAction(\\''+j.id+'\\',\\'retry\\',\\'resume\\')">Continuar de onde parou</button> <button onclick="u2vJobAction(\\''+j.id+'\\',\\'retry\\',\\'restart\\')">Refazer render</button>'
        : '<button class="go" onclick="u2vJobAction(\\''+j.id+'\\',\\'retry\\',\\'restart\\')">Tentar novamente</button>'):'';
    const cancel=j.cancelable?'<button class="del" onclick="u2vJobAction(\\''+j.id+'\\',\\'cancel\\')">Cancelar</button>':'';
    return '<div class="job"><div class="top"><b>'+esc(j.project)+'</b><span class="badge">'+esc(j.status)+'</span></div>'
      +'<div class="muted" style="font-size:11px">'+esc(j.stage)+(j.error?(' · '+esc(j.error)):'')+'</div>'
      +u2vPhases(j)
      +'<div style="font-size:11px" class="muted">'+esc(j.type)+' · '+esc(j.aspectRatio)+' · '+Math.round((j.totalDurationMs||0)/1000)+'s</div>'
      +gate+'<div style="margin-top:4px">'+retry+' '+cancel+'</div></div>';
  }).join('');
}
function u2vRenderProjects(projects){
  const box=document.getElementById('u2v-projects');
  if(!projects.length){box.innerHTML='<span class="muted">Nenhum projeto ainda.</span>';return;}
  box.innerHTML=projects.map(p=>{
    const rends=(p.renders||[]).map(r=>'<a href="/api/url2video/media'+qs+sep+'src='+encodeURIComponent(r.url.replace(/^\\//,''))+'" target="_blank">⬇ '+esc(r.name)+' ('+(r.size/1048576).toFixed(1)+' MB)</a>').join('')||'<span class="muted">sem MP4 ainda</span>';
    return '<div class="proj"><div class="top"><b>'+esc(p.name)+'</b><span class="muted" style="font-size:11px">'+esc(p.aspectRatio)+' · '+esc(p.visualPresetName||'')+'</span></div>'
      +'<div class="renders" style="font-size:11px;margin-top:4px">'+rends+'</div>'
      +'<div class="acts">'
      +'<button onclick="u2vEditor(\\''+p.slug+'\\')">Abrir editor</button>'
      +'<button onclick="u2vToggleCmd(\\''+p.slug+'\\',\\'edit\\')">Editar por prompt</button>'
      +'<button onclick="u2vToggleCmd(\\''+p.slug+'\\',\\'duplicate\\')">Criar cópia / variação</button>'
      +'<button class="go" onclick="u2vRender(\\''+p.slug+'\\')">Aprovar e renderizar</button>'
      +'</div>'
      +'<div class="u2v-cmd" id="u2v-cmd-'+p.slug+'" data-mode="edit"><textarea rows="2" placeholder="Ex.: retire a cena de preços, mantenha a voz, deixe o ritmo mais direto."></textarea>'
      +'<button class="go" onclick="u2vApplyCmd(\\''+p.slug+'\\')" style="margin-top:4px">Aplicar</button></div>'
      +'</div>';
  }).join('');
}
async function u2vLoad(){
  if(TAB!=='u2v')return;
  try{
    const [j,p]=await Promise.all([api('/api/url2video/jobs'),api('/api/url2video/projects')]);
    u2vRenderJobs(j.jobs||[]);u2vRenderProjects(p.projects||[]);
  }catch(e){ document.getElementById('u2v-jobs').innerHTML='<span class="muted">'+esc(e.message)+'</span>'; }
}
`;
