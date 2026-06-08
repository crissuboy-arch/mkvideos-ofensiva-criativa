// Pipeline completo offline: TTS → mede durações → gera HTML → lint/inspect/render.
// Nenhuma chamada de API externa. Tudo local: Kokoro, HyperFrames, FFmpeg.

import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { generateBuildIndex, loadTemplate, buildTTSTexts, autoScenes, parseTitleHint } from './generator.js';

const run = promisify(execFile);
const shell = promisify(exec);
const __dir = path.dirname(fileURLToPath(import.meta.url));

export interface BuildRequest {
  titulo: string;
  tema?: string;
  n_cenas?: number;
  scenes?: Array<{ titulo: string; desc: string; caption?: string }>;
  vertical?: boolean;
  output?: string;       // caminho final do .mp4 (pasta ou arquivo)
  tts_speed?: number;    // default 1.1
  template?: string;     // nome do template JSON (default: 'video-explicativo')
}

export interface BuildResult {
  mp4: string;
  duration: number;
  projectDir: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function ffprobeDuration(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', [
    '-v', 'quiet', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]);
  return parseFloat(stdout.trim());
}

async function kokoroTTS(text: string, outWav: string, speed = 1.1): Promise<void> {
  const txtFile = outWav.replace(/\.wav$/, '.txt');
  writeFileSync(txtFile, text, 'utf-8');
  await run('python', [
    '-m', 'kokoro', '--lang', 'p', '--voice', 'pf_dora',
    '--speed', String(speed), '--output', outWav, txtFile,
  ]);
}

async function runHyperframes(cmd: string[], cwd: string): Promise<string> {
  const { stdout, stderr } = await run('npx', ['hyperframes@0.6.80', ...cmd], { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout + stderr;
}

function findLocalGsap(): string | null {
  const candidates = [
    path.resolve(__dir, '..', 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
    path.resolve(process.cwd(), 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
  ];
  return candidates.find(existsSync) ?? null;
}

// ─── etapa 1: cria projeto HyperFrames ───────────────────────────────────────

async function initProject(dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  await runHyperframes(['init', '.', '--example', 'blank', '--non-interactive'], dir);

  // Garante assets/audio, assets/fonts
  mkdirSync(path.join(dir, 'assets', 'audio'), { recursive: true });
  mkdirSync(path.join(dir, 'assets', 'fonts'), { recursive: true });
  mkdirSync(path.join(dir, 'renders'), { recursive: true });

  // Copia GSAP local
  const gsap = findLocalGsap();
  if (gsap) {
    copyFileSync(gsap, path.join(dir, 'assets', 'gsap.min.js'));
  } else {
    // Tenta npm install gsap no projeto
    await shell('npm install gsap --prefix .', { cwd: dir });
    const installed = path.join(dir, 'node_modules', 'gsap', 'dist', 'gsap.min.js');
    if (existsSync(installed)) copyFileSync(installed, path.join(dir, 'assets', 'gsap.min.js'));
  }

  // Copia fontes se disponíveis no skills
  const skillFonts = path.resolve(__dir, '..', '..', '..', '.claude', 'skills', 'video-explicativo', 'assets', 'fonts');
  if (existsSync(skillFonts)) {
    const files = (await shell(`ls "${skillFonts}"`)).stdout.trim().split('\n');
    for (const f of files) {
      if (f) copyFileSync(path.join(skillFonts, f), path.join(dir, 'assets', 'fonts', f));
    }
  } else {
    // fetch-fonts.mjs
    const fetchFonts = path.resolve(__dir, '..', '..', '..', '.claude', 'skills', 'video-explicativo', 'scripts', 'fetch-fonts.mjs');
    if (existsSync(fetchFonts)) await shell(`node "${fetchFonts}"`, { cwd: dir });
  }
}

// ─── etapa 2: gera música de fundo sintética ─────────────────────────────────

async function generateBgMusic(outWav: string, durationSec: number): Promise<void> {
  await run('ffmpeg', [
    '-f', 'lavfi',
    '-i', `aevalsrc=0.05*(sin(2*PI*60*t)+0.6*sin(2*PI*90*t)+0.4*sin(2*PI*45*t)):c=stereo:s=44100`,
    '-t', String(durationSec + 5),
    '-af', `afade=in:ss=0:d=3,afade=out:st=${durationSec}:d=4`,
    '-y', outWav,
  ]);
}

// ─── pipeline principal ───────────────────────────────────────────────────────

export async function buildVideo(req: BuildRequest): Promise<BuildResult> {
  const tpl = loadTemplate(req.template ?? 'video-explicativo');
  const titulo = req.titulo;
  const hint = parseTitleHint(titulo);
  const n = req.n_cenas ?? hint.n;
  const tema = req.tema ?? hint.tipo;
  const speed = req.tts_speed ?? 1.1;

  const rawScenes: Array<{ titulo: string; desc: string; caption?: string }> =
    req.scenes ?? autoScenes(titulo, tema, n);
  const scenes = rawScenes.map((s) => ({
    titulo: s.titulo,
    desc: s.desc,
    caption: s.caption ?? s.titulo,
  }));

  // Diretório do projeto: tmp/<slug>
  const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const projectDir = path.join(os.tmpdir(), 'mkivideos', slug + '-' + Date.now());

  console.log(`[mkivideos] criando projeto em ${projectDir}`);
  await initProject(projectDir);

  // ── TTS ──────────────────────────────────────────────────────────────────
  console.log('[mkivideos] gerando narração TTS...');
  const ttsTexts = buildTTSTexts({ titulo, scenes, template: tpl });
  // ttsTexts = [hook, ...cenas, cta]  → índices 0..n+1  → nomeados s1..s(n+2)
  const audioDurs: number[] = [];
  for (let idx = 0; idx < ttsTexts.length; idx++) {
    const wavFile = path.join(projectDir, 'assets', 'audio', `s${idx + 1}.wav`);
    console.log(`  [tts] s${idx + 1}: ${ttsTexts[idx].slice(0, 60)}…`);
    await kokoroTTS(ttsTexts[idx], wavFile, speed);
    const dur = await ffprobeDuration(wavFile);
    audioDurs.push(dur);
    console.log(`  [dur] s${idx + 1}: ${dur.toFixed(2)}s`);
  }

  const hookAudioDur = audioDurs[0];
  const ctaAudioDur = audioDurs[audioDurs.length - 1];
  const contentAudioDurs = audioDurs.slice(1, -1);

  // ── gera música de fundo ────────────────────────────────────────────────
  const totalRough = audioDurs.reduce((a, b) => a + b + 0.8, 0) + 2;
  const bgMusicPath = path.join(projectDir, 'assets', 'audio', 'music-bg.wav');
  console.log('[mkivideos] gerando música de fundo...');
  await generateBgMusic(bgMusicPath, totalRough);

  // ── gera build-index.mjs ────────────────────────────────────────────────
  console.log('[mkivideos] gerando composição HTML...');
  const sceneData = scenes.map((sc, i) => ({
    titulo: sc.titulo,
    desc: sc.desc,
    audio_dur: contentAudioDurs[i] ?? 5,
    caption: sc.caption,
  }));

  const buildJS = generateBuildIndex({
    titulo,
    tema,
    scenes: sceneData,
    cta_audio_dur: ctaAudioDur,
    hook_audio_dur: hookAudioDur,
    vertical: req.vertical ?? true,
    brand: tpl.brand,
    palette: tpl.palette,
  });

  const buildPath = path.join(projectDir, 'build-index.mjs');
  writeFileSync(buildPath, buildJS, 'utf-8');

  // ── node build-index.mjs → index.html ──────────────────────────────────
  console.log('[mkivideos] construindo index.html...');
  await run('node', [buildPath], { cwd: projectDir, maxBuffer: 10 * 1024 * 1024 });

  // ── lint ────────────────────────────────────────────────────────────────
  console.log('[mkivideos] lint...');
  try {
    const lintOut = await runHyperframes(['lint'], projectDir);
    if (/error/i.test(lintOut)) console.warn('[lint]', lintOut.slice(0, 400));
  } catch (e) {
    console.warn('[lint] falhou:', (e as Error).message.slice(0, 200));
  }

  // ── inspect ─────────────────────────────────────────────────────────────
  console.log('[mkivideos] inspect...');
  try {
    await runHyperframes(['inspect', '--samples', '8'], projectDir);
  } catch (e) {
    console.warn('[inspect] aviso:', (e as Error).message.slice(0, 200));
  }

  // ── render ──────────────────────────────────────────────────────────────
  const outSlug = slug + (req.vertical !== false ? '-9x16' : '-16x9');
  const renderOut = path.join(projectDir, 'renders', `${outSlug}.mp4`);
  console.log('[mkivideos] render...');
  try {
    await runHyperframes(['render', '--quality', 'high', '--gpu', '--browser-gpu', '--output', renderOut], projectDir);
    if (!existsSync(renderOut) || (await ffprobeDuration(renderOut)) < 1) throw new Error('GPU render falhou');
  } catch {
    console.log('[mkivideos] fallback CPU render...');
    await runHyperframes(['render', '--quality', 'high', '--output', renderOut], projectDir);
  }

  const duration = await ffprobeDuration(renderOut);
  console.log(`[mkivideos] pronto: ${renderOut} (${duration.toFixed(1)}s)`);

  // ── move para output final ───────────────────────────────────────────────
  let finalPath = renderOut;
  if (req.output) {
    const isFile = req.output.toLowerCase().endsWith('.mp4');
    const destDir = isFile ? path.dirname(req.output) : req.output;
    mkdirSync(destDir, { recursive: true });
    finalPath = isFile ? req.output : path.join(req.output, path.basename(renderOut));
    try {
      const { renameSync } = await import('node:fs');
      renameSync(renderOut, finalPath);
    } catch {
      copyFileSync(renderOut, finalPath);
    }
    console.log(`[mkivideos] movido para ${finalPath}`);
  }

  return { mp4: finalPath, duration, projectDir };
}
