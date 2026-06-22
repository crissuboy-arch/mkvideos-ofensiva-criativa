// Medição de duração real de áudio (ffprobe) — base do sync por áudio.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Duração em segundos de um arquivo de áudio/vídeo via ffprobe. */
export async function ffprobeDuration(file: string): Promise<number> {
  const { stdout } = await run('ffprobe', [
    '-v', 'quiet', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]);
  return parseFloat(stdout.trim());
}
