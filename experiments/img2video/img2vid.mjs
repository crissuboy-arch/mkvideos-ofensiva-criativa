#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// img2vid — prova mínima de IMAGEM → VÍDEO 9:16, custo ~zero, PC fraco, offline.
//
// NÃO é o pixflow-motion real (Depth-Anything → WebGL → Remotion). É o "adaptador
// equivalente local" descrito na análise: só FFmpeg + SAPI (voz PT-BR do Windows).
// A interface (render por imagem + motion + narração + legenda) é a mesma, então o
// pixflow real pode entrar atrás dela depois, sem mexer no resto.
//
// Movimentos (preset --motion): kenburns | zoomin | zoomout | panL | panR |
//                               panU | panD | parallax | slow
//
// MODO PASTA (novo) — uma pasta de imagens numeradas + UM prompt de movimento:
//   node img2vid.mjs dir ./minha-pasta --style "câmera lenta cinematográfica, zoom suave"
//   • lê 001.png, 002.png, … em ordem numérica
//   • o prompt define o "clima" → cada cena recebe um movimento DIFERENTE e coerente
//   • narração: --narr "…" ou arquivo  <pasta>/narracao.txt
//   • legenda:  --cap "…" (repetível), arquivo <pasta>/legendas.txt (1 linha/cena),
//               ou — se nada disso — fatiada automaticamente da narração
//   • movimento: --style "…" ou arquivo <pasta>/movimento.txt
//
// MODO MANUAL (compatível):
//   node img2vid.mjs --img a.jpg --motion kenburns --narr "texto" --cap "legenda"
//   node img2vid.mjs --img 1.jpg --img 2.jpg ... --motion kenburns,zoomin,panR --narr "..."
//   node img2vid.mjs selftest          # gera imagens sintéticas e roda as provas
//
// Flags:
//   --dir P        pasta com imagens numeradas (alternativa ao subcomando "dir")
//   --style T      UM prompt de movimento em linguagem natural (PT-BR)
//   --img P        (repetível) imagem de entrada (modo manual)
//   --motion M     preset, ou lista separada por vírgula (cicla pelas imagens)
//   --cap T        (repetível) legenda por imagem; 1 só → aplica em todas
//   --narr T       narração PT-BR via SAPI Maria (define a duração total)
//   --audio P      usa um .wav pronto em vez de gerar narração
//   --intensity N  força a intensidade do movimento 0..1 (sobrepõe o --style)
//   --dur N        duração por imagem quando não há áudio (default 4s)
//   --out P        arquivo de saída (default out/saida.mp4; em modo pasta: <pasta>.mp4)
//   --size WxH     default 1080x1920  (use 720x1280 em PC bem fraco)
//   --fps N        default 30
//   --xfade N      duração da transição entre cenas na sequência (default 0.6s)
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const ASSETS = path.join(HERE, '_assets');
const TMP = path.join(HERE, '.tmp');

// ── localizar ffmpeg / ffprobe (PATH → winget) ───────────────────────────────
const WINGET = 'C:/Users/Evand/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin';
function tool(name) {
  const probe = spawnSync(name, ['-version'], { encoding: 'utf8' });
  if (probe.status === 0) return name;
  const winget = path.join(WINGET, name + '.exe');
  if (existsSync(winget)) return winget;
  throw new Error(`não encontrei ${name} (nem no PATH nem em ${WINGET})`);
}
const FFMPEG = tool('ffmpeg');
const FFPROBE = tool('ffprobe');
// O parser de filtros do ffmpeg engasga com o ':' do caminho do Windows (C:/...).
// Solução: copiar a fonte pra cá e referenciar por caminho RELATIVO (sem unidade),
// rodando o ffmpeg com cwd = HERE. Idem para o textfile da legenda.
const FONT = '_assets/font.ttf';
function ensureFont() {
  mkdirSync(ASSETS, { recursive: true });
  const dst = path.join(ASSETS, 'font.ttf');
  if (!existsSync(dst)) copyFileSync('C:/Windows/Fonts/segoeui.ttf', dst);
}
function rel(p) { return path.relative(HERE, p).replace(/\\/g, '/'); }

// ── helpers ──────────────────────────────────────────────────────────────────
function run(bin, args, label) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: HERE });
  if (r.status !== 0) {
    console.error(`\n✗ falhou: ${label}`);
    console.error((r.stderr || r.stdout || '').split('\n').slice(-25).join('\n'));
    process.exit(1);
  }
  return r;
}
function ff(args, label) { return run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], label); }
function probeDuration(file) {
  const r = run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 'ffprobe');
  return parseFloat(r.stdout.trim()) || 0;
}
function wrap(text, max = 24) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) { if (line) lines.push(line); line = w; }
    else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  return lines.join('\n');
}
const dedupe = arr => [...new Set(arr)];
function readIf(p) { return existsSync(p) ? readFileSync(p, 'utf8') : ''; }

// ── narração PT-BR via Windows SAPI (Microsoft Maria) ────────────────────────
function sapiTTS(text, outWav) {
  const txtFile = outWav.replace(/\.wav$/, '.txt');
  const ps1 = outWav.replace(/\.wav$/, '.ps1');
  writeFileSync(txtFile, text, 'utf8');
  // lê o texto de arquivo (sem dor de cabeça com aspas/acentos) e fala com a Maria.
  const script = [
    `Add-Type -AssemblyName System.Speech`,
    `$t = [IO.File]::ReadAllText(${JSON.stringify(txtFile)}, [Text.Encoding]::UTF8)`,
    `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer`,
    `try { $s.SelectVoice('Microsoft Maria Desktop') } catch {}`,
    `$s.Rate = 0`,
    `$s.SetOutputToWaveFile(${JSON.stringify(outWav)})`,
    `$s.Speak($t)`,
    `$s.Dispose()`,
  ].join('\n');
  writeFileSync(ps1, script, 'utf8');
  run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], 'SAPI TTS');
  return outWav;
}

// ── interpretação do prompt de movimento (PT-BR → "mood") ─────────────────────
// Um único prompt em linguagem natural vira: intensidade do movimento, pool de
// presets coerentes com o clima, tipo e duração da transição entre cenas.
function interpretStyle(prompt) {
  const s = (prompt || '').toLowerCase();
  const has = (...keys) => keys.some(k => s.includes(k));
  // default: cinematográfico neutro
  const mood = {
    intensity: 0.6,
    pool: ['kenburns', 'zoomin', 'panR', 'parallax', 'slow'],
    transition: 'fade',
    xfade: 0.6,
  };
  // clima lento / delicado / cinematográfico (ex.: "novela coreana")
  if (has('lenta', 'lento', 'slow', 'delicad', 'suave', 'calm', 'sutil', 'gentil', 'gentle',
          'novela', 'corean', 'cinemato', 'cinematic', 'elegante', 'sofisticad', 'emotiv', 'sonho')) {
    mood.intensity = 0.35;
    mood.xfade = 0.9;
    mood.pool = ['slow', 'kenburns', 'zoomin', 'parallax', 'panR'];
    mood.transition = 'fade';
  }
  // clima rápido / energético / impacto
  if (has('rápid', 'rapid', 'energ', 'dinâmic', 'dinamic', 'agressiv', 'punch',
          'vibrant', 'impacto', 'acelera', 'intens')) {
    mood.intensity = 0.95;
    mood.xfade = 0.35;
    mood.pool = ['zoomin', 'zoomout', 'panR', 'panL', 'kenburns'];
    mood.transition = 'slideleft';
  }
  // ênfases pontuais (somam ao pool, mantêm o clima)
  if (has('zoom')) mood.pool = dedupe(['zoomin', 'zoomout', ...mood.pool]);
  if (has('pan', 'lateral', 'horizontal', 'desliz', 'varredura', 'travelling', 'traveling'))
    mood.pool = dedupe(['panR', 'panL', 'panU', 'panD', ...mood.pool]);
  if (has('parallax', 'paralax', 'profundidade', '3d', 'camada', 'depth'))
    mood.pool = dedupe(['parallax', ...mood.pool]);
  // transição explícita
  if (has('sem transi', 'corte seco', 'hard cut')) { mood.transition = 'fade'; mood.xfade = 0.06; }
  if (has('fade preto', 'fade-to-black', 'escurece', 'breca')) mood.transition = 'fadeblack';
  if (has('dissolv')) mood.transition = 'dissolve';
  if (has('limpa', 'wipe')) mood.transition = 'wiperight';
  return mood;
}

// distribui movimentos DIFERENTES por cena, evitando repetir o anterior
function planMotions(pool, N) {
  const out = [];
  for (let i = 0; i < N; i++) {
    let pick = pool[i % pool.length];
    if (i > 0 && pick === out[i - 1] && pool.length > 1) {
      pick = pool[(i + 1) % pool.length];
      if (pick === out[i - 1]) pick = pool[(i + 2) % pool.length];
    }
    out.push(pick);
  }
  return out;
}

// fatia a narração em N legendas aproximadamente iguais (sincronia por cena)
function autoCaptions(narr, N) {
  const clean = String(narr).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const per = Math.max(1, Math.ceil(words.length / N));
  const caps = [];
  for (let i = 0; i < N; i++) caps.push(words.slice(i * per, (i + 1) * per).join(' '));
  return caps.slice(0, N);
}

// lista imagens numeradas da pasta, em ordem numérica natural
function listImages(dir) {
  const files = readdirSync(dir).filter(f => /\.(png|jpe?g|webp|bmp)$/i.test(f));
  files.sort((a, b) => {
    const na = parseInt((a.match(/\d+/) || ['0'])[0], 10);
    const nb = parseInt((b.match(/\d+/) || ['0'])[0], 10);
    return na - nb || a.localeCompare(b);
  });
  return files.map(f => path.join(dir, f));
}

// ── expressão de movimento (zoompan) por preset + intensidade ─────────────────
// Entrada já pré-escalada para 2x a saída (suaviza o zoompan / menos tremor).
// `on` = índice do frame de saída (0..F-1). p = progresso 0..1.
// intensity 0..1 escala a amplitude do zoom e da deriva (0.6 = padrão neutro).
function motionFilter(preset, F, W, H, intensity = 0.6) {
  const Fm1 = Math.max(F - 1, 1);
  const p = `(on/${Fm1})`;
  const W2 = W * 2, H2 = H * 2;
  // centraliza a janela do zoom
  const cx = `iw/2-(iw/zoom/2)`;
  const cy = `ih/2-(ih/zoom/2)`;
  const f = Math.max(0.4, intensity / 0.6);          // 1.0 = padrão
  const amp = (base, max) => +(Math.min(base * f, max)).toFixed(4);
  const drift = +(0.05 * f).toFixed(4);
  let z = `1.0`, x = cx, y = cy;
  switch (preset) {
    case 'zoomin':  { const a = amp(0.25, 0.40); z = `min(1+${a}*${p},${(1 + a).toFixed(3)})`; break; }
    case 'zoomout': { const a = amp(0.25, 0.40); z = `max(${(1 + a).toFixed(3)}-${a}*${p},1.0)`; break; }
    case 'slow':    { const a = amp(0.08, 0.16); z = `min(1+${a}*${p},${(1 + a).toFixed(3)})`; break; } // câmera lenta
    case 'panL':    { const a = amp(0.10, 0.18); z = `${(1 + a).toFixed(3)}`; x = `(iw-iw/zoom)*(1-${p})`; break; }
    case 'panR':    { const a = amp(0.10, 0.18); z = `${(1 + a).toFixed(3)}`; x = `(iw-iw/zoom)*${p}`;     break; }
    case 'panU':    { const a = amp(0.10, 0.18); z = `${(1 + a).toFixed(3)}`; y = `(ih-ih/zoom)*(1-${p})`; break; }
    case 'panD':    { const a = amp(0.10, 0.18); z = `${(1 + a).toFixed(3)}`; y = `(ih-ih/zoom)*${p}`;     break; }
    case 'parallax': { // pseudo-parallax: zoom-in + deriva diagonal contrária
      const a = amp(0.12, 0.22);
      z = `min(1+${a}*${p},${(1 + a).toFixed(3)})`;
      x = `${cx}+(iw*${drift})*(1-${p})`;
      y = `${cy}+(ih*${drift})*${p}`;
      break;
    }
    case 'kenburns': // padrão: zoom lento + deriva diagonal suave
    default: {
      const a = amp(0.18, 0.30);
      z = `min(1+${a}*${p},${(1 + a).toFixed(3)})`;
      x = `${cx}+(iw*${drift})*${p}`;
      y = `${cy}+(ih*${drift})*${p}`;
      break;
    }
  }
  // fps é definido na saída (-r); zoompan emite exatamente d frames.
  const pre = `scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2},setsar=1`;
  return `${pre},zoompan=z='${z}':x='${x}':y='${y}':d=${F}:s=${W}x${H}`;
}

// ── render de UM segmento (1 imagem) → mp4 sem áudio ──────────────────────────
function renderSegment(img, preset, capText, dur, fps, W, H, segOut, intensity = 0.6) {
  const F = Math.max(Math.round(dur * fps), 2);
  let vf = motionFilter(preset, F, W, H, intensity);
  if (capText && capText.trim()) {
    const capFile = segOut.replace(/\.mp4$/, '.cap.txt');
    writeFileSync(capFile, wrap(capText), 'utf8');
    const FS = Math.round(H / 22);
    vf += `,drawtext=fontfile=${FONT}:textfile=${rel(capFile)}`
        + `:fontcolor=white:fontsize=${FS}:line_spacing=10:box=1:boxcolor=black@0.5`
        + `:boxborderw=26:x=(w-text_w)/2:y=h-text_h-${Math.round(H * 0.10)}`;
  }
  ff([
    '-loop', '1', '-i', img,
    '-vf', vf,
    '-frames:v', String(F),
    '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    segOut,
  ], `render segmento (${preset})`);
  return segOut;
}

// ── encadeia N segmentos com xfade ────────────────────────────────────────────
function xfadeChain(segs, dur, t, fps, W, H, vidOut, transition = 'fade') {
  if (segs.length === 1) {
    // só renderiza no tamanho final (já está) — copia para vidOut
    ff(['-i', segs[0], '-c', 'copy', vidOut], 'copiar segmento único');
    return vidOut;
  }
  const inputs = [];
  for (const s of segs) inputs.push('-i', s);
  const parts = [];
  let prev = '0:v';
  for (let i = 1; i < segs.length; i++) {
    const off = (dur - t) * i; // offset acumulado
    const out = i === segs.length - 1 ? 'vout' : `v${i}`;
    parts.push(`[${prev}][${i}:v]xfade=transition=${transition}:duration=${t}:offset=${off.toFixed(3)}[${out}]`);
    prev = out;
  }
  ff([
    ...inputs,
    '-filter_complex', parts.join(';'),
    '-map', '[vout]',
    '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    vidOut,
  ], 'xfade da sequência');
  return vidOut;
}

// ── pipeline principal ────────────────────────────────────────────────────────
function build({ imgs, motions, caps, narr, audio, dur, out, size, fps, xfade, intensity = 0.6, transition = 'fade' }) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  ensureFont();
  const [W, H] = size.split('x').map(Number);
  const N = imgs.length;
  const base = path.basename(out, '.mp4');

  // 1) áudio (narração) → define a duração total
  let audioFile = audio || null;
  if (!audioFile && narr) audioFile = sapiTTS(narr, path.join(TMP, `${base}.wav`));
  const total = audioFile ? probeDuration(audioFile) : dur * N;

  // 2) duração por segmento (compensa a sobreposição do xfade)
  const t = N > 1 ? xfade : 0;
  const segDur = N > 1 ? (total + (N - 1) * t) / N : total;

  console.log(`• imagens: ${N}  • total: ${total.toFixed(2)}s  • por cena: ${segDur.toFixed(2)}s  • ${W}x${H}@${fps}  • transição: ${transition}`);

  // 3) renderiza cada segmento
  const segs = [];
  for (let i = 0; i < N; i++) {
    const preset = motions[i % motions.length];
    const cap = caps.length ? caps[Math.min(i, caps.length - 1)] : '';
    const segOut = path.join(TMP, `${base}.seg${i}.mp4`);
    console.log(`  → cena ${i + 1}/${N}: ${preset}${cap ? `  «${cap}»` : ''}`);
    renderSegment(imgs[i], preset, cap, segDur, fps, W, H, segOut, intensity);
    segs.push(segOut);
  }

  // 4) junta os segmentos
  const silentVid = path.join(TMP, `${base}.video.mp4`);
  xfadeChain(segs, segDur, t, fps, W, H, silentVid, transition);

  // 5) muxa narração
  const finalOut = path.join(OUT, path.basename(out));
  if (audioFile) {
    ff(['-i', silentVid, '-i', audioFile, '-map', '0:v', '-map', '1:a',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', finalOut], 'mux áudio+vídeo');
  } else {
    ff(['-i', silentVid, '-c', 'copy', finalOut], 'copiar saída final');
  }

  const d = probeDuration(finalOut);
  console.log(`✓ ${finalOut}  (${d.toFixed(2)}s)\n`);
  return finalOut;
}

// ── modo pasta: pasta numerada + UM prompt de movimento ───────────────────────
function buildFromDir(argv) {
  const o = parseArgs(argv);
  let dir = o.dir || argv.find(a => !a.startsWith('--'));
  if (!dir || !existsSync(dir)) { console.error(`✗ pasta não encontrada: ${dir}`); process.exit(1); }

  const imgs = listImages(dir);
  if (!imgs.length) { console.error(`✗ nenhuma imagem numerada em ${dir}`); process.exit(1); }

  const style = (o.style || readIf(path.join(dir, 'movimento.txt'))).trim();
  const narr = (o.narr || readIf(path.join(dir, 'narracao.txt'))).trim();
  const mood = interpretStyle(style);
  if (o.intensity != null && !Number.isNaN(o.intensity)) mood.intensity = o.intensity;
  const motions = planMotions(mood.pool, imgs.length);

  // legendas: --cap (repetível) > legendas.txt (1 linha/cena) > auto da narração
  let caps = o.caps;
  if (!caps.length) {
    const leg = readIf(path.join(dir, 'legendas.txt'));
    if (leg.trim()) caps = leg.split(/\r?\n/).map(s => s.trim()).filter((_, i, a) => i < a.length);
  }
  if (!caps.length && narr) caps = autoCaptions(narr, imgs.length);

  const outName = o.out !== 'saida.mp4'
    ? o.out
    : path.basename(dir.replace(/[\\/]+$/, '')) + '.mp4';

  console.log(`▶ pasta: ${dir}`);
  console.log(`  imagens: ${imgs.length} (${path.basename(imgs[0])} … ${path.basename(imgs[imgs.length - 1])})`);
  console.log(`  estilo:  "${style || '(padrão cinematográfico)'}"`);
  console.log(`  mood:    intensity=${mood.intensity} · transição=${mood.transition} · xfade=${mood.xfade}s`);
  console.log(`  motions: ${motions.join(' → ')}`);

  return build({
    imgs, motions, caps, narr,
    audio: o.audio || null,
    dur: o.dur,
    out: outName,
    size: o.size, fps: o.fps,
    xfade: mood.xfade,
    intensity: mood.intensity,
    transition: mood.transition,
  });
}

// ── imagens sintéticas pra prova (sem precisar de assets do usuário) ──────────
function makeTestImage(i, label, p) {
  const hues = ['0x1e3a5f', '0x5f1e3a', '0x1e5f3a', '0x5f4a1e', '0x3a1e5f'];
  const c1 = hues[i % hues.length];
  ff([
    '-f', 'lavfi', '-i', `gradients=s=1200x1500:c0=${c1}:c1=0x101216:x0=0:y0=0:x1=1200:y1=1500`,
    '-frames:v', '1',
    '-vf', `drawtext=fontfile=${FONT}:text='${label}':fontcolor=white@0.92:fontsize=180`
         + `:x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black:shadowx=4:shadowy=4`,
    p,
  ], `gerar imagem de teste ${i}`);
  return p;
}

function selftest() {
  mkdirSync(ASSETS, { recursive: true });
  ensureFont();
  console.log('▶ Gerando imagens sintéticas de teste…');
  const imgs = [];
  for (let i = 0; i < 5; i++) {
    const p = path.join(ASSETS, `test${i + 1}.jpg`);
    makeTestImage(i, String(i + 1), p);
    imgs.push(p);
  }

  console.log('\n▶ PROVA 1 — 1 imagem (Ken Burns)');
  build({
    imgs: [imgs[0]],
    motions: ['kenburns'],
    caps: ['Teste image-to-video · 1 imagem · Ken Burns'],
    narr: 'Primeira prova. Uma imagem com zoom lento estilo Ken Burns, narração e legenda, em formato vertical nove por dezesseis.',
    audio: null, dur: 4, out: 'prova1-1img.mp4', size: '1080x1920', fps: 30, xfade: 0.6,
  });

  console.log('▶ PROVA 2 — 5 imagens em sequência (kenburns, zoomin, panR, parallax, slow)');
  build({
    imgs,
    motions: ['kenburns', 'zoomin', 'panR', 'parallax', 'slow'],
    caps: ['Cena um', 'Cena dois', 'Cena três', 'Cena quatro', 'Cena cinco'],
    narr: 'Segunda prova com cinco imagens em sequência. Ken Burns, zoom, movimento lateral, parallax simulado e câmera lenta, com transições suaves entre as cenas.',
    audio: null, dur: 3, out: 'prova2-5img.mp4', size: '1080x1920', fps: 30, xfade: 0.6,
  });

  console.log('▶ PROVA 3 — PASTA numerada + UM prompt de movimento (estilo novela coreana)');
  const demoDir = path.join(ASSETS, 'demo-pasta');
  mkdirSync(demoDir, { recursive: true });
  for (let i = 0; i < 5; i++)
    makeTestImage(i, String(i + 1), path.join(demoDir, String(i + 1).padStart(3, '0') + '.png'));
  writeFileSync(path.join(demoDir, 'movimento.txt'),
    'câmera lenta cinematográfica, zoom suave, movimentos delicados, estilo novela coreana', 'utf8');
  writeFileSync(path.join(demoDir, 'narracao.txt'),
    'Uma pasta com cinco imagens numeradas e um único prompt de movimento. Cada cena recebe um movimento diferente, suave e cinematográfico. A legenda é fatiada da própria narração e as transições entre as cenas são delicadas.', 'utf8');
  buildFromDir([demoDir, '--size', '720x1280', '--out', 'prova3-pasta.mp4']);

  console.log('Pronto. Saídas em: ' + OUT);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = { imgs: [], motions: [], caps: [], narr: '', audio: '', dir: '', style: '',
              intensity: null, dur: 4, out: 'saida.mp4', size: '1080x1920', fps: 30, xfade: 0.6 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    switch (a) {
      case '--dir': o.dir = v; i++; break;
      case '--style': o.style = v; i++; break;
      case '--img': o.imgs.push(v); i++; break;
      case '--motion': o.motions.push(...v.split(',').map(s => s.trim())); i++; break;
      case '--cap': o.caps.push(v); i++; break;
      case '--narr': o.narr = v; i++; break;
      case '--audio': o.audio = v; i++; break;
      case '--intensity': o.intensity = parseFloat(v); i++; break;
      case '--dur': o.dur = parseFloat(v); i++; break;
      case '--out': o.out = v; i++; break;
      case '--size': o.size = v; i++; break;
      case '--fps': o.fps = parseInt(v); i++; break;
      case '--xfade': o.xfade = parseFloat(v); i++; break;
    }
  }
  if (!o.motions.length) o.motions = ['kenburns'];
  return o;
}

const [, , cmd, ...rest] = process.argv;
if (cmd === 'selftest') {
  selftest();
} else if (cmd === 'dir') {
  buildFromDir(rest);
} else if (cmd === 'clean') {
  for (const d of [OUT, TMP, ASSETS]) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  console.log('limpo.');
} else {
  const o = parseArgs(process.argv.slice(2));
  if (o.dir) {
    buildFromDir(process.argv.slice(2));
  } else if (o.imgs.length) {
    build(o);
  } else {
    console.log('uso (pasta):  node img2vid.mjs dir ./minha-pasta --style "câmera lenta cinematográfica, zoom suave"');
    console.log('uso (manual): node img2vid.mjs --img a.jpg [--img b.jpg ...] --motion kenburns --narr "texto" --cap "legenda"');
    console.log('              node img2vid.mjs selftest    (gera imagens e roda as provas)');
    process.exit(0);
  }
}
