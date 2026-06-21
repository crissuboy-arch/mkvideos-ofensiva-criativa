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
// No Windows, npx é um .cmd — execFile não o encontra sem extensão
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

export interface BuildRequest {
  titulo: string;
  tema?: string;
  n_cenas?: number;
  scenes?: Array<{ titulo: string; desc: string; caption?: string }>;
  vertical?: boolean;
  output?: string;       // caminho final do .mp4 (pasta ou arquivo)
  tts_speed?: number;    // default 1.1
  template?: string;     // nome do template JSON (default: 'video-explicativo')
  imagens_dir?: string;  // pasta com cena1.png/jpg … cenaN.png/jpg
  voz?: string;          // nome da voz ('cris') ou caminho absoluto para pasta de voz
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
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  // Usa HyperFrames TTS (mais confiável e portável que python -m kokoro direto)
  await run(NPX, [
    'hyperframes@0.6.80', 'tts', txtFile,
    '--voice', 'pf_dora', '--speed', String(speed), '--output', outWav,
  ], { maxBuffer: 50 * 1024 * 1024, shell: process.platform === 'win32' });
  void pythonCmd; // fallback disponível se necessário
}

async function runHyperframes(cmd: string[], cwd: string): Promise<string> {
  // shell:true necessário no Windows 20+ para .cmd (npx.cmd)
  const { stdout, stderr } = await run(NPX, ['hyperframes@0.6.80', ...cmd], {
    cwd, maxBuffer: 10 * 1024 * 1024, shell: process.platform === 'win32',
  });
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

  // Garante assets/audio, assets/fonts, assets/img
  mkdirSync(path.join(dir, 'assets', 'audio'), { recursive: true });
  mkdirSync(path.join(dir, 'assets', 'fonts'), { recursive: true });
  mkdirSync(path.join(dir, 'assets', 'img'), { recursive: true });
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

  // Copia fontes se disponíveis no skills (path inclui scripts/)
  const skillFonts = path.resolve(__dir, '..', '..', '..', '.claude', 'skills', 'video-explicativo', 'scripts', 'assets', 'fonts');
  if (existsSync(skillFonts)) {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(skillFonts);
    for (const f of files) {
      copyFileSync(path.join(skillFonts, f), path.join(dir, 'assets', 'fonts', f));
    }
  } else {
    // fetch-fonts.mjs como fallback
    const fetchFonts = path.resolve(__dir, '..', '..', '..', '.claude', 'skills', 'video-explicativo', 'scripts', 'fetch-fonts.mjs');
    if (existsSync(fetchFonts)) await shell(`node "${fetchFonts}"`, { cwd: dir });
  }
}

// ─── resolução de voz personalizada ─────────────────────────────────────────

/** Localiza a pasta de voz a partir de nome ou caminho. */
function resolveVozDir(voz: string): string | null {
  if (!voz) return null;
  // Caminho absoluto ou relativo com separador → usa diretamente
  if (path.isAbsolute(voz) || voz.includes('/') || voz.includes('\\')) {
    return existsSync(voz) ? voz : null;
  }
  // Por nome: tenta candidatos em ordem
  const candidates = [
    process.env.MKIVIDEOS_VOZES ? path.join(process.env.MKIVIDEOS_VOZES, voz) : null,
    path.join(process.cwd(), 'vozes', voz),
    path.join(process.cwd(), '..', 'vozes', voz),
    path.join(os.homedir(), 'meus-videos-ia', 'vozes', voz),
  ].filter(Boolean) as string[];
  return candidates.find(existsSync) ?? null;
}

/** Clonagem de voz com Coqui XTTS v2 (requer: pip install TTS). */
async function xttsGenerate(text: string, outWav: string, refWav: string): Promise<void> {
  const ttsExe = process.platform === 'win32' ? 'tts.exe' : 'tts';
  await run(ttsExe, [
    '--text', text,
    '--model_name', 'tts_models/multilingual/multi-dataset/xtts_v2',
    '--speaker_wav', refWav,
    '--language', 'pt',
    '--out_path', outWav,
  ], { maxBuffer: 50 * 1024 * 1024, timeout: 180000, shell: process.platform === 'win32' });
}

/**
 * Gera áudio para uma cena com hierarquia:
 * 1. Arquivo pré-gravado (s{i}.wav/.mp3) na pasta de voz
 * 2. Clonagem XTTS com referencia.wav
 * 3. Kokoro TTS (fallback)
 */
async function generateAudioScene(
  sceneIdx: number,
  text: string,
  outWav: string,
  vozDir: string | null,
  speed: number,
): Promise<number> {
  if (vozDir) {
    // Modo 1: arquivo pré-gravado
    const preRecorded = ['.wav', '.mp3'].map(e => path.join(vozDir, `s${sceneIdx}${e}`)).find(existsSync);
    if (preRecorded) {
      console.log(`    → voz própria: s${sceneIdx}${path.extname(preRecorded)}`);
      copyFileSync(preRecorded, outWav);
      return ffprobeDuration(outWav);
    }
    // Modo 2: clonagem XTTS
    const refFile = ['referencia.wav', 'reference.wav', 'ref.wav']
      .map(f => path.join(vozDir, f)).find(existsSync);
    if (refFile) {
      try {
        console.log(`    → XTTS clonagem (${path.basename(refFile)})`);
        await xttsGenerate(text, outWav, refFile);
        return ffprobeDuration(outWav);
      } catch (e) {
        console.warn(`    → XTTS falhou, fallback Kokoro: ${(e as Error).message.slice(0, 80)}`);
      }
    }
    console.log(`    → s${sceneIdx}: sem arquivo em vozes/, usando Kokoro`);
  }
  // Modo 3: Kokoro
  await kokoroTTS(text, outWav, speed);
  return ffprobeDuration(outWav);
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

// ─── etapa 3: detecta e copia imagens das cenas ──────────────────────────────

function copySceneImages(imagensDir: string, projectDir: string, sceneCount: number): string[] {
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  const result: string[] = [];
  for (let i = 1; i <= sceneCount; i++) {
    const found = exts.map(e => path.join(imagensDir, `cena${i}.${e}`)).find(existsSync);
    if (found) {
      const ext = path.extname(found);
      const dest = path.join(projectDir, 'assets', 'img', `cena${i}${ext}`);
      copyFileSync(found, dest);
      result.push(`assets/img/cena${i}${ext}`);
      console.log(`  [img] cena${i}: encontrada → ${dest}`);
    } else {
      result.push('');
      console.log(`  [img] cena${i}: sem imagem, usando fundo premium automático`);
    }
  }
  return result;
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

  // ── resolve voz ──────────────────────────────────────────────────────────
  const vozDir = req.voz ? resolveVozDir(req.voz) : null;
  if (req.voz) {
    if (vozDir) {
      console.log(`[mkivideos] voz: ${req.voz} → ${vozDir}`);
    } else {
      console.warn(`[mkivideos] voz "${req.voz}" não encontrada — usando Kokoro (fallback)`);
      console.warn(`  Dica: crie a pasta "vozes/${req.voz}/" com seus arquivos de áudio`);
    }
  }

  // ── TTS / narração ────────────────────────────────────────────────────────
  console.log('[mkivideos] gerando narração...');
  const ttsTexts = buildTTSTexts({ titulo, scenes, template: tpl });
  // ttsTexts = [hook, ...cenas, cta]  → índices 0..n+1  → nomeados s1..s(n+2)
  const audioDurs: number[] = [];
  for (let idx = 0; idx < ttsTexts.length; idx++) {
    const wavFile = path.join(projectDir, 'assets', 'audio', `s${idx + 1}.wav`);
    console.log(`  [narr] s${idx + 1}: ${ttsTexts[idx].slice(0, 60)}…`);
    const dur = await generateAudioScene(idx + 1, ttsTexts[idx], wavFile, vozDir, speed);
    audioDurs.push(dur);
    console.log(`  [dur]  s${idx + 1}: ${dur.toFixed(2)}s`);
  }

  const hookAudioDur = audioDurs[0];
  const ctaAudioDur = audioDurs[audioDurs.length - 1];
  const contentAudioDurs = audioDurs.slice(1, -1);

  // ── gera música de fundo ────────────────────────────────────────────────
  const totalRough = audioDurs.reduce((a, b) => a + b + 0.8, 0) + 2;
  const bgMusicPath = path.join(projectDir, 'assets', 'audio', 'music-bg.wav');
  console.log('[mkivideos] gerando música de fundo...');
  await generateBgMusic(bgMusicPath, totalRough);

  // ── resolve imagens das cenas ───────────────────────────────────────────
  let sceneImages: string[] = [];
  if (req.imagens_dir) {
    const absDir = path.resolve(req.imagens_dir);
    if (existsSync(absDir)) {
      console.log(`[mkivideos] copiando imagens de ${absDir}...`);
      sceneImages = copySceneImages(absDir, projectDir, scenes.length);
    } else {
      console.warn(`[mkivideos] pasta de imagens não encontrada: ${absDir}`);
    }
  }

  // ── gera build-index.mjs ────────────────────────────────────────────────
  console.log('[mkivideos] gerando composição HTML...');
  const sceneData = scenes.map((sc, i) => ({
    titulo: sc.titulo,
    desc: sc.desc,
    audio_dur: contentAudioDurs[i] ?? 5,
    caption: sc.caption,
    image: sceneImages[i] || undefined,
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
