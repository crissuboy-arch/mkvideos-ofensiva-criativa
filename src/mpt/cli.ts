// Subcomando `mkivideos mpt …` — motor MoneyPrinterTurbo (tema → vídeo).
// Gera, consulta e cancela tarefas no motor isolado. O MP4 resultante fica
// em ficheiro para revisão humana; NUNCA é publicado automaticamente.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { MoneyPrinterTurboEngine } from '../engines/moneyprinterturbo/engine.js';

function optVal(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function mptUsage(): string {
  return [
    'mkivideos mpt — Motor MoneyPrinterTurbo (tema → vídeo faceless)',
    '',
    '  mkivideos mpt gerar --subject "<tema>" [--script "<roteiro>"] [--terms "a,b"]',
    '                     [--aspect 9:16|16:9] [--voice <voz>] [--bgm <tipo>]',
    '                     [--out <pasta>] [--espera <ms>]',
    '  mkivideos mpt estado <taskId>',
    '  mkivideos mpt cancelar <taskId>',
    '  mkivideos mpt saude',
    '',
    'Env: MPT_API_BASE_URL, MPT_API_KEY (obrigatórios), MPT_TIMEOUT_MS, MPT_MAX_INFLIGHT.',
    'O MP4 fica em ficheiro para revisão humana; nada é publicado.',
  ].join('\n');
}

export async function runMptCli(args: string[]): Promise<string> {
  const [sub, ...rest] = args;
  const engine = new MoneyPrinterTurboEngine();
  if (sub === 'gerar') {
    const subject = optVal(rest, '--subject');
    if (!subject) return mptUsage();
    const aspect = optVal(rest, '--aspect') === '16:9' ? '16:9' as const : '9:16' as const;
    const created = await engine.createFromTheme({
      subject,
      script: optVal(rest, '--script'),
      terms: optVal(rest, '--terms')?.split(',').map((t) => t.trim()).filter(Boolean),
      aspectRatio: aspect,
      voiceName: optVal(rest, '--voice'),
      bgmType: optVal(rest, '--bgm'),
    });
    const maxWaitMs = Number(optVal(rest, '--espera') ?? 600_000);
    const job = await engine.pollJob(created.id, { maxWaitMs });
    if (job.status !== 'completed') {
      return `MoneyPrinterTurbo tarefa ${job.id}: ${job.status} (${job.stage}).`;
    }
    const buf = await engine.downloadJobVideo(job.id);
    const outDir = optVal(rest, '--out') ?? path.resolve('mpt-output');
    mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `mpt-${job.id}.mp4`);
    writeFileSync(outFile, buf);
    return `MoneyPrinterTurbo concluído: ${outFile} (${buf.length} bytes) — rever antes de publicar.`;
  }
  if (sub === 'estado') {
    const taskId = rest[0];
    if (!taskId) return mptUsage();
    const job = await engine.getJob(taskId);
    return `MoneyPrinterTurbo ${job.id}: ${job.status} (${job.stage})${job.error ? ` — erro: ${job.error}` : ''}.`;
  }
  if (sub === 'cancelar') {
    const taskId = rest[0];
    if (!taskId) return mptUsage();
    const job = await engine.cancelJob(taskId);
    return `MoneyPrinterTurbo ${job.id}: ${job.status}.`;
  }
  if (sub === 'saude') {
    const health = await engine.health();
    const lines = health.checks.map((c) => `  - ${c.name}: ${c.ok ? 'ok' : 'falha'} (${c.detail})`);
    return [`MoneyPrinterTurbo: ${health.message}`, ...lines].join('\n');
  }
  return mptUsage();
}
