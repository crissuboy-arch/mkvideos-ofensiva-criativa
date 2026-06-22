// Narração: hierarquia de voz (pré-gravada → clone XTTS → Kokoro), 100% local.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { ffprobeDuration } from './probe.js';

const run = promisify(execFile);
// No Windows, npx é um .cmd — execFile não o encontra sem extensão.
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const HF = 'hyperframes@0.6.80';

/** TTS local via Kokoro (voz pf_dora, PT-BR) através do HyperFrames. */
export async function kokoroTTS(text: string, outWav: string, speed = 1.1): Promise<void> {
  const txtFile = outWav.replace(/\.wav$/, '.txt');
  writeFileSync(txtFile, text, 'utf-8');
  await run(NPX, [
    HF, 'tts', txtFile,
    '--voice', 'pf_dora', '--speed', String(speed), '--output', outWav,
  ], { maxBuffer: 50 * 1024 * 1024, shell: process.platform === 'win32' });
}

/** Clonagem de voz com Coqui XTTS v2 (requer: pip install TTS). */
export async function xttsGenerate(text: string, outWav: string, refWav: string): Promise<void> {
  const ttsExe = process.platform === 'win32' ? 'tts.exe' : 'tts';
  await run(ttsExe, [
    '--text', text,
    '--model_name', 'tts_models/multilingual/multi-dataset/xtts_v2',
    '--speaker_wav', refWav,
    '--language', 'pt',
    '--out_path', outWav,
  ], { maxBuffer: 50 * 1024 * 1024, timeout: 180000, shell: process.platform === 'win32' });
}

/** Localiza a pasta de voz a partir de nome ou caminho. */
export function resolveVozDir(voz: string): string | null {
  if (!voz) return null;
  if (path.isAbsolute(voz) || voz.includes('/') || voz.includes('\\')) {
    return existsSync(voz) ? voz : null;
  }
  const candidates = [
    process.env.MKIVIDEOS_VOZES ? path.join(process.env.MKIVIDEOS_VOZES, voz) : null,
    path.join(process.cwd(), 'vozes', voz),
    path.join(process.cwd(), '..', 'vozes', voz),
    path.join(os.homedir(), 'meus-videos-ia', 'vozes', voz),
  ].filter(Boolean) as string[];
  return candidates.find(existsSync) ?? null;
}

/**
 * Gera o áudio de uma cena seguindo a hierarquia:
 *   1. arquivo pré-gravado (s{i}.wav/.mp3) na pasta de voz
 *   2. clonagem XTTS com referencia.wav
 *   3. Kokoro (fallback)
 * Retorna a duração real (ffprobe).
 */
export async function generateAudioScene(
  sceneIdx: number,
  text: string,
  outWav: string,
  vozDir: string | null,
  speed: number,
): Promise<number> {
  if (vozDir) {
    const preRecorded = ['.wav', '.mp3'].map((e) => path.join(vozDir, `s${sceneIdx}${e}`)).find(existsSync);
    if (preRecorded) {
      console.log(`    → voz própria: s${sceneIdx}${path.extname(preRecorded)}`);
      copyFileSync(preRecorded, outWav);
      return ffprobeDuration(outWav);
    }
    const refFile = ['referencia.wav', 'reference.wav', 'ref.wav']
      .map((f) => path.join(vozDir, f)).find(existsSync);
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
  await kokoroTTS(text, outWav, speed);
  return ffprobeDuration(outWav);
}
