// Subcomando `mkivideos legendas …`.

import { readFileSync } from 'node:fs';

import { legendas } from './service.js';
import { parseSrt } from './srt.js';
import { costLabel } from './transcribe-plan.js';
import { CostAuthorizationRequiredError, CostCeilingExceededError } from '../cost/types.js';

function optVal(a: string[], n: string): string | undefined {
  const i = a.indexOf(n);
  return i >= 0 ? a[i + 1] : undefined;
}

export function legendasUsage(): string {
  return [
    'mkivideos legendas — transcrever, revisar e queimar legenda em um vídeo',
    '',
    '  mkivideos legendas novo <arquivo-de-video> [--titulo "<t>"]',
    '  mkivideos legendas youtube <url> [--titulo "<t>"]     # baixa via yt-dlp e cria o projeto',
    '  mkivideos legendas plano <id>                         # provedores de transcrição, local/grátis vs pago, custo estimado',
    '  mkivideos legendas transcrever <id> [--provedor groq|whisper_local] [--autorizo-gasto]',
    '  mkivideos legendas cues <id>                         # imprime o SRT atual',
    '  mkivideos legendas importar <id> <arquivo.srt>       # substitui as legendas por um SRT editado',
    '  mkivideos legendas sincronizar <id> <segundos>       # desloca todas as legendas (+/-)',
    '  mkivideos legendas queimar <id> [--largura 1080 --altura 1920]',
    '  mkivideos legendas exportar <id>                     # caminho do .srt',
    '  mkivideos legendas softsub <id>                      # MP4 com legenda selecionável (sem re-encode)',
    '  mkivideos legendas lista',
  ].join('\n');
}

export async function runLegendasCli(args: string[]): Promise<string> {
  const svc = legendas();
  const [sub, ...rest] = args;
  if (!sub) return legendasUsage();
  const id = rest[0];

  try {
    switch (sub) {
      case 'novo': {
        if (!id) return 'informe o caminho do vídeo.';
        const p = svc.create(id, optVal(rest, '--titulo'));
        return `criado: ${p.id}\nagora: mkivideos legendas transcrever ${p.id} --autorizo-gasto`;
      }
      case 'youtube': {
        if (!id) return 'informe a URL do vídeo do YouTube.';
        const p = await svc.createFromYoutube(id, optVal(rest, '--titulo'));
        return `importado: ${p.id}\nagora: mkivideos legendas transcrever ${p.id} --autorizo-gasto`;
      }
      case 'plano': {
        if (!id) return 'informe o id.';
        const plan = await svc.transcribePlan(id);
        const linhas = [
          `duração: ${plan.durationLabel}`,
          `recomendado: ${plan.recommendedProviderId}`,
          ...plan.providers.map((p) => {
            const tipo = p.kind === 'local' ? 'LOCAL/GRÁTIS' : 'PAGO';
            const sit = p.available ? 'pronto' : `indisponível — ${p.missing ?? ''}`;
            return `  ${p.id.padEnd(14)} ${tipo.padEnd(12)} ${costLabel(p).padEnd(22)} ${sit}`;
          }),
        ];
        if (!plan.localReady) linhas.push(`\n${plan.localHint}`);
        return linhas.join('\n');
      }
      case 'transcrever': {
        if (!id) return 'informe o id.';
        const confirmed = rest.includes('--autorizo-gasto');
        const { project, cues } = await svc.transcribe(id, { provider: optVal(rest, '--provedor'), confirmed });
        return `transcrito (${project.transcriptProvider}) — ${cues.length} legendas. Revise com "cues ${id}".`;
      }
      case 'cues':
        if (!id) return 'informe o id.';
        return svc.srtText(id) || '(sem legendas ainda)';
      case 'importar': {
        const file = rest[1];
        if (!id || !file) return 'uso: importar <id> <arquivo.srt>';
        svc.setCues(id, parseSrt(readFileSync(file, 'utf-8')));
        return 'legendas atualizadas.';
      }
      case 'sincronizar': {
        const delta = Number(rest[1]);
        if (!id || !Number.isFinite(delta)) return 'uso: sincronizar <id> <segundos>';
        const cues = svc.shift(id, delta);
        return `deslocado ${delta}s — ${cues.length} legendas.`;
      }
      case 'queimar': {
        if (!id) return 'informe o id.';
        const p = await svc.burn(id, {
          width: optVal(rest, '--largura') ? Number(optVal(rest, '--largura')) : undefined,
          height: optVal(rest, '--altura') ? Number(optVal(rest, '--altura')) : undefined,
        });
        return `MP4 legendado: ${p.burnedVideoPath}`;
      }
      case 'exportar':
        if (!id) return 'informe o id.';
        return svc.srtPath(id);
      case 'softsub': {
        if (!id) return 'informe o id.';
        const p = await svc.softSub(id);
        return `MP4 com legenda selecionável: ${p.softSubVideoPath}`;
      }
      case 'lista':
        return svc.list().map((p) => `${p.id.padEnd(40)} ${p.cueCount} cues${p.burnedVideoPath ? ' ✔queimado' : ''}`).join('\n') || '(vazio)';
      default:
        return legendasUsage();
    }
  } catch (e) {
    if (e instanceof CostAuthorizationRequiredError || e instanceof CostCeilingExceededError) return `❌ ${e.message}`;
    throw e;
  }
}
