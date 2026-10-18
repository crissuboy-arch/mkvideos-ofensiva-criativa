// Provedores LongCat-Video (Meituan, licença MIT — código e pesos).
// Espelho com guia PT: https://github.com/inematds/LongCat-Video
//
// ARQUITETURA: bridge por processo externo. O TypeScript monta o input JSON e
// invoca os scripts Python do repo LongCat-Video. Nenhum peso, nenhum código
// Python e nenhum torch entra neste pacote — tudo vive em LONGCAT_DIR.
// Sem configuração, health() = false e generate() nega com instruções claras.
//
// VERIFICAÇÃO (2026-10-18): interface --input_json do script de avatar lida
// no código-fonte; NENHUM teste real executado (exige GPU NVIDIA + 80-160GB
// de pesos). Ver docs/providers-longcat-concat.md.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, writeFileSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { EngineNotImplementedError } from '../types.js';
import type {
  MediaProvider,
  ProviderHealth,
  ProviderId,
  ProviderKind,
  SceneMediaRequest,
  SceneMediaResult,
} from './types.js';

const run = promisify(execFile);

export const LONGCAT_SETUP_MSG =
  'LongCat-Video não configurado. Passos: 1) git clone https://github.com/inematds/LongCat-Video.git ; ' +
  '2) baixar os pesos (meituan-longcat/LongCat-Video-Avatar, ~80-160GB) ; ' +
  '3) definir LONGCAT_DIR no .env apontando para o clone. Detalhes em docs/providers-longcat-concat.md';

function longcatDir(): string {
  return process.env.LONGCAT_DIR || '';
}

function longcatPython(): string {
  return process.env.LONGCAT_PYTHON || 'python3';
}

function avatarScript(): string | null {
  const dir = longcatDir();
  if (!dir) return null;
  const p = path.join(dir, 'run_demo_avatar_single_audio_to_video.py');
  return existsSync(p) ? p : null;
}

function avatarWeightsDir(): string | null {
  const dir = longcatDir();
  if (!dir) return null;
  const custom = process.env.LONGCAT_AVATAR_CHECKPOINT;
  const p = custom
    ? path.resolve(dir, custom)
    : path.join(dir, 'weights', 'LongCat-Video-Avatar');
  return existsSync(p) ? p : null;
}

function bridgeReady(): { ok: boolean; reason: string } {
  if (!longcatDir()) return { ok: false, reason: 'LONGCAT_DIR não definido' };
  if (!avatarScript()) return { ok: false, reason: 'script run_demo_avatar_single_audio_to_video.py não encontrado em LONGCAT_DIR' };
  if (!avatarWeightsDir()) return { ok: false, reason: 'pesos do avatar não encontrados (LONGCAT_AVATAR_CHECKPOINT ou weights/LongCat-Video-Avatar)' };
  return { ok: true, reason: 'bridge pronta' };
}

/** Opções esperadas em SceneMediaRequest.options para o provider avatar. */
export interface AvatarOptions {
  /** Foto da pessoa (caminho local). */
  photoPath: string;
  /** Áudio da fala (caminho local, mp3/wav). */
  audioPath: string;
}

function newestMp4(dir: string): string | null {
  let best: { p: string; m: number } | null = null;
  for (const f of readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.mp4')) continue;
    const p = path.join(dir, f);
    const m = statSync(p).mtimeMs;
    if (!best || m > best.m) best = { p, m };
  }
  return best?.p ?? null;
}

/**
 * Provider `avatar`: LongCat-Video-Avatar 1.5 — foto + áudio → pessoa falando
 * com a boca sincronizada (Whisper-Large, modo int8). Ocupa o slot `avatar`
 * do registro (antes placeholder do HeyGen pago).
 */
export class LongCatAvatarProvider implements MediaProvider {
  readonly id: ProviderId = 'avatar';
  readonly kind: ProviderKind = 'avatar';
  readonly label = 'LongCat-Video-Avatar 1.5 (lip-sync local)';
  readonly implemented = true;

  async health(): Promise<ProviderHealth> {
    const b = bridgeReady();
    return {
      id: this.id,
      available: b.ok,
      message: b.ok ? 'Bridge LongCat-Avatar pronta.' : `LongCat-Avatar indisponível: ${b.reason}.`,
    };
  }

  async generate(req: SceneMediaRequest): Promise<SceneMediaResult> {
    const b = bridgeReady();
    if (!b.ok) throw new EngineNotImplementedError(`LongCat-Avatar (${b.reason}). ${LONGCAT_SETUP_MSG}`);

    const opts = (req.options ?? {}) as Partial<AvatarOptions>;
    if (!opts.photoPath || !existsSync(opts.photoPath)) {
      throw new EngineNotImplementedError('LongCat-Avatar: options.photoPath (foto local) é obrigatório.');
    }
    if (!opts.audioPath || !existsSync(opts.audioPath)) {
      throw new EngineNotImplementedError('LongCat-Avatar: options.audioPath (áudio local) é obrigatório.');
    }

    const workdir = mkdtempSync(path.join(os.tmpdir(), 'longcat-avatar-'));
    const inputJson = path.join(workdir, 'input.json');
    const outDir = path.join(workdir, 'out');
    writeFileSync(
      inputJson,
      JSON.stringify({
        prompt: req.brief,
        cond_image: path.resolve(opts.photoPath),
        cond_audio: { person1: path.resolve(opts.audioPath) },
      }),
    );

    const args = [
      avatarScript() as string,
      '--input_json', inputJson,
      '--checkpoint_dir', avatarWeightsDir() as string,
      '--output_dir', outDir,
      '--use_int8',
    ];
    const timeoutMs = Number(process.env.LONGCAT_TIMEOUT_MS || '') || 30 * 60 * 1000;
    try {
      await run(longcatPython(), args, { cwd: longcatDir(), timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new EngineNotImplementedError(`LongCat-Avatar falhou na execução: ${msg}`);
    }

    const mp4 = newestMp4(outDir);
    if (!mp4) {
      throw new EngineNotImplementedError('LongCat-Avatar executou mas não produziu nenhum MP4 em output_dir.');
    }
    return {
      provider: this.id,
      model: 'LongCat-Video-Avatar 1.5',
      kind: this.kind,
      filePath: mp4,
      durationSeconds: req.durationSeconds,
      externalId: null,
    };
  }
}

/**
 * Provider `longcat` (kind clip): texto/imagem → vídeo (B-roll, clips).
 * PONTE PENDENTE DE PoC: os scripts demo de text/image-to-video do upstream
 * têm o prompt hardcoded (sem --input_json/--prompt); a integração real exige
 * um wrapper Python próprio + teste em GPU. health() valida os pré-requisitos
 * comuns; generate() nega com a instrução exata até o PoC existir.
 */
export class LongCatClipProvider implements MediaProvider {
  readonly id: ProviderId = 'longcat';
  readonly kind: ProviderKind = 'clip';
  readonly label = 'LongCat-Video (clipe IA local)';
  readonly implemented = true;

  async health(): Promise<ProviderHealth> {
    const b = bridgeReady();
    return {
      id: this.id,
      available: false,
      message: b.ok
        ? 'Pré-requisitos OK, mas a ponte de clip (text/image-to-video) ainda exige PoC em GPU.'
        : `LongCat indisponível: ${b.reason}.`,
    };
  }

  async generate(_req: SceneMediaRequest): Promise<SceneMediaResult> {
    throw new EngineNotImplementedError(
      'LongCat clip (text/image-to-video): os scripts demo do upstream têm prompt hardcoded; ' +
        'a integração exige um wrapper Python + PoC em GPU. ' +
        'Para lip-sync (foto+áudio), use o provider `avatar`.',
    );
  }
}

export const LONGCAT_AVATAR_PROVIDER = new LongCatAvatarProvider();
export const LONGCAT_CLIP_PROVIDER = new LongCatClipProvider();
