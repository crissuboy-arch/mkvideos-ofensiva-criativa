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
// Uso:
//   node img2vid.mjs --img a.jpg --motion kenburns --narr "texto" --cap "legenda"
//   node img2vid.mjs --img 1.jpg --img 2.jpg ... --motion kenburns,zoomin,panR --narr "..."
//   node img2vid.mjs selftest          # gera imagens sintéticas e roda as 2 provas
//
// Flags:
//   --img P        (repetível) imagem de entrada
//   --motion M     preset, ou lista separada por vírgula (cicla pelas imagens)
//   --cap T        (repetível) legenda por imagem; 1 só → aplica em todas
//   --narr T       narração PT-BR via SAPI Maria (define a duração total)
//   --audio P      usa um .wav pronto em vez de gerar narração
//   --dur N        duração por imagem quando não há áudio (default 4s)
//   --out P        arquivo de saída (default out/saida.mp4)
//   --size WxH     default 1080x1920  (use 720x1280 em PC bem fraco)
//   --fps N        default 30
//   --xfade N      duração da transição entre cenas na sequência (default 0.6s)
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, copyFileSync } from 'node:fs';
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
function escFilterPath(p) { return p.replace(/\\/g, '/').replace(/:/g, '\\:'); }
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

// ── expressão de movimento (zoompan) por preset ───────────────────────────────
// Entrada já pré-escalada para 2x a saída (suaviza o zoompan / menos tremor).
// `on` = índice do frame de saída (0..F-1). p = progresso 0..1.
function motionFilter(preset, F, W, H) {
  const Fm1 = Math.max(F - 1, 1);
  const p = `(on/${Fm1})`;
  const W2 = W * 2, H2 = H * 2;
  // centraliza a janela do zoom
  const cx = `iw/2-(iw/zoom/2)`;
  const cy = `ih/2-(ih/zoom/2)`;
  let z = `1.0`, x = cx, y = cy;
  switch (preset) {
    case 'zoomin':   z = `min(1+0.25*${p},1.25)`; break;
    case 'zoomout':  z = `max(1.25-0.25*${p},1.0)`; break;
    case 'slow':     z = `min(1+0.08*${p},1.08)`; break;            // câmera lenta
    case 'panL':     z = `1.12`; x = `(iw-iw/zoom)*(1-${p})`; break;
    case 'panR':     z = `1.12`; x = `(iw-iw/zoom)*${p}`;     break;
    case 'panU':     z = `1.12`; y = `(ih-ih/zoom)*(1-${p})`; break;
    case 'panD':     z = `1.12`; y = `(ih-ih/zoom)*${p}`;     break;
    case 'parallax': // pseudo-parallax: zoom-in + deriva diagonal contrária
      z = `min(1+0.12*${p},1.12)`;
      x = `${cx}+(iw*0.05)*(1-${p})`;
      y = `${cy}+(ih*0.05)*${p}`;
      break;
    case 'kenburns': // padrão: zoom lento + deriva diagonal suave
    default:
      z = `min(1+0.18*${p},1.18)`;
      x = `${cx}+(iw*0.05)*${p}`;
      y = `${cy}+(ih*0.05)*${p}`;
      break;
  }
  // fps é definido na saída (-r); zoompan emite exatamente d frames.
  const pre = `scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2},setsar=1`;
  return `${pre},zoompan=z='${z}':x='${x}':y='${y}':d=${F}:s=${W}x${H}`;
}

// ── render de UM segmento (1 imagem) → mp4 sem áudio ──────────────────────────
function renderSegment(img, preset, capText, dur, fps, W, H, segOut) {
  const F = Math.max(Math.round(dur * fps), 2);
  let vf = motionFilter(preset, F, W, H);
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
function xfadeChain(segs, dur, t, fps, W, H, vidOut) {
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
    parts.push(`[${prev}][${i}:v]xfade=transition=fade:duration=${t}:offset=${off.toFixed(3)}[${out}]`);
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
function build({ imgs, motions, caps, narr, audio, dur, out, size, fps, xfade }) {
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

  console.log(`• imagens: ${N}  • total: ${total.toFixed(2)}s  • por cena: ${segDur.toFixed(2)}s  • ${W}x${H}@${fps}`);

  // 3) renderiza cada segmento
  const segs = [];
  for (let i = 0; i < N; i++) {
    const preset = motions[i % motions.length];
    const cap = caps.length ? caps[Math.min(i, caps.length - 1)] : '';
    const segOut = path.join(TMP, `${base}.seg${i}.mp4`);
    console.log(`  → cena ${i + 1}/${N}: ${preset}${cap ? `  «${cap}»` : ''}`);
    renderSegment(imgs[i], preset, cap, segDur, fps, W, H, segOut);
    segs.push(segOut);
  }

  // 4) junta os segmentos
  const silentVid = path.join(TMP, `${base}.video.mp4`);
  xfadeChain(segs, segDur, t, fps, W, H, silentVid);

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

  console.log('Pronto. Saídas em: ' + OUT);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = { imgs: [], motions: [], caps: [], narr: '', audio: '', dur: 4,
              out: 'saida.mp4', size: '1080x1920', fps: 30, xfade: 0.6 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    switch (a) {
      case '--img': o.imgs.push(v); i++; break;
      case '--motion': o.motions.push(...v.split(',').map(s => s.trim())); i++; break;
      case '--cap': o.caps.push(v); i++; break;
      case '--narr': o.narr = v; i++; break;
      case '--audio': o.audio = v; i++; break;
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
} else if (cmd === 'clean') {
  for (const d of [OUT, TMP, ASSETS]) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  console.log('limpo.');
} else {
  const o = parseArgs(process.argv.slice(2));
  if (!o.imgs.length) {
    console.log('uso: node img2vid.mjs --img a.jpg [--img b.jpg ...] --motion kenburns --narr "texto" --cap "legenda"');
    console.log('     node img2vid.mjs selftest    (gera imagens e roda as 2 provas)');
    process.exit(0);
  }
  build(o);
}
