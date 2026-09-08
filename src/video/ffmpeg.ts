// Wrapper FFmpeg do MKVideos para operações de vídeo além do render HyperFrames.
// A técnica de queima de legenda (filtro `subtitles` + `force_style`, escaping do
// path no Windows) segue a referência de modules/videosub/apps/server/src/media.ts
// (ver modules/videosub/ORIGEM.md) — reescrita aqui para o MKVideos, sem rodar o
// servidor do videosub. Reaproveita `ffprobeDuration` de src/audio/probe.ts.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { ffprobeDuration } from '../audio/probe.js';

const run = promisify(execFile);

export function ffmpegBin(env: NodeJS.ProcessEnv = process.env): string {
  return env.MKIVIDEOS_FFMPEG || 'ffmpeg';
}

export interface SubtitleStyle {
  /** Nome de fonte disponível no sistema (default: DejaVu Sans). */
  fontName?: string;
  fontSize?: number;
  /** Cor primária em &HBBGGRR (ASS). Default branco. */
  primaryColour?: string;
  outlineColour?: string;
  outline?: number;
  marginV?: number;
  marginLR?: number;
  /** 2 = base centro (default), 1 = base-esquerda, etc. (ASS alignment). */
  alignment?: number;
}

/** Escaping do caminho do .srt para o filtro `subtitles` do FFmpeg (Windows inclusive). */
export function escapeSubtitlesPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function styleString(style: SubtitleStyle, width: number, height: number): string {
  const s = {
    FontName: style.fontName ?? 'DejaVu Sans',
    FontSize: style.fontSize ?? Math.round(Math.min(width, height) / 22),
    PrimaryColour: style.primaryColour ?? '&H00FFFFFF',
    OutlineColour: style.outlineColour ?? '&H00172227',
    BorderStyle: 1,
    Outline: style.outline ?? 1.2,
    Shadow: 0,
    Alignment: style.alignment ?? 2,
    MarginV: style.marginV ?? Math.round(height * 0.06),
    MarginL: style.marginLR ?? Math.round(width * 0.06),
    MarginR: style.marginLR ?? Math.round(width * 0.06),
  };
  return Object.entries(s).map(([k, v]) => `${k}=${v}`).join(',');
}

export interface BurnInput {
  input: string;
  srt: string;
  output: string;
  width?: number;
  height?: number;
  style?: SubtitleStyle;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/** Queima o .srt no vídeo (hard subs). Local, sem custo. */
export async function burnSubtitles(opts: BurnInput): Promise<{ output: string; duration: number }> {
  if (!existsSync(opts.input)) throw new Error(`vídeo de entrada não encontrado: ${opts.input}`);
  if (!existsSync(opts.srt)) throw new Error(`legenda .srt não encontrada: ${opts.srt}`);
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  const vf = `subtitles='${escapeSubtitlesPath(opts.srt)}':force_style='${styleString(opts.style ?? {}, width, height)}'`;
  const args = [
    '-y', '-i', opts.input, '-vf', vf,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'copy',
    opts.output,
  ];
  await run(ffmpegBin(opts.env), args, {
    cwd: path.dirname(opts.output),
    timeout: opts.timeoutMs ?? 30 * 60_000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (!existsSync(opts.output)) throw new Error('ffmpeg terminou sem gerar o MP4 legendado.');
  const duration = await ffprobeDuration(opts.output).catch(() => 0);
  if (duration < 0.5) throw new Error('MP4 legendado saiu vazio/curto.');
  return { output: opts.output, duration };
}

/** Embute o .srt como faixa de legenda selecionável (soft subs) — sem re-encode de vídeo. */
export async function muxSoftSubtitles(opts: { input: string; srt: string; output: string; lang?: string; env?: NodeJS.ProcessEnv }): Promise<string> {
  const args = [
    '-y', '-i', opts.input, '-i', opts.srt,
    '-map', '0', '-map', '1', '-c', 'copy', '-c:s', 'mov_text',
    '-metadata:s:s:0', `language=${opts.lang ?? 'por'}`,
    opts.output,
  ];
  await run(ffmpegBin(opts.env), args, { cwd: path.dirname(opts.output), timeout: 10 * 60_000, windowsHide: true });
  return opts.output;
}
