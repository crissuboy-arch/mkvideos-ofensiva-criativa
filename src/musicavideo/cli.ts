// Subcomando `mkivideos musicavideo …`.

import { musicavideo } from './service.js';
import type { ParteMusicavideo } from './types.js';
import { CostAuthorizationRequiredError, CostCeilingExceededError } from '../cost/types.js';

function optVal(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const isParte = (v?: string): v is ParteMusicavideo => v === 'musica' || v === 'capa' || v === 'clipe';

export function musicavideoUsage(): string {
  return [
    'mkivideos musicavideo — Música + Videoclipe (motor: musicavideo)',
    '',
    '  mkivideos musicavideo plano "<solicitação>" [slug] [--estilo <x>] [--idioma <x>] [--ritmo <x>]',
    '  mkivideos musicavideo ver <slug> [musica|capa|clipe]',
    '  mkivideos musicavideo ajusta <slug> <parte> "<instrução>" [--refaz]',
    '  mkivideos musicavideo ok <slug> <parte>              # portão do plano — obrigatório antes de "faz"',
    '  mkivideos musicavideo custo <slug>                   # mostra a estimativa ANTES de gastar',
    '  mkivideos musicavideo faz <slug> [parte] --autorizo-gasto   # a ÚNICA ação que gasta',
    '  mkivideos musicavideo revisa <slug> [parte]',
    '  mkivideos musicavideo aprova <slug> <parte> [--faixa 1|2]',
    '  mkivideos musicavideo reprova <slug> <parte> ["4,17,23"]',
    '  mkivideos musicavideo pacote <slug>',
    '  mkivideos musicavideo lista [n] | busca "<termo>"',
    '',
    'REGRA: "faz" nunca gasta sem --autorizo-gasto explícito, e só roda em partes já',
    '"ok"-adas. Trocar para motor pago exige --motor parte=provider:modelo (o CLI',
    'upstream então também exige --autorizo-pago, adicionado automaticamente).',
  ].join('\n');
}

export async function runMusicavideoCli(args: string[]): Promise<string> {
  const svc = musicavideo();
  const [sub, ...rest] = args;
  if (!sub) return musicavideoUsage();

  // Um subprocesso do musicavideo que retorna code != 0 (erro do Python, crash,
  // dependência ausente) NUNCA pode ser reportado como sucesso. Lança → cli.ts
  // imprime "❌ …" e sai com código 1. Referência: src/legendas/service.ts.
  const out = (r: { code: number; stdout: string; stderr: string }): string => {
    if (r.code !== 0) {
      const detalhe = [r.stderr, r.stdout].map((s) => (s ?? '').trim()).filter(Boolean).join('\n').slice(0, 2000);
      throw new Error(
        `musicavideo "${sub}" falhou (código ${r.code})`
        + (detalhe ? `:\n${detalhe}` : ' — o processo não deixou saída (provável crash).'),
      );
    }
    return r.stdout || r.stderr;
  };

  try {
    switch (sub) {
      case 'plano': {
        const solicitacao = rest[0];
        if (!solicitacao) return 'informe a solicitação entre aspas.';
        const slug = rest[1] && !rest[1].startsWith('--') ? rest[1] : undefined;
        const r = await svc.criarPlano({
          solicitacao, slug,
          estilo: optVal(rest, '--estilo'), idioma: optVal(rest, '--idioma'),
          ritmo: optVal(rest, '--ritmo') as never, forca: rest.includes('--forca'),
        });
        return out(r);
      }
      case 'ver': {
        const [slug, parte] = rest;
        if (!slug) return 'informe o slug.';
        const estado = svc.estado(slug);
        const plano = svc.plano(slug);
        if (!estado) return `produção "${slug}" não encontrada.`;
        if (isParte(parte)) return JSON.stringify({ plano: plano?.[parte], estado: estado.partes[parte] }, null, 2);
        return JSON.stringify({ estado, planoResumo: plano?.titulo }, null, 2);
      }
      case 'ajusta': {
        const [slug, parte, ...instrTokens] = rest;
        if (!slug || !isParte(parte) || !instrTokens.length) return 'uso: ajusta <slug> <parte> "<instrução>"';
        const r = await svc.ajusta(slug, parte, instrTokens.join(' ').replace(/^["']|["']$/g, ''), rest.includes('--refaz'));
        return out(r);
      }
      case 'ok': {
        const [slug, parte] = rest;
        if (!slug || !isParte(parte)) return 'uso: ok <slug> <parte>';
        const r = await svc.ok(slug, parte);
        return out(r);
      }
      case 'custo': {
        const [slug] = rest;
        if (!slug) return 'informe o slug.';
        const est = svc.estimarCusto(slug);
        return `estimado: US$ ${est.estimatedUsd.toFixed(4)} (${est.phase}) — motores: ${est.providerId}${est.note ? ` — ${est.note}` : ''}`;
      }
      case 'faz': {
        const [slug, maybeParte] = rest;
        if (!slug) return 'informe o slug.';
        const partes = isParte(maybeParte) ? [maybeParte] : undefined;
        const confirmado = rest.includes('--autorizo-gasto');
        if (!confirmado) {
          const est = svc.estimarCusto(slug, partes);
          if (est.billable) {
            return `❌ custo estimado US$ ${est.estimatedUsd.toFixed(4)} (${est.phase}) — rode de novo com --autorizo-gasto para confirmar.`;
          }
        }
        const r = await svc.faz({ slug, partes, confirmado, semRevisao: rest.includes('--sem-revisao') });
        return out(r);
      }
      case 'revisa': {
        const [slug, parte] = rest;
        if (!slug) return 'informe o slug.';
        const r = await svc.revisa(slug, isParte(parte) ? parte : undefined);
        return out(r);
      }
      case 'aprova': {
        const [slug, parte] = rest;
        if (!slug || !isParte(parte)) return 'uso: aprova <slug> <parte> [--faixa 1|2]';
        const faixaStr = optVal(rest, '--faixa');
        const r = await svc.aprova(slug, parte, faixaStr === '1' ? 1 : faixaStr === '2' ? 2 : undefined);
        return out(r);
      }
      case 'reprova': {
        const [slug, parte, shots] = rest;
        if (!slug || !isParte(parte)) return 'uso: reprova <slug> <parte> ["4,17,23"]';
        const r = await svc.reprova(slug, parte, shots);
        return out(r);
      }
      case 'pacote': {
        const [slug] = rest;
        if (!slug) return 'informe o slug.';
        const r = await svc.pacote(slug);
        return out(r);
      }
      case 'lista':
        return svc.indice(rest[0] ? Number(rest[0]) : 10)
          .map((l) => `${l.slug.padEnd(40)} ${JSON.stringify(l.estados)}  US$${l.custo_gasto_usd}`).join('\n') || '(vazio)';
      case 'busca': {
        const termo = rest.join(' ');
        return svc.busca(termo).map((l) => `${l.slug} — ${l.titulo}`).join('\n') || '(sem resultados)';
      }
      default:
        return musicavideoUsage();
    }
  } catch (e) {
    if (e instanceof CostAuthorizationRequiredError || e instanceof CostCeilingExceededError) return `❌ ${e.message}`;
    throw e;
  }
}
