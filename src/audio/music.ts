// Leito sonoro de fundo gerado por FFmpeg (sem arquivo externo, sem direitos).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Gera uma cama harmônica grave com fade in/out, do tamanho do vídeo. */
export async function generateBgMusic(outWav: string, durationSec: number): Promise<void> {
  await run('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'aevalsrc=0.05*(sin(2*PI*60*t)+0.6*sin(2*PI*90*t)+0.4*sin(2*PI*45*t)):c=stereo:s=44100',
    '-t', String(durationSec + 5),
    '-af', `afade=in:ss=0:d=3,afade=out:st=${durationSec}:d=4`,
    '-y', outWav,
  ]);
}
