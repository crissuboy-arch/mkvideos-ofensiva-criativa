// Pipeline offline ponta a ponta: tema → roteiro → TTS (sync por áudio real) →
// composição HTML → lint/inspect → render (GPU + fallback CPU) → move o .mp4.
// Nenhuma chamada de API externa. Tudo local: Kokoro/XTTS, HyperFrames, FFmpeg.

import { writeFileSync, mkdirSync, existsSync, renameSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { generateScript } from '../specs/script-generator.js';
import type { SceneSpec, VideoType } from '../specs/types.js';
import { getBrand } from '../brands/index.js';
import { compose } from '../composer.js';
import { initProject, readFontCss, copySceneImages } from '../render/project.js';
import { hfLint, hfInspect, hfRender } from '../render/hyperframes.js';
import { generateAudioScene, resolveVozDir } from '../audio/tts.js';
import { generateBgMusic } from '../audio/music.js';
import { ffprobeDuration } from '../audio/probe.js';

export interface BuildRequest {
  titulo: string;
  tipo?: VideoType;
  tema?: string;
  marca?: string;          // id da marca
  n_cenas?: number;
  vertical?: boolean;
  horizontal?: boolean;
  scenes?: SceneSpec[];    // roteiro próprio (substitui o conteúdo gerado)
  output?: string;         // pasta ou arquivo .mp4 de destino
  tts_speed?: number;      // default 1.1
  imagens_dir?: string;    // pasta com cena1.png … cenaN.png
  voz?: string;            // nome/caminho da pasta de voz
}

export interface BuildResult {
  mp4: string;
  duration: number;
  projectDir: string;
  format: 'vertical' | 'horizontal';
}

/** Fases emitidas durante o build (para painéis/UX acompanharem o progresso). */
export type BuildPhase = 'roteiro' | 'narracao' | 'musica' | 'composicao' | 'render' | 'movendo';

export interface BuildHooks {
  onProgress?: (phase: BuildPhase) => void;
}

const MUSIC_REL = 'assets/audio/music-bg.wav';
const MUSIC_VOL = 0.1;

export async function buildVideo(req: BuildRequest, hooks: BuildHooks = {}): Promise<BuildResult> {
  const emit = (p: BuildPhase): void => { try { hooks.onProgress?.(p); } catch { /* ignore */ } };
  const speed = req.tts_speed ?? 1.1;

  // ── 1. roteiro (offline) ───────────────────────────────────────────────────
  const script = generateScript({
    titulo: req.titulo,
    tipo: req.tipo,
    tema: req.tema,
    brand: req.marca,
    n_cenas: req.n_cenas,
    vertical: req.vertical,
    horizontal: req.horizontal,
    userScenes: req.scenes,
  });
  const brand = getBrand(script.brand);
  const vertical = script.format === 'vertical';
  emit('roteiro');
  console.log(`[mkivideos] "${req.titulo}" · ${script.tipo} · ${script.format} · marca ${brand.id} · ${script.scenes.length} cenas`);

  // ── 2. projeto temporário ──────────────────────────────────────────────────
  const slug = req.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'video';
  const projectDir = path.join(os.tmpdir(), 'mkivideos', `${slug}-${Date.now()}`);
  console.log(`[mkivideos] criando projeto em ${projectDir}`);
  await initProject(projectDir);

  // ── 3. voz ─────────────────────────────────────────────────────────────────
  const vozDir = req.voz ? resolveVozDir(req.voz) : null;
  if (req.voz && !vozDir) {
    console.warn(`[mkivideos] voz "${req.voz}" não encontrada — usando Kokoro. Crie "vozes/${req.voz}/".`);
  } else if (vozDir) {
    console.log(`[mkivideos] voz: ${req.voz} → ${vozDir}`);
  }

  // ── 4. narração (TTS) + duração real por cena ─────────────────────────────
  emit('narracao');
  console.log('[mkivideos] gerando narração...');
  for (let i = 0; i < script.scenes.length; i++) {
    const sc = script.scenes[i];
    const wav = path.join(projectDir, 'assets', 'audio', `s${i + 1}.wav`);
    console.log(`  [narr] s${i + 1}: ${sc.narration.slice(0, 60)}…`);
    sc.audio_dur = await generateAudioScene(i + 1, sc.narration, wav, vozDir, speed);
    console.log(`  [dur]  s${i + 1}: ${sc.audio_dur.toFixed(2)}s`);
  }

  // ── 5. música de fundo ─────────────────────────────────────────────────────
  const totalRough = script.scenes.reduce((a, s) => a + (s.audio_dur ?? 0) + 0.8, 0) + 2;
  emit('musica');
  console.log('[mkivideos] gerando música de fundo...');
  await generateBgMusic(path.join(projectDir, 'assets', 'audio', 'music-bg.wav'), totalRough);

  // ── 6. imagens das cenas de conteúdo (cena1 = 1ª cena após o hook) ────────
  if (req.imagens_dir) {
    const absDir = path.resolve(req.imagens_dir);
    if (existsSync(absDir)) {
      console.log(`[mkivideos] copiando imagens de ${absDir}...`);
      const content = script.scenes.slice(1, -1); // sem hook e sem cta
      const imgs = copySceneImages(absDir, projectDir, content.length);
      imgs.forEach((rel, idx) => { if (rel) content[idx].image = rel; });
    } else {
      console.warn(`[mkivideos] pasta de imagens não encontrada: ${absDir}`);
    }
  }

  // ── 7. composição → index.html ─────────────────────────────────────────────
  emit('composicao');
  console.log('[mkivideos] compondo index.html...');
  const { html, total } = compose({
    scenes: script.scenes,
    brand,
    vertical,
    fontCss: readFontCss(projectDir),
    music: { src: MUSIC_REL, vol: MUSIC_VOL },
    ghost: script.tema,
  });
  writeFileSync(path.join(projectDir, 'index.html'), html, 'utf-8');
  console.log(`[mkivideos] composição: ${total}s`);

  // ── 8. lint + inspect (best-effort) ────────────────────────────────────────
  try {
    const lintOut = await hfLint(projectDir);
    if (/error/i.test(lintOut)) console.warn('[lint]', lintOut.slice(0, 400));
  } catch (e) {
    console.warn('[lint] falhou:', (e as Error).message.slice(0, 160));
  }
  try {
    await hfInspect(projectDir, 8);
  } catch (e) {
    console.warn('[inspect] aviso:', (e as Error).message.slice(0, 160));
  }

  // ── 9. render (GPU → fallback CPU) ─────────────────────────────────────────
  const outSlug = slug + (vertical ? '-9x16' : '-16x9');
  const renderOut = path.join(projectDir, 'renders', `${outSlug}.mp4`);
  emit('render');
  // GPU é opt-in (MKIVIDEOS_GPU=1): não acelera este pipeline e já travou em máquina
  // sem GPU dedicada. Timeout evita render pendurado pra sempre (default 20 min).
  const useGpu = process.env.MKIVIDEOS_GPU === '1';
  const renderTimeoutMs = Number(process.env.MKIVIDEOS_RENDER_TIMEOUT_MS) || 20 * 60_000;
  console.log(`[mkivideos] render (${useGpu ? 'gpu' : 'cpu'}, timeout ${Math.round(renderTimeoutMs / 60000)}min)...`);
  try {
    await hfRender(projectDir, renderOut, { gpu: useGpu, timeoutMs: renderTimeoutMs });
    if (!existsSync(renderOut) || (await ffprobeDuration(renderOut)) < 1) throw new Error('render vazio/curto');
  } catch (e) {
    if (useGpu) {
      console.log('[mkivideos] render GPU falhou/timeout — fallback CPU...');
      await hfRender(projectDir, renderOut, { gpu: false, timeoutMs: renderTimeoutMs });
      if (!existsSync(renderOut) || (await ffprobeDuration(renderOut)) < 1) throw new Error('render CPU vazio/curto');
    } else {
      throw new Error(`render falhou: ${(e as Error).message}`);
    }
  }

  const duration = await ffprobeDuration(renderOut);
  console.log(`[mkivideos] pronto: ${renderOut} (${duration.toFixed(1)}s)`);

  // ── 10. move para o destino ────────────────────────────────────────────────
  emit('movendo');
  let finalPath = renderOut;
  if (req.output) {
    const isFile = req.output.toLowerCase().endsWith('.mp4');
    const destDir = isFile ? path.dirname(req.output) : req.output;
    mkdirSync(destDir, { recursive: true });
    finalPath = isFile ? req.output : path.join(req.output, path.basename(renderOut));
    try { renameSync(renderOut, finalPath); }
    catch { copyFileSync(renderOut, finalPath); }
    console.log(`[mkivideos] movido para ${finalPath}`);
  }

  return { mp4: finalPath, duration, projectDir, format: script.format };
}
