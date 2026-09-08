// Subcomando `mkivideos url2video …` — usa o mesmo Url2VideoService do painel.

import { url2video } from './service.js';
import type { EngineJob } from '../engines/types.js';

function optVal(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function jobLine(j: EngineJob): string {
  return `#${j.id} [${j.status}] ${j.project} — ${j.stage}${j.error ? ` (erro: ${j.error})` : ''}`;
}

export function url2videoUsage(): string {
  return [
    'mkivideos url2video — transforma uma URL em vídeo (motor content2video)',
    '',
    '  mkivideos url2video <url> [--objetivo "<texto>"] [--formato 9:16|16:9]',
    '                            [--estilo popular|natural|technical] [--ritmo calm|natural|fast]',
    '                            [--preset <id>] [--sem-cta]',
    '  mkivideos url2video status                 motor + defaults + requisitos',
    '  mkivideos url2video jobs                   lista as produções da sessão',
    '  mkivideos url2video aprovar <jobId>        aprova a cena-piloto e produz o vídeo completo',
    '  mkivideos url2video atualizar <jobId>      refaz a cena-piloto (gate)',
    '  mkivideos url2video cancelar <jobId>       cancela um trabalho em andamento',
    '  mkivideos url2video continuar <jobId>      retoma um render interrompido (checkpoint)',
    '  mkivideos url2video projetos               lista os projetos e MP4s',
    '  mkivideos url2video editar <slug> "<instrução>"',
    '  mkivideos url2video variacao <slug> "<instrução>"    duplica e adapta (não altera o original)',
    '  mkivideos url2video renderizar <slug>      valida, renderiza o MP4 e anexa o CTA',
    '  mkivideos url2video editor <slug>          abre o HyperFrames Studio (URL)',
  ].join('\n');
}

export async function runUrl2VideoCli(args: string[]): Promise<string> {
  const svc = url2video();
  const [sub, ...rest] = args;

  if (!sub) return url2videoUsage();

  switch (sub) {
    case 'status': {
      const s = await svc.status();
      const d = s.defaults;
      const checks = s.health.checks.map((c) => `    ${c.ok ? '✅' : c.required ? '❌' : '⚠️ '} ${c.name}: ${c.detail}`).join('\n');
      return [
        `motor: ${s.engine} — ${s.health.ready ? 'pronto' : 'indisponível'} (${s.health.message})`,
        checks,
        `defaults: formato ${d.aspectRatio} · estilo ${d.conversationStyle} · ritmo ${d.speechPace} · CTA ${d.includeCta ? 'sim' : 'não'}`,
        s.config ? `voz ${s.config.voiceId} · ${s.config.resolution} · alvo ${s.config.targetDuration}s · preset default ${s.config.defaultVisualPresetId}` : '',
      ].filter(Boolean).join('\n');
    }
    case 'jobs': {
      const jobs = await svc.listJobs();
      return jobs.length ? jobs.map(jobLine).join('\n') : 'nenhuma produção nesta sessão.';
    }
    case 'projetos':
    case 'projects': {
      const ps = await svc.listProjects();
      if (!ps.length) return 'nenhum projeto ainda.';
      return ps.map((p) => {
        const r = p.renders[0];
        return `${r ? '✓' : '·'} ${p.slug} — ${p.aspectRatio} · ${p.visualPresetName}${r ? ` · ${r.name} (${(r.size / 1048576).toFixed(1)} MB)` : ' · sem MP4'}`;
      }).join('\n');
    }
    case 'aprovar': {
      if (!rest[0]) return 'informe o jobId. Ex.: mkivideos url2video aprovar <jobId>';
      return jobLine(await svc.approve(rest[0]));
    }
    case 'atualizar':
      if (!rest[0]) return 'informe o jobId.';
      return jobLine(await svc.regenerate(rest[0]));
    case 'cancelar':
      if (!rest[0]) return 'informe o jobId.';
      return jobLine(await svc.cancel(rest[0]));
    case 'continuar':
      if (!rest[0]) return 'informe o jobId.';
      return jobLine(await svc.retry(rest[0], 'resume'));
    case 'renderizar':
      if (!rest[0]) return 'informe o slug do projeto.';
      return jobLine(await svc.render(rest[0]));
    case 'editor': {
      if (!rest[0]) return 'informe o slug do projeto.';
      const { url } = await svc.openEditor(rest[0]);
      return `editor: ${url}`;
    }
    case 'editar':
    case 'variacao': {
      const slug = rest[0];
      const instr = rest.slice(1).join(' ').replace(/^["']|["']$/g, '').trim();
      if (!slug || !instr) return `uso: mkivideos url2video ${sub} <slug> "<instrução>"`;
      const job = sub === 'variacao'
        ? await svc.duplicate(slug, { instrucoes: instr })
        : await svc.edit(slug, { instrucoes: instr });
      return jobLine(job);
    }
    default: {
      // trata `sub` como a URL
      const url = sub;
      const job = await svc.start({
        url,
        objetivo: optVal(rest, '--objetivo'),
        formato: optVal(rest, '--formato'),
        estilo: optVal(rest, '--estilo'),
        ritmo: optVal(rest, '--ritmo'),
        preset: optVal(rest, '--preset'),
        cta: rest.includes('--sem-cta') ? false : undefined,
      });
      return [
        jobLine(job),
        'A direção visual e a cena-piloto estão sendo preparadas.',
        `Acompanhe: mkivideos url2video jobs`,
        `Aprovar depois: mkivideos url2video aprovar ${job.id}`,
      ].join('\n');
    }
  }
}
